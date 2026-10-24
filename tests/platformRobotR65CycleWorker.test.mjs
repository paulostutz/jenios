import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { setImmediate as turn } from 'node:timers/promises';
import { ensureR65Evolution, runR65EvolutionTick, rollbackR65Durable,
  createR65RegisteredBenchmark, r65OperationId } from '../lib/platform/research/robot-r65-cycle-worker.mjs';
import { inspectR65EvolutionState } from '../lib/platform/research/robot-r65-evolution-engine.mjs';
import { studyR64AcceptedTelemetry, verifyR64TelemetryEnvelope } from '../lib/platform/research/robot-r64-telemetry.mjs';
import { hashR64CycleInput } from '../lib/platform/research/robot-r64-database-store.mjs';
import { createR64TelemetryFixture, signR64QaPayload } from '../scripts/platform/research/r64-telemetry-fixtures.mjs';

const T = Date.UTC(2026, 9, 24, 12), SCOPE = 'scope:0000000000000001';
const CYCLE = '00000000-0000-4000-8000-000000000065';
const ACTOR = 'user:11111111-1111-4111-8111-111111111165';
const clone = value => JSON.parse(JSON.stringify(value));
const fault = code => Object.assign(new Error(code), { code });
const env = () => ({ VERCEL_ENV: 'preview', JENIOS_QA_CANDIDATE_ENABLED: 'true',
  JENIOS_ROBOT_QA_ENABLED: 'true', JENIOS_ROBOT_R64_ENABLED: 'true', JENIOS_ROBOT_R65_ENABLED: 'true',
  JENIOS_REAL_EXECUTION_ENABLED: 'false', JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED: 'false',
  JENIOS_PRIVATE_PAPER_EXECUTOR: 'false' });
const rejects = (promise, code) => assert.rejects(promise, error => error?.code === code);

function observations({ count = 7, at = T, mutate } = {}) {
  const f = createR64TelemetryFixture({ count, generatedAtMs: at });
  const receipts = f.envelopes.map((envelope, index) => {
    const payload = clone(envelope.payload); payload.event.policyVersion = 'research:r65-v1';
    mutate?.(payload, index);
    return verifyR64TelemetryEnvelope(signR64QaPayload(payload, f.privateKey),
      { trustedSource: f.trustedSource, nowMs: at });
  });
  const study = studyR64AcceptedTelemetry(receipts, { scopeId: SCOPE, period: f.period, generatedAtMs: at });
  const input = { schema: 'JENIOS_R64_OPERATIONAL_CYCLE_INPUT_V1', evidenceKind: 'SIGNED_QA_REPLAY',
    scopeId: SCOPE, periodKey: study.periodKey, study };
  return { receipts, cycle: { cycleId: CYCLE, scopeId: SCOPE, periodKey: study.periodKey,
    status: 'COMPLETED', input, inputDigest: hashR64CycleInput(input) } };
}

/** Contract-only store. Its deterministic fixture clock and opaque test digest
 * do not claim PostgreSQL clock, JSONB hashing, SQL isolation or durability.
 */
