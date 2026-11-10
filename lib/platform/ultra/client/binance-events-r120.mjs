/** Offline-only normalization of caller-supplied Binance JSON event fixtures.
 * No transport, storage, credentials, account authentication, or trade authority.
 * A normalized event is evidence, never a position/protection/accounting decision.
 */
import { createHash } from 'node:crypto';

const fail = code => { throw Error(`R120_EVENT_${code}`); };
const MAX_INTEGER = 9223372036854775807n;
const SCALE = 10n ** 18n;
const forbidden = /secret|password|signature|api[_-]?key|authorization|token|credential|headers|listen[_-]?key|private[_-]?key/i;
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
const canonical = value => value && typeof value === 'object'
  ? Array.isArray(value) ? `[${value.map(canonical).join(',')}]`
    : `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`
  : JSON.stringify(value);
const hash = value => createHash('sha256').update(value).digest('hex');

// Reject lossy JS numbers, executable accessors, hidden data and non-JSON values.
// Copy rather than mutate/freeze caller objects. Bounds also apply to unknown events.
function jsonCopy(value, depth = 0, budget = { nodes: 0 }, ancestors = new Set()) {
  if (++budget.nodes > 4096 || depth > 12) fail('PAYLOAD_LIMIT');
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'string') { if (value.length > 4096 || /[\u0000-\u001f\u007f]/u.test(value)) fail('STRING_INVALID'); return value; }
  if (typeof value === 'number') { if (!Number.isSafeInteger(value) || Object.is(value, -0)) fail('UNSAFE_NUMBER'); return value; }
  if (!value || typeof value !== 'object' || ancestors.has(value)) fail('JSON_REQUIRED');
  if (!Array.isArray(value) && ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail('PLAIN_OBJECT_REQUIRED');
  if (Object.getOwnPropertySymbols(value).length) fail('JSON_REQUIRED');
  ancestors.add(value);
  const descriptors = Object.getOwnPropertyDescriptors(value), result = Array.isArray(value) ? [] : {};
  for (const [key, descriptor] of Object.entries(descriptors)) {
    if (Array.isArray(value) && key === 'length') continue;
    if (!descriptor.enumerable || !Object.hasOwn(descriptor, 'value') || ['__proto__', 'constructor', 'prototype'].includes(key)) fail('JSON_REQUIRED');
    if (key.length > 128 || forbidden.test(key)) fail('CREDENTIAL_OR_FIELD_REJECTED');
    if (Array.isArray(value) && !/^(0|[1-9]\d*)$/.test(key)) fail('JSON_REQUIRED');
    result[key] = jsonCopy(descriptor.value, depth + 1, budget, ancestors);
  }
  if (Array.isArray(value) && Object.keys(result).length !== value.length) fail('JSON_REQUIRED');
  ancestors.delete(value);
  return result;
}
function object(value) { if (!value || typeof value !== 'object' || Array.isArray(value)) fail('OBJECT_REQUIRED'); return value; }
function exact(value, keys) { object(value); if (Object.keys(value).some(k => !keys.includes(k))) fail('UNEXPECTED_FIELD'); }
function text(value, max = 128) { if (typeof value !== 'string' || !value || value.length > max) fail('TEXT_INVALID'); return value; }
function symbol(value) { text(value, 64); if (!/^[\p{L}\p{N}_-]+$/u.test(value)) fail('SYMBOL_INVALID'); return value; }
function client(value) { text(value, 64); if (!/^[.A-Za-z0-9_:/-]+$/.test(value)) fail('CLIENT_ID_INVALID'); return value; }
function integer(value, allowNegativeOne = false) {
  const v = typeof value === 'number' && Number.isSafeInteger(value) ? String(value) : value;
  if (allowNegativeOne && v === '-1') return v;
  if (typeof v !== 'string' || !/^(0|[1-9]\d{0,18})$/.test(v) || BigInt(v) > MAX_INTEGER) fail('INTEGER_INVALID');
  return v;
}
function decimal(value, signed = false) {
  if (typeof value !== 'string' || !(signed ? /^-?(0|[1-9]\d{0,17})(\.\d{1,18})?$/ : /^(0|[1-9]\d{0,17})(\.\d{1,18})?$/).test(value)) fail('DECIMAL_INVALID');
  const negative = value[0] === '-', [whole, fraction = ''] = (negative ? value.slice(1) : value).split('.');
  const tail = fraction.replace(/0+$/, '');
  const result = whole + (tail ? `.${tail}` : '');
  return negative && result !== '0' ? `-${result}` : result;
}
const units = value => { const [whole, fraction = ''] = value.split('.'); return BigInt(whole) * SCALE + BigInt(fraction.padEnd(18, '0')); };
const enumValue = (value, options) => { if (!options.includes(value)) fail('ENUM_UNSUPPORTED'); return value; };
const optional = (raw, name, fn) => raw[name] === undefined ? null : fn(raw[name]);
function fields(raw, names, fn) { for (const name of names.split(' ')) if (Object.hasOwn(raw, name)) raw[name] = fn(raw[name]); }
const bool = value => { if (typeof value !== 'boolean') fail('BOOLEAN_INVALID'); return value; };
const identifierOrEmpty = value => value === '' ? '' : integer(value);
const SPOT_TYPES = ['executionReport', 'listStatus', 'outboundAccountPosition', 'balanceUpdate', 'externalLockUpdate', 'eventStreamTerminated'];
const FUTURES_TYPES = ['ORDER_TRADE_UPDATE', 'ALGO_UPDATE', 'ACCOUNT_UPDATE', 'ACCOUNT_CONFIG_UPDATE', 'TRADE_LITE', 'MARGIN_CALL', 'CONDITIONAL_ORDER_TRIGGER_REJECT', 'STRATEGY_UPDATE', 'GRID_UPDATE', 'listenKeyExpired'];
const ORDER_STATUS = { NEW: 'open', PENDING_NEW: 'pending', PARTIALLY_FILLED: 'partially_filled', FILLED: 'filled', CANCELED: 'canceled', PENDING_CANCEL: 'pending_cancel', REJECTED: 'rejected', EXPIRED: 'expired', EXPIRED_IN_MATCH: 'expired' };
const ALGO_STATUS = { NEW: 'waiting_trigger', TRIGGERING: 'triggering', TRIGGERED: 'triggered', FINISHED: 'finished_not_fill_proof', CANCELED: 'canceled', REJECTED: 'rejected', EXPIRED: 'expired' };
function status(value, mapping) { if (typeof value !== 'string' || !Object.hasOwn(mapping, value)) fail('STATUS_UNSUPPORTED'); return mapping[value]; }
const reference = (kind, s, clientId, nativeId) => ({ kind, symbol: s, clientId, nativeId });

