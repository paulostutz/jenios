-- Run after fixture + db/schema/pro-wallet-b143.sql in a disposable PostgreSQL.
-- Every record below is fictitious and rolled back. No network calls occur.
BEGIN;
DO $$
DECLARE u uuid:='b1430000-0000-4000-8000-000000000001';other_user uuid:='b1430000-0000-4000-8000-000000000002';
 crypto uuid:='b1430000-0000-4000-8000-000000000011';global_plan uuid:='b1430000-0000-4000-8000-000000000012';
 sku uuid:='b1430000-0000-4000-8000-000000000013';subscription uuid:='b1430000-0000-4000-8000-000000000021';
 subscription_later uuid:='b1430000-0000-4000-8000-000000000022';
 fp text:=repeat('a',64);other_fp text:=repeat('b',64);r jsonb;s jsonb;q jsonb;o jsonb;
 quote_id uuid;order_id uuid;before_balance bigint;before_budget bigint;before_count bigint;blocked boolean;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.jenios_pro_config_b143 WHERE NOT generation_enabled AND NOT payments_enabled
  AND monthly_provider_limit_nano_usd=0 AND crypto_allowance_nano_usd=0 AND global_allowance_nano_usd=0
  AND topup_currency IS NULL AND topup_amount_minor IS NULL)
 THEN RAISE EXCEPTION 'Disabled approval defaults were not preserved';END IF;
 INSERT INTO auth.users(id) VALUES(u),(other_user);
 INSERT INTO public.jenios_pay_products(id,code,name,category,billing_type,price_cents,active) VALUES
  (crypto,'platform-global-crypto','B143 fixture Crypto','platform','monthly',14990,true),
  (global_plan,'platform-internacional-pro','B143 fixture Global','platform','monthly',19990,true),
  (sku,'social-ai-pro-credits','B143 fixture credit','other','one_time',0,true);
 INSERT INTO public.jenios_pro_wallets_b143(user_id,balance_nano_usd) VALUES(u,1000000000);
 r:=public.jenios_pro_reserve_b143(u,'test-disabled-0001',fp,'advanced_question','gpt-6-luna','prepaid',2000,1000,'2026-10-20-v2-nano');
 IF r->>'code'<>'GENERATION_DISABLED' THEN RAISE EXCEPTION 'Disabled configuration allowed reserve: %',r;END IF;
 UPDATE public.jenios_pro_config_b143 SET generation_enabled=true,pricing_approved=true,
  pricing_version='2026-10-20-v2-nano',rates_verified_at=now(),allowed_models=ARRAY['gpt-6-luna','gpt-6.1-sol'],
  monthly_provider_limit_nano_usd=100000,max_request_provider_nano_usd=5000,crypto_allowance_nano_usd=2000,global_allowance_nano_usd=4000;
 r:=public.jenios_pro_reserve_b143(u,'test-reserve-00001',fp,'advanced_question','gpt-6-luna','prepaid',2000,1000,'2026-10-20-v2-nano');
 IF r->>'ok'<>'true' OR r->>'replayed'<>'false' THEN RAISE EXCEPTION 'First reserve failed: %',r;END IF;
 r:=public.jenios_pro_reserve_b143(u,'test-reserve-00001',fp,'advanced_question','gpt-6-luna','prepaid',2000,1000,'2026-10-20-v2-nano');
 IF r->>'replayed'<>'true' OR (SELECT reserved_nano_usd FROM public.jenios_pro_wallets_b143 WHERE user_id=u)<>2000
  OR (SELECT reserved_nano_usd FROM public.jenios_pro_budgets_b143)<>1000 THEN RAISE EXCEPTION 'Duplicate reserve changed balances';END IF;
 r:=public.jenios_pro_reserve_b143(u,'test-reserve-00001',other_fp,'advanced_question','gpt-6-luna','prepaid',2000,1000,'2026-10-20-v2-nano');
 IF r->>'code'<>'IDEMPOTENCY_CONFLICT' THEN RAISE EXCEPTION 'Fingerprint mismatch accepted';END IF;
 r:=public.jenios_pro_reserve_b143(other_user,'test-nobalance-001',fp,'advanced_question','gpt-6-luna','prepaid',2000,1000,'2026-10-20-v2-nano');
 IF r->>'code'<>'INSUFFICIENT_BALANCE' OR (SELECT reserved_nano_usd FROM public.jenios_pro_budgets_b143)<>1000 THEN RAISE EXCEPTION 'Failed balance check leaked global reserve';END IF;
 r:=public.jenios_pro_dispatch_b143(u,'test-reserve-00001',fp);
 IF r->>'acquired'<>'true' THEN RAISE EXCEPTION 'First dispatch failed';END IF;
 r:=public.jenios_pro_dispatch_b143(u,'test-reserve-00001',fp);
 IF r->>'acquired'<>'false' THEN RAISE EXCEPTION 'Duplicate dispatch allowed';END IF;
 r:=public.jenios_pro_release_b143(u,'test-reserve-00001',fp,'cannot release dispatched');
 IF r->>'ok'<>'false' THEN RAISE EXCEPTION 'Dispatched reservation released without evidence';END IF;
 r:=public.jenios_pro_settle_b143(u,'test-reserve-00001',fp,125,'{"input_tokens":1}','{"answer":"fixture"}','resp_fixture_1');
 IF r->>'chargedNanoUsd'<>'250' OR (SELECT balance_nano_usd FROM public.jenios_pro_wallets_b143 WHERE user_id=u)<>999999750
 OR (SELECT reserved_nano_usd FROM public.jenios_pro_wallets_b143 WHERE user_id=u)<>0
 OR (SELECT spent_nano_usd FROM public.jenios_pro_budgets_b143)<>125
 THEN RAISE EXCEPTION 'Submicro exact settlement failed: %',r;END IF;
 r:=public.jenios_pro_settle_b143(u,'test-reserve-00001',fp,125,'{"input_tokens":1}','{"answer":"fixture"}','resp_fixture_1');
 IF r->>'replayed'<>'true' OR (SELECT balance_nano_usd FROM public.jenios_pro_wallets_b143 WHERE user_id=u)<>999999750 THEN RAISE EXCEPTION 'Double debit on settlement';END IF;
 r:=public.jenios_pro_settle_b143(u,'test-reserve-00001',fp,126,'{}','{}','resp_fixture_1');
 IF r->>'code'<>'SETTLEMENT_CONFLICT' THEN RAISE EXCEPTION 'Changed settlement accepted';END IF;
 r:=public.jenios_pro_reserve_b143(u,'test-release-00001',fp,'advanced_question','gpt-6-luna','prepaid',2000,1000,'2026-10-20-v2-nano');
 r:=public.jenios_pro_release_b143(u,'test-release-00001',fp,'inference was never dispatched');
 IF r->>'ok'<>'true' OR (SELECT reserved_nano_usd FROM public.jenios_pro_budgets_b143)<>0 THEN RAISE EXCEPTION 'Before-dispatch release failed';END IF;
 r:=public.jenios_pro_release_b143(u,'test-release-00001',fp,'same retry');
 IF r->>'replayed'<>'true' THEN RAISE EXCEPTION 'Release retry is not idempotent';END IF;
 INSERT INTO public.jenios_pay_subscriptions(id,user_id,product_id,status,current_period_start,current_period_end) VALUES
  (subscription,u,global_plan,'active',now()-interval '1 day',now()+interval '29 days'),
  (subscription_later,u,global_plan,'active',now()-interval '1 day',now()+interval '29 days');
 s:=public.jenios_pro_status_b143(u);
 IF s->'included'->>'subscriptionId'<>subscription::text THEN RAISE EXCEPTION 'Plan tie-break differs from server';END IF;
 r:=public.jenios_pro_reserve_b143(u,'test-included-001',fp,'advanced_question','gpt-6-luna','included',600,300,'2026-10-20-v2-nano');
 IF r->>'ok'<>'true' THEN RAISE EXCEPTION 'Included reserve failed: %',r;END IF;
 r:=public.jenios_pro_dispatch_b143(u,'test-included-001',fp);
 r:=public.jenios_pro_settle_b143(u,'test-included-001',fp,150,'{}','{"answer":"included fixture"}','resp_fixture_2');
 UPDATE public.jenios_pro_config_b143 SET global_allowance_nano_usd=9000;
 s:=public.jenios_pro_status_b143(u);
 IF s->'included'->>'totalNanoUsd'<>'4000' OR s->'included'->>'spentNanoUsd'<>'300' OR s->'included'->>'availableNanoUsd'<>'3700'
 THEN RAISE EXCEPTION 'Actual cycle ledger or frozen allowance incorrect: %',s;END IF;
 SELECT count(*) INTO before_count FROM public.jenios_pro_periods_b143;
 s:=public.jenios_pro_status_b143(other_user);
 IF (SELECT count(*) FROM public.jenios_pro_periods_b143)<>before_count OR EXISTS(SELECT 1 FROM public.jenios_pro_wallets_b143 WHERE user_id=other_user)
 THEN RAISE EXCEPTION 'Read-only status granted a wallet or period';END IF;
 SELECT spent_nano_usd INTO before_budget FROM public.jenios_pro_budgets_b143;
 UPDATE public.jenios_pro_config_b143 SET monthly_provider_limit_nano_usd=before_budget+500;
 r:=public.jenios_pro_reserve_b143(u,'test-budget-00001',fp,'advanced_question','gpt-6-luna','prepaid',1002,501,'2026-10-20-v2-nano');
 IF r->>'code'<>'GLOBAL_BUDGET_EXHAUSTED' OR (SELECT reserved_nano_usd FROM public.jenios_pro_wallets_b143 WHERE user_id=u)<>0
 THEN RAISE EXCEPTION 'Global budget failed or partial reservation leaked';END IF;
 UPDATE public.jenios_pro_config_b143 SET monthly_provider_limit_nano_usd=100000;
 q:=public.jenios_pro_create_quote_b143(u,'test-quote-000001',5250000,'BCB:ptax',now());
 IF q->>'code'<>'PAYMENTS_NOT_APPROVED' THEN RAISE EXCEPTION 'Unapproved topup quote created';END IF;
 UPDATE public.jenios_pro_config_b143 SET payments_enabled=true,topup_currency='BRL',topup_amount_minor=1000,commercial_terms_version='fixture-not-real';
 q:=public.jenios_pro_create_quote_b143(u,'test-quote-000001',5250000,'BCB:ptax',now());
 IF q->'quote'->>'amount_cents'<>'1000' OR q->'quote'->>'retail_nano_usd'<>'1904761904' THEN RAISE EXCEPTION 'BRL quote math failed: %',q;END IF;
 quote_id:=(q->'quote'->>'id')::uuid;
 blocked:=false;
 BEGIN UPDATE public.jenios_pro_quotes_b143 SET amount_cents=1 WHERE id=quote_id;
 EXCEPTION WHEN OTHERS THEN blocked:=true;END;
 IF NOT blocked THEN RAISE EXCEPTION 'Quote was mutable';END IF;
 o:=public.jenios_pro_prepare_topup_order_b143(u,quote_id,'test-order-000001');
 IF o->>'ok'<>'true' OR o->'order'->>'amount_cents'<>'1000' THEN RAISE EXCEPTION 'Atomic order preparation failed: %',o;END IF;
 order_id:=(o->'order'->>'id')::uuid;
 o:=public.jenios_pro_prepare_topup_order_b143(u,quote_id,'test-order-000001');
 IF o->>'replayed'<>'true' OR (SELECT count(*) FROM public.jenios_pay_orders WHERE user_id=u)<>1 THEN RAISE EXCEPTION 'Order duplicate created';END IF;
 o:=public.jenios_pro_prepare_topup_order_b143(u,quote_id,'test-other-000001');
 IF o->>'code'<>'IDEMPOTENCY_CONFLICT' THEN RAISE EXCEPTION 'One quote was rebound to another order key';END IF;
 r:=public.jenios_pro_confirm_paid_topup_b143(u,quote_id,order_id);
 IF r->>'code'<>'CONFIRMED_PAYMENT_REQUIRED' THEN RAISE EXCEPTION 'Unpaid order credited';END IF;
 UPDATE public.jenios_pay_orders SET status='paid',external_reference='{"fx_verified":true}' WHERE id=order_id;
 INSERT INTO public.jenios_pay_payments(order_id,provider,provider_payment_id,payment_method,amount_cents,status,confirmed_at)
 VALUES(order_id,'inter_pix','fixture-unique-confirmed-receipt','pix',1000,'confirmed',now());
 r:=public.jenios_pro_confirm_paid_topup_b143(u,quote_id,order_id);
 IF r->>'code'<>'INVALID_ORDER_METADATA' THEN RAISE EXCEPTION 'NULL metadata bypass returned: %',r;END IF;
 UPDATE public.jenios_pay_orders SET external_reference=jsonb_build_object('productCode','social-ai-pro-credits','scope','social','proQuoteId',quote_id)::text WHERE id=order_id;
 SELECT balance_nano_usd INTO before_balance FROM public.jenios_pro_wallets_b143 WHERE user_id=u;
 r:=public.jenios_pro_confirm_paid_topup_b143(u,quote_id,order_id);
 IF r->>'ok'<>'true' OR (SELECT balance_nano_usd FROM public.jenios_pro_wallets_b143 WHERE user_id=u)<>before_balance+1904761904 THEN RAISE EXCEPTION 'Confirmed topup failed: %',r;END IF;
 r:=public.jenios_pro_confirm_paid_topup_b143(u,quote_id,order_id);
 IF r->>'replayed'<>'true' OR (SELECT balance_nano_usd FROM public.jenios_pro_wallets_b143 WHERE user_id=u)<>before_balance+1904761904 THEN RAISE EXCEPTION 'Topup duplicate credit';END IF;
 r:=public.jenios_pro_confirm_paid_topup_b143(other_user,quote_id,order_id);
 IF r->>'ok'<>'false' THEN RAISE EXCEPTION 'Another owner claimed credited order';END IF;
 IF has_table_privilege('anon','public.jenios_pro_wallets_b143','SELECT') OR has_table_privilege('authenticated','public.jenios_pro_requests_b143','SELECT')
 OR has_function_privilege('authenticated','public.jenios_pro_status_b143(uuid)','EXECUTE')
 OR has_function_privilege('anon','public.jenios_pro_reserve_b143(uuid,text,text,text,text,text,bigint,bigint,text)','EXECUTE')
 THEN RAISE EXCEPTION 'Client role can access private accounting';END IF;
 r:=public.jenios_pro_reserve_b143(u,'test-unknown-0001',fp,'advanced_question','gpt-6-luna','prepaid',2000,1000,'2026-10-20-v2-nano');
 r:=public.jenios_pro_dispatch_b143(u,'test-unknown-0001',fp);
 r:=public.jenios_pro_reconcile_b143(u,'test-unknown-0001',fp,'mark_unknown',NULL,NULL,NULL,NULL,'{"reason":"fixture timeout after dispatch"}');
 IF r->>'state'<>'needs_reconciliation' OR (SELECT generation_enabled OR payments_enabled OR NOT requires_reconciliation FROM public.jenios_pro_config_b143)
 OR (SELECT reserved_nano_usd FROM public.jenios_pro_wallets_b143 WHERE user_id=u)<>2000 THEN RAISE EXCEPTION 'Unknown usage released or failed to freeze';END IF;
 r:=public.jenios_pro_reconcile_b143(u,'test-unknown-0001',fp,'confirmed_no_charge',0,NULL,NULL,NULL,'{"reason":"fixture no evidence"}');
 IF r->>'code'<>'VERIFIED_EVIDENCE_REQUIRED' THEN RAISE EXCEPTION 'Unverified no-charge reconciliation accepted';END IF;
 r:=public.jenios_pro_reconcile_b143(u,'test-unknown-0001',fp,'confirmed_no_charge',0,NULL,NULL,NULL,
  '{"verified":true,"reference":"fixture-provider-no-inference","actor":"fixture-admin","reason":"provider confirmed no generation"}');
 IF r->>'ok'<>'true' OR (SELECT reserved_nano_usd FROM public.jenios_pro_wallets_b143 WHERE user_id=u)<>0
 OR (SELECT generation_enabled OR requires_reconciliation FROM public.jenios_pro_config_b143) THEN RAISE EXCEPTION 'Explicit no-charge reconciliation failed or auto-enabled generation';END IF;
 UPDATE public.jenios_pro_config_b143 SET generation_enabled=true;
 r:=public.jenios_pro_reserve_b143(u,'test-reconcile-01',fp,'advanced_question','gpt-6-luna','prepaid',2000,1000,'2026-10-20-v2-nano');
 r:=public.jenios_pro_dispatch_b143(u,'test-reconcile-01',fp);
 r:=public.jenios_pro_reconcile_b143(u,'test-reconcile-01',fp,'mark_unknown',NULL,NULL,NULL,NULL,'{"reason":"fixture delayed provider result"}');
 r:=public.jenios_pro_reconcile_b143(u,'test-reconcile-01',fp,'confirmed_cost',175,'{}','{"answer":"reconciled fixture"}','resp_fixture_reconciled',
  '{"verified":true,"reference":"fixture-provider-usage","actor":"fixture-admin","reason":"provider usage confirmed after timeout"}');
 IF r->>'chargedNanoUsd'<>'350' OR (SELECT reserved_nano_usd FROM public.jenios_pro_wallets_b143 WHERE user_id=u)<>0
 OR (SELECT generation_enabled OR requires_reconciliation FROM public.jenios_pro_config_b143) THEN RAISE EXCEPTION 'Confirmed-cost reconciliation failed: %',r;END IF;
 UPDATE public.jenios_pro_config_b143 SET generation_enabled=true;
 r:=public.jenios_pro_reserve_b143(u,'test-overrun-0001',fp,'advanced_question','gpt-6-luna','prepaid',2000,1000,'2026-10-20-v2-nano');
 r:=public.jenios_pro_dispatch_b143(u,'test-overrun-0001',fp);
 SELECT balance_nano_usd INTO before_balance FROM public.jenios_pro_wallets_b143 WHERE user_id=u;
 r:=public.jenios_pro_settle_b143(u,'test-overrun-0001',fp,1001,'{}','{}','resp_fixture_overrun');
 IF r->>'code'<>'COST_EXCEEDS_RESERVATION' OR (SELECT balance_nano_usd FROM public.jenios_pro_wallets_b143 WHERE user_id=u)<>before_balance
 OR (SELECT reserved_nano_usd FROM public.jenios_pro_wallets_b143 WHERE user_id=u)<>2000 THEN RAISE EXCEPTION 'Unexpected cost exceeded customer authorization';END IF;
 blocked:=false;
 BEGIN UPDATE public.jenios_pro_config_b143 SET generation_enabled=true,requires_reconciliation=false;
 EXCEPTION WHEN OTHERS THEN blocked:=true;END;
 IF NOT blocked THEN RAISE EXCEPTION 'Unresolved reconciliation could be reenabled';END IF;
 r:=public.jenios_pro_reconcile_b143(u,'test-overrun-0001',fp,'confirmed_no_charge',0,NULL,NULL,NULL,
  '{"verified":true,"reference":"fixture-wrong-writeoff","actor":"fixture-admin","reason":"must not erase known provider cost"}');
 IF r->>'code'<>'KNOWN_COST_CANNOT_BE_ERASED' THEN RAISE EXCEPTION 'Known cost silently erased';END IF;
 RAISE NOTICE 'B143 wallet SQL invariants passed: disabled defaults, nano precision, paired reserves, idempotency, one dispatch, actual periods, global cap, immutable FX quote, atomic PAY order, verified receipts, RLS privileges and reconciliation';
