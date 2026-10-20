-- Reviewed additive schema; service-only access through authenticated, owner-scoped APIs.
-- Do not recreate on an existing environment; verify first.
BEGIN;
CREATE TABLE public.jenios_assistant_state (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 revision bigint NOT NULL DEFAULT 0 CHECK (revision >= 0 AND revision < 9007199254740991),
 state jsonb NOT NULL CHECK (jsonb_typeof(state) = 'object' AND octet_length(state::text) <= 16384),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.jenios_assistant_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.jenios_assistant_state FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jenios_assistant_state TO service_role;
COMMENT ON TABLE public.jenios_assistant_state IS 'Assistant preferences and bounded usage counters. No conversation text, reports, secrets, orders or payment changes.';
COMMIT;