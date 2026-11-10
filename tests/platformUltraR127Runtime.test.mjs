import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {ExecutionLedger} from '../lib/platform/ultra/client/execution-ledger.mjs';
import {UltraExecutionRuntimeR127} from '../lib/platform/ultra/client/execution-runtime-r127.mjs';
import {OfflineFixtureBrokerR127} from '../lib/platform/ultra/client/runtime-fixture-r127.mjs';
import {units12, operationNet} from '../lib/platform/ultra/operation.mjs';
import {quantityText} from '../lib/platform/ultra/client/fixture-broker.mjs';

const initial = Date.parse('2026-11-10T15:00:00Z');
function fixture(t, {market = 'crypto', provider = 'binance', product = 'spot', currency = 'USDT', symbol = 'FIXTUREUSDT', entry = 'partial'} = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'ultra-r127-runtime-'));
  t.after(() => rmSync(directory, {recursive: true, force: true}));
  const path = join(directory, 'journal.sqlite');
  const binding = {account: 'fictional-account', environment: 'demo', provider};
  const ledger = new ExecutionLedger(path, binding);
  t.after(() => { try { ledger.close(); } catch {} });
  const clock = {now: initial};
  const scope = {provider, environment: 'demo', product, accountFingerprint: 'a'.repeat(64)};
  const config = {markets: [{id: market, provider, currency, capital: 1000, leverage: 2}], sessionMinutes: 60, maxPositions: 3, tradeRiskPct: .25, dailyLossPct: 2, maxAssetPct: 20, excludedSymbols: []};
  const adapter = new OfflineFixtureBrokerR127({scope, binding: ledger.binding, market, currency, symbol, entry, now: () => clock.now});
  const options = {config, market, ledger, adapter, scope, now: () => clock.now, onWarning: async () => true};
  const runtime = new UltraExecutionRuntimeR127(options);
  return {directory, path, binding, ledger, clock, scope, config, adapter, runtime, options};
}

test('R127 requires the declared demo product and refuses native transports', t => {
  const f = fixture(t);
  for (const environment of ['live', 'paper', undefined]) assert.throws(() => new UltraExecutionRuntimeR127({...f.options, scope: {...f.scope, environment}}), /OFFLINE_DEMO_SCOPE/);
  for (const executionEnvironment of ['live', 'demo', 'testnet', undefined]) assert.throws(() => new UltraExecutionRuntimeR127({...f.options, adapter: {...f.adapter, executionEnvironment}}), /OFFLINE_RUNTIME_STATE/);
  assert.throws(() => new UltraExecutionRuntimeR127({...f.options, scope: {...f.scope, product: 'b3_mini'}}), /ROUTE_SCOPE/);
  assert.throws(() => new UltraExecutionRuntimeR127({...f.options, config: {...f.config, markets: [{id: 'forex', provider: 'mt5', currency: 'USD', capital: 1000, leverage: 2}]}, market: 'forex'}));
});

test('R127 start requires trading permission in both runtime state and inspect', async t => {
  const f = fixture(t);
  f.adapter.tradingAllowed = false;
  await assert.rejects(f.runtime.start(), /ACCOUNT_RECONCILIATION_REQUIRED/);
  assert.equal(f.ledger.paused(), true);
  f.adapter.tradingAllowed = true;
  f.adapter.inspect = async () => ({accountBinding: f.ledger.binding, accountCurrency: 'USDT', protectionSupported: true, instrumentRulesVerified: true});
  await assert.rejects(f.runtime.start(), /TRADING_PERMISSION_REQUIRED/);
  assert.equal(f.adapter.submissions, 0);
});

for (const missing of ['streamSynchronized', 'ordersComplete', 'positionsComplete', 'fillsComplete']) test(`R127 start rejects unknown ${missing}`, async t => {
  const f = fixture(t);
  f.adapter[missing] = false;
  await assert.rejects(f.runtime.start(), /ACCOUNT_RECONCILIATION_REQUIRED/);
  assert.equal(f.adapter.submissions, 0);
  assert.equal(f.runtime.readiness().status, 'needs_reconciliation');
});

