# R127 — Inventário de conexões e persistência Profit

Data: 10/11/2026. Candidata isolada, sem publicação, credenciais ou ordens externas.

## Escopo vigente

Cada cliente conecta sua própria conta para usar o Ultra na JENIOS ou na Flow. Mini índice, mini dólar e cripto são os mercados solicitados; futuros dependem das permissões do produto, conta e regras aplicáveis. A integração à Exchange Kivoryn fica para uma etapa posterior. A descrição de conta central em `R125-ACCOUNT-MODEL.md` é evidência histórica superada pela instrução atual e não deve orientar a implementação desta frente.

Esta revisão não altera mensalidade, Start, performance, consolidação mensal, API do servidor ou interface. Não cria um ledger financeiro paralelo. Não procura, recebe nem usa credenciais reais, tampouco permissões de saque.

## Inventário observado no código

| Provedor/caminho | Componentes existentes examinados | O que está implementado | Limite da evidência |
| --- | --- | --- | --- |
| Binance USDⓈ-M — consulta | `lib/platform/ultra/client/binance-collector.mjs` | Coletor REST somente GET; confere referências explícitas de ordem, histórico de trades, comissões por ativo e contexto de posição/funding; identidade por fingerprint da chave. | O código tem caminhos demo/live de leitura, mas nenhum foi acionado nesta entrega. Fingerprint de chave não é UID confirmado da conta. Funding do símbolo não é automaticamente lucro/custo do Ultra. |
| Binance Spot/futuros — protocolo | `binance-spot-protocol-r119.mjs`, `binance-futures-protocol-r119.mjs`, `binance-futures-preflight-r119.mjs` | Descritores sem assinatura para intenção, proteção, consulta, cancelamento e fechamento; normalização de respostas e classificação de estados. | Descritor não executa ordem e não instala proteção. Não comprova elegibilidade da conta. |
| Binance — persistência e eventos | `binance-action-journal-r119.mjs`, `binance-durable-adapter-r119.mjs`, `binance-protocol-sandbox-r119.mjs`, módulos `binance-*-r120.mjs` | Journal sobre ExecutionLedger, adaptador limitado ao sandbox em memória, autenticação fictícia, normalização de eventos e inbox. | O adaptador exige instância do sandbox. Não há evidência nova de API testnet ou execução nativa; assinaturas fictícias não são autenticação de corretora. |
| Genial/MT5 — consulta | `mt5-r118-adapter.mjs`, coletores R117/R118 Python, `mt5_readiness_r125.py`, `R125-GENIAL-MT5.md` | Ponte/coleta local e diagnóstico de leitura para nomes explícitos WIN/WDO; inspeção de conta, terminal e instrumentos. | Não executados aqui. O diagnóstico R125 mantém `canStart=false` e `executionAvailable=false`. A rota Python/terminal é distinta de EA MQL5 e de ProfitDLL. |
| Genial — cripto | Guias e inventário documental | O produto cripto da Genial está descrito oficialmente pelo app. | API de negociação cripto apropriada ao Ultra não comprovada no material examinado. Não se conclui que a Genial não tenha APIs. Binance permanece alternativa. |
| Profit — protocolo R109 | `lib/platform/connections/profit-protocol-r109.mjs` recuperado da candidata `origin/work/jenios-r109-profit-adapter-20261028` | Tradução de decisão final, seleção explícita de conta, Int64 em strings, diferenciação LocalOrderID/ClOrderID, recibos locais, consulta GetOrderDetails e estados de conexão. | Importado byte a byte, sem modificar o original. É protocolo sem DLL, transporte, credenciais, licença ou autorização de conta. |
| Profit — delta R127 | `lib/platform/ultra/client/profit-order-journal-r127.mjs` | Correlação persistente no banco já existente, sessão/IDs, observações fictícias, recuperação e comandos vinculados. | Somente `offline_fixture`, com vínculo `profit/demo`; não é um executor nem habilita envio nativo. |

