# R120: protocolo de eventos Binance, somente offline

## Escopo e limite operacional

O módulo `lib/platform/ultra/client/binance-events-r120.mjs` recebe objetos JSON de
fixtures sintéticas e produz evidências normalizadas. Não abre conexão, não lê
credenciais, não persiste dados e não envia, cancela ou altera ordens. Não conecta
conta Binance, Profit, MetaTrader ou corretora. Não habilita negociação.

Esta etapa não comprova funcionamento em conta real. Nenhum evento, mesmo `FILLED`,
instala proteção, comprova posição integralmente encerrada ou conclui resultado
líquido. Esses campos permanecem explicitamente conservadores:

- `evidenceAuthenticated: false`, `canSubmit: false`, `ordersSent: 0`;
- `protectionInstalled: false`, `positionClosed: false`;
- `netProfit: null`, `financialRecordPending: true`;
- `needsReconciliation: true`, `sequence: null`, `sequenceGuaranteed: false`.

O SDK oficial Profit e a integração operacional permanecem fora deste módulo.
Arquivos e bytes R119/prévios não foram alterados por esta implementação.

## Documentação oficial verificada em 2026-11-10

1. [Spot User Data Stream](https://developers.binance.com/en/docs/products/spot/user-data-stream)
   e [schemas JSON Spot](https://developers.binance.com/en/docs/catalog/core-trading-spot-trading/api/ws-streams/~schemas):
   `executionReport` informa execuções; `listStatus` informa listas. As quantidades
   `l` e `z` são respectivamente a última execução e o acumulado. `I` é o ID da
   execução. `N` identifica a moeda da comissão `n`.
2. [Fonte oficial Spot no GitHub](https://github.com/binance/binance-spot-api-docs/blob/master/user-data-stream.md):
   confirma o envelope JSON `{subscriptionId, event}`. O envelope não é um ID de
   ordem, de conta, de execução ou de continuidade entre conexões.
3. [USDⓈ-M User Data Streams](https://developers.binance.com/en/docs/products/derivatives-trading-usds-futures/user-data-streams):
   `ORDER_TRADE_UPDATE` e `ALGO_UPDATE` são eventos distintos. `FINISHED` no serviço
   de ordens condicionais pode representar execução ou cancelamento da ordem
   disparada. A ordenação documentada por `E`/`T` limita-se ao mesmo usuário,
   conexão e tipo de evento. Não representa sequência global recuperável.
4. [Schemas oficiais USDⓈ-M](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/ws-streams/~schemas):
   foram conferidas também as propriedades aninhadas do schema no HTML oficial.
   Em `ALGO_UPDATE`, `o.caid`/`o.aid` identificam a ordem condicional; `o.ai`
   identifica a ordem efetiva, quando presente. `o.aq`/`o.ap` são observações de
   quantidade executada/preço médio do serviço condicional, não uma execução
   individual com comissão.

Na consulta, as URLs antigas de páginas individuais de eventos Futures
redirecionavam para uma página inicial. As páginas consolidadas e seus schemas
acima foram utilizadas, sem interpretar esse redirecionamento como documentação
do payload. Nenhum payload de conta real foi usado nos testes.

## API pública

Exportação única:

```js
normalizeBinanceEventR120({
  binding: {
    product: 'spot', // ou 'usds_m_futures'
    environment: 'demo',
    keyFingerprint: 'a'.repeat(64), // rótulo sintético, não uma chave
    mode: 'offline_fixture'
  },
  payload: syntheticEvent,
  timeUnit: 'MILLISECOND' // opcional; default explícito
})
```

Não são aceitos contextos `live`, COIN-M, Margin ou modo não sintético. O contexto
é parte da chave de identidade. A mesma execução em fingerprints/produtos
diferentes não se associa silenciosamente. Contexto embutido no próprio payload
é rejeitado. O fingerprint fornecido pelo chamador não autentica uma conta.

O payload não contém por si só prova de produto/origem: alguns eventos Futures
compartilham formato entre produtos. Este parser valida a família conhecida e o
contexto declarado; não afirma distinguir uma origem COIN-M falsamente rotulada
como USDⓈ-M. O integrador deve vincular a origem verificada ao contexto, antes de
qualquer uso operacional futuro.

Aceita objetos JSON simples, não texto JSON, SBE, instâncias de classes ou funções.
O chamador não deve usar `JSON.parse` convencional em números que excedam a faixa
segura de JavaScript: a precisão já perdida não pode ser recuperada. Um decodificador
futuro precisa conservar inteiros grandes como strings e rejeitar chaves JSON
duplicadas antes deste módulo. Números JS inseguros são rejeitados aqui.

Spot aceita o evento isolado ou o envelope exato `{subscriptionId, event}`. O
`subscriptionId` deve existir no envelope e é devolvido apenas como metadado.
Envelopes mistos, aninhados, REST ACK, `data`/`stream` e envelopes Spot usados com
Futures são rejeitados. O campo `stream` de um fluxo privado pode conter material
de acesso, por isso não é aceito nem preservado.

Todas as exceções de validação usam prefixo `R120_EVENT_`. JSON é limitado por
profundidade, quantidade de nós e comprimento de strings. Getters, ciclos, campos
ocultos, símbolos JS, chaves de prototype pollution e campos com nomes de
credenciais são rejeitados antes da normalização. Objetos retornados são cópias
profundamente congeladas; o chamador não é modificado.

## Contrato de saída para a caixa durável

- `schema: 'JENIOS_ULTRA_BINANCE_EVENT_R120'`;
- `binding`, `product`, `eventType`, `kind` e `recognized`;
- `identityKey`: chave SHA-256 do contexto, unidade temporal e identidade nativa;
- `canonicalPayload`: **objeto JSON**, sem envelope, horário de recebimento ou
  contador local, com IDs e decimais conhecidos canonizados;
- `payloadDigest`: SHA-256 UTF-8 do objeto acima serializado com chaves ordenadas
  recursivamente, equivalente a `canonicalProtocolJson` R119;
- `eventTime`, `transactionTime`, e `tradeTime` quando aplicável: inteiros em
  strings decimais, sem conversão para `Number`;
- `timeUnit`: `MILLISECOND` por padrão; Spot aceita `MICROSECOND` explicitamente.
  Futures aceita apenas `MILLISECOND`. Não há detecção da unidade por magnitude;
- IDs separados: `orderId`, `clientOrderId`, `origClientOrderId`, `executionId`,
  `tradeId`, `orderListId`, `listClientOrderId`, `algoId`, `clientAlgoId`,
  `actualOrderId`, quando aplicáveis;
- `status` nativo e `semanticStatus` explícito. `terminal` é do objeto nativo
  observado, nunca da posição, operação, estratégia ou conta;
- `lookupReferences`: objetos `{kind, symbol, clientId, nativeId}`, com `kind`
  igual a `order`, `algo` ou `list`.

`clientId: null` indica que não existe identificação de cliente verificada para
aquela referência. Ela não autoriza associação por símbolo. Um `executionReport`
de cancelamento pode apontar tanto para `c` quanto para `C`. `listStatus` conserva
referências dos filhos, sem dizer qual é entrada, stop ou alvo. `ALGO_UPDATE` nunca
usa `aid` como se fosse `ai`.

Campos adicionais JSON não reconhecidos são conservados no payload canonizado,
após os mesmos limites e proibições de credenciais; não geram efeitos semânticos.
Assim, uma mudança de conteúdo não é silenciosamente descartada pelo digest.
Campos funcionais conhecidos têm validação adicional de tipo/precisão. Não existe
campo `receivedAt` na API, nem acesso ao relógio global.

## Identidade, repetição e conflito

1. Spot `executionReport`: contexto + símbolo + ID da ordem + ID de execução `I`.
   Alterações em comissão, acumulado ou tempo para esse mesmo ID produzem a mesma
   identidade com digest diferente: conflito, não uma nova execução.
2. Futures `ORDER_TRADE_UPDATE` com `x=TRADE`: contexto + símbolo + ID da ordem +
   ID de trade. Eventos não-trade usam uma tupla conservadora com tipo de execução,
   tempos de evento/transação/trade e ordem.
3. Spot `listStatus`: contexto + símbolo + lista + tempos + tipo de atualização.
4. Futures `ALGO_UPDATE`: contexto + símbolo + algo + tempos + estado do algo.
5. `eventStreamTerminated`/`listenKeyExpired`: evento + tempo, no mesmo contexto.
6. Outros eventos: `kind: 'unknown'`, `recognized: false`,
   `identityStrength: 'payload_only'`, sem referências de ordens. O digest integra
   sua identidade. Apenas repetição exata é deduplicável; não há identidade nativa
   suficiente para prometer detecção de conteúdo conflitante.

Identidades baseadas em tupla não são um número sequencial da exchange. Dois
eventos distintos podem ter tempos iguais. Coincidência de identidade com conteúdo
diferente deve interromper aplicação automática e exigir reconciliação; não se
resolve por "último recebido vence". `subscriptionId` diferente após reconexão
não modifica a identidade nem o digest do mesmo evento.

## Quantidades, taxas e evidência financeira

Decimais são strings exatas, com até 18 dígitos inteiros e 18 fracionários. A
normalização remove zeros fracionários redundantes; os testes verificam o menor
valor suportado, sem arredondamento binário. Notação científica, quantidades
numéricas JS, quantidades negativas e precisão acima do limite são rejeitadas.
IDs/tempos aceitam inteiros não negativos de até `9223372036854775807`, como string
ou número JS seguro. Sentinelas nativos permitidos são tratados separadamente.

- `lastFilledQuantity` corresponde a `l`; `cumulativeFilledQuantity` corresponde
  a `z`. Não se soma `z` a um ledger e não se transforma `z` em delta sem histórico
  reconciliado. Uma ordem cancelada pode conservar um `z` positivo e `l=0`.
- `commission` mantém `{amount, asset, tradeId, scope:'last_execution',
  convertedAmount:null}`. Comissão ausente permanece desconhecida. Uma comissão
  não zero sem moeda é rejeitada. Rebates negativos são preservados, sem converter
  BNB, USDT ou outra moeda para uma moeda contábil presumida.
- `reportedRealizedProfit` Futures é informação reportada da execução, nunca
  resultado líquido da estratégia, e não substitui taxas/funding/reconciliação.
- Quantidades originais e acumuladas são verificadas quanto a sobrepreenchimento
  e estados inconsistentes. Spot MARKET dimensionado por quantidade de moeda de
  cotação pode não fornecer limite original positivo de quantidade-base; essa
  exceção exige `Q` positivo e não é aplicada a Futures.
- `ALGO_UPDATE.aq/ap` são expostos somente em
  `reportedActualExecutedQuantity/reportedActualAveragePrice`. Seus campos
  `lastFilledQuantity/cumulativeFilledQuantity` continuam nulos. `FINISHED` não
  fornece trade, comissão, exposição restante ou motivo final suficiente.

## Lacunas e reconciliação

Não existe neste contrato sequência global da Binance, cursor de recuperação ou
garantia de completude. Uma sequência SQLite local é somente de recebimento.
Timestamps ajudam a ordenar evidências, mas não provam ausência de eventos
perdidos e não substituem snapshots.

Após desconexão, expiração, restart, conflito, evento inválido ou lacuna conhecida,
a camada durável deve invalidar a continuidade e exigir reconciliação explícita
com consultas de ordens/listas/algos, trades, posições/saldos e taxas pertinentes,
vinculadas ao mesmo produto e conta. Também deve considerar o atraso de consultas
REST. Este módulo não realiza essas consultas nem libera retomada. Normalizar
um evento tardio é permitido; aplicá-lo sobre estado mais novo sem reconciliação
não é consequência autorizada da normalização.

`listenKeyExpired` somente é aceito como fixture sem o campo `listenKey`. O
payload oficial que contenha a chave de acesso deve ser expurgado por uma fronteira
separada antes de chegar a este componente; este módulo rejeita a chave, não a
armazena nem a inclui no digest.

## Verificação sintética

Comando focado:

```sh
node --test tests/platformUltraR120Events.test.mjs
```

São cobertos eventos fora de ordem, repetição, conflitos de mesma identidade,
mudança de assinatura de conta/produto, IDs acima de `Number.MAX_SAFE_INTEGER`,
limites int64, comissões/rebates exatos, diferença entre preenchimento último e
acumulado, cancelamento parcial, listas/filhos, algos disparados, envelopes,
eventos desconhecidos, unidades temporais, objetos malformados e rejeição de
credenciais. Os testes confirmam ausência de inferência de proteção, fechamento,
resultado líquido e autoridade de execução.