test('R127 rejects unresolved, stale or cross-account runtime observations', async t => {
  const f = fixture(t);
  f.adapter.unresolvedReferences = ['unattributed-position'];
  await assert.rejects(f.runtime.start(), /ACCOUNT_RECONCILIATION_REQUIRED/);
  f.adapter.unresolvedReferences = [];
  const original = f.adapter.runtimeState.bind(f.adapter);
  f.adapter.runtimeState = async () => ({...await original(), observedAtMs: f.clock.now - 5001});
  await assert.rejects(f.runtime.start(), /FRESHNESS/);
  f.adapter.runtimeState = async () => ({...await original(), accountFingerprint: 'b'.repeat(64)});
  await assert.rejects(f.runtime.start(), /IDENTITY/);
  assert.equal(f.adapter.submissions, 0);
});

test('R127 ties account inventory to the same connection revision before opening', async t => {
  const f = fixture(t);
  const account = f.adapter.account.bind(f.adapter);
  f.adapter.account = async () => ({...await account(), stateRevision: 'old_state'});
  await assert.rejects(f.runtime.start(), /ACCOUNT_SNAPSHOT_UNVERIFIED/);
  f.adapter.account = async () => ({...await account(), accountCurrency: 'BRL'});
  await assert.rejects(f.runtime.start(), /ACCOUNT_SNAPSHOT_UNVERIFIED/);
  assert.equal(f.ledger.paused(), true);
});

test('R127 disabled instruments do not become automatic candidates', async t => {
  const f = fixture(t);
  await f.runtime.start();
  f.adapter.instrumentEnabled = false;
  assert.equal((await f.runtime.tick()).state, 'waiting_for_opportunity');
  assert.equal(f.adapter.submissions, 0);
  f.adapter.instrumentEnabled = true;
  assert.equal((await f.runtime.tick()).state, 'open');
});

test('R127 a new runtime cannot reuse stale readiness or change the persisted account fingerprint', async t => {
  const f = fixture(t);
  await f.runtime.start();
  const replacement = new UltraExecutionRuntimeR127(f.options);
  assert.equal(replacement.readiness().status, 'needs_reconciliation');
  assert.equal((await replacement.tick()).state, 'startup_required');
  assert.equal(f.adapter.submissions, 0);
  assert.throws(() => new UltraExecutionRuntimeR127({...f.options, scope: {...f.scope, accountFingerprint: 'b'.repeat(64)}}), /PERSISTED_SCOPE_MISMATCH/);
});

test('R127 crossed quotes cannot enter the inherited strategy ranking', async t => {
  const f = fixture(t);
  await f.runtime.start();
  const original = f.adapter.observations.bind(f.adapter);
  f.adapter.observations = async () => (await original()).map(row => ({...row, ask: row.bid - 1}));
  assert.equal((await f.runtime.tick()).state, 'waiting_for_opportunity');
  assert.equal(f.adapter.submissions, 0);
});

test('R127 crypto eligibility must belong to this account and product', async t => {
  const f = fixture(t);
  await f.runtime.start();
  const original = f.adapter.observations.bind(f.adapter);
  f.adapter.observations = async () => (await original()).map(row => ({...row, instrument: {...row.instrument, eligibility: {...row.instrument.eligibility, accountFingerprint: 'b'.repeat(64)}}}));
  assert.equal((await f.runtime.tick()).state, 'waiting_for_opportunity');
  f.adapter.observations = async () => (await original()).map(row => ({...row, instrument: {...row.instrument, eligibility: {...row.instrument.eligibility, product: 'usds_m_futures'}}}));
  assert.equal((await f.runtime.tick()).state, 'waiting_for_opportunity');
  assert.equal(f.adapter.submissions, 0);
});