Os guias antigos de `provider-paths.mjs` são metadados de orientação, não evidência de conectividade. Em particular, sua indicação genérica Genial/Profit não invalida a rota MT5 examinada em R125. Nenhuma tela ou documentação comercial foi contada como ordem executada.

## Delta efetivamente implementado

`ProfitOrderJournalR127` compõe o `ExecutionLedger` e usa a transação, lease e SQLite existentes. Acrescenta tabelas com prefixo `ultra_profit_r127_` para correlações e evidências. `OperationLedger` e `ExecutionLedger` originais permanecem sem alteração nesta frente.

O vínculo durável contém operação Ultra original, conta da corretora selecionada, ambiente, instrumento, direção, quantidade, comando existente quando aplicável, sessão de ponte, LocalOrderID e ClOrderID. Números nativos Int64 são mantidos em strings. IDs locais não podem ser compartilhados por duas operações na mesma sessão; o identificador permanente também não pode ser atribuído a duas operações. A direção original é preservada e a quantidade/preço limite devem corresponder à intenção existente. O fechamento exige o comando durável já criado e não pode exceder a exposição conhecida.

Antes de uma tentativa fictícia, a intenção e a transição de envio são persistidas. Um retorno local positivo registra apenas aceite local. Para cancelamento, retorno zero também é apenas aceite do pedido. Nenhum desses eventos cria fill, resultado, cancelamento confirmado ou operação encerrada. Resposta ausente mantém estado desconhecido e não habilita retry automático.

Observações de detalhes conferem conta, instrumento, lado, quantidade, ID, sessão, cronologia e quantidade acumulada. Evidências repetidas são idempotentes; uma evidência com o mesmo ID e conteúdo diferente é recusada. Regressões de quantidade e reabertura de estado terminal são recusadas. Estados UNKNOWN/PENDING e qualquer observação R109 com `independentReconciliationRequired=true` mantêm o bloqueio de novas aberturas e a necessidade de consulta, mesmo com a evidência já persistida. A prova é marcada como `offline_fixture_query`, sem alegação de autenticidade nativa.

Após reinício, uma sessão nova não reutiliza LocalOrderID da sessão anterior. Se ClOrderID já foi obtido, ele permite preparar referência de consulta/cancelamento; a consulta atual ainda é necessária. Se o ID permanente nunca foi recebido, a associação permanece pendente em vez de adotar uma ordem parecida. Reutilizar o identificador de sessão de outro processo é recusado. Intenções que não chegaram à tentativa são marcadas como não enviadas e não reaplicadas.

Uma sessão nova pausa novas aberturas. O próprio journal impede nova entrada enquanto existirem ações com resultado desconhecido ou sem consulta da sessão atual, inclusive se um chamador invocar o `resume` genérico. Cancelamento de ordem conhecida e preparação de fechamento de exposição reconciliada continuam disponíveis durante a pausa; nenhum comando é transmitido.

Um cancelamento parcial encerra somente a ordem/remanescente observado. Os contratos executados continuam sendo exposição. O journal conserva essa diferença e não altera quantidades, P&L ou estado financeiro da operação a partir dos detalhes incompletos do R109. Imediatamente antes de marcar uma tentativa de fechamento, reconfere revisão e quantidades da operação, estado/conteúdo do comando, exposição remanescente e cancelamento do remanescente da entrada quando exigido. Uma alteração desde a preparação exige conciliação e impede a tentativa com dados antigos; cancelamentos e reduções com base atual continuam permitidos durante a pausa.

## Interface para as frentes runtime e registros

Construção:

`new ProfitOrderJournalR127({ledger, binding, selectedAccount})`

`ledger` é o ExecutionLedger existente ou subclasse. `binding` deve corresponder exatamente ao vínculo local já usado no ledger, com provedor Profit e ambiente demo. `selectedAccount` é a conta explicitamente selecionada, incluindo corretora e subconta quando houver. Esse matching não comprova titularidade ou licença.

