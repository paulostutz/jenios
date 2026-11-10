import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {digest} from '../lib/platform/ultra/client/journal.mjs';
import {AttributedExecutionLedgerR127} from '../lib/platform/ultra/client/operation-records-r127.mjs';
import {OfflineFixtureBrokerR127} from '../lib/platform/ultra/client/runtime-fixture-r127.mjs';
import {DurableUltraRuntimeR128} from '../lib/platform/ultra/client/session-runtime-r128.mjs';
import {DurableUltraRuntimeR129} from '../lib/platform/ultra/client/session-runtime-r129.mjs';
import {createUltraStartFeeLaboratory} from '../lib/platform/ultra/fees-um001.mjs';
import {createLetterMonthlyR129} from '../lib/platform/ultra/client/letter-monthly-r129.mjs';
import {initialOperation} from '../lib/platform/ultra/operation.mjs';
import {consolidateMonthlyReports} from '../lib/platform/ultra/client/monthly-report-um001.mjs';

const initialNow = Date.parse('2026-11-10T17:00:00Z');
function laboratory(clock, {eligibility = 'chargeable', enabled = true, balanceCents = 10000} = {}) {
  return createUltraStartFeeLaboratory({syntheticOnly: true, now: () => new Date(clock.now).toISOString(),
    authorizeAdmin: async context => ({allowed: context === 'fixture-admin', syntheticOnly: true, assurance: 'synthetic-server-session', actorId: 'synthetic:admin'}),
    fixtureRegistry: {syntheticOnly: true,
      plans: [{syntheticOnly: true, planId: 'synthetic:classification', eligibility, evidenceRef: eligibility === 'pending' ? undefined : 'synthetic:classification-evidence', ...(enabled === null ? {} : {enabled})}],
      accounts: [{syntheticOnly: true, accountKey: 'synthetic:account', ownerKey: 'synthetic:owner', planId: 'synthetic:classification', currency: 'BRL', balanceCents}]}});
}

function fixture(t, changes = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'r129-start-')), path = join(directory, 'journal.sqlite');
  const clock = changes.clock ?? {now: initialNow}, lab = changes.lab ?? laboratory(clock, changes);
  const binding = {account: 'fictional-r129', environment: 'demo', provider: 'binance'};
  const config = {markets: [{id: 'crypto', provider: 'binance', currency: 'USDT', capital: 1000, leverage: 20}],
    sessionMinutes: 10, maxPositions: 1, tradeRiskPct: .25, dailyLossPct: 2, maxAssetPct: 20, excludedSymbols: []};
  const context = {sourcePlatform: changes.platform ?? 'jenios', ownerScope: 'synthetic:owner', connectionId: 'connection-1', sessionId: 'session-1',
    strategy: {id: 'ultrafast-r18-r53', version: 'R113-R125', configDigest: digest(config)}, product: 'spot', evidenceMode: 'offline_fixture'};
  const ledgers = [], reopen = (ctx = context) => {const ledger = new AttributedExecutionLedgerR127(path, binding, ctx); ledgers.push(ledger); return ledger;};
  const ledger = reopen(), scope = {provider: 'binance', environment: 'demo', product: 'spot', accountFingerprint: ledger.binding};
  const adapter = new OfflineFixtureBrokerR127({binding: ledger.binding, market: 'crypto', currency: 'USDT', symbol: 'FIXTUREUSDT', scope, now: () => clock.now});
  const fixtureBinding = {registrationId: 'synthetic:registration', clientId: 'synthetic:client', ownerScope: context.ownerScope, evidenceMode: 'offline_fixture'};
  const state = {starts: 0, reconnects: 0, closes: 0, lostStart: false, missingAuthority: false, performanceAllowed: true, performanceCalls: [], proof: null};
  const authority = {...lab,
    recordStart(command) {state.starts++; const result = lab.recordStart(command); if (state.lostStart) throw Error('FIXTURE_START_RESPONSE_LOST'); return result;},
    reconnect(command) {state.reconnects++; if (state.missingAuthority) throw Error('FIXTURE_AUTHORITY_UNAVAILABLE'); return lab.reconnect(command);},
    closeCycle(command) {state.closes++; return lab.closeCycle(command);}};
  const startFee = {authority, authorityId: 'synthetic:um001:instance-1', accountKey: 'synthetic:account', ownerKey: 'synthetic:owner',
    cycleId: 'synthetic:cycle:1', requestId: 'synthetic:start:1'};
  // Controlled callback fixture only, not native Letter integration evidence.
  const performanceAuthority = request => {
    state.performanceCalls.push(request.stage);
    const proof = {schema: 'JENIOS_ULTRA_PERFORMANCE_AUTHORITY_R129', source: 'letter.monthly.r129', evidenceMode: 'offline_fixture',
      authorityInstanceId: 'letter-lab-r129:00000000-0000-4000-8000-000000000001',
      fixtureBinding, cycleBinding: {accountKey: startFee.accountKey, ownerKey: startFee.ownerKey, cycleId: startFee.cycleId},
      gateIdentity: {customer_id: 'synthetic:client', billing_account_id: startFee.accountKey, environment: 'demo'}, observedAtMs: clock.now,
      gate: {synthetic_only: true, actual_execution_authorized: false, allowed_in_simulation: state.performanceAllowed,
        blocked_obligations: state.performanceAllowed ? [] : ['synthetic:obligation'], reason: state.performanceAllowed ? 'fixture_clear' : 'fixture_pending'}};
    return state.proof ? state.proof(proof, request) : proof;
  };
  const options = {config, market: 'crypto', ledger, adapter, scope, now: () => clock.now, onWarning: async () => true,
    ownerScope: context.ownerScope, connectionScope: context.connectionId, sessionId: context.sessionId, fixtureBinding, startFee, performanceAuthority};
  const runtime = new DurableUltraRuntimeR129(options);
  t.after(() => {for (const item of ledgers) {try {item.close();} catch {}} rmSync(directory, {recursive: true, force: true});});
  return {directory, path, clock, lab, binding, context, config, ledger, adapter, scope, state, authority, startFee, fixtureBinding, performanceAuthority, options, runtime, reopen};
}

