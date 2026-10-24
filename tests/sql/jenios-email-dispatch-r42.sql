-- LOCAL/CI ONLY: synthetic records remain in this transaction and are rolled back.
-- No network request, user invitation, bank confirmation or provider receipt occurs.
BEGIN;
CREATE FUNCTION pg_temp.r42_assert(ok boolean,code text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'R42_ASSERT: %',code; END IF; END $$;
INSERT INTO auth.users(id,email)
 SELECT ('42000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'local-'||n||'@example.invalid'
 FROM generate_series(1,30) n;
INSERT INTO public.jenios_pay_products(id,code,name,category,price_cents,billing_type,active) VALUES
 ('42000000-0000-4000-8000-000000001001','r42-monthly','Local monthly','platform',990,'monthly',true),
 ('42000000-0000-4000-8000-000000001002','r42-other','Local other','other',990,'one_time',true);

SELECT pg_temp.r42_assert((SELECT bool_and(NOT p.prosecdef AND p.proconfig @> ARRAY['search_path=""'])
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname LIKE '%_r42'),'RPC_INVOKER_SEARCH_PATH');
SELECT pg_temp.r42_assert(NOT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname LIKE '%_r42' AND
 (has_function_privilege('anon',p.oid,'EXECUTE') OR has_function_privilege('authenticated',p.oid,'EXECUTE'))),'RPC_CLIENT_ACL');
SELECT pg_temp.r42_assert((SELECT relrowsecurity FROM pg_class WHERE oid='public.jenios_email_budget_reservations_r42'::regclass),'RESERVATION_RLS');
SELECT pg_temp.r42_assert(NOT has_table_privilege('service_role','public.jenios_email_budget_reservations_r42','UPDATE,DELETE,TRUNCATE')
 AND NOT has_table_privilege('authenticated','public.jenios_email_budget_reservations_r42','SELECT,INSERT'),'RESERVATION_IMMUTABLE_PRIVATE');
SET LOCAL ROLE anon;
DO $$ DECLARE denied boolean:=false; BEGIN
 BEGIN PERFORM public.jenios_email_dispatch_health_r42(); EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'ANON_HEALTH_ALLOWED'; END IF;
END $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
DO $$ DECLARE denied boolean:=false; BEGIN
 BEGIN PERFORM * FROM public.jenios_claim_transactional_email_r42(1,now()-interval '1 hour',24);
 EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'CLIENT_CLAIM_ALLOWED'; END IF;
END $$;
RESET ROLE;
SELECT 'R42_PRIVATE_ACL_PASS';

SET LOCAL ROLE service_role;
DO $$ DECLARE denied boolean; bad record; BEGIN
 FOR bad IN SELECT * FROM (VALUES(NULL::timestamptz,24),(now()+interval '1 hour',24),(now()-interval '1 hour',0),(now()-interval '1 hour',169)) AS v(start_at,age) LOOP
  denied:=false;
  BEGIN PERFORM public.jenios_email_window_floor_r42(bad.start_at,bad.age,clock_timestamp());
  EXCEPTION WHEN invalid_parameter_value THEN denied:=true; END;
  IF NOT denied THEN RAISE EXCEPTION 'INVALID_WINDOW_ALLOWED'; END IF;
 END LOOP;
 denied:=false;
 BEGIN PERFORM * FROM public.jenios_claim_transactional_email_r42(3,now()-interval '1 hour',24);
 EXCEPTION WHEN invalid_parameter_value THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'OVERSIZED_BATCH_ALLOWED'; END IF;
END $$;
RESET ROLE;
SELECT 'R42_ACTIVATION_VALIDATION_PASS';

INSERT INTO public.jenios_transactional_email_outbox_b305(id,user_id,event_kind,reference_key,created_at,status,first_attempt_at,attempts)
 SELECT ('42000000-0000-4000-8000-00000000200'||n)::uuid,'42000000-0000-4000-8000-000000000001',
 'social_welcome','window-'||n,CASE n WHEN 2 THEN now()-interval '2 hours' WHEN 3 THEN now()+interval '1 hour' ELSE now()-interval '1 minute' END,
 CASE n WHEN 4 THEN 'uncertain' WHEN 5 THEN 'retry' ELSE 'pending' END,
 CASE WHEN n=5 THEN now()-interval '24 hours' END,CASE WHEN n=5 THEN 1 ELSE 0 END
 FROM generate_series(1,5) n;
SET LOCAL ROLE service_role;
SELECT pg_temp.r42_assert((SELECT count(*)=1 FROM public.jenios_claim_transactional_email_r42(2,now()-interval '1 hour',24)),'TRANSACTIONAL_EVENT_CUTOFF');
SELECT pg_temp.r42_assert((SELECT status='uncertain' FROM public.jenios_transactional_email_outbox_b305 WHERE reference_key='window-5'),'OLD_ATTEMPT_QUARANTINED');
SELECT pg_temp.r42_assert((SELECT bool_and(status='pending') FROM public.jenios_transactional_email_outbox_b305 WHERE reference_key IN ('window-2','window-3')),'BACKLOG_FUTURE_UNTOUCHED');
SELECT pg_temp.r42_assert(NOT public.jenios_defer_email_r42('transactional','42000000-0000-4000-8000-000000002001',gen_random_uuid(),'DAILY_LIMIT',now()+interval '1 day'),'WRONG_DEFER_LEASE');
SELECT pg_temp.r42_assert(public.jenios_defer_email_r42('transactional',id,lease_token,'DAILY_LIMIT',now()+interval '1 day'),'PRETRANSPORT_DEFER')
 FROM public.jenios_transactional_email_outbox_b305 WHERE reference_key='window-1';
SELECT pg_temp.r42_assert((SELECT status='pending' AND attempts=0 AND first_attempt_at IS NULL AND lease_token IS NULL
 FROM public.jenios_transactional_email_outbox_b305 WHERE reference_key='window-1'),'DEFER_DOES_NOT_BURN_WINDOW');
RESET ROLE;
SELECT 'R42_CLAIM_AND_NO_TRANSPORT_DEFER_PASS';

INSERT INTO public.jenios_pay_orders(id,user_id,product_id,amount_cents,status,provider)
 SELECT ('42000000-0000-4000-8000-00000000300'||n)::uuid,'42000000-0000-4000-8000-000000000001',
 '42000000-0000-4000-8000-000000001001',990,'paid','inter_pix' FROM generate_series(1,3) n;
INSERT INTO public.jenios_pay_payments(id,order_id,provider,payment_method,amount_cents,status,confirmed_at,bank_end_to_end_id)
 SELECT ('42000000-0000-4000-8000-00000000310'||n)::uuid,('42000000-0000-4000-8000-00000000300'||n)::uuid,
 'inter_pix','pix',990,'confirmed',now()-interval '1 minute','E'||repeat(n::text,31) FROM generate_series(1,3) n;
INSERT INTO public.jenios_pay_email_outbox_b305(id,order_id,payment_id,recipient_user_id,bank_receipt_id,amount_cents,paid_at,recipient_name,product_name)
 SELECT ('42000000-0000-4000-8000-00000000320'||n)::uuid,('42000000-0000-4000-8000-00000000300'||n)::uuid,
 ('42000000-0000-4000-8000-00000000310'||n)::uuid,'42000000-0000-4000-8000-000000000001','E'||repeat(n::text,31),990,
 CASE n WHEN 2 THEN now()-interval '2 days' WHEN 3 THEN now()+interval '1 hour' ELSE now()-interval '1 minute' END,
 'Local fixture','Local product' FROM generate_series(1,3) n;
SET LOCAL ROLE service_role;
SELECT pg_temp.r42_assert((SELECT count(*)=1 FROM public.jenios_claim_pay_email_r42(2,now()-interval '1 day',24)),'FINANCE_USES_PAID_AT');
SELECT pg_temp.r42_assert((SELECT allowed AND reason='RESERVED' FROM public.jenios_reserve_email_budget_r42('finance',
 '42000000-0000-4000-8000-000000003201',(SELECT lease_token FROM public.jenios_pay_email_outbox_b305 WHERE id='42000000-0000-4000-8000-000000003201'),repeat('f',64))),'FINANCE_SHARED_RESERVATION');
RESET ROLE;
TRUNCATE public.jenios_email_budget_usage_r42,public.jenios_email_budget_reservations_r42;
SELECT 'R42_FINANCE_PAID_EVENT_PASS';

-- The old order is paid, but confirmed_at precedes the upcoming renewal.
INSERT INTO public.jenios_pay_orders(id,user_id,product_id,amount_cents,status,updated_at)
 SELECT ('42000000-0000-4000-8000-00000000400'||n)::uuid,('42000000-0000-4000-8000-'||lpad((n+1)::text,12,'0'))::uuid,
 '42000000-0000-4000-8000-000000001001',990,'paid',now() FROM generate_series(1,5) n;
INSERT INTO public.jenios_pay_payments(order_id,payment_method,amount_cents,status,confirmed_at)
 SELECT ('42000000-0000-4000-8000-00000000400'||n)::uuid,'pix',990,'confirmed',
 CASE n WHEN 3 THEN now()-interval '1 day' ELSE now()-interval '30 days' END FROM generate_series(1,5) n;
INSERT INTO public.jenios_pay_subscriptions(id,user_id,product_id,latest_order_id,status,current_period_end)
 SELECT ('42000000-0000-4000-8000-00000000410'||n)::uuid,('42000000-0000-4000-8000-'||lpad((n+1)::text,12,'0'))::uuid,
 '42000000-0000-4000-8000-000000001001',('42000000-0000-4000-8000-00000000400'||n)::uuid,
 CASE WHEN n IN(4,5) THEN 'past_due' ELSE 'active' END,
 CASE n WHEN 1 THEN now()+interval '60 hours' WHEN 2 THEN now()+interval '33 days'
 WHEN 3 THEN now()-interval '36 hours' WHEN 4 THEN now()-interval '15 days' ELSE now()-interval '180 hours' END
 FROM generate_series(1,5) n;
INSERT INTO public.jenios_subscription_dunning_outbox_b305(subscription_id,user_id,product_id,event_kind,due_at)
 SELECT id,user_id,product_id,'due_soon_3d',now()+interval '3 days' FROM public.jenios_pay_subscriptions WHERE id='42000000-0000-4000-8000-000000004102';
INSERT INTO public.jenios_pay_entitlements(user_id,product_id,order_id,status)
 VALUES('42000000-0000-4000-8000-000000000006','42000000-0000-4000-8000-000000001001','42000000-0000-4000-8000-000000004005','active'),
 ('42000000-0000-4000-8000-000000000006','42000000-0000-4000-8000-000000001002','42000000-0000-4000-8000-000000003002','active');
SET LOCAL ROLE service_role;
SELECT pg_temp.r42_assert((SELECT cancelled=1 AND revoked=1 FROM public.jenios_process_subscription_dunning_r42(clock_timestamp(),now()-interval '1 day',24)),'ONLY_FRESH_D7_CANCELS');
SELECT pg_temp.r42_assert((SELECT status='pending' FROM public.jenios_subscription_dunning_outbox_b305 WHERE subscription_id='42000000-0000-4000-8000-000000004101' AND event_kind='due_soon_3d'),'OLD_PAYMENT_DOES_NOT_SUPERSEDE_D3');
SELECT pg_temp.r42_assert((SELECT status='superseded' FROM public.jenios_subscription_dunning_outbox_b305 WHERE subscription_id='42000000-0000-4000-8000-000000004102'),'RENEWED_CYCLE_SUPERSEDES_OLD_NOTICE');
SELECT pg_temp.r42_assert((SELECT status='active' FROM public.jenios_pay_subscriptions WHERE id='42000000-0000-4000-8000-000000004103'),'CURRENT_PAYMENT_PROTECTS_SUBSCRIPTION');
SELECT pg_temp.r42_assert((SELECT status='past_due' FROM public.jenios_pay_subscriptions WHERE id='42000000-0000-4000-8000-000000004104'),'OLD_D7_BACKLOG_NOT_CANCELLED');
SELECT pg_temp.r42_assert((SELECT status='active' FROM public.jenios_pay_entitlements WHERE product_id='42000000-0000-4000-8000-000000001002'),'UNRELATED_PRODUCT_NOT_REVOKED');
SELECT pg_temp.r42_assert((SELECT count(*)=2 FROM public.jenios_claim_dunning_email_r42(2,now()-interval '1 day',24)),'D3_AND_FRESH_CANCELLATION_CLAIM');
RESET ROLE;
SELECT 'R42_DUNNING_CYCLE_AND_CUTOFF_PASS';

INSERT INTO public.jenios_email_preferences_b305(user_id,marketing_opt_in)
 SELECT ('42000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,true FROM generate_series(10,15) n;
INSERT INTO public.jenios_newsletter_editions_b305(id,edition_key,subject,items,scheduled_at,status)
 SELECT ('42000000-0000-4000-8000-00000000500'||n)::uuid,'local-edition-'||n,'JENIOS | Radar de Mercado','[{"title":"Local test"}]',
 CASE WHEN n=3 THEN now()+interval '1 day' ELSE now()-interval '1 hour' END,'approved' FROM generate_series(1,3) n;
INSERT INTO public.jenios_marketing_email_ledger_b305(id,user_id,campaign_kind,campaign_key,step,newsletter_edition_id,due_at,next_attempt_at,status,sent_at,provider_email_id)
 SELECT ('42000000-0000-4000-8000-00000000510'||n)::uuid,'42000000-0000-4000-8000-000000000010','newsletter','local-edition-'||n,0,
 ('42000000-0000-4000-8000-00000000500'||n)::uuid,CASE WHEN n=3 THEN now()+interval '1 day' ELSE now()-interval '1 hour' END,
 now()-interval '1 minute',CASE WHEN n=1 THEN 'sent' ELSE 'planned' END,
 CASE WHEN n=1 THEN now()-interval '2 days' END,CASE WHEN n=1 THEN 'local-fixture-receipt' END FROM generate_series(1,3) n;
SET LOCAL ROLE service_role;
SELECT pg_temp.r42_assert((SELECT count(*)=0 FROM public.jenios_claim_marketing_email_r42(2,now()-interval '1 day',24)),'CADENCE_WITHHOLDS_CURRENT');
SELECT pg_temp.r42_assert((SELECT status='planned' AND attempts=0 AND first_attempt_at IS NULL
 AND last_error_code='CADENCE_DEFERRED' AND cadence_deferred_until_r42>now()+interval '3 days'
 FROM public.jenios_marketing_email_ledger_b305 WHERE id='42000000-0000-4000-8000-000000005102'),'CADENCE_DEFERS_WITHOUT_SUPPRESSING');
SELECT pg_temp.r42_assert((SELECT status='planned' AND last_error_code IS NULL AND cadence_deferred_until_r42 IS NULL
 FROM public.jenios_marketing_email_ledger_b305 WHERE id='42000000-0000-4000-8000-000000005103'),'FUTURE_STAGE_UNTOUCHED');
RESET ROLE;
-- Model the later clock through stored timestamps, without supplying a forged p_now.
UPDATE public.jenios_marketing_email_ledger_b305 SET sent_at=now()-interval '7 days' WHERE id='42000000-0000-4000-8000-000000005101';
UPDATE public.jenios_marketing_email_ledger_b305 SET due_at=now()-interval '5 days',next_attempt_at=now()-interval '1 minute',
 cadence_deferred_until_r42=now()-interval '1 minute' WHERE id='42000000-0000-4000-8000-000000005102';
INSERT INTO public.jenios_marketing_email_ledger_b305(user_id,campaign_kind,campaign_key,step,due_at,next_attempt_at,cadence_deferred_until_r42,first_attempt_at)
 VALUES('42000000-0000-4000-8000-000000000011','no_plan_nurture','preactivation',1,now()-interval '20 days',now(),now()-interval '1 minute',NULL),
 ('42000000-0000-4000-8000-000000000012','no_plan_nurture','prior-transport',1,now()-interval '5 days',now(),now()-interval '1 hour',now()-interval '2 hours');
SET LOCAL ROLE service_role;
SELECT pg_temp.r42_assert((SELECT count(*)=1 FROM public.jenios_claim_marketing_email_r42(2,now()-interval '10 days',24)),'VALID_DEFER_SURVIVES_AGE_WITHOUT_OPENING_BACKLOG');
SELECT pg_temp.r42_assert((SELECT status='processing' AND first_attempt_at>=cadence_deferred_until_r42
 FROM public.jenios_marketing_email_ledger_b305 WHERE id='42000000-0000-4000-8000-000000005102'),'DEFERRED_ROW_BOUND_TO_FIRST_ATTEMPT');
RESET ROLE;
SELECT 'R42_MARKETING_PERSISTENT_CADENCE_PASS';

-- All ambiguous provider outcomes retain the reservation and block later cadence.
INSERT INTO public.jenios_marketing_email_ledger_b305(id,user_id,campaign_kind,campaign_key,step,due_at,status,attempts,first_attempt_at,lease_token,lease_until)
 SELECT ('42000000-0000-4000-8000-00000000520'||n)::uuid,('42000000-0000-4000-8000-'||lpad((n+10)::text,12,'0'))::uuid,
 'no_plan_nurture','ambiguous-'||n,1,now()-interval '1 minute','processing',1,now(),
 ('42000000-0000-4000-8000-00000000530'||n)::uuid,now()+interval '2 minutes' FROM generate_series(1,5) n;
SET LOCAL ROLE service_role;
DO $$ DECLARE n integer:=0; code text; row_id uuid; lease uuid; released boolean; reserved boolean; BEGIN
 FOREACH code IN ARRAY ARRAY['RESEND_DELIVERY_UNCERTAIN','RESEND_ACK_UNREADABLE','RESEND_ACK_MISSING','MARKETING_DELIVERY_LEDGER_UNCONFIRMED','RESEND_IDEMPOTENCY_CONFLICT'] LOOP
  n:=n+1; row_id:=('42000000-0000-4000-8000-00000000520'||n)::uuid; lease:=('42000000-0000-4000-8000-00000000530'||n)::uuid;
  SELECT allowed INTO reserved FROM public.jenios_reserve_email_budget_r42('marketing',row_id,lease,repeat(n::text,64));
  IF NOT reserved THEN RAISE EXCEPTION 'AMBIGUOUS_FIXTURE_NOT_RESERVED'; END IF;
  released:=public.jenios_release_marketing_email_b305(row_id,lease,code,true);
  IF NOT released OR (SELECT status FROM public.jenios_marketing_email_ledger_b305 WHERE id=row_id)<>'uncertain'
  THEN RAISE EXCEPTION 'AMBIGUOUS_DELIVERY_NOT_QUARANTINED: %',code; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.jenios_email_budget_reservations_r42 WHERE channel='marketing' AND outbox_id=row_id)
  THEN RAISE EXCEPTION 'AMBIGUOUS_RESERVATION_RELEASED'; END IF;
 END LOOP;
END $$;
RESET ROLE;
INSERT INTO public.jenios_marketing_email_ledger_b305(user_id,campaign_kind,campaign_key,step,due_at,next_attempt_at)
 VALUES('42000000-0000-4000-8000-000000000015','no_plan_nurture','after-uncertain',2,now()-interval '1 minute',now());
SET LOCAL ROLE service_role;
SELECT pg_temp.r42_assert((SELECT count(*)=0 FROM public.jenios_claim_marketing_email_r42(2,now()-interval '1 day',24)),'UNCERTAIN_HOLDS_CADENCE');
SELECT pg_temp.r42_assert((SELECT status='planned' AND last_error_code='CADENCE_DEFERRED'
 FROM public.jenios_marketing_email_ledger_b305 WHERE campaign_key='after-uncertain'),'UNCERTAIN_DEFER_WITHOUT_RETRY');
RESET ROLE;
SELECT 'R42_AMBIGUOUS_DELIVERY_HOLD_PASS';

INSERT INTO public.jenios_email_preferences_b305(user_id,marketing_opt_in)
 VALUES('42000000-0000-4000-8000-000000000002',true),('42000000-0000-4000-8000-000000000017',true),
 ('42000000-0000-4000-8000-000000000018',true);
UPDATE public.jenios_email_preferences_b305 SET hard_bounce_at=now() WHERE user_id='42000000-0000-4000-8000-000000000013';
INSERT INTO public.jenios_pay_orders(id,user_id,product_id,amount_cents,status)
 VALUES('42000000-0000-4000-8000-000000005601','42000000-0000-4000-8000-000000000017','42000000-0000-4000-8000-000000001001',990,'cancelled');
INSERT INTO public.jenios_newsletter_editions_b305(id,edition_key,subject,items,scheduled_at,status)
 VALUES('42000000-0000-4000-8000-000000005602','eligibility-draft','JENIOS | Radar de Mercado','[{"title":"Local"}]',now()-interval '1 hour','draft');
INSERT INTO public.jenios_marketing_email_ledger_b305(user_id,campaign_kind,campaign_key,step,due_at,next_attempt_at,order_id,product_id,newsletter_edition_id)
 VALUES('42000000-0000-4000-8000-000000000016','no_plan_nurture','eligibility-no-consent',1,now()-interval '1 minute',now(),NULL,NULL,NULL),
 ('42000000-0000-4000-8000-000000000002','no_plan_nurture','eligibility-active-plan',1,now()-interval '1 minute',now(),NULL,NULL,NULL),
 ('42000000-0000-4000-8000-000000000017','cart_recovery','eligibility-closed-cart',1,now()-interval '1 minute',now(),'42000000-0000-4000-8000-000000005601','42000000-0000-4000-8000-000000001001',NULL),
 ('42000000-0000-4000-8000-000000000018','newsletter','eligibility-draft',0,now()-interval '1 minute',now(),NULL,NULL,'42000000-0000-4000-8000-000000005602'),
 ('42000000-0000-4000-8000-000000000013','no_plan_nurture','eligibility-hard-bounce',1,now()-interval '1 minute',now(),NULL,NULL,NULL),
 ('42000000-0000-4000-8000-000000000019','no_plan_nurture','eligibility-future-no-consent',1,now()+interval '1 hour',now(),NULL,NULL,NULL);
SET LOCAL ROLE service_role;
SELECT pg_temp.r42_assert((SELECT count(*)=0 FROM public.jenios_claim_marketing_email_r42(2,now()-interval '1 day',24)),'INELIGIBLE_MARKETING_NEVER_CLAIMED');
SELECT pg_temp.r42_assert((SELECT count(*)=5 FROM public.jenios_marketing_email_ledger_b305
 WHERE campaign_key LIKE 'eligibility-%' AND status='suppressed'),'CONSENT_PLAN_CART_APPROVAL_AND_BOUNCE_ENFORCED');
SELECT pg_temp.r42_assert((SELECT status='planned' AND last_error_code IS NULL FROM public.jenios_marketing_email_ledger_b305
 WHERE campaign_key='eligibility-future-no-consent'),'FUTURE_CONSENT_CHECK_DEFERRED_TO_DUE_DATE');
RESET ROLE;
SELECT 'R42_MARKETING_ELIGIBILITY_PASS';

TRUNCATE public.jenios_marketing_email_ledger_b305,public.jenios_newsletter_editions_b305;
DELETE FROM public.jenios_email_preferences_b305;
INSERT INTO public.jenios_email_preferences_b305(user_id,marketing_opt_in,created_at)
 VALUES('42000000-0000-4000-8000-000000000020',true,now()-interval '84 hours');
INSERT INTO public.jenios_pay_orders(id,user_id,product_id,amount_cents,status,created_at)
 VALUES('42000000-0000-4000-8000-000000006001','42000000-0000-4000-8000-000000000020','42000000-0000-4000-8000-000000001001',990,'awaiting_payment',now()-interval '3 hours'),
 ('42000000-0000-4000-8000-000000006002','42000000-0000-4000-8000-000000000020','42000000-0000-4000-8000-000000001001',990,'awaiting_payment',now()-interval '20 days');
INSERT INTO public.jenios_newsletter_editions_b305(edition_key,subject,items,scheduled_at,status)
 VALUES('planner-recent','JENIOS | Radar de Mercado','[{"title":"Local"}]',now()-interval '1 hour','approved'),
 ('planner-old','JENIOS | Radar de Mercado','[{"title":"Local"}]',now()-interval '2 days','approved'),
 ('planner-future','JENIOS | Radar de Mercado','[{"title":"Local"}]',now()+interval '1 day','approved');
SET LOCAL ROLE service_role;
SELECT pg_temp.r42_assert((SELECT planned=3 FROM public.jenios_plan_marketing_emails_r42(clock_timestamp(),now()-interval '1 day',24)),'PLANNER_ONLY_FRESH_STAGE_EVENTS');
SELECT pg_temp.r42_assert(NOT EXISTS(SELECT 1 FROM public.jenios_marketing_email_ledger_b305 WHERE due_at<now()-interval '1 day' OR due_at>now()),'NO_OLD_OR_FUTURE_PLANNER_BACKLOG');
SELECT pg_temp.r42_assert((SELECT planned=0 FROM public.jenios_plan_marketing_emails_r42(clock_timestamp(),now()-interval '1 day',24)),'PLANNER_IDEMPOTENT');
RESET ROLE;
SELECT 'R42_PLANNER_CUTOFF_PASS';

TRUNCATE public.jenios_transactional_email_outbox_b305,public.jenios_marketing_email_ledger_b305,public.jenios_email_budget_usage_r42,public.jenios_email_budget_reservations_r42;
INSERT INTO public.jenios_transactional_email_outbox_b305(id,user_id,event_kind,reference_key,status,attempts,first_attempt_at,lease_token,lease_until)
 SELECT ('42000000-0000-4000-8000-00000000700'||n)::uuid,'42000000-0000-4000-8000-000000000001',
 'social_welcome','quota-'||n,'processing',1,now()-interval '5 minutes',('42000000-0000-4000-8000-00000000710'||n)::uuid,now()+interval '2 minutes'
 FROM generate_series(1,4) n;
INSERT INTO public.jenios_marketing_email_ledger_b305(id,user_id,campaign_kind,campaign_key,step,due_at,status,attempts,first_attempt_at,lease_token,lease_until)
 SELECT ('42000000-0000-4000-8000-00000000720'||n)::uuid,'42000000-0000-4000-8000-000000000020',
 'no_plan_nurture','quota-'||n,1,now(),'processing',1,now(),('42000000-0000-4000-8000-00000000730'||n)::uuid,now()+interval '2 minutes'
 FROM generate_series(1,2) n;
SET LOCAL ROLE service_role;
SELECT pg_temp.r42_assert((SELECT reason='INVALID_LIMITS' AND NOT allowed FROM public.jenios_reserve_email_budget_r42('transactional','42000000-0000-4000-8000-000000007001','42000000-0000-4000-8000-000000007101',repeat('a',64),3,10,3,2)),'LIMITS_KEEP_ESSENTIAL_HEADROOM');
SELECT pg_temp.r42_assert((SELECT reason='LEASE_INVALID' AND NOT allowed FROM public.jenios_reserve_email_budget_r42('transactional','42000000-0000-4000-8000-000000007001',gen_random_uuid(),repeat('a',64))),'BUDGET_CURRENT_LEASE_REQUIRED');
SELECT pg_temp.r42_assert((SELECT allowed AND reason='RESERVED' AND NOT reused FROM public.jenios_reserve_email_budget_r42('transactional','42000000-0000-4000-8000-000000007001','42000000-0000-4000-8000-000000007101',repeat('a',64),3,10,1,2)),'FIRST_RESERVATION');
SELECT pg_temp.r42_assert((SELECT allowed AND reason='REUSED' AND reused FROM public.jenios_reserve_email_budget_r42('transactional','42000000-0000-4000-8000-000000007001','42000000-0000-4000-8000-000000007101',repeat('a',64),3,10,1,2)),'SAME_KEY_REUSES');
SELECT pg_temp.r42_assert((SELECT reason='KEY_CONFLICT' FROM public.jenios_reserve_email_budget_r42('transactional','42000000-0000-4000-8000-000000007002','42000000-0000-4000-8000-000000007102',repeat('a',64),3,10,1,2)),'KEY_BOUND_TO_MESSAGE');
SELECT pg_temp.r42_assert((SELECT reason='KEY_CONFLICT' FROM public.jenios_reserve_email_budget_r42('transactional','42000000-0000-4000-8000-000000007001','42000000-0000-4000-8000-000000007101',repeat('b',64),3,10,1,2)),'MESSAGE_BOUND_TO_KEY');
SELECT pg_temp.r42_assert((SELECT allowed FROM public.jenios_reserve_email_budget_r42('marketing','42000000-0000-4000-8000-000000007201','42000000-0000-4000-8000-000000007301',repeat('c',64),3,10,1,2)),'MARKETING_BOUNDED_SHARE');
SELECT pg_temp.r42_assert((SELECT reason='MARKETING_DAILY_LIMIT' FROM public.jenios_reserve_email_budget_r42('marketing','42000000-0000-4000-8000-000000007202','42000000-0000-4000-8000-000000007302',repeat('d',64),3,10,1,2)),'MARKETING_DAILY_CAP');
SELECT pg_temp.r42_assert((SELECT allowed FROM public.jenios_reserve_email_budget_r42('transactional','42000000-0000-4000-8000-000000007002','42000000-0000-4000-8000-000000007102',repeat('e',64),3,10,1,2)),'ESSENTIAL_RETAINS_HEADROOM');
SELECT pg_temp.r42_assert((SELECT reason='DAILY_LIMIT' AND retry_at>now() FROM public.jenios_reserve_email_budget_r42('transactional','42000000-0000-4000-8000-000000007003','42000000-0000-4000-8000-000000007103',repeat('f',64),3,10,1,2)),'SHARED_DAILY_CAP');
SELECT pg_temp.r42_assert(public.jenios_defer_email_r42('transactional','42000000-0000-4000-8000-000000007001','42000000-0000-4000-8000-000000007101','DAILY_LIMIT',now()+interval '1 hour'),'RETRY_DEFER');
SELECT pg_temp.r42_assert((SELECT status='retry' AND first_attempt_at=now()-interval '5 minutes' AND attempts=0
 FROM public.jenios_transactional_email_outbox_b305 WHERE id='42000000-0000-4000-8000-000000007001'),'PRIOR_TRANSPORT_WINDOW_RETAINED');
UPDATE public.jenios_transactional_email_outbox_b305 SET next_attempt_at=now()-interval '1 second' WHERE id='42000000-0000-4000-8000-000000007001';
SELECT pg_temp.r42_assert((SELECT count(*)=1 FROM public.jenios_claim_transactional_email_r42(1,now()-interval '1 hour',24)),'RETRY_NEW_LEASE');
SELECT pg_temp.r42_assert((SELECT allowed AND reused FROM public.jenios_reserve_email_budget_r42('transactional','42000000-0000-4000-8000-000000007001',
 (SELECT lease_token FROM public.jenios_transactional_email_outbox_b305 WHERE id='42000000-0000-4000-8000-000000007001'),repeat('a',64),3,10,1,2)),'RETRY_NO_ADDITIONAL_QUOTA');
UPDATE public.jenios_transactional_email_outbox_b305 SET status='uncertain',lease_token=NULL,lease_until=NULL WHERE id='42000000-0000-4000-8000-000000007001';
SELECT pg_temp.r42_assert((SELECT ready AND daily_reserved=3 AND monthly_reserved=3 AND marketing_daily_reserved=1 AND marketing_monthly_reserved=1
 FROM public.jenios_email_dispatch_health_r42()),'UNCERTAIN_RESERVATION_RETAINED_HEALTH');
RESET ROLE;
TRUNCATE public.jenios_email_budget_usage_r42,public.jenios_email_budget_reservations_r42;
INSERT INTO public.jenios_email_budget_reservations_r42(idempotency_key,channel,outbox_id,recipient_user_id,reserved_at)
 SELECT repeat(n::text,64),'marketing',gen_random_uuid(),'42000000-0000-4000-8000-000000000020',date_trunc('month',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
 FROM generate_series(1,2) n;
INSERT INTO public.jenios_email_budget_usage_r42(reservation_id,usage_day,first_used_at)
 SELECT id,(reserved_at AT TIME ZONE 'UTC')::date,reserved_at FROM public.jenios_email_budget_reservations_r42;
SET LOCAL ROLE service_role;
SELECT pg_temp.r42_assert((SELECT reason='MONTHLY_LIMIT' AND retry_at>now() FROM public.jenios_reserve_email_budget_r42('transactional','42000000-0000-4000-8000-000000007003','42000000-0000-4000-8000-000000007103',repeat('9',64),2,2,1,1)),'MONTHLY_CAP');
SELECT pg_temp.r42_assert((SELECT reason='MARKETING_MONTHLY_LIMIT' FROM public.jenios_reserve_email_budget_r42('marketing','42000000-0000-4000-8000-000000007202','42000000-0000-4000-8000-000000007302',repeat('8',64),10,10,1,2)),'MARKETING_MONTHLY_CAP');
RESET ROLE;
SELECT 'R42_BUDGET_IDEMPOTENCY_MONTH_DAY_HEADROOM_PASS';

TRUNCATE public.jenios_email_budget_usage_r42,public.jenios_email_budget_reservations_r42;
-- Prior usage is preserved. The same reservation must claim capacity today.
INSERT INTO public.jenios_email_budget_reservations_r42(id,idempotency_key,channel,outbox_id,recipient_user_id,reserved_at)
 VALUES('42000000-0000-4000-8000-000000008001',repeat('7',64),'transactional',
 '42000000-0000-4000-8000-000000007003','42000000-0000-4000-8000-000000000001',now()-interval '1 day');
INSERT INTO public.jenios_email_budget_usage_r42(reservation_id,usage_day,first_used_at)
 VALUES('42000000-0000-4000-8000-000000008001',(now() AT TIME ZONE 'UTC')::date-1,now()-interval '1 day');
SET LOCAL ROLE service_role;
SELECT pg_temp.r42_assert((SELECT allowed AND reused AND reservation_id='42000000-0000-4000-8000-000000008001'
 FROM public.jenios_reserve_email_budget_r42('transactional','42000000-0000-4000-8000-000000007003','42000000-0000-4000-8000-000000007103',repeat('7',64),2,10,1,2)),'RETRY_CROSSES_DAY_USING_SAME_RESERVATION');
SELECT pg_temp.r42_assert((SELECT count(*)=2 FROM public.jenios_email_budget_usage_r42),'NEW_DAY_USAGE_RETAINED');
SELECT pg_temp.r42_assert((SELECT daily_reserved=1 AND monthly_reserved=1 FROM public.jenios_email_dispatch_health_r42()),'DAILY_USAGE_MONTHLY_DISTINCT');
RESET ROLE;
-- Saturate today's remaining capacity without changing the original reservation.
INSERT INTO public.jenios_email_budget_reservations_r42(id,idempotency_key,channel,outbox_id,recipient_user_id)
 VALUES('42000000-0000-4000-8000-000000008002',repeat('6',64),'transactional',gen_random_uuid(),'42000000-0000-4000-8000-000000000001'),
 ('42000000-0000-4000-8000-000000008003',repeat('5',64),'transactional','42000000-0000-4000-8000-000000007004','42000000-0000-4000-8000-000000000001');
INSERT INTO public.jenios_email_budget_usage_r42(reservation_id,usage_day)
 VALUES('42000000-0000-4000-8000-000000008002',(now() AT TIME ZONE 'UTC')::date),
 ('42000000-0000-4000-8000-000000008003',(now() AT TIME ZONE 'UTC')::date-1);
SET LOCAL ROLE service_role;
SELECT pg_temp.r42_assert((SELECT NOT allowed AND reason='DAILY_LIMIT' FROM public.jenios_reserve_email_budget_r42('transactional',
 '42000000-0000-4000-8000-000000007004','42000000-0000-4000-8000-000000007104',repeat('5',64),2,10,1,2)),'PRIOR_DAY_RETRY_CANNOT_BYPASS_TODAY_CAP');
RESET ROLE;
TRUNCATE public.jenios_email_budget_usage_r42,public.jenios_email_budget_reservations_r42;
INSERT INTO public.jenios_email_budget_reservations_r42(id,idempotency_key,channel,outbox_id,recipient_user_id)
 VALUES('42000000-0000-4000-8000-000000008011',repeat('4',64),'transactional','42000000-0000-4000-8000-000000007004','42000000-0000-4000-8000-000000000001'),
 ('42000000-0000-4000-8000-000000008012',repeat('3',64),'transactional',gen_random_uuid(),'42000000-0000-4000-8000-000000000001'),
 ('42000000-0000-4000-8000-000000008013',repeat('2',64),'transactional',gen_random_uuid(),'42000000-0000-4000-8000-000000000001');
INSERT INTO public.jenios_email_budget_usage_r42(reservation_id,usage_day)
 VALUES('42000000-0000-4000-8000-000000008011',(date_trunc('month',now() AT TIME ZONE 'UTC')::date)-1),
 ('42000000-0000-4000-8000-000000008012',(now() AT TIME ZONE 'UTC')::date),
 ('42000000-0000-4000-8000-000000008013',(now() AT TIME ZONE 'UTC')::date);
SET LOCAL ROLE service_role;
SELECT pg_temp.r42_assert((SELECT NOT allowed AND reason='MONTHLY_LIMIT' FROM public.jenios_reserve_email_budget_r42('transactional',
 '42000000-0000-4000-8000-000000007004','42000000-0000-4000-8000-000000007104',repeat('4',64),2,2,1,1)),'PRIOR_MONTH_RETRY_CANNOT_BYPASS_NEW_MONTH_CAP');
RESET ROLE;
SELECT 'R42_DAY_MONTH_ROLLOVER_PASS';

ROLLBACK;
SELECT 'R42_DISPATCH_POSTGRES_PASS';
