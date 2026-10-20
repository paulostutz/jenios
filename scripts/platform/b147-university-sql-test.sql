-- Isolated PostgreSQL fixture only. Every synthetic customer/payment is rolled back.
\set ON_ERROR_STOP on
BEGIN;
DO $$
DECLARE u uuid:='b1470000-0000-4000-8000-000000000001';other_user uuid:='b1470000-0000-4000-8000-000000000002';
 r jsonb;s jsonb;first_order uuid;second_order uuid;receipt uuid;first_end timestamptz;blocked boolean;sku uuid;
BEGIN
 IF current_database()<>'jenios_pro_b143_test' THEN RAISE EXCEPTION 'University test requires isolated database';END IF;
 IF public.jenios_university_month_end_b147('2026-01-31T15:30:00Z',31,'12:30:00')<>'2026-02-28T15:30:00Z'::timestamptz
  OR public.jenios_university_month_end_b147('2026-02-28T15:30:00Z',31,'12:30:00')<>'2026-03-31T15:30:00Z'::timestamptz
  OR public.jenios_university_month_end_b147('2028-01-31T15:30:00Z',31,'12:30:00')<>'2028-02-29T15:30:00Z'::timestamptz
  OR public.jenios_university_month_end_b147('2026-12-31T23:00:00Z',31,'20:00:00')<>'2027-01-31T23:00:00Z'::timestamptz
 THEN RAISE EXCEPTION 'Calendar month or preserved billing anchor is wrong';END IF;
 SELECT id INTO sku FROM public.jenios_pay_products WHERE code='social-university-monthly' AND active=true AND price_cents=4990 AND currency='BRL' AND billing_type='monthly';
 IF sku IS NULL THEN RAISE EXCEPTION 'Approved independent monthly product missing';END IF;
 IF has_table_privilege('anon','public.jenios_university_invoices_b147','SELECT')
  OR has_table_privilege('authenticated','public.jenios_university_invoices_b147','SELECT')
  OR has_table_privilege('service_role','public.jenios_university_invoices_b147','TRUNCATE')
  OR has_table_privilege('service_role','public.jenios_university_invoices_b147','DELETE')
  OR has_function_privilege('anon','public.jenios_university_prepare_b147(uuid,text,text)','EXECUTE')
  OR has_function_privilege('authenticated','public.jenios_university_confirm_b147(uuid,uuid)','EXECUTE')
  OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.jenios_university_invoices_b147'::regclass)
 THEN RAISE EXCEPTION 'Private monthly accounting permissions failed';END IF;
 INSERT INTO auth.users(id) VALUES(u),(other_user);
 r:=public.jenios_university_prepare_b147(u,'university-test-key-1','wrong-terms');
 IF r->>'code'<>'INVALID_CONSENT' THEN RAISE EXCEPTION 'Terms mismatch accepted';END IF;
 r:=public.jenios_university_prepare_b147(u,'university-test-key-1','university-monthly-2026-10-20');
 IF r->>'ok'<>'true' OR r->'order'->>'amount_cents'<>'4990' THEN RAISE EXCEPTION 'Monthly preparation failed: %',r;END IF;
 first_order:=(r->'order'->>'id')::uuid;
 s:=public.jenios_university_prepare_b147(u,'university-other-key-2','university-monthly-2026-10-20');
 IF s->'order'->>'id'<>first_order::text OR s->'invoice'->>'request_key'<>'university-test-key-1'
  OR (SELECT count(*) FROM public.jenios_pay_orders WHERE user_id=u)<>1 THEN RAISE EXCEPTION 'Different key opened duplicate pending Pix';END IF;
 r:=public.jenios_university_confirm_b147(u,first_order);
 IF r->>'code'<>'PAYMENT_NOT_CONFIRMED' THEN RAISE EXCEPTION 'Unpaid monthly access granted';END IF;
 UPDATE public.jenios_pay_orders SET status='paid',created_at=now()-interval '2 hours' WHERE id=first_order;
 r:=public.jenios_university_confirm_b147(u,first_order);
 IF r->>'code'<>'PAYMENT_NOT_CONFIRMED' THEN RAISE EXCEPTION 'Paid flag without receipt granted access';END IF;
 INSERT INTO public.jenios_pay_payments(order_id,provider,provider_payment_id,payment_method,amount_cents,status,confirmed_at)
 VALUES(first_order,'inter_pix',replace(first_order::text,'-',''),'pix',4990,'confirmed',now()-interval '1 hour') RETURNING id INTO receipt;
 UPDATE public.jenios_pay_orders SET external_reference='{}' WHERE id=first_order;
 r:=public.jenios_university_confirm_b147(u,first_order);
 IF r->>'code'<>'PAYMENT_NOT_CONFIRMED' THEN RAISE EXCEPTION 'Missing financial metadata accepted';END IF;
 UPDATE public.jenios_pay_orders SET external_reference=(s->'order'->>'external_reference') WHERE id=first_order;
 r:=public.jenios_university_confirm_b147(other_user,first_order);
 IF r->>'code'<>'ORDER_NOT_FOUND' THEN RAISE EXCEPTION 'Cross-account monthly claim accepted';END IF;
 r:=public.jenios_university_confirm_b147(u,first_order);
 IF r->>'ok'<>'true' OR r->>'replayed'<>'false' THEN RAISE EXCEPTION 'Verified monthly payment failed: %',r;END IF;
 first_end:=(r->'invoice'->>'period_end')::timestamptz;
 s:=public.jenios_university_confirm_b147(u,first_order);
 IF s->>'replayed'<>'true' OR (s->'invoice'->>'period_end')::timestamptz<>first_end THEN RAISE EXCEPTION 'Payment replay extended month';END IF;
 blocked:=false;
 BEGIN UPDATE public.jenios_university_invoices_b147 SET period_end=period_end+interval '1 month' WHERE order_id=first_order;
 EXCEPTION WHEN OTHERS THEN blocked:=true;END;
 IF NOT blocked THEN RAISE EXCEPTION 'Paid month was mutable';END IF;
 r:=public.jenios_university_prepare_b147(u,'university-renew-key-3','university-monthly-2026-10-20');
 second_order:=(r->'order'->>'id')::uuid;
 IF second_order IS NULL OR second_order=first_order THEN RAISE EXCEPTION 'Explicit renewal not created';END IF;
 UPDATE public.jenios_pay_orders SET status='paid',created_at=now()-interval '1 hour' WHERE id=second_order;
 INSERT INTO public.jenios_pay_payments(order_id,provider,provider_payment_id,payment_method,amount_cents,status,confirmed_at)
 VALUES(second_order,'inter_pix',replace(second_order::text,'-',''),'pix',4990,'confirmed',now()-interval '30 minutes');
 r:=public.jenios_university_confirm_b147(u,second_order);
 IF r->>'ok'<>'true' OR (r->'invoice'->>'period_start')::timestamptz<>first_end
  OR (r->'invoice'->>'period_end')::timestamptz<=first_end THEN RAISE EXCEPTION 'Early renewal overlapped/lost paid days: %',r;END IF;
 UPDATE public.jenios_pay_orders SET status='refunded' WHERE id=first_order;
 r:=public.jenios_university_prepare_b147(u,'university-gap-key-6','university-monthly-2026-10-20');
 IF r->>'code'<>'FUTURE_PAID_PERIOD' THEN RAISE EXCEPTION 'Refund gap allowed another blind purchase: %',r;END IF;
 UPDATE public.jenios_pay_orders SET status='refunded' WHERE id=second_order;
 r:=public.jenios_university_confirm_b147(u,second_order);
 IF r->>'code'<>'PAYMENT_NOT_CONFIRMED' THEN RAISE EXCEPTION 'Refunded monthly payment accepted';END IF;
 -- A receipt reconciled after a prior bank-expiry read is still preserved.
 r:=public.jenios_university_prepare_b147(other_user,'university-late-key-4','university-monthly-2026-10-20');
 second_order:=(r->'order'->>'id')::uuid;
 UPDATE public.jenios_university_invoices_b147 SET status='closed' WHERE order_id=second_order;
 UPDATE public.jenios_pay_orders SET status='paid',created_at=now()-interval '2 minutes' WHERE id=second_order;
 INSERT INTO public.jenios_pay_payments(order_id,provider,provider_payment_id,payment_method,amount_cents,status,confirmed_at)
 VALUES(second_order,'inter_pix',replace(second_order::text,'-',''),'pix',4990,'confirmed',now()-interval '1 minute');
 r:=public.jenios_university_confirm_b147(other_user,second_order);
 IF r->>'ok'<>'true' THEN RAISE EXCEPTION 'Verified late receipt was discarded: %',r;END IF;
 INSERT INTO public.jenios_pay_products(code,name,category,price_cents,currency,billing_type,active)
 VALUES('platform-global-crypto','B147 fixture included plan','platform',14990,'BRL','monthly',true) RETURNING id INTO sku;
 INSERT INTO public.jenios_pay_subscriptions(user_id,product_id,status,current_period_start,current_period_end)
 VALUES(u,sku,'active',now()-interval '1 day',now()+interval '1 day');
 r:=public.jenios_university_prepare_b147(u,'university-included-5','university-monthly-2026-10-20');
 IF r->>'code'<>'UNIVERSITY_INCLUDED' THEN RAISE EXCEPTION 'Included plan could buy duplicate education';END IF;
END;$$;
SET LOCAL ROLE service_role;
DO $$ DECLARE r jsonb;BEGIN
 r:=public.jenios_university_prepare_b147(NULL,NULL,NULL);
 IF r->>'code'<>'INVALID_CONSENT' THEN RAISE EXCEPTION 'Service function or NULL validation failed';END IF;
 PERFORM 1 FROM public.jenios_university_invoices_b147;
END;$$;
ROLLBACK;
SELECT 'B147 University SQL passed: monthly calendar/anchor, approved price, explicit terms, owner isolation, one pending Pix, verified receipt, replay, early renewal, refund, late receipt, included plans and private privileges; synthetic rows rolled back' AS result;
