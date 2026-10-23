# B305-R16 — Entrega transacional controlada

## Escopo
- fila privada de boas-vindas após confirmação real da conta Social;
- preparação de ativação de plano apenas quando assinatura, pedido pago e entitlement ativo coincidirem;
- entrega da régua D-3, D0, D+1 e D+7 com lease, idempotência e reconciliação;
- nenhum envio direto a partir do Postgres.

## Segurança
- tabelas privadas com RLS e sem políticas de cliente;
- funções de claim/complete/release exclusivas de service_role;
- gatilho de Auth só enfileira contas Social confirmadas;
- ativação de plano falha fechada sem pedido pago + entitlement ativo;
- worker só fica pronto no Preview B305 isolado e exige JENIOS_TRANSACTIONAL_EMAILS_ENABLED=true;
- no ambiente certificado a variável permanece false;
- JENIOS_SUBSCRIPTION_DUNNING_ENABLED também permanece false.

## Estado
A infraestrutura fica pronta para homologação futura. Este bloco não autoriza disparo geral de e-mails, cobranças reais, criação de assinaturas nem cancelamentos reais.