test('R129 one durable Start reserves once for multiple operations and same-cycle resumes', async t => {
  const f = fixture(t); const started = await f.runtime.start(), expiry = started.session.expiresAtMs;
  assert.equal(started.startPreparation.startReady, true);
  for (let i = 0; i < 3; i++) {
    assert.equal((await f.runtime.tick()).state, 'open');
    assert.equal((await f.runtime.closePositions()).state, 'confirmed');
    f.clock.now += 100;
    if (i < 2) await f.runtime.resume();
  }
  assert.equal((await f.runtime.finish()).phase, 'ended');
  assert.equal(f.runtime.session().expiresAtMs, expiry);
  assert.equal(f.state.starts, 1); assert.equal(f.adapter.submissions, 3);
  assert.equal(f.lab.readReservationJournal().length, 1);
  assert.equal(f.lab.readAccount(f.startFee.accountKey).reservedSimulatedCents, 500);
  assert.equal(f.runtime.startPreparation().cycle.phase, 'paused');
  assert.equal(f.runtime.startPreparation().cycle.reservation.settlement, 'pending_capture_or_release_policy');
  assert.equal(f.runtime.startPreparation().billingEnabled, false); assert.equal(f.runtime.session().liveExecutionEnabled, false);
});

test('R129 same UM001 instance deduplicates Start observations across platforms', async t => {
  const clock = {now: initialNow}, lab = laboratory(clock);
  const jenios = fixture(t, {clock, lab, platform: 'jenios'}), flow = fixture(t, {clock, lab, platform: 'flow'});
  await jenios.runtime.start(); await flow.runtime.start();
  assert.equal(jenios.runtime.startPreparation().reservationKey, flow.runtime.startPreparation().reservationKey);
  assert.equal(lab.readReservationJournal().length, 1); assert.equal(lab.readAccount('synthetic:account').reservedSimulatedCents, 500);
  assert.equal(jenios.adapter.submissions + flow.adapter.submissions, 0);
});

test('R129 lost Start reply blocks openings then reconciles without a second Start', async t => {
  const f = fixture(t); f.state.lostStart = true;
  await f.runtime.start(); assert.equal(f.runtime.startPreparation().startReady, false);
  await f.runtime.tick(); assert.equal(f.adapter.submissions, 0); assert.equal(f.ledger.operations().length, 0);
  assert.equal(f.runtime.reconcileStartPreparation().startReady, true);
  assert.equal((await f.runtime.tick()).state, 'open');
  assert.equal(f.state.starts, 1); assert.equal(f.lab.readReservationJournal().length, 1);
});

