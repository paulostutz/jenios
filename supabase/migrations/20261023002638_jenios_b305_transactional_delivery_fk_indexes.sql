-- B305-R16 — cover transactional outbox foreign keys flagged by DB advisor.
BEGIN;
CREATE INDEX IF NOT EXISTS jenios_b305_transactional_subscription_idx
 ON public.jenios_transactional_email_outbox_b305(subscription_id)
 WHERE subscription_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS jenios_b305_transactional_product_idx
 ON public.jenios_transactional_email_outbox_b305(product_id)
 WHERE product_id IS NOT NULL;
COMMIT;
