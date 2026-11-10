# R119 — contrato Binance Spot puro

## Escopo e evidência

Somente construção/validação local de descritores imutáveis e normalização de recibos sintéticos. Nenhum fetch, socket, SDK, segredo, assinatura, timestamp de envio, credencial, autorização live, chamada de negociação ou alteração de permissão. Todos os descritores têm `executable:false`, `signed:false`, `liveAuthorized:false`. A existência do contrato não habilita execução real.

Consultados em 2026-11-10:
- [Trade REST oficial](https://developers.binance.com/en/docs/catalog/core-trading-spot-trading/api/rest-api/trade): LIMIT, cancelamento individual, OCO e OTOCO.
- [Filtros oficiais](https://developers.binance.com/en/docs/products/spot/filters).
- [Erros oficiais](https://developers.binance.com/en/docs/products/spot/errors).
- Branch remota local `origin/work/jenios-r110-binance-real-preflight-20261028`, commit `6a52163`, inspecionada com `git show`, sem checkout/cherry-pick. Reaproveitada a ideia de decimais inteiros escalados e validação estática; nenhum transporte/preflight assinado foi importado.

## API de integração

Módulo: `lib/platform/ultra/client/binance-spot-protocol-r119.mjs`.

- `validateSpotLimit(order, meta, account)` e `buildSpotLimitRequest(order, meta, account)`.
- `order`: `{product:'spot',symbol,side,type:'LIMIT',quantity,price,clientOrderId,timeInForce?}`. GTC por padrão; IOC/FOK explícitos preservados. Quantidades/preços são strings decimais, até 18 casas; não há arredondamento de ordens.
- `meta`: uma linha de `exchangeInfo.symbols`, com assets, status, tipos e filtros.
- `account`: `{accountType:'SPOT',canTrade:true,balances:[{asset,free}]}`. Exige ambos os assets presentes; o chamador deve obter snapshot completo e recente. Saldo locked nunca é considerado disponível.
- `buildSpotQueryRequest({product:'spot',symbol,origClientOrderId})`: GET `/api/v3/order`.
- `buildSpotCancelRequest({product:'spot',symbol,orderId})` ou com `origClientOrderId`: DELETE `/api/v3/order`. Exige exatamente um identificador; nunca cancela todas as ordens do símbolo. Cancelar membro de lista pode cancelar a lista inteira, fato exposto pelo descritor.
- `buildSpotOcoRequest(input,meta,account)`: subconjunto protetivo SELL com LIMIT_MAKER acima e STOP_LOSS_LIMIT abaixo. `input` contém product/symbol/side/quantity/takeProfitPrice/stopPrice/stopLimitPrice/lastPrice/listClientOrderId/aboveClientOrderId/belowClientOrderId.
- `buildSpotOtocoRequest({product:'spot',working,pending,baseCommissionReserve},meta,account)`: working é o LIMIT; pending tem formato OCO. Apenas BUY seguido de SELL, sem converter estratégia SELL em BUY. Outros formatos são incompatibilidades explícitas. Reserva de comissão base é uma string obrigatória; não é uma estimativa de comissão certificada.
- Builders retornam `{schema,product,method,path,params,executable:false,signed:false,liveAuthorized:false,...}`. Somente `params` contém os campos nativos de negócio. Autenticação/transporte estão deliberadamente ausentes.
- `normalizeSpotReceipt(raw,expected={})`: aceita identidade esperada product/symbol/orderId/clientOrderId/origClientOrderId/side/quantity; divergência falha. Retorna product/symbol/orderId/clientOrderId/origClientOrderId/orderListId/side/status/requestedQuantity/executedQuantity/averagePrice/updatedAtMs, além de aliases origQty/executedQty, cumulativeQuoteQty, fills e commissions. IDs grandes exigem string ou número inteiro seguro. Média derivada de quote/quantidade é truncada a 18 casas, nunca usada para construir preço de ordem. updatedAtMs usa updateTime/transactTime ou null, não inventa relógio. ACK_ONLY tem quantidades null; não prova execução. Recibos de lista são tratados pelo normalizador próprio abaixo e reconciliados pelo coordenador.
- `classifySpotOutcome({httpStatus,code,transportError,receipt})`: UNKNOWN/REJECTED/ACKNOWLEDGED, sempre `automaticResubmitAllowed:false`. Timeout, erro de transporte, 5xx, resposta inválida, rate limit e ordem não encontrada (-2013) não provam rejeição. REJECTED refere-se à tentativa, não à ausência de ordem anterior. Persistir intenção e lookup antes do envio sandbox e reconciliar depois; este módulo não persiste nada.
- `assessOtocoProtection({working,above,below})`: entrada parcial é explicitamente desprotegida. Mesmo após fill total, pendentes exigem recibos ativos vinculados à mesma lista. `pendingOrdersActive:true` não implica cobertura líquida total, e `protected` permanece false até reconciliação externa de estoque/custos. Stop-limit não garante execução.

## Restrições deliberadas

Produto `spot` obrigatório; leverage, margin, short e reduceOnly não são campos aceitos. SELL exige estoque base livre. BUY exige saldo quote suficiente para o principal. Estratégias incompatíveis são rejeitadas, nunca invertidas. A lista OCO reserva duas ordens; OTOCO reserva três, mas limites globais/de conta são responsabilidade de validação posterior.

PRICE_FILTER, LOT_SIZE, MIN_NOTIONAL e NOTIONAL são verificados exatamente. Filtros dinâmicos e demais filtros são retornados em `uncheckedFilters`; filtro desconhecido não é silenciosamente certificado. Snapshots, comissão real, limites de ordens, restrições de conta, permissões, disponibilidade regional e mudanças de preço devem ser verificados fora deste módulo. `exchangeCertified:false` e `requiresFreshExchangeAndAccountValidation:true` são invariantes. Validar o principal não é comprovar reserva de custos.

OTOCO NÃO protege preenchimento parcial. Pendentes só ativam após execução total da working; PENDING_NEW nunca significa proteção ativa. Quantidade pending mais reserva base não pode exceder a entrada; taxas reais e saldo final ainda exigem reconciliação. A quantidade pending pode ser menor e deixar resíduo explícito para o diário. Não há OPO/OPOCO, market, trailing, iceberg, peg, margem, futuros ou cancel-replace neste checkpoint.

## Verificação

`node --test tests/platformUltraR119SpotProtocol.test.mjs`

Testes exclusivamente sintéticos: identidade/precisão, filtros/saldos, preservação de SELL, incompatibilidade short/futures, requests nativos, cancelamento exato, OCO/OTOCO, fills/comissões, ACK incompleto, timeout/unknown versus rejeição e ausência de proteção parcial. Não é certificação de conta real, exchange, execução, liquidez, P&L ou posição protegida. Integração/diário e suíte agregada pertencem ao coordenador R119.

## Identidade de listas

`buildSpotOrderListQueryRequest({product:'spot',origClientOrderId})` ou com `orderListId` constrói GET `/api/v3/orderList`. `buildSpotOrderListCancelRequest` exige symbol e usa `listClientOrderId` (não `origClientOrderId`) ou `orderListId` e constrói DELETE nesse mesmo endpoint. Exatamente um identificador por request, nunca cancelamento global. O origClientOrderId neste endpoint identifica a lista, não uma ordem filha.

`normalizeSpotOrderListReceipt(raw,expected)` valida orderListId/listClientOrderId/symbol, estados da lista e identidade de cada filho em orders/orderReports. `expected` suporta product, symbol, orderListId, listClientOrderId, origClientOrderId e childClientOrderIds (conjunto completo). Recibos de outra lista, IDs repetidos, children divergentes ou reports com outra lista falham. Lista sem reports permanece incompleta e exige reconciliação. Não soma quantidades de working e pendentes, pois isso duplicaria exposição. O retorno contém orders e orderReports normalizados, terminal, updatedAtMs, needsReconciliation:true e protected:false.

Verificação focal final: 15 testes passaram, zero chamadas externas de negociação.

Consulta de lista usa origClientOrderId; cancelamento de lista usa listClientOrderId. Nomes conferidos separadamente nos endpoints oficiais, não inferidos por simetria. Fonte adicional: [Account REST oficial](https://developers.binance.com/en/docs/catalog/core-trading-spot-trading/api/rest-api/account).
