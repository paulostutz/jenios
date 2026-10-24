-- B305-R31 — cover finance outbox recipient FK flagged by Supabase advisor.
BEGIN;
CREATE INDEX IF NOT EXISTS jenios_b305_finance_outbox_recipient_idx
 ON public.jenios_pay_email_outbox_b305(recipient_user_id)
 WHERE recipient_user_id IS NOT NULL;
COMMIT;