| Método | Responsabilidade |
| --- | --- |
| `startSession(sessionId, now)` | Registrar sessão distinta, invalidar a retomada implícita e preservar correlação histórica. |
| `prepare({operationId, role, instrument, order, commandId}, now)` | Vincular entrada ou fechamento fictício à intenção/comando já existente. `role` é `entry` ou `close`; o modo é `ultrafast`. |
| `markSending(actionId, now)` | Persistir tentativa de fixture; exige lease recente e metadados ainda válidos. |
| `recordLocalReceipt(actionId, value, now)` | Registrar o retorno local sem inferir execução. |
| `observeOrderDetails(actionId, {evidenceId, observation}, now)` | Validar e persistir consulta fictícia de detalhes com a lógica R109. |
| `reference(actionId)` / `cancelDraft(actionId)` | Obter referência do pedido conhecido, sem fallback global. |
| `prepareCancellation({actionId, commandId}, now)` | Vincular cancelamento ao comando existente de cancelamento e à ordem própria. |
| `recoveryStatus()` / `audit()` | Expor pendências e trilha da qualificação offline. |

Todos os resultados mantêm `canSubmit=false`, `automaticResubmitAllowed=false`, `nativeValidated=false`, `realOrdersSent=0`, `financialReceiptReady=false` e `operationCompleted=false`. Não há método de transporte, saque ou autenticação nativa.

**Limite deliberado para o relatório:** os detalhes R109 usados aqui não contêm preços médios, timestamps de cada negócio, custos completos, atribuição de posição ou comprovação de proteção. Por isso, o delta não fabrica um `ExecutionLedger.applyReceipt`. Uma futura integração precisa obter essas provas separadamente e passar pelo contrato financeiro existente. As quantidades observadas deste journal não são receita, lucro realizado nem fato gerador de Start/performance. A frente de registros recebe apenas o que seu contrato exigir como confirmado; custos desconhecidos continuam pendentes.

## Fontes oficiais e consequências

Consultadas em 10/11/2026. Disponibilidade de documentação não equivale a validação da conta ou do Ultra.

### Profit

