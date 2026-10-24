-- Real service-role calls; all fixtures roll back. No provider or hosted DB.
BEGIN;
CREATE FUNCTION pg_temp.g43_assert(p_ok boolean,p_message text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF p_ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'G43 assertion failed: %',p_message;END IF;END;$$;
CREATE FUNCTION pg_temp.g43_expect(p_action text,p_kind text,p_owner uuid,p_payload jsonb,p_error text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 BEGIN PERFORM public.jenios_assistant_conversation_g43(p_action,p_kind,p_owner,p_payload);
 EXCEPTION WHEN others THEN
  IF SQLERRM<>p_error THEN RAISE EXCEPTION 'Expected %, got %',p_error,SQLERRM;END IF;RETURN;
 END;
 RAISE EXCEPTION 'Expected %, operation succeeded',p_error;
END;$$;
INSERT INTO auth.users(id,email) VALUES
 ('43000000-0000-4000-8000-000000000001','g43-account-a@example.invalid'),
 ('43000000-0000-4000-8000-000000000002','g43-account-b@example.invalid');
DO $$ DECLARE n text;r text;BEGIN
 FOREACH n IN ARRAY ARRAY['jenios_assistant_conversations_g43','jenios_assistant_turns_g43','jenios_assistant_feedback_g43'] LOOP
  PERFORM pg_temp.g43_assert((SELECT relrowsecurity FROM pg_class WHERE oid=('public.'||n)::regclass),'RLS enabled for '||n);
  FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
   PERFORM pg_temp.g43_assert(NOT has_table_privilege(r,'public.'||n,'SELECT,INSERT,UPDATE,DELETE'),'no browser access to '||n);
  END LOOP;
 END LOOP;
 FOREACH n IN ARRAY ARRAY['public.jenios_assistant_conversation_g43(text,text,uuid,jsonb)',
  'public.jenios_assistant_review_g43(integer,integer)','public.jenios_assistant_cleanup_g43(integer)'] LOOP
  FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
   PERFORM pg_temp.g43_assert(NOT has_function_privilege(r,n,'EXECUTE'),'no browser RPC execute: '||n);
  END LOOP;
  PERFORM pg_temp.g43_assert(has_function_privilege('service_role',n,'EXECUTE'),'backend RPC execute: '||n);
 END LOOP;
END $$;
SET LOCAL ROLE anon;
DO $$ BEGIN
 BEGIN PERFORM 1 FROM public.jenios_assistant_conversations_g43;RAISE EXCEPTION 'anon read unexpectedly succeeded';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN PERFORM public.jenios_assistant_conversation_g43('list','user','43000000-0000-4000-8000-000000000001','{"channel":"support"}');RAISE EXCEPTION 'anon RPC unexpectedly succeeded';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END $$;
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN PERFORM 1 FROM public.jenios_assistant_turns_g43;RAISE EXCEPTION 'authenticated read unexpectedly succeeded';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN PERFORM public.jenios_assistant_review_g43();RAISE EXCEPTION 'authenticated review unexpectedly succeeded';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END $$;
SET LOCAL ROLE service_role;
DO $$
DECLARE a uuid:='43000000-0000-4000-8000-000000000001';b uuid:='43000000-0000-4000-8000-000000000002';
 v uuid:='43000000-0000-4000-8000-000000000003';w uuid:='43000000-0000-4000-8000-000000000004';
 c jsonb;d jsonb;g jsonb;r jsonb;claim jsonb;done jsonb;feedback jsonb;review jsonb;summary jsonb;context jsonb;
 cid uuid;gid uuid;tid uuid:=gen_random_uuid();tid2 uuid:=gen_random_uuid();tid3 uuid:=gen_random_uuid();lease uuid;i integer;
BEGIN
 c:=public.jenios_assistant_conversation_g43('create','user',a,'{"channel":"support","persona":"genio","remember":true}')->'conversation';
 cid:=(c->>'id')::uuid;
 PERFORM pg_temp.g43_assert(cid IS NOT NULL AND c->'revision'='0'::jsonb AND c->'turns'='[]'::jsonb,'create returns current snapshot');
 PERFORM pg_temp.g43_assert((c->>'expiresAt')::timestamptz-(c->>'createdAt')::timestamptz=interval '30 days','authenticated opt-in retains 30 days');
 d:=public.jenios_assistant_conversation_g43('create','user',b,'{"channel":"support","persona":"genia","remember":false}')->'conversation';
 PERFORM pg_temp.g43_assert((d->>'expiresAt')::timestamptz-(d->>'createdAt')::timestamptz=interval '24 hours','nonremembered account expires in 24h');
 g:=public.jenios_assistant_conversation_g43('create','visitor',v,'{"channel":"support","persona":"genia","remember":false}')->'conversation';gid:=(g->>'id')::uuid;
 PERFORM pg_temp.g43_assert((g->>'expiresAt')::timestamptz-(g->>'createdAt')::timestamptz=interval '24 hours','visitor expires in 24h');
 PERFORM pg_temp.g43_expect('read','user',b,jsonb_build_object('id',cid),'CONVERSATION_NOT_FOUND');
 PERFORM pg_temp.g43_expect('read','visitor',w,jsonb_build_object('id',gid),'CONVERSATION_NOT_FOUND');
 PERFORM pg_temp.g43_expect('read','visitor',a,jsonb_build_object('id',cid),'CONVERSATION_NOT_FOUND');
 PERFORM pg_temp.g43_expect('read','user',a,jsonb_build_object('id',cid,'channel','pro'),'CONVERSATION_NOT_FOUND');
 PERFORM pg_temp.g43_expect('create','visitor',v,'{"channel":"pro","persona":"genio","remember":false}','CONVERSATION_AUTH_REQUIRED');
 PERFORM pg_temp.g43_expect('create','visitor',v,'{"channel":"support","persona":"genio","remember":true}','CONVERSATION_INVALID');
 PERFORM pg_temp.g43_expect('create','user',a,'{"channel":"support","persona":"genio","remember":true,"ownerId":"forged"}','CONVERSATION_INVALID');
 PERFORM pg_temp.g43_assert(jsonb_array_length(public.jenios_assistant_conversation_g43('list','user',a,'{"channel":"support"}')->'conversations')=1,'A list excludes B and visitors');
 PERFORM pg_temp.g43_assert(jsonb_array_length(public.jenios_assistant_conversation_g43('list','visitor',w,'{"channel":"support"}')->'conversations')=0,'other visitor has no history');

 claim:=public.jenios_assistant_conversation_g43('claim','user',a,jsonb_build_object('id',cid,'turnId',tid,'revision',0,'question','Qual plano inclui o Pro?'));
 lease:=(claim->>'leaseToken')::uuid;
 PERFORM pg_temp.g43_assert(claim->>'state'='claimed' AND lease IS NOT NULL AND claim#>>'{conversation,revision}'='1','first claim increments revision once');
 PERFORM pg_temp.g43_assert(jsonb_array_length(claim#>'{conversation,turns}')=1 AND NOT ((claim->'conversation')::text ~ 'leaseToken|lease_token|user_id|visitor_id|request_fingerprint'),'snapshot includes pending turn but no internal secrets/owner');
 r:=public.jenios_assistant_conversation_g43('claim','user',a,jsonb_build_object('id',cid,'turnId',tid,'revision',0,'question','Qual plano inclui o Pro?'));
 PERFORM pg_temp.g43_assert(r->>'state'='pending' AND r->'replayed'='true'::jsonb AND NOT(r ? 'leaseToken'),'pending replay never reacquires lease');
 PERFORM pg_temp.g43_expect('claim','user',a,jsonb_build_object('id',cid,'turnId',tid2,'revision',0,'question','E o outro?'),'CONVERSATION_REVISION_CONFLICT');
 PERFORM pg_temp.g43_expect('claim','user',a,jsonb_build_object('id',cid,'turnId',tid2,'revision',1,'question','E o outro?'),'CONVERSATION_TURN_BUSY');
 PERFORM pg_temp.g43_expect('claim','user',a,jsonb_build_object('id',cid,'turnId',tid,'revision',1,'question','Outra pergunta com mesmo identificador'),'CONVERSATION_TURN_CONFLICT');
 PERFORM pg_temp.g43_expect('persona','user',a,jsonb_build_object('id',cid,'revision',1,'persona','genia'),'CONVERSATION_TURN_BUSY');
 PERFORM pg_temp.g43_expect('complete','user',b,jsonb_build_object('id',cid,'turnId',tid),'CONVERSATION_NOT_FOUND');
 PERFORM pg_temp.g43_expect('complete','user',a,jsonb_build_object('id',cid,'turnId',tid,'leaseToken',gen_random_uuid()),'CONVERSATION_LEASE_INVALID');
 summary:=jsonb_build_object('version',1,'topic','plans','articleIds',jsonb_build_array('plans'),'planCodes',jsonb_build_array('platform-global-crypto'),
  'corrections',jsonb_build_array(jsonb_build_object('text','Prefiro o plano de cripto.','origin','user','verified',false,'createdAt',now())), 'reportedStep',NULL);
 context:=jsonb_build_object('origin','server','verified',true,'tool','market','observedAt',now(),'sourceAt',now()-interval '1 hour',
  'facts',jsonb_build_array(jsonb_build_object('label','Série','value','Resultado histórico de teste.')));
 r:=jsonb_build_object('id',cid,'turnId',tid,'leaseToken',lease,'answer','Os dois planos superiores incluem acesso ao Pro.','articles',
  jsonb_build_array(jsonb_build_object('id','plans','title','Planos atuais','href','/planos')),'summary',summary,'toolContext',context);
 PERFORM pg_temp.g43_expect('complete','user',a,jsonb_set(r,'{summary,corrections,0,verified}','true'),'CONVERSATION_INVALID');
 PERFORM pg_temp.g43_expect('complete','user',a,jsonb_set(r,'{toolContext,origin}','"user"'),'CONVERSATION_INVALID');
 PERFORM pg_temp.g43_expect('complete','user',a,jsonb_set(r,'{answer}','"senha=fixture-secret-never-real"'),'CONVERSATION_SENSITIVE_INPUT');
 done:=public.jenios_assistant_conversation_g43('complete','user',a,r);
 PERFORM pg_temp.g43_assert(done->>'state'='completed' AND done#>>'{conversation,revision}'='2','completion advances once');
 PERFORM pg_temp.g43_assert(done#>'{conversation,summary}'=summary AND done#>'{conversation,toolContext}'=context,'summary and dated tools persist separately');
 PERFORM pg_temp.g43_assert(done#>>'{conversation,turns,0,answer}'=r->>'answer','completed snapshot sees current answer');
 d:=public.jenios_assistant_conversation_g43('persona','user',a,jsonb_build_object('id',cid,'revision',2,'persona','genia'));
 PERFORM pg_temp.g43_assert(d#>>'{conversation,revision}'='3' AND d#>>'{conversation,turns,0,persona}'='genio','persona choice preserves past persona');
 done:=public.jenios_assistant_conversation_g43('complete','user',a,jsonb_set(r,'{answer}','"Replay must not overwrite this answer."'));
 PERFORM pg_temp.g43_assert(done->'replayed'='true'::jsonb AND done#>>'{conversation,revision}'='3' AND done#>>'{conversation,turns,0,answer}'=r->>'answer','completion replay after revision advances does not overwrite');
 done:=public.jenios_assistant_conversation_g43('claim','user',a,jsonb_build_object('id',cid,'turnId',tid,'revision',0,'question','Qual plano inclui o Pro?'));
 PERFORM pg_temp.g43_assert(done->>'state'='completed' AND NOT(done ? 'leaseToken') AND done#>>'{turn,answer}'=r->>'answer','completed replay returns stored answer without another claim');
 PERFORM pg_temp.g43_expect('claim','visitor',v,jsonb_build_object('id',gid,'turnId',tid,'revision',0,'question','Mesmo UUID de outra conta'),'CONVERSATION_TURN_CONFLICT');

 feedback:=jsonb_build_object('id',cid,'turnId',tid,'rating','needs_review','note','Dúvida no passo. Contato teste@example.invalid, CPF 123.456.789-01.', 'allowReview',false);
 PERFORM public.jenios_assistant_conversation_g43('feedback','user',a,feedback);
 PERFORM pg_temp.g43_assert(public.jenios_assistant_review_g43()->>'totalConsent'='0','unshared feedback is absent from admin review');
 PERFORM public.jenios_assistant_conversation_g43('feedback','user',a,jsonb_set(feedback,'{allowReview}','true'));
 review:=public.jenios_assistant_review_g43();
 PERFORM pg_temp.g43_assert(review->>'totalConsent'='1' AND review#>>'{topics,0,topic}'='plans' AND review#>>'{articles,0,articleId}'='plans','review aggregates by topic and article');
 PERFORM pg_temp.g43_assert(review->'autoPublished'='false'::jsonb AND NOT(review::text ~ 'teste@example|123.456|user_id|ownerId|question|Qual plano|Os dois planos'),'review excludes identifiers, ownership and transcripts');
 PERFORM pg_temp.g43_expect('delete','user',b,jsonb_build_object('id',cid,'revision',3),'CONVERSATION_NOT_FOUND');
 PERFORM pg_temp.g43_expect('delete','user',a,jsonb_build_object('id',cid,'revision',2),'CONVERSATION_REVISION_CONFLICT');
 PERFORM public.jenios_assistant_conversation_g43('delete','user',a,jsonb_build_object('id',cid,'revision',3));
 PERFORM pg_temp.g43_assert(NOT EXISTS(SELECT 1 FROM public.jenios_assistant_turns_g43 WHERE conversation_id=cid)
  AND NOT EXISTS(SELECT 1 FROM public.jenios_assistant_feedback_g43 WHERE conversation_id=cid),'delete removes text, turns and feedback');
 PERFORM pg_temp.g43_expect('read','user',a,jsonb_build_object('id',cid),'CONVERSATION_NOT_FOUND');
 PERFORM pg_temp.g43_assert(public.jenios_assistant_review_g43()->>'totalConsent'='0','deleted feedback no longer included in review');

 -- A lost lease is uncertain and can never authorize an automatic second run.
 claim:=public.jenios_assistant_conversation_g43('claim','visitor',v,jsonb_build_object('id',gid,'turnId',tid2,'revision',0,'question','Como começar?'));lease:=(claim->>'leaseToken')::uuid;
 UPDATE public.jenios_assistant_turns_g43 SET lease_until=now()-interval '1 second' WHERE id=tid2;
 r:=public.jenios_assistant_conversation_g43('claim','visitor',v,jsonb_build_object('id',gid,'turnId',tid2,'revision',0,'question','Como começar?'));
 PERFORM pg_temp.g43_assert(r->>'state'='uncertain' AND NOT(r ? 'leaseToken') AND r#>>'{conversation,revision}'='2','expired lease becomes uncertain without reacquisition');
 PERFORM pg_temp.g43_expect('complete','visitor',v,jsonb_build_object('id',gid,'turnId',tid2,'leaseToken',lease),'CONVERSATION_LEASE_INVALID');
 r:=public.jenios_assistant_conversation_g43('fail','visitor',v,jsonb_build_object('id',gid,'turnId',tid2,'leaseToken',lease,'code','TEST_NO_RETRY','uncertain',false));
 PERFORM pg_temp.g43_assert(r->>'state'='uncertain' AND r#>>'{conversation,revision}'='2','fail preserves existing uncertain state');
 UPDATE public.jenios_assistant_conversations_g43 SET created_at=now()-interval '2 days',expires_at=now()-interval '1 day' WHERE id=gid;
 PERFORM pg_temp.g43_expect('read','visitor',v,jsonb_build_object('id',gid),'CONVERSATION_NOT_FOUND');
 PERFORM pg_temp.g43_assert(jsonb_array_length(public.jenios_assistant_conversation_g43('list','visitor',v,'{"channel":"support"}')->'conversations')=0,'expired text inaccessible before cleanup');
 i:=public.jenios_assistant_cleanup_g43(1);
 PERFORM pg_temp.g43_assert(i=1 AND NOT EXISTS(SELECT 1 FROM public.jenios_assistant_turns_g43 WHERE conversation_id=gid),'cleanup cascades expired conversation text');

 -- Tool inputs stay out of the transcript. A server-only digest still binds
 -- two identical human descriptions to their distinct validated inputs.
 c:=public.jenios_assistant_conversation_g43('create','user',a,'{"channel":"support","persona":"genio","remember":false}')->'conversation';cid:=(c->>'id')::uuid;
 PERFORM pg_temp.g43_expect('claim','user',a,jsonb_build_object('id',cid,'turnId',tid3,'revision',0,'question','Consulta crypto_basic: transação Ethereum.','requestFingerprint','invalid'),'CONVERSATION_INVALID');
 claim:=public.jenios_assistant_conversation_g43('claim','user',a,jsonb_build_object('id',cid,'turnId',tid3,'revision',0,'question','Consulta crypto_basic: transação Ethereum.','requestFingerprint',repeat('c',64)));
 PERFORM pg_temp.g43_assert(claim->>'state'='claimed' AND (claim->'conversation')::text NOT LIKE '%'||repeat('c',64)||'%' AND (claim->'conversation')::text NOT LIKE '%requestFingerprint%','support digest is accepted but never exposed');
 r:=public.jenios_assistant_conversation_g43('claim','user',a,jsonb_build_object('id',cid,'turnId',tid3,'revision',0,'question','Consulta crypto_basic: transação Ethereum.','requestFingerprint',repeat('c',64)));
 PERFORM pg_temp.g43_assert(r->>'state'='pending' AND NOT(r ? 'leaseToken'),'same tool fingerprint replays without lease');
 PERFORM pg_temp.g43_expect('claim','user',a,jsonb_build_object('id',cid,'turnId',tid3,'revision',0,'question','Consulta crypto_basic: transação Ethereum.','requestFingerprint',repeat('d',64)),'CONVERSATION_TURN_CONFLICT');

 -- Migration/API can work before the optional Pro ledger exists.
 c:=public.jenios_assistant_conversation_g43('create','user',a,'{"channel":"pro","persona":"genio","remember":false}')->'conversation';cid:=(c->>'id')::uuid;
 PERFORM pg_temp.g43_expect('claim','user',a,jsonb_build_object('id',cid,'turnId',tid,'revision',0,'question','Analise a fonte.'),'CONVERSATION_INVALID');
 claim:=public.jenios_assistant_conversation_g43('claim','user',a,jsonb_build_object('id',cid,'turnId',tid,'revision',0,'question','Analise a fonte.','requestFingerprint',repeat('a',64)));
 r:=public.jenios_assistant_conversation_g43('repair_pro','user',a,jsonb_build_object('id',cid,'turnId',tid));
 PERFORM pg_temp.g43_assert(r->'repaired'='false'::jsonb AND r->>'state'='pending','missing optional ledger never invents answer');

 -- Bound total active conversations; independent owner cap does not affect A.
 FOR i IN 2..20 LOOP PERFORM public.jenios_assistant_conversation_g43('create','user',b,'{"channel":"support","persona":"genio","remember":false}');END LOOP;
 PERFORM pg_temp.g43_expect('create','user',b,'{"channel":"support","persona":"genio","remember":false}','CONVERSATION_LIMIT');
 PERFORM pg_temp.g43_assert(jsonb_array_length(public.jenios_assistant_conversation_g43('list','user',b,'{"channel":"support"}')->'conversations')=20,'bounded owner list');
END $$;
SELECT 'G43_MEMORY_SERVICE_GRANTS_OWNER_ISOLATION_CAS_REPLAY_FEEDBACK_RETENTION_PASS';
ROLLBACK;

