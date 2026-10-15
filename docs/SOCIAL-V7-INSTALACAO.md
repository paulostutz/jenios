# Instalação consolidada da Social V7 — preparação, ainda não liberação final

Branch: jenios-v7-homologacao. Preservar main, Vercel de produção e banco original. Não copiar arquivos .env para o repositório, ZIP ou conversa. Usar ambiente de homologação isolado para instalar e testar; não presumir que uma branch Git cria isolamento no Supabase.

## Conferência única

Após configurar credenciais no ambiente local de homologação:

```bash
npm ci
node scripts/check-social-installation.mjs
```

O comando lê variáveis pelo mecanismo existente do Next e inspeciona apenas estruturas e buckets. Não migra, cadastra preços, concede acesso, chama gateway ou cobra. Mostra nomes das verificações e estados sem imprimir credenciais, dados dos usuários ou erros brutos. Código de saída 1 significa pendência de configuração/estrutura; saída 0 não significa homologação funcional. Não executar setup de mídia até confirmar o projeto de destino.

## Ordem de ativação em homologação

1. Conferir as estruturas existentes e as migrações já instaladas. Não reaplicar migração a uma tabela existente, não renomear tabelas para contornar conflito e não criar cópias de pedidos/produtos/pagamentos.
2. Para atendimentos, instalar a migração revisada supabase/migrations/20261015000628_specialist_order_fulfillment.sql somente quando a extensão não existir. Para campanhas, idem supabase/migrations/20261015001833_boost_campaign_delivery.sql. Usar o mecanismo de migração do projeto. Elas acrescentam somente extensões dos serviços, sem reconstruir PAY. Em instalação parcial, conferir diferenças antes de continuar.
3. Conferir RLS e grants: participantes leem próprios atendimentos; anunciante lê próprias campanhas; eventos não têm leitura direta de clientes. RPCs de serviço são SECURITY INVOKER e restritas ao backend. Não invocar RPCs de transição como teste de presença: isso pode alterar serviços reais.
4. Configurar JENIOS_SPECIALIST_ORDERS_ENABLED, JENIOS_BOOST_CAMPAIGNS_ENABLED, JENIOS_BOOST_SIGNING_SECRET e NEXT_PUBLIC_SOCIAL_PROMOTIONS_ENABLED conforme docs/JENIOS-PAY-CONEXAO.md. Não habilitar antes de validar a instalação.
5. Para armazenamento remoto, conferir SOCIAL_MEDIA_BUCKET e usar scripts/setup-social-media.mjs somente no destino de homologação escolhido; o comando pode criar bucket público. Configurar NEXT_PUBLIC_SOCIAL_REMOTE_MEDIA_ENABLED e reconstruir. Não usar esse bucket para anexos privados.
6. Compatibilizar o adaptador com o endpoint PAY existente, mantendo idempotência e confirmação somente no backend. Preços fixos aprovados no catálogo: BankScore e Validador R$9,90. Impulsionamento segue orçamento escolhido pelo cliente. Especialistas seguem preço da oferta e comissão de 10%. Admin usa autorização real; não usar login demonstrativo para liberar cobrança.
7. Gerar build e executar scripts/test-finance-http.mjs contra o servidor iniciado. Testes de navegador scripts/test-social-ui.mjs e scripts/test-finance-ui.mjs exigem Chromium disponível; nesta sessão continuam não executados. Validar duas contas para autoria, isolamento, contratação, entrega e campanhas. Não editar pedido para paid para simular confirmação.

## Requisitos que configuração não resolve

- BankScore completo depende de base e metodologia; catálogo bloqueia nova venda enquanto não houver entrega completa. Preservar histórico de pedidos existentes.
- Radar de pools recentes não comprova criação do token ou carteira institucional. Hub é o mesmo componente na página e dentro da Social; dados B3/baleias ainda precisam de fonte.
- Validador atual não inventaria todos os tokens de uma carteira; não anunciar essa cobertura como entregue.
- Recorrência da Platform é separada da Social. Os preços mensais R$99,90 / R$149,90 / R$199,90 não representam recorrência implementada.
- Feed original mantém persistência legada; não presumir compartilhamento entre dispositivos por habilitar uma flag de mídia. Preview compartilhado é separado e opcional.

Somente depois de resolver os requisitos funcionais e validar instalação será emitido um único pacote final, com código completo e comandos para Mac/VS Code. Este documento é continuidade interna, não orientação para promover o estado atual à produção.
