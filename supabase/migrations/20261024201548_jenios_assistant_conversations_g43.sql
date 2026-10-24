-- G43: private conversation memory and explicitly shared review feedback.
-- LOCAL CANDIDATE ONLY. No scheduler, hosted migration, provider call or billing mutation.
BEGIN;
CREATE SCHEMA IF NOT EXISTS jenios_private;
GRANT USAGE ON SCHEMA jenios_private TO service_role;

CREATE FUNCTION jenios_private.assistant_secret_g43(p_text text) RETURNS boolean
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT coalesce(p_text ~* '-----BEGIN [A-Z ]*PRIVATE KEY-----|\m(sk|sb_secret)[-_][A-Za-z0-9_-]{12,}|\meyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}\.|(api[ _-]?key|api[ _-]?secret|secret[ _-]?key|private[ _-]?key|client[ _-]?secret|access[ _-]?token|refresh[ _-]?token|senha|password|frase[ _-]?semente|seed[ _-]?phrase)[[:space:]]*[:=][[:space:]]*[^[:space:]]{6,}|\m[A-Za-z0-9_+/=-]{48,}\M|(senha|password|api[ _-]?secret|private[ _-]?key)[[:space:]]+(é|e|is)[[:space:]]+[^[:space:]]{6,}',false);
$$;

