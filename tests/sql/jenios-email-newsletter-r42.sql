-- Disposable loopback database only; the runner enforces this boundary.
BEGIN;
INSERT INTO auth.users(id,email,is_anonymous,raw_app_meta_data)
VALUES('42000000-0000-4000-8000-000000000001','newsletter-admin-r42@example.invalid',false,'{"role":"master"}');
DO $$ BEGIN
 IF has_function_privilege('anon','public.jenios_manage_newsletter_r42(uuid,text,uuid,integer,jsonb)','EXECUTE')
 OR has_function_privilege('authenticated','public.jenios_manage_newsletter_r42(uuid,text,uuid,integer,jsonb)','EXECUTE')
 THEN RAISE EXCEPTION 'NEWSLETTER_PUBLIC_RPC_EXPOSED'; END IF;
END $$;
SET LOCAL ROLE service_role;
DO $$
DECLARE actor uuid:='42000000-0000-4000-8000-000000000001'; edition jsonb; saved jsonb; failed boolean;
 payload jsonb:=jsonb_build_object('edition_key','radar-test-r42','subject','JENIOS | Radar de Mercado',
  'items',jsonb_build_array(jsonb_build_object('title','Título local','summary','Resumo local isolado.','sourceName','Fonte','sourceUrl','https://example.com')),
  'scheduled_at',now()+interval '1 day');
BEGIN
 edition:=public.jenios_manage_newsletter_r42(actor,'create',null,null,payload);
 IF edition->>'status'<>'draft' OR (edition->>'revision')::integer<>0 THEN RAISE EXCEPTION 'NEWSLETTER_NOT_DRAFT'; END IF;
 saved:=public.jenios_manage_newsletter_r42(actor,'save',(edition->>'id')::uuid,0,payload);
 IF (saved->>'revision')::integer<>1 THEN RAISE EXCEPTION 'NEWSLETTER_REVISION_NOT_INCREMENTED'; END IF;
 failed:=false;
 BEGIN PERFORM public.jenios_manage_newsletter_r42(actor,'approve',(edition->>'id')::uuid,0,'{}');
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM<>'NEWSLETTER_R42_CONFLICT' THEN RAISE; END IF; failed:=true;
 END;
 IF NOT failed THEN RAISE EXCEPTION 'NEWSLETTER_STALE_APPROVAL_ACCEPTED'; END IF;
 saved:=public.jenios_manage_newsletter_r42(actor,'approve',(edition->>'id')::uuid,1,'{}');
 IF saved->>'status'<>'approved' OR (saved->>'revision')::integer<>2 THEN RAISE EXCEPTION 'NEWSLETTER_NOT_APPROVED'; END IF;
 failed:=false;
 BEGIN PERFORM public.jenios_manage_newsletter_r42(actor,'save',(edition->>'id')::uuid,2,payload);
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM<>'NEWSLETTER_R42_CONFLICT' THEN RAISE; END IF; failed:=true;
 END;
 IF NOT failed THEN RAISE EXCEPTION 'NEWSLETTER_APPROVED_CONTENT_MUTABLE'; END IF;
 saved:=public.jenios_manage_newsletter_r42(actor,'retire',(edition->>'id')::uuid,2,'{}');
 IF saved->>'status'<>'retired' OR (saved->>'revision')::integer<>3 THEN RAISE EXCEPTION 'NEWSLETTER_NOT_RETIRED'; END IF;
 IF (SELECT count(*) FROM public.jenios_admin_audit WHERE actor_id=actor)<>4 THEN RAISE EXCEPTION 'NEWSLETTER_AUDIT_INCORRECT'; END IF;
END $$;
RESET ROLE;
REVOKE INSERT ON public.jenios_admin_audit FROM service_role;
SET LOCAL ROLE service_role;
DO $$ DECLARE failed boolean:=false; BEGIN
 BEGIN
  PERFORM public.jenios_manage_newsletter_r42('42000000-0000-4000-8000-000000000001','create',null,null,
   jsonb_build_object('edition_key','radar-audit-failure-r42','subject','JENIOS | Radar de Mercado',
   'items','[{"title":"Teste","summary":"Teste local isolado","sourceName":"Fonte","sourceUrl":"https://example.com"}]'::jsonb,
   'scheduled_at',now()+interval '1 day'));
 EXCEPTION WHEN insufficient_privilege THEN failed:=true; END;
 IF NOT failed OR EXISTS(SELECT 1 FROM public.jenios_newsletter_editions_b305 WHERE edition_key='radar-audit-failure-r42')
 THEN RAISE EXCEPTION 'NEWSLETTER_NOT_ATOMIC_WITH_AUDIT'; END IF;
END $$;
RESET ROLE;
ROLLBACK;
SELECT 'R42_NEWSLETTER_POSTGRES_PASS' AS result;
