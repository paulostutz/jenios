-- B147: restore the exact B143 service-role table contract after inherited defaults.
-- Explicitly scoped to these nine private Pro tables; no data or flags are changed.
-- REVOKE ALL also removes version-specific privileges such as PostgreSQL 17 MAINTAIN.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='20s';

REVOKE ALL ON TABLE
 public.jenios_pro_config_b143,
 public.jenios_pro_wallets_b143,
 public.jenios_pro_periods_b143,
 public.jenios_pro_budgets_b143,
 public.jenios_pro_requests_b143,
 public.jenios_pro_events_b143,
 public.jenios_pro_quotes_b143,
 public.jenios_pro_quote_orders_b143,
 public.jenios_pro_funding_b143
FROM service_role;

GRANT SELECT,INSERT,UPDATE ON TABLE
 public.jenios_pro_config_b143,
 public.jenios_pro_wallets_b143,
 public.jenios_pro_periods_b143,
 public.jenios_pro_budgets_b143,
 public.jenios_pro_requests_b143
TO service_role;

GRANT SELECT,INSERT ON TABLE
 public.jenios_pro_events_b143,
 public.jenios_pro_quotes_b143,
 public.jenios_pro_quote_orders_b143,
 public.jenios_pro_funding_b143
TO service_role;

COMMIT;
