import test from 'node:test';
import assert from 'node:assert/strict';
import { makeR71StudyFixture, makeR71RegisteredFixture, r71FixtureRow, r71QaEnvironment } from './fixtures/r71-study-fixture.mjs';
import { copyR71, sameR71, r71OperationId } from '../lib/platform/research/robot-r71-policy.mjs';
import { ensureR71Evolution, runR71EvolutionTick, rollbackR71Durable } from '../lib/platform/research/robot-r71-cycle-worker.mjs';
import { evaluateR71Evolution, inspectR71EvolutionState } from '../lib/platform/research/robot-r71-evolution-engine.mjs';

function storeFixture(f, initial = f.initialState) {
  let row = initial ? r71FixtureRow(initial) : null, nowMs = f.snapshot.frozenAtMs + 10, cases = [], reads = 0;
  const operations = new Map(), calls = [];
  const store = { ...f.store,
    async now() { return { nowMs }; }, async readState() { reads++; return row; },
    async freezeStudy(args) { calls.push({ action: 'FREEZE', ...args }); return f.snapshot; },
    async readValidationCases(args) { calls.push({ action: 'READ_CASES', ...args }); return cases; },
    async appendState(args) {
      calls.push({ action: 'APPEND', ...args });
      if (operations.has(args.operationId)) {
        const old = operations.get(args.operationId);
        if (!sameR71(old.args, args)) throw Object.assign(Error('R71_OPERATION_CONFLICT'), { code: 'R71_OPERATION_CONFLICT' });
        return { ...old.row, replayed: true };
      }
      if ((row?.revision ?? -1) !== args.expectedRevision || (row?.stateDigest ?? null) !== args.previousDigest)
        throw Object.assign(Error('R71_EVOLUTION_CONFLICT'), { code: 'R71_EVOLUTION_CONFLICT' });
      row = r71FixtureRow(inspectR71EvolutionState(args.state)); operations.set(args.operationId, { args: copyR71(args), row });
      return { ...row, replayed: false };
    },
  };
  return { store, calls, setClock: v => nowMs = v, setCases: v => cases = v,
    read: () => row, get reads() { return reads; } };
}
test('R71 worker uses database time and registers a complete frozen private study', async () => {
  const f = await makeR71StudyFixture(), s = storeFixture(f), env = r71QaEnvironment();
  const result = await runR71EvolutionTick({ store: s.store, trustedSource: f.trustedSource, env, now: () => 0 });
  assert.equal(result.status, 'EVALUATION_REGISTERED'); assert.equal(result.hypothesisSource, 'BOUNDED_DETERMINISTIC_POLICY');
  assert.equal(s.read().state.pendingEvaluation.registeredAtMs, f.snapshot.frozenAtMs + 10);
  assert.equal(s.read().state.pendingEvaluation.caseDefinitions.length, 8);
  assert.equal(result.customerMonitoringActive, false); assert.equal(result.paidProviderCalls, 0);
  assert.equal(result.actualBrokerPnl, null); assert.equal(result.internalCoreRetuning, false);
  assert.deepEqual(s.calls.filter(c => c.action === 'APPEND').map(c => c.state.journal.at(-1).action), ['STUDY', 'REGISTER']);
});
test('R71 empty study waits for contextual observations without consuming a study revision', async () => {
  const f = await makeR71StudyFixture({ count: 0 }), s = storeFixture(f, null), env = r71QaEnvironment();
  const result = await runR71EvolutionTick({ store: s.store, trustedSource: f.trustedSource, env });
  assert.equal(result.status, 'WAITING_CONTEXTUAL_OBSERVATIONS'); assert.equal(result.revision, 0);
  assert.equal(s.read().state.createdAtMs, f.snapshot.frozenAtMs + 10); assert.equal(s.read().state.latestStudy, null);
});
test('R71 worker waits for source-signed cases inside the window and evaluates existing cases only afterwards', async () => {
  const f = await makeR71RegisteredFixture(), s = storeFixture(f, f.state), env = r71QaEnvironment();
  s.setCases(f.cases); s.setClock(f.plan.startsAtMs - 1);
  assert.equal((await runR71EvolutionTick({ store: s.store, trustedSource: f.trustedSource, env })).status, 'WAITING_VALIDATION_WINDOW');
  s.setClock(f.plan.startsAtMs);
  assert.equal((await runR71EvolutionTick({ store: s.store, trustedSource: f.trustedSource, env })).status, 'WAITING_SOURCE_VALIDATION');
  assert.equal(s.calls.length, 0);
  s.setClock(f.plan.endsAtMs);
  const applied = await runR71EvolutionTick({ store: s.store, trustedSource: f.trustedSource, env });
  assert.equal(applied.status, 'APPLIED'); assert.equal(applied.activeVersion.activationGeneration, 1);
  assert.equal(s.calls.filter(c => c.action === 'READ_CASES').length, 1);
  assert.equal((await runR71EvolutionTick({ store: s.store, trustedSource: f.trustedSource, env })).status, 'NO_NEW_AUTHORIZED_CANDIDATE');
});
test('R71 worker rejects an expired empty window without inventing validation cases', async () => {
  const f = await makeR71RegisteredFixture(), s = storeFixture(f, f.state), env = r71QaEnvironment();
  s.setClock(f.plan.endsAtMs + 5000);
  const result = await runR71EvolutionTick({ store: s.store, trustedSource: f.trustedSource, env });
  assert.equal(result.status, 'REJECTED_INCOMPLETE'); assert.equal(result.evaluation.summary.observedCases, 0);
  assert.equal(result.evaluation.missingCaseIds.length, 8); assert.equal(s.read().state.candidateRetired, true);
});
test('R71 durable rollback requires admin actor and exact operation/CAS replay', async () => {
  const f = await makeR71RegisteredFixture(), applied = evaluateR71Evolution({ state: f.state, cases: f.cases, nowMs: f.plan.endsAtMs }).state;
  const s = storeFixture(f, applied), env = r71QaEnvironment(); s.setClock(f.plan.endsAtMs + 1);
  const row = s.read(), args = { store: s.store, env, operationId: r71OperationId('ROOT_TEST_ROLLBACK'),
    expectedRevision: row.revision, previousDigest: row.stateDigest, reason: 'OWNER_REQUEST',
    actorId: 'user:71717171-7171-4171-8171-717171717171' };
  await assert.rejects(rollbackR71Durable({ ...args, actorId: 'system:r71' }), /R71_ADMIN_ACTOR_REQUIRED/);
  const rolled = await rollbackR71Durable(args); assert.equal(rolled.activeVersion.activationGeneration, 2);
  assert.deepEqual(await rollbackR71Durable(args), rolled);
  await assert.rejects(rollbackR71Durable({ ...args, operationId: r71OperationId('DIFFERENT_ROLLBACK') }), /R71_EVOLUTION_CONFLICT/);
  await assert.rejects(rollbackR71Durable({ ...args, previousDigest: '0'.repeat(64) }), /R71_OPERATION_CONFLICT/);
});
test('R71 gates rechecked after awaited state reads prevent mutation after disabling QA', async () => {
  const f = await makeR71StudyFixture(), env = r71QaEnvironment(); let writes = 0;
  const store = { async readState() { env.JENIOS_ROBOT_R71_ENABLED = 'false'; return null; },
    async now() { return { nowMs: f.snapshot.frozenAtMs }; }, async appendState() { writes++; } };
  await assert.rejects(ensureR71Evolution({ store, trustedSource: f.trustedSource, env }), /R71_DISABLED/);
  assert.equal(writes, 0);
});
test('R71 worker refuses a foreign identity even if an existing state is structurally valid', async () => {
  const f = await makeR71StudyFixture(), another = await makeR71StudyFixture(), s = storeFixture(f);
  await assert.rejects(runR71EvolutionTick({ store: s.store, trustedSource: another.trustedSource,
    env: r71QaEnvironment() }), /R71_WORKER_SOURCE/);
  assert.equal(s.calls.length, 0);
});