function harness(options = {}) {
  const source = observations(options), calls = [], operations = new Map(), captured = new Map();
  const f = { clock: T + 1, row: null, cycle: clone(source.cycle), receipts: clone(source.receipts),
    hypothesis: null, calls, operations, captured };
  const row = state => ({ scopeId: SCOPE, revision: state.revision,
    stateDigest: createHash('sha256').update('UNIT_FIXTURE_ONLY\0' + JSON.stringify(state)).digest('hex'), state: clone(state) });
  const lifecycleStore = {
    async readEvolution(args) { calls.push(['readEvolution', clone(args)]); assert.equal(args.scopeId, SCOPE); return f.row && clone(f.row); },
    async appendEvolution(args) {
      calls.push(['appendEvolution', clone(args)]);
      const prior = operations.get(args.operationId);
      if (prior) {
        if (JSON.stringify(prior.input) !== JSON.stringify(args)) throw fault('R65_OPERATION_CONFLICT');
        return { ...clone(prior.row), replayed: true };
      }
      if (args.expectedRevision !== (f.row?.revision ?? -1) || args.previousDigest !== (f.row?.stateDigest ?? null))
        throw fault('R65_EVOLUTION_CONFLICT');
      const state = inspectR65EvolutionState(args.state);
      assert.equal(state.revision, args.expectedRevision + 1);
      assert.equal(args.scopeId, SCOPE);
      f.row = row(state);
      operations.set(args.operationId, { input: clone(args), row: clone(f.row) });
      return { ...clone(f.row), replayed: false };
    },
    async recordValidationCase(args) {
      calls.push(['recordValidationCase', clone(args)]);
      const plan = f.row?.state.pendingEvaluation?.plan;
      if (!plan || plan.planId !== args.planId || args.scopeId !== SCOPE) throw fault('R65_VALIDATION_PLAN_MISMATCH');
      const definition = plan.caseDefinitions.find(c => c.caseId === args.caseId);
      if (!definition || f.clock < plan.startsAtMs || f.clock >= plan.endsAtMs) throw fault('R65_VALIDATION_WINDOW_NOT_OPEN');
      const prior = captured.get(args.caseId);
      if (prior) return { status: 'ALREADY_STORED', case: clone(prior) };
      const value = { ...clone(definition), scopeId: SCOPE, evidenceKind: 'SYNTHETIC_FIXTURE', occurredAtMs: f.clock };
      captured.set(args.caseId, value);
      return { status: 'STORED', case: clone(value) };
    },
    async readValidationCases(args) {
      calls.push(['readValidationCases', clone(args)]);
      assert.equal(args.scopeId, SCOPE);
      return [...captured.values()].map(clone);
    },
    async readCycleHypothesis(args) { calls.push(['readCycleHypothesis', clone(args)]); return f.hypothesis && clone(f.hypothesis); },
  };
  const observationStore = {
    async readCycle(args) { calls.push(['readCycle', clone(args)]); return f.cycle && clone(f.cycle); },
    async readReceipts(args) { calls.push(['readReceipts', clone(args)]); return clone(f.receipts); },
  };
  f.lifecycleStore = lifecycleStore; f.observationStore = observationStore;
  f.tick = overrides => runR65EvolutionTick({ lifecycleStore, observationStore, scopeId: SCOPE,
    env: env(), now: () => f.clock, ...overrides });
  f.count = name => calls.filter(([operation]) => operation === name).length;
  return f;
}
async function registered(f = harness()) {
  const result = await f.tick();
  assert.equal(result.status, 'EVALUATION_REGISTERED');
  return f;
}
async function applied(f = harness()) {
  await registered(f);
  f.clock = f.row.state.pendingEvaluation.plan.startsAtMs;
  await f.tick();
  f.clock = f.row.state.pendingEvaluation.plan.endsAtMs;
  const result = await f.tick();
  assert.equal(result.status, 'AUTO_APPLIED');
  return f;
}

test('R65 worker enforces environment and scope before reading any store', async () => {
  const f = harness();
  await rejects(f.tick({ env: {} }), 'R65_DISABLED');
  await rejects(f.tick({ env: { ...env(), VERCEL_ENV: 'production' } }), 'R65_DISABLED');
  await rejects(f.tick({ scopeId: 'scope:wrong' }), 'R65_SCOPE_INVALID');
  assert.equal(f.calls.length, 0);
});

test('R65 initializes before schedule but does not consult observations before the daily report is due', async () => {
  const f = harness(); f.clock = T - 1;
  const result = await f.tick();
  assert.equal(result.status, 'NOT_DUE');
  assert.equal(result.revision, 0);
  assert.equal(f.row.state.activeVersion.maxAgeMs, 750);
  assert.equal(f.count('appendEvolution'), 1);
  assert.equal(f.count('readCycle'), 0);
  assert.equal(f.count('recordValidationCase'), 0);
});

test('R65 initializes and registers a future benchmark only after confirming the durable journal', async () => {
  const f = harness(); let completed = 0;
  const result = await f.tick({ completeObservationCycle: async () => { completed++; } });
  assert.equal(completed, 1);
  assert.equal(result.status, 'EVALUATION_REGISTERED');
  assert.equal(result.revision, 1);
  assert.equal(result.observationEvidenceKind, 'SIGNED_QA_REPLAY');
  assert.equal(result.validationEvidenceKind, 'SYNTHETIC_FIXTURE');
  assert.equal(result.hypothesisSource, 'BOUNDED_DETERMINISTIC_POLICY');
  const plan = f.row.state.pendingEvaluation.plan;
  assert(plan.startsAtMs > f.clock && plan.endsAtMs > plan.startsAtMs);
  assert.equal(plan.caseDefinitions.length, 6);
  assert.equal(f.row.state.pendingEvaluation.observation.study.receiptCount, 7);
  const appends = f.calls.filter(([name]) => name === 'appendEvolution').map(([, a]) => a);
  assert.deepEqual(appends.map(a => a.expectedRevision), [-1, 0]);
  assert(appends.every(a => a.actorId === 'system:r65' && a.scopeId === SCOPE));
  assert.equal(f.calls.at(-1)[0], 'readEvolution');
  assert.equal(f.count('recordValidationCase'), 0);
  for (const key of ['realOrdersSent', 'externalPaperOrdersSent']) assert.equal(result[key], 0);
  for (const key of ['actualBrokerPnl', 'actualLossesAvoided', 'realTradeAccuracy']) assert.equal(result[key], null);
});

