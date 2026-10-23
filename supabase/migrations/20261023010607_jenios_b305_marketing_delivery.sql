-- B305-R21 — private marketing delivery claim/complete/retry protocol.
BEGIN;
CREATE OR REPLACE FUNCTION public.jenios_claim_marketing_email_b305(p_limit integer DEFAULT 5)
RETURNS SETOF public.jenios_marketing_email_ledger_b305
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF current_user <> 'service_role' THEN RAISE EXCEPTION 'JENIOS_MARKETING_SERVICE_REQUIRED' USING errcode='42501'; END IF;
 UPDATE public.jenios_marketing_email_ledger_b305 l SET status='suppressed',last_error_code='CONSENT_MISSING'
 WHERE l.status IN ('planned','retry') AND NOT EXISTS (
  SELECT 1 FROM public.jenios_email_preferences_b305 p WHERE p.user_id=l.user_id AND p.marketing_opt_in=true
   AND p.opted_out_at IS NULL AND p.complaint_at IS NULL AND p.hard_bounce_at IS NULL);
 UPDATE public.jenios_marketing_email_ledger_b305 l SET status='suppressed',last_error_code='CART_CLOSED'
 WHERE l.campaign_kind='cart_recovery' AND l.status IN ('planned','retry') AND NOT EXISTS (
  SELECT 1 FROM public.jenios_pay_orders o JOIN public.jenios_pay_products p ON p.id=o.product_id
  WHERE o.id=l.order_id AND o.user_id=l.user_id AND o.product_id=l.product_id AND o.status='awaiting_payment'
   AND p.category='platform' AND p.billing_type='monthly' AND p.active=true);
 UPDATE public.jenios_marketing_email_ledger_b305 l SET status='suppressed',last_error_code='ACTIVE_PLAN'
 WHERE l.campaign_kind='no_plan_nurture' AND l.status IN ('planned','retry') AND EXISTS (
  SELECT 1 FROM public.jenios_pay_subscriptions s WHERE s.user_id=l.user_id AND s.status IN ('active','past_due'));
 UPDATE public.jenios_marketing_email_ledger_b305 l SET status='suppressed',last_error_code='NEWSLETTER_NOT_APPROVED'
 WHERE l.campaign_kind='newsletter' AND l.status IN ('planned','retry') AND NOT EXISTS (
  SELECT 1 FROM public.jenios_newsletter_editions_b305 e WHERE e.id=l.newsletter_edition_id
   AND e.edition_key=l.campaign_key AND e.status='approved' AND e.scheduled_at<=now());
 UPDATE public.jenios_marketing_email_ledger_b305 l SET status='suppressed',last_error_code='FREQUENCY_CAP'
 WHERE l.status IN ('planned','retry') AND EXISTS (
  SELECT 1 FROM public.jenios_marketing_email_ledger_b305 prior
  WHERE prior.user_id=l.user_id AND prior.campaign_kind=l.campaign_kind AND prior.status='sent'
   AND prior.sent_at IS NOT NULL AND prior.id<>l.id AND prior.sent_at > now()-(
    CASE l.campaign_kind WHEN 'newsletter' THEN interval '144 hours'
     WHEN 'cart_recovery' THEN interval '20 hours'
     WHEN 'no_plan_nurture' THEN interval '144 hours' ELSE interval '100 years' END));
 UPDATE public.jenios_marketing_email_ledger_b305
 SET status='uncertain',lease_token=NULL,lease_until=NULL,last_error_code='IDEMPOTENCY_WINDOW_EXPIRED'
 WHERE status IN ('retry','processing') AND first_attempt_at IS NOT NULL AND first_attempt_at<now()-interval '23 hours';
 RETURN QUERY WITH candidates AS (
  SELECT l.id FROM public.jenios_marketing_email_ledger_b305 l
  WHERE l.attempts<5 AND l.due_at<=now() AND l.next_attempt_at<=now()
   AND (l.status IN ('planned','retry') OR (l.status='processing' AND l.lease_until<now()))
   AND (l.first_attempt_at IS NULL OR l.first_attempt_at>now()-interval '23 hours')
  ORDER BY l.due_at,l.created_at FOR UPDATE SKIP LOCKED
  LIMIT greatest(1,least(coalesce(p_limit,5),10))
 ) UPDATE public.jenios_marketing_email_ledger_b305 l
 SET status='processing',attempts=l.attempts+1,first_attempt_at=coalesce(l.first_attempt_at,now()),
  lease_token=gen_random_uuid(),lease_until=now()+interval '2 minutes'
 FROM candidates c WHERE l.id=c.id RETURNING l.*;
END $$;

CREATE OR REPLACE FUNCTION public.jenios_complete_marketing_email_b305(p_id uuid,p_lease uuid,p_provider_email_id text)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE acknowledged uuid;
BEGIN
 IF current_user <> 'service_role' THEN RAISE EXCEPTION 'JENIOS_MARKETING_SERVICE_REQUIRED' USING errcode='42501'; END IF;
 IF length(coalesce(p_provider_email_id,'')) NOT BETWEEN 8 AND 200 THEN RAISE EXCEPTION 'INVALID_PROVIDER_RECEIPT' USING errcode='22023'; END IF;
 UPDATE public.jenios_marketing_email_ledger_b305 l
 SET status='sent',provider_email_id=p_provider_email_id,sent_at=now(),lease_token=NULL,lease_until=NULL,last_error_code=NULL
 WHERE l.id=p_id AND l.status='processing' AND l.lease_token=p_lease AND l.lease_until>now() AND l.provider_email_id IS NULL
 RETURNING l.id INTO acknowledged;
 RETURN acknowledged IS NOT NULL;
END $$;

CREATE OR REPLACE FUNCTION public.jenios_release_marketing_email_b305(p_id uuid,p_lease uuid,p_error_code text,p_retryable boolean DEFAULT false)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE released uuid;
BEGIN
 IF current_user <> 'service_role' THEN RAISE EXCEPTION 'JENIOS_MARKETING_SERVICE_REQUIRED' USING errcode='42501'; END IF;
 UPDATE public.jenios_marketing_email_ledger_b305 l
 SET status=CASE WHEN p_error_code='RESEND_DELIVERY_UNCERTAIN' THEN 'uncertain'
  WHEN p_retryable AND l.attempts<5 AND l.first_attempt_at>now()-interval '23 hours' THEN 'retry' ELSE 'failed' END,
  next_attempt_at=now()+make_interval(mins=>least(l.attempts*4,24)),lease_token=NULL,lease_until=NULL,
  last_error_code=left(coalesce(p_error_code,'MARKETING_SEND_FAILED'),64)
 WHERE l.id=p_id AND l.status='processing' AND l.lease_token=p_lease AND l.lease_until>now()
 RETURNING l.id INTO released;
 RETURN released IS NOT NULL;
END $$;
REVOKE ALL ON FUNCTION public.jenios_claim_marketing_email_b305(integer) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.jenios_complete_marketing_email_b305(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.jenios_release_marketing_email_b305(uuid,uuid,text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.jenios_claim_marketing_email_b305(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.jenios_complete_marketing_email_b305(uuid,uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.jenios_release_marketing_email_b305(uuid,uuid,text,boolean) TO service_role;
COMMIT;
