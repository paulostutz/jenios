-- B146: cadastro inicial, sem preço aprovado e sem habilitar vendas.
-- Preserva integralmente qualquer produto que já possua um destes códigos.
INSERT INTO public.jenios_pay_products
 (code, name, category, price_cents, currency, billing_type, active)
VALUES
 ('social-university-pass', 'Universidade JENIOS — 30 dias', 'other', 0, 'BRL', 'one_time', false),
 ('social-ai-pro-credits', 'Créditos Gênio / Gênia Pro', 'other', 0, 'BRL', 'one_time', false)
ON CONFLICT (code) DO NOTHING;