function orderQuantities(raw, allowQuoteSized = false) {
  for (const name of ['q', 'l', 'z', 'L']) decimal(raw[name]);
  const q = units(raw.q), l = units(raw.l), z = units(raw.z);
  // Spot quote-quantity MARKET orders may have no original base-quantity bound.
  const quoteSized = allowQuoteSized && q === 0n && raw.o === 'MARKET' && raw.Q !== undefined && units(raw.Q) > 0n;
  if (l > z || (z > q && !quoteSized) || (raw.X === 'FILLED' && (z === 0n || (!quoteSized && z !== q))) ||
      (raw.X === 'PARTIALLY_FILLED' && (z === 0n || (!quoteSized && z >= q))) ||
      (['NEW', 'PENDING_NEW', 'REJECTED'].includes(raw.X) && z !== 0n)) fail('QUANTITY_INCONSISTENT');
  if (raw.x === 'TRADE' && (l === 0n || units(raw.L) === 0n)) fail('TRADE_INCOMPLETE');
  // A canceled/expired update can carry cumulative previous fills, not a new fill.
  if (!['TRADE', 'CALCULATED'].includes(raw.x) && l !== 0n) fail('NON_TRADE_LAST_FILL');
  return { requestedQuantity: raw.q, lastFilledQuantity: raw.l, cumulativeFilledQuantity: raw.z, lastFilledPrice: raw.L };
}
function commission(raw, tradeId) {
  if (raw.n === undefined && raw.N === undefined) return null;
  if (raw.n === undefined) fail('COMMISSION_INCOMPLETE');
  const asset = raw.N === null || raw.N === undefined ? null : symbol(raw.N);
  if (raw.n !== '0' && asset === null) fail('COMMISSION_ASSET_REQUIRED');
  return { amount: raw.n, asset, tradeId, scope: 'last_execution', convertedAmount: null };
}
function spotOrder(raw) {
  fields(raw, 'E T i I O W d D j J v u U a gOV', integer);
  fields(raw, 'g t', v => integer(v, true));
  fields(raw, 'q p P F l z L Z Y Q A B pl pL pY gp', decimal);
  fields(raw, 'n', v => decimal(v, true)); fields(raw, 'w m M uS', bool);
  const s = symbol(raw.s), orderId = integer(raw.i), executionId = integer(raw.I), clientId = client(raw.c);
  const originalClientId = raw.C === undefined || raw.C === '' ? null : client(raw.C);
  const orderListId = raw.g === undefined || raw.g === '-1' ? null : integer(raw.g);
  const semanticStatus = status(raw.X, ORDER_STATUS);
  enumValue(raw.x, ['NEW', 'PENDING_NEW', 'CANCELED', 'REPLACED', 'REJECTED', 'TRADE', 'EXPIRED', 'TRADE_PREVENTION']);
  enumValue(raw.S, ['BUY', 'SELL']); text(raw.o); text(raw.f);
  const tradeId = raw.x === 'TRADE' ? integer(raw.t) : null;
  const quantities = orderQuantities(raw, true);
  const refs = [reference('order', s, clientId, orderId)];
  if (originalClientId && originalClientId !== clientId) refs.push(reference('order', s, originalClientId, orderId));
  if (orderListId !== null) refs.push(reference('list', s, null, orderListId));
  return { kind: 'order', symbol: s, orderId, clientOrderId: clientId, origClientOrderId: originalClientId, orderListId,
    executionId, tradeId, side: raw.S, orderType: raw.o, executionType: raw.x, status: raw.X, semanticStatus,
    ...quantities, cumulativeQuoteQuantity: optional(raw, 'Z', decimal), lastQuoteQuantity: optional(raw, 'Y', decimal),
    averagePrice: null, commission: commission(raw, tradeId), lookupReferences: refs,
    terminal: ['FILLED', 'CANCELED', 'REJECTED', 'EXPIRED', 'EXPIRED_IN_MATCH'].includes(raw.X),
    identityParts: [raw.e, s, orderId, executionId], identityStrength: 'native_execution_id' };
}
function spotList(raw) {
  fields(raw, 'E T g', integer);
  const s = symbol(raw.s), orderListId = integer(raw.g), listClientOrderId = client(raw.C);
  enumValue(raw.l, ['RESPONSE', 'EXEC_STARTED', 'ALL_DONE', 'UPDATED']);
  enumValue(raw.L, ['EXECUTING', 'ALL_DONE', 'REJECT']);
  text(raw.c); text(raw.r);
  if (!Array.isArray(raw.O) || raw.O.length > 100) fail('LIST_ORDERS_INVALID');
  const refs = [reference('list', s, listClientOrderId, orderListId)], ids = new Set(), clients = new Set();
  for (const child of raw.O) {
    object(child); const cs = symbol(child.s), id = integer(child.i), cid = client(child.c);
    if (cs !== s || ids.has(id) || clients.has(cid)) fail('LIST_CHILD_CONFLICT');
    child.i = id; ids.add(id); clients.add(cid); refs.push(reference('order', cs, cid, id));
  }
  return { kind: 'list', symbol: s, orderListId, listClientOrderId, status: raw.L, executionType: raw.l,
    semanticStatus: { EXECUTING: 'executing', ALL_DONE: 'finished_not_fill_proof', REJECT: 'rejected' }[raw.L],
    terminal: raw.L !== 'EXECUTING', lookupReferences: refs,
    identityParts: [raw.e, s, orderListId, raw.E, raw.T, raw.l], identityStrength: 'conservative_native_tuple' };
}
function futuresOrder(raw) {
  fields(raw, 'E T', integer); const o = object(raw.o);
  fields(o, 'i T t gtd si ss', integer);
  fields(o, 'q p ap sp l z L b a AP cr', decimal);
  fields(o, 'n rp', v => decimal(v, true)); fields(o, 'm R cp pP', bool);
  const s = symbol(o.s), orderId = integer(o.i), clientId = client(o.c);
  enumValue(o.X, ['NEW', 'PARTIALLY_FILLED', 'FILLED', 'CANCELED', 'EXPIRED', 'EXPIRED_IN_MATCH']);
  const semanticStatus = status(o.X, ORDER_STATUS);
  enumValue(o.x, ['NEW', 'CANCELED', 'CALCULATED', 'EXPIRED', 'TRADE', 'AMENDMENT']);
  enumValue(o.S, ['BUY', 'SELL']); enumValue(o.ps, ['BOTH', 'LONG', 'SHORT']); text(o.o); text(o.f);
  const tradeId = o.x === 'TRADE' ? integer(o.t) : null;
  const quantities = orderQuantities(o), tradeTime = integer(o.T);
  return { kind: 'order', symbol: s, orderId, clientOrderId: clientId, tradeId, side: o.S, positionSide: o.ps,
    orderType: o.o, executionType: o.x, status: o.X, semanticStatus, ...quantities,
    averagePrice: optional(o, 'ap', decimal), tradeTime, commission: commission(o, tradeId),
    reportedRealizedProfit: optional(o, 'rp', v => decimal(v, true)), reduceOnly: optional(o, 'R', bool),
    closeAll: optional(o, 'cp', bool), lookupReferences: [reference('order', s, clientId, orderId)],
    terminal: ['FILLED', 'CANCELED', 'REJECTED', 'EXPIRED', 'EXPIRED_IN_MATCH'].includes(o.X),
    identityParts: tradeId !== null ? [raw.e, s, orderId, 'TRADE', tradeId]
      : [raw.e, s, orderId, o.x, raw.E, raw.T, tradeTime],
    identityStrength: tradeId !== null ? 'native_trade_id' : 'conservative_native_tuple' };
}
function futuresAlgo(raw) {
  fields(raw, 'E T', integer); const o = object(raw.o);
  fields(o, 'aid tt gtd', integer); fields(o, 'ai', identifierOrEmpty);
  fields(o, 'q ap aq tp p', decimal); fields(o, 'cp pP R ia', bool);
  const s = symbol(o.s), algoId = integer(o.aid), clientAlgoId = client(o.caid);
  const actualOrderId = o.ai === undefined || o.ai === '' ? null : integer(o.ai);
  const semanticStatus = status(o.X, ALGO_STATUS);
  enumValue(o.at, ['CONDITIONAL']); enumValue(o.S, ['BUY', 'SELL']); enumValue(o.ps, ['BOTH', 'LONG', 'SHORT']);
  text(o.o); text(o.f); decimal(o.q); decimal(o.tp); decimal(o.p);
  const refs = [reference('algo', s, clientAlgoId, algoId)];
  if (actualOrderId !== null) refs.push(reference('order', s, null, actualOrderId));
  return { kind: 'algo', symbol: s, algoId, clientAlgoId, actualOrderId, side: o.S, positionSide: o.ps,
    orderType: o.o, status: o.X, semanticStatus, requestedQuantity: o.q,
    // aq is an algo-service observation; do not present it as an individual trade.
    reportedActualExecutedQuantity: optional(o, 'aq', decimal), reportedActualAveragePrice: optional(o, 'ap', decimal),
    triggerPrice: o.tp, triggerTime: optional(o, 'tt', integer), reduceOnly: optional(o, 'R', bool), closeAll: optional(o, 'cp', bool),
    lookupReferences: refs, terminal: ['FINISHED', 'CANCELED', 'REJECTED', 'EXPIRED'].includes(o.X),
    identityParts: [raw.e, s, algoId, raw.E, raw.T, o.X], identityStrength: 'conservative_native_tuple' };
}

