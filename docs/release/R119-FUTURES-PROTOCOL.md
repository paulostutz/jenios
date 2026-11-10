# R119: pure Binance USDⓈ-M protocol

## Scope and verification

This checkpoint builds unsigned descriptions and compares **synthetic, caller-supplied** evidence. It contains no networking, signing, credentials, account-setting changes, SDK installation, or trading activation. Every result remains `canSubmit:false`; `protectionInstalled:false` is deliberate. Account identity is the existing environment/product/key fingerprint binding. Leverage and selected BUY/SELL direction are preserved, never configured here.

Tests: `node --test tests/platformUltraR119FuturesProtocol.test.mjs`. These are deterministic contract tests, not exchange acceptance, authenticated reconciliation, latency, fill, funding, fee, margin or live-risk tests.

## Official sources checked 2026-11-10

- [USDⓈ-M changelog](https://developers.binance.com/en/docs/products/derivatives-trading-usds-futures/change-log): conditional orders moved to Algo Service effective 2025-12-09. The 2025-12-29 entry removes `MAX_NUM_ALGO_ORDERS` from exchangeInfo and establishes a 200-order conditional limit across symbols. Do not synthesize the removed filter.
- [REST trade API](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/trade): entry LIMIT and closing MARKET use `/fapi/v1/order`; query/cancel identify ordinary orders with `symbol` and `origClientOrderId`. Conditional STOP_MARKET/TAKE_PROFIT_MARKET use `/fapi/v1/algoOrder`, `algoType:CONDITIONAL`, `triggerPrice`, and `clientAlgoId`; query/cancel use `clientAlgoId`, without symbol. One-way uses BOTH; hedge requires LONG/SHORT and does not accept reduceOnly. R119 rejects hedge, and uses explicit quantity plus reduceOnly, never closePosition.
- [General info](https://developers.binance.com/en/docs/products/derivatives-trading-usds-futures/general-info): transport timeout and the unknown-execution variant of HTTP503 require reconciliation before retry. Other documented 503 variants can indicate definite rejection. Timestamps are milliseconds; R119 conservatively caps recvWindow at 5000 ms and requires entry preparation time to match preflight time. Clock error -1021 requires resynchronization. No classifier output authorizes automatic retries.
- [User data streams](https://developers.binance.com/en/docs/products/derivatives-trading-usds-futures/user-data-streams): ALGO_UPDATE distinguishes armed NEW from TRIGGERING, TRIGGERED and FINISHED; the latter is not proof of a filled close. Matching-engine order execution and remaining exposure must be reconciled separately. Stream updates can trigger a fresh REST query; this checkpoint deliberately does not parse compact stream payloads as complete REST receipts or open authenticated streams.
- [Filters](https://developers.binance.com/en/docs/products/derivatives-trading-usds-futures/common-definition): actual tick/step/min/max, mark-relative percent-price, notional and ordinary order count rules are checked using decimal integers. This page still lists the old algo filter; the explicitly dated removal in the changelog takes precedence. Unknown filters fail closed.

## New preflight, old checkpoint unchanged

`binance-futures-preflight-r119.mjs` explicitly adapts the R118 implementation, leaving R118 immutable. Importing R118 directly would require a removed filter. R119 never fabricates one.

Input retains R118 binding/order/nowMs and other snapshot envelopes. Replace `snapshots.algoOrders` with:

```
globalAlgoOrders: {
  product: 'usds_m_futures', environment: 'demo', keyFingerprint,
  observedAtMs,
  value: { scope: 'all_symbols', complete: true, orders: [] }
}
```

The value represents the complete native GET `/fapi/v1/openAlgoOrders` result **without a symbol filter**. Rows need symbol, lossless positive algoId and active algoStatus. Duplicate/malformed rows, missing completeness, wrong scope/binding and stale snapshots fail. Two free slots below the global 200 limit are necessary. Existing target-symbol orders or positions still require reconciliation. Counts do not reserve capacity against concurrent requests, and a caller's completeness claim is not authenticated by a pure function.

## Exports and integration contract

- `buildBinanceFuturesProtocolR119({preflightInput,timestamp,recvWindow?})`: frozen entry/stop/target POST descriptions and query/cancel descriptions. Request fields are method/path/params/binding, with no host, signature or transport. `close` is an explicitly marked template lacking client order identity; never send it. All templates require current authenticated state and durable command reservation outside this module.
- `binanceFuturesClientIdsR119(entryId)`: entry `ju_`, stop `js_`, target `jt_`, legacy template close namespace `jc_`, preserving the entire suffix without truncation or hashing. IDs are valid through 36 characters. Reserve these namespaces and persist the decision-to-ID association.
- `buildBinanceFuturesCloseR119({preflightInput,timestamp,recvWindow?,remainingQuantity,closeCommandId})`: reduce-only MARKET description. `closeCommandId` must be a unique durable `ju_cmd_` plus 32 lowercase hex characters, mapped to `jc_` plus those characters. A retry of the same command retains its ID; another partial-close command requires a new ID. Historical preflight validates static intent only; current position ownership, canceled entry remainder, exact remaining quantity and unresolved prior commands must be reconciled separately.
- `buildBinanceFuturesLookupR119({binding,kind,clientId,symbol?,timestamp,recvWindow?,action?})`: regenerate query/cancel using the persisted identity and fresh clock. Kind is `order` or `algo`; action defaults to `query`. Ordinary orders require symbol; algo lookup forbids it.
- `normalizeBinanceFuturesOrderR119({payload,binding,source,observedAtMs})`: product/clientOrderId/orderId/symbol/side/status/requestedQuantity/executedQuantity/averagePrice/updatedAtMs, plus evidence metadata. Source is `rest_ack` or `rest_query`; quantities and native IDs are strings, missing values null. Unsafe numeric IDs, overfills, malformed decimals and inconsistent FILLED fail. ACK quantities never substitute for confirmed position state.
- `normalizeBinanceFuturesAlgoR119` uses the same arguments and returns clientAlgoId/algoId/status/side/quantity/stopPrice plus actualOrderId. It never infers fills from actualQty, TRIGGERED or FINISHED.
- `assessBinanceFuturesProtectionR119({protocol,stopReceipt,targetReceipt,exposureQuantity,nowMs,maxAgeMs?})`: only complete, matching, fresh REST-query NEW receipts with correct account/IDs/side/quantity/trigger/mode/flags produce `protectionObserved:true`. ACK does not. Authentication and current exposure remain external prerequisites, so `protectionInstalled` stays false. The two orders are not atomic or OCO; sibling cancellation and entry-fill races need a durable reconciler.
- `classifyBinanceFuturesOutcomeR119({httpStatus?,code?,message?,transportUnknown?})`: accepted/rejected/unknown, always automaticRetryAllowed false. Not-found -2013, unknown cancel -2011 and duplicate-capable -2010 remain unknown, never proof that a prior mutation did not execute.

Persist mutation and lookup identity before sandbox dispatch. Reconcile unknown results before any retry. Native submission remains disabled; this contract is not permission to transact or a production-ready execution engine.
