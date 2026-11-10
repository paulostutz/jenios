/** R119: pure, unsigned Binance Spot descriptors. No transport or live authorization. */
const SCALE = 10n ** 18n;
const DECIMAL = /^(0|[1-9]\d{0,19})(\.\d{1,18})?$/;
const SYMBOL = /^[A-Z0-9]{2,40}$/;
const CLIENT = /^[A-Za-z0-9_-]{1,36}$/; // Deliberately conservative local subset.
const fail = code => { throw Object.assign(new Error(code), {code}); };
const frozen = value => { if (value && typeof value === 'object') { Object.values(value).forEach(frozen); Object.freeze(value); } return value; };
function exact(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(k => !keys.includes(k))) fail('R119_INVALID_FIELDS');
}
function fixed(value) {
  if (typeof value !== 'string' || !DECIMAL.test(value)) fail('R119_INVALID_DECIMAL');
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * SCALE + BigInt(fraction.padEnd(18, '0'));
}
function decimal(value) { fixed(value); return value.includes('.') ? value.replace(/0+$/, '').replace(/\.$/, '') : value; }
function positive(value) { if (fixed(value) <= 0n) fail('R119_NONPOSITIVE'); return decimal(value); }
function id(value) {
  if (typeof value === 'number') { if (!Number.isSafeInteger(value)) fail('R119_UNSAFE_ID'); value = String(value); }
  if (typeof value !== 'string' || !/^(0|[1-9]\d{0,19})$/.test(value)) fail('R119_INVALID_ID');
  return value;
}
function client(value) { if (typeof value !== 'string' || !CLIENT.test(value)) fail('R119_INVALID_CLIENT_ID'); return value; }
function symbol(value) { if (typeof value !== 'string' || !SYMBOL.test(value)) fail('R119_INVALID_SYMBOL'); return value; }
function product(value) { if (value !== 'spot') fail('R119_SPOT_REQUIRED'); }
function side(value) { if (!['BUY', 'SELL'].includes(value)) fail('R119_INVALID_SIDE'); return value; }
function instrument(meta, name, types) {
  if (!meta || meta.symbol !== name || meta.status !== 'TRADING' || meta.isSpotTradingAllowed !== true ||
    !/^[A-Z0-9]{1,20}$/.test(meta.baseAsset || '') || !/^[A-Z0-9]{1,20}$/.test(meta.quoteAsset || '') ||
    !Array.isArray(meta.orderTypes) || types.some(t => !meta.orderTypes.includes(t)) || !Array.isArray(meta.filters)) fail('R119_SYMBOL_UNVERIFIED');
  const filters = new Map();
  for (const f of meta.filters) {
    if (!f || typeof f.filterType !== 'string' || filters.has(f.filterType)) fail('R119_FILTERS_UNVERIFIED');
    filters.set(f.filterType, f);
  }
  if (!filters.has('PRICE_FILTER') || !filters.has('LOT_SIZE') || (!filters.has('NOTIONAL') && !filters.has('MIN_NOTIONAL'))) fail('R119_FILTERS_UNVERIFIED');
  return filters;
}
function checkPrice(price, filters) {
  const p = fixed(positive(price)), f = filters.get('PRICE_FILTER');
  const min = fixed(f.minPrice), max = fixed(f.maxPrice), tick = fixed(f.tickSize);
  if ((min && p < min) || (max && p > max) || (tick && p % tick)) fail('R119_PRICE_FILTER');
}
function checkLeg(quantity, price, filters) {
  checkPrice(price, filters);
  const q = fixed(positive(quantity)), p = fixed(price), f = filters.get('LOT_SIZE');
  const min = fixed(f.minQty), max = fixed(f.maxQty), step = fixed(f.stepSize);
  if (max <= 0n || step <= 0n || q < min || q > max || q % step) fail('R119_LOT_SIZE');
  for (const name of ['MIN_NOTIONAL', 'NOTIONAL']) {
    const n = filters.get(name); if (!n) continue;
    if (p * q < fixed(n.minNotional) * SCALE || (name === 'NOTIONAL' && fixed(n.maxNotional) > 0n && p * q > fixed(n.maxNotional) * SCALE)) fail('R119_NOTIONAL');
  }
}
function balances(account, meta) {
  if (!account || account.accountType !== 'SPOT' || account.canTrade !== true || !Array.isArray(account.balances)) fail('R119_ACCOUNT_UNVERIFIED');
  const map = new Map();
  for (const row of account.balances) {
    if (!row || typeof row.asset !== 'string' || map.has(row.asset)) fail('R119_BALANCE_UNVERIFIED');
    map.set(row.asset, fixed(row.free));
  }
  if (!map.has(meta.baseAsset) || !map.has(meta.quoteAsset)) fail('R119_BALANCE_UNVERIFIED');
  return map;
}
function funded(order, meta, account) {
  const map = balances(account, meta), q = fixed(order.quantity);
  if (order.side === 'SELL' ? map.get(meta.baseAsset) < q : map.get(meta.quoteAsset) * SCALE < q * fixed(order.price)) fail('R119_INSUFFICIENT_SPOT_BALANCE');
}
function validation(filters) {
  return frozen({staticFiltersPassed: true, accountSnapshotChecked: true, exchangeCertified: false,
    uncheckedFilters: [...filters.keys()].filter(k => !['PRICE_FILTER', 'LOT_SIZE', 'MIN_NOTIONAL', 'NOTIONAL'].includes(k)),
    requiresFreshExchangeAndAccountValidation: true, feeReserveVerified: false});
}
const LIMIT_KEYS = ['product', 'symbol', 'side', 'type', 'quantity', 'price', 'clientOrderId', 'timeInForce'];
export function validateSpotLimit(order, meta, account) {
  exact(order, LIMIT_KEYS); product(order.product); symbol(order.symbol); side(order.side); client(order.clientOrderId);
  if (order.type !== 'LIMIT' || !['GTC', 'IOC', 'FOK'].includes(order.timeInForce ?? 'GTC')) fail('R119_UNSUPPORTED_ORDER');
  const filters = instrument(meta, order.symbol, ['LIMIT']);
  checkLeg(order.quantity, order.price, filters); funded(order, meta, account);
  return validation(filters);
}
function descriptor(method, path, params, extra = {}) {
  return frozen({schema: 'JENIOS_R119_SPOT_DESCRIPTOR', product: 'spot', method, path, params,
    executable: false, signed: false, liveAuthorized: false, ...extra});
}
export function buildSpotLimitRequest(order, meta, account) {
  const checked = validateSpotLimit(order, meta, account);
  return descriptor('POST', '/api/v3/order', {symbol: order.symbol, side: order.side, type: 'LIMIT',
    timeInForce: order.timeInForce ?? 'GTC', quantity: positive(order.quantity), price: positive(order.price),
    newClientOrderId: order.clientOrderId, newOrderRespType: 'FULL'}, {validation: checked});
}
export function buildSpotQueryRequest(input) {
  exact(input, ['product', 'symbol', 'origClientOrderId']); product(input.product);
  return descriptor('GET', '/api/v3/order', {symbol: symbol(input.symbol), origClientOrderId: client(input.origClientOrderId)});
}
export function buildSpotCancelRequest(input) {
  exact(input, ['product', 'symbol', 'origClientOrderId', 'orderId']); product(input.product);
  if ((input.origClientOrderId !== undefined) === (input.orderId !== undefined)) fail('R119_ONE_EXACT_TARGET_REQUIRED');
  return descriptor('DELETE', '/api/v3/order', {symbol: symbol(input.symbol), ...(input.orderId !== undefined ?
    {orderId: id(input.orderId)} : {origClientOrderId: client(input.origClientOrderId)})}, {mayCancelEntireOrderList: true});
}
const OCO_KEYS = ['product', 'symbol', 'side', 'quantity', 'takeProfitPrice', 'stopPrice', 'stopLimitPrice', 'lastPrice',
  'listClientOrderId', 'aboveClientOrderId', 'belowClientOrderId'];