CREATE FUNCTION jenios_private.assistant_summary_valid_g43(p_value jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE v jsonb; k text;
BEGIN
 IF jsonb_typeof(p_value) IS DISTINCT FROM 'object' OR char_length(p_value::text)>4000
  OR p_value->'version' IS DISTINCT FROM '1'::jsonb
  OR jsonb_typeof(p_value->'articleIds') IS DISTINCT FROM 'array'
  OR jsonb_typeof(p_value->'planCodes') IS DISTINCT FROM 'array'
  OR jsonb_typeof(p_value->'corrections') IS DISTINCT FROM 'array' THEN RETURN false; END IF;
 FOR k IN SELECT jsonb_object_keys(p_value) LOOP
  IF k<>ALL(ARRAY['version','topic','articleIds','planCodes','guideId','pendingQuestion','corrections','reportedStep']) THEN RETURN false; END IF;
 END LOOP;
 IF p_value->>'topic' IS NOT NULL AND (p_value->>'topic')!~'^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$' THEN RETURN false; END IF;
 IF p_value->>'guideId' IS NOT NULL AND (p_value->>'guideId')!~'^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$' THEN RETURN false; END IF;
 IF p_value ? 'pendingQuestion' AND (jsonb_typeof(p_value->'pendingQuestion') IS DISTINCT FROM 'string'
  OR char_length(p_value->>'pendingQuestion')>350) THEN RETURN false; END IF;
 IF jsonb_array_length(p_value->'articleIds')>8 OR jsonb_array_length(p_value->'planCodes')>3
  OR jsonb_array_length(p_value->'corrections')>3 THEN RETURN false; END IF;
 FOR v IN SELECT value FROM jsonb_array_elements(p_value->'articleIds') LOOP
  IF jsonb_typeof(v)<>'string' OR (v#>>'{}')!~'^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$' THEN RETURN false; END IF;
 END LOOP;
 FOR v IN SELECT value FROM jsonb_array_elements(p_value->'planCodes') LOOP
  IF jsonb_typeof(v)<>'string' OR (v#>>'{}')<>ALL(ARRAY['platform-nacional','platform-global-crypto','platform-internacional-pro']) THEN RETURN false; END IF;
 END LOOP;
 FOR v IN SELECT value FROM jsonb_array_elements(p_value->'corrections')
  UNION ALL SELECT p_value->'reportedStep' WHERE p_value->'reportedStep' IS NOT NULL AND p_value->'reportedStep'<>'null'::jsonb LOOP
  IF jsonb_typeof(v) IS DISTINCT FROM 'object' OR v->>'origin' IS DISTINCT FROM 'user'
   OR v->'verified' IS DISTINCT FROM 'false'::jsonb OR jsonb_typeof(v->'text') IS DISTINCT FROM 'string'
   OR char_length(btrim(v->>'text')) NOT BETWEEN 1 AND 600
   OR jsonb_typeof(v->'createdAt') IS DISTINCT FROM 'string' THEN RETURN false; END IF;
  FOR k IN SELECT jsonb_object_keys(v) LOOP IF k<>ALL(ARRAY['text','origin','verified','createdAt']) THEN RETURN false; END IF; END LOOP;
  PERFORM (v->>'createdAt')::timestamptz;
 END LOOP;
 RETURN NOT jenios_private.assistant_secret_g43(p_value::text);
EXCEPTION WHEN others THEN RETURN false;
END;
$$;

CREATE FUNCTION jenios_private.assistant_articles_valid_g43(p_value jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE v jsonb; k text;
BEGIN
 IF jsonb_typeof(p_value) IS DISTINCT FROM 'array' OR jsonb_array_length(p_value)>8
  OR octet_length(p_value::text)>16000 THEN RETURN false; END IF;
 FOR v IN SELECT value FROM jsonb_array_elements(p_value) LOOP
  IF jsonb_typeof(v) IS DISTINCT FROM 'object' OR (v->>'id') IS NULL OR (v->>'id')!~'^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$'
   OR jsonb_typeof(v->'title') IS DISTINCT FROM 'string' OR char_length(btrim(v->>'title')) NOT BETWEEN 1 AND 180
   OR jsonb_typeof(v->'href') IS DISTINCT FROM 'string' OR char_length(v->>'href')>500
   OR ((v->>'href')<>'/' AND (v->>'href')!~'^/[^/]') OR (v->>'href')~'[[:space:]<>"]' THEN RETURN false; END IF;
  FOR k IN SELECT jsonb_object_keys(v) LOOP IF k<>ALL(ARRAY['id','title','href','version','reviewedAt']) THEN RETURN false; END IF; END LOOP;
 END LOOP;
 RETURN NOT jenios_private.assistant_secret_g43(p_value::text);
EXCEPTION WHEN others THEN RETURN false;
END;
$$;

CREATE FUNCTION jenios_private.assistant_tool_valid_g43(p_value jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE v jsonb; k text;
BEGIN
 IF p_value IS NULL OR p_value='null'::jsonb THEN RETURN true; END IF;
 IF jsonb_typeof(p_value) IS DISTINCT FROM 'object' OR octet_length(p_value::text)>3000
  OR p_value->>'origin' IS DISTINCT FROM 'server' OR p_value->'verified' IS DISTINCT FROM 'true'::jsonb
  OR (p_value->>'tool') IS NULL OR (p_value->>'tool')!~'^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$'
  OR jsonb_typeof(p_value->'observedAt') IS DISTINCT FROM 'string'
  OR jsonb_typeof(p_value->'facts') IS DISTINCT FROM 'array' OR jsonb_array_length(p_value->'facts')>12 THEN RETURN false; END IF;
 FOR k IN SELECT jsonb_object_keys(p_value) LOOP IF k<>ALL(ARRAY['origin','verified','tool','observedAt','sourceAt','facts']) THEN RETURN false; END IF; END LOOP;
 PERFORM (p_value->>'observedAt')::timestamptz;
 IF p_value->>'sourceAt' IS NOT NULL THEN PERFORM (p_value->>'sourceAt')::timestamptz; END IF;
 FOR v IN SELECT value FROM jsonb_array_elements(p_value->'facts') LOOP
  IF jsonb_typeof(v) IS DISTINCT FROM 'object' OR jsonb_typeof(v->'label') IS DISTINCT FROM 'string'
   OR jsonb_typeof(v->'value') IS DISTINCT FROM 'string' OR char_length(btrim(v->>'label')) NOT BETWEEN 1 AND 100
   OR char_length(btrim(v->>'value')) NOT BETWEEN 1 AND 500 THEN RETURN false; END IF;
  FOR k IN SELECT jsonb_object_keys(v) LOOP IF k<>ALL(ARRAY['label','value']) THEN RETURN false; END IF; END LOOP;
 END LOOP;
 RETURN NOT jenios_private.assistant_secret_g43(p_value::text);
EXCEPTION WHEN others THEN RETURN false;
END;
$$;

CREATE TABLE public.jenios_assistant_conversations_g43 (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
 visitor_id uuid,
 channel text NOT NULL CHECK(channel IN ('support','pro')),
 persona text NOT NULL CHECK(persona IN ('genio','genia')),
 revision bigint NOT NULL DEFAULT 0 CHECK(revision>=0 AND revision<9007199254740990),
 remember boolean NOT NULL DEFAULT false,
 summary jsonb NOT NULL DEFAULT '{"version":1,"topic":null,"articleIds":[],"planCodes":[],"corrections":[],"reportedStep":null}'::jsonb
  CHECK(jenios_private.assistant_summary_valid_g43(summary)),
 tool_context jsonb CHECK(jenios_private.assistant_tool_valid_g43(tool_context)),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL,
 CHECK((user_id IS NULL)<>(visitor_id IS NULL)),
 CHECK(user_id IS NOT NULL OR (channel='support' AND remember=false)),
 CHECK(expires_at>created_at AND expires_at<=created_at+interval '30 days')
);
CREATE INDEX jenios_assistant_conversations_user_g43 ON public.jenios_assistant_conversations_g43(user_id,channel,updated_at DESC) WHERE user_id IS NOT NULL;
CREATE INDEX jenios_assistant_conversations_visitor_g43 ON public.jenios_assistant_conversations_g43(visitor_id,channel,updated_at DESC) WHERE visitor_id IS NOT NULL;
CREATE INDEX jenios_assistant_conversations_expiry_g43 ON public.jenios_assistant_conversations_g43(expires_at,id);

CREATE TABLE public.jenios_assistant_turns_g43 (
 id uuid PRIMARY KEY,
 conversation_id uuid NOT NULL REFERENCES public.jenios_assistant_conversations_g43(id) ON DELETE CASCADE,
 ordinal integer NOT NULL CHECK(ordinal BETWEEN 1 AND 100),
 persona text NOT NULL CHECK(persona IN ('genio','genia')),
 question text NOT NULL CHECK(char_length(btrim(question)) BETWEEN 1 AND 2500 AND NOT jenios_private.assistant_secret_g43(question)),
 request_fingerprint text CHECK(request_fingerprint IS NULL OR request_fingerprint~'^[a-f0-9]{64}$'),
 answer text CHECK(answer IS NULL OR (char_length(btrim(answer)) BETWEEN 1 AND 16000 AND NOT jenios_private.assistant_secret_g43(answer))),
 articles jsonb NOT NULL DEFAULT '[]' CHECK(jenios_private.assistant_articles_valid_g43(articles)),
 context_summary jsonb NOT NULL DEFAULT '{"version":1,"topic":null,"articleIds":[],"planCodes":[],"corrections":[],"reportedStep":null}'::jsonb
  CHECK(jenios_private.assistant_summary_valid_g43(context_summary)),
 status text NOT NULL CHECK(status IN ('pending','completed','failed','uncertain')),
 lease_token uuid NOT NULL,
 lease_until timestamptz NOT NULL,
 failure_code text CHECK(failure_code IS NULL OR failure_code~'^[A-Z0-9_]{3,80}$'),
 created_at timestamptz NOT NULL DEFAULT now(),
 completed_at timestamptz,
 UNIQUE(conversation_id,ordinal),
 CHECK((status='completed')=(answer IS NOT NULL))
);
CREATE UNIQUE INDEX jenios_assistant_one_pending_g43 ON public.jenios_assistant_turns_g43(conversation_id) WHERE status='pending';

CREATE TABLE public.jenios_assistant_feedback_g43 (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 conversation_id uuid NOT NULL REFERENCES public.jenios_assistant_conversations_g43(id) ON DELETE CASCADE,
 turn_id uuid NOT NULL REFERENCES public.jenios_assistant_turns_g43(id) ON DELETE CASCADE,
 rating text NOT NULL CHECK(rating IN ('helpful','needs_review')),
 note text NOT NULL DEFAULT '' CHECK(char_length(note)<=500 AND NOT jenios_private.assistant_secret_g43(note)),
 allow_review boolean NOT NULL DEFAULT false,
 topic text,
 article_ids jsonb NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(article_ids)='array' AND jsonb_array_length(article_ids)<=8),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(turn_id)
);
CREATE INDEX jenios_assistant_feedback_conversation_g43 ON public.jenios_assistant_feedback_g43(conversation_id);
CREATE INDEX jenios_assistant_feedback_review_g43 ON public.jenios_assistant_feedback_g43(created_at DESC) WHERE allow_review=true;

ALTER TABLE public.jenios_assistant_conversations_g43 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jenios_assistant_turns_g43 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jenios_assistant_feedback_g43 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.jenios_assistant_conversations_g43,public.jenios_assistant_turns_g43,public.jenios_assistant_feedback_g43 FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.jenios_assistant_conversations_g43,public.jenios_assistant_turns_g43,public.jenios_assistant_feedback_g43 TO service_role;

CREATE FUNCTION jenios_private.assistant_snapshot_g43(p_id uuid,p_turns boolean DEFAULT true) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT jsonb_build_object('id',c.id,'channel',c.channel,'persona',c.persona,'revision',c.revision,
  'remember',c.remember,'expiresAt',c.expires_at,'createdAt',c.created_at,'updatedAt',c.updated_at,
  'title',coalesce((SELECT left(t.question,120) FROM public.jenios_assistant_turns_g43 t WHERE t.conversation_id=c.id ORDER BY ordinal LIMIT 1),'Nova conversa'),
  'summary',c.summary,'toolContext',c.tool_context,
  'turnCount',(SELECT count(*) FROM public.jenios_assistant_turns_g43 t WHERE t.conversation_id=c.id),
  'turns',CASE WHEN NOT p_turns THEN '[]'::jsonb ELSE coalesce((SELECT jsonb_agg(jsonb_build_object(
   'turnId',t.id,'question',t.question,'answer',t.answer,'articles',t.articles,'status',t.status,'persona',t.persona,
   'createdAt',t.created_at,'completedAt',t.completed_at,'code',t.failure_code) ORDER BY t.ordinal)
   FROM (SELECT * FROM public.jenios_assistant_turns_g43 q WHERE q.conversation_id=c.id ORDER BY ordinal DESC LIMIT 20)t),'[]'::jsonb) END)
 FROM public.jenios_assistant_conversations_g43 c WHERE c.id=p_id AND c.expires_at>now();
$$;

CREATE FUNCTION jenios_private.assistant_redact_note_g43(p_text text) RETURNS text
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(coalesce(p_text,''),
 '[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}','[e-mail removido]','gi'),
 'https?://[^[:space:]]+','[endereço removido]','gi'),
 '\m[0-9]{2}[. ]?[0-9]{3}[. ]?[0-9]{3}[/ ]?[0-9]{4}[- ]?[0-9]{2}\M','[documento removido]','g'),
 '\m[0-9]{3}[. ]?[0-9]{3}[. ]?[0-9]{3}[- ]?[0-9]{2}\M','[documento removido]','g'),
 '(\+?55[[:space:]]*)?\(?[0-9]{2}\)?[[:space:]]*[0-9]{4,5}[- ]?[0-9]{4}\M','[telefone removido]','g');
