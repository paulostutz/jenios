import test from 'node:test';
import assert from 'node:assert/strict';
import {profitOrderDraft, selectProfitAccount, profitOrderReference, profitSendReceipt,
  profitCancelDraft, observeProfitOrder, createProfitConnectionTracker} from '../lib/platform/connections/profit-protocol-r109.mjs';
import {reverseOperatorCommand} from '../lib/platform/research/b290-inversion-signal-contract.mjs';

const now = 1793228400000;
const account = {brokerId: 999, accountId: 'TEST_ACCOUNT', subAccountId: null};
const instrument = {ticker: 'WINZ26', exchange: 'F', tickSize: '5', quantityStep: '1',
  maxQuantity: '10', observedAtMs: now - 100, validUntilMs: now + 60000};
const order = {clientOrderId: 'synthetic-entry-1', mode: 'manual', action: 'open',
  side: 'buy', type: 'limit', quantity: '2', price: '130000'};
const draft = (patch = {}, meta = instrument) => profitOrderDraft({selectedAccount: account, instrument: meta, order: {...order, ...patch}, nowMs: now});
const expected = {account, ticker: 'WINZ26', exchange: 'F', side: 'buy', quantity: '2',
  localOrderId: '9223372036854775806', clOrderId: null, sessionId: 'session-1', knownFilledQuantity: '0'};
const observation = {account, ticker: 'WINZ26', exchange: 'F', side: 'buy', quantity: '2',
  localOrderId: expected.localOrderId, clOrderId: 'BROKER_TEST_ID', sessionId: 'session-1',
  filledQuantity: '0', leavesQuantity: '2', status: 0, observedAtMs: now};
const observe = (patch = {}, previous = {}) => observeProfitOrder({expected: {...expected, ...previous}, observation: {...observation, ...patch}, nowMs: now});
const throws = (fn, code) => assert.throws(fn, {code});

test('R109 account selection uses the full account/broker/subaccount tuple', () => {
  const other = {...account, brokerId: 998}, sub = {...account, subAccountId: 'sub'};
  assert.deepEqual(selectProfitAccount([other, sub, account], account), account);
  throws(() => selectProfitAccount([other], account), 'PROFIT_ACCOUNT_NOT_FOUND');
  throws(() => selectProfitAccount([account, {...account}], account), 'PROFIT_ACCOUNT_AMBIGUOUS');
  throws(() => selectProfitAccount([account], {...account, password: 'fixture'}), 'PROFIT_INVALID_FIELDS');
});

for (const mode of ['manual', 'hybrid', 'reverse', 'ultrafast']) {
  test('R109 preserves the final decision for ' + mode, () => {
    const result = draft({mode, side: 'sell'});
    assert.equal(result.nativeFields.OrderSide, 2);
    assert.equal(result.finalSide, 'sell');
    assert.equal(result.inversionAppliedByAdapter, false);
    assert.equal(result.canSubmit, false);
    assert.equal(result.protectionInstalled, false);
    assert.equal(result.ordersSent, 0);
    assert.ok(Object.isFrozen(result.nativeFields.AssetID));
    assert.equal('Password' in result.nativeFields, false);
    assert.equal(result.nativeFields.AssetID.Ticker, 'WINZ26');
    assert.equal(result.nativeFields.MessageID, '0');
  });
}

test('R109 consumes existing reverse/megatrend decisions without a second inversion', () => {
  const input = {eventId: 'synthetic-signal', action: 'open', side: 'buy'};
  const reversed = reverseOperatorCommand(input);
  assert.equal(draft({mode: 'reverse', side: reversed.side}).nativeFields.OrderSide, 2);
  const megatrend = reverseOperatorCommand(input, {megaTrendDirection: 'buy'});
  assert.equal(draft({mode: 'reverse', side: megatrend.side}).nativeFields.OrderSide, 1);
  const exit = reverseOperatorCommand({...input, action: 'close', side: 'sell'});
  assert.equal(draft({mode: 'reverse', action: 'close', side: exit.side}).nativeFields.OrderSide, 2);
});

test('R109 market, limit and stop-limit encode the documented sentinel prices', () => {
  const market = draft({type: 'market', price: null}).nativeFields;
  assert.equal(market.OrderType, 1); assert.equal(market.Price, -1); assert.equal(market.StopPrice, -1);
  assert.equal(draft().nativeFields.StopPrice, -1);
  const stop = draft({type: 'stop_limit', side: 'sell', price: '129500', stopPrice: '129700'}).nativeFields;
  assert.equal(stop.OrderType, 4); assert.equal(stop.Price, 129500); assert.equal(stop.StopPrice, 129700);
  throws(() => draft({type: 'market'}), 'PROFIT_MARKET_PRICE_FORBIDDEN');
  throws(() => draft({stopPrice: '129700'}), 'PROFIT_UNEXPECTED_STOP_PRICE');
  throws(() => draft({type: 'stop_limit', side: 'sell', price: '129800', stopPrice: '129700'}), 'PROFIT_STOP_LIMIT_DIRECTION');
  throws(() => draft({type: 'stop_limit', price: '129500', stopPrice: '129700'}), 'PROFIT_STOP_LIMIT_DIRECTION');
});

