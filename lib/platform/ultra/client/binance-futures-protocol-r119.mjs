/** Pure, unsigned USDⓈ-M request descriptions. No transport or trading authorization.
 * R118 snapshots and all receipts are caller-supplied, never authenticated here.
 */
import { preflightBinanceFuturesDraftR119 as preflightBinanceFuturesDraft } from './binance-futures-preflight-r119.mjs';
const fail = code => { throw Error(code); };
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
const exact = (value, keys) => { if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !keys.includes(key))) fail('FUTURES_PROTOCOL_INVALID_FIELDS'); };
const millis = value => Number.isSafeInteger(value) && value > 0;
const unit = 10n ** 18n;
function decimal(value, positive = false) {
 if (typeof value !== 'string' || !/^(0|[1-9]\d{0,17})(\.\d{1,18})?$/.test(value)) fail('FUTURES_PROTOCOL_INVALID_DECIMAL');
 const [whole, fraction = ''] = value.split('.');
 const n = BigInt(whole) * unit + BigInt(fraction.padEnd(18, '0'));
 if (positive && !n) fail('FUTURES_PROTOCOL_INVALID_DECIMAL');
 return n;
}
const format = n => `${n / unit}.${String(n % unit).padStart(18, '0')}`.replace(/\.?0+$/, '') || '0';
function clock(timestamp, recvWindow) {
 if (!millis(timestamp) || !Number.isSafeInteger(recvWindow) || recvWindow < 1 || recvWindow > 5000) fail('FUTURES_PROTOCOL_INVALID_CLOCK');
 return { timestamp, recvWindow };
}
function binding(value) {
 exact(value, ['product', 'environment', 'keyFingerprint']);
 if (value.product !== 'usds_m_futures' || !['demo', 'live'].includes(value.environment) || !/^[a-f0-9]{64}$/.test(value.keyFingerprint)) fail('FUTURES_PROTOCOL_INVALID_BINDING');
 return { ...value };
}
function sameBinding(a, b) { return ['product', 'environment', 'keyFingerprint'].every(k => a[k] === b[k]); }
function nativeId(value) {
 if (Number.isSafeInteger(value) && value > 0) return String(value);
 if (typeof value === 'string' && /^[1-9]\d{0,19}$/.test(value)) return value;
 fail('FUTURES_PROTOCOL_INVALID_NATIVE_ID');
}
function clientId(value) { if (typeof value !== 'string' || !/^[.A-Z:/a-z0-9_-]{1,36}$/.test(value)) fail('FUTURES_PROTOCOL_INVALID_CLIENT_ID'); return value; }
function request(b, method, path, params) {
 return freeze({ schema: 'JENIOS_ULTRA_BINANCE_UNSIGNED_REQUEST_R119', product: b.product, binding: { ...b }, method, path, params, signed: false, canSubmit: false });
}
/** Injective role namespaces, no truncation/hash, including maximum-length IDs.
 * ju_ is reserved for entry decisions; js_/jt_/jc_ for their child requests.
 */
