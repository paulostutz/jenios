import test from 'node:test';
import assert from 'node:assert/strict';
import * as spot from '../lib/platform/ultra/client/binance-spot-protocol-r119.mjs';
const meta = () => ({symbol: 'BTCUSDT', baseAsset: 'BTC', quoteAsset: 'USDT', status: 'TRADING', isSpotTradingAllowed: true,
  orderTypes: ['LIMIT', 'LIMIT_MAKER', 'STOP_LOSS_LIMIT'], ocoAllowed: true, otoAllowed: true, filters: [
    {filterType: 'PRICE_FILTER', minPrice: '0.01', maxPrice: '1000000', tickSize: '0.01'},
    {filterType: 'LOT_SIZE', minQty: '0.001', maxQty: '100', stepSize: '0.001'},
    {filterType: 'MIN_NOTIONAL', minNotional: '5'}]});
const account = () => ({accountType: 'SPOT', canTrade: true, balances: [{asset: 'BTC', free: '1'}, {asset: 'USDT', free: '1000'}]});
const order = () => ({product: 'spot', symbol: 'BTCUSDT', side: 'BUY', type: 'LIMIT', quantity: '1', price: '100', clientOrderId: 'entry-119'});
const oco = () => ({product: 'spot', symbol: 'BTCUSDT', side: 'SELL', quantity: '0.999', takeProfitPrice: '110',
  stopPrice: '90', stopLimitPrice: '89', lastPrice: '100', listClientOrderId: 'list-119', aboveClientOrderId: 'tp-119', belowClientOrderId: 'sl-119'});
const receipt = overrides => ({symbol: 'BTCUSDT', orderId: '9007199254740993', clientOrderId: 'entry-119',
  orderListId: '11', side: 'BUY', status: 'PARTIALLY_FILLED', origQty: '1.000', executedQty: '0.400', cummulativeQuoteQty: '40.00', ...overrides});
