-- G44: deterministic context repair for an already-settled Pro response.
-- Does not modify financial tables, generate text, or grant client access.
BEGIN;
CREATE FUNCTION public.jenios_assistant_repair_context_g44(
 p_action text,p_user_id uuid,p_conversation_id uuid,p_turn_id uuid,p_payload jsonb DEFAULT '{}'
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE c public.jenios_assistant_conversations_g43;t public.jenios_assistant_turns_g43;
 ledger_row record;answer_value text;expected bigint;summary_value jsonb;refs jsonb;
 prior_summary jsonb;previous_turns jsonb;k text;allowed text[];latest boolean;
BEGIN
 IF p_action IS NULL OR p_action NOT IN ('inspect','apply') OR p_user_id IS NULL
  OR p_conversation_id IS NULL OR p_turn_id IS NULL OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
  OR octet_length(p_payload::text)>100000 THEN RAISE EXCEPTION 'CONVERSATION_INVALID';END IF;
 allowed:=CASE WHEN p_action='inspect' THEN ARRAY[]::text[] ELSE ARRAY['revision','answer','articles','summary'] END;
 FOR k IN SELECT jsonb_object_keys(p_payload) LOOP
  IF NOT(k=ANY(allowed)) THEN RAISE EXCEPTION 'CONVERSATION_INVALID';END IF;
 END LOOP;
 SELECT * INTO c FROM public.jenios_assistant_conversations_g43
  WHERE id=p_conversation_id AND user_id=p_user_id AND channel='pro' AND expires_at>now() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'CONVERSATION_NOT_FOUND';END IF;
 SELECT * INTO t FROM public.jenios_assistant_turns_g43 WHERE id=p_turn_id AND conversation_id=c.id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'CONVERSATION_NOT_FOUND';END IF;
 IF t.request_fingerprint IS NULL OR to_regclass('public.jenios_pro_requests_b143') IS NULL THEN
  RETURN jsonb_build_object('ok',true,'eligible',false,'repaired',false,'conversation',jenios_private.assistant_snapshot_g43(c.id));END IF;
 BEGIN
  EXECUTE 'SELECT fingerprint,result_data FROM public.jenios_pro_requests_b143 WHERE user_id=$1 AND request_key=$2 AND state=''settled'' LIMIT 1 FOR SHARE'
   INTO ledger_row USING c.user_id,t.id::text;
 EXCEPTION WHEN undefined_table OR undefined_column THEN
  RETURN jsonb_build_object('ok',true,'eligible',false,'repaired',false,'conversation',jenios_private.assistant_snapshot_g43(c.id));
 END;
 IF ledger_row.fingerprint IS DISTINCT FROM t.request_fingerprint OR jsonb_typeof(ledger_row.result_data->'answer') IS DISTINCT FROM 'string' THEN
  RETURN jsonb_build_object('ok',true,'eligible',false,'repaired',false,'conversation',jenios_private.assistant_snapshot_g43(c.id));END IF;
 answer_value:=btrim(ledger_row.result_data->>'answer');
 IF char_length(answer_value) NOT BETWEEN 1 AND 16000 OR jenios_private.assistant_secret_g43(answer_value) THEN
  RETURN jsonb_build_object('ok',true,'eligible',false,'repaired',false,'conversation',jenios_private.assistant_snapshot_g43(c.id));END IF;
 latest:=NOT EXISTS(SELECT 1 FROM public.jenios_assistant_turns_g43 WHERE conversation_id=c.id AND ordinal>t.ordinal);
 IF p_action='inspect' THEN
  SELECT context_summary INTO prior_summary FROM public.jenios_assistant_turns_g43
   WHERE conversation_id=c.id AND ordinal<t.ordinal AND status='completed' ORDER BY ordinal DESC LIMIT 1;
  prior_summary:=coalesce(prior_summary,'{"version":1,"topic":null,"articleIds":[],"planCodes":[],"corrections":[],"reportedStep":null}'::jsonb);
  SELECT coalesce(jsonb_agg(jsonb_build_object('turnId',q.id,'question',q.question,'answer',q.answer,'articles',q.articles,
   'createdAt',q.created_at,'status',q.status) ORDER BY q.ordinal),'[]') INTO previous_turns
   FROM (SELECT * FROM public.jenios_assistant_turns_g43 WHERE conversation_id=c.id AND ordinal<t.ordinal
    AND status='completed' ORDER BY ordinal DESC LIMIT 8)q;
  RETURN jsonb_build_object('ok',true,'eligible',true,'repaired',false,'latest',latest,
   'conversation',jenios_private.assistant_snapshot_g43(c.id),'priorSummary',prior_summary,'previousTurns',previous_turns,
   'turn',jsonb_build_object('turnId',t.id,'question',t.question,'answer',answer_value,'persona',t.persona,'createdAt',t.created_at));
 END IF;
 IF jsonb_typeof(p_payload->'revision') IS DISTINCT FROM 'number' OR (p_payload->>'revision')!~'^[0-9]{1,16}$'
  OR jsonb_typeof(p_payload->'answer') IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'CONVERSATION_INVALID';END IF;
 expected:=(p_payload->>'revision')::bigint;
 IF expected>=9007199254740990 THEN RAISE EXCEPTION 'CONVERSATION_INVALID';END IF;
 IF p_payload->>'answer' IS DISTINCT FROM answer_value THEN RAISE EXCEPTION 'CONVERSATION_REPAIR_CONFLICT';END IF;
 summary_value:=p_payload->'summary';refs:=p_payload->'articles';
 IF NOT jenios_private.assistant_summary_valid_g43(summary_value) OR NOT jenios_private.assistant_articles_valid_g43(refs)
  THEN RAISE EXCEPTION 'CONVERSATION_INVALID';END IF;
 IF summary_value->'articleIds' IS DISTINCT FROM (SELECT coalesce(jsonb_agg(x->>'id'),'[]') FROM jsonb_array_elements(refs)x)
  THEN RAISE EXCEPTION 'CONVERSATION_INVALID';END IF;
 IF t.status='completed' AND t.answer=answer_value AND t.articles=refs AND t.context_summary=summary_value
  AND (NOT latest OR c.summary=summary_value) THEN
  RETURN jsonb_build_object('ok',true,'eligible',true,'repaired',false,'replayed',true,'conversation',jenios_private.assistant_snapshot_g43(c.id));
 END IF;
 IF c.revision<>expected THEN RAISE EXCEPTION 'CONVERSATION_REVISION_CONFLICT';END IF;
 UPDATE public.jenios_assistant_turns_g43 SET status='completed',answer=answer_value,articles=refs,
  context_summary=summary_value,failure_code=NULL,completed_at=coalesce(completed_at,now()) WHERE id=t.id;
 UPDATE public.jenios_assistant_conversations_g43 SET summary=CASE WHEN latest THEN summary_value ELSE summary END,
  revision=revision+1,updated_at=now() WHERE id=c.id;
 RETURN jsonb_build_object('ok',true,'eligible',true,'repaired',true,'replayed',false,'summaryUpdated',latest,
  'conversation',jenios_private.assistant_snapshot_g43(c.id));
END;
$$;
REVOKE ALL ON FUNCTION public.jenios_assistant_repair_context_g44(text,uuid,uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.jenios_assistant_repair_context_g44(text,uuid,uuid,uuid,jsonb) TO service_role;
COMMENT ON FUNCTION public.jenios_assistant_repair_context_g44(text,uuid,uuid,uuid,jsonb)
 IS 'Backend-only inspect/apply repair. Rechecks owner, turn key, fingerprint, settled answer and revision; never touches billing.';
COMMIT;
