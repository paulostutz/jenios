import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {ExecutionLedger} from '../lib/platform/ultra/client/execution-ledger.mjs';
import {ProfitOrderJournalR127} from '../lib/platform/ultra/client/profit-order-journal-r127.mjs';
import {operationNet} from '../lib/platform/ultra/operation.mjs';

const now = Date.parse('2026-11-10T12:00:00Z');
const account = {brokerId: 120, accountId: 'fictional-account', subAccountId: null};
const binding = {provider: 'profit', environment: 'demo', account: 'fictional-owner'};
const instrument = {ticker: 'WINZ99', exchange: 'F', tickSize: '5', quantityStep: '1', maxQuantity: '100', observedAtMs: now, validUntilMs: now + 30000};
function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'ultra-profit-r127-')), path = join(dir, 'client.sqlite');
  const ledger = new ExecutionLedger(path, binding), journal = new ProfitOrderJournalR127({ledger, binding, selectedAccount: account});
  ledger.claim(now); journal.startSession('session-a', now); ledger.resume();
  t.after(() => { try { ledger.close(); } catch {} rmSync(dir, {recursive: true, force: true}); });
  const request = {market: 'b3', symbol: 'WINZ99', currency: 'BRL', side: 'buy', quantity: 10, entryPrice: 130000,
    stopDistance: 50, targetDistance: 100, reservedMargin: 100, notional: 260000, estimatedLoss: 100, observedAtMs: now, leverage: 1};
  const operationId = ledger.prepare(request, now).id;
  const intent = {operationId, instrument, order: {clientOrderId: operationId, mode: 'ultrafast', action: 'open', side: 'buy', type: 'limit', quantity: '10', price: '130000', stopPrice: null}};
  const actionId = journal.prepare(intent, now).actionId;
  return {dir, path, ledger, journal, operationId, actionId, intent};
}
function details(f, overrides = {}) {
  return {account, ticker: 'WINZ99', exchange: 'F', side: 'buy', quantity: '10', localOrderId: '9007199254740993',
    clOrderId: 'broker-fixture-1', sessionId: 'session-a', filledQuantity: '4', leavesQuantity: '6', status: 1, observedAtMs: now + 1, ...overrides};
}
function accepted(f) { f.journal.markSending(f.actionId, now); return f.journal.recordLocalReceipt(f.actionId, '9007199254740993', now); }
function financialFixture(f, {entry = '4', state = 'open', remainderCancelled = false} = {}) {
  const old = f.ledger.operation(f.operationId);
  return f.ledger.applyReceipt({receiptId: 'financial-fixture-' + entry + '-' + remainderCancelled, accountBinding: f.ledger.binding,
    clientOrderId: f.operationId, commandId: null, observedAtMs: now + 2, orderState: 'working', positionReconciled: true,
    protectionConfirmed: true, entryRemainderCancelled: remainderCancelled,
    operation: {...old, state, updatedAt: new Date(now + 2).toISOString(), openedAt: new Date(now + 1).toISOString(), entryQuantity: entry,
      entryPrice: '130000', brokerRefs: ['broker-fixture-1']}}, {now: now + 2});
}

test('R127 Profit intent is durable before fixture attempt and local acceptance is not a fill', t => {
  const f = fixture(t); assert.equal(f.ledger.order(f.operationId).state, 'prepared');
  assert.equal(f.journal.prepare(f.intent, now).created, false);
  const result = accepted(f);
  assert.equal(result.state, 'local_accepted'); assert.equal(result.localAccepted, true);
  assert.equal(result.financialReceiptReady, false); assert.equal(result.nativeValidated, false); assert.equal(result.realOrdersSent, 0);
  assert.equal(f.ledger.operation(f.operationId).entryQuantity, '0');
  assert.equal(f.ledger.order(f.operationId).state, 'sending');
  assert.equal(f.journal.action(f.actionId).reference.localOrderId, '9007199254740993');
  assert.throws(() => f.journal.markSending(f.actionId, now), /ACTION_NOT_PREPARED/);
  assert.throws(() => f.ledger.resume(), /RECONCILIATION_REQUIRED/);
});