$$;

CREATE FUNCTION public.jenios_assistant_conversation_g43(p_action text,p_owner_kind text,p_owner_id uuid,p_payload jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE c public.jenios_assistant_conversations_g43; t public.jenios_assistant_turns_g43;
 id_value uuid; turn_value uuid; expected bigint; k text; allowed text[]; ch text;
 remembered boolean; chosen text; answer_value text; summary_value jsonb; refs jsonb; note_value text;
 result jsonb; feedback_value jsonb; turn_result jsonb; n integer; token_value uuid; ledger_row record;
BEGIN
 IF p_owner_kind IS NULL OR p_owner_kind NOT IN ('user','visitor') OR p_owner_id IS NULL
  OR p_action IS NULL OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object' OR octet_length(p_payload::text)>100000
  THEN RAISE EXCEPTION 'CONVERSATION_INVALID'; END IF;
 allowed:=CASE p_action
  WHEN 'list' THEN ARRAY['channel'] WHEN 'read' THEN ARRAY['id','channel']
  WHEN 'create' THEN ARRAY['channel','persona','remember'] WHEN 'delete' THEN ARRAY['id','revision']
  WHEN 'persona' THEN ARRAY['id','revision','persona'] WHEN 'claim' THEN ARRAY['id','turnId','revision','question','requestFingerprint']
  WHEN 'repair_pro' THEN ARRAY['id','turnId']
  WHEN 'complete' THEN ARRAY['id','turnId','leaseToken','answer','articles','summary','toolContext']
  WHEN 'fail' THEN ARRAY['id','turnId','leaseToken','code','uncertain']
  WHEN 'feedback' THEN ARRAY['id','turnId','rating','note','allowReview'] ELSE NULL END;
 IF allowed IS NULL THEN RAISE EXCEPTION 'CONVERSATION_INVALID'; END IF;
 FOR k IN SELECT jsonb_object_keys(p_payload) LOOP IF NOT(k=ANY(allowed)) THEN RAISE EXCEPTION 'CONVERSATION_INVALID'; END IF; END LOOP;
 IF p_action IN ('list','create') OR p_payload ? 'channel' THEN
  ch:=p_payload->>'channel';IF ch IS NULL OR ch NOT IN ('support','pro') THEN RAISE EXCEPTION 'CONVERSATION_INVALID';END IF;
  IF p_owner_kind='visitor' AND ch='pro' THEN RAISE EXCEPTION 'CONVERSATION_AUTH_REQUIRED';END IF;
 END IF;
 IF p_action='list' THEN
  SELECT coalesce(jsonb_agg(jenios_private.assistant_snapshot_g43(x.id,false) ORDER BY x.updated_at DESC,x.id),'[]') INTO result
  FROM (SELECT id,updated_at FROM public.jenios_assistant_conversations_g43
   WHERE channel=ch AND expires_at>now() AND
    ((p_owner_kind='user' AND user_id=p_owner_id) OR (p_owner_kind='visitor' AND visitor_id=p_owner_id))
   ORDER BY updated_at DESC,id LIMIT 20)x;
  RETURN jsonb_build_object('ok',true,'conversations',result);
 END IF;
 IF p_action='create' THEN
  IF jsonb_typeof(p_payload->'remember') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'CONVERSATION_INVALID';END IF;
  remembered:=(p_payload->>'remember')::boolean;chosen:=p_payload->>'persona';
  IF chosen IS NULL OR chosen NOT IN ('genio','genia') OR (p_owner_kind='visitor' AND remembered) THEN RAISE EXCEPTION 'CONVERSATION_INVALID';END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('jenios-assistant-owner:'||p_owner_kind||':'||p_owner_id::text,0));
  SELECT count(*) INTO n FROM public.jenios_assistant_conversations_g43
   WHERE expires_at>now() AND ((p_owner_kind='user' AND user_id=p_owner_id) OR (p_owner_kind='visitor' AND visitor_id=p_owner_id));
  IF n>=20 THEN RAISE EXCEPTION 'CONVERSATION_LIMIT';END IF;
  INSERT INTO public.jenios_assistant_conversations_g43(user_id,visitor_id,channel,persona,remember,expires_at)
   VALUES(CASE WHEN p_owner_kind='user' THEN p_owner_id END,CASE WHEN p_owner_kind='visitor' THEN p_owner_id END,
    ch,chosen,remembered,now()+CASE WHEN remembered THEN interval '30 days' ELSE interval '24 hours' END) RETURNING * INTO c;
  RETURN jsonb_build_object('ok',true,'conversation',jenios_private.assistant_snapshot_g43(c.id));
 END IF;
 BEGIN id_value:=(p_payload->>'id')::uuid;EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'CONVERSATION_INVALID';END;
 IF id_value IS NULL THEN RAISE EXCEPTION 'CONVERSATION_INVALID';END IF;
 SELECT * INTO c FROM public.jenios_assistant_conversations_g43 WHERE id=id_value AND expires_at>now()
  AND ((p_owner_kind='user' AND user_id=p_owner_id) OR (p_owner_kind='visitor' AND visitor_id=p_owner_id)) FOR UPDATE;
 IF NOT FOUND OR (ch IS NOT NULL AND c.channel<>ch) THEN RAISE EXCEPTION 'CONVERSATION_NOT_FOUND';END IF;
 IF p_action='read' THEN RETURN jsonb_build_object('ok',true,'conversation',jenios_private.assistant_snapshot_g43(c.id));END IF;
 IF p_action IN ('delete','persona','claim') THEN
  IF jsonb_typeof(p_payload->'revision') IS DISTINCT FROM 'number' OR (p_payload->>'revision')!~'^[0-9]{1,16}$' THEN RAISE EXCEPTION 'CONVERSATION_INVALID';END IF;
  expected:=(p_payload->>'revision')::bigint;
  IF expected>=9007199254740990 THEN RAISE EXCEPTION 'CONVERSATION_INVALID';END IF;
 END IF;
 IF p_action='delete' THEN
  IF expected<>c.revision THEN RAISE EXCEPTION 'CONVERSATION_REVISION_CONFLICT';END IF;
  DELETE FROM public.jenios_assistant_conversations_g43 WHERE id=c.id;
  RETURN jsonb_build_object('ok',true,'deleted',true);
 END IF;
 IF p_action='persona' THEN
  IF expected<>c.revision THEN RAISE EXCEPTION 'CONVERSATION_REVISION_CONFLICT';END IF;
  IF EXISTS(SELECT 1 FROM public.jenios_assistant_turns_g43 WHERE conversation_id=c.id AND status='pending') THEN RAISE EXCEPTION 'CONVERSATION_TURN_BUSY';END IF;
  chosen:=p_payload->>'persona';IF chosen IS NULL OR chosen NOT IN ('genio','genia') THEN RAISE EXCEPTION 'CONVERSATION_INVALID';END IF;
  UPDATE public.jenios_assistant_conversations_g43 SET persona=chosen,revision=revision+1,updated_at=now() WHERE id=c.id;
  RETURN jsonb_build_object('ok',true,'conversation',jenios_private.assistant_snapshot_g43(c.id));
 END IF;
 BEGIN turn_value:=(p_payload->>'turnId')::uuid;EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'CONVERSATION_INVALID';END;
 IF turn_value IS NULL THEN RAISE EXCEPTION 'CONVERSATION_INVALID';END IF;
 SELECT * INTO t FROM public.jenios_assistant_turns_g43 WHERE id=turn_value AND conversation_id=c.id;
 IF p_action='claim' THEN
  IF jsonb_typeof(p_payload->'question') IS DISTINCT FROM 'string' OR char_length(btrim(p_payload->>'question')) NOT BETWEEN 1 AND 2500 THEN RAISE EXCEPTION 'CONVERSATION_INVALID';END IF;
  IF jenios_private.assistant_secret_g43(p_payload->>'question') THEN RAISE EXCEPTION 'CONVERSATION_SENSITIVE_INPUT';END IF;
  IF (c.channel='pro' OR p_payload ? 'requestFingerprint') AND (jsonb_typeof(p_payload->'requestFingerprint') IS DISTINCT FROM 'string'
   OR (p_payload->>'requestFingerprint')!~'^[a-f0-9]{64}$') THEN RAISE EXCEPTION 'CONVERSATION_INVALID';END IF;
  IF t.id IS NOT NULL THEN
   IF t.question<>btrim(p_payload->>'question') OR t.request_fingerprint IS DISTINCT FROM (p_payload->>'requestFingerprint') THEN RAISE EXCEPTION 'CONVERSATION_TURN_CONFLICT';END IF;
   IF t.status='pending' AND t.lease_until<=now() THEN
    UPDATE public.jenios_assistant_turns_g43 SET status='uncertain',failure_code='TURN_LEASE_EXPIRED',completed_at=now() WHERE id=t.id RETURNING * INTO t;
    UPDATE public.jenios_assistant_conversations_g43 SET revision=revision+1,updated_at=now() WHERE id=c.id;
   END IF;
   RETURN jsonb_build_object('ok',true,'state',t.status,'replayed',true,'conversation',jenios_private.assistant_snapshot_g43(c.id),
    'turn',jsonb_build_object('turnId',t.id,'question',t.question,'answer',t.answer,'articles',t.articles,'status',t.status,'createdAt',t.created_at,'code',t.failure_code));
  END IF;
  IF expected<>c.revision THEN RAISE EXCEPTION 'CONVERSATION_REVISION_CONFLICT';END IF;
  SELECT * INTO t FROM public.jenios_assistant_turns_g43 WHERE conversation_id=c.id AND status='pending';
  IF t.id IS NOT NULL THEN
   IF t.lease_until>now() THEN RAISE EXCEPTION 'CONVERSATION_TURN_BUSY';END IF;
   UPDATE public.jenios_assistant_turns_g43 SET status='uncertain',failure_code='TURN_LEASE_EXPIRED',completed_at=now() WHERE id=t.id;
   UPDATE public.jenios_assistant_conversations_g43 SET revision=revision+1,updated_at=now() WHERE id=c.id;
   RETURN jsonb_build_object('ok',true,'state','uncertain','replayed',false,'conversation',jenios_private.assistant_snapshot_g43(c.id),'turn',jsonb_build_object('turnId',t.id,'status','uncertain','code','TURN_LEASE_EXPIRED'));
  END IF;
  SELECT coalesce(max(ordinal),0)+1 INTO n FROM public.jenios_assistant_turns_g43 WHERE conversation_id=c.id;
  IF n>100 THEN RAISE EXCEPTION 'CONVERSATION_LIMIT';END IF;
  token_value:=gen_random_uuid();
  BEGIN
   INSERT INTO public.jenios_assistant_turns_g43(id,conversation_id,ordinal,persona,question,request_fingerprint,status,lease_token,lease_until)
    VALUES(turn_value,c.id,n,c.persona,btrim(p_payload->>'question'),p_payload->>'requestFingerprint','pending',token_value,now()+interval '2 minutes') RETURNING * INTO t;
  EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'CONVERSATION_TURN_CONFLICT';END;
  UPDATE public.jenios_assistant_conversations_g43 SET revision=revision+1,updated_at=now() WHERE id=c.id;
  RETURN jsonb_build_object('ok',true,'state','claimed','replayed',false,'leaseToken',token_value,
   'conversation',jenios_private.assistant_snapshot_g43(c.id),'turn',jsonb_build_object('turnId',t.id,'question',t.question,'status',t.status,'createdAt',t.created_at));
 END IF;
 IF t.id IS NULL THEN RAISE EXCEPTION 'CONVERSATION_NOT_FOUND';END IF;
 IF p_action='repair_pro' THEN
  IF p_owner_kind<>'user' OR c.channel<>'pro' OR t.request_fingerprint IS NULL THEN RAISE EXCEPTION 'CONVERSATION_INVALID';END IF;
  IF t.status='completed' OR to_regclass('public.jenios_pro_requests_b143') IS NULL THEN
   RETURN jsonb_build_object('ok',true,'repaired',false,'state',t.status,'conversation',jenios_private.assistant_snapshot_g43(c.id));END IF;
  BEGIN
   EXECUTE 'SELECT fingerprint,result_data FROM public.jenios_pro_requests_b143 WHERE user_id=$1 AND request_key=$2 AND state=''settled'' LIMIT 1'
    INTO ledger_row USING c.user_id,t.id::text;
  EXCEPTION WHEN undefined_table OR undefined_column THEN
   RETURN jsonb_build_object('ok',true,'repaired',false,'state',t.status,'conversation',jenios_private.assistant_snapshot_g43(c.id));
  END;
  IF ledger_row.fingerprint IS DISTINCT FROM t.request_fingerprint OR jsonb_typeof(ledger_row.result_data->'answer') IS DISTINCT FROM 'string' THEN
   RETURN jsonb_build_object('ok',true,'repaired',false,'state',t.status,'conversation',jenios_private.assistant_snapshot_g43(c.id));END IF;
  answer_value:=ledger_row.result_data->>'answer';
  IF char_length(btrim(answer_value)) NOT BETWEEN 1 AND 16000 OR jenios_private.assistant_secret_g43(answer_value) THEN
   RETURN jsonb_build_object('ok',true,'repaired',false,'state',t.status,'conversation',jenios_private.assistant_snapshot_g43(c.id));END IF;
  UPDATE public.jenios_assistant_turns_g43 SET status='completed',answer=btrim(answer_value),failure_code=NULL,
   context_summary=c.summary,completed_at=now() WHERE id=t.id;
  UPDATE public.jenios_assistant_conversations_g43 SET revision=revision+1,updated_at=now() WHERE id=c.id;
  RETURN jsonb_build_object('ok',true,'repaired',true,'state','completed','conversation',jenios_private.assistant_snapshot_g43(c.id));
 END IF;
 IF p_action='feedback' THEN
  IF t.status<>'completed' THEN RAISE EXCEPTION 'CONVERSATION_INVALID';END IF;
  IF (p_payload->>'rating') IS NULL OR (p_payload->>'rating') NOT IN ('helpful','needs_review')
   OR jsonb_typeof(p_payload->'allowReview') IS DISTINCT FROM 'boolean' OR jsonb_typeof(p_payload->'note') IS DISTINCT FROM 'string'
   OR char_length(p_payload->>'note')>500 THEN RAISE EXCEPTION 'CONVERSATION_INVALID';END IF;
  IF jenios_private.assistant_secret_g43(p_payload->>'note') THEN RAISE EXCEPTION 'CONVERSATION_SENSITIVE_INPUT';END IF;
  note_value:=left(jenios_private.assistant_redact_note_g43(p_payload->>'note'),500);
  INSERT INTO public.jenios_assistant_feedback_g43(conversation_id,turn_id,rating,note,allow_review,topic,article_ids)
   VALUES(c.id,t.id,p_payload->>'rating',note_value,(p_payload->>'allowReview')::boolean,t.context_summary->>'topic',
    coalesce((SELECT jsonb_agg(x->>'id') FROM jsonb_array_elements(t.articles)x),'[]'))
   ON CONFLICT(turn_id) DO UPDATE SET rating=excluded.rating,note=excluded.note,allow_review=excluded.allow_review,created_at=now()
   RETURNING jsonb_build_object('id',id,'turnId',turn_id,'rating',rating,'allowReview',allow_review,'createdAt',created_at) INTO feedback_value;
  RETURN jsonb_build_object('ok',true,'feedback',feedback_value);
 END IF;
 BEGIN token_value:=(p_payload->>'leaseToken')::uuid;EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'CONVERSATION_INVALID';END;
 IF token_value IS NULL OR t.lease_token<>token_value THEN RAISE EXCEPTION 'CONVERSATION_LEASE_INVALID';END IF;
 IF t.status='completed' THEN RETURN jsonb_build_object('ok',true,'state','completed','replayed',true,'conversation',jenios_private.assistant_snapshot_g43(c.id));END IF;
 IF p_action='fail' THEN
  IF (p_payload->>'code') IS NULL OR (p_payload->>'code')!~'^[A-Z0-9_]{3,80}$'
   OR jsonb_typeof(p_payload->'uncertain') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'CONVERSATION_INVALID';END IF;
  IF t.status='pending' THEN
   UPDATE public.jenios_assistant_turns_g43 SET status=CASE WHEN (p_payload->>'uncertain')::boolean THEN 'uncertain' ELSE 'failed' END,
    failure_code=p_payload->>'code',completed_at=now() WHERE id=t.id RETURNING * INTO t;
   UPDATE public.jenios_assistant_conversations_g43 SET revision=revision+1,updated_at=now() WHERE id=c.id;
  END IF;
  RETURN jsonb_build_object('ok',true,'state',t.status,'conversation',jenios_private.assistant_snapshot_g43(c.id));
 END IF;
 IF t.status<>'pending' OR t.lease_until<=now() THEN RAISE EXCEPTION 'CONVERSATION_LEASE_INVALID';END IF;
 answer_value:=p_payload->>'answer';summary_value:=p_payload->'summary';refs:=p_payload->'articles';
 IF jsonb_typeof(p_payload->'answer') IS DISTINCT FROM 'string' OR char_length(btrim(answer_value)) NOT BETWEEN 1 AND 16000
  OR NOT jenios_private.assistant_summary_valid_g43(summary_value) OR NOT jenios_private.assistant_articles_valid_g43(refs)
  OR (p_payload ? 'toolContext' AND NOT jenios_private.assistant_tool_valid_g43(p_payload->'toolContext')) THEN RAISE EXCEPTION 'CONVERSATION_INVALID';END IF;
 IF jenios_private.assistant_secret_g43(answer_value) THEN RAISE EXCEPTION 'CONVERSATION_SENSITIVE_INPUT';END IF;
 UPDATE public.jenios_assistant_turns_g43 SET status='completed',answer=btrim(answer_value),articles=refs,
  context_summary=summary_value,completed_at=now() WHERE id=t.id;
 UPDATE public.jenios_assistant_conversations_g43 SET summary=summary_value,
  tool_context=CASE WHEN p_payload ? 'toolContext' THEN nullif(p_payload->'toolContext','null'::jsonb) ELSE tool_context END,
  revision=revision+1,updated_at=now() WHERE id=c.id;
 RETURN jsonb_build_object('ok',true,'state','completed','replayed',false,'conversation',jenios_private.assistant_snapshot_g43(c.id));