test('R127 B3 scope accepts only explicit eligible WIN/WDO contracts', async t => {
  const f = fixture(t, {market: 'b3', provider: 'profit', product: 'b3_mini', currency: 'BRL', symbol: 'PETR4'});
  await f.runtime.start();
  assert.equal((await f.runtime.tick()).state, 'waiting_for_opportunity');
  f.adapter.symbol = 'WINZ99';
  const [observation] = await f.adapter.observations();
  assert.equal(observation.lotStep, 1);
  assert.equal(observation.minLot, 1);
  const opened = await f.runtime.tick();
  assert.equal(opened.state, 'open');
  assert.equal(units12(f.ledger.operation(opened.clientOrderId).requestedQuantity) % 1000000000000n, 0n);
  assert.equal(f.adapter.submissions, 1);
});

test('R127 scope filtering preserves duplicate instrument rejection', async t => {
  const f = fixture(t);
  await f.runtime.start();
  const original = f.adapter.observations.bind(f.adapter);
  f.adapter.observations = async () => { const [row] = await original(); return [row, {...row, instrument: {...row.instrument, tradingEnabled: false}}]; };
  assert.equal((await f.runtime.tick()).state, 'waiting_for_opportunity');
  assert.equal(f.adapter.submissions, 0);
});

test('R127 detects connection change during observations before preparing intent', async t => {
  const f = fixture(t);
  await f.runtime.start();
  const original = f.adapter.observations.bind(f.adapter);
  f.adapter.observations = async () => { const rows = await original(); f.adapter.generation = 'fixture_connection_2'; return rows; };
  await assert.rejects(f.runtime.tick(), /RUNTIME_STATE_CHANGED/);
  assert.equal(f.adapter.submissions, 0);
  assert.equal(f.ledger.operations().length, 0);
  assert.equal(f.ledger.paused(), true);
});

test('R127 detects account state change during preflight before preparing intent', async t => {
  const f = fixture(t);
  await f.runtime.start();
  const original = f.adapter.preflight.bind(f.adapter);
  f.adapter.preflight = async request => { const result = await original(request); f.adapter.stateVersion++; return result; };
  await assert.rejects(f.runtime.tick(), /RUNTIME_STATE_CHANGED/);
  assert.equal(f.adapter.submissions, 0);
  assert.equal(f.ledger.operations().length, 0);
});

test('R127 last-moment disconnect records uncertainty without dispatch or blind retry', async t => {
  const f = fixture(t);
  await f.runtime.start();
  const prepare = f.ledger.prepare.bind(f.ledger);
  f.ledger.prepare = (...args) => { const intent = prepare(...args); f.adapter.connected = false; return intent; };
  const result = await f.runtime.tick();
  assert.equal(result.state, 'reconciliation_required');
  assert.equal(f.adapter.submissions, 0);
  assert.equal(f.ledger.operation(result.clientOrderId).state, 'unknown');
  f.adapter.connected = true;
  await assert.rejects(f.runtime.resume(), /RECONCILIATION_REQUIRED/);
  assert.equal(f.adapter.submissions, 0);
});

test('R127 a delayed durable write cannot submit an expired quote', async t => {
  const f = fixture(t);
  await f.runtime.start();
  const prepare = f.ledger.prepare.bind(f.ledger);
  f.ledger.prepare = (...args) => { const intent = prepare(...args); f.clock.now += 1500; return intent; };
  const result = await f.runtime.tick();
  assert.equal(result.state, 'reconciliation_required');
  assert.equal(f.adapter.submissions, 0);
  assert.equal(f.ledger.operation(result.clientOrderId).state, 'unknown');
});

test('R127 response loss plus restart reconciles the original intent without resubmitting', async t => {
  const f = fixture(t);
  await f.runtime.start();
  f.adapter.failAfterSubmit = true;
  const result = await f.runtime.tick();
  assert.equal(result.state, 'reconciliation_required');
  assert.equal(f.ledger.paused(), true);
  f.ledger.close();
  f.clock.now += 100;
  const ledger = new ExecutionLedger(f.path, f.binding);
  t.after(() => ledger.close());
  const restarted = new UltraExecutionRuntimeR127({...f.options, ledger});
  assert.equal(restarted.readiness().status, 'needs_reconciliation');
  f.adapter.streamSynchronized = false;
  await assert.rejects(restarted.start({recover: true}), /ACCOUNT_RECONCILIATION_REQUIRED/);
  f.adapter.streamSynchronized = true;
  await restarted.start({recover: true});
  assert.equal(ledger.operation(result.clientOrderId).state, 'open');
  assert.equal(f.adapter.submissions, 1);
  assert.equal(restarted.readiness().nativeValidated, false);
  assert.equal(restarted.readiness().externalPaperAllowed, false);
});