- [Automação de Estratégias](https://ajuda.nelogica.com.br/hc/pt-br/articles/8865257831195-Como-utilizar-a-Automa%C3%A7%C3%A3o-de-Estrat%C3%A9gias): Profit Pro/Ultra permitem automação no simulador; operar conta real requer o módulo correspondente. O processo funciona no Desktop Windows e depende do ambiente local estar ativo.
- [Licenças e limites de Automação](https://ajuda.nelogica.com.br/hc/pt-br/articles/8864900151451-Como-contratar-o-m%C3%B3dulo-Automa%C3%A7%C3%A3o-de-Estrat%C3%A9gias): os planos têm limites de exposição, inclusive WIN/WDO. Não presumir plano ilimitado.
- [ProfitDLL e primeiros passos](https://ajuda.nelogica.com.br/hc/pt-br/articles/22396517026203-Ecossistema-ProfitDLL-e-primeiros-passos): a DLL é uma rota separada, com Market Data ou Market Data + Roteamento, sujeita à licença e à habilitação da conta.
- [Acesso à ProfitDLL](https://ajuda.nelogica.com.br/hc/pt-br/articles/51583791325211-Como-obter-acesso-%C3%A0-ProfitDLL): arquivos e manual são disponibilizados após contratação. A licença do Profit não prova contratação da DLL.
- [Roteamento de ordens](https://ajuda.nelogica.com.br/hc/pt-br/articles/13312468554651-Como-rotear-ordens-com-a-ProfitDLL): retorno síncrono não confirma execução; callbacks/consultas trazem o resultado. LocalOrderID é da sessão; ClOrderID é permanente. Essa distinção motivou a correlação persistente R127.

### Genial

- [Cripto no aplicativo](https://suporte.genialinvestimentos.com.br/hc/pt-br/articles/40445609987092-Como-%C3%A9-poss%C3%ADvel-negociar-Criptoativo-na-Genial): descreve execução pelo app, sem agendamento de preços ou stops nesse fluxo. Não é contrato de API para robôs.
- [Genial as a Service](https://lp.genialinvestimentos.com.br/genial-as-a-service/): comprova oferta corporativa de APIs, mas a página não fornece evidência de endpoint cripto de negociação habilitado para este projeto.
- [Robôs MT5](https://suporte.genialinvestimentos.com.br/hc/pt-br/articles/360055400032-Que-tipo-de-rob%C3%B4-eu-posso-usar-para-operar-no-MetaTrader-5) e [MT5 Genial](https://suporte.genialinvestimentos.com.br/hc/pt-br/articles/360047237751-Como-funciona-a-plataforma-MetaTrader-5): referências preservadas do diagnóstico R125; não constituem homologação do conector local.

### Binance

- [REST Spot](https://developers.binance.com/en/docs/products/spot/rest-api): timeout/5xx podem ter resultado incerto; consultar a ordem antes de repetir. `TRADE` e `USER_DATA` são escopos de negociação/consulta, sem necessidade de permissão de saque.
- [Operações Spot](https://developers.binance.com/en/docs/catalog/core-trading-spot-trading/api/rest-api/trade): `newClientOrderId` pode ser reutilizado após execução da ordem anterior; sozinho não resolve idempotência durável. `order/test` não envia ao matching engine.
- [Spot Testnet](https://developers.binance.com/en/docs/products/spot/testnet/rest-api): ambiente próprio de demonstração. Não foi acessado nesta entrega.
- [USDⓈ-M](https://developers.binance.com/en/docs/products/derivatives-trading-usds-futures/general-info): demonstração atualmente documentada em `https://demo-fapi.binance.com` e `wss://demo-fstream.binance.com`. Variantes de HTTP 503 têm significados diferentes; resultado desconhecido exige consulta antes de repetição. O coletor existente já usa a origem demo-fapi.

## Validação realizada nesta frente

Comando local, sem rede e sem necessidade de checkout Git para executar:

`node --test tests/platformUltraR127Profit.test.mjs`

**15 testes passaram.** Foram exercitados persistência de intenção, Int64 além do inteiro seguro JS, aceite local sem fill, detalhes parciais, incerteza sem replay, recuperação de arquivo SQLite, sessão nova/antiga, falta de ID permanente, intenção abandonada, vínculo de conta/ordem, duplicação conflitante de evidência, cancelamento parcial sem apagar posição, fechamento associado ao comando existente, preço/direção/quantidade, metadados vencidos, ambiente nativo recusado e proibição de atribuir um mesmo ID a duas operações. A revisão cruzada acrescentou regressões para quatro estados UNKNOWN/PENDING e para mudança de exposição, revisão ou comando entre preparação e tentativa de fechamento.

Os nomes `WINZ99` e contas usados nos testes são fictícios. Não foi carregada DLL, instalado SDK, iniciado Profit/MT5, consultada conta de cliente, chamada API de demonstração, assinada requisição real nem enviada ordem. O hash do protocolo R109 importado deve constar do manifesto geral R127; sua origem não é uma dependência de execução dos testes.

## Dependências que continuam abertas

1. Disponibilização autorizada da ProfitDLL/versão suportada, licença de roteamento e ambiente Windows do cliente; ou escolha explícita de automação NTSL, que é outro caminho.
2. Prova nativa em demonstração de conexão, identidade de conta, instrumento negociável, callbacks, consultas, cancelamento e redução de exposição.
3. Ponte autorizada com credenciais protegidas localmente; o delta não oferece transporte nem carrega ctypes/DLL.
4. Provas completas de negócios/preços/horários/custos e vínculo da posição para transformar evidência nativa em registro financeiro confirmado.
5. Confirmação pelo fornecedor de uma API Genial cripto adequada, se esse caminho for mantido; sua ausência documental não impede a alternativa Binance.
6. Testes autenticados nos ambientes de demonstração Binance e validação das proteções do produto/conta. A prova offline não os substitui.

Operação real permanece não concluída. A conclusão desta frente é o inventário verificável, a reutilização do protocolo e a persistência adicional qualificada com dados fictícios.