export function binanceFuturesClientIdsR119(entryClientOrderId) {
 if (typeof entryClientOrderId !== 'string' || !/^ju_[A-Za-z0-9_-]{1,33}$/.test(entryClientOrderId)) fail('FUTURES_PROTOCOL_INVALID_ENTRY_ID');
 const suffix = entryClientOrderId.slice(3);
 return freeze({ entry: entryClientOrderId, stop: `js_${suffix}`, target: `jt_${suffix}`, close: `jc_${suffix}` });
}
export function buildBinanceFuturesProtocolR119(input) {
 exact(input, ['preflightInput', 'timestamp', 'recvWindow']);
 const { preflightInput, timestamp, recvWindow = 5000 } = input;
 const preflight = preflightBinanceFuturesDraft(preflightInput);
 const b = binding(preflightInput.binding), timing = clock(timestamp, recvWindow);
 // A request cannot be prepared with a timestamp unrelated to its snapshots.
 if (timestamp !== preflightInput.nowMs) fail('FUTURES_PROTOCOL_CLOCK_SNAPSHOT_MISMATCH');
 const ids = binanceFuturesClientIdsR119(preflight.entryIntent.newClientOrderId);
 const p = preflight.protectionIntent;
 const ordinary = (method, id) => request(b, method, '/fapi/v1/order', { symbol: preflight.symbol, origClientOrderId: id, ...timing });
 const algo = (method, id) => request(b, method, '/fapi/v1/algoOrder', { clientAlgoId: id, ...timing });
 const protection = (type, triggerPrice, id) => request(b, 'POST', '/fapi/v1/algoOrder', {
  algoType: 'CONDITIONAL', symbol: preflight.symbol, side: p.side, positionSide: 'BOTH', type,
  quantity: p.quantity, triggerPrice, workingType: 'MARK_PRICE', reduceOnly: 'true',
  priceProtect: 'false', clientAlgoId: id, newOrderRespType: 'ACK', ...timing,
 });
 return freeze({ schema: 'JENIOS_ULTRA_BINANCE_FUTURES_PROTOCOL_R119', product: b.product, binding: b, ids, preflight,
  entry: request(b, 'POST', '/fapi/v1/order', { ...preflight.entryIntent, newOrderRespType: 'ACK', ...timing }),
  stop: protection('STOP_MARKET', p.stopPrice, ids.stop), target: protection('TAKE_PROFIT_MARKET', p.targetPrice, ids.target),
  queryEntry: ordinary('GET', ids.entry), cancelEntry: ordinary('DELETE', ids.entry),
  queryStop: algo('GET', ids.stop), cancelStop: algo('DELETE', ids.stop), queryTarget: algo('GET', ids.target), cancelTarget: algo('DELETE', ids.target),
  close: request(b, 'POST', '/fapi/v1/order', { symbol: preflight.symbol, side: p.side, positionSide: 'BOTH', type: 'MARKET', quantity: p.quantity, reduceOnly: 'true', newOrderRespType: 'ACK', ...timing }),
  closeIsTemplate: true, durableCloseCommandIdRequired: true,
  protectionInstalled: false, protectionAtomic: false, canSubmit: false, ordersSent: 0,
  pending: ['AUTHENTICATED_NATIVE_SNAPSHOTS', 'GLOBAL_CONDITIONAL_CAPACITY_RESERVATION', 'DURABLE_RECONCILIATION', 'HUMAN_ACTIVATION'],
 });
}
/** Build a quantity-limited close after a reconciled partial fill. This validates a
 * supplied historical draft, not ownership/current position or permission to trade.
 */
export function buildBinanceFuturesCloseR119(input) {
 exact(input, ['preflightInput', 'timestamp', 'recvWindow', 'remainingQuantity', 'closeCommandId']);
 const { preflightInput, timestamp, recvWindow = 5000, remainingQuantity, closeCommandId } = input;
 if (typeof closeCommandId !== 'string' || !/^ju_cmd_[a-f0-9]{32}$/.test(closeCommandId)) fail('FUTURES_PROTOCOL_DURABLE_CLOSE_COMMAND_REQUIRED');
 const draft = preflightBinanceFuturesDraft(preflightInput), b = binding(preflightInput.binding);
 const q = decimal(remainingQuantity, true);
 if (q > decimal(draft.quantity, true)) fail('FUTURES_PROTOCOL_CLOSE_EXCEEDS_ENTRY');
 const filters = preflightInput.snapshots.exchangeInfo.value.symbols.find(s => s.symbol === draft.symbol).filters;
 for (const name of ['LOT_SIZE', 'MARKET_LOT_SIZE']) {
  const f = filters.find(x => x.filterType === name), min = decimal(f.minQty), max = decimal(f.maxQty, true), step = decimal(f.stepSize, true);
  if (q < min || q > max || (q - min) % step) fail('FUTURES_PROTOCOL_CLOSE_QUANTITY_FILTER');
 }
 return request(b, 'POST', '/fapi/v1/order', { symbol: draft.symbol, side: draft.protectionIntent.side, positionSide: 'BOTH', type: 'MARKET', quantity: remainingQuantity,
  reduceOnly: 'true', newClientOrderId: `jc_${closeCommandId.slice(7)}`, newOrderRespType: 'ACK', ...clock(timestamp, recvWindow) });
}
/** Error classification is conservative. No result here permits an automatic retry. */
export function classifyBinanceFuturesOutcomeR119(input) {
 exact(input, ['httpStatus', 'code', 'message', 'transportUnknown']);
 const { httpStatus, code, message = '', transportUnknown = false } = input;
 let state = 'unknown', reason = 'RECONCILE_BEFORE_RETRY';
 if (transportUnknown || code === -1007 || httpStatus === 408) reason = 'EXECUTION_UNKNOWN';
 else if ([-2013, -2011, -2010].includes(code)) reason = 'ABSENCE_OR_DUPLICATE_REQUIRES_RECONCILIATION';
 else if (code === -1021) { state = 'rejected'; reason = 'CLOCK_RESYNC_REQUIRED'; }
 else if (httpStatus === 503 && (message === 'Service Unavailable.' || message === 'Internal error; unable to process your request. Please try again.' || code === -1008)) { state = 'rejected'; reason = 'BACKOFF_REQUIRED'; }
 else if (httpStatus >= 200 && httpStatus < 300 && (code === undefined || code === 200)) { state = 'accepted'; reason = 'RECEIPT_RECONCILIATION_REQUIRED'; }
 else if (httpStatus >= 400 && httpStatus < 500 && httpStatus !== 408 && code !== undefined && Number.isInteger(code) && code < 0) { state = 'rejected'; reason = 'EXCHANGE_REJECTION'; }
 return freeze({ state, reason, automaticRetryAllowed: false, requiresReconciliation: state !== 'rejected', protectionInstalled: false });
}
/** Raw REST receipts only. Compact user-stream events are wake/reconciliation hints,
 * not substituted for complete REST evidence. Unknown fields are not copied out.
 * Native IDs must already be losslessly parsed; unsafe JS numbers are rejected.
 */
