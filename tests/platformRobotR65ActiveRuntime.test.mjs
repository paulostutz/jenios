import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createR65EvolutionState, registerR65Evaluation, runR65EvolutionCycle, rollbackR65Evolution,
} from '../lib/platform/research/robot-r65-evolution-engine.mjs';
import {
  createR65ActiveRuntime, inspectR65ActiveRuntime, stepR65ActiveRuntime,
} from '../lib/platform/research/robot-r65-active-runtime.mjs';
import { verifyR64TelemetryEnvelope } from '../lib/platform/research/robot-r64-telemetry.mjs';
import { createR64TelemetryFixture, signR64QaPayload } from '../scripts/platform/research/r64-telemetry-fixtures.mjs';

const T = Date.UTC(2026, 9, 24, 12), SCOPE = 'scope:0000000000000001';
const clone = value => JSON.parse(JSON.stringify(value));
const denies = (fn, code) => assert.throws(fn, error => error?.code && (!code || error.code === code));
const config = (patch = {}) => ({ evidenceKind: 'SYNTHETIC_FIXTURE', sessionId: 'session:0000000000000001',
  planCode: 'platform-global-crypto', symbol: 'BTC-USD', capital: 1000, leverage: 2, ...patch });
const initial = () => createR65EvolutionState({ scopeId: SCOPE, nowMs: T - 86400000 });
const snapshot = (runtime, state, marketAgeMs = 650, scenario = 'normal') =>
  stepR65ActiveRuntime({ runtime, state, event: { type: 'snapshot', scenario, marketAgeMs } });
function ready(state, marketAgeMs = 650, patch = {}) {
  return snapshot(snapshot(createR65ActiveRuntime({ state, config: config(patch) }), state, marketAgeMs), state, marketAgeMs);
}
function evolution(state = initial(), number = 1) {
  const f = createR64TelemetryFixture({ generatedAtMs: T });
  const receipts = f.envelopes.map(envelope => {
    const payload = clone(envelope.payload); payload.event.policyVersion = 'research:r65-v1';
    return verifyR64TelemetryEnvelope(signR64QaPayload(payload, f.privateKey),
      { trustedSource: f.trustedSource, nowMs: T });
  });
  const definitions = [[100, true], [200, true], [600, false], [700, false], [900, false], [1000, false]];
  const caseDefinitions = definitions.map(([age, expectedAllow], i) => ({
    caseId: 'case:' + (i + 1).toString(16).padStart(16, '0'), snapshotAgesMs: [age, age], expectedAllow }));
  const plan = { planId: 'plan:' + number.toString(16).padStart(16, '0'), scopeId: SCOPE,
    evidenceKind: 'SYNTHETIC_FIXTURE', startsAtMs: T + 1000, endsAtMs: T + 7000, caseDefinitions };
  const registered = registerR65Evaluation({ state, receipts, period: f.period, studyAtMs: T,
    sourceCycleId: '00000000-0000-4000-8000-000000000001', plan, nowMs: T + 1 });
  const validationCases = caseDefinitions.map((c, i) => ({ ...c, scopeId: SCOPE,
    evidenceKind: 'SYNTHETIC_FIXTURE', occurredAtMs: T + 1000 + i * 100 }));
  const applied = runR65EvolutionCycle({ state: registered, validationCases, nowMs: T + 7000 }).state;
  const rolledBack = rollbackR65Evolution({ state: applied, reason: 'REGRESSION_DETECTED', nowMs: T + 8000 });
  return { registered, applied, rolledBack };
}

test('R65 active configuration changes actual R61 plus R47 decisions and rollback restores future behavior', () => {
  const state = initial(), versions = evolution(state);
  const before = ready(state, 650);
  assert.equal(before.allowSyntheticDecision, true);
  assert.equal(before.session.allowSyntheticDecision, true);
  assert.equal(before.freshness.allow, true);
  assert.equal(before.policyVersion, 'research:r65-v1');
  const after = snapshot(before, versions.applied, 650);
  assert.equal(after.session.allowSyntheticDecision, true);
  assert.equal(after.freshness.allow, false);
  assert.equal(after.allowSyntheticDecision, false);
  assert.equal(after.decision, 'BLOCK');
  assert.equal(after.policyVersion, 'research:r65-v2');
  assert.equal(after.maxAgeMs, 500);
  assert.equal(after.activationGeneration, 1);
  assert.equal(after.configurationReadinessReset, true);
  assert.equal(after.issue, 'STALE_CONTEXT');
  const returnedFirst = snapshot(after, versions.rolledBack, 650);
  assert.equal(returnedFirst.allowSyntheticDecision, false);
  assert.equal(returnedFirst.freshness.ingest.freshStreak, 1);
  assert.equal(returnedFirst.configurationReadinessReset, true);
  const returnedSecond = snapshot(returnedFirst, versions.rolledBack, 650);
  assert.equal(returnedSecond.allowSyntheticDecision, true);
  assert.equal(returnedSecond.activationGeneration, 2);
  assert.equal(returnedSecond.policyVersion, 'research:r65-v1');
  assert.equal(returnedSecond.maxAgeMs, 750);
  assert.deepEqual(inspectR65ActiveRuntime(clone(returnedSecond)), returnedSecond);
  assert.equal(before.allowSyntheticDecision, true);
});

