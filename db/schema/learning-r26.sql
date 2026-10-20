-- JENIOS R26: referência da migração jenios_learning_state_r26.
-- Aplicada em 16/10/2026 ao projeto igayfjorjmucthlfoasf e verificada.
-- NÃO executar novamente no mesmo banco; verificar existência/estrutura primeiro.
-- Somente esta tabela nova foi criada. Nenhuma tabela preexistente foi alterada.
BEGIN;
CREATE TABLE public.jenios_learning_state (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 revision bigint NOT NULL DEFAULT 0 CHECK (revision >= 0),
 state jsonb NOT NULL CHECK (jsonb_typeof(state) = 'object' AND octet_length(state::text) <= 262144),
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.jenios_learning_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.jenios_learning_state FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jenios_learning_state TO service_role;
COMMENT ON TABLE public.jenios_learning_state IS 'JENIOS R26: educational progress only. Server-authorized subscription and owner checks; no direct client grading or financial execution.';
COMMIT;
-- Verificação pós-aplicação (sem dados pessoais):
SELECT relrowsecurity FROM pg_class WHERE oid = 'public.jenios_learning_state'::regclass;
SELECT has_table_privilege('authenticated','public.jenios_learning_state','UPDATE') AS client_can_grade,
       has_table_privilege('anon','public.jenios_learning_state','SELECT') AS public_can_read;