test('R129 restart rechecks authority and preserves the original cycle and expiry', async t => {
  const f = fixture(t); f.state.lostStart = true; await f.runtime.start(); const expiry = f.runtime.session().expiresAtMs;
  f.ledger.close(); f.clock.now += 1000; const ledger = f.reopen();
  const next = new DurableUltraRuntimeR129({...f.options, ledger});
  assert.equal((await next.start()).resumeRequired, true); assert.equal(next.startPreparation().startReady, false);
  await assert.rejects(() => next.tick(), /SESSION_RESUME_REQUIRED/);
  await next.resume({recover: true}); assert.equal(next.startPreparation().startReady, true);
  assert.equal(next.session().expiresAtMs, expiry); assert.equal(next.session().startedAtMs, initialNow);
  assert.equal(f.state.starts, 1); assert.equal((await next.tick()).state, 'open');
});

test('R129 a replacement empty authority cannot recreate a cached reservation', async t => {
  const f = fixture(t); await f.runtime.start(); const first = await f.runtime.tick();
  const empty = laboratory(f.clock); let attempted = 0;
  const authority = {...empty, recordStart(command) {attempted++; return empty.recordStart(command);}};
  const next = new DurableUltraRuntimeR129({...f.options, startFee: {...f.startFee, authority}});
  await next.resume(); assert.equal(next.startPreparation().startReady, false); assert.equal(next.startPreparation().lastError, 'UNKNOWN_CYCLE');
  f.adapter.tradingAllowed = false;
  assert.equal((await next.cancel(first.clientOrderId)).state, 'confirmed');
  assert.equal((await next.closePositions()).state, 'confirmed');
  assert.equal(attempted, 0); assert.equal(empty.readReservationJournal().length, 0); assert.equal(f.adapter.submissions, 1);
});

test('R129 genuine pending activation remains pending after Admin changes future Starts', async t => {
  const f = fixture(t, {enabled: null}); await f.runtime.start();
  assert.equal(f.runtime.startPreparation().cycle.reservation.status, 'pending_activation_definition');
  await f.lab.admin.setPlanEnabled({syntheticOnly: true, planId: 'synthetic:classification', enabled: true, expectedVersion: 0,
    requestId: 'synthetic:admin-change', reason: 'fixture evidence'}, 'fixture-admin');
  assert.equal(f.runtime.reconcileStartPreparation().startReady, false); await f.runtime.tick();
  assert.equal(f.adapter.submissions, 0); assert.equal(f.state.starts, 1); assert.equal(f.lab.readReservationJournal().length, 0);
  const next = f.lab.recordStart({syntheticOnly: true, accountKey: f.startFee.accountKey, cycleId: 'synthetic:cycle:2', requestId: 'synthetic:start:2',
    platform: 'flow', startedAt: new Date(f.clock.now).toISOString(), intent: 'explicit_new_cycle'});
  assert.equal(next.preparationStatus, 'ready_simulated'); assert.equal(next.planAtStart.version, 1);
});

for (const values of [{eligibility: 'pending', expected: 'pending_plan_definition'}, {balanceCents: null, expected: 'pending_simulated_balance'},
  {balanceCents: 499, expected: 'insufficient_simulated_balance'}]) test(`R129 ${values.expected} cannot authorize an opening`, async t => {
  const f = fixture(t, values); await f.runtime.start(); await f.runtime.tick();
  assert.equal(f.runtime.startPreparation().cycle.reservation.status, values.expected);
  assert.equal(f.runtime.startPreparation().startReady, false); assert.equal(f.adapter.submissions, 0); assert.equal(f.lab.readReservationJournal().length, 0);
});