test('R109 instrument precision and expiry reject unsafe drafts', () => {
  for (const ticker of ['WINFUT', 'WDOFUT', 'INDFUT', 'WINZ26;DROP', '../../asset']) {
    throws(() => draft({}, {...instrument, ticker}), 'PROFIT_EXACT_INSTRUMENT_REQUIRED');
  }
  throws(() => draft({price: '130001'}), 'PROFIT_PRICE_OFF_TICK');
  throws(() => draft({price: NaN}), 'PROFIT_INVALID_PRICE');
  throws(() => draft({quantity: '11'}), 'PROFIT_QUANTITY_OFF_LIMITS');
  throws(() => draft({quantity: '3'}, {...instrument, quantityStep: '2'}), 'PROFIT_QUANTITY_OFF_LIMITS');
  for (const patch of [{observedAtMs: now - 30001}, {observedAtMs: now + 1}, {validUntilMs: now}]) {
    throws(() => draft({}, {...instrument, ...patch}), 'PROFIT_STALE_INSTRUMENT');
  }
  throws(() => draft({routingPassword: 'synthetic'}), 'PROFIT_INVALID_FIELDS');
  throws(() => draft({type: 'arbitrary'}), 'PROFIT_ORDER_TYPE_UNSUPPORTED');
});

test('R109 large Int64 IDs and quantities survive JSON round trips without truncation', () => {
  const id = '9223372036854775807';
  assert.equal(JSON.parse(JSON.stringify(profitSendReceipt(id))).localOrderId, id);
  assert.equal(draft({quantity: id}, {...instrument, maxQuantity: id}).nativeFields.Quantity, id);
  throws(() => profitSendReceipt(Number(id)), 'PROFIT_INT64_PRECISION');
  throws(() => profitSendReceipt('9223372036854775808'), 'PROFIT_INVALID_INT64');
  for (const value of ['1e6', '01', '-0', '1.5', true]) throws(() => profitSendReceipt(value), 'PROFIT_INVALID_INT64');
  throws(() => profitSendReceipt(-0), 'PROFIT_INT64_PRECISION');
});

test('R109 native receipt never means execution and never permits blind retransmission', () => {
  for (const [value, state] of [['4294967299', 'LOCAL_ACCEPTED'], [-2147483646, 'LOCAL_REJECTED'], [0, 'UNKNOWN'], [null, 'UNKNOWN']]) {
    const result = profitSendReceipt(value);
    assert.equal(result.state, state); assert.equal(result.executionConfirmed, false); assert.equal(result.resubmitAllowed, false);
  }
});

test('R109 recovery uses the permanent broker ID rather than a recycled local ID', () => {
  const ref = {localOrderId: expected.localOrderId, clOrderId: 'BROKER_TEST_ID', orderSessionId: 'old', currentSessionId: 'new'};
  assert.deepEqual(profitOrderReference(ref), {Version: 0, LocalOrderID: '0', ClOrderID: 'BROKER_TEST_ID'});
  throws(() => profitOrderReference({...ref, clOrderId: null}), 'PROFIT_RESTART_REQUIRES_BROKER_ID');
  assert.equal(profitOrderReference({...ref, clOrderId: null, currentSessionId: 'old'}).LocalOrderID, expected.localOrderId);
});

test('R109 cancellation addresses one matching account/order and does not close positions', () => {
  const input = {selectedAccount: account, orderAccount: account,
    orderReference: {localOrderId: expected.localOrderId, clOrderId: 'BROKER_TEST_ID', orderSessionId: 'old', currentSessionId: 'new'}};
  const result = profitCancelDraft(input);
  assert.equal(result.nativeFields.Version, 1);
  assert.equal(result.nativeFields.OrderID.ClOrderID, 'BROKER_TEST_ID');
  assert.equal(result.cancelConfirmed, false); assert.equal(result.closesPosition, false); assert.equal(result.canSubmit, false);
  throws(() => profitCancelDraft({...input, orderAccount: {...account, brokerId: 123}}), 'PROFIT_ORDER_SCOPE_MISMATCH');
});