export function normalizeBinanceFuturesReceiptR119(input) {
 exact(input, ['payload', 'kind', 'source', 'binding', 'observedAtMs']);
 const { payload: p, kind, source, observedAtMs } = input;
 const b = binding(input.binding);
 if (!['order', 'algo'].includes(kind) || !['rest_ack', 'rest_query'].includes(source) || !millis(observedAtMs) || !p || typeof p !== 'object' || Array.isArray(p)) fail('FUTURES_PROTOCOL_INVALID_RECEIPT');
 const status = kind === 'algo' ? p.algoStatus : p.status;
 const known = kind === 'algo' ? ['NEW', 'CANCELED', 'TRIGGERING', 'TRIGGERED', 'FINISHED', 'REJECTED', 'EXPIRED'] : ['NEW', 'PARTIALLY_FILLED', 'FILLED', 'CANCELED', 'REJECTED', 'EXPIRED', 'EXPIRED_IN_MATCH'];
 if (status !== undefined && !known.includes(status)) fail('FUTURES_PROTOCOL_UNKNOWN_STATUS');
 const optionalDecimal = value => value === undefined ? null : format(decimal(value));
 const quantity = optionalDecimal(kind === 'algo' ? p.quantity : p.origQty);
 const executedQuantity = kind === 'algo' ? null : optionalDecimal(p.executedQty);
 if (quantity !== null && executedQuantity !== null && decimal(executedQuantity) > decimal(quantity)) fail('FUTURES_PROTOCOL_OVERFILL');
 if (kind === 'order' && status === 'FILLED' && (quantity === null || executedQuantity === null || decimal(quantity) === 0n || quantity !== executedQuantity)) fail('FUTURES_PROTOCOL_FILL_INCONSISTENT');
 const updateTime = p.updateTime ?? p.time ?? null;
 const averagePrice = kind === 'order' ? optionalDecimal(p.avgPrice) : null;
 if (updateTime !== null && (!millis(updateTime) || updateTime > observedAtMs)) fail('FUTURES_PROTOCOL_INVALID_RECEIPT_TIME');
 const bool = v => v === true || v === 'true' ? true : v === false || v === 'false' ? false : null;
 return freeze({ schema: 'JENIOS_ULTRA_BINANCE_RECEIPT_R119', product: b.product, binding: b, kind, source, observedAtMs, updateTime,
  nativeId: nativeId(kind === 'algo' ? p.algoId : p.orderId), clientId: clientId(kind === 'algo' ? p.clientAlgoId : p.clientOrderId),
  clientOrderId: kind === 'order' ? clientId(p.clientOrderId) : null, orderId: kind === 'order' ? nativeId(p.orderId) : null,
  clientAlgoId: kind === 'algo' ? clientId(p.clientAlgoId) : null, algoId: kind === 'algo' ? nativeId(p.algoId) : null,
  requestedQuantity: quantity, averagePrice, updatedAtMs: updateTime, stopPrice: optionalDecimal(p.triggerPrice),
  actualOrderId: kind === 'algo' && p.actualOrderId !== undefined && p.actualOrderId !== '' && p.actualOrderId !== 0 && p.actualOrderId !== '0' ? nativeId(p.actualOrderId) : null,
  symbol: typeof p.symbol === 'string' && /^[A-Z0-9]{2,30}$/.test(p.symbol) ? p.symbol : null,
  side: ['BUY', 'SELL'].includes(p.side) ? p.side : null, positionSide: p.positionSide === 'BOTH' ? 'BOTH' : null,
  type: typeof (p.orderType ?? p.type) === 'string' ? (p.orderType ?? p.type) : null,
  algoType: p.algoType === 'CONDITIONAL' ? p.algoType : null, status: status ?? 'ACK', quantity, executedQuantity,
  triggerPrice: optionalDecimal(p.triggerPrice), workingType: p.workingType ?? null, reduceOnly: bool(p.reduceOnly), closePosition: bool(p.closePosition), priceProtect: bool(p.priceProtect),
  accepted: !['REJECTED', 'EXPIRED'].includes(status), protectionInstalled: false, evidenceAuthenticated: false, canSubmit: false,
 });
}
/** Pure comparison of caller-supplied evidence, never an authentication claim.
 * Require a current REST query, matching entire intent and full exposure quantity.
 */