/** Event timestamps and every native ID are decimal strings. timeUnit is explicit
 * metadata (default MILLISECOND); no magnitude-based guessing or float rounding.
 * Native identities are account/product scoped; wrappers are transport metadata.
 */
export function normalizeBinanceEventR120(input) {
  const safe = jsonCopy(input); exact(safe, ['binding', 'payload', 'timeUnit']);
  const b = object(safe.binding); exact(b, ['product', 'environment', 'keyFingerprint', 'mode']);
  if (!['spot', 'usds_m_futures'].includes(b.product) || b.environment !== 'demo' || b.mode !== 'offline_fixture' ||
      typeof b.keyFingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(b.keyFingerprint)) fail('OFFLINE_BINDING_REQUIRED');
  const timeUnit = safe.timeUnit ?? 'MILLISECOND'; enumValue(timeUnit, b.product === 'spot' ? ['MILLISECOND', 'MICROSECOND'] : ['MILLISECOND']);
  let raw = object(safe.payload), subscriptionId = null;
  if (Object.hasOwn(raw, 'event')) {
    exact(raw, ['subscriptionId', 'event']);
    if (b.product !== 'spot') fail('ENVELOPE_PRODUCT_MISMATCH');
    subscriptionId = integer(raw.subscriptionId); raw = object(raw.event);
  } else if (Object.hasOwn(raw, 'data') || Object.hasOwn(raw, 'stream') || Object.hasOwn(raw, 'subscriptionId')) fail('ENVELOPE_UNSUPPORTED');
  if (['binding', 'product', 'environment', 'mode', 'source'].some(k => Object.hasOwn(raw, k))) fail('EMBEDDED_BINDING_REJECTED');
  const eventType = text(raw.e, 64);
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(eventType)) fail('TYPE_INVALID');
  if ((b.product === 'spot' && FUTURES_TYPES.includes(eventType)) || (b.product === 'usds_m_futures' && SPOT_TYPES.includes(eventType))) fail('PRODUCT_MISMATCH');
  raw.E = integer(raw.E); if (raw.T !== undefined) raw.T = integer(raw.T);
  let result;
  if (eventType === 'executionReport') result = spotOrder(raw);
  else if (eventType === 'listStatus') result = spotList(raw);
  else if (eventType === 'ORDER_TRADE_UPDATE') result = futuresOrder(raw);
  else if (eventType === 'ALGO_UPDATE') result = futuresAlgo(raw);
  else if (['eventStreamTerminated', 'listenKeyExpired'].includes(eventType)) result = {
    kind: 'stream', status: 'TERMINATED', semanticStatus: 'terminated', terminal: true,
    lookupReferences: [], identityParts: [eventType, raw.E], identityStrength: 'conservative_native_tuple',
  };
  else result = { kind: 'unknown', status: 'UNSUPPORTED_EVENT', semanticStatus: 'unknown', terminal: false,
    lookupReferences: [], identityParts: [eventType, raw.E, raw.T ?? null, hash(canonical(raw))], identityStrength: 'payload_only' };
  if (['order', 'list', 'algo'].includes(result.kind) && raw.T === undefined) fail('TRANSACTION_TIME_REQUIRED');
  const { identityParts, ...normalized } = result;
  const canonicalPayload = raw, payloadDigest = hash(canonical(raw));
  return freeze({ schema: 'JENIOS_ULTRA_BINANCE_EVENT_R120', product: b.product, binding: b,
    eventType, eventTime: raw.E, transactionTime: raw.T ?? null, timeUnit, subscriptionId,
    recognized: result.kind !== 'unknown', symbol: null, orderId: null, clientOrderId: null,
    algoId: null, clientAlgoId: null, orderListId: null, listClientOrderId: null, tradeId: null,
    lastFilledQuantity: null, cumulativeFilledQuantity: null, commission: null, ...normalized,
    identityKey: `be120_${hash(canonical({ binding: b, timeUnit, identityParts }))}`,
    canonicalPayload, payloadDigest, sequence: null, sequenceGuaranteed: false,
    needsReconciliation: true, evidenceAuthenticated: false, canSubmit: false, ordersSent: 0,
    protectionInstalled: false, positionClosed: false, netProfit: null, financialRecordPending: true });
}