test('R109 partial fills, filled entries and partial cancellation retain exposure', () => {
  for (const [status, state, filled, leaves] of [[1, 'PARTIAL', '1', '1'], [2, 'FILLED', '2', '0'],
    [15, 'PARTIAL_CANCELLED', '1', '0'], [18, 'PARTIAL_REJECTED', '1', '0'], [4, 'CANCELLED', '1', '0']]) {
    const result = observe({status, filledQuantity: filled, leavesQuantity: leaves});
    assert.equal(result.state, state); assert.equal(result.cumulativeFilledQuantity, filled);
    assert.equal(result.riskReleased, false); assert.equal(result.resubmitAllowed, false);
    assert.equal(result.positionReconciliationRequired, true);
  }
  const pending = observe({status: 6});
  assert.equal(pending.terminalOrder, false); assert.equal(pending.independentReconciliationRequired, true);
});

test('R109 cannot attach observations from another account, instrument, side or local session', () => {
  for (const patch of [{account: {...account, subAccountId: 'other'}}, {ticker: 'WDOZ26'}, {exchange: 'B'}, {side: 'sell'}]) {
    throws(() => observe(patch), 'PROFIT_ORDER_SCOPE_MISMATCH');
  }
  throws(() => observe({localOrderId: '1'}), 'PROFIT_ORDER_ID_MISMATCH');
  throws(() => observe({sessionId: 'new-session'}), 'PROFIT_ORDER_ID_MISMATCH');
  assert.equal(observe({sessionId: 'new-session', localOrderId: '9'}, {clOrderId: 'BROKER_TEST_ID'}).state, 'NEW');
  throws(() => observe({clOrderId: 'wrong'}, {clOrderId: 'BROKER_TEST_ID'}), 'PROFIT_ORDER_ID_MISMATCH');
});

test('R109 inconsistent quantities and stale events require reconciliation', () => {
  throws(() => observe({quantity: '3'}), 'PROFIT_INCONSISTENT_QUANTITY');
  throws(() => observe({filledQuantity: '3'}), 'PROFIT_INCONSISTENT_QUANTITY');
  throws(() => observe({leavesQuantity: '3'}), 'PROFIT_INCONSISTENT_QUANTITY');
  throws(() => observe({status: 2}), 'PROFIT_INCONSISTENT_FILLED');
  throws(() => observe({status: 15, leavesQuantity: '0'}), 'PROFIT_INCONSISTENT_PARTIAL');
  throws(() => observe({status: 8, filledQuantity: '1', leavesQuantity: '0'}), 'PROFIT_INCONSISTENT_REJECTED');
  throws(() => observe({}, {knownFilledQuantity: '1'}), 'PROFIT_FILL_REGRESSION');
  throws(() => observe({status: 999}), 'PROFIT_UNKNOWN_STATUS');
  throws(() => observe({observedAtMs: now - 30001}), 'PROFIT_STALE_ORDER');
  throws(() => observe({observedAtMs: now + 1}), 'PROFIT_STALE_ORDER');
});

test('R109 loss of routing blocks readiness and reconnection never authorizes execution', () => {
  const tracker = createProfitConnectionTracker();
  tracker.observe(0, 0, now); tracker.observe(1, 1, now);
  tracker.observe(2, 4, now); tracker.observe(3, 0, now);
  assert.equal(tracker.snapshot().nativeConnectionsReady, false);
  assert.equal(tracker.observe(1, 5, now + 1).nativeConnectionsReady, true);
  const lost = tracker.observe(1, 3, now + 2);
  assert.equal(lost.nativeConnectionsReady, false);
  const returned = tracker.observe(1, 5, now + 3);
  assert.equal(returned.nativeConnectionsReady, true);
  assert.equal(returned.epoch, lost.epoch);
  assert.equal(returned.reconciliationRequired, true);
  assert.equal(returned.executionAuthorized, false); assert.equal(returned.resubmitAllowed, false);
  throws(() => tracker.observe(1, 5, now), 'PROFIT_OUT_OF_ORDER_CONNECTION_EVENT');
  tracker.observe(0, 2, now + 4);
  assert.equal(tracker.observe(0, 0, now + 5).nativeConnectionsReady, false);
});

test('R109 market feed/license callbacks cannot stand in for broker connectivity', () => {
  const tracker = createProfitConnectionTracker();
  tracker.observe(0, 0, now); tracker.observe(2, 4, now); tracker.observe(3, 0, now);
  assert.equal(tracker.snapshot().nativeConnectionsReady, false);
  assert.equal(tracker.observe(1, 2, now).nativeConnectionsReady, false);
  assert.equal(tracker.observe(1, 5, now).nativeConnectionsReady, true);
  assert.equal(tracker.observe(2, 0, now).nativeConnectionsReady, false);
  tracker.observe(2, 4, now);
  assert.equal(tracker.observe(3, 1, now).nativeConnectionsReady, false);
});