const rejects = (fn, code) => assert.throws(fn, {code});
test('R119 Spot LIMIT exact decimal native descriptor is immutable, unsigned and inert', () => {
  const input = order(); const r = spot.buildSpotLimitRequest(input, meta(), account());
  assert.deepEqual(r.params, {symbol: 'BTCUSDT', side: 'BUY', type: 'LIMIT', timeInForce: 'GTC', quantity: '1', price: '100', newClientOrderId: 'entry-119', newOrderRespType: 'FULL'});
  assert.equal(r.path, '/api/v3/order'); assert.equal(r.executable, false); assert.equal(r.signed, false);
  assert.equal(r.liveAuthorized, false); assert.ok(Object.isFrozen(r.params)); input.side = 'SELL'; assert.equal(r.params.side, 'BUY');
});
test('R119 Spot preserves funded SELL and refuses short or futures rather than inverting', () => {
  const sell = {...order(), side: 'SELL'}; assert.equal(spot.buildSpotLimitRequest(sell, meta(), account()).params.side, 'SELL');
  const a = account(); a.balances[0].free = '0'; rejects(() => spot.buildSpotLimitRequest(sell, meta(), a), 'R119_INSUFFICIENT_SPOT_BALANCE');
  rejects(() => spot.buildSpotLimitRequest({...order(), product: 'futures'}, meta(), account()), 'R119_SPOT_REQUIRED');
  rejects(() => spot.buildSpotLimitRequest({...order(), reduceOnly: true}, meta(), account()), 'R119_INVALID_FIELDS');
  rejects(() => spot.buildSpotLimitRequest({...order(), side: 'SHORT'}, meta(), account()), 'R119_INVALID_SIDE');
});
test('R119 Spot no silent numeric rounding, scientific notation or insufficient balances', () => {
  for (const quantity of [0.1, '1e-3', '-1', 'NaN', '0.0000000000000000001', '01']) rejects(() => spot.validateSpotLimit({...order(), quantity}, meta(), account()), 'R119_INVALID_DECIMAL');
  rejects(() => spot.validateSpotLimit({...order(), quantity: '1.0001'}, meta(), account()), 'R119_LOT_SIZE');
  rejects(() => spot.validateSpotLimit({...order(), price: '100.001'}, meta(), account()), 'R119_PRICE_FILTER');
  rejects(() => spot.validateSpotLimit({...order(), quantity: '0.001'}, meta(), account()), 'R119_NOTIONAL');
  const a = account(); a.balances[1].free = '99.999999999999999999'; rejects(() => spot.validateSpotLimit(order(), meta(), a), 'R119_INSUFFICIENT_SPOT_BALANCE');
});
test('R119 filters fail closed on missing/duplicate static metadata and disclose dynamic checks', () => {
  const m = meta(); m.filters.push({filterType: 'PERCENT_PRICE', multiplierUp: '1.2'});
  const v = spot.validateSpotLimit(order(), m, account()); assert.deepEqual(v.uncheckedFilters, ['PERCENT_PRICE']); assert.equal(v.exchangeCertified, false);
  m.filters.push(m.filters[0]); rejects(() => spot.validateSpotLimit(order(), m, account()), 'R119_FILTERS_UNVERIFIED');
  const n = meta(); n.filters.pop(); rejects(() => spot.validateSpotLimit(order(), n, account()), 'R119_FILTERS_UNVERIFIED');
  const max = meta(); max.filters.push({filterType: 'NOTIONAL', minNotional: '5', maxNotional: '99'});
  rejects(() => spot.validateSpotLimit(order(), max, account()), 'R119_NOTIONAL');
});
test('R119 query is exact client-ID lookup; cancel accepts one target, never all-symbol cancellation', () => {
  const q = {product: 'spot', symbol: 'BTCUSDT', origClientOrderId: 'entry-119'};
  assert.equal(spot.buildSpotQueryRequest(q).method, 'GET'); assert.deepEqual(spot.buildSpotQueryRequest(q).params, {symbol: 'BTCUSDT', origClientOrderId: 'entry-119'});
  assert.equal(spot.buildSpotCancelRequest(q).path, '/api/v3/order');
  assert.equal(spot.buildSpotCancelRequest({product: 'spot', symbol: 'BTCUSDT', orderId: '9007199254740993'}).params.orderId, '9007199254740993');
  rejects(() => spot.buildSpotCancelRequest({...q, orderId: '2'}), 'R119_ONE_EXACT_TARGET_REQUIRED');
  rejects(() => spot.buildSpotCancelRequest({product: 'spot', symbol: 'BTCUSDT'}), 'R119_ONE_EXACT_TARGET_REQUIRED');
  rejects(() => spot.buildSpotCancelRequest({product: 'spot', symbol: 'BTCUSDT', orderId: 9007199254740993}), 'R119_UNSAFE_ID');
});
test('R119 OCO inventory-backed SELL uses native names and checks both legs and trigger', () => {
  const r = spot.buildSpotOcoRequest(oco(), meta(), account()); assert.equal(r.path, '/api/v3/orderList/oco');
  assert.equal(r.params.aboveType, 'LIMIT_MAKER'); assert.equal(r.params.belowStopPrice, '90'); assert.equal(r.reservedOrderSlots, 2);
  for (const patch of [{stopPrice: '100'}, {takeProfitPrice: '99'}, {stopLimitPrice: '91'}]) rejects(() => spot.buildSpotOcoRequest({...oco(), ...patch}, meta(), account()), 'R119_OCO_PRICE_RELATION');
  rejects(() => spot.buildSpotOcoRequest({...oco(), side: 'BUY'}, meta(), account()), 'R119_OCO_SIDE_UNSUPPORTED');
  rejects(() => spot.buildSpotOcoRequest({...oco(), quantity: '2'}, meta(), account()), 'R119_INSUFFICIENT_SPOT_BALANCE');
  rejects(() => spot.buildSpotOcoRequest({...oco(), belowClientOrderId: 'tp-119'}, meta(), account()), 'R119_DUPLICATE_CLIENT_ID');
});
test('R119 OTOCO partial fills explicitly unprotected, fees bounded, no side conversion', () => {
  const input = {product: 'spot', working: order(), pending: oco(), baseCommissionReserve: '0.001'};
  const r = spot.buildSpotOtocoRequest(input, meta(), account()); assert.equal(r.path, '/api/v3/orderList/otoco');
  assert.equal(r.params.pendingBelowStopPrice, '90'); assert.equal(r.params.workingSide, 'BUY'); assert.equal(r.params.pendingSide, 'SELL');
  assert.equal(r.partialEntryProtected, false); assert.equal(r.reservedOrderSlots, 3);
  rejects(() => spot.buildSpotOtocoRequest({...input, baseCommissionReserve: '0.002'}, meta(), account()), 'R119_PENDING_EXCEEDS_NET_ENTRY');
  rejects(() => spot.buildSpotOtocoRequest({...input, working: {...order(), side: 'SELL'}}, meta(), account()), 'R119_OTOCO_WORKING_SIDE_UNSUPPORTED');
  rejects(() => spot.buildSpotOtocoRequest(input, {...meta(), otoAllowed: false}, account()), 'R119_OTO_UNAVAILABLE');
});
test('R119 normalization retains exact IDs, partial fills and per-asset commissions', () => {
  const r = spot.normalizeSpotReceipt(receipt({fills: [{tradeId: '0', price: '100.00', qty: '0.400', commission: '0.0004', commissionAsset: 'BTC'}]}));
  assert.equal(r.orderId, '9007199254740993'); assert.equal(r.executedQty, '0.4'); assert.equal(r.cumulativeQuoteQty, '40');
  assert.equal(r.fills[0].commissionAsset, 'BTC'); assert.equal(r.fillsComplete, true); assert.equal(r.terminal, false);
  const canceled = spot.normalizeSpotReceipt(receipt({status: 'CANCELED'})); assert.equal(canceled.executedQty, '0.4'); assert.equal(canceled.needsReconciliation, true);
  rejects(() => spot.normalizeSpotReceipt(receipt({orderId: 9007199254740993})), 'R119_UNSAFE_ID');
  rejects(() => spot.normalizeSpotReceipt(receipt({status: 'FILLED'})), 'R119_RECEIPT_QUANTITY');
  rejects(() => spot.normalizeSpotReceipt(receipt({executedQty: '2'})), 'R119_RECEIPT_QUANTITY');
});
test('R119 ACK and absent quote/fills never manufacture executions', () => {
  const r = spot.normalizeSpotReceipt({symbol: 'BTCUSDT', orderId: 0, clientOrderId: 'ack-119'});
  assert.equal(r.status, 'ACK_ONLY'); assert.equal(r.executedQty, null); assert.equal(r.needsReconciliation, true);
  const n = spot.normalizeSpotReceipt(receipt({cummulativeQuoteQty: '-1'})); assert.equal(n.cumulativeQuoteQty, null); assert.equal(n.fillsComplete, false);
});
test('R119 timeout, unknown order, rate limits and malformed success require reconciliation, never resend', () => {
  for (const input of [{code: -1007}, {code: -1006}, {httpStatus: 503, code: -2010}, {transportError: true}, {code: -2013}, {httpStatus: 429}, {httpStatus: 200, receipt: {}}]) {
    const r = spot.classifySpotOutcome(input); assert.equal(r.outcome, 'UNKNOWN'); assert.equal(r.automaticResubmitAllowed, false);
  }
  const rejected = spot.classifySpotOutcome({httpStatus: 400, code: -2010}); assert.equal(rejected.outcome, 'REJECTED'); assert.equal(rejected.appliesTo, 'THIS_ATTEMPT_ONLY');
  assert.equal(spot.classifySpotOutcome({httpStatus: 200, receipt: receipt()}).outcome, 'ACKNOWLEDGED');
});
test('R119 pending OTOCO is not protection for partial entry or unconfirmed activation', () => {
  assert.deepEqual(spot.assessOtocoProtection({working: receipt()}), {protected: false, reason: 'PARTIAL_ENTRY_UNPROTECTED'});
  const working = receipt({status: 'FILLED', executedQty: '1'});
  assert.equal(spot.assessOtocoProtection({working}).reason, 'PENDING_CONFIRMATION_REQUIRED');
  const above = receipt({orderId: '2', clientOrderId: 'tp-119', side: 'SELL', status: 'PENDING_NEW', executedQty: '0'});
  const below = {...above, orderId: '3', clientOrderId: 'sl-119'};
  assert.equal(spot.assessOtocoProtection({working, above, below}).pendingOrdersActive, false);
  const active = spot.assessOtocoProtection({working, above: {...above, status: 'NEW'}, below: {...below, status: 'NEW'}});
  assert.equal(active.pendingOrdersActive, true); assert.equal(active.protected, false);
  assert.equal(spot.assessOtocoProtection({working, above: {...above, status: 'NEW', orderListId: '12'}, below: {...below, status: 'NEW'}}).pendingOrdersActive, false);
});
test('R119 receipt common interface and expected identity reject mismatches', () => {
  const r = spot.normalizeSpotReceipt(receipt({updateTime: 1234}), {product: 'spot', clientOrderId: 'entry-119', symbol: 'BTCUSDT', side: 'BUY'});
  assert.equal(r.requestedQuantity, '1'); assert.equal(r.executedQuantity, '0.4'); assert.equal(r.averagePrice, '100'); assert.equal(r.updatedAtMs, 1234);
  rejects(() => spot.normalizeSpotReceipt(receipt(), {clientOrderId: 'different'}), 'R119_RECEIPT_REFERENCE_MISMATCH');
  rejects(() => spot.normalizeSpotReceipt(receipt(), {side: 'SELL'}), 'R119_RECEIPT_REFERENCE_MISMATCH');
  rejects(() => spot.normalizeSpotReceipt(receipt(), {symbol: 'ETHUSDT'}), 'R119_RECEIPT_REFERENCE_MISMATCH');
});
test('R119 list lookup/cancel target list identity, never all orders', () => {
  const query = spot.buildSpotOrderListQueryRequest({product: 'spot', origClientOrderId: 'list-119'});
  assert.equal(query.path, '/api/v3/orderList'); assert.deepEqual(query.params, {origClientOrderId: 'list-119'});
  const cancel = spot.buildSpotOrderListCancelRequest({product: 'spot', symbol: 'BTCUSDT', orderListId: '11'});
  assert.equal(cancel.method, 'DELETE'); assert.deepEqual(cancel.params, {symbol: 'BTCUSDT', orderListId: '11'});
  rejects(() => spot.buildSpotOrderListQueryRequest({product: 'spot'}), 'R119_ONE_EXACT_TARGET_REQUIRED');
  rejects(() => spot.buildSpotOrderListCancelRequest({product: 'spot', symbol: 'BTCUSDT', orderListId: '11', listClientOrderId: 'list-119'}), 'R119_ONE_EXACT_TARGET_REQUIRED');
});
test('R119 list receipts bind list and every child identity without declaring protection', () => {
  const first = receipt({orderId: '1', clientOrderId: 'tp-119', side: 'SELL', status: 'NEW', executedQty: '0'});
  const second = {...first, orderId: '2', clientOrderId: 'sl-119'};
  const raw = {symbol: 'BTCUSDT', orderListId: '11', listClientOrderId: 'list-119', contingencyType: 'OCO', listStatusType: 'EXEC_STARTED', listOrderStatus: 'EXECUTING', transactionTime: 12,
    orders: [first, second].map(({symbol, orderId, clientOrderId}) => ({symbol, orderId, clientOrderId})), orderReports: [first, second]};
  const expected = {symbol: 'BTCUSDT', orderListId: '11', listClientOrderId: 'list-119', childClientOrderIds: ['tp-119', 'sl-119']};
  const r = spot.normalizeSpotOrderListReceipt(raw, expected); assert.equal(r.protected, false); assert.equal(r.orderReports.length, 2);
  rejects(() => spot.normalizeSpotOrderListReceipt(raw, {...expected, orderListId: '12'}), 'R119_LIST_REFERENCE_MISMATCH');
  rejects(() => spot.normalizeSpotOrderListReceipt(raw, {...expected, childClientOrderIds: ['alien', 'sl-119']}), 'R119_LIST_REFERENCE_MISMATCH');
  rejects(() => spot.normalizeSpotOrderListReceipt({...raw, orderReports: [first, {...second, orderListId: '12'}]}, expected), 'R119_LIST_REFERENCE_MISMATCH');
  rejects(() => spot.normalizeSpotOrderListReceipt({...raw, orders: [raw.orders[0], raw.orders[0]]}, expected), 'R119_LIST_CHILDREN_INVALID');
  const ack = spot.normalizeSpotOrderListReceipt({...raw, orderReports: undefined}, expected); assert.equal(ack.orderReports.length, 0); assert.equal(ack.needsReconciliation, true);
});

test('R119 native list cancellation uses listClientOrderId, not lookup origClientOrderId', () => {
  const r = spot.buildSpotOrderListCancelRequest({product:'spot',symbol:'BTCUSDT',listClientOrderId:'list-119'});
  assert.deepEqual(r.params, {symbol:'BTCUSDT',listClientOrderId:'list-119'});
  rejects(() => spot.buildSpotOrderListCancelRequest({product:'spot',symbol:'BTCUSDT',origClientOrderId:'list-119'}), 'R119_INVALID_FIELDS');
});