test('R127 Profit query binds permanent ID and preserves partial quantity without invented P&L', t => {
  const f = fixture(t); accepted(f);
  const result = f.journal.observeOrderDetails(f.actionId, {evidenceId: 'query-1', observation: details(f)}, now + 1);
  assert.equal(result.observation.normalized.cumulativeFilledQuantity, '4');
  assert.equal(result.observation.normalized.terminalOrder, false);
  assert.equal(result.positionReconciliationRequired, true);
  assert.equal(f.journal.reference(f.actionId).ClOrderID, 'broker-fixture-1');
  assert.equal(f.ledger.operation(f.operationId).entryQuantity, '0');
  assert.equal(operationNet(f.ledger.operation(f.operationId)), null);
  assert.equal(f.ledger.paused(), true);
});

test('R127 Profit uncertain response blocks repeat attempt and unproved broker attribution', t => {
  const f = fixture(t); f.journal.markSending(f.actionId, now);
  assert.equal(f.journal.recordLocalReceipt(f.actionId, null, now).state, 'unknown');
  assert.equal(f.ledger.paused(), true);
  assert.throws(() => f.journal.markSending(f.actionId, now), /ACTION_NOT_PREPARED/);
  assert.throws(() => f.journal.observeOrderDetails(f.actionId, {evidenceId: 'unowned', observation: details(f)}, now + 1), /PROFIT_INVALID_INT64/);
  assert.equal(f.journal.action(f.actionId).reference.clOrderId, null);
});

test('R127 Profit disk restart uses permanent ID and only current-session query, without resubmit', t => {
  const f = fixture(t); accepted(f); f.journal.observeOrderDetails(f.actionId, {evidenceId: 'first', observation: details(f)}, now + 1);
  f.ledger.close();
  const ledger = new ExecutionLedger(f.path, binding), journal = new ProfitOrderJournalR127({ledger, binding, selectedAccount: account});
  t.after(() => ledger.close()); ledger.claim(now + 100);
  assert.throws(() => journal.startSession('session-a', now + 100), /SESSION_REUSE/);
  assert.throws(() => journal.observeOrderDetails(f.actionId, {evidenceId: 'old-owner', observation: details(f)}, now + 100), /SESSION_REQUIRED/);
  journal.startSession('session-b', now + 100);
  assert.deepEqual(journal.reference(f.actionId), {Version: 0, LocalOrderID: '0', ClOrderID: 'broker-fixture-1'});
  assert.equal(journal.recoveryStatus().actions[0].requiresFreshQuery, true);
  assert.throws(() => journal.observeOrderDetails(f.actionId, {evidenceId: 'stale-session', observation: details(f, {observedAtMs: now + 100})}, now + 100), /SESSION_MISMATCH/);
  const r = journal.observeOrderDetails(f.actionId, {evidenceId: 'recovered', observation: details(f, {localOrderId: '55', sessionId: 'session-b', observedAtMs: now + 100})}, now + 100);
  assert.equal(r.state, 'observed'); assert.equal(journal.action(f.actionId).reference.localOrderId, '55');
  assert.equal(ledger.paused(), true); assert.equal(r.automaticResubmitAllowed, false);
  assert.throws(() => journal.startSession('session-a', now + 100), /SESSION_REUSE/);
});

test('R127 Profit restart without permanent ID refuses old session-local references', t => {
  const f = fixture(t); accepted(f); f.journal.startSession('session-b', now + 1);
  assert.throws(() => f.journal.reference(f.actionId), /RESTART_REQUIRES_BROKER_ID/);
  assert.throws(() => f.journal.observeOrderDetails(f.actionId, {evidenceId: 'guessed', observation: details(f, {sessionId: 'session-b'})}, now + 1), /ORDER_ID_MISMATCH/);
  assert.equal(f.journal.action(f.actionId).state, 'unknown');
});

