-- B305-R13 — indexes for dunning outbox foreign keys identified by QA advisor.
CREATE INDEX IF NOT EXISTS jenios_b305_dunning_user_idx
 ON public.jenios_subscription_dunning_outbox_b305(user_id);
CREATE INDEX IF NOT EXISTS jenios_b305_dunning_product_idx
 ON public.jenios_subscription_dunning_outbox_b305(product_id);
