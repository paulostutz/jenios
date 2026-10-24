-- R42: bounded production dispatch, durable APPLICATION quotas, and cadence.
-- No network calls, provider receipts, users, payments, or enabled schedules are created.
-- Auth SMTP and other applications are outside these reservation counts.
BEGIN;

-- Explicit grants also work on projects without Supabase's historical defaults.
GRANT SELECT,INSERT,UPDATE ON public.jenios_email_preferences_b305 TO service_role;
ALTER TABLE public.jenios_marketing_email_ledger_b305
 ADD COLUMN IF NOT EXISTS cadence_deferred_until_r42 timestamptz;

CREATE TABLE IF NOT EXISTS public.jenios_email_budget_reservations_r42 (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 idempotency_key text NOT NULL UNIQUE CHECK (idempotency_key ~ '^[a-f0-9]{64}$'),
 channel text NOT NULL CHECK (channel IN ('finance','transactional','dunning','marketing')),
 outbox_id uuid NOT NULL,
 recipient_user_id uuid NOT NULL,
 reserved_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(channel,outbox_id)
);
-- No cascading foreign key: account/outbox deletion must not restore consumed quota.
CREATE INDEX IF NOT EXISTS jenios_email_budget_reserved_at_r42
 ON public.jenios_email_budget_reservations_r42(reserved_at,channel);
ALTER TABLE public.jenios_email_budget_reservations_r42 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.jenios_email_budget_reservations_r42 FROM PUBLIC,anon,authenticated;
REVOKE UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON public.jenios_email_budget_reservations_r42 FROM service_role;
GRANT SELECT,INSERT ON public.jenios_email_budget_reservations_r42 TO service_role;

-- A retry keeps its reservation. A new UTC day must also have budget for that
-- reservation; monthly accounting counts the reservation once within the month.
CREATE TABLE IF NOT EXISTS public.jenios_email_budget_usage_r42 (
 reservation_id uuid NOT NULL REFERENCES public.jenios_email_budget_reservations_r42(id) ON DELETE RESTRICT,
 usage_day date NOT NULL,
 first_used_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(reservation_id,usage_day)
);
CREATE INDEX IF NOT EXISTS jenios_email_budget_usage_day_r42 ON public.jenios_email_budget_usage_r42(usage_day,reservation_id);
ALTER TABLE public.jenios_email_budget_usage_r42 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.jenios_email_budget_usage_r42 FROM PUBLIC,anon,authenticated;
REVOKE UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON public.jenios_email_budget_usage_r42 FROM service_role;
GRANT SELECT,INSERT ON public.jenios_email_budget_usage_r42 TO service_role;

CREATE OR REPLACE FUNCTION public.jenios_email_window_floor_r42(
 p_start_at timestamptz,p_max_age_hours integer,p_now timestamptz)
RETURNS timestamptz LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF current_user<>'service_role' THEN RAISE EXCEPTION 'JENIOS_EMAIL_SERVICE_REQUIRED' USING errcode='42501'; END IF;
 IF p_start_at IS NULL OR p_now IS NULL OR NOT isfinite(p_start_at) OR NOT isfinite(p_now)
  OR p_start_at>p_now OR p_max_age_hours IS NULL OR p_max_age_hours NOT BETWEEN 1 AND 168
  OR p_now<clock_timestamp()-interval '5 minutes' OR p_now>clock_timestamp()+interval '1 minute' THEN
  RAISE EXCEPTION 'EMAIL_ACTIVATION_WINDOW_INVALID' USING errcode='22023';
 END IF;
 RETURN greatest(p_start_at,p_now-make_interval(hours=>p_max_age_hours));
END $$;

