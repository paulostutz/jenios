# JENIOS B285-R2 — Homologação interna consolidada
Base certificada B285: 7aefd877d78a7eb0c4899a582e62206653990f3d, CI 39646660619 SUCCESS. Branch isolada: fix/jenios-b285-r2-integrated-sandbox-20261021.

## Escopo solicitado
Concluir internamente os pontos 3 (assinaturas), 4 (Gênios), 5 (permissões) e 6 (testes integrados). **Pontos 1 e 2 — credenciais reais Banco Inter e cobrança/conciliação — expressamente adiados pelo usuário.** Nenhuma migração de produção, banco de dados financeiro, ordem ou cobrança real.

## Entregas
- Máquina de estados determinística **somente em memória**: solicitação, confirmação sintética, renovação, suspensão, retomada, cancelamento, reembolso e expiração. Idempotência, recusa de eventos fora de ordem, usuário/assinatura/plano cruzados, preços/códigos desconhecidos e recibos de provedor.
- Projeção de permissões reutilizando `classifyVerifiedPlan` e `proPlanAccess`, sem criar assinaturas nem entitlements. Nacional R$99,90 não inclui Pro; Global Crypto R$149,90 e Internacional Pro R$199,90 incluem recursos avançados **somente se um plano real ativo for verificado pelo sistema existente**.
- Verificações integradas dos Gênios na Social, LP e Platform; IA generativa externa **não chamada**, fallback gratuito testado; nenhuma venda de tokens avulsos.
- Universidade e sessões mantidas sem alterações, com smoke de navegador herdado B284.
- Checkout da Platform mantém bloqueio Inter Pix para mensalidades e `subscriptionLifecycleReady` exigido. **Não foi liberada cobrança por evento sintético**.

## Critérios de aceite e limitações
Testes sintéticos não comprovam login comercial real, confirmação bancária, IA generativa de provedor externo nem permissões no Preview. O banco Social de homologação não tem todas as tabelas financeiras de assinaturas; não criar dados artificiais para contornar esse bloqueio. A configuração real da IA exige autorização de orçamento e credenciais próprias. Vercel Preview apresenta falha de build/proteção que precisa ser diagnosticada antes do aceite visual autenticado; a CI de código não é um deploy.

## Homologação
Executar teste de ciclo B285-R2, testes anteriores de plano, Gênios, Universidade, segurança e regressão geral, build Next.js e navegador localhost, sem provedores externos. Registrar falhas explicitamente e criar backup individual. Produção B177-R3 permanece intocada.

## Status esperado
Código e fluxos sintéticos: certificáveis por CI. Homologação comercial e autenticação real em Preview: **pendentes**. Não declarar B285 integralmente pronto para lançamento até o ciclo financeiro externo e a integração final.