END;
$$;

CREATE FUNCTION public.jenios_assistant_review_g43(p_limit integer DEFAULT 30,p_days integer DEFAULT 30)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 OR p_days IS NULL OR p_days NOT BETWEEN 1 AND 30 THEN RAISE EXCEPTION 'CONVERSATION_INVALID';END IF;
 WITH eligible AS (
  SELECT f.* FROM public.jenios_assistant_feedback_g43 f
  JOIN public.jenios_assistant_conversations_g43 c ON c.id=f.conversation_id
  WHERE f.allow_review=true AND f.created_at>=now()-make_interval(days=>p_days) AND c.expires_at>now()
 ), counts AS (
  SELECT rating,count(*) AS count FROM eligible GROUP BY rating
 ), topics AS (
  SELECT coalesce(topic,'unspecified') AS topic,rating,count(*) AS count FROM eligible GROUP BY topic,rating
 ), articles AS (
  SELECT a.value AS article_id,rating,count(*) AS count FROM eligible CROSS JOIN LATERAL jsonb_array_elements_text(article_ids)a GROUP BY a.value,rating
 ), notes AS (
  SELECT id,rating,note,topic,article_ids,created_at FROM eligible ORDER BY created_at DESC,id LIMIT p_limit
 )
 SELECT jsonb_build_object('ok',true,'windowDays',p_days,'totalConsent',(SELECT count(*) FROM eligible),
  'ratings',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM counts x),'[]'),
  'topics',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM topics x),'[]'),
  'articles',coalesce((SELECT jsonb_agg(jsonb_build_object('articleId',article_id,'rating',rating,'count',count)) FROM articles),'[]'),
  'items',coalesce((SELECT jsonb_agg(jsonb_build_object('feedbackId',id,'rating',rating,'note',note,'topic',topic,'articleIds',article_ids,'createdAt',created_at) ORDER BY created_at DESC,id) FROM notes),'[]'),
  'autoPublished',false) INTO result;
 RETURN result;