test('R65 waits before the validation window without manufacturing persisted cases', async () => {
  const f = await registered(), plan = f.row.state.pendingEvaluation.plan;
  f.clock = plan.startsAtMs - 1;
  const result = await f.tick();
  assert.equal(result.status, 'WAITING_VALIDATION_WINDOW');
  assert.equal(result.nextAtMs, plan.startsAtMs);
  assert.equal(f.count('recordValidationCase'), 0);
  assert.equal(f.count('readValidationCases'), 0);
  assert.equal(f.row.revision, 1);
});

test('R65 captures real policy executions in-window, retains first occurrences on retry and applies only after closure', async () => {
  const f = await registered(), plan = f.row.state.pendingEvaluation.plan;
  f.clock = plan.startsAtMs;
  const first = await f.tick();
  assert.equal(first.status, 'VALIDATION_CAPTURED');
  assert.equal(first.recorded, 6);
  assert.equal(f.row.revision, 1);
  const timestamps = [...f.captured.values()].map(c => c.occurredAtMs);
  const measured = f.calls.filter(([name]) => name === 'recordValidationCase').map(([, a]) => [a.baselineAllow, a.candidateAllow]);
  assert.equal(measured.filter(([baseline, candidate]) => baseline && !candidate).length, 2);
  assert.equal(measured.filter(([baseline, candidate]) => baseline && candidate).length, 2);
  assert.equal(measured.filter(([baseline, candidate]) => !baseline && !candidate).length, 2);
  f.clock = plan.startsAtMs + 100;
  await f.tick();
  assert.equal(f.captured.size, 6);
  assert.deepEqual([...f.captured.values()].map(c => c.occurredAtMs), timestamps);
  const captures = f.count('recordValidationCase');
  f.clock = plan.endsAtMs;
  const completed = await f.tick();
  assert.equal(completed.status, 'AUTO_APPLIED');
  assert.equal(completed.activeVersion.maxAgeMs, 500);
  assert.equal(completed.evaluation.baseline.falseAllows, 2);
  assert.equal(completed.evaluation.candidate.falseAllows, 0);
  assert.equal(f.count('recordValidationCase'), captures);
  assert.equal(f.count('readValidationCases'), 1);
  assert.equal(f.row.revision, 2);
  const repeated = await f.tick();
  assert.equal(repeated.status, 'NO_NEW_AUTHORIZED_CANDIDATE');
  assert.equal(f.row.revision, 2);
});

test('R65 closes an incomplete window as rejected and never backfills missing occurrences', async () => {
  const f = await registered(), plan = f.row.state.pendingEvaluation.plan;
  let reads = 0;
  const captured = await f.tick({ now: () => { f.clock = ++reads <= 4 ? plan.startsAtMs : plan.endsAtMs; return f.clock; } });
  assert.equal(captured.status, 'VALIDATION_CAPTURED');
  assert.equal(captured.recorded, 3);
  assert.equal(f.captured.size, 3);
  const attempts = f.count('recordValidationCase');
  f.clock = plan.endsAtMs + 1;
  const finished = await f.tick();
  assert.equal(finished.status, 'REJECTED');
  assert.equal(finished.evaluation.reason, 'INCOMPLETE_PREREGISTERED_WINDOW');
  assert.equal(finished.activeVersion.maxAgeMs, 750);
  assert.equal(f.count('recordValidationCase'), attempts);
  assert.equal(f.captured.size, 3);
  assert.equal((await f.tick()).status, 'SOURCE_CYCLE_ALREADY_USED');
});

test('R65 missed validation window stays empty even if every definition is available', async () => {
  const f = await registered(); f.clock = f.row.state.pendingEvaluation.plan.endsAtMs + 1;
  const result = await f.tick();
  assert.equal(result.status, 'REJECTED');
  assert.equal(result.evaluation.reason, 'INCOMPLETE_PREREGISTERED_WINDOW');
  assert.equal(f.count('recordValidationCase'), 0);
  assert.equal(f.captured.size, 0);
});