test('R127 Profit unsent entry is cancelled on restart instead of dispatched', t => {
  const f = fixture(t); f.journal.startSession('session-b', now + 1);
  assert.equal(f.journal.action(f.actionId).state, 'not_sent'); assert.equal(f.ledger.operation(f.operationId).state, 'cancelled');
  assert.throws(() => f.journal.markSending(f.actionId, now + 1), /ACTION_NOT_PREPARED/);
});

test('R127 Profit scope and evidence conflicts leave no partial mutation', t => {
  const f = fixture(t); accepted(f);
  const startAudit = f.journal.audit().length;
  for (const bad of [details(f, {account: {...account, accountId: 'another'}}), details(f, {localOrderId: '17'}),
    details(f, {ticker: 'WDOZ99'}), details(f, {side: 'sell'}), details(f, {quantity: '9'}), details(f, {password: 'forbidden'})]) {
    assert.throws(() => f.journal.observeOrderDetails(f.actionId, {evidenceId: 'invalid', observation: bad}, now + 1));
  }
  assert.equal(f.journal.audit().length, startAudit);
  const input = {evidenceId: 'query', observation: details(f)};
  f.journal.observeOrderDetails(f.actionId, input, now + 1);
  assert.equal(f.journal.observeOrderDetails(f.actionId, input, now + 1).duplicate, true);
  assert.throws(() => f.journal.observeOrderDetails(f.actionId, {...input, observation: details(f, {filledQuantity: '5', leavesQuantity: '5'})}, now + 1), /EVIDENCE_CHANGED/);
  assert.throws(() => f.journal.observeOrderDetails(f.actionId, {evidenceId: 'regression', observation: details(f, {filledQuantity: '3'})}, now + 1), /FILL_REGRESSION/);
});

test('R127 Profit cancel while paused keeps partial exposure and ACK cannot confirm cancellation', t => {
  const f = fixture(t); accepted(f); f.journal.observeOrderDetails(f.actionId, {evidenceId: 'partial', observation: details(f)}, now + 1);
  financialFixture(f); assert.equal(f.ledger.paused(), true);
  assert.equal(f.journal.cancelDraft(f.actionId).canSubmit, false);
  const commandId = f.ledger.prepareCommand('cancel', f.operationId, {}, now + 2).id;
  const cancelId = f.journal.prepareCancellation({actionId: f.actionId, commandId}, now + 2).actionId;
  f.journal.markSending(cancelId, now + 2);
  assert.equal(f.journal.recordLocalReceipt(cancelId, 0, now + 2).localAccepted, true);
  assert.equal(f.ledger.commands()[0].state, 'sending');
  assert.equal(f.ledger.operation(f.operationId).state, 'open');
  const result = f.journal.observeOrderDetails(cancelId, {evidenceId: 'cancel-query', observation: details(f, {status: 15, leavesQuantity: '0', observedAtMs: now + 3})}, now + 3);
  assert.equal(result.observation.normalized.state, 'PARTIAL_CANCELLED'); assert.equal(result.observation.normalized.terminalOrder, true);
  assert.equal(result.observation.normalized.positionReconciliationRequired, true);
  assert.equal(f.ledger.operation(f.operationId).entryQuantity, '4'); assert.equal(f.ledger.operation(f.operationId).exitQuantity, '0');
  assert.equal(result.operationCompleted, false); assert.equal(f.ledger.commands()[0].state, 'sending');
});