END;
$$;

CREATE FUNCTION public.jenios_assistant_cleanup_g43(p_limit integer DEFAULT 500) RETURNS integer
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE n integer;
BEGIN
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 5000 THEN RAISE EXCEPTION 'CONVERSATION_INVALID';END IF;
 WITH expired AS (SELECT id FROM public.jenios_assistant_conversations_g43 WHERE expires_at<=now() ORDER BY expires_at,id LIMIT p_limit FOR UPDATE SKIP LOCKED),
 removed AS (DELETE FROM public.jenios_assistant_conversations_g43 c USING expired e WHERE c.id=e.id RETURNING c.id)
 SELECT count(*) INTO n FROM removed;
 RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION jenios_private.assistant_secret_g43(text),jenios_private.assistant_summary_valid_g43(jsonb),
 jenios_private.assistant_articles_valid_g43(jsonb),jenios_private.assistant_tool_valid_g43(jsonb),
 jenios_private.assistant_snapshot_g43(uuid,boolean),jenios_private.assistant_redact_note_g43(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION jenios_private.assistant_secret_g43(text),jenios_private.assistant_summary_valid_g43(jsonb),
 jenios_private.assistant_articles_valid_g43(jsonb),jenios_private.assistant_tool_valid_g43(jsonb),
 jenios_private.assistant_snapshot_g43(uuid,boolean),jenios_private.assistant_redact_note_g43(text) TO service_role;
REVOKE ALL ON FUNCTION public.jenios_assistant_conversation_g43(text,text,uuid,jsonb),
 public.jenios_assistant_review_g43(integer,integer),public.jenios_assistant_cleanup_g43(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.jenios_assistant_conversation_g43(text,text,uuid,jsonb),
 public.jenios_assistant_review_g43(integer,integer),public.jenios_assistant_cleanup_g43(integer) TO service_role;
COMMENT ON TABLE public.jenios_assistant_conversations_g43 IS 'Server-owned conversational memory. 24h ephemeral / 30d opt-in authenticated retention. Financial Pro ledger is separate.';
COMMENT ON TABLE public.jenios_assistant_feedback_g43 IS 'Explicitly shared review notes and ratings. No automatic publication or model training.';
COMMIT;

