# JENIOS R75.001 — Reconciliação de backups e estado operacional

Data: 26/10/2026, horário de Brasília (UTC-3). Escopo: **somente JENIOS**.

## Política de preservação e objetivo

O titular confirmou que a JENIOS licencia **robôs de trade**. Cada usuário negocia com os recursos mantidos em sua própria conta de corretora, usando a API/terminal oficial que sua conta permite. **A JENIOS não recebe depósitos, não mantém custódia, não executa saques e não transfere capital do cliente**. Integração técnica via API não pressupõe convênio comercial global com cada corretora; determinados meios (OAuth de terceiro, licença de terminal ou plataforma) podem exigir cadastro ou habilitação específica. Nunca tratar guia como autorização de negociação.

**Instrução permanente:** conservar checkpoints imutáveis, backup por bloco, commit por alteração, CI, verificação da versão publicada e rollback. Não reconstruir motores privados ou alterar projetos CHEFE/LETTER. Nunca publicar antes de certificar a alteração. Todos os gates financeiros/operacionais permanecem desligados durante esta fase de recuperação.

## Base verificada nesta retomada

- Repositório `paulostutz/jenios`, branch efetiva `release/jenios-genios-g44-20261024`, SHA exato `2ee913339d01c7c20e4d837867f10d3258bc8dcc`; não usar `main` como base ativa.
- Vercel `jenios-ecossistem` deployment `dpl_2XrnctiXtkSfXwWDxekfme95JMK2` em READY. `www.jenios.com.br` retorna HTML do mesmo deployment. Publicação G49 atual **não** comprova execução live.
- Em produção, `GET /api/platform/broker-readiness` retorna `credentialsAccepted:false`, `accountAuthenticated:false`, `demoOrdersCertified:false`, `realOrdersEnabled:false`. `GET /api/platform/broker-providers` retorna `realOrderExecution:false`. São resultados reais do runtime, não inferências da documentação.
- Banco Supabase exclusivo da Platform `xaicvhagftzjkqphnbgx`: 0 vínculos em `public.jenios_platform_demo_broker_connections`.
- Runtime R74: Edge Functions `jenios-r74-private-host` e `jenios-r74-private-runtime` instaladas e ativas. Host `READY`, heartbeat verificado em 27/10/2026 01:50 UTC, `engine_sha256=9341d9243cbe742b90bf40149663e632fc472f5586c74bf70bdfcfd114e65aea`, `service_sha256=cbb92005459f79bf6e23a0edc7c5542cc62b632b6c301e3f23b98ebd514ce5be`. Os dois hashes **coincidem** com o checkpoint privado original R74 na Biblioteca.
- O runtime hospedado R74 produz ciclos `SYNTHETIC_CYCLE`; seu código marca `syntheticOnly:true`, `executionEnabled:false`, `networkCalls:0`, `customerMonitoringActive:false`. Banco: `live_execution_enabled:false`, `customer_monitoring_active:false`, `real_orders_sent:0`, `external_paper_orders_sent:0`.
- R74 original em `/JENIOS/Checkpoints/R74/JENIOS_R74_RELATORIO_20261025.md` anotou runtime e scheduler **não instalados naquele instante** por segurança do conector. O estado **mais recente e diretamente verificado** mostra as Edge Functions instaladas, núcleo com hashes correspondentes e ciclos sintéticos contínuos. Portanto **não refazer o R74** e não apagar o registro histórico.
- Os arquivos privados `/JENIOS/Checkpoints/R74/PrivateRuntime` existem na Biblioteca, incluindo engine, service, index e identidade. Não copiar o núcleo, token ou chave privada para GitHub público, logs, chat ou cliente.
- Pipeline nativo M02 `https://github.com/paulostutz/jenios/actions/runs/40155630492` passou iOS/Android com arquivos de desenvolvimento **unsigned**. A publicação web/PWA `/mobile.html` foi verificada; publicação TestFlight/loja não foi estabelecida por esse workflow.
- PAY `/api/jenios-pay/health` respondeu `paymentsEnabled:false`; nenhuma cobrança deve ser ligada como efeito desta retomada.

