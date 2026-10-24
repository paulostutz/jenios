-- Only loaded by the disposable loopback G44 runner. Every fixture rolls back.
BEGIN;
CREATE FUNCTION pg_temp.g44_assert(ok boolean,message text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'G44 assertion failed: %',message;END IF;END;$$;
CREATE FUNCTION pg_temp.g44_expect(owner_id uuid,cid uuid,tid uuid,payload jsonb,expected text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 BEGIN PERFORM public.jenios_assistant_repair_context_g44('apply',owner_id,cid,tid,payload);
 EXCEPTION WHEN others THEN IF SQLERRM<>expected THEN RAISE EXCEPTION 'Expected %, got %',expected,SQLERRM;END IF;RETURN;END;
 RAISE EXCEPTION 'Expected %, apply succeeded',expected;
END;$$;
INSERT INTO auth.users(id,email) VALUES
 ('44000000-0000-4000-8000-000000000101','g44-repair-a@example.invalid'),
 ('44000000-0000-4000-8000-000000000102','g44-repair-b@example.invalid');
DO $$ BEGIN
 PERFORM pg_temp.g44_assert(NOT has_function_privilege('anon','public.jenios_assistant_repair_context_g44(text,uuid,uuid,uuid,jsonb)','EXECUTE'),'anon cannot inspect or repair');
 PERFORM pg_temp.g44_assert(NOT has_function_privilege('authenticated','public.jenios_assistant_repair_context_g44(text,uuid,uuid,uuid,jsonb)','EXECUTE'),'authenticated cannot inspect or repair');
 PERFORM pg_temp.g44_assert(has_function_privilege('service_role','public.jenios_assistant_repair_context_g44(text,uuid,uuid,uuid,jsonb)','EXECUTE'),'service grant required');
 PERFORM pg_temp.g44_assert(NOT (SELECT prosecdef FROM pg_proc WHERE oid='public.jenios_assistant_repair_context_g44(text,uuid,uuid,uuid,jsonb)'::regprocedure),'repair uses invoker privileges');
END $$;
SET LOCAL ROLE service_role;
DO $$
DECLARE a uuid:='44000000-0000-4000-8000-000000000101';b uuid:='44000000-0000-4000-8000-000000000102';
 cid uuid;tid uuid:=gen_random_uuid();next_tid uuid:=gen_random_uuid();claim jsonb;r jsonb;payload jsonb;
 original jsonb;ledger_before jsonb;later_summary jsonb;rev bigint;
 month_value text:=to_char(now() AT TIME ZONE 'UTC','YYYY-MM');
 summary_value jsonb:='{"version":1,"topic":"plans","articleIds":["plans"],"planCodes":["platform-nacional"],"corrections":[],"reportedStep":null}';
 refs jsonb:='[{"id":"plans","title":"Planos","href":"/lp#planos"}]';
BEGIN
 cid:=(public.jenios_assistant_conversation_g43('create','user',a,'{"channel":"pro","persona":"genia","remember":true}')#>>'{conversation,id}')::uuid;
 claim:=public.jenios_assistant_conversation_g43('claim','user',a,jsonb_build_object('id',cid,'turnId',tid,'revision',0,
  'question','Quero o Nacional.','requestFingerprint',repeat('a',64)));
 r:=public.jenios_assistant_repair_context_g44('inspect',a,cid,tid);
 PERFORM pg_temp.g44_assert(r->'eligible'='false'::jsonb AND r#>>'{conversation,revision}'='1','missing ledger is read only');
 payload:=jsonb_build_object('revision',1,'answer','O Nacional custa R$ 99,90.','summary',summary_value,'articles',refs);
 PERFORM pg_temp.g44_expect(b,cid,tid,payload,'CONVERSATION_NOT_FOUND');
 INSERT INTO public.jenios_pro_budgets_b143(month,limit_nano_usd) VALUES(month_value,1000000);
 INSERT INTO public.jenios_pro_requests_b143(user_id,request_key,fingerprint,task,model,pricing_version,source,budget_month,
  state,held_retail_nano_usd,held_provider_nano_usd,result_data)
 VALUES(b,tid::text,repeat('a',64),'analysis','fixture-model','test','prepaid',month_value,'settled',200,100,'{"answer":"Resposta de outra conta."}');
 r:=public.jenios_assistant_repair_context_g44('inspect',a,cid,tid);
 PERFORM pg_temp.g44_assert(r->'eligible'='false'::jsonb AND NOT(r::text LIKE '%outra conta%'),'other account request key cannot supply context');
 INSERT INTO public.jenios_pro_requests_b143(user_id,request_key,fingerprint,task,model,pricing_version,source,budget_month,
  state,held_retail_nano_usd,held_provider_nano_usd,result_data)
 VALUES(a,tid::text,repeat('a',64),'analysis','fixture-model','test','prepaid',month_value,'reserved',200,100,'{"answer":"O Nacional custa R$ 99,90."}');
 r:=public.jenios_assistant_repair_context_g44('inspect',a,cid,tid);
 PERFORM pg_temp.g44_assert(r->'eligible'='false'::jsonb,'unsettled result cannot supply context');
 UPDATE public.jenios_pro_requests_b143 SET state='settled',charged_nano_usd=100,provider_nano_usd=50 WHERE user_id=a AND request_key=tid::text;
 SELECT to_jsonb(x) INTO original FROM public.jenios_assistant_turns_g43 x WHERE id=tid;
 r:=public.jenios_assistant_repair_context_g44('inspect',a,cid,tid);
 PERFORM pg_temp.g44_assert(r->'eligible'='true'::jsonb AND r#>>'{turn,answer}'='O Nacional custa R$ 99,90.','inspect supplies matching paid answer');
 PERFORM pg_temp.g44_assert(original=(SELECT to_jsonb(x) FROM public.jenios_assistant_turns_g43 x WHERE id=tid),'inspect does not mark completed or mutate context');
 PERFORM pg_temp.g44_expect(a,cid,tid,jsonb_set(payload,'{summary,reportedStep}','{"text":"Já paguei","origin":"user","verified":true,"createdAt":"2026-10-24T21:00:00Z"}'),'CONVERSATION_INVALID');
 PERFORM pg_temp.g44_expect(a,cid,tid,jsonb_set(payload,'{answer}','"Resposta fabricada pelo cliente."'),'CONVERSATION_REPAIR_CONFLICT');
 PERFORM pg_temp.g44_assert(original=(SELECT to_jsonb(x) FROM public.jenios_assistant_turns_g43 x WHERE id=tid),'invalid context/answer writes nothing');
 -- A concurrent write after inspect must not be overwritten.
 UPDATE public.jenios_assistant_conversations_g43 SET revision=revision+1 WHERE id=cid;
 PERFORM pg_temp.g44_expect(a,cid,tid,payload,'CONVERSATION_REVISION_CONFLICT');
 PERFORM pg_temp.g44_assert(original=(SELECT to_jsonb(x) FROM public.jenios_assistant_turns_g43 x WHERE id=tid),'CAS failure writes nothing');
 payload:=jsonb_set(payload,'{revision}','2');
 UPDATE public.jenios_pro_requests_b143 SET fingerprint=repeat('b',64) WHERE user_id=a AND request_key=tid::text;
 r:=public.jenios_assistant_repair_context_g44('apply',a,cid,tid,payload);
 PERFORM pg_temp.g44_assert(r->'eligible'='false'::jsonb AND original=(SELECT to_jsonb(x) FROM public.jenios_assistant_turns_g43 x WHERE id=tid),'apply rechecks fingerprint after inspect');
 UPDATE public.jenios_pro_requests_b143 SET fingerprint=repeat('a',64) WHERE user_id=a AND request_key=tid::text;
 SELECT to_jsonb(x) INTO ledger_before FROM public.jenios_pro_requests_b143 x WHERE user_id=a AND request_key=tid::text;
 r:=public.jenios_assistant_repair_context_g44('apply',a,cid,tid,payload);
 PERFORM pg_temp.g44_assert(r->'repaired'='true'::jsonb AND r#>>'{conversation,revision}'='3'
  AND r#>'{conversation,summary}'=summary_value AND r#>'{conversation,turns,0,articles}'=refs,'answer and context commit together');
 PERFORM pg_temp.g44_assert(ledger_before=(SELECT to_jsonb(x) FROM public.jenios_pro_requests_b143 x WHERE user_id=a AND request_key=tid::text),'repair does not rebill or alter financial record');
 r:=public.jenios_assistant_repair_context_g44('apply',a,cid,tid,payload);
 PERFORM pg_temp.g44_assert(r->'replayed'='true'::jsonb AND r#>>'{conversation,revision}'='3','stale identical retry is idempotent');

 -- Historical metadata can be repaired without replacing a later topic.
 later_summary:='{"version":1,"topic":"photo-posts","articleIds":["photo-posts"],"planCodes":[],"corrections":[],"reportedStep":null}';
 claim:=public.jenios_assistant_conversation_g43('claim','user',a,jsonb_build_object('id',cid,'turnId',next_tid,'revision',3,
  'question','Como publicar uma foto?','requestFingerprint',repeat('c',64)));
 PERFORM public.jenios_assistant_conversation_g43('complete','user',a,jsonb_build_object('id',cid,'turnId',next_tid,
  'leaseToken',claim->>'leaseToken','answer','Use o formato JPG para publicar.','articles','[]'::jsonb,'summary',later_summary));
 UPDATE public.jenios_assistant_turns_g43 SET articles='[]',context_summary='{"version":1,"topic":null,"articleIds":[],"planCodes":[],"corrections":[],"reportedStep":null}' WHERE id=tid;
 r:=public.jenios_assistant_repair_context_g44('inspect',a,cid,tid);
 PERFORM pg_temp.g44_assert(r->'latest'='false'::jsonb AND r#>'{priorSummary,planCodes}'='[]'::jsonb,'inspect excludes future conversation summary');
 payload:=jsonb_set(payload,'{revision}',r#>'{conversation,revision}');
 r:=public.jenios_assistant_repair_context_g44('apply',a,cid,tid,payload);
 PERFORM pg_temp.g44_assert(r->'summaryUpdated'='false'::jsonb AND r#>'{conversation,summary}'=later_summary
  AND (SELECT context_summary=summary_value AND articles=refs FROM public.jenios_assistant_turns_g43 WHERE id=tid),'older repair preserves newer summary');
 rev:=(r#>>'{conversation,revision}')::bigint;
 PERFORM public.jenios_assistant_conversation_g43('delete','user',a,jsonb_build_object('id',cid,'revision',rev));
 PERFORM pg_temp.g44_expect(a,cid,tid,payload,'CONVERSATION_NOT_FOUND');
 PERFORM pg_temp.g44_assert(ledger_before=(SELECT to_jsonb(x) FROM public.jenios_pro_requests_b143 x WHERE user_id=a AND request_key=tid::text),'delete and failed repair preserve ledger');
END $$;
SELECT 'G44_REPAIR_GRANTS_OWNER_LEDGER_CAS_ATOMIC_REPLAY_HISTORICAL_SUMMARY_PASS';
ROLLBACK;