test('R129 performance pending blocks only openings and release uses a fresh callback', async t => {
  const f = fixture(t); f.state.performanceAllowed = false; await f.runtime.start(); await f.runtime.tick();
  assert.equal(f.adapter.submissions, 0); assert.equal(f.ledger.operations().length, 0); assert.equal(f.ledger.paused(), false);
  f.state.performanceAllowed = true; const first = await f.runtime.tick(); assert.equal(first.state, 'open');
  f.state.performanceAllowed = false; f.state.missingAuthority = true; f.runtime.reconcileStartPreparation();
  const calls = f.state.performanceCalls.length;
  f.adapter.tradingAllowed = false; f.adapter.streamSynchronized = false;
  assert.equal((await f.runtime.cancel(first.clientOrderId)).state, 'confirmed');
  assert.equal((await f.runtime.closePositions()).state, 'confirmed');
  assert.equal((await f.runtime.tick()).state, 'paused');
  assert.equal(f.state.performanceCalls.length, calls); assert.equal(f.adapter.commandSubmissions, 2); assert.equal(f.adapter.submissions, 1);
});

test('R129 final performance recheck withholds an unsent intention without fabricated exposure', async t => {
  const f = fixture(t); await f.runtime.start();
  const preflight = f.adapter.preflight.bind(f.adapter);
  f.adapter.preflight = async request => {const result = await preflight(request); f.state.performanceAllowed = false; return result;};
  const result = await f.runtime.tick();
  assert.equal(result.state, 'opening_withheld'); assert.equal(result.brokerSubmissionAttempted, false);
  assert.equal(f.adapter.submissions, 0); assert.equal(f.adapter.orders.size, 0); assert.equal(f.ledger.pending().length, 0);
  const operation = f.ledger.operation(result.clientOrderId), order = f.ledger.order(result.clientOrderId);
  assert.equal(operation.state, 'cancelled'); assert.equal(Number(operation.entryQuantity), 0); assert.deepEqual(operation.brokerRefs, []);
  assert.equal(order.receipt.brokerSubmissionAttempted, false); assert.equal(f.ledger.db.prepare('SELECT count(*) AS n FROM ultra_execution_receipts').get().n, 0);
  assert.deepEqual(f.state.performanceCalls, ['preflight', 'submitProtected']);
  f.state.performanceAllowed = true; f.adapter.preflight = preflight; f.clock.now += 100;
  await f.runtime.resume(); assert.equal((await f.runtime.tick()).state, 'open'); assert.equal(f.state.starts, 1);
});

for (const [name, invalid] of [
  ['boolean', () => true], ['unknown', () => null], ['promise', proof => Promise.resolve(proof)],
  ['stale', proof => ({...proof, observedAtMs: initialNow - 6000})],
  ['wrong owner', proof => ({...proof, fixtureBinding: {...proof.fixtureBinding, ownerScope: 'different-owner'}})],
  ['wrong environment', proof => ({...proof, gateIdentity: {...proof.gateIdentity, environment: 'live'}})],
  ['other customer', proof => ({...proof, gateIdentity: {...proof.gateIdentity, customer_id: 'synthetic:other-client'}})],
  ['other billing account', proof => ({...proof, gateIdentity: {...proof.gateIdentity, billing_account_id: 'synthetic:other-billing'}})],
  ['missing authority instance', proof => {const {authorityInstanceId, ...rest} = proof; return rest;}],
]) test(`R129 ${name} performance evidence fails closed`, async t => {
  const f = fixture(t); f.state.proof = invalid; await f.runtime.start(); await f.runtime.tick();
  assert.equal(f.adapter.submissions, 0); assert.equal(f.ledger.operations().length, 0);
  assert.equal(f.runtime.startPreparation().performanceGate.allowed, false);
});

test('R129 changed account/cycle binding is rejected before another authority call', async t => {
  const f = fixture(t); await f.runtime.start();
  assert.throws(() => new DurableUltraRuntimeR129({...f.options, startFee: {...f.startFee, cycleId: 'synthetic:another-cycle'}}), /PERSISTED_CYCLE_BINDING_MISMATCH/);
  assert.throws(() => new DurableUltraRuntimeR129({...f.options, fixtureBinding: {...f.fixtureBinding, ownerScope: 'wrong-owner'}}), /CYCLE_OWNER_FIXTURE_MISMATCH/);
  assert.equal(f.state.starts, 1); assert.equal(f.lab.readReservationJournal().length, 1);
});

