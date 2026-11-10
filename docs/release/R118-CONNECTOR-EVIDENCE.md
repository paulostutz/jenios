# Ultra R118: evidências dos conectores

## Estado desta entrega

O coletor Binance e a correção MT5 abaixo foram validados somente com respostas
sintéticas. Não houve autenticação em conta de trader, ordem, cancelamento,
mudança de alavancagem, contratação de licença ou habilitação de API.
Nenhum resultado deste conjunto demonstra rentabilidade ou homologação nativa.

## Binance USDⓈ-M: leitura por referência durável

Módulo: `lib/platform/ultra/client/binance-collector.mjs`.

`new BinanceOrderCollector({product: 'usds_m_futures', environment, expectedKeyFingerprint})` obtém uma chave
HMAC e seu segredo exclusivamente das variáveis locais `JENIOS_BINANCE_API_KEY`
e `JENIOS_BINANCE_API_SECRET`. `environment` aceita `demo` ou `live`.
`binanceReadOnlyKeyFingerprint(apiKey, environment)` produz a impressão a conferir
com a seleção local existente. Essa impressão identifica a chave e o ambiente,
**não** comprova UID, titularidade legal ou identidade independente da conta.
Criar ou configurar acesso persistente na corretora é etapa humana separada.

`await collector.collect(references)` aceita de 1 a 50 referências, cada uma com:

- `symbol`, `orderId`, `clientOrderId`, `side` (`BUY`/`SELL`), `positionSide`
  (`BOTH`/`LONG`/`SHORT`).
- As referências devem vir do diário durável da aplicação. Não são descobertas
  por prefixo, símbolo ou por escolher todas as operações da conta.
- IDs são strings decimais; números inteiros inseguros são recusados, não arredondados.

O resultado usa `JENIOS_ULTRA_BINANCE_ORDER_EVIDENCE_V1`. Em `orders`, cada ordem
tem estado nativo, quantidades, referências, fills e comissões agrupadas pelo
ativo cobrado. Valores decimais permanecem exatos, inclusive rebates. O coletor
confere a identidade completa, soma dos fills e duas leituras iguais da ordem.

`context` contém posições e funding do **símbolo da conta**, explicitamente sem
atribuição ao robô. Funding mantém o sinal de entrada/saída da Binance. Não é
convertido automaticamente em custo da operação. O resultado nunca marca
`positionReconciled` ou `costsComplete` como verdadeiro e não calcula `net`.
Uma ordem `FILLED` não prova encerramento de uma posição. Ausência em
`positionRisk` tampouco prova encerramento de uma operação específica.

As únicas rotas são GET `/fapi/v1/time`, `/fapi/v1/order`, `/fapi/v1/userTrades`,
`/fapi/v3/positionRisk` e `/fapi/v1/income` com `incomeType=FUNDING_FEE`.
Origens fixas: `https://demo-fapi.binance.com` e `https://fapi.binance.com`.
Não há envio de ordens, endpoints arbitrários, troca de domínio, redirects ou
repetição automática após falha. Erros de permissão, região e limite de uso
interrompem a coleta sem expor o corpo do fornecedor.

Limites conservadores: 89 dias desde a criação da ordem; 200 consultas por lote;
20 mil fills/transações; 2 MB por resposta. Os fills usam janelas de até sete dias.
Páginas cheias são subdivididas por tempo; 1.000 registros no mesmo milissegundo
interrompem a coleta como incompleta. O diário anterior deve ser preservado.
Histórico além da retenção, custos posteriores, posição compartilhada/netting e
atribuição de funding exigem conciliação adicional, não zeros presumidos.

O cliente usa diretamente o contrato REST oficial, sem dependência npm nova.
Não deve ser descrito como SDK Binance instalado. A família oficial atual está
em `binance/binance-connector-js`; o pacote Futures é
`@binance/derivatives-trading-usds-futures`. O conector TypeScript antigo está
descontinuado. R110 é Spot e não é substituto para este contrato Futures.

## Binance Futures: preflight puro, separado de Spot

`lib/platform/ultra/client/binance-preflight.mjs` exporta
`preflightBinanceFuturesDraft({binding, order, snapshots, nowMs})`. Não faz chamadas
à Binance. O `binding` contém `product: 'usds_m_futures'`, `environment` e
`keyFingerprint`. Cada snapshot tem os mesmos três campos de vínculo,
`observedAtMs` e `value` com a resposta nativa. São exigidos `exchangeInfo`,
`accountConfig`, `symbolConfig`, `balances`, `positions`, `openOrders`, `algoOrders`
e `markPrice`. O envelope não transforma um objeto fornecido em prova autenticada.