export function assessBinanceFuturesProtectionR119(input) {
 exact(input, ['protocol', 'stopReceipt', 'targetReceipt', 'exposureQuantity', 'nowMs', 'maxAgeMs']);
 const { protocol: p, stopReceipt, targetReceipt, exposureQuantity, nowMs, maxAgeMs = 1000 } = input;
 if (p?.schema !== 'JENIOS_ULTRA_BINANCE_FUTURES_PROTOCOL_R119' || !millis(nowMs) || !Number.isSafeInteger(maxAgeMs) || maxAgeMs < 1 || maxAgeMs > 5000) fail('FUTURES_PROTOCOL_INVALID_ASSESSMENT');
 const b = binding(p.binding), exposure = decimal(exposureQuantity, true);
 if (exposure > decimal(p.preflight.quantity, true)) fail('FUTURES_PROTOCOL_EXPOSURE_EXCEEDS_ENTRY');
 function matches(receipt, expected) {
  if (!receipt || receipt.schema !== 'JENIOS_ULTRA_BINANCE_RECEIPT_R119' || receipt.kind !== 'algo' || receipt.source !== 'rest_query' || !receipt.binding || !sameBinding(b, receipt.binding)) return false;
  if (!millis(receipt.observedAtMs) || receipt.observedAtMs > nowMs || nowMs - receipt.observedAtMs > maxAgeMs || receipt.status !== 'NEW' || receipt.actualOrderId !== null) return false;
  const e = expected.params;
  return receipt.clientId === e.clientAlgoId && receipt.symbol === e.symbol && receipt.side === e.side && receipt.positionSide === 'BOTH' && receipt.type === e.type && receipt.algoType === 'CONDITIONAL'
   && receipt.quantity !== null && decimal(receipt.quantity) === decimal(e.quantity) && decimal(receipt.quantity) >= exposure
   && receipt.triggerPrice !== null && decimal(receipt.triggerPrice) === decimal(e.triggerPrice)
   && receipt.workingType === 'MARK_PRICE' && receipt.reduceOnly === true && receipt.closePosition === false && receipt.priceProtect === false;
 }
 const stopObserved = matches(stopReceipt, p.stop), targetObserved = matches(targetReceipt, p.target);
 const protectionObserved = stopObserved && targetObserved && stopReceipt.nativeId !== targetReceipt.nativeId;
 return freeze({ stopObserved, targetObserved, protectionObserved, protectionInstalled: false, evidenceAuthenticated: false, protectionAtomic: false,
  requiresAuthenticatedReconciliation: true, reason: protectionObserved ? 'MATCHING_CALLER_SUPPLIED_REST_EVIDENCE' : 'PROTECTION_NOT_CONFIRMED', canSubmit: false });
}

export function normalizeBinanceFuturesOrderR119(input) { return normalizeBinanceFuturesReceiptR119({ ...input, kind: 'order' }); }
export function normalizeBinanceFuturesAlgoR119(input) { return normalizeBinanceFuturesReceiptR119({ ...input, kind: 'algo' }); }

/** Refresh the clock for durable identity lookup/cancel, including a close command. */
export function buildBinanceFuturesLookupR119(input) {
 exact(input, ['binding', 'kind', 'clientId', 'symbol', 'timestamp', 'recvWindow', 'action']);
 const { kind, symbol, timestamp, recvWindow = 5000, action = 'query' } = input;
 const b = binding(input.binding), id = clientId(input.clientId), timing = clock(timestamp, recvWindow);
 if (!['order', 'algo'].includes(kind) || !['query', 'cancel'].includes(action)) fail('FUTURES_PROTOCOL_INVALID_LOOKUP');
 if (kind === 'order' && (typeof symbol !== 'string' || !/^[A-Z0-9]{2,30}$/.test(symbol))) fail('FUTURES_PROTOCOL_INVALID_SYMBOL');
 if (kind === 'algo' && symbol !== undefined) fail('FUTURES_PROTOCOL_ALGO_LOOKUP_HAS_NO_SYMBOL');
 return request(b, action === 'query' ? 'GET' : 'DELETE', kind === 'order' ? '/fapi/v1/order' : '/fapi/v1/algoOrder',
  { ...(kind === 'order' ? { symbol, origClientOrderId: id } : { clientAlgoId: id }), ...timing });
}