## Backups consultados e função de cada bloco

1. `/JENIOS/Checkpoints/B174/JENIOS_B174_RELATORIO_FINAL_20261020.md`: arquitetura **sem custódia**, 12 fornecedores, corretora oficial, conta própria do cliente, acesso estrito por identidade e proposta Alpaca Paper; **não envia** Paper/Live.
2. `/JENIOS/Checkpoints/B189/JENIOS_B189_CHECKPOINT_20261020.md`: risk gates B185–B189 e CI `39510764146` 1.180 testes gerais + 94 Social, evidência sintética, nenhuma ordem externa.
3. `/JENIOS/Checkpoints/B216-B230/JENIOS_B216_B230_RELATORIO_FINAL_20261021.md`: commit `162b256ecebfb7895aa1ca1e4256c93df938a9a0`, CI `39527691673` com 1.343 gerais, 94 Social, 47 novos; guias oficiais e contratos offline, **nenhuma ordem externa homologada**.
4. `/JENIOS/Checkpoints/R74/JENIOS_R74_CHECKPOINT_20261025.json`: SHA-256 do núcleo privado, limites e registro de implantação daquele momento. Atualizado por evidência do runtime corrente, sem mexer no backup original.
5. Git branches `backup/jenios-robot-block-a-r51-r55-final-ultrafast-certified-20261023`, `backup/jenios-robot-block-b-r56-r58-assisted-modes-final-certified-20261023`, `backup/jenios-robot-r60-operational-closeout-certified-20261024` e `backup/jenios-robot-r64-operational-integration-certified-20261024` até `backup/jenios-robot-r73-definitive-app-published-20261024`. Preservar esses marcos; a existência da branch não certifica Live.
6. Código público atual: `lib/platform/connections/native-broker-bridge.mjs` contém `submitNativeBrokerOrder` e `submitRealBrokerOrder` que retornam erros intencionais; `broker-readiness` é puramente informacional. R74 privado não implementa transmissão de ordens.

## Fato vs. hipótese

**Homologado e preservado:** núcleo original com hashes, análise sintética R74 contínua, contratos de risco e integração sem custódia, CI históricas de simulação, interfaces publicadas G49, geração de builds unsigned M02.

**Ainda não homologado:** conta real por usuário autenticada em corretora, permissões comerciais/técnicas de negociação, adaptador executor oficial com reconciliação externa, ordem Paper externa com recibo, testes de posições e stops reais, execução Live, monitoramento adaptativo efetivo de clientes, TestFlight externo/loja da versão R75.

Nenhuma evidência de teste local/backtest/CI deve ser apresentada como lucro real, certificação de corretora ou execução Live. Não mudar flags para `true` artificialmente.

## Próximos blocos sem duplicação

- R75.002: inventariar os contratos privados e públicos existentes, matriz de reuso versus lacunas por corretora; recuperar artefatos de backup em vez de reimplementar.
- R75.003: adaptador da primeira integração oficial em **Paper/Testnet** usando conta autenticada com consentimento, idempotência e reconciliação, inicialmente em ambiente isolado e sem exposição pública.
- R75.004: testes de limites de risco, pausas de emergência, replay/restart/timeout/duplicidade e isolamento por usuário, com auditoria independente.
- R75.005: somente após critérios de aceite, publicar site, atualizar build iOS/Android e testar nos aparelhos. Habilitação Live será independente, por conta, mercado e limites definidos pelo titular.

## Auditoria deste commit

Este arquivo é **checkpoint de recuperação**, não altera código executável, dados, secrets, flags, cron, pagamentos, robôs, App Store Connect, Vercel nem Supabase. Foi criado numa branch isolada derivada do SHA exato acima. Próximas mudanças devem registrar SHA/CI/checksum/rollback em checkpoints próprios.