END;$$;
ROLLBACK;
BEGIN;
SET LOCAL ROLE service_role;
DO $$ DECLARE r jsonb;BEGIN
 r:=public.jenios_pro_status_b143('b1430000-0000-4000-8000-000000000001');
 IF r->>'ok'<>'true' THEN RAISE EXCEPTION 'Service role cannot read ledger';END IF;
 UPDATE public.jenios_pro_config_b143 SET updated_at=now() WHERE id=true;
 r:=public.jenios_pro_reserve_b143(NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL);
 IF r->>'code'<>'INVALID_RESERVATION' THEN RAISE EXCEPTION 'NULL reservation was not rejected';END IF;
END;$$;
ROLLBACK;
BEGIN;
SET LOCAL ROLE authenticated;
DO $$ DECLARE blocked boolean:=false;BEGIN
 BEGIN PERFORM public.jenios_pro_status_b143('b1430000-0000-4000-8000-000000000001');
 EXCEPTION WHEN insufficient_privilege THEN blocked:=true;END;
 IF NOT blocked THEN RAISE EXCEPTION 'Authenticated user executed private ledger RPC';END IF;
 blocked:=false;
 BEGIN PERFORM 1 FROM public.jenios_pro_wallets_b143;
 EXCEPTION WHEN insufficient_privilege THEN blocked:=true;END;
 IF NOT blocked THEN RAISE EXCEPTION 'Authenticated user selected private wallets';END IF;
END;$$;
ROLLBACK;
SELECT 'B143 wallet SQL invariants passed; fictitious records rolled back' AS result;
