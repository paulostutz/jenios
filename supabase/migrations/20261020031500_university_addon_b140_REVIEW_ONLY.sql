-- B140 University access product (REVIEW ONLY). No unapproved price or active checkout.
BEGIN;
INSERT INTO public.jenios_pay_products
 (code,name,category,description,price_cents,currency,billing_type,active)
 VALUES('social-university-pass','Universidade JENIOS — 30 dias','other',
 'Acesso independente a aulas, exercícios, revisões e avaliações durante 30 dias.',0,'BRL','one_time',false)
 ON CONFLICT(code) DO NOTHING;
COMMIT;