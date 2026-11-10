/** ProfitDLL wire translation. Consumes final robot decisions; never generates/inverts signals.
 * No DLL, credentials, transport, account authorization or risk reservation lives here.
 * Native Int64 fields cross JSON as decimal strings. The Windows bridge must use Int64.
 */
const fail = code => { throw Object.assign(new Error(code), {code}); };
const freeze = value => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};
const I64 = 9223372036854775807n;
const SCALE = 100000000n;
const modes = new Set(['manual', 'hybrid', 'reverse', 'ultrafast']);
function object(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).some(key => !keys.includes(key))) fail('PROFIT_INVALID_FIELDS');
}
function reference(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9._:-]{1,100}$/.test(value)) fail('PROFIT_INVALID_REFERENCE');
  return value;
}
function int64(value, {zero = false, signed = false} = {}) {
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || Object.is(value, -0)) fail('PROFIT_INT64_PRECISION');
    value = String(value);
  }
  if (typeof value !== 'string' || !/^(0|[1-9]\d{0,18}|-[1-9]\d{0,18})$/.test(value)) fail('PROFIT_INVALID_INT64');
  const n = BigInt(value);
  if (n > I64 || n < -I64 - 1n || (!signed && n < 0n) || (!zero && n === 0n)) fail('PROFIT_INVALID_INT64');
  return value;
}
function price(value) {
  if (typeof value !== 'string' || !/^(0|[1-9]\d{0,11})(\.\d{1,8})?$/.test(value)) fail('PROFIT_INVALID_PRICE');
  const [whole, fraction = ''] = value.split('.');
  const scaled = BigInt(whole) * SCALE + BigInt(fraction.padEnd(8, '0'));
  if (scaled <= 0n) fail('PROFIT_INVALID_PRICE');
  return scaled;
}
function nativePrice(value, tick) {
  if (price(value) % tick !== 0n) fail('PROFIT_PRICE_OFF_TICK');
  const n = Number(value);
  if (!Number.isFinite(n) || price(String(n)) !== price(value)) fail('PROFIT_PRICE_PRECISION');
  return n;
}
function time(value) {
  if (!Number.isSafeInteger(value) || value <= 0) fail('PROFIT_INVALID_TIME');
  return value;
}
function account(value) {
  object(value, ['brokerId', 'accountId', 'subAccountId']);
  if (!Number.isSafeInteger(value.brokerId) || value.brokerId <= 0 || value.brokerId > 2147483647) fail('PROFIT_INVALID_BROKER');
  reference(value.accountId);
  if (value.subAccountId !== null) reference(value.subAccountId);
  return {brokerId: value.brokerId, accountId: value.accountId, subAccountId: value.subAccountId};
}
const sameAccount = (a, b) => a.brokerId === b.brokerId && a.accountId === b.accountId && a.subAccountId === b.subAccountId;
const nativeAccount = a => ({Version: 0, BrokerID: a.brokerId, AccountID: a.accountId, SubAccountID: a.subAccountId, Reserved: '0'});

/** Selection must use the private bridge's GetAccounts output, never the first account by default.
 * Matching metadata is NOT proof of ownership or permission to trade.
 */
export function selectProfitAccount(discoveredAccounts, requested) {
  const target = account(requested);
  if (!Array.isArray(discoveredAccounts) || discoveredAccounts.length === 0 || discoveredAccounts.length > 1000) fail('PROFIT_ACCOUNT_LIST_REQUIRED');
  const matches = discoveredAccounts.map(account).filter(row => sameAccount(row, target));
  if (matches.length !== 1) fail(matches.length ? 'PROFIT_ACCOUNT_AMBIGUOUS' : 'PROFIT_ACCOUNT_NOT_FOUND');
  return freeze(matches[0]);
}

/** A format-only draft, including market and stop-limit rules documented by Nelogica.
 * Instrument metadata must later come from the authenticated bridge and risk policy.
 * Protective exits/OCO are NOT installed by formatting an entry.
 */
export function profitOrderDraft({selectedAccount, instrument, order, nowMs}) {
  const a = account(selectedAccount);
  object(instrument, ['ticker', 'exchange', 'tickSize', 'quantityStep', 'maxQuantity', 'observedAtMs', 'validUntilMs']);
  object(order, ['clientOrderId', 'mode', 'action', 'side', 'type', 'quantity', 'price', 'stopPrice']);
  time(nowMs); time(instrument.observedAtMs); time(instrument.validUntilMs);
  if (instrument.observedAtMs > nowMs || nowMs - instrument.observedAtMs > 30000 || instrument.validUntilMs <= nowMs) fail('PROFIT_STALE_INSTRUMENT');
  if (typeof instrument.ticker !== 'string' || !/^[A-Z][A-Z0-9]{2,19}$/.test(instrument.ticker) ||
      /FUT$/.test(instrument.ticker) || !['B', 'F'].includes(instrument.exchange)) fail('PROFIT_EXACT_INSTRUMENT_REQUIRED');
  const tick = price(instrument.tickSize);
  const step = BigInt(int64(instrument.quantityStep)), max = BigInt(int64(instrument.maxQuantity));
  const quantity = int64(order.quantity);
  if (BigInt(quantity) % step !== 0n || BigInt(quantity) > max) fail('PROFIT_QUANTITY_OFF_LIMITS');
  reference(order.clientOrderId);
  if (!modes.has(order.mode) || !['open', 'close'].includes(order.action) || !['buy', 'sell'].includes(order.side)) fail('PROFIT_FINAL_DECISION_REQUIRED');
  const orderType = {market: 1, limit: 2, stop_limit: 4}[order.type];
  if (![1, 2, 4].includes(orderType)) fail('PROFIT_ORDER_TYPE_UNSUPPORTED');
  if (orderType === 1 && (order.price != null || order.stopPrice != null)) fail('PROFIT_MARKET_PRICE_FORBIDDEN');
  if (orderType === 2 && order.stopPrice != null) fail('PROFIT_UNEXPECTED_STOP_PRICE');
  const limit = orderType === 1 ? -1 : nativePrice(order.price, tick);
  const stop = orderType === 4 ? nativePrice(order.stopPrice, tick) : -1;
  if (orderType === 4 && (order.side === 'buy' ? price(order.price) < price(order.stopPrice) : price(order.price) > price(order.stopPrice))) fail('PROFIT_STOP_LIMIT_DIRECTION');
  return freeze({
    clientOrderId: order.clientOrderId, mode: order.mode, action: order.action,
    finalSide: order.side, inversionAppliedByAdapter: false,
    nativeFields: {Version: 2, AccountID: nativeAccount(a),
      AssetID: {Version: 0, Ticker: instrument.ticker, Exchange: instrument.exchange, FeedType: 0},
      OrderType: orderType, OrderSide: order.side === 'buy' ? 1 : 2,
      Price: limit, StopPrice: stop, Quantity: quantity, MessageID: '0'},
    credentialsIncluded: false, protectionInstalled: false,
    riskReserved: false, canSubmit: false, ordersSent: 0
  });
}

/** LocalOrderID is session-scoped. ClOrderID is the permanent broker reference.
 * No broad cancel-all fallback; a missing identity requires independent reconciliation.
 */
export function profitOrderReference({localOrderId, clOrderId, orderSessionId, currentSessionId}) {
  reference(currentSessionId); reference(orderSessionId);
  if (clOrderId !== null && clOrderId !== undefined) {
    reference(clOrderId);
    return freeze({Version: 0, LocalOrderID: '0', ClOrderID: clOrderId});
  }
  if (orderSessionId !== currentSessionId) fail('PROFIT_RESTART_REQUIRES_BROKER_ID');
  return freeze({Version: 0, LocalOrderID: int64(localOrderId), ClOrderID: null});
}

export function profitSendReceipt(value) {
  if (value === null || value === undefined) return freeze({state: 'UNKNOWN', localOrderId: null, executionConfirmed: false, resubmitAllowed: false});
  const result = int64(value, {zero: true, signed: true});
  if (BigInt(result) <= 0n) return freeze({state: result === '0' ? 'UNKNOWN' : 'LOCAL_REJECTED', code: result,
    localOrderId: null, executionConfirmed: false, resubmitAllowed: false});
  return freeze({state: 'LOCAL_ACCEPTED', localOrderId: result, executionConfirmed: false, resubmitAllowed: false});
}

export function profitCancelDraft({selectedAccount, orderAccount, orderReference}) {
  const a = account(selectedAccount);
  if (!sameAccount(a, account(orderAccount))) fail('PROFIT_ORDER_SCOPE_MISMATCH');
  return freeze({nativeFields: {Version: 1, AccountID: nativeAccount(a),
    OrderID: profitOrderReference(orderReference), MessageID: '0'},
    credentialsIncluded: false, cancelConfirmed: false, closesPosition: false,
    canSubmit: false, ordersSent: 0});
}

const statusNames = new Map([[0, 'NEW'], [1, 'PARTIAL'], [2, 'FILLED'], [4, 'CANCELLED'],
  [5, 'REPLACED'], [6, 'PENDING_CANCEL'], [7, 'STOPPED'], [8, 'REJECTED'], [9, 'SUSPENDED'],
  [10, 'PENDING_NEW'], [12, 'EXPIRED'], [14, 'PENDING_REPLACE'], [15, 'PARTIAL_CANCELLED'],
  [16, 'RECEIVED'], [18, 'PARTIAL_REJECTED'], [200, 'UNKNOWN'], [205, 'ADMIN_CANCELLED']]);
const terminal = new Set([2, 4, 8, 12, 15, 18, 205]);

/** Normalize GetOrderDetails, not a guessed fill from a callback or an absent open order.
 * All values are copied by the Windows bridge before returning from the native callback.
 * Expected identity/quantity and prior cumulative fill come from the durable order journal.
 */
export function observeProfitOrder({expected, observation, nowMs}) {
  object(expected, ['account', 'ticker', 'exchange', 'side', 'quantity', 'localOrderId', 'clOrderId', 'sessionId', 'knownFilledQuantity']);
  object(observation, ['account', 'ticker', 'exchange', 'side', 'quantity', 'localOrderId', 'clOrderId', 'sessionId', 'filledQuantity', 'leavesQuantity', 'status', 'observedAtMs']);
  time(nowMs); time(observation.observedAtMs);
  if (observation.observedAtMs > nowMs || nowMs - observation.observedAtMs > 30000) fail('PROFIT_STALE_ORDER');
  if (!sameAccount(account(expected.account), account(observation.account)) ||
      expected.ticker !== observation.ticker || expected.exchange !== observation.exchange ||
      !['buy', 'sell'].includes(expected.side) || expected.side !== observation.side) fail('PROFIT_ORDER_SCOPE_MISMATCH');
  reference(expected.ticker); reference(expected.sessionId); reference(observation.sessionId);
  if (!['B', 'F'].includes(expected.exchange)) fail('PROFIT_ORDER_SCOPE_MISMATCH');
  const observedLocal = int64(observation.localOrderId, {zero: true});
  if (observation.clOrderId !== null) reference(observation.clOrderId);
  if (expected.clOrderId !== null) {
    reference(expected.clOrderId);
    if (expected.clOrderId !== observation.clOrderId) fail('PROFIT_ORDER_ID_MISMATCH');
  } else if (expected.sessionId !== observation.sessionId || int64(expected.localOrderId) !== observedLocal) {
    fail('PROFIT_ORDER_ID_MISMATCH');
  }
  const quantity = int64(observation.quantity);
  const filled = int64(observation.filledQuantity, {zero: true});
  const leaves = int64(observation.leavesQuantity, {zero: true});
  const known = int64(expected.knownFilledQuantity, {zero: true});
  if (quantity !== int64(expected.quantity) || BigInt(filled) > BigInt(quantity) ||
      BigInt(known) > BigInt(quantity) || BigInt(leaves) > BigInt(quantity) - BigInt(filled)) fail('PROFIT_INCONSISTENT_QUANTITY');
  if (BigInt(filled) < BigInt(known)) fail('PROFIT_FILL_REGRESSION');
  const status = observation.status;
  const state = statusNames.get(status);
  if (!state) fail('PROFIT_UNKNOWN_STATUS');
  if (status === 2 && (filled !== quantity || leaves !== '0')) fail('PROFIT_INCONSISTENT_FILLED');
  if ([1, 15, 18].includes(status) && (filled === '0' || BigInt(filled) >= BigInt(quantity))) fail('PROFIT_INCONSISTENT_PARTIAL');
  if (status === 8 && filled !== '0') fail('PROFIT_INCONSISTENT_REJECTED');
  return freeze({state, terminalOrder: terminal.has(status), cumulativeFilledQuantity: filled,
    remainingQuantity: leaves, clOrderId: observation.clOrderId,
    localOrderId: observedLocal, sessionId: observation.sessionId,
    // A filled entry or cancelled partial order still leaves a position to reconcile.
    positionReconciliationRequired: filled !== '0',
    independentReconciliationRequired: ![1, 2, 4, 8, 12, 15, 18, 205].includes(status),
    riskReleased: false, resubmitAllowed: false, ordersSent: 0});
}

/** Tracks native TStateCallback independently for login/routing/data/license.
 * Any state loss invalidates the prior epoch. Reconnection never authorizes replay.
 */
export function createProfitConnectionTracker() {
  const expected = [0, 5, 4, 0];
  let states = [null, null, null, null], epoch = 0, lastAt = 0;
  const snapshot = () => freeze({states: [...states], epoch, observedAtMs: lastAt,
    nativeConnectionsReady: states.every((value, index) => value === expected[index]),
    reconciliationRequired: true, executionAuthorized: false, resubmitAllowed: false});
  return Object.freeze({
    observe(type, result, atMs) {
      time(atMs);
      if (!Number.isInteger(type) || type < 0 || type > 3 || !Number.isInteger(result) || result < 0 || result > 2147483647) fail('PROFIT_INVALID_CONNECTION_EVENT');
      if (atMs < lastAt) fail('PROFIT_OUT_OF_ORDER_CONNECTION_EVENT');
      if (result !== expected[type]) {
        epoch++;
        // A login/license loss invalidates the whole session. Routing/data transitions
        // only invalidate that channel; the provider may not repeat other callbacks.
        if (type === 0 || type === 3) states = [null, null, null, null];
      }
      states[type] = result; lastAt = atMs;
      return snapshot();
    },
    snapshot
  });
}