test('R65 resumes a partial capture after a store interruption without changing first occurrence timestamps', async () => {
  const f = await registered(), plan = f.row.state.pendingEvaluation.plan;
  f.clock = plan.startsAtMs;
  const record = f.lifecycleStore.recordValidationCase; let attempts = 0;
  f.lifecycleStore.recordValidationCase = async args => {
    if (++attempts === 3) throw fault('R65_DATABASE_UNAVAILABLE');
    return record(args);
  };
  await rejects(f.tick(), 'R65_DATABASE_UNAVAILABLE');
  assert.equal(f.captured.size, 2);
  const original = [...f.captured.values()].map(c => [c.caseId, c.occurredAtMs]);
  f.clock++;
  f.lifecycleStore.recordValidationCase = record;
  await f.tick();
  assert.equal(f.captured.size, 6);
  original.forEach(([caseId, occurredAtMs]) => assert.equal(f.captured.get(caseId).occurredAtMs, occurredAtMs));
});

test('R65 recovers initialization after an uncertain committed write', async () => {
  const f = harness(), append = f.lifecycleStore.appendEvolution;
  f.lifecycleStore.appendEvolution = async args => { await append(args); throw fault('R65_DATABASE_UNAVAILABLE'); };
  const record = await ensureR65Evolution({ lifecycleStore: f.lifecycleStore, scopeId: SCOPE, env: env(), nowMs: f.clock });
  assert.equal(record.revision, 0);
  assert.deepEqual(record, f.row);
  assert.equal(f.count('appendEvolution'), 1);
});

test('R65 resumes a confirmed registered plan after an uncertain write without registering another plan', async () => {
  const f = harness(), append = f.lifecycleStore.appendEvolution;
  f.lifecycleStore.appendEvolution = async args => {
    const saved = await append(args);
    if (args.state.revision === 1) throw fault('R65_DATABASE_UNAVAILABLE');
    return saved;
  };
  await rejects(f.tick(), 'R65_DATABASE_UNAVAILABLE');
  const planId = f.row.state.pendingEvaluation.plan.planId;
  const next = await f.tick();
  assert.equal(next.status, 'WAITING_VALIDATION_WINDOW');
  assert.equal(next.planId, planId);
  assert.equal(f.count('appendEvolution'), 2);
  assert.equal(f.row.revision, 1);
});

test('R65 never claims registration when append returned but the expected journal is absent on readback', async () => {
  const f = harness(), append = f.lifecycleStore.appendEvolution;
  f.lifecycleStore.appendEvolution = async args => args.state.revision === 1 ?
    { ...clone(f.row), replayed: false } : append(args);
  await rejects(f.tick(), 'R65_DURABLE_STATE_UNCONFIRMED');
  assert.equal(f.row.revision, 0);
  assert.equal(f.row.state.pendingEvaluation, null);
});

test('R65 does not return registration until the store commit and verification complete', async () => {
  const f = harness(), append = f.lifecycleStore.appendEvolution;
  let release, returned = false;
  const gate = new Promise(resolve => { release = resolve; });
  f.lifecycleStore.appendEvolution = async args => {
    if (args.state.revision === 1) await gate;
    return append(args);
  };
  const pending = f.tick().then(value => { returned = true; return value; });
  await turn();
  assert.equal(returned, false);
  assert.equal(f.row.revision, 0);
  release();
  assert.equal((await pending).status, 'EVALUATION_REGISTERED');
  assert.equal(f.row.revision, 1);
});

test('R65 confirms evaluation persistence and can resume after a CAS conflict', async () => {
  const f = await registered(), plan = f.row.state.pendingEvaluation.plan;
  f.clock = plan.startsAtMs; await f.tick(); f.clock = plan.endsAtMs;
  const append = f.lifecycleStore.appendEvolution;
  f.lifecycleStore.appendEvolution = async args => {
    if (args.state.revision === 2) throw fault('R65_EVOLUTION_CONFLICT');
    return append(args);
  };
  await rejects(f.tick(), 'R65_EVOLUTION_CONFLICT');
  assert.equal(f.row.revision, 1);
  assert.equal(f.captured.size, 6);
  f.lifecycleStore.appendEvolution = append;
  assert.equal((await f.tick()).status, 'AUTO_APPLIED');
  assert.equal(f.row.revision, 2);
});

test('R65 rejects a tampered frozen cycle and a replay that no longer matches its immutable study', async () => {
  for (const mode of ['digest', 'missing_receipt', 'rewritten_aggregate']) {
    const f = harness();
    if (mode === 'digest') f.cycle.inputDigest = '0'.repeat(64);
    if (mode === 'missing_receipt') f.receipts.pop();
    if (mode === 'rewritten_aggregate') {
      f.cycle.input.study.metrics.blockedDecisions++;
      f.cycle.inputDigest = hashR64CycleInput(f.cycle.input);
    }
    await rejects(f.tick(), mode === 'digest' ? 'R65_SOURCE_CYCLE_INVALID' : 'R65_FROZEN_OBSERVATION_REPLAY_MISMATCH');
    assert.equal(f.row.revision, 0);
    assert.equal(f.row.state.pendingEvaluation, null);
    assert.equal(f.count('readCycleHypothesis'), 0);
  }
});

