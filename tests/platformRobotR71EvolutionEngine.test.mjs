import test from 'node:test';
import assert from 'node:assert/strict';
import { makeR71RegisteredFixture, r71FixtureRow } from './fixtures/r71-study-fixture.mjs';
import { copyR71, createR71Plan } from '../lib/platform/research/robot-r71-policy.mjs';
import { evaluateR71Evolution, inspectR71EvolutionState, projectR71RuntimeView, registerR71Evaluation,
  rollbackR71Evolution, recordR71Study } from '../lib/platform/research/robot-r71-evolution-engine.mjs';

test('R71 applies only after the complete registered comparison and rolls back with generation history', async () => {
  const f = await makeR71RegisteredFixture();
  const { state, evaluation } = evaluateR71Evolution({ state: f.state, cases: f.cases, nowMs: f.plan.endsAtMs });
  assert.equal(evaluation.status, 'APPLIED'); assert.equal(evaluation.summary.observedCases, 8);
  assert.equal(evaluation.summary.baselineMissedExistingPositionRouting, 3);
  assert.equal(evaluation.summary.candidateMissedExistingPositionRouting, 0); assert.equal(evaluation.summary.protectedCaseChanges, 0);
  assert.equal(state.activeVersion.activationGeneration, 1); assert.equal(state.activeVersion.forwardPositionOpen, true);
  const rolled = rollbackR71Evolution({ state, reason: 'OWNER_REQUEST', nowMs: f.plan.endsAtMs + 1 });
  assert.equal(rolled.activeVersion.activationGeneration, 2); assert.equal(rolled.activeVersion.forwardPositionOpen, false);
  assert.equal(rolled.candidateRetired, true); assert.equal(rolled.promotions, 1);
  assert.deepEqual(rolled.history.map(h => h.action), ['REGISTERED', 'APPLIED', 'ROLLED_BACK']);
  assert.deepEqual(inspectR71EvolutionState(rolled), rolled);
  assert.equal(projectR71RuntimeView(r71FixtureRow(rolled)).activeVersion.activationGeneration, 2);
  assert.throws(() => recordR71Study({ state: rolled, study: f.study, nowMs: f.plan.endsAtMs + 2 }), /R71_STUDY_NOT_OPEN/);
});
test('R71 missing cases are rejected after the window and never manufactured or replayed as a second proposal', async () => {
  const f = await makeR71RegisteredFixture();
  const { state, evaluation } = evaluateR71Evolution({ state: f.state, cases: f.cases.slice(0, 7), nowMs: f.plan.endsAtMs });
  assert.equal(evaluation.status, 'REJECTED_INCOMPLETE'); assert.equal(evaluation.missingCaseIds.length, 1);
  assert.equal(state.activeVersion.forwardPositionOpen, false); assert.equal(state.candidateRetired, true);
  assert.throws(() => registerR71Evaluation({ state, plan: f.plan, nowMs: f.plan.endsAtMs }), /R71_NO_AUTHORIZED_HYPOTHESIS/);
});
test('R71 refuses evaluation before window closure and out-of-window captured or admitted cases', async () => {
  const f = await makeR71RegisteredFixture();
  assert.throws(() => evaluateR71Evolution({ state: f.state, cases: f.cases, nowMs: f.plan.endsAtMs - 1 }), /R71_EVALUATION_WINDOW_NOT_CLOSED/);
  for (const field of ['capturedAtMs', 'admittedAtMs']) {
    const cases = copyR71(f.cases); cases[0][field] = f.plan.endsAtMs;
    assert.throws(() => evaluateR71Evolution({ state: f.state, cases, nowMs: f.plan.endsAtMs }), /R71_VALIDATION_CASE_WINDOW/);
  }
});
test('R71 fixed plan refuses caller-supplied expected labels, time windows or financial parameters', async () => {
  const f = await makeR71RegisteredFixture();
  for (const change of [p => p.caseDefinitions[0].positionOpen = false, p => p.endsAtMs++,
    p => p.candidateVersion.leverage = 10, p => p.studyDigest = '0'.repeat(64)]) {
    const plan = copyR71(f.plan); change(plan);
    assert.throws(() => registerR71Evaluation({ state: f.studied, plan, nowMs: plan.registeredAtMs }), /R71_/);
  }
  const empty = copyR71(f.studied); empty.latestStudy = null;
  assert.throws(() => registerR71Evaluation({ state: empty, plan: f.plan, nowMs: f.plan.registeredAtMs }), /R71_STATE_RECONSTRUCTION/);
});
test('R71 candidate cannot change Manual, closed or paused decisions even if other cases improve', async () => {
  const f = await makeR71RegisteredFixture();
  for (const index of [0, 1, 3, 5, 6]) {
    const cases = copyR71(f.cases); cases[index].effectiveDecision = { action: 'manage_existing_position', side: null, mayClose: true };
    const evaluated = evaluateR71Evolution({ state: f.state, cases, nowMs: f.plan.endsAtMs });
    assert.equal(evaluated.evaluation.status, 'REJECTED_POLICY');
    assert.equal(evaluated.evaluation.summary.protectedCaseChanges, 1); assert.equal(evaluated.state.promotions, 0);
  }
});
test('R71 requires measured strict improvement and zero missed candidate routing', async () => {
  const f = await makeR71RegisteredFixture(), alreadyCorrect = copyR71(f.cases);
  for (const index of [2, 4, 7]) alreadyCorrect[index].nativeDecision = alreadyCorrect[index].effectiveDecision;
  assert.equal(evaluateR71Evolution({ state: f.state, cases: alreadyCorrect, nowMs: f.plan.endsAtMs }).evaluation.status, 'REJECTED_NO_IMPROVEMENT');
  const wrong = copyR71(f.cases); wrong[2].effectiveDecision = wrong[2].nativeDecision;
  assert.equal(evaluateR71Evolution({ state: f.state, cases: wrong, nowMs: f.plan.endsAtMs }).evaluation.status, 'REJECTED_POLICY');
});
test('R71 duplicate, foreign-plan or conflicting-event cases cannot supply missing coverage', async () => {
  const f = await makeR71RegisteredFixture();
  for (const change of [c => c[7] = c[6], c => c[0].planId = 'plan:' + '0'.repeat(16), c => c[0].recordDigest = '0'.repeat(64)]) {
    const cases = copyR71(f.cases); change(cases);
    assert.throws(() => evaluateR71Evolution({ state: f.state, cases, nowMs: f.plan.endsAtMs }), /R71_VALIDATION/);
  }
});
test('R71 replay detects tampered scores, history, active policy and appended arbitrary commands', async () => {
  const f = await makeR71RegisteredFixture(), { state } = evaluateR71Evolution({ state: f.state, cases: f.cases, nowMs: f.plan.endsAtMs });
  for (const change of [s => s.evaluations[0].summary.baselineMissedExistingPositionRouting++,
    s => s.history[1].toVersionId = 'private:r71-reference-v1', s => s.activeVersion.activationGeneration++,
    s => s.journal[2].plan.caseDefinitions[0].expectedRouting = 'MANAGE_EXISTING_POSITION',
    s => s.journal.push({ action: 'EXECUTE_CODE', atMs: f.plan.endsAtMs + 1, code: 'bad()' })]) {
    const bad = copyR71(state); change(bad); assert.throws(() => inspectR71EvolutionState(bad), /R71_/);
  }
});
test('R71 projection binds scope source revision and digest, and carries no raw study or credentials', async () => {
  const f = await makeR71RegisteredFixture(), row = r71FixtureRow(f.state), view = projectR71RuntimeView(row);
  assert.equal(Object.hasOwn(view, 'latestStudy'), false); assert.equal(Object.hasOwn(view, 'journal'), false);
  for (const bad of [{ ...row, revision: row.revision + 1 }, { ...row, sourceId: 'source:' + 'a'.repeat(16) },
    { ...row, stateDigest: '' }, { ...row, privateKey: 'injected' }]) assert.throws(() => projectR71RuntimeView(bad), /R71_STATE_ROW/);
  const different = createR71Plan({ snapshotId: f.plan.snapshotId, studyDigest: f.plan.studyDigest,
    activeVersion: f.studied.activeVersion, nowMs: f.plan.registeredAtMs + 1 });
  assert.notEqual(different.planId, f.plan.planId);
});