test('R65 generation changes require two new fresh confirmations even when both cutoffs would allow', () => {
  const state = initial(), { applied } = evolution(state), before = ready(state, 100);
  const first = snapshot(before, applied, 100);
  assert.equal(first.session.allowSyntheticDecision, true);
  assert.equal(first.allowSyntheticDecision, false);
  assert.equal(first.freshness.ingest.freshStreak, 1);
  assert.equal(snapshot(first, applied, 100).allowSyntheticDecision, true);
});

test('R65 registering a plan does not reset unchanged active configuration readiness', () => {
  const state = initial(), { registered } = evolution(state), before = ready(state);
  const after = snapshot(before, registered);
  assert.equal(after.allowSyntheticDecision, true);
  assert.equal(after.configurationReadinessReset, false);
  assert.equal(after.activationGeneration, 0);
  assert.equal(after.events.at(-1).evolutionRevision, 1);
});

for (const scenario of ['stale_book', 'cost_shock', 'maintenance', 'unknown_exposure', 'risk_halt', 'missing_entitlement']) {
  test(`R65 never overrules the unchanged R61 ${scenario} block`, () => {
    const state = initial(), result = snapshot(ready(state, 100), state, 100, scenario);
    assert.equal(result.session.allowSyntheticDecision, false);
    assert.equal(result.allowSyntheticDecision, false);
    assert.equal(result.suggestedSide, null);
    assert.equal(result.decision, 'BLOCK');
    assert.equal(result.realOrdersSent, 0);
    assert.equal(result.externalPaperOrdersSent, 0);
  });
}

test('R65 cannot enable a plan without entitlement or clear an R61 halt through resume', () => {
  const state = initial();
  assert.equal(ready(state, 100, { planCode: 'fixture-without-ultrafast' }).allowSyntheticDecision, false);
  let runtime = snapshot(ready(state, 100), state, 100, 'risk_halt');
  for (const type of ['pause', 'resume']) runtime = stepR65ActiveRuntime({ runtime, state, event: { type } });
  runtime = snapshot(runtime, state, 100);
  assert.equal(runtime.session.status, 'HALTED');
  assert.equal(runtime.allowSyntheticDecision, false);
  assert(runtime.reasons.includes('R61_NEW_SESSION_REQUIRED'));
});

test('R65 pause and resume are operator controls without fabricated control-violation incidents', () => {
  const state = initial();
  let runtime = ready(state, 100);
  runtime = stepR65ActiveRuntime({ runtime, state, event: { type: 'pause' } });
  assert.equal(runtime.issue, 'NONE');
  assert.equal(runtime.marketAgeMs, null);
  assert.equal(runtime.allowSyntheticDecision, false);
  runtime = snapshot(runtime, state, 100);
  assert.equal(runtime.allowSyntheticDecision, false);
  runtime = stepR65ActiveRuntime({ runtime, state, event: { type: 'resume' } });
  assert.equal(runtime.issue, 'NONE');
  const first = snapshot(runtime, state, 100);
  assert.equal(first.allowSyntheticDecision, false);
  assert.equal(snapshot(first, state, 100).allowSyntheticDecision, true);
});

test('R65 retains exact cutoffs and rejects a stale-to-fresh pair as only one fresh confirmation', () => {
  const state = initial(), { applied } = evolution(state);
  assert.equal(ready(state, 750).allowSyntheticDecision, true);
  assert.equal(ready(state, 751).allowSyntheticDecision, false);
  assert.equal(ready(applied, 500).allowSyntheticDecision, true);
  assert.equal(ready(applied, 501).allowSyntheticDecision, false);
  const stale = snapshot(createR65ActiveRuntime({ state: applied, config: config() }), applied, 900);
  const first = snapshot(stale, applied, 100);
  assert.equal(first.allowSyntheticDecision, false);
  assert.equal(snapshot(first, applied, 100).allowSyntheticDecision, true);
});

test('R65 synthetic clock remains monotonic throughout the admitted age range', () => {
  const state = initial();
  let runtime = createR65ActiveRuntime({ state, config: config() });
  for (const age of [0, 60000, 0, 60000, 0, 0]) runtime = snapshot(runtime, state, age);
  assert.equal(runtime.allowSyntheticDecision, true);
  assert.equal(runtime.freshness.ingest.freshStreak, 2);
});

