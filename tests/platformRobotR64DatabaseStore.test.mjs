import test from 'node:test';
import assert from 'node:assert/strict';
import { createR64DatabaseStore, hashR64CycleInput, R64_DATABASE_RPCS } from '../lib/platform/research/robot-r64-database-store.mjs';
import { createR64TelemetryFixture } from '../scripts/platform/research/r64-telemetry-fixtures.mjs';

const fixture = createR64TelemetryFixture();
const scopeId = fixture.study.scopeId, periodKey = fixture.study.periodKey;
const cycleId = '64000000-0000-4000-8000-000000000001', leaseOwner = '64000000-0000-4000-8000-000000000002';
const lease = { cycleId, leaseOwner, leaseGeneration: 1 };
const input = () => ({ schema: 'JENIOS_R64_OPERATIONAL_CYCLE_INPUT_V1', evidenceKind: 'SIGNED_QA_REPLAY',
  scopeId, periodKey, study: fixture.study });
const claim = () => { const value = input(); return { scopeId, periodKey, input: value, inputDigest: hashR64CycleInput(value) }; };
const report = () => ({ schema: 'JENIOS_R64_OPERATIONAL_REPORT_V1', evidenceKind: 'SIGNED_QA_REPLAY',
  scopeId, periodKey, actualBrokerPnl: null, actualLossesAvoided: null, realTradeAccuracy: null,
  realOrdersSent: 0, externalPaperOrdersSent: 0, productionMonitoringStarted: false });
const result = (patch = {}) => ({ kind: 'not_generated', reason: 'DISABLED', fingerprint: null, model: null,
  pricingVersion: null, providerResponseId: null, usage: null, costNanoUsd: null, responseDigest: null,
  analysis: null, analysisStatus: 'NOT_AVAILABLE', httpRequests: 0, inferenceRequests: 0,
  retryAllowed: false, mayPromote: false, ...patch });
const request = () => ({ fingerprint: 'a'.repeat(64), model: 'gpt-6-luna', pricingVersion: '2026-10-20-v2-nano',
  reservationNanoUsd: 1350000, maxInputTokens: 8000, maxOutputTokens: 700 });
function fake(responder) {
  const calls = [];
  const store = createR64DatabaseStore({ db: { rpc: async (name, args) => {
    calls.push({ name, args }); return { data: await responder(name, args), error: null };
  } } });
  return { store, calls };
}

test('R64 database requires an injected RPC client; no connection or provider is created', () => {
  assert.throws(() => createR64DatabaseStore(), /R64_DATABASE_CLIENT_REQUIRED/);
  assert.throws(() => createR64DatabaseStore({ db: {} }), /R64_DATABASE_CLIENT_REQUIRED/);
  assert.equal(Object.keys(R64_DATABASE_RPCS).length, 8);
});

test('R64 canonical input identity ignores key order and refuses getters before invocation', () => {
  assert.equal(hashR64CycleInput({ b: 2, a: 1 }), hashR64CycleInput({ a: 1, b: 2 }));
  let touched = 0;
  assert.throws(() => hashR64CycleInput({ get value() { touched++; return 'secret'; } }), /R64_CANONICAL/);
  assert.equal(touched, 0);
});

test('R64 stores only a validated admission receipt and retains its source identity', async () => {
  const { store, calls } = fake(() => ({ status: 'STORED', scopeId, eventId: fixture.receipts[0].eventId }));
  assert.equal((await store.ingestReceipt({ receipt: fixture.receipts[0] })).status, 'STORED');
  assert.equal(calls[0].name, 'jenios_robot_r64_ingest');
  assert.deepEqual(calls[0].args.p_input.receipt, fixture.receipts[0]);
  const forged = structuredClone(fixture.receipts[0]); forged.evidenceKind = 'LIVE';
  await assert.rejects(store.ingestReceipt({ receipt: forged }), /R64_/);
  assert.equal(calls.length, 1);
});