function ocoShape(input, meta) {
  product(input.product); symbol(input.symbol);
  // This checkpoint implements the inventory-backed SELL protective subset only.
  if (input.side !== 'SELL') fail('R119_OCO_SIDE_UNSUPPORTED');
  const ids = [input.listClientOrderId, input.aboveClientOrderId, input.belowClientOrderId].map(client);
  if (new Set(ids).size !== ids.length) fail('R119_DUPLICATE_CLIENT_ID');
  if (meta?.ocoAllowed !== true) fail('R119_OCO_UNAVAILABLE');
  const filters = instrument(meta, input.symbol, ['LIMIT_MAKER', 'STOP_LOSS_LIMIT']);
  checkLeg(input.quantity, input.takeProfitPrice, filters); checkLeg(input.quantity, input.stopLimitPrice, filters);
  checkPrice(input.stopPrice, filters);
  if (!(fixed(input.takeProfitPrice) > fixed(positive(input.lastPrice)) && fixed(input.lastPrice) > fixed(input.stopPrice)) ||
      fixed(input.stopLimitPrice) > fixed(input.stopPrice)) fail('R119_OCO_PRICE_RELATION');
  return filters;
}
function ocoParams(input) {
  return {symbol: input.symbol, side: 'SELL', quantity: positive(input.quantity), listClientOrderId: input.listClientOrderId,
    aboveType: 'LIMIT_MAKER', aboveClientOrderId: input.aboveClientOrderId, abovePrice: positive(input.takeProfitPrice),
    belowType: 'STOP_LOSS_LIMIT', belowClientOrderId: input.belowClientOrderId, belowPrice: positive(input.stopLimitPrice),
    belowStopPrice: positive(input.stopPrice), belowTimeInForce: 'GTC', newOrderRespType: 'FULL'};
}
export function buildSpotOcoRequest(input, meta, account) {
  exact(input, OCO_KEYS); const filters = ocoShape(input, meta);
  funded({...input, price: input.takeProfitPrice}, meta, account);
  return descriptor('POST', '/api/v3/orderList/oco', ocoParams(input), {validation: validation(filters),
    reservedOrderSlots: 2, stopLimitExecutionGuaranteed: false});
}
export function buildSpotOtocoRequest(input, meta, account) {
  exact(input, ['product', 'working', 'pending', 'baseCommissionReserve']); product(input.product);
  const checked = validateSpotLimit(input.working, meta, account);
  if (input.working.side !== 'BUY') fail('R119_OTOCO_WORKING_SIDE_UNSUPPORTED');
  if (meta.otoAllowed !== true) fail('R119_OTO_UNAVAILABLE');
  exact(input.pending, OCO_KEYS); ocoShape(input.pending, meta);
  if (input.pending.symbol !== input.working.symbol) fail('R119_SYMBOL_MISMATCH');
  const allIds = [input.working.clientOrderId, input.pending.listClientOrderId, input.pending.aboveClientOrderId, input.pending.belowClientOrderId];
  if (new Set(allIds).size !== 4) fail('R119_DUPLICATE_CLIENT_ID');
  // Conservative planning bound; actual commissions/inventory must still be reconciled after fills.
  const reserve = fixed(input.baseCommissionReserve);
  if (fixed(input.pending.quantity) + reserve > fixed(input.working.quantity)) fail('R119_PENDING_EXCEEDS_NET_ENTRY');
  if (!(fixed(input.pending.takeProfitPrice) > fixed(input.working.price) && fixed(input.working.price) > fixed(input.pending.stopPrice))) fail('R119_OTOCO_PRICE_RELATION');
  const p = ocoParams(input.pending), w = input.working;
  return descriptor('POST', '/api/v3/orderList/otoco', {symbol: w.symbol, listClientOrderId: p.listClientOrderId,
    workingType: 'LIMIT', workingSide: w.side, workingPrice: positive(w.price), workingQuantity: positive(w.quantity),
    workingClientOrderId: w.clientOrderId, workingTimeInForce: w.timeInForce ?? 'GTC', pendingSide: p.side,
    pendingQuantity: p.quantity, pendingAboveType: p.aboveType, pendingAbovePrice: p.abovePrice,
    pendingAboveClientOrderId: p.aboveClientOrderId, pendingBelowType: p.belowType, pendingBelowPrice: p.belowPrice,
    pendingBelowStopPrice: p.belowStopPrice, pendingBelowClientOrderId: p.belowClientOrderId,
    pendingBelowTimeInForce: p.belowTimeInForce, newOrderRespType: 'FULL'}, {validation: checked,
    reservedOrderSlots: 3, partialEntryProtected: false, activationRequires: 'WORKING_FILLED_AND_PENDING_CONFIRMED',
    baseCommissionReserve: decimal(input.baseCommissionReserve), stopLimitExecutionGuaranteed: false});
}
const STATUSES = ['NEW', 'PENDING_NEW', 'PARTIALLY_FILLED', 'FILLED', 'CANCELED', 'PENDING_CANCEL', 'REJECTED', 'EXPIRED', 'EXPIRED_IN_MATCH'];
function fromFixed(value) { return decimal(`${value / SCALE}.${String(value % SCALE).padStart(18, '0')}`); }
export function normalizeSpotReceipt(raw, expected = {}) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail('R119_RECEIPT_INVALID');
  const base = {product: 'spot', symbol: symbol(raw.symbol), orderId: id(raw.orderId), clientOrderId: client(raw.clientOrderId),
    origClientOrderId: raw.origClientOrderId === undefined ? null : client(raw.origClientOrderId),
    orderListId: raw.orderListId === undefined || raw.orderListId === -1 || raw.orderListId === '-1' ? null : id(raw.orderListId)};
  for (const key of ['symbol', 'orderId', 'clientOrderId']) {
    if (expected[key] !== undefined && String(expected[key]) !== base[key] && !(key === 'clientOrderId' && String(expected[key]) === base.origClientOrderId)) fail('R119_RECEIPT_REFERENCE_MISMATCH');
  }
  if (expected.origClientOrderId !== undefined && expected.origClientOrderId !== base.clientOrderId && expected.origClientOrderId !== base.origClientOrderId) fail('R119_RECEIPT_REFERENCE_MISMATCH');
  if (expected.product !== undefined && expected.product !== 'spot') fail('R119_SPOT_REQUIRED');
  if (expected.side !== undefined && raw.side !== undefined && expected.side !== raw.side) fail('R119_RECEIPT_REFERENCE_MISMATCH');
  const timestamp = raw.updateTime ?? raw.transactTime;
  if (timestamp !== undefined && (!Number.isSafeInteger(timestamp) || timestamp < 0)) fail('R119_RECEIPT_TIME_INVALID');
  base.updatedAtMs = timestamp ?? null;
  if (raw.status === undefined) {
    if (['executedQty', 'origQty', 'fills'].some(k => raw[k] !== undefined)) fail('R119_RECEIPT_INVALID');
    return frozen({...base, status: 'ACK_ONLY', executedQty: null, origQty: null, cumulativeQuoteQty: null, fills: [], side: expected.side ?? null, requestedQuantity: null, executedQuantity: null, averagePrice: null, commissions: [], terminal: false, needsReconciliation: true});
  }
  if (!STATUSES.includes(raw.status)) fail('R119_STATUS_UNRECOGNIZED');
  const origQty = positive(raw.origQty), executedQty = decimal(raw.executedQty);
  if (expected.quantity !== undefined && fixed(expected.quantity) !== fixed(origQty)) fail('R119_RECEIPT_REFERENCE_MISMATCH');
  if (['NEW', 'PENDING_NEW', 'REJECTED'].includes(raw.status) && fixed(executedQty) !== 0n) fail('R119_RECEIPT_QUANTITY');
  if (fixed(executedQty) > fixed(origQty) || (raw.status === 'FILLED' && fixed(executedQty) !== fixed(origQty)) ||
      (raw.status === 'PARTIALLY_FILLED' && (fixed(executedQty) <= 0n || fixed(executedQty) >= fixed(origQty)))) fail('R119_RECEIPT_QUANTITY');
  if (raw.fills !== undefined && !Array.isArray(raw.fills)) fail('R119_FILLS_INVALID');
  const seen = new Set(); let fillQty = 0n;
  const fills = (raw.fills ?? []).map(f => {
    const tradeId = id(f.tradeId); if (seen.has(tradeId)) fail('R119_DUPLICATE_FILL'); seen.add(tradeId);
    if (!/^[A-Z0-9]{1,20}$/.test(f.commissionAsset || '')) fail('R119_FILLS_INVALID');
    fillQty += fixed(positive(f.qty));
    return {tradeId, price: positive(f.price), quantity: positive(f.qty), commission: decimal(f.commission), commissionAsset: f.commissionAsset};
  });
  if (fillQty > fixed(executedQty)) fail('R119_FILLS_EXCEED_EXECUTED');
  const quote = raw.cummulativeQuoteQty === undefined || raw.cummulativeQuoteQty === '-1' ? null : decimal(raw.cummulativeQuoteQty);
  const averagePrice = quote !== null && fixed(executedQty) > 0n ? fromFixed(fixed(quote) * SCALE / fixed(executedQty)) : null;
  const terminal = ['FILLED', 'CANCELED', 'REJECTED', 'EXPIRED', 'EXPIRED_IN_MATCH'].includes(raw.status);
  return frozen({...base, side: side(raw.side), status: raw.status, origQty, executedQty,
    cumulativeQuoteQty: quote, requestedQuantity: origQty, executedQuantity: executedQty, averagePrice, averagePricePrecision: 'TRUNCATED_TO_18_DECIMALS', commissions: fills.map(f => ({tradeId: f.tradeId, asset: f.commissionAsset, amount: f.commission})),
    fills, fillsComplete: raw.fills !== undefined && fillQty === fixed(executedQty), terminal,
    needsReconciliation: !terminal || (fixed(executedQty) > 0n && (raw.fills === undefined || fillQty !== fixed(executedQty)))});
}
export function classifySpotOutcome({httpStatus, code, transportError = false, receipt} = {}) {
  const unknown = () => frozen({outcome: 'UNKNOWN', needsReconciliation: true, automaticResubmitAllowed: false});
  if (transportError || (httpStatus >= 500) || [-1000, -1001, -1006, -1007, -2013, -2026].includes(code)) return unknown();
  // Narrow allowlist: rejection of this attempt does not prove absence of an earlier attempt.
  if ([-1013, -1014, -1015, -1021, -1022, -1100, -1101, -1102, -1103, -1111, -1121, -2010, -2011, -2014, -2015].includes(code)) {
    return frozen({outcome: 'REJECTED', needsReconciliation: true, automaticResubmitAllowed: false, appliesTo: 'THIS_ATTEMPT_ONLY'});
  }
  if ((httpStatus === undefined || (httpStatus >= 200 && httpStatus < 300)) && code === undefined && receipt) {
    try { const normalized = normalizeSpotReceipt(receipt); return frozen({outcome: normalized.status === 'REJECTED' ? 'REJECTED' : 'ACKNOWLEDGED', receipt: normalized, needsReconciliation: true, automaticResubmitAllowed: false}); }
    catch { return unknown(); }
  }
  return unknown();
}
export function assessOtocoProtection({working, above, below} = {}) {
  const w = normalizeSpotReceipt(working);
  // A partial fill remains exposed even if a caller supplies apparent pending receipts.
  if (w.status !== 'FILLED') return frozen({protected: false, reason: fixed(w.executedQty ?? '0') > 0n ? 'PARTIAL_ENTRY_UNPROTECTED' : 'WORKING_NOT_FILLED'});
  if (!above || !below) return frozen({protected: false, reason: 'PENDING_CONFIRMATION_REQUIRED'});
  const a = normalizeSpotReceipt(above), b = normalizeSpotReceipt(below);
  const matched = w.orderListId !== null && a.orderListId === w.orderListId && b.orderListId === w.orderListId &&
    a.symbol === w.symbol && b.symbol === w.symbol && w.side === 'BUY' && a.side === 'SELL' && b.side === 'SELL' &&
    new Set([w.orderId, a.orderId, b.orderId]).size === 3 && a.status === 'NEW' && b.status === 'NEW' &&
    fixed(a.executedQty) === 0n && fixed(b.executedQty) === 0n && a.origQty === b.origQty && fixed(a.origQty) <= fixed(w.executedQty);
  // Active receipts establish pending-order activation, not fee-adjusted full coverage or guaranteed fills.
  return frozen({protected: false, pendingOrdersActive: matched, reason: matched ? 'NET_INVENTORY_COVERAGE_REQUIRES_RECONCILIATION' : 'PENDING_NOT_CONFIRMED', stopLimitExecutionGuaranteed: false});
}