test('R65 rejects stale, cross-scope and forked evolution states while consuming changes prospectively', () => {
  const state = initial(), versions = evolution(state);
  const runtime = snapshot(ready(state), versions.applied, 100);
  denies(() => snapshot(runtime, state), 'R65_RUNTIME_EVOLUTION_CONTINUITY');
  const otherScope = createR65EvolutionState({ scopeId: 'scope:ffffffffffffffff', nowMs: state.createdAtMs });
  denies(() => snapshot(runtime, otherScope), 'R65_RUNTIME_EVOLUTION_CONTINUITY');
  const otherCreated = createR65EvolutionState({ scopeId: SCOPE, nowMs: state.createdAtMs - 1 });
  denies(() => snapshot(runtime, otherCreated), 'R65_RUNTIME_EVOLUTION_CONTINUITY');
  const fork = evolution(state, 2).applied;
  denies(() => snapshot(runtime, fork), 'R65_RUNTIME_EVOLUTION_CONTINUITY');
});

test('R65 runtime reconstruction rejects forged flags, nested R61 state and edited historical configuration', () => {
  const state = initial(), { applied } = evolution(state), runtime = snapshot(ready(state), applied, 650);
  for (const change of [
    r => { r.allowSyntheticDecision = true; }, r => { r.session.allowSyntheticDecision = false; },
    r => { r.maxAgeMs = 750; }, r => { r.freshness.allow = true; },
    r => { r.events.at(-1).marketAgeMs = 100; }, r => { r.events[0].evolutionRevision = 2; },
    r => { r.evolutionState.activeVersion.maxAgeMs = 750; }, r => { r.orderAuthorized = true; },
  ]) {
    const forged = clone(runtime); change(forged); denies(() => inspectR65ActiveRuntime(forged));
  }
});

test('R65 validates descriptors without evaluating getters and rejects unknown mutable configuration fields', () => {
  const state = initial(), runtime = ready(state);
  let calls = 0;
  const bad = clone(runtime);
  Object.defineProperty(bad.session, 'allowSyntheticDecision', { enumerable: true, get() { calls++; return true; } });
  denies(() => inspectR65ActiveRuntime(bad), 'R65_RUNTIME_REPLAY_MISMATCH');
  const event = { type: 'snapshot', scenario: 'normal', marketAgeMs: 100 };
  Object.defineProperty(event, 'marketAgeMs', { enumerable: true, get() { calls++; return 100; } });
  denies(() => stepR65ActiveRuntime({ runtime, state, event }), 'R65_INVALID_RUNTIME_EVENT');
  assert.equal(calls, 0);
  denies(() => createR65ActiveRuntime({ state, config: config({ maxAgeMs: 1000 }) }), 'R61_ULTRA_INVALID_CONFIG');
  denies(() => stepR65ActiveRuntime({ runtime, state, event: { type: 'snapshot', scenario: 'normal',
    marketAgeMs: 100, allow: true } }), 'R65_INVALID_RUNTIME_EVENT');
  for (const marketAgeMs of [-1, 0.5, 60001, NaN]) denies(() => snapshot(runtime, state, marketAgeMs), 'R65_INVALID_RUNTIME_EVENT');
});

test('R65 runtime keeps sizing and protected invariants unchanged and explicit after serialization', () => {
  const state = initial(), runtime = ready(state, 100, { capital: 2345, leverage: 10 });
  const inspected = inspectR65ActiveRuntime(clone(runtime));
  assert.deepEqual(inspected, runtime);
  assert.equal(inspected.session.gates.plan.notional, 2345 * 0.05 * 10);
  assert.equal(inspected.config.capital, 2345);
  assert.equal(inspected.config.leverage, 10);
  assert.equal(inspected.runtimeEvidenceKind, 'SYNTHETIC_FIXTURE');
  assert.equal(inspected.observationEvidenceKind, 'SIGNED_QA_REPLAY');
  assert.equal(inspected.externalEngineConnected, false);
  assert.equal(inspected.orderAuthorized, false);
  assert.equal(inspected.alignmentGuardThreshold, 0.65);
  assert.equal(inspected.manualOperatorControlPreserved, true);
  assert.equal(inspected.losseshometroSyntheticOnly, true);
  assert.equal(inspected.r15ProspectiveBackfill, false);
  for (const key of ['actualBrokerPnl', 'actualLossesAvoided', 'realTradeAccuracy']) assert.equal(inspected[key], null);
  assert(Object.isFrozen(inspected) && Object.isFrozen(inspected.session.gates) && Object.isFrozen(inspected.events));
});