test('R127 Profit close uses durable command without inversion or excessive quantity', t => {
  const f = fixture(t); accepted(f); f.journal.observeOrderDetails(f.actionId, {evidenceId: 'partial', observation: details(f)}, now + 1);
  financialFixture(f, {remainderCancelled: true});
  const commandId = f.ledger.prepareCommand('close', f.operationId, {quantity: '4'}, now + 2).id;
  const input = {operationId: f.operationId, role: 'close', commandId, instrument,
    order: {clientOrderId: commandId, mode: 'ultrafast', action: 'close', side: 'sell', type: 'market', quantity: '4', price: null, stopPrice: null}};
  assert.throws(() => f.journal.prepare({...input, order: {...input.order, side: 'buy'}}, now + 2), /STRATEGY_DIRECTION/);
  assert.throws(() => f.journal.prepare({...input, order: {...input.order, quantity: '5'}}, now + 2), /CLOSE_COMMAND_REQUIRED/);
  const id = f.journal.prepare(input, now + 2).actionId; f.journal.markSending(id, now + 2); f.journal.recordLocalReceipt(id, '24', now + 2);
  const result = f.journal.observeOrderDetails(id, {evidenceId: 'partial-close', observation: details(f,
    {side: 'sell', quantity: '4', localOrderId: '24', clOrderId: 'close-1', filledQuantity: '2', leavesQuantity: '2', observedAtMs: now + 3})}, now + 3);
  assert.equal(result.observation.normalized.cumulativeFilledQuantity, '2');
  assert.equal(f.ledger.operation(f.operationId).exitQuantity, '0');
  assert.equal(f.ledger.commands()[0].state, 'sending');
});

test('R127 Profit scope, native evidence and stale metadata cannot enable live execution', t => {
  const f = fixture(t);
  assert.throws(() => new ProfitOrderJournalR127({ledger: f.ledger, binding: {...binding, environment: 'live'}, selectedAccount: account}), /OFFLINE_ACCOUNT_REQUIRED/);
  assert.throws(() => new ProfitOrderJournalR127({ledger: f.ledger, binding, selectedAccount: {...account, accountId: 'other'}}), /NATIVE_ACCOUNT_CHANGED/);
  assert.throws(() => f.journal.prepare({...f.intent, instrument: {...instrument, ticker: 'WINFUT'}}, now), /MINI_INSTRUMENT_REQUIRED/);
  assert.throws(() => f.journal.prepare({...f.intent, order: {...f.intent.order, price: '131000'}}, now), /ENTRY_PRICE_MISMATCH/);
  f.ledger.heartbeat(now + 31000);
  assert.throws(() => f.journal.markSending(f.actionId, now + 31000), /STALE_INSTRUMENT/);
  f.ledger.heartbeat(now); accepted(f);
  assert.throws(() => f.journal.observeOrderDetails(f.actionId, {evidenceId: 'native', source: 'broker', observation: details(f)}, now + 1), /NATIVE_EVIDENCE_NOT_RELEASED/);
  assert.equal(typeof f.journal.submit, 'undefined'); assert.equal(typeof f.journal.withdraw, 'undefined');
});

test('R127 Profit terminal order cannot reopen from a contradictory query', t => {
  const f = fixture(t); accepted(f);
  f.journal.observeOrderDetails(f.actionId, {evidenceId: 'done', observation: details(f, {status: 2, filledQuantity: '10', leavesQuantity: '0'})}, now + 1);
  assert.throws(() => f.journal.observeOrderDetails(f.actionId, {evidenceId: 'reopened', observation: details(f, {status: 0, filledQuantity: '10', leavesQuantity: '0', observedAtMs: now + 2})}, now + 2), /TERMINAL_ORDER_CHANGED/);
  assert.equal(f.journal.action(f.actionId).observation.normalized.state, 'FILLED');
});

test('R127 Profit session change blocks new entries even if generic ledger resume is called', t => {
  const f = fixture(t); accepted(f); f.journal.observeOrderDetails(f.actionId, {evidenceId: 'first', observation: details(f)}, now + 1);
  financialFixture(f); f.journal.startSession('session-b', now + 3); f.ledger.resume();
  const id = f.ledger.prepare({...f.ledger.order(f.operationId).request, observedAtMs: now + 3}, now + 3).id;
  assert.throws(() => f.journal.prepare({...f.intent, operationId: id, order: {...f.intent.order, clientOrderId: id}}, now + 3), /ORDER_RECONCILIATION_REQUIRED/);
  assert.equal(f.journal.actions().length, 1);
});

