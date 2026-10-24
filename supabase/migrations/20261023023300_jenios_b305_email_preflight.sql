-- B305-R32 — read-only infrastructure preflight for email release readiness.
BEGIN;
CREATE OR REPLACE FUNCTION public.jenios_email_preflight_b305()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path=''
AS $$
 WITH checks AS (
  SELECT
   to_regclass('public.jenios_pay_email_outbox_b305') IS NOT NULL AS finance_outbox,
   to_regclass('public.jenios_transactional_email_outbox_b305') IS NOT NULL AS transactional_outbox,
   to_regclass('public.jenios_subscription_dunning_outbox_b305') IS NOT NULL AS dunning_outbox,
   to_regclass('public.jenios_marketing_email_ledger_b305') IS NOT NULL AS marketing_ledger,
   to_regclass('public.jenios_email_preferences_b305') IS NOT NULL AS marketing_preferences,
   to_regclass('public.jenios_newsletter_editions_b305') IS NOT NULL AS newsletter_editions,
   to_regclass('public.jenios_resend_webhook_events_b305') IS NOT NULL AS resend_events,
   to_regclass('public.jenios_b305_finance_outbox_recipient_idx') IS NOT NULL AS finance_recipient_index,
   to_regprocedure('public.jenios_claim_transactional_email_b305(integer)') IS NOT NULL AS transactional_claim,
   to_regprocedure('public.jenios_complete_transactional_email_b305(uuid,uuid,text)') IS NOT NULL AS transactional_complete,
   to_regprocedure('public.jenios_claim_dunning_email_b305(integer)') IS NOT NULL AS dunning_claim,
   to_regprocedure('public.jenios_plan_marketing_emails_b305(timestamptz)') IS NOT NULL AS marketing_planner,
   to_regprocedure('public.jenios_claim_marketing_email_b305(integer)') IS NOT NULL AS marketing_claim,
   to_regprocedure('public.jenios_suppress_marketing_email_b305(uuid,uuid,text)') IS NOT NULL AS marketing_suppress,
   to_regprocedure('public.jenios_ingest_resend_suppression_b305(text,text,text,timestamptz,boolean)') IS NOT NULL AS resend_suppression_rpc,
   EXISTS(SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='jenios_learning_state' AND t.tgname='jenios_b305_university_milestones' AND NOT t.tgisinternal) AS university_milestone_trigger,
   EXISTS(SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='jenios_pay_subscriptions' AND t.tgname='jenios_b305_subscription_lifecycle_email' AND NOT t.tgisinternal) AS subscription_lifecycle_trigger
 )
 SELECT jsonb_build_object(
  'financeOutbox',finance_outbox,'transactionalOutbox',transactional_outbox,
  'dunningOutbox',dunning_outbox,'marketingLedger',marketing_ledger,
  'marketingPreferences',marketing_preferences,'newsletterEditions',newsletter_editions,
  'resendEvents',resend_events,'financeRecipientIndex',finance_recipient_index,
  'transactionalClaim',transactional_claim,'transactionalComplete',transactional_complete,
  'dunningClaim',dunning_claim,'marketingPlanner',marketing_planner,
  'marketingClaim',marketing_claim,'marketingSuppress',marketing_suppress,
  'resendSuppressionRpc',resend_suppression_rpc,
  'universityMilestoneTrigger',university_milestone_trigger,
  'subscriptionLifecycleTrigger',subscription_lifecycle_trigger,
  'allRequired',
   finance_outbox AND transactional_outbox AND dunning_outbox AND marketing_ledger
   AND marketing_preferences AND newsletter_editions AND resend_events
   AND finance_recipient_index AND transactional_claim AND transactional_complete
   AND dunning_claim AND marketing_planner AND marketing_claim AND marketing_suppress
   AND resend_suppression_rpc AND university_milestone_trigger AND subscription_lifecycle_trigger
 ) FROM checks;
$$;
REVOKE ALL ON FUNCTION public.jenios_email_preflight_b305() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.jenios_email_preflight_b305() TO service_role;
COMMIT;