test('R64 period reads reject other scopes and overflow instead of truncating evidence', async () => {
  const cross = structuredClone(fixture.receipts[0]); cross.scopeId = 'scope:ffffffffffffffff';
  const a = fake(() => [cross]); await assert.rejects(a.store.readReceipts({ scopeId, period: fixture.period }), /R64_/);
  const b = fake(() => Array(5001).fill(fixture.receipts[0]));
  await assert.rejects(b.store.readReceipts({ scopeId, period: fixture.period }), /R64_DATABASE_RECEIPT_OVERFLOW/);
});

test('R64 period reads preserve actual occurrence boundaries and disallow duplicates', async () => {
  const { store } = fake(() => fixture.receipts);
  const rows = await store.readReceipts({ scopeId, period: fixture.period });
  assert.equal(rows.length, fixture.receipts.length);
  const dup = fake(() => [fixture.receipts[0], fixture.receipts[0]]);
  await assert.rejects(dup.store.readReceipts({ scopeId, period: fixture.period }), /R64_DATABASE_RESPONSE/);
  await assert.rejects(store.readReceipts({ scopeId, period: { startMs: 0, endMs: 86400001 } }), /R64_DATABASE_PERIOD/);
});

test('R64 cycle claims bind the complete frozen input digest before any RPC', async () => {
  const { store, calls } = fake(() => ({ status: 'CLAIMED', ...lease, input: input() }));
  assert.equal((await store.claimCycle(claim())).leaseOwner, leaseOwner);
  const altered = claim(); altered.inputDigest = 'f'.repeat(64);
  await assert.rejects(store.claimCycle(altered), /R64_DATABASE_INPUT_DIGEST/);
  assert.equal(calls.length, 1);
});

test('R64 refuses a claimed lease whose returned frozen input differs', async () => {
  const other = input(); other.extra = 'changed';
  const { store } = fake(() => ({ status: 'CLAIMED', ...lease, input: other }));
  await assert.rejects(store.claimCycle(claim()), /R64_DATABASE_RESPONSE/);
});

test('R64 private cycle lookup returns original input without exposing a lease owner', async () => {
  const row = { cycleId, scopeId, periodKey, status: 'CLAIMED', inputDigest: claim().inputDigest,
    input: input(), leaseGeneration: 1, leaseUntilMs: Date.now() + 60000, report: null };
  const good = fake(() => row);
  assert.deepEqual((await good.store.readCycle({ scopeId, periodKey })).input, input());
  const bad = fake(() => ({ ...row, leaseOwner }));
  await assert.rejects(bad.store.readCycle({ scopeId, periodKey }), /R64_DATABASE_RESPONSE/);
  assert.equal(await fake(() => null).store.readCycle({ scopeId, periodKey }), null);
});

test('R64 dispatch accepts the fixed quote contract and refuses provider bodies or changed token caps', async () => {
  const { store, calls } = fake(() => ({ dispatchGranted: true, reason: 'DISPATCHED' }));
  assert.equal((await store.reserveAndDispatch({ ...lease, request: request() })).dispatchGranted, true);
  await assert.rejects(store.reserveAndDispatch({ ...lease, request: { ...request(), body: { secret: 'never persist' } } }), /R64_DATABASE_RESERVATION/);
  await assert.rejects(store.reserveAndDispatch({ ...lease, request: { ...request(), maxOutputTokens: 701 } }), /R64_DATABASE_RESERVATION/);
  assert.equal(calls.length, 1);
});

test('R64 no-provider completion requires a durably returned scoped QA report', async () => {
  const { store } = fake(() => ({ status: 'COMPLETED', cycleId, replayed: false, report: report() }));
  const saved = await store.completeCycle({ ...lease, result: result(), report: report() });
  assert.equal(saved.status, 'COMPLETED'); assert.equal(saved.report.actualBrokerPnl, null);
  const missing = fake(() => ({ status: 'COMPLETED', cycleId, replayed: false }));
  await assert.rejects(missing.store.completeCycle({ ...lease, result: result(), report: report() }), /R64_/);
});

