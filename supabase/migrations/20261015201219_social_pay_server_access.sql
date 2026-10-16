-- Restore backend access only; browser grants and RLS stay unchanged.
grant select,insert,update on public.jenios_pay_products,public.jenios_pay_orders to service_role;
grant select on public.jenios_pay_entitlements,public.jenios_pay_payments to service_role;
insert into public.jenios_pay_products(code,name,category,description,price_cents,currency,billing_type,active) values
('social-bankscore-report','BankScore — laudo de capitalização','bankscore','Laudo do indicador disponível, interpretação e histórico em PDF.',990,'BRL','one_time',true),
('social-crypto-validator','Validador de Criptos — consulta detalhada','crypto_validator','Consulta detalhada e relatório em PDF.',990,'BRL','one_time',true),
('social-boost','Impulsionamento','ads','Orçamento calculado pelo servidor.',0,'BRL','one_time',true),
('social-specialist-offer','Serviço de Especialista','other','Preço da oferta. Comissão JENIOS de 10%.',0,'BRL','one_time',true)
on conflict (code) do nothing;
