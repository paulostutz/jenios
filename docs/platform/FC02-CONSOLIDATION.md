# JENIOS FC02 — Candidata integrada e contrato funcional

FC02 reúne código comercial B305/R35, pesquisa dos robôs até R49 e a variante temporal R46. A certificação cobre preservação de fontes, regressão conjunta e build offline. Não comprova execução do núcleo proprietário, comunicação autenticada com corretora, envio de mensagens ou pagamento externo.

## Fontes congeladas

- Produto B305/R35: `c18eec737d67e2e884cbfb81b288f88b9089695c`, CI `39944241706`.
- Robôs R49: backup `backup/jenios-robot-r49-order-reconciliation-races-certified-20261023`, commit `4c21384f1e9a37c4889b2a75731bb702b9aa8dac`, CI `39952770202`.
- Variante R46 temporal: backup `backup/jenios-robot-r46-temporal-lease-certified-20261023`, commit `c31a96aa8c74f9ae4d7818d70af8c10e884d96db`, CI `39950064035`.

O manifesto `evidence/FC02_SOURCE_MANIFEST.json` registra 353 arquivos e hashes originais. O checkpoint R46 da linha R49 fica no caminho original; o da variante temporal fica em `evidence/variants/`. Nenhum dos dois é substituído ou apresentado como sucessor do outro.

A única sobreposição de alterações entre produto e pesquisa era `vercel.json`. A resolução preserva a configuração comercial de cron, reúne os bloqueios de publicação e desativa publicação automática para a candidata e o backup FC02. Os demais arquivos foram incorporados sem modificar o conteúdo certificado. Não foi executado merge em nenhuma branch de origem.

## Inventário do caminho técnico

| Componente | Evidência no código | Estado no FC02 |
| --- | --- | --- |
| APIs internas de conta/conexão | `app/api/platform/broker-connections/` e `lib/platform/connections/demo-http.mjs` | Presentes; preservar autenticação, isolamento e revogação |
| Leitores Binance Testnet e Alpaca Paper | `demo-broker-reader.mjs` | GETs implementados; execução externa não testada neste bloco |
| Mapa de 12 fornecedores | `provider-paths.mjs` e `capabilities.mjs` | 2 leitores demo e 10 guias; guia não equivale a adaptador operacional |
| Vínculo da conta do cliente | `native-broker-bridge.mjs` | Contratos presentes; o transporte genérico continua bloqueado |
| Gateway privado Alpaca Paper | `alpaca-paper-private-executor.mjs` | Código presente, exige risco/diário duráveis, identidade e grant; não invocado pelo FC02 |
| Núcleo original privado | `lib/platform/private-core-bridge.mjs` | Envelope autenticado e hash fixado; retorna `privateCoreLoaded:false` e `runtimeBytesVerified:false`; executável não está neste repositório |
| Robôs R12–R49 | `lib/platform/research/robot-r*.mjs` | Controles de laboratório preservados e testados juntos |
| E-mails B305/R35 | `lib/email/` e rotas internas | Workers já implementados; testes usam transporte substituto, envio real permanece desligado |
| Migrações e templates | `supabase/migrations/` e `supabase/templates/` | Conteúdo da linha comercial preservado; nenhuma aplicação em banco/painel neste bloco |

O modelo é software/robô licenciado com conta do cliente. Não se introduz uma liberação institucional genérica como pré-requisito. O próximo bloco deve identificar e testar o adaptador efetivamente adotado e o núcleo original; não reconstruir todos os conectores do catálogo nem declarar a ponte privada carregada com base apenas em envelopes de teste.

## Responsabilidades funcionais preservadas

- Manual: o cliente decide; observação e alertas são acessórios opcionais.
- Híbrido: assistência ao cliente conforme contrato B291; nenhuma inversão ou migração automática de modo.
- Reverso: tratamento da intenção autorizada do cliente, condicionado a risco e megatendência; a proposta não é recibo de execução.
- UltraFast: controles de microestrutura, dados frescos, leases, reconexão, filas e reconciliação são pesquisa; elegibilidade de plano não habilita transporte.

## Retomada FC03

1. Consultar novamente backups e progresso de outras conversas antes de alterar.
2. Recuperar o executável privado original e sua procedência pelo acervo autorizado, sem publicá-lo no GitHub.
3. Identificar o caminho técnico escolhido pelo produto e produzir um teste de jornada com evidência por evento, dentro do ambiente permitido.
4. R49 já cobre cenários de partial fill e cancel/replace em laboratório; reutilizar os testes.
5. A falta de componente privado ou configuração externa deve ser registrada por dependência; não substituir por implementação fictícia.

A candidata não modifica os planos de produção. Ordens reais, Paper externo, pagamentos e mensagens reais não são executados. `actualBrokerPnl`, `actualLossesAvoided` e `realTradeAccuracy` permanecem null.