test('R127 new-opening permission loss does not disable cancellation or reduction', async t => {
  const f = fixture(t);
  await f.runtime.start();
  const {clientOrderId: id} = await f.runtime.tick();
  f.clock.now += 100;
  f.adapter.tradingAllowed = false;
  await assert.rejects(f.runtime.tick(), /ACCOUNT_RECONCILIATION_REQUIRED/);
  f.adapter.streamSynchronized = false;
  f.adapter.fillsComplete = false;
  assert.equal((await f.runtime.cancel(id)).state, 'confirmed');
  const quantity = f.ledger.operation(id).entryQuantity;
  const half = quantityText(units12(quantity) / 2n);
  assert.equal((await f.runtime.close(id, half)).state, 'confirmed');
  assert.equal(f.ledger.operation(id).state, 'partially_closed');
  assert.equal((await f.runtime.close(id, quantityText(units12(quantity) - units12(half)))).state, 'confirmed');
  assert.equal(f.ledger.operation(id).state, 'closed');
  assert.equal(operationNet(f.ledger.operation(id)), null);
  assert.equal(f.adapter.submissions, 1);
  assert.equal(f.adapter.commandSubmissions, 3);
});

for (const command of ['cancel', 'close']) test(`R127 account switch blocks ${command} before modifying exposure`, async t => {
  const f = fixture(t, {entry: command === 'close' ? 'full' : 'partial'});
  await f.runtime.start();
  const {clientOrderId: id} = await f.runtime.tick();
  const original = f.adapter.runtimeState.bind(f.adapter);
  f.adapter.runtimeState = async () => ({...await original(), accountFingerprint: 'b'.repeat(64)});
  const result = command === 'cancel'
    ? await f.runtime.cancel(id)
    : await f.runtime.close(id, f.ledger.operation(id).entryQuantity);
  assert.equal(result.state, 'reconciliation_required');
  assert.equal(f.adapter.commandSubmissions, 0);
  assert.equal(units12(f.ledger.operation(id).exitQuantity), 0n);
  assert.equal(f.ledger.commands()[0].state, 'unknown');
});

test('R127 identity is checked before protecting existing positions', async t => {
  const f = fixture(t);
  await f.runtime.start();
  await f.runtime.tick();
  let calls = 0;
  const protect = f.adapter.protectExisting.bind(f.adapter);
  f.adapter.protectExisting = (...args) => { calls++; return protect(...args); };
  const original = f.adapter.runtimeState.bind(f.adapter);
  f.adapter.runtimeState = async () => ({...await original(), provider: 'other'});
  await assert.rejects(f.runtime.tick(), /IDENTITY_OR_FRESHNESS_UNVERIFIED/);
  assert.equal(calls, 0);
  assert.equal(f.ledger.paused(), true);
});

test('R127 accepted order remains unfilled and reject never invents an execution', async t => {
  const f = fixture(t, {entry: 'none'});
  await f.runtime.start();
  const sent = await f.runtime.tick();
  assert.equal(sent.state, 'sending');
  assert.equal(units12(f.ledger.operation(sent.clientOrderId).entryQuantity), 0n);
  assert.equal(f.ledger.order(sent.clientOrderId).state, 'working');
  await f.runtime.cancel(sent.clientOrderId);
  const g = fixture(t, {entry: 'reject'});
  await g.runtime.start();
  const rejected = await g.runtime.tick();
  assert.equal(rejected.state, 'rejected');
  assert.equal(units12(g.ledger.operation(rejected.clientOrderId).entryQuantity), 0n);
  assert.equal(operationNet(g.ledger.operation(rejected.clientOrderId)), null);
});