test('R65 excludes receipts admitted after the frozen observation snapshot', async () => {
  const f = harness(), late = observations({ count: 8, at: T + 1000 }).receipts.at(-1);
  f.receipts.push(late);
  assert.equal((await f.tick()).status, 'EVALUATION_REGISTERED');
  assert.equal(f.row.state.pendingEvaluation.observation.study.receiptCount, 7);
  assert.equal(f.row.state.journal[0].receipts.some(r => r.eventId === late.eventId), false);
});

test('R65 waits for complete observations and keeps reconciliation or absent support from registering', async () => {
  for (const [status, expected] of [[null, 'WAITING_OBSERVATIONS'], ['CLAIMED', 'WAITING_OBSERVATIONS'],
    ['NEEDS_RECONCILIATION', 'OBSERVATION_RECONCILIATION_REQUIRED']]) {
    const f = harness(); if (status === null) f.cycle = null; else f.cycle.status = status;
    assert.equal((await f.tick()).status, expected);
    assert.equal(f.row.revision, 0);
    assert.equal(f.count('readReceipts'), 0);
  }
  assert.equal((await harness({ count: 4 }).tick()).status, 'NO_ELIGIBLE_OBSERVATION');
});

test('R65 passes only an audited supported hypothesis into registration and still waits for independent cases', async () => {
  const f = harness();
  f.hypothesis = { cycleId: CYCLE, analysisDigest: 'a'.repeat(64), proposals: [{
    kind: 'TIGHTEN_MARKET_FRESHNESS', maxAgeMs: 500,
    evidenceEventIds: f.receipts.slice(4).map(r => r.eventId), assessment: 'HYPOTHESIS_REQUIRES_INDEPENDENT_VALIDATION' }] };
  const result = await f.tick();
  assert.equal(result.hypothesisSource, 'AUDITED_ANALYST_HYPOTHESIS');
  assert.equal(result.activeVersion.maxAgeMs, 750);
  assert.equal(f.captured.size, 0);
});

test('R65 durable rollback is idempotent only for the same operation receipt and actor', async () => {
  const f = await applied(), before = clone(f.row);
  const args = { lifecycleStore: f.lifecycleStore, scopeId: SCOPE, env: env(),
    operationId: r65OperationId(SCOPE, 'OWNER_ROLLBACK'), expectedRevision: before.revision,
    previousDigest: before.stateDigest, reason: 'OWNER_REQUEST', actorId: ACTOR, nowMs: f.clock + 1 };
  const first = await rollbackR65Durable(args);
  assert.equal(first.status, 'ROLLED_BACK');
  assert.equal(first.activeVersion.maxAgeMs, 750);
  assert.equal(first.activeVersion.activationGeneration, 2);
  const repeated = await rollbackR65Durable({ ...args, nowMs: f.clock + 1000 });
  assert.deepEqual(repeated, first);
  assert.equal(f.row.revision, 3);
  await rejects(rollbackR65Durable({ ...args, operationId: r65OperationId(SCOPE, 'OTHER_ROLLBACK') }), 'R65_EVOLUTION_CONFLICT');
  await rejects(rollbackR65Durable({ ...args, actorId: 'system:r65' }), 'R65_ADMIN_ACTOR_REQUIRED');
  await rejects(rollbackR65Durable({ ...args, actorId: 'user:22222222-2222-4222-8222-222222222265' }), 'R65_OPERATION_CONFLICT');
});

test('R65 benchmark identities are deterministic and the source never chooses arbitrary cases or financial settings', () => {
  const one = createR65RegisteredBenchmark({ scopeId: SCOPE, sourceCycleId: CYCLE, nowMs: T });
  const next = createR65RegisteredBenchmark({ scopeId: SCOPE, sourceCycleId: CYCLE, nowMs: T + 100 });
  assert.equal(one.planId, next.planId);
  assert.deepEqual(one.caseDefinitions, next.caseDefinitions);
  assert.equal(next.startsAtMs - one.startsAtMs, 100);
  assert.equal(one.evidenceKind, 'SYNTHETIC_FIXTURE');
  assert.equal(Object.hasOwn(one, 'capital'), false);
  assert.equal(Object.hasOwn(one, 'risk'), false);
});
