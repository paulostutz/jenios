-- Uses the original B143 ledger schema loaded by the isolated test runner.
-- No wallet operations or provider calls; only fabricated settled ledger rows.
BEGIN;
INSERT INTO auth.users(id,email) VALUES
 ('43000000-0000-4000-8000-000000000101','g43-pro-a@example.invalid'),
 ('43000000-0000-4000-8000-000000000102','g43-pro-b@example.invalid');
SET LOCAL ROLE service_role;
DO $$
DECLARE a uuid:='43000000-0000-4000-8000-000000000101';b uuid:='43000000-0000-4000-8000-000000000102';
 tid uuid:=gen_random_uuid();cid uuid;claim jsonb;r jsonb;before_ledger jsonb;before_summary jsonb;rev bigint;
 month_value text:=to_char(now() AT TIME ZONE 'UTC','YYYY-MM');finger text:=repeat('a',64);
BEGIN
 cid:=(public.jenios_assistant_conversation_g43('create','user',a,'{"channel":"pro","persona":"genia","remember":true}')#>>'{conversation,id}')::uuid;
 claim:=public.jenios_assistant_conversation_g43('claim','user',a,jsonb_build_object('id',cid,'turnId',tid,'revision',0,'question','Analise o cenário com fontes.','requestFingerprint',finger));
 before_summary:=claim#>'{conversation,summary}';
 r:=public.jenios_assistant_conversation_g43('repair_pro','user',a,jsonb_build_object('id',cid,'turnId',tid));
 IF r->'repaired'<>'false'::jsonb OR r->>'state'<>'pending' THEN RAISE EXCEPTION 'Empty ledger must not repair';END IF;
 INSERT INTO public.jenios_pro_budgets_b143(month,limit_nano_usd) VALUES(month_value,1000000);
 INSERT INTO public.jenios_pro_requests_b143(user_id,request_key,fingerprint,task,model,pricing_version,source,budget_month,
  state,held_retail_nano_usd,held_provider_nano_usd,charged_nano_usd,provider_nano_usd,result_data)
 VALUES(b,tid::text,finger,'analysis','fixture-model','test','prepaid',month_value,'settled',200,100,100,50,'{"answer":"Resposta exclusiva da outra conta."}');
 r:=public.jenios_assistant_conversation_g43('repair_pro','user',a,jsonb_build_object('id',cid,'turnId',tid));
 IF r->'repaired'<>'false'::jsonb OR (r->'conversation')::text LIKE '%exclusiva%' THEN RAISE EXCEPTION 'Another account ledger must never supply repair';END IF;
 INSERT INTO public.jenios_pro_requests_b143(user_id,request_key,fingerprint,task,model,pricing_version,source,budget_month,
  state,held_retail_nano_usd,held_provider_nano_usd,result_data)
 VALUES(a,tid::text,finger,'analysis','fixture-model','test','prepaid',month_value,'reserved',200,100,'{"answer":"Resultado ainda não liquidado."}');
 r:=public.jenios_assistant_conversation_g43('repair_pro','user',a,jsonb_build_object('id',cid,'turnId',tid));
 IF r->'repaired'<>'false'::jsonb THEN RAISE EXCEPTION 'Unsettled ledger must not repair';END IF;
 UPDATE public.jenios_pro_requests_b143 SET state='settled',fingerprint=repeat('b',64),charged_nano_usd=100,provider_nano_usd=50,
  result_data='{"answer":"Resposta paga já liquidada para a própria conta."}' WHERE user_id=a AND request_key=tid::text;
 r:=public.jenios_assistant_conversation_g43('repair_pro','user',a,jsonb_build_object('id',cid,'turnId',tid));
 IF r->'repaired'<>'false'::jsonb THEN RAISE EXCEPTION 'Different request fingerprint must not repair';END IF;
 UPDATE public.jenios_pro_requests_b143 SET fingerprint=finger WHERE user_id=a AND request_key=tid::text;
 UPDATE public.jenios_assistant_turns_g43 SET status='uncertain',lease_until=now()-interval '10 minutes',failure_code='TEST_LOST_RESPONSE' WHERE id=tid;
 SELECT to_jsonb(x) INTO before_ledger FROM public.jenios_pro_requests_b143 x WHERE user_id=a AND request_key=tid::text;
 r:=public.jenios_assistant_conversation_g43('repair_pro','user',a,jsonb_build_object('id',cid,'turnId',tid));
 IF r->'repaired'<>'true'::jsonb OR r->>'state'<>'completed'
  OR r#>>'{conversation,turns,0,answer}'<>'Resposta paga já liquidada para a própria conta.'
  OR r#>'{conversation,summary}'<>before_summary THEN RAISE EXCEPTION 'Matching settled result must repair without invented summary';END IF;
 IF before_ledger<>(SELECT to_jsonb(x) FROM public.jenios_pro_requests_b143 x WHERE user_id=a AND request_key=tid::text)
  THEN RAISE EXCEPTION 'Repair must not alter ledger or charge again';END IF;
 rev:=(r#>>'{conversation,revision}')::bigint;
 r:=public.jenios_assistant_conversation_g43('repair_pro','user',a,jsonb_build_object('id',cid,'turnId',tid));
 IF r->'repaired'<>'false'::jsonb OR (r#>>'{conversation,revision}')::bigint<>rev THEN RAISE EXCEPTION 'Repair replay must be idempotent';END IF;
 r:=public.jenios_assistant_conversation_g43('claim','user',a,jsonb_build_object('id',cid,'turnId',tid,'revision',0,'question','Analise o cenário com fontes.','requestFingerprint',finger));
 IF r->>'state'<>'completed' OR r ? 'leaseToken' THEN RAISE EXCEPTION 'Repaired paid response must replay without new lease';END IF;
 PERFORM public.jenios_assistant_conversation_g43('delete','user',a,jsonb_build_object('id',cid,'revision',rev));
 IF EXISTS(SELECT 1 FROM public.jenios_assistant_turns_g43 WHERE id=tid)
  OR before_ledger<>(SELECT to_jsonb(x) FROM public.jenios_pro_requests_b143 x WHERE user_id=a AND request_key=tid::text)
  THEN RAISE EXCEPTION 'Deleting memory must preserve financial ledger';END IF;
 BEGIN
  PERFORM public.jenios_assistant_conversation_g43('repair_pro','user',a,jsonb_build_object('id',cid,'turnId',tid));
  RAISE EXCEPTION 'Deleted conversation resurrected';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'CONVERSATION_NOT_FOUND' THEN RAISE;END IF;END;
END $$;
SELECT 'G43_PRO_SETTLED_OWNER_FINGERPRINT_REPAIR_NO_RECHARGE_DELETE_PASS';
ROLLBACK;