test('R64 refuses real-performance claims, operational classifications and forged no-call costs', async () => {
  const { store, calls } = fake(() => null);
  for (const bad of [{ actualBrokerPnl: 1 }, { realOrdersSent: 1 }, { productionMonitoringStarted: true }, { evidenceKind: 'LIVE' }])
    await assert.rejects(store.completeCycle({ ...lease, result: result(), report: { ...report(), ...bad } }), /R64_DATABASE_REPORT/);
  await assert.rejects(store.completeCycle({ ...lease, result: result({ costNanoUsd: 0 }), report: report() }), /R64_DATABASE_ANALYSIS_RESULT/);
  assert.equal(calls.length, 0);
});

test('R64 confirmed usage and unknown provider outcomes preserve their distinct cost evidence', async () => {
  const known = result({ kind: 'usage_confirmed', ...request(), costNanoUsd: 33450, usage: { input_tokens: 123, output_tokens: 25 },
    providerResponseId: 'resp_fixture_ok', inferenceRequests: 1, httpRequests: 2 });
  const { store } = fake(() => ({ status: 'COMPLETED', cycleId, replayed: false, report: report() }));
  assert.equal((await store.completeCycle({ ...lease, result: known, report: report() })).status, 'COMPLETED');
  const unknown = result({ kind: 'unknown', ...request(), providerResponseId: 'resp_fixture_unknown',
    inferenceRequests: 1, httpRequests: 2 });
  const pending = fake(() => ({ status: 'NEEDS_RECONCILIATION', cycleId, replayed: false, report: report() }));
  assert.equal((await pending.store.markDispatchUnknown({ ...lease, result: unknown, report: report() })).status, 'NEEDS_RECONCILIATION');
});

test('R64 readReports rejects private worker metadata while surfacing a crashed dispatched job', async () => {
  const row = { cycleId, scopeId, periodKey, status: 'COMPLETED', report: report() };
  await assert.rejects(fake(() => [{ ...row, leaseOwner }]).store.readReports({ scopeId }), /R64_DATABASE_RESPONSE/);
  assert.equal((await fake(() => [{ ...row, status: 'NEEDS_RECONCILIATION', report: null }]).store.readReports({ scopeId }))[0].report, null);
  await assert.rejects(fake(() => [{ ...row, report: null }]).store.readReports({ scopeId }), /R64_DATABASE_RESPONSE/);
});

test('R64 analyst policy has explicit disabled defaults and rejects malformed limits', async () => {
  const policy = { generationEnabled: false, requiresReconciliation: false, allowedModels: [], pricingVersion: null,
    pricingApproved: false, ratesVerifiedAt: null, maxRequestProviderNanoUsd: 0, monthlyProviderLimitNanoUsd: 0 };
  assert.deepEqual(await fake(() => policy).store.readAnalystPolicy(), policy);
  await assert.rejects(fake(() => ({ ...policy, monthlyProviderLimitNanoUsd: -1 })).store.readAnalystPolicy(), /R64_DATABASE_RESPONSE/);
});

test('R64 snapshots requests before await and never leaks database error details', async () => {
  const original = claim(); let captured, release;
  const wait = new Promise(resolve => { release = resolve; });
  const store = createR64DatabaseStore({ db: { rpc: async (name, args) => {
    captured = args.p_input; await wait; return { data: { status: 'CLAIMED', ...lease, input: captured.input }, error: null };
  } } });
  const operation = store.claimCycle(original); original.input.mutatedAfterCall = true; release();
  await operation; assert.equal(captured.input.mutatedAfterCall, undefined);
  const bad = createR64DatabaseStore({ db: { rpc: async () => ({ data: null, error: { message: 'password=SECRET https://private.invalid' } }) } });
  await assert.rejects(bad.readReports({ scopeId }), error => error.message === 'R64_DATABASE_UNAVAILABLE');
  const fenced = createR64DatabaseStore({ db: { rpc: async () => ({ data: null, error: { message: 'R64_DATABASE_STALE_LEASE' } }) } });
  await assert.rejects(fenced.reserveAndDispatch({ ...lease, request: request() }), /R64_DATABASE_STALE_LEASE/);
});