test('R127 Profit local and permanent order identifiers cannot be attributed to two Ultra operations', t => {
  const f = fixture(t); accepted(f); f.journal.observeOrderDetails(f.actionId, {evidenceId: 'first', observation: details(f)}, now + 1);
  financialFixture(f); f.ledger.resume();
  const operationId = f.ledger.prepare({...f.ledger.order(f.operationId).request, observedAtMs: now + 3}, now + 3).id;
  const actionId = f.journal.prepare({...f.intent, operationId, order: {...f.intent.order, clientOrderId: operationId}}, now + 3).actionId;
  f.journal.markSending(actionId, now + 3);
  assert.throws(() => f.journal.recordLocalReceipt(actionId, '9007199254740993', now + 3), /ORDER_ALREADY_BOUND/);
  assert.equal(f.journal.action(actionId).reference.localOrderId, null);
  f.journal.recordLocalReceipt(actionId, '25', now + 3);
  assert.throws(() => f.journal.observeOrderDetails(actionId, {evidenceId: 'duplicate-broker-order', observation: details(f, {localOrderId: '25', observedAtMs: now + 3})}, now + 3), /ORDER_ALREADY_BOUND/);
  assert.equal(f.journal.action(actionId).reference.clOrderId, null);
});

test('R127 Profit unknown and pending detail states keep fresh-query gate closed', t => {
  for (const status of [200, 6, 10, 14]) {
    const f = fixture(t); accepted(f); financialFixture(f);
    const result = f.journal.observeOrderDetails(f.actionId, {evidenceId: 'pending', observation: details(f, {status, observedAtMs: now + 3})}, now + 3);
    assert.equal(result.observation.normalized.independentReconciliationRequired, true);
    assert.equal(f.journal.unresolved(), true);
    assert.equal(f.journal.recoveryStatus().actions[0].requiresFreshQuery, true);
    f.ledger.resume();
    const operationId = f.ledger.prepare({...f.ledger.order(f.operationId).request, observedAtMs: now + 4}, now + 4).id;
    assert.throws(() => f.journal.prepare({...f.intent, operationId, order: {...f.intent.order, clientOrderId: operationId}}, now + 4), /ORDER_RECONCILIATION_REQUIRED/);
    assert.equal(f.journal.cancelDraft(f.actionId).canSubmit, false);
  }
});

test('R127 Profit rechecks exposure, revision and command immediately before a close attempt', t => {
  for (const changed of ['exposure', 'revision', 'command']) {
    const f = fixture(t); accepted(f); f.journal.observeOrderDetails(f.actionId, {evidenceId: 'partial', observation: details(f)}, now + 1);
    financialFixture(f, {remainderCancelled: true});
    const commandId = f.ledger.prepareCommand('close', f.operationId, {quantity: '4'}, now + 2).id;
    const actionId = f.journal.prepare({operationId: f.operationId, role: 'close', commandId, instrument,
      order: {clientOrderId: commandId, mode: 'ultrafast', action: 'close', side: 'sell', type: 'market', quantity: '4', price: null, stopPrice: null}}, now + 2).actionId;
    const operation = f.ledger.operation(f.operationId);
    if (changed === 'exposure') f.ledger.saveOperation({...operation, state: 'partially_closed', exitQuantity: '1', exitPrice: '130100', updatedAt: new Date(now + 3).toISOString()}, {now: now + 3});
    if (changed === 'revision') f.ledger.saveOperation({...operation, reason: 'LATE_OBSERVATION', updatedAt: new Date(now + 3).toISOString()}, {now: now + 3});
    if (changed === 'command') f.ledger.markCommand(commandId, 'prepared', 'cancelled', now + 3);
    assert.throws(() => f.journal.markSending(actionId, now + 3), /CLOSE_RECONCILIATION_REQUIRED/);
    assert.equal(f.journal.action(actionId).state, 'prepared');
    assert.equal(f.journal.audit().filter(e => e.action_id === actionId && e.kind === 'fixture_attempt_recorded').length, 0);
    assert.equal(f.ledger.commands({pending: false}).find(c => c.id === commandId).state, changed === 'command' ? 'cancelled' : 'prepared');
  }
});