CREATE OR REPLACE FUNCTION public.jenios_email_dispatch_health_r42()
RETURNS TABLE(ready boolean,daily_reserved bigint,monthly_reserved bigint,
 marketing_daily_reserved bigint,marketing_monthly_reserved bigint)
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v_now timestamptz:=clock_timestamp(); day_start timestamptz; month_start timestamptz;
BEGIN
 IF current_user<>'service_role' THEN RAISE EXCEPTION 'JENIOS_EMAIL_SERVICE_REQUIRED' USING errcode='42501'; END IF;
 day_start:=date_trunc('day',v_now AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
 month_start:=date_trunc('month',v_now AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
 RETURN QUERY SELECT true,count(DISTINCT r.id) FILTER(WHERE u.usage_day=(day_start AT TIME ZONE 'UTC')::date),count(DISTINCT r.id),
  count(DISTINCT r.id) FILTER(WHERE u.usage_day=(day_start AT TIME ZONE 'UTC')::date AND r.channel='marketing'),
  count(DISTINCT r.id) FILTER(WHERE r.channel='marketing')
 FROM public.jenios_email_budget_usage_r42 u JOIN public.jenios_email_budget_reservations_r42 r ON r.id=u.reservation_id
 WHERE u.usage_day BETWEEN (month_start AT TIME ZONE 'UTC')::date AND (day_start AT TIME ZONE 'UTC')::date;
END $$;

CREATE OR REPLACE FUNCTION public.jenios_reserve_email_budget_r42(
 p_channel text,p_id uuid,p_lease uuid,p_idempotency_key text,
 p_daily_limit integer DEFAULT 40,p_monthly_limit integer DEFAULT 1000,
 p_marketing_daily_limit integer DEFAULT 10,p_marketing_monthly_limit integer DEFAULT 250)
RETURNS TABLE(allowed boolean,reason text,retry_at timestamptz,reservation_id uuid,reused boolean)
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE target_table text; target_user uuid; saved public.jenios_email_budget_reservations_r42%ROWTYPE;
 v_now timestamptz; day_start timestamptz; month_start timestamptz; v_day date;
 was_reserved boolean:=false; counted_month boolean:=false;
 day_count bigint; month_count bigint; marketing_day_count bigint; marketing_month_count bigint;
BEGIN
 IF current_user<>'service_role' THEN RAISE EXCEPTION 'JENIOS_EMAIL_SERVICE_REQUIRED' USING errcode='42501'; END IF;
 IF p_channel IS NULL OR p_channel NOT IN ('finance','transactional','dunning','marketing')
  OR p_id IS NULL OR p_lease IS NULL OR p_idempotency_key IS NULL
  OR p_idempotency_key !~ '^[a-f0-9]{64}$' THEN
  RETURN QUERY SELECT false,'INVALID_ARGUMENTS'::text,NULL::timestamptz,NULL::uuid,false; RETURN;
 END IF;
 IF NOT coalesce(p_daily_limit BETWEEN 2 AND 90 AND p_monthly_limit BETWEEN 2 AND 2500
  AND p_daily_limit<=p_monthly_limit AND p_marketing_daily_limit BETWEEN 1 AND 30
  AND p_marketing_monthly_limit BETWEEN 1 AND 1000
  AND p_marketing_daily_limit<=p_marketing_monthly_limit
  AND p_marketing_daily_limit<p_daily_limit AND p_marketing_monthly_limit<p_monthly_limit,false) THEN
  RETURN QUERY SELECT false,'INVALID_LIMITS'::text,NULL::timestamptz,NULL::uuid,false; RETURN;
 END IF;
 -- A single transaction lock serializes quota checks across all four channels.
 PERFORM pg_advisory_xact_lock(42105,1);
 v_now:=clock_timestamp();
 target_table:=CASE p_channel WHEN 'finance' THEN 'jenios_pay_email_outbox_b305'
  WHEN 'transactional' THEN 'jenios_transactional_email_outbox_b305'
  WHEN 'dunning' THEN 'jenios_subscription_dunning_outbox_b305'
  WHEN 'marketing' THEN 'jenios_marketing_email_ledger_b305' END;
 EXECUTE format('SELECT %I FROM public.%I WHERE id=$1 AND status=''processing'' AND lease_token=$2 AND lease_until>$3 FOR UPDATE',
  CASE WHEN p_channel='finance' THEN 'recipient_user_id' ELSE 'user_id' END,target_table)
 INTO target_user USING p_id,p_lease,v_now;
 IF target_user IS NULL THEN
  RETURN QUERY SELECT false,'LEASE_INVALID'::text,NULL::timestamptz,NULL::uuid,false; RETURN;
 END IF;
 SELECT r.* INTO saved FROM public.jenios_email_budget_reservations_r42 r
 WHERE r.idempotency_key=p_idempotency_key OR (r.channel=p_channel AND r.outbox_id=p_id) LIMIT 1;
 IF FOUND THEN
  IF saved.idempotency_key<>p_idempotency_key OR saved.channel<>p_channel
    OR saved.outbox_id<>p_id OR saved.recipient_user_id<>target_user THEN
   RETURN QUERY SELECT false,'KEY_CONFLICT'::text,NULL::timestamptz,NULL::uuid,false; RETURN;
  END IF;
  was_reserved:=true;
 END IF;
 day_start:=date_trunc('day',v_now AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
 month_start:=date_trunc('month',v_now AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
 v_day:=(v_now AT TIME ZONE 'UTC')::date;
 IF was_reserved THEN
  IF EXISTS(SELECT 1 FROM public.jenios_email_budget_usage_r42 u WHERE u.reservation_id=saved.id AND u.usage_day=v_day) THEN
   RETURN QUERY SELECT true,'REUSED'::text,NULL::timestamptz,saved.id,true; RETURN;
  END IF;
  SELECT EXISTS(SELECT 1 FROM public.jenios_email_budget_usage_r42 u WHERE u.reservation_id=saved.id
   AND u.usage_day BETWEEN (month_start AT TIME ZONE 'UTC')::date AND v_day) INTO counted_month;
 END IF;
 SELECT count(DISTINCT r.id) FILTER (WHERE u.usage_day=v_day),count(DISTINCT r.id),
  count(DISTINCT r.id) FILTER (WHERE u.usage_day=v_day AND r.channel='marketing'),
  count(DISTINCT r.id) FILTER (WHERE r.channel='marketing')
 INTO day_count,month_count,marketing_day_count,marketing_month_count
 FROM public.jenios_email_budget_usage_r42 u JOIN public.jenios_email_budget_reservations_r42 r ON r.id=u.reservation_id
 WHERE u.usage_day BETWEEN (month_start AT TIME ZONE 'UTC')::date AND v_day;
 IF NOT counted_month AND month_count>=p_monthly_limit THEN
  RETURN QUERY SELECT false,'MONTHLY_LIMIT'::text,month_start+interval '1 month',NULL::uuid,false; RETURN;
 ELSIF NOT counted_month AND p_channel='marketing' AND marketing_month_count>=p_marketing_monthly_limit THEN
  RETURN QUERY SELECT false,'MARKETING_MONTHLY_LIMIT'::text,month_start+interval '1 month',NULL::uuid,false; RETURN;
 ELSIF day_count>=p_daily_limit THEN
  RETURN QUERY SELECT false,'DAILY_LIMIT'::text,day_start+interval '1 day',NULL::uuid,false; RETURN;
 ELSIF p_channel='marketing' AND marketing_day_count>=p_marketing_daily_limit THEN
  RETURN QUERY SELECT false,'MARKETING_DAILY_LIMIT'::text,day_start+interval '1 day',NULL::uuid,false; RETURN;
 END IF;
 IF NOT was_reserved THEN
  INSERT INTO public.jenios_email_budget_reservations_r42(idempotency_key,channel,outbox_id,recipient_user_id,reserved_at)
  VALUES(p_idempotency_key,p_channel,p_id,target_user,v_now) RETURNING id INTO saved.id;
 END IF;
 INSERT INTO public.jenios_email_budget_usage_r42(reservation_id,usage_day,first_used_at) VALUES(saved.id,v_day,v_now);
 RETURN QUERY SELECT true,CASE WHEN was_reserved THEN 'REUSED'::text ELSE 'RESERVED'::text END,NULL::timestamptz,saved.id,was_reserved;
END $$;

CREATE OR REPLACE FUNCTION public.jenios_defer_email_r42(
 p_channel text,p_id uuid,p_lease uuid,p_reason text,p_retry_at timestamptz)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE target_table text; changed uuid; initial_status text; attempted boolean;
BEGIN
 IF current_user<>'service_role' THEN RAISE EXCEPTION 'JENIOS_EMAIL_SERVICE_REQUIRED' USING errcode='42501'; END IF;
 IF p_channel IS NULL OR p_channel NOT IN ('finance','transactional','dunning','marketing')
  OR p_reason IS NULL OR p_reason NOT IN ('DAILY_LIMIT','MONTHLY_LIMIT','MARKETING_DAILY_LIMIT','MARKETING_MONTHLY_LIMIT','CADENCE_DEFERRED')
  OR p_retry_at IS NULL OR NOT isfinite(p_retry_at) OR p_retry_at<=clock_timestamp()
  OR p_retry_at>clock_timestamp()+interval '35 days' THEN RETURN false; END IF;
 target_table:=CASE p_channel WHEN 'finance' THEN 'jenios_pay_email_outbox_b305'
  WHEN 'transactional' THEN 'jenios_transactional_email_outbox_b305'
  WHEN 'dunning' THEN 'jenios_subscription_dunning_outbox_b305'
  WHEN 'marketing' THEN 'jenios_marketing_email_ledger_b305' END;
 SELECT EXISTS(SELECT 1 FROM public.jenios_email_budget_reservations_r42 r
  WHERE r.channel=p_channel AND r.outbox_id=p_id) INTO attempted;
 initial_status:=CASE WHEN attempted THEN 'retry' WHEN p_channel='marketing' THEN 'planned' ELSE 'pending' END;
 EXECUTE format('UPDATE public.%I SET status=$1,next_attempt_at=$2,attempts=greatest(attempts-1,0),
  first_attempt_at=CASE WHEN $3 THEN first_attempt_at ELSE NULL END,
  lease_token=NULL,lease_until=NULL,last_error_code=$4
  WHERE id=$5 AND status=''processing'' AND lease_token=$6 AND lease_until>clock_timestamp() RETURNING id',target_table)
 INTO changed USING initial_status,p_retry_at,attempted,p_reason,p_id,p_lease;
 RETURN changed IS NOT NULL;
END $$;

CREATE OR REPLACE FUNCTION public.jenios_claim_pay_email_r42(
 p_limit integer,p_start_at timestamptz,p_max_age_hours integer DEFAULT 24)
RETURNS SETOF public.jenios_pay_email_outbox_b305
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v_now timestamptz:=clock_timestamp(); floor_at timestamptz;
BEGIN
 floor_at:=public.jenios_email_window_floor_r42(p_start_at,p_max_age_hours,v_now);
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 2 THEN RAISE EXCEPTION 'EMAIL_BATCH_INVALID' USING errcode='22023'; END IF;
 UPDATE public.jenios_pay_email_outbox_b305 SET status='uncertain',lease_token=NULL,lease_until=NULL,
  last_error_code='IDEMPOTENCY_WINDOW_EXPIRED',updated_at=v_now
 WHERE status IN ('retry','processing') AND paid_at BETWEEN floor_at AND v_now
  AND first_attempt_at<=v_now-interval '23 hours';
 RETURN QUERY WITH candidates AS (
  SELECT q.id FROM public.jenios_pay_email_outbox_b305 q
  WHERE q.paid_at BETWEEN floor_at AND v_now AND q.attempts<5 AND q.recipient_user_id IS NOT NULL
   AND q.next_attempt_at<=v_now AND q.resend_email_id IS NULL
   AND (q.status IN ('pending','retry') OR (q.status='processing' AND q.lease_until<v_now))
   AND (q.first_attempt_at IS NULL OR q.first_attempt_at>v_now-interval '23 hours')
  ORDER BY q.paid_at,q.created_at,q.id FOR UPDATE SKIP LOCKED LIMIT p_limit
 ) UPDATE public.jenios_pay_email_outbox_b305 q SET status='processing',attempts=q.attempts+1,
  first_attempt_at=coalesce(q.first_attempt_at,v_now),lease_token=gen_random_uuid(),
  lease_until=v_now+interval '2 minutes',updated_at=v_now
 FROM candidates c WHERE q.id=c.id RETURNING q.*;
END $$;

CREATE OR REPLACE FUNCTION public.jenios_claim_transactional_email_r42(
 p_limit integer,p_start_at timestamptz,p_max_age_hours integer DEFAULT 24)
RETURNS SETOF public.jenios_transactional_email_outbox_b305
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v_now timestamptz:=clock_timestamp(); floor_at timestamptz;
BEGIN
 floor_at:=public.jenios_email_window_floor_r42(p_start_at,p_max_age_hours,v_now);
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 2 THEN RAISE EXCEPTION 'EMAIL_BATCH_INVALID' USING errcode='22023'; END IF;
 UPDATE public.jenios_transactional_email_outbox_b305 SET status='uncertain',lease_token=NULL,lease_until=NULL,
  last_error_code='IDEMPOTENCY_WINDOW_EXPIRED',updated_at=v_now
 WHERE status IN ('retry','processing') AND created_at BETWEEN floor_at AND v_now
  AND first_attempt_at<=v_now-interval '23 hours';
 RETURN QUERY WITH candidates AS (
  SELECT q.id FROM public.jenios_transactional_email_outbox_b305 q
  WHERE q.created_at BETWEEN floor_at AND v_now AND q.attempts<5 AND q.next_attempt_at<=v_now
   AND q.resend_email_id IS NULL
   AND (q.status IN ('pending','retry') OR (q.status='processing' AND q.lease_until<v_now))
   AND (q.first_attempt_at IS NULL OR q.first_attempt_at>v_now-interval '23 hours')
  ORDER BY q.created_at,q.id FOR UPDATE SKIP LOCKED LIMIT p_limit
 ) UPDATE public.jenios_transactional_email_outbox_b305 q SET status='processing',attempts=q.attempts+1,
  first_attempt_at=coalesce(q.first_attempt_at,v_now),lease_token=gen_random_uuid(),
  lease_until=v_now+interval '2 minutes',updated_at=v_now
 FROM candidates c WHERE q.id=c.id RETURNING q.*;
END $$;

-- A mutable order.updated_at is not evidence that the next renewal was paid.
CREATE OR REPLACE FUNCTION public.jenios_dunning_cycle_paid_r42(p_subscription_id uuid,p_due_at timestamptz)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF current_user<>'service_role' THEN RAISE EXCEPTION 'JENIOS_EMAIL_SERVICE_REQUIRED' USING errcode='42501'; END IF;
 RETURN EXISTS (
  SELECT 1 FROM public.jenios_pay_subscriptions s
  JOIN public.jenios_pay_orders o ON o.id=s.latest_order_id AND o.user_id=s.user_id AND o.product_id=s.product_id
  JOIN public.jenios_pay_payments p ON p.order_id=o.id AND p.amount_cents=o.amount_cents
  WHERE s.id=p_subscription_id AND o.status='paid' AND o.currency='BRL'
   AND p.status='confirmed' AND p.confirmed_at>=p_due_at AND p.confirmed_at<=clock_timestamp()
 );
END $$;

CREATE OR REPLACE FUNCTION public.jenios_claim_dunning_email_r42(
 p_limit integer,p_start_at timestamptz,p_max_age_hours integer DEFAULT 24)
RETURNS SETOF public.jenios_subscription_dunning_outbox_b305
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v_now timestamptz:=clock_timestamp(); floor_at timestamptz;
BEGIN
 floor_at:=public.jenios_email_window_floor_r42(p_start_at,p_max_age_hours,v_now);
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 2 THEN RAISE EXCEPTION 'EMAIL_BATCH_INVALID' USING errcode='22023'; END IF;
 UPDATE public.jenios_subscription_dunning_outbox_b305 d SET status='superseded',lease_token=NULL,lease_until=NULL,updated_at=v_now
 FROM public.jenios_pay_subscriptions s
 WHERE d.subscription_id=s.id AND d.created_at BETWEEN floor_at AND v_now AND d.status IN ('pending','retry')
  AND (s.current_period_end IS DISTINCT FROM d.due_at
   OR (s.status='active' AND public.jenios_dunning_cycle_paid_r42(s.id,d.due_at)));
 UPDATE public.jenios_subscription_dunning_outbox_b305 SET status='uncertain',lease_token=NULL,lease_until=NULL,
  last_error_code='IDEMPOTENCY_WINDOW_EXPIRED',updated_at=v_now
 WHERE status IN ('retry','processing') AND created_at BETWEEN floor_at AND v_now
  AND first_attempt_at<=v_now-interval '23 hours';
 RETURN QUERY WITH candidates AS (
  SELECT q.id FROM public.jenios_subscription_dunning_outbox_b305 q
  JOIN public.jenios_pay_subscriptions s ON s.id=q.subscription_id AND s.user_id=q.user_id
   AND s.product_id=q.product_id AND s.current_period_end=q.due_at
  WHERE q.created_at BETWEEN floor_at AND v_now AND q.attempts<5 AND q.next_attempt_at<=v_now
   AND q.resend_email_id IS NULL
   AND (q.status IN ('pending','retry') OR (q.status='processing' AND q.lease_until<v_now))
   AND (q.first_attempt_at IS NULL OR q.first_attempt_at>v_now-interval '23 hours')
   AND NOT public.jenios_dunning_cycle_paid_r42(s.id,q.due_at)
   AND ((q.event_kind='due_soon_3d' AND s.status='active' AND v_now>=q.due_at-interval '3 days' AND v_now<q.due_at)
    OR (q.event_kind='due_today' AND s.status='active' AND v_now>=q.due_at AND v_now<q.due_at+interval '1 day')
    OR (q.event_kind='past_due_1d' AND s.status='past_due' AND v_now>=q.due_at+interval '1 day' AND v_now<q.due_at+interval '7 days')
    OR (q.event_kind='cancelled_7d' AND s.status='cancelled' AND v_now>=q.due_at+interval '7 days'))
  ORDER BY q.created_at,q.id FOR UPDATE OF q SKIP LOCKED LIMIT p_limit
 ) UPDATE public.jenios_subscription_dunning_outbox_b305 q SET status='processing',attempts=q.attempts+1,
  first_attempt_at=coalesce(q.first_attempt_at,v_now),lease_token=gen_random_uuid(),
  lease_until=v_now+interval '2 minutes',updated_at=v_now
 FROM candidates c WHERE q.id=c.id RETURNING q.*;
END $$;

CREATE OR REPLACE FUNCTION public.jenios_claim_marketing_email_r42(
 p_limit integer,p_start_at timestamptz,p_max_age_hours integer DEFAULT 24)
RETURNS SETOF public.jenios_marketing_email_ledger_b305
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v_now timestamptz; floor_at timestamptz; item public.jenios_marketing_email_ledger_b305%ROWTYPE;
 claimed public.jenios_marketing_email_ledger_b305%ROWTYPE; emitted integer:=0;
 cadence interval; eligible_at timestamptz; hold_until timestamptz; suppression text;
BEGIN
 floor_at:=public.jenios_email_window_floor_r42(p_start_at,p_max_age_hours,clock_timestamp());
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 2 THEN RAISE EXCEPTION 'EMAIL_BATCH_INVALID' USING errcode='22023'; END IF;
 -- Serializes decisions; committed processing/retry/uncertain rows retain the slot.
 PERFORM pg_advisory_xact_lock(42105,2);
 v_now:=clock_timestamp();
 floor_at:=public.jenios_email_window_floor_r42(p_start_at,p_max_age_hours,v_now);
 UPDATE public.jenios_marketing_email_ledger_b305 SET status='uncertain',lease_token=NULL,lease_until=NULL,
  last_error_code='IDEMPOTENCY_WINDOW_EXPIRED'
 WHERE status IN ('retry','processing') AND due_at>=p_start_at
  AND greatest(due_at,coalesce(cadence_deferred_until_r42,due_at)) BETWEEN floor_at AND v_now
  AND first_attempt_at<=v_now-interval '23 hours';
 FOR item IN SELECT l.* FROM public.jenios_marketing_email_ledger_b305 l
  WHERE l.due_at>=p_start_at AND l.due_at<=v_now
   AND greatest(l.due_at,CASE WHEN l.first_attempt_at IS NULL OR l.first_attempt_at>=l.cadence_deferred_until_r42
    THEN l.cadence_deferred_until_r42 ELSE l.due_at END) BETWEEN floor_at AND v_now
   AND l.next_attempt_at<=v_now AND l.attempts<5
   AND l.provider_email_id IS NULL
   AND (l.status IN ('planned','retry') OR (l.status='processing' AND l.lease_until<v_now))
   AND (l.first_attempt_at IS NULL OR l.first_attempt_at>v_now-interval '23 hours')
  ORDER BY l.due_at,l.created_at,l.id FOR UPDATE SKIP LOCKED LIMIT 200
 LOOP
  suppression:=NULL;
  IF NOT EXISTS (SELECT 1 FROM public.jenios_email_preferences_b305 p WHERE p.user_id=item.user_id
   AND p.marketing_opt_in=true AND p.opted_out_at IS NULL AND p.complaint_at IS NULL AND p.hard_bounce_at IS NULL) THEN
   suppression:='CONSENT_MISSING';
  ELSIF item.campaign_kind='cart_recovery' AND NOT EXISTS (
   SELECT 1 FROM public.jenios_pay_orders o JOIN public.jenios_pay_products p ON p.id=o.product_id
   WHERE o.id=item.order_id AND o.user_id=item.user_id AND o.product_id=item.product_id
    AND o.status='awaiting_payment' AND p.category='platform' AND p.billing_type='monthly' AND p.active=true) THEN
   suppression:='CART_CLOSED';
  ELSIF item.campaign_kind='no_plan_nurture' AND EXISTS (
   SELECT 1 FROM public.jenios_pay_subscriptions s WHERE s.user_id=item.user_id AND s.status IN ('active','past_due')) THEN
   suppression:='ACTIVE_PLAN';
  ELSIF item.campaign_kind='newsletter' AND NOT EXISTS (
   SELECT 1 FROM public.jenios_newsletter_editions_b305 e WHERE e.id=item.newsletter_edition_id
    AND e.edition_key=item.campaign_key AND e.status='approved' AND e.scheduled_at<=v_now) THEN
   suppression:='NEWSLETTER_NOT_APPROVED';
  END IF;
  IF suppression IS NOT NULL THEN
   UPDATE public.jenios_marketing_email_ledger_b305 SET status='suppressed',last_error_code=suppression,
    lease_token=NULL,lease_until=NULL WHERE id=item.id;
   CONTINUE;
  END IF;
  cadence:=CASE item.campaign_kind WHEN 'cart_recovery' THEN interval '20 hours' ELSE interval '144 hours' END;
  SELECT max(prior.sent_at+cadence) INTO eligible_at FROM public.jenios_marketing_email_ledger_b305 prior
   WHERE prior.user_id=item.user_id AND prior.campaign_kind=item.campaign_kind
    AND prior.id<>item.id AND prior.status='sent';
  SELECT max(CASE WHEN prior.status='uncertain' THEN v_now+interval '24 hours'
    ELSE greatest(coalesce(prior.lease_until,v_now+interval '2 minutes'),
      coalesce(prior.next_attempt_at,v_now)+interval '2 minutes') END)
   INTO hold_until FROM public.jenios_marketing_email_ledger_b305 prior
   WHERE prior.user_id=item.user_id AND prior.campaign_kind=item.campaign_kind AND prior.id<>item.id
    AND (prior.status='uncertain' OR (prior.status='processing' AND prior.lease_until>v_now)
     OR (prior.status IN ('processing','retry')
      AND (prior.due_at,prior.created_at,prior.id)<(item.due_at,item.created_at,item.id)));
  eligible_at:=greatest(eligible_at,hold_until);
  IF eligible_at>v_now THEN
   UPDATE public.jenios_marketing_email_ledger_b305 SET next_attempt_at=eligible_at,
    cadence_deferred_until_r42=CASE WHEN first_attempt_at IS NULL THEN eligible_at ELSE cadence_deferred_until_r42 END,
    last_error_code='CADENCE_DEFERRED' WHERE id=item.id;
   CONTINUE;
  END IF;
  UPDATE public.jenios_marketing_email_ledger_b305 SET status='processing',attempts=attempts+1,
   first_attempt_at=coalesce(first_attempt_at,v_now),lease_token=gen_random_uuid(),lease_until=v_now+interval '2 minutes',
   last_error_code=NULL WHERE id=item.id RETURNING * INTO claimed;
  RETURN NEXT claimed;
  emitted:=emitted+1;
  EXIT WHEN emitted>=p_limit;
 END LOOP;
END $$;

-- Shared cycle-correct implementation. Legacy QA signature is retained below;
-- production calls only the activation-window wrapper.
CREATE OR REPLACE FUNCTION public.jenios_release_marketing_email_b305(
 p_id uuid,p_lease uuid,p_error_code text,p_retryable boolean DEFAULT false)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE released uuid;
BEGIN
 IF current_user<>'service_role' THEN RAISE EXCEPTION 'JENIOS_MARKETING_SERVICE_REQUIRED' USING errcode='42501'; END IF;
 UPDATE public.jenios_marketing_email_ledger_b305 l
 SET status=CASE WHEN p_error_code IN ('RESEND_DELIVERY_UNCERTAIN','RESEND_ACK_UNREADABLE',
  'RESEND_ACK_MISSING','MARKETING_DELIVERY_LEDGER_UNCONFIRMED','RESEND_IDEMPOTENCY_CONFLICT') THEN 'uncertain'
  WHEN p_retryable AND l.attempts<5 AND l.first_attempt_at>clock_timestamp()-interval '23 hours' THEN 'retry' ELSE 'failed' END,
  next_attempt_at=clock_timestamp()+make_interval(mins=>least(l.attempts*4,24)),
  lease_token=NULL,lease_until=NULL,last_error_code=left(coalesce(p_error_code,'MARKETING_SEND_FAILED'),64)
 WHERE l.id=p_id AND l.status='processing' AND l.lease_token=p_lease AND l.lease_until>clock_timestamp()
 RETURNING l.id INTO released;
 RETURN released IS NOT NULL;
END $$;

CREATE OR REPLACE FUNCTION public.jenios_process_dunning_window_r42(p_now timestamptz,p_floor timestamptz)
RETURNS TABLE(queued integer,marked_past_due integer,cancelled integer,revoked integer)
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE q integer:=0; x integer:=0; pd integer:=0; c integer:=0; r integer:=0;
BEGIN
 IF current_user<>'service_role' THEN RAISE EXCEPTION 'JENIOS_EMAIL_SERVICE_REQUIRED' USING errcode='42501'; END IF;
 IF p_now IS NULL OR p_floor IS NULL OR NOT isfinite(p_now) THEN RAISE EXCEPTION 'EMAIL_ACTIVATION_WINDOW_INVALID' USING errcode='22023'; END IF;
 PERFORM pg_advisory_xact_lock(42105,3);
 UPDATE public.jenios_subscription_dunning_outbox_b305 d SET status='superseded',updated_at=p_now
 FROM public.jenios_pay_subscriptions s
 WHERE d.subscription_id=s.id AND d.status IN ('pending','retry') AND d.created_at>=p_floor
  AND (s.current_period_end IS DISTINCT FROM d.due_at
   OR (s.status='active' AND public.jenios_dunning_cycle_paid_r42(s.id,d.due_at)));

 INSERT INTO public.jenios_subscription_dunning_outbox_b305(subscription_id,user_id,product_id,event_kind,due_at)
 SELECT s.id,s.user_id,s.product_id,'due_soon_3d',s.current_period_end
 FROM public.jenios_pay_subscriptions s JOIN public.jenios_pay_products p ON p.id=s.product_id
 WHERE s.status='active' AND p.category='platform' AND p.billing_type='monthly'
  AND s.current_period_end-interval '3 days'>=p_floor
  AND p_now>=s.current_period_end-interval '3 days' AND p_now<s.current_period_end-interval '2 days'
 ON CONFLICT DO NOTHING;
 GET DIAGNOSTICS x=ROW_COUNT; q:=q+x;

 INSERT INTO public.jenios_subscription_dunning_outbox_b305(subscription_id,user_id,product_id,event_kind,due_at)
 SELECT s.id,s.user_id,s.product_id,'due_today',s.current_period_end
 FROM public.jenios_pay_subscriptions s JOIN public.jenios_pay_products p ON p.id=s.product_id
 WHERE s.status='active' AND p.category='platform' AND p.billing_type='monthly'
  AND s.current_period_end>=p_floor AND p_now>=s.current_period_end AND p_now<s.current_period_end+interval '1 day'
  AND NOT public.jenios_dunning_cycle_paid_r42(s.id,s.current_period_end)
 ON CONFLICT DO NOTHING;
 GET DIAGNOSTICS x=ROW_COUNT; q:=q+x;

 UPDATE public.jenios_pay_subscriptions s SET status='past_due',updated_at=p_now
 FROM public.jenios_pay_products p
 WHERE p.id=s.product_id AND p.category='platform' AND p.billing_type='monthly'
  AND s.status='active' AND s.current_period_end+interval '1 day'>=p_floor
  AND p_now>=s.current_period_end+interval '1 day'
  AND NOT public.jenios_dunning_cycle_paid_r42(s.id,s.current_period_end);
 GET DIAGNOSTICS pd=ROW_COUNT;

 INSERT INTO public.jenios_subscription_dunning_outbox_b305(subscription_id,user_id,product_id,event_kind,due_at)
 SELECT s.id,s.user_id,s.product_id,'past_due_1d',s.current_period_end
 FROM public.jenios_pay_subscriptions s JOIN public.jenios_pay_products p ON p.id=s.product_id
 WHERE s.status='past_due' AND p.category='platform' AND p.billing_type='monthly'
  AND s.current_period_end+interval '1 day'>=p_floor
  AND p_now>=s.current_period_end+interval '1 day' AND p_now<s.current_period_end+interval '7 days'
  AND NOT public.jenios_dunning_cycle_paid_r42(s.id,s.current_period_end)
 ON CONFLICT DO NOTHING;
 GET DIAGNOSTICS x=ROW_COUNT; q:=q+x;

 WITH due AS (
  SELECT s.id FROM public.jenios_pay_subscriptions s JOIN public.jenios_pay_products p ON p.id=s.product_id
  WHERE s.status IN ('active','past_due') AND p.category='platform' AND p.billing_type='monthly'
   AND s.current_period_end+interval '7 days'>=p_floor AND p_now>=s.current_period_end+interval '7 days'
   AND NOT public.jenios_dunning_cycle_paid_r42(s.id,s.current_period_end)
  FOR UPDATE OF s
 ), cancelled_rows AS (
  UPDATE public.jenios_pay_subscriptions s SET status='cancelled',updated_at=p_now
  FROM due d WHERE s.id=d.id RETURNING s.id,s.user_id,s.product_id,s.current_period_end
 ), queued_cancel AS (
  INSERT INTO public.jenios_subscription_dunning_outbox_b305(subscription_id,user_id,product_id,event_kind,due_at)
  SELECT id,user_id,product_id,'cancelled_7d',current_period_end FROM cancelled_rows ON CONFLICT DO NOTHING RETURNING 1
 ), revoked_rows AS (
  UPDATE public.jenios_pay_entitlements e SET status='revoked'
  FROM cancelled_rows d WHERE e.user_id=d.user_id AND e.product_id=d.product_id AND e.status='active' RETURNING 1
 ) SELECT (SELECT count(*) FROM cancelled_rows),(SELECT count(*) FROM revoked_rows),(SELECT count(*) FROM queued_cancel) INTO c,r,x;
 RETURN QUERY SELECT q+x,pd,c,r;
END $$;

CREATE OR REPLACE FUNCTION public.jenios_process_subscription_dunning_b305(p_now timestamptz DEFAULT now())
RETURNS TABLE(queued integer,marked_past_due integer,cancelled integer,revoked integer)
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT * FROM public.jenios_process_dunning_window_r42(p_now,'-infinity'::timestamptz);
$$;

CREATE OR REPLACE FUNCTION public.jenios_process_subscription_dunning_r42(
 p_now timestamptz,p_start_at timestamptz,p_max_age_hours integer DEFAULT 24)
RETURNS TABLE(queued integer,marked_past_due integer,cancelled integer,revoked integer)
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT * FROM public.jenios_process_dunning_window_r42(p_now,
  public.jenios_email_window_floor_r42(p_start_at,p_max_age_hours,p_now));
$$;

CREATE OR REPLACE FUNCTION public.jenios_plan_marketing_emails_r42(
 p_now timestamptz,p_start_at timestamptz,p_max_age_hours integer DEFAULT 24)
RETURNS TABLE(planned integer,suppressed integer)
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE floor_at timestamptz; n integer:=0; s integer:=0; x integer:=0;
BEGIN
 floor_at:=public.jenios_email_window_floor_r42(p_start_at,p_max_age_hours,p_now);
 UPDATE public.jenios_marketing_email_ledger_b305 l SET status='suppressed',last_error_code='PREFERENCE_SUPPRESSED'
 FROM public.jenios_email_preferences_b305 p WHERE l.user_id=p.user_id AND l.status IN ('planned','retry')
  AND l.due_at BETWEEN floor_at AND p_now
  AND (p.marketing_opt_in=false OR p.opted_out_at IS NOT NULL OR p.complaint_at IS NOT NULL OR p.hard_bounce_at IS NOT NULL);
 GET DIAGNOSTICS x=ROW_COUNT; s:=s+x;
 UPDATE public.jenios_marketing_email_ledger_b305 l SET status='suppressed',last_error_code='ACTIVE_PLAN'
 WHERE l.campaign_kind='no_plan_nurture' AND l.status IN ('planned','retry') AND l.due_at BETWEEN floor_at AND p_now
  AND EXISTS (SELECT 1 FROM public.jenios_pay_subscriptions sub WHERE sub.user_id=l.user_id AND sub.status IN ('active','past_due'));
 GET DIAGNOSTICS x=ROW_COUNT; s:=s+x;
 UPDATE public.jenios_marketing_email_ledger_b305 l SET status='suppressed',last_error_code='CART_CLOSED'
 FROM public.jenios_pay_orders o WHERE l.order_id=o.id AND l.campaign_kind='cart_recovery'
  AND l.status IN ('planned','retry') AND l.due_at BETWEEN floor_at AND p_now
  AND o.status IN ('paid','cancelled','expired','refunded');
 GET DIAGNOSTICS x=ROW_COUNT; s:=s+x;

 INSERT INTO public.jenios_marketing_email_ledger_b305(user_id,campaign_kind,campaign_key,step,status,due_at,next_attempt_at,order_id,product_id)
 SELECT o.user_id,'cart_recovery',o.id::text,v.step,'planned',o.created_at+v.delay,o.created_at+v.delay,o.id,o.product_id
 FROM public.jenios_pay_orders o JOIN public.jenios_pay_products prod ON prod.id=o.product_id
 JOIN public.jenios_email_preferences_b305 pref ON pref.user_id=o.user_id
 CROSS JOIN (VALUES (1,interval '2 hours'),(2,interval '24 hours'),(3,interval '72 hours')) AS v(step,delay)
 WHERE prod.category='platform' AND prod.billing_type='monthly' AND prod.active=true AND o.status='awaiting_payment'
  AND pref.marketing_opt_in=true AND pref.opted_out_at IS NULL AND pref.complaint_at IS NULL AND pref.hard_bounce_at IS NULL
  AND o.created_at+v.delay BETWEEN floor_at AND p_now
 ON CONFLICT(user_id,campaign_kind,campaign_key,step) DO NOTHING;
 GET DIAGNOSTICS x=ROW_COUNT; n:=n+x;

 INSERT INTO public.jenios_marketing_email_ledger_b305(user_id,campaign_kind,campaign_key,step,status,due_at,next_attempt_at)
 SELECT pref.user_id,'no_plan_nurture',pref.user_id::text,v.step,'planned',pref.created_at+v.delay,pref.created_at+v.delay
 FROM public.jenios_email_preferences_b305 pref CROSS JOIN (VALUES (1,interval '3 days'),(2,interval '10 days')) AS v(step,delay)
 WHERE pref.marketing_opt_in=true AND pref.opted_out_at IS NULL AND pref.complaint_at IS NULL AND pref.hard_bounce_at IS NULL
  AND pref.created_at+v.delay BETWEEN floor_at AND p_now
  AND NOT EXISTS (SELECT 1 FROM public.jenios_pay_subscriptions sub WHERE sub.user_id=pref.user_id AND sub.status IN ('active','past_due'))
 ON CONFLICT(user_id,campaign_kind,campaign_key,step) DO NOTHING;
 GET DIAGNOSTICS x=ROW_COUNT; n:=n+x;

 INSERT INTO public.jenios_marketing_email_ledger_b305(user_id,campaign_kind,campaign_key,step,status,due_at,next_attempt_at,newsletter_edition_id)
 SELECT pref.user_id,'newsletter',e.edition_key,0,'planned',e.scheduled_at,e.scheduled_at,e.id
 FROM public.jenios_email_preferences_b305 pref CROSS JOIN public.jenios_newsletter_editions_b305 e
 WHERE pref.marketing_opt_in=true AND pref.opted_out_at IS NULL AND pref.complaint_at IS NULL AND pref.hard_bounce_at IS NULL
  AND e.status='approved' AND e.scheduled_at BETWEEN floor_at AND p_now
 ON CONFLICT(user_id,campaign_kind,campaign_key,step) DO NOTHING;
 GET DIAGNOSTICS x=ROW_COUNT; n:=n+x;
 RETURN QUERY SELECT n,s;
END $$;

REVOKE ALL ON FUNCTION public.jenios_email_window_floor_r42(timestamptz,integer,timestamptz) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.jenios_email_dispatch_health_r42() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.jenios_reserve_email_budget_r42(text,uuid,uuid,text,integer,integer,integer,integer) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.jenios_defer_email_r42(text,uuid,uuid,text,timestamptz) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.jenios_claim_pay_email_r42(integer,timestamptz,integer) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.jenios_claim_transactional_email_r42(integer,timestamptz,integer) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.jenios_dunning_cycle_paid_r42(uuid,timestamptz) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.jenios_claim_dunning_email_r42(integer,timestamptz,integer) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.jenios_claim_marketing_email_r42(integer,timestamptz,integer) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.jenios_release_marketing_email_b305(uuid,uuid,text,boolean) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.jenios_process_dunning_window_r42(timestamptz,timestamptz) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.jenios_process_subscription_dunning_b305(timestamptz) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.jenios_process_subscription_dunning_r42(timestamptz,timestamptz,integer) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.jenios_plan_marketing_emails_r42(timestamptz,timestamptz,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.jenios_email_window_floor_r42(timestamptz,integer,timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.jenios_email_dispatch_health_r42() TO service_role;
GRANT EXECUTE ON FUNCTION public.jenios_reserve_email_budget_r42(text,uuid,uuid,text,integer,integer,integer,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.jenios_defer_email_r42(text,uuid,uuid,text,timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.jenios_claim_pay_email_r42(integer,timestamptz,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.jenios_claim_transactional_email_r42(integer,timestamptz,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.jenios_dunning_cycle_paid_r42(uuid,timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.jenios_claim_dunning_email_r42(integer,timestamptz,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.jenios_claim_marketing_email_r42(integer,timestamptz,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.jenios_release_marketing_email_b305(uuid,uuid,text,boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.jenios_process_dunning_window_r42(timestamptz,timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.jenios_process_subscription_dunning_b305(timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.jenios_process_subscription_dunning_r42(timestamptz,timestamptz,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.jenios_plan_marketing_emails_r42(timestamptz,timestamptz,integer) TO service_role;

COMMIT;