test('R129 rejects a mismatched authoritative owner before reserving', async t => {
  const f = fixture(t);
  assert.throws(() => new DurableUltraRuntimeR129({...f.options, startFee: {...f.startFee, ownerKey: 'synthetic:wrong-owner'}}), /CYCLE_OWNER_FIXTURE_MISMATCH/);
  f.authority.readAccount = accountKey => ({...f.lab.readAccount(accountKey), ownerKey: 'synthetic:different-authoritative-owner'});
  await f.runtime.start(); assert.equal(f.runtime.startPreparation().startReady, false);
  assert.equal(f.state.starts, 0); assert.equal(f.lab.readReservationJournal().length, 0); assert.equal(f.adapter.submissions, 0);
});

test('R129 stale controller cannot reconcile or replace the active bridge state', async t => {
  const f = fixture(t); await f.runtime.start(); const next = new DurableUltraRuntimeR129(f.options); await next.resume();
  const saved = f.ledger.transport('ultra_start_cycle_r129:session-1'), queries = f.state.reconnects;
  assert.throws(() => f.runtime.reconcileStartPreparation(), /CONTROLLER_SUPERSEDED/);
  assert.equal(f.state.reconnects, queries); assert.deepEqual(f.ledger.transport('ultra_start_cycle_r129:session-1'), saved);
  assert.equal(next.startPreparation().startReady, true);
});

test('R129 finish directly records ended; draining never asserts closed exposure', async t => {
  const flat = fixture(t); await flat.runtime.start(); assert.equal((await flat.runtime.finish()).phase, 'ended');
  assert.equal(flat.runtime.startPreparation().cycle.phase, 'ended');
  const exposed = fixture(t); await exposed.runtime.start(); await exposed.runtime.tick();
  assert.equal((await exposed.runtime.finish()).phase, 'draining'); assert.equal(exposed.runtime.startPreparation().cycle.phase, 'paused');
  assert.ok(exposed.ledger.pending().length); assert.equal(exposed.runtime.session().finishedAtMs, null);
  await exposed.runtime.closePositions(); assert.equal((await exposed.runtime.finish()).phase, 'ended');
  assert.equal(exposed.runtime.startPreparation().cycle.phase, 'paused'); assert.equal(exposed.state.closes, 1);
});

test('R129 does not manufacture a Start when attaching an existing R128 session', async t => {
  const f = fixture(t); const legacy = new DurableUltraRuntimeR128(f.options); await legacy.start();
  const next = new DurableUltraRuntimeR129(f.options); await next.resume(); await next.tick();
  assert.equal(next.startPreparation().authorityState, 'unattributed');
  assert.equal(f.state.starts, 0); assert.equal(f.lab.readReservationJournal().length, 0); assert.equal(f.adapter.submissions, 0);
});

function registerPerformanceDebt(wrapper, f) {
  const opened = '2026-10-15T12:00:00Z', ended = '2026-10-15T13:00:00Z';
  const operation = {...initialOperation({market: 'b3', symbol: 'WINZ99', currency: 'BRL', side: 'buy', quantity: '1'}, 'synthetic:monthly-operation', Date.parse(opened)),
    state: 'closed', openedAt: opened, closedAt: ended, updatedAt: ended, entryQuantity: '1', exitQuantity: '1', entryPrice: '100', exitPrice: '101',
    gross: '1000', fees: '0', financing: '0', costsComplete: true, brokerRefs: ['synthetic:monthly-broker-ref']};
  const sources = [{sourceId: 'synthetic:monthly-source', platform: 'jenios', report: {schema: 'JENIOS_ULTRA_OPERATIONS_V1', provider: 'profit', environment: 'demo',
    connectionLabel: 'Fictícia', accountFingerprint: 'a'.repeat(64), generatedAt: new Date(f.clock.now).toISOString(), operations: [operation]}}];
  const month = '2026-10', timeZone = 'America/Bahia', view = consolidateMonthlyReports(sources, {month, timeZone, now: f.clock.now});
  const scope = {company_id: 'synthetic:company', customer_id: f.fixtureBinding.clientId, billing_account_id: f.startFee.accountKey,
    receiver_id: 'synthetic:receiver', legal_entity_id: 'synthetic:entity', environment: 'demo', currency: 'BRL', month, timezone: timeZone};
  const prepared = wrapper.prepare({sources, month, timeZone, now: f.clock.now, settlementScope: scope, expectedAccountKeys: [view.groups[0].accountKey],
    accountBindings: [{...scope, source_account_key: view.groups[0].accountKey, broker_account_id: 'synthetic:monthly-broker', period_start: view.periodStart, period_end: view.periodEnd}],
    policy: {version: 'synthetic:policy', mode: 'individual', eligibilityReference: 'synthetic:policy-evidence', aggregationScope: 'single_account_confirmed', timeZone, timezoneReference: 'synthetic:timezone'},
    evidence: {sourceComplete: true, brokerReconciled: true, identityConfirmed: true, ultraAttributionConfirmed: true, settlementScopeComplete: true,
      platformCosts: {complete: true, eligibleAmount: '0', treatmentReference: 'synthetic:cost-treatment'}, priorLosses: {status: 'none_confirmed', reference: 'synthetic:complete-history'}, sha256: digest(sources)},
    product: 'jenios', collectionProduct: 'jenios'});
  assert.equal(prepared.draft.status, 'prepared'); wrapper.register(prepared);
  wrapper.markSyntheticAwaitingPayment(prepared.draft.obligation_id, 'synthetic-invoice-runtime-r129');
  return prepared.draft.obligation_id;
}

