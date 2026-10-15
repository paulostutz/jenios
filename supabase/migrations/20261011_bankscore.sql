CREATE TABLE IF NOT EXISTS public.bankscore_instituicoes (
  codigo TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  conglomerado TEXT,
  situacao TEXT,
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.bankscore_indicadores (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo_instituicao TEXT NOT NULL,
  periodo INTEGER NOT NULL,
  tipo_instituicao INTEGER NOT NULL,
  codigo_indicador TEXT NOT NULL,
  nome_indicador TEXT NOT NULL,
  valor_bruto DOUBLE PRECISION,
  fonte TEXT NOT NULL DEFAULT 'BACEN_IFDATA',
  atualizado_em TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (
    codigo_instituicao,
    periodo,
    tipo_instituicao,
    codigo_indicador
  )
);

CREATE INDEX IF NOT EXISTS idx_bankscore_periodo
ON public.bankscore_indicadores(periodo);

CREATE INDEX IF NOT EXISTS idx_bankscore_codigo
ON public.bankscore_indicadores(codigo_instituicao);

ALTER TABLE public.bankscore_instituicoes
ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.bankscore_indicadores
ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.bankscore_instituicoes TO anon, authenticated;
GRANT SELECT ON public.bankscore_indicadores TO anon, authenticated;

DROP POLICY IF EXISTS "Leitura publica BankScore instituicoes"
ON public.bankscore_instituicoes;

CREATE POLICY "Leitura publica BankScore instituicoes"
ON public.bankscore_instituicoes
FOR SELECT TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Leitura publica BankScore indicadores"
ON public.bankscore_indicadores;

CREATE POLICY "Leitura publica BankScore indicadores"
ON public.bankscore_indicadores
FOR SELECT TO anon, authenticated
USING (true);
