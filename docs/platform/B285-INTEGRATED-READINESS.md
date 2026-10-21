# JENIOS B285 — Homologação integrada, primeira verificação
Base: B284 b5ee815680065c538c7429bc465b7e6ec8ec39f3, CI 39645250773 SUCCESS. Produção B177-R3 preservada.

## Resultado da auditoria inicial
1. Gênio/Gênia: endpoints públicos, política de planos e fallback guiado presentes. A IA generativa real exige credenciais e orçamento configurados; não foi testada com provedor externo.
2. Acesso Pro: checagem de assinaturas no servidor, planos superiores e bloqueio de crédito avulso presentes. Falta teste ponta a ponta com identidade e assinatura confirmada em Preview.
3. Banco Inter: formulário, validação ZIP, RPC de cofre e consulta de leitura presentes. Não foram fornecidas credenciais reais. Teste mTLS e conciliação bancária real pendentes.
4. Checkout: o código ainda bloqueia scope diferente de Social para provider inter_pix; não liberar mensalidade até ciclo de confirmação e provisionamento verificado. Nunca simular confirmação de pagamento como real.
5. Vercel: o projeto jenios-ecossistem permanece em produção B177-R3; a última prévia consultada estava ERROR, exigindo investigação e release Preview protegido.
6. Universidade e Social: regressões B284 aprovadas; aceite real de conta, permissões e assinatura em Preview ainda pendente.

## Critérios para promover B285 a homologado
- Autenticação de usuário e Master, com negativas de privilégios;
- IA generativa em sandbox, sem ordens, com limite de custo, fallback e consentimento;
- ZIP de certificado e credenciais bancárias reais inseridos exclusivamente pelo Master, teste somente leitura e sem criar cobrança;
- Checkout mensal de ponta a ponta em ambiente bancário autorizado: pedido, Pix identificado, confirmação assinada/consultada, concessão, expiração, cancelamento, duplicidade e recuperação de falhas;
- Controles de acesso Pro por assinatura ativa, vencida, sem plano e Nacional;
- Teste de navegador responsivo da Social, LP, Platform e Universidade, e correção da proteção Preview sem enfraquecer produção;
- CI geral, evidências, backups e rollback.

## Status
B285 = candidato de auditoria; **não homologado integralmente**. Nenhum deploy, ordem ou cobrança. A liberação comercial depende dos testes externos e aceite explícito.