test('R129 pins the same Letter instance across restart and new cycles while preserving reductions', async t => {
  const f = fixture(t), original = createLetterMonthlyR129({syntheticOnly: true}), replacement = createLetterMonthlyR129({syntheticOnly: true});
  const gateIdentity = {customer_id: f.fixtureBinding.clientId, billing_account_id: f.startFee.accountKey, environment: 'demo'};
  const callback = (wrapper, fee = f.startFee) => wrapper.createPerformanceAuthority({fixtureBinding: f.fixtureBinding,
    cycleBinding: {accountKey: fee.accountKey, ownerKey: fee.ownerKey, cycleId: fee.cycleId}, gateIdentity, now: () => f.clock.now});
  const first = new DurableUltraRuntimeR129({...f.options, performanceAuthority: callback(original)});
  await first.start(); const order = await first.tick(); assert.equal(order.state, 'open');
  const pinKey = 'ultra_performance_authority_r129:' + digest({fixtureBinding: f.fixtureBinding, accountBinding: f.ledger.binding});
  const pin = f.ledger.transport(pinKey); assert.match(pin.identity.authorityInstanceId, /^letter-lab-r129:/);
  const obligationId = registerPerformanceDebt(original, f);
  assert.equal(original.gate({...gateIdentity, action: 'open'}).allowed_in_simulation, false);
  assert.equal(replacement.gate({...gateIdentity, action: 'open'}).allowed_in_simulation, true);

  const restarted = new DurableUltraRuntimeR129({...f.options, performanceAuthority: callback(replacement)});
  await restarted.resume(); f.adapter.tradingAllowed = false;
  assert.equal((await restarted.cancel(order.clientOrderId)).state, 'confirmed');
  assert.equal((await restarted.closePositions()).state, 'confirmed');
  f.adapter.tradingAllowed = true; f.clock.now += 100; await restarted.resume();
  await restarted.tick(); assert.equal(restarted.startPreparation().performanceGate.reason, 'R129_PERFORMANCE_AUTHORITY_INSTANCE_CHANGED');
  assert.equal(f.adapter.submissions, 1); assert.deepEqual(f.ledger.transport(pinKey), pin);
  assert.equal((await restarted.finish()).phase, 'ended'); assert.equal(original.read(obligationId).status, 'awaiting_payment');

  f.ledger.close(); f.clock.now += 100;
  const ledger = f.reopen({...f.context, sessionId: 'session-2'});
  const startFee = {...f.startFee, cycleId: 'synthetic:cycle:2', requestId: 'synthetic:start:2'};
  const nextCycle = new DurableUltraRuntimeR129({...f.options, ledger, sessionId: 'session-2', startFee, performanceAuthority: callback(replacement, startFee)});
  await nextCycle.start({recover: true}); assert.equal(nextCycle.startPreparation().startReady, true);
  await nextCycle.tick(); assert.equal(nextCycle.startPreparation().performanceGate.reason, 'R129_PERFORMANCE_AUTHORITY_INSTANCE_CHANGED');
  assert.equal(f.adapter.submissions, 1); assert.deepEqual(ledger.transport(pinKey), pin);
  assert.equal(f.lab.readReservationJournal().length, 2); // Two explicit cycles; one reservation each.
});