export function buildSpotOrderListQueryRequest(input) {
  exact(input, ['product', 'origClientOrderId', 'orderListId']); product(input.product);
  if ((input.origClientOrderId !== undefined) === (input.orderListId !== undefined)) fail('R119_ONE_EXACT_TARGET_REQUIRED');
  return descriptor('GET', '/api/v3/orderList', input.orderListId !== undefined ? {orderListId: id(input.orderListId)} : {origClientOrderId: client(input.origClientOrderId)});
}
export function buildSpotOrderListCancelRequest(input) {
  exact(input, ['product', 'symbol', 'listClientOrderId', 'orderListId']); product(input.product);
  if ((input.listClientOrderId !== undefined) === (input.orderListId !== undefined)) fail('R119_ONE_EXACT_TARGET_REQUIRED');
  return descriptor('DELETE', '/api/v3/orderList', {symbol: symbol(input.symbol), ...(input.orderListId !== undefined ?
    {orderListId: id(input.orderListId)} : {listClientOrderId: client(input.listClientOrderId)})});
}
export function normalizeSpotOrderListReceipt(raw, expected = {}) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail('R119_LIST_RECEIPT_INVALID');
  const orderListId = id(raw.orderListId), listClientOrderId = client(raw.listClientOrderId), name = symbol(raw.symbol);
  if (expected.product !== undefined && expected.product !== 'spot') fail('R119_SPOT_REQUIRED');
  if ((expected.orderListId !== undefined && id(expected.orderListId) !== orderListId) ||
    (expected.listClientOrderId !== undefined && expected.listClientOrderId !== listClientOrderId) ||
    (expected.origClientOrderId !== undefined && expected.origClientOrderId !== listClientOrderId) ||
    (expected.symbol !== undefined && expected.symbol !== name)) fail('R119_LIST_REFERENCE_MISMATCH');
  if (!['OCO', 'OTO'].includes(raw.contingencyType) || !['RESPONSE', 'EXEC_STARTED', 'ALL_DONE', 'UPDATED'].includes(raw.listStatusType) ||
      !['EXECUTING', 'ALL_DONE', 'REJECT'].includes(raw.listOrderStatus)) fail('R119_LIST_STATUS_UNRECOGNIZED');
  if (!Array.isArray(raw.orders) || raw.orders.length < 2 || raw.orders.length > 3) fail('R119_LIST_CHILDREN_INVALID');
  const ids = new Set(), clients = new Set();
  const orders = raw.orders.map(row => {
    if (row.symbol !== name) fail('R119_LIST_REFERENCE_MISMATCH');
    const orderId = id(row.orderId), clientOrderId = client(row.clientOrderId);
    if (ids.has(orderId) || clients.has(clientOrderId) || clientOrderId === listClientOrderId) fail('R119_LIST_CHILDREN_INVALID');
    ids.add(orderId); clients.add(clientOrderId); return {symbol: name, orderId, clientOrderId};
  });
  if (expected.childClientOrderIds !== undefined) {
    if (!Array.isArray(expected.childClientOrderIds) || expected.childClientOrderIds.length !== orders.length ||
      new Set(expected.childClientOrderIds).size !== orders.length || expected.childClientOrderIds.some(c => !clients.has(c))) fail('R119_LIST_REFERENCE_MISMATCH');
  }
  if (raw.orderReports !== undefined && (!Array.isArray(raw.orderReports) || raw.orderReports.length !== orders.length)) fail('R119_LIST_CHILDREN_INVALID');
  const reportsSeen = new Set();
  const orderReports = (raw.orderReports ?? []).map(row => {
    const child = orders.find(o => o.clientOrderId === row.clientOrderId);
    if (!child || reportsSeen.has(child.clientOrderId) || id(row.orderListId) !== orderListId) fail('R119_LIST_REFERENCE_MISMATCH');
    reportsSeen.add(child.clientOrderId);
    return normalizeSpotReceipt(row, {product: 'spot', ...child});
  });
  const stamp = raw.transactionTime;
  if (stamp !== undefined && (!Number.isSafeInteger(stamp) || stamp < 0)) fail('R119_RECEIPT_TIME_INVALID');
  return frozen({product: 'spot', symbol: name, orderListId, listClientOrderId, contingencyType: raw.contingencyType,
    status: raw.listOrderStatus, listStatusType: raw.listStatusType, updatedAtMs: stamp ?? null, orders, orderReports,
    protected: false, terminal: ['ALL_DONE', 'REJECT'].includes(raw.listOrderStatus), needsReconciliation: true});
}
