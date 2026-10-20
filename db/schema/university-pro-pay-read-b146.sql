-- B146: leitura mínima para verificar a assinatura e o período de elegibilidade.
GRANT SELECT (id, user_id, product_id, status, current_period_start, current_period_end, created_at)
ON public.jenios_pay_subscriptions TO service_role;