A decisão contém `clientOrderId`, `symbol`, `side`, `positionSide`, `type`,
`quantity`, `entryPrice`, `stopPrice`, `targetPrice`, `leverage` e `marginAsset`.
O subconjunto inicial é LIMIT/GTC, perpétuo USDT, posição one-way, margem isolada
sem adição automática e alavancagem já configurada igual à escolhida. Não muda
esses parâmetros, não arredonda lotes e não inverte o sinal recebido do motor.
Outros modos são recusados até haver implementação específica.

Conferências: atualização e vínculo dos snapshots, moeda, estado do instrumento,
filtros exatos de preço/lote/notional, lote das saídas a mercado, limite de notional
informado para a alavancagem atual, mark price, direção de stop/alvo e espaço para
as proteções. Posição ou ordem existente exige conciliação, não cancelamento.
Filtros desconhecidos são recusados. `pricePrecision` e `quantityPrecision` não
substituem `tickSize` e `stepSize`.

O resultado contém intenções de entrada/proteção, não uma proteção instalada.
`canSubmit`, `protectionInstalled`, `protectionAtomic` e `riskReserved` continuam
falsos. A margem calculada é apenas o piso nominal arredondado conservadoramente;
taxas, slippage, margem de manutenção, condições dinâmicas e reserva de risco
continuam pendentes. Não existe promessa de stop garantido ou ausência de perda.

Produtos são distintos e não podem compartilhar silenciosamente o vínculo:

- Binance Spot: mercado à vista. O protocolo R110 cobre conferência Spot separada;
  não é um executor completo. Estes dois módulos R118 rejeitam `product: 'spot'`.
- Binance USDⓈ-M Futures: derivativos, margem/alavancagem, posições e funding;
  objeto exclusivo destes módulos novos.
- Profit/B3 mini índice: contrato futuro. Mercado B3 à vista exige instrumentos
  à vista separados e respectiva autorização da corretora. O mini índice não é
  reclassificado como produto à vista.

## MT5: fechamento recente de entrada antiga

`scripts/platform/ultra/mt5_collector_r118.py` estende o coletor R117 sem alterá-lo.
O defeito corrigido ocorria quando a abertura era anterior à janela consultada e
o fechamento era recente: sem posição aberta no terminal, a entrada não era
descoberta e o registro podia ficar desatualizado.

R118 consulta os deals de saída no intervalo e recupera as ordens da respectiva
posição antes de aplicar as verificações existentes de conta, ambiente, magic,
quantidades e custos. Uma saída manual com outro magic é considerada, mas a
entrada original precisa pertencer ao magic configurado. Entradas misturadas e
reversões continuam em conciliação. Há limites para a expansão do histórico.
O worker mantém o protocolo de linhas JSON `inspect`/`collect` do R117 e não
oferece comandos de execução. O pacote oficial MetaTrader5 e terminal autenticado
continuam necessários; validação Windows real ainda está pendente.

## Profit: dependência externa concreta

R109 fornece tradução de protocolo, não uma ponte operacional. A Nelogica exige
ProfitDLL oficial licenciada, Windows e tipos/manual da versão contratada.
Profit Pro sozinho não comprova licença de roteamento externo. Ainda são
necessários ABI verificado, callbacks, vínculo de conta, proteção e conciliação
de posições/custos. Não foi adicionado SDK proprietário nem cobrança estimada.

Artefatos concretos ainda não disponíveis neste checkout: `ProfitDLL.zip` da
assinatura oficial, o manual e as declarações de tipos/funções dessa versão, e
o binário da arquitetura correspondente (`Win64/ProfitDLL.dll` ou
`Win32/ProfitDLL.dll`, conforme a documentação oficial). Não se pressupõe um
nome de arquivo de headers nem uma versão contratada. Licença e habilitação
de roteamento por conta/corretora precisam de verificação no ambiente do trader.

## Testes e referências

- `node --test tests/platformUltraR118BinanceCollector.test.mjs`: 33 testes.
- `node --test tests/platformUltraR118BinancePreflight.test.mjs`: 19 testes.
- `python scripts/platform/ultra/test_mt5_collector_r118.py`: 12 testes.
- As versões R116/R117 e seus arquivos de integridade não foram alterados por
  estes módulos. Integração, empacotamento e publicação têm verificação separada.

Fontes oficiais consultadas em 10/11/2026:

- https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/trade
- https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/account
- https://developers.binance.com/en/docs/products/derivatives-trading-usds-futures/general-info
- https://developers.binance.com/en/docs/products/derivatives-trading-usds-futures/common-definition
- https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/market-data
- https://github.com/binance/binance-connector-js
- https://github.com/binance/binance-connector-typescript
- https://www.mql5.com/en/docs/python_metatrader5/mt5historydealsget_py
- https://ajuda.nelogica.com.br/hc/pt-br/articles/51583791325211-Como-obter-acesso-%C3%A0-ProfitDLL
- https://ajuda.nelogica.com.br/hc/pt-br/articles/22396517026203-Ecossistema-ProfitDLL-e-primeiros-passos
