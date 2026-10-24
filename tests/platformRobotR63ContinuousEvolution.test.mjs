import test from 'node:test';
import assert from 'node:assert/strict';
import { studyR63Observations } from '../lib/platform/research/robot-r63-observation-study.mjs';
import {
  R63_EVOLUTION_POLICY, createR63EvolutionState, inspectR63EvolutionState,
  registerR63Evaluation, runR63EvolutionCycle, rollbackR63Evolution,
  evaluateR63ActiveFreshness,
} from '../lib/platform/research/robot-r63-continuous-evolution.mjs';

const T = Date.UTC(2026, 9, 24, 12);
const scopeId = 'fixture:00000001';
const copy = value => JSON.parse(JSON.stringify(value));
const rejects = (callback, code) => assert.throws(callback, error => error?.code === code);
function fixture({ definitions, atMs = T, firstEvent = 1, planNumber = 1, state } = {}) {
  const events = [0, 1, 2].map(index => ({
    evidenceKind: 'SYNTHETIC_FIXTURE', scopeId,
    eventId: `evt:${(firstEvent + index).toString(16).padStart(8, '0')}`,
    policyVersion: 'research:r63-v1', robot: 'ultrafast', kind: 'decision',
    decision: 'ALLOW', issue: 'STALE_CONTEXT', marketAgeMs: [610, 650, 700][index],
    occurredAtMs: atMs - 10000 + index, observedAtMs: atMs - 9000 + index,
  }));
  const study = studyR63Observations(events, { scopeId, nowMs: atMs - 1000 });
  const caseDefinitions = definitions ?? [
    [100, true], [200, true], [600, false], [700, false], [900, false], [1000, false],
  ].map(([age, expectedAllow], index) => ({
    caseId: `case:${(index + 1).toString(16).padStart(8, '0')}`,
    snapshotAgesMs: [age, age], expectedAllow,
  }));
  const plan = { planId: `plan:${planNumber.toString(16).padStart(8, '0')}`, scopeId,
    evidenceKind: 'SYNTHETIC_FIXTURE', startsAtMs: atMs + 1000, endsAtMs: atMs + 7000, caseDefinitions };
  const validationCases = caseDefinitions.map((definition, index) => ({
    ...copy(definition), scopeId, evidenceKind: 'SYNTHETIC_FIXTURE', occurredAtMs: atMs + 1000 + index * 100,
  }));
  return { state: state ?? createR63EvolutionState({ scopeId, nowMs: atMs - 20000 }), study,
    plan, validationCases, nowMs: atMs };
}
function registered(f = fixture()) {
  return { ...f, state: registerR63Evaluation({ state: f.state, study: f.study, plan: f.plan, nowMs: f.nowMs }) };
}
function run(f = registered()) {
  return runR63EvolutionCycle({ state: f.state, validationCases: f.validationCases, nowMs: f.plan.endsAtMs });
}

test('R63 automatically applies a measured independent fixture improvement and changes the actual R47 result', () => {
  const f = fixture();
  const before = evaluateR63ActiveFreshness({ state: f.state, snapshotAgesMs: [600, 600] });
  assert.equal(before.allow, true);
  const result = run(registered(f));
  assert.equal(result.evaluation.status, 'AUTO_APPLIED');
  assert.equal(result.evaluation.baseline.falseAllows, 2);
  assert.equal(result.evaluation.candidate.falseAllows, 0);
  assert.equal(result.evaluation.candidate.falseBlocks, 0);
  assert.equal(result.state.activeVersion.versionId, 'research:r63-v2');
  assert.equal(result.state.activeVersion.maxAgeMs, 500);
  const after = evaluateR63ActiveFreshness({ state: result.state, snapshotAgesMs: [600, 600] });
  assert.equal(after.allow, false);
  assert.equal(after.orderAuthorized, false);
  assert.equal(evaluateR63ActiveFreshness({ state: result.state, snapshotAgesMs: [100, 100] }).allow, true);
  assert.equal(f.state.activeVersion.maxAgeMs, 750);
});

test('R63 needs two fresh R47 confirmations and never grants execution authority', () => {
  const state = fixture().state;
  for (const pair of [[900, 100], [100, 900], [900, 900]])
    assert.equal(evaluateR63ActiveFreshness({ state, snapshotAgesMs: pair }).allow, false);
  const result = evaluateR63ActiveFreshness({ state, snapshotAgesMs: [750, 750] });
  assert.equal(result.allow, true);
  assert.equal(result.decisionScope, 'R47_FRESHNESS_SYNTHETIC_ONLY');
  assert.equal(result.actualBrokerPnl, null);
  assert.equal(result.actualLossesAvoided, null);
  assert.equal(result.realTradeAccuracy, null);
  assert.equal(result.realOrdersSent, 0);
  assert.equal(result.externalPaperOrdersSent, 0);
});

test('R63 refuses a lower cutoff that blocks additional valid cases', () => {
  const f = fixture();
  const definitions = copy(f.plan.caseDefinitions);
  definitions[2].expectedAllow = true;
  const result = run(registered(fixture({ definitions })));
  assert.equal(result.evaluation.status, 'REJECTED');
  assert.equal(result.evaluation.reason, 'CANDIDATE_FALSE_BLOCK_REGRESSION');
  assert.equal(result.state.activeVersion.versionId, 'research:r63-v1');
  assert.equal(result.state.pendingEvaluation, null);
});

test('R63 keeps the baseline when the candidate still falsely allows a negative case', () => {
  const definitions = copy(fixture().plan.caseDefinitions);
  definitions[2].snapshotAgesMs = [400, 400];
  const result = run(registered(fixture({ definitions })));
  assert.equal(result.evaluation.status, 'REJECTED');
  assert.equal(result.evaluation.reason, 'CANDIDATE_FALSE_ALLOWS_REMAIN');
});

test('R63 records no measurable improvement rather than claiming progress or perfection', () => {
  const definitions = copy(fixture().plan.caseDefinitions);
  definitions[2].snapshotAgesMs = [850, 850];
  definitions[3].snapshotAgesMs = [950, 950];
  const result = run(registered(fixture({ definitions })));
  assert.equal(result.evaluation.status, 'REJECTED');
  assert.equal(result.evaluation.reason, 'NO_MEASURABLE_IMPROVEMENT');
  assert.equal(result.state.versions.length, 1);
  assert.equal(Object.hasOwn(result.state, 'improvementPercentage'), false);
});

test('R63 rejects a partial window after its end without cherry-picking the supplied cases', () => {
  const f = registered();
  const result = runR63EvolutionCycle({ state: f.state, validationCases: f.validationCases.slice(0, 5), nowMs: f.plan.endsAtMs });
  assert.equal(result.evaluation.status, 'REJECTED');
  assert.equal(result.evaluation.reason, 'INCOMPLETE_PREREGISTERED_WINDOW');
  assert.equal(result.evaluation.baseline, null);
  assert.equal(result.state.activeVersion.maxAgeMs, 750);
});

test('R63 refuses evaluating before the registered window closes', () => {
  const f = registered();
  rejects(() => runR63EvolutionCycle({ state: f.state, validationCases: f.validationCases, nowMs: f.plan.endsAtMs - 1 }),
    'R63_EVALUATION_WINDOW_NOT_CLOSED');
});

test('R63 freezes labels, case identities and data before observing candidate outcomes', () => {
  const f = registered();
  for (const change of [
    item => { item.expectedAllow = !item.expectedAllow; },
    item => { item.snapshotAgesMs = [0, 0]; },
  ]) {
    const cases = copy(f.validationCases); change(cases[2]);
    rejects(() => runR63EvolutionCycle({ state: f.state, validationCases: cases, nowMs: f.plan.endsAtMs }),
      'R63_PREREGISTERED_CASE_CHANGED');
  }
  const cases = copy(f.validationCases); cases[0].caseId = 'case:00009999';
  rejects(() => runR63EvolutionCycle({ state: f.state, validationCases: cases, nowMs: f.plan.endsAtMs }),
    'R63_INVALID_OR_REUSED_CASE_ID');
});

test('R63 refuses duplicate validation cases rather than counting the same evidence repeatedly', () => {
  const f = registered();
  rejects(() => runR63EvolutionCycle({ state: f.state, validationCases: [...f.validationCases, f.validationCases[0]], nowMs: f.plan.endsAtMs }),
    'R63_INVALID_OR_REUSED_CASE_ID');
});

test('R63 enforces independent temporal windows and a preregistration strictly after study events', () => {
  const f = fixture();
  for (const startsAtMs of [f.nowMs, f.nowMs - 1000])
    rejects(() => registerR63Evaluation({ state: f.state, study: f.study, plan: { ...f.plan, startsAtMs }, nowMs: f.nowMs }),
      'R63_PLAN_SCOPE_OR_TIME_MISMATCH');
  const events = copy(f.study.events); events[0].observedAtMs = f.nowMs;
  const study = studyR63Observations(events, { scopeId, nowMs: f.nowMs });
  rejects(() => registerR63Evaluation({ state: f.state, study, plan: f.plan, nowMs: f.nowMs }),
    'R63_STUDY_MUST_PRECEDE_REGISTRATION');
  const registeredFixture = registered(f);
  const cases = copy(f.validationCases); cases[0].occurredAtMs = f.nowMs - 1;
  rejects(() => runR63EvolutionCycle({ state: registeredFixture.state, validationCases: cases, nowMs: f.plan.endsAtMs }),
    'R63_VALIDATION_TIME_MISMATCH');
});

test('R63 rejects cross-scope studies, plans and cases and operational provenance', () => {
  const f = fixture();
  for (const patch of [{ scopeId: 'fixture:00000002' }, { evidenceKind: 'VERIFIED_OPERATIONAL_EVENT' }]) {
    rejects(() => registerR63Evaluation({ state: f.state, study: { ...f.study, ...patch }, plan: f.plan, nowMs: f.nowMs }),
      'R63_STUDY_SCOPE_OR_TIME_MISMATCH');
    rejects(() => registerR63Evaluation({ state: f.state, study: f.study, plan: { ...f.plan, ...patch }, nowMs: f.nowMs }),
      'R63_PLAN_SCOPE_OR_TIME_MISMATCH');
    const r = registered(f), cases = copy(f.validationCases); Object.assign(cases[0], patch);
    rejects(() => runR63EvolutionCycle({ state: r.state, validationCases: cases, nowMs: f.plan.endsAtMs }),
      'R63_VALIDATION_SCOPE_MISMATCH');
  }
});

test('R63 recomputes study facts and proposals rather than accepting fabricated approval or metrics', () => {
  const f = fixture();
  for (const change of [
    study => { study.metrics.eventCount = 100000; },
    study => { study.proposals[0].maxAgeMs = 250; },
    study => { study.pass = true; },
  ]) {
    const study = copy(f.study); change(study);
    rejects(() => registerR63Evaluation({ state: f.state, study, plan: f.plan, nowMs: f.nowMs }), 'R63_STUDY_REPLAY_MISMATCH');
  }
  const r = registered(f);
  rejects(() => runR63EvolutionCycle({ state: r.state, validationCases: r.validationCases, nowMs: r.plan.endsAtMs, pass: true }),
    'R63_INVALID_EVOLUTION_CYCLE');
});

test('R63 requires a real study hypothesis and preserves control-violation suppression', () => {
  const f = fixture();
  const events = copy(f.study.events); events[0].issue = 'CONTROL_VIOLATION';
  const study = studyR63Observations(events, { scopeId, nowMs: f.study.asOfMs });
  rejects(() => registerR63Evaluation({ state: f.state, study, plan: f.plan, nowMs: f.nowMs }), 'R63_NO_ELIGIBLE_STUDY_PROPOSAL');
});

test('R63 binds study evidence to the currently active policy version', () => {
  const f = fixture();
  const events = f.study.events.map(event => ({ ...event, policyVersion: 'research:r62-v1' }));
  const study = studyR63Observations(events, { scopeId, nowMs: f.study.asOfMs });
  rejects(() => registerR63Evaluation({ state: f.state, study, plan: f.plan, nowMs: f.nowMs }), 'R63_STUDY_POLICY_VERSION_MISMATCH');
});

test('R63 requires adequate positive and negative preregistered coverage', () => {
  const f = fixture();
  rejects(() => registerR63Evaluation({ state: f.state, study: f.study,
    plan: { ...f.plan, caseDefinitions: f.plan.caseDefinitions.slice(0, 5) }, nowMs: f.nowMs }), 'R63_INSUFFICIENT_PREREGISTERED_CASES');
  const definitions = f.plan.caseDefinitions.map(item => ({ ...item, expectedAllow: false }));
  rejects(() => registerR63Evaluation({ state: f.state, study: f.study,
    plan: { ...f.plan, caseDefinitions: definitions }, nowMs: f.nowMs }), 'R63_PREREGISTERED_CLASSES_REQUIRED');
});

test('R63 treats repeated pending registration and completed processing as idempotent', () => {
  const f = registered();
  assert.deepEqual(registerR63Evaluation({ state: f.state, study: f.study, plan: f.plan, nowMs: f.nowMs }), f.state);
  const result = run(f);
  const again = runR63EvolutionCycle({ state: result.state, validationCases: f.validationCases, nowMs: f.plan.endsAtMs });
  assert.equal(again.evaluation.status, 'NO_CHANGE');
  assert.deepEqual(again.state, result.state);
  assert.equal(again.state.history.filter(event => event.action === 'AUTO_APPLIED').length, 1);
});

test('R63 validates the entire persisted state by deterministic replay', () => {
  const result = run();
  assert.deepEqual(inspectR63EvolutionState(copy(result.state)), result.state);
  for (const alter of [
    state => { state.activeVersion.maxAgeMs = 10000; },
    state => { state.policy.alignmentGuardThreshold = 0.50; },
    state => { state.policy.allowedEnvironment = 'production'; },
    state => { state.evaluations[0].candidate.falseAllows = -1; },
    state => { state.history = []; },
    state => { state.revision += 1; },
    state => { state.realOrdersSent = 1; },
  ]) {
    const state = copy(result.state); alter(state);
    rejects(() => inspectR63EvolutionState(state), 'R63_EVOLUTION_REPLAY_MISMATCH');
  }
});

test('R63 does not execute accessor payloads in a supplied state or command', () => {
  let calls = 0;
  const state = copy(fixture().state);
  Object.defineProperty(state, 'activeVersion', { enumerable: true, get() { calls++; return {}; } });
  rejects(() => inspectR63EvolutionState(state), 'R63_EVOLUTION_NON_JSON_VALUE');
  const input = { state: fixture().state, snapshotAgesMs: [100, 100] };
  Object.defineProperty(input, 'snapshotAgesMs', { enumerable: true, get() { calls++; return [100, 100]; } });
  rejects(() => evaluateR63ActiveFreshness(input), 'R63_INVALID_ACTIVE_EVALUATION');
  assert.equal(calls, 0);
});

test('R63 rollback restores future freshness decisions with a monotonic activation generation', () => {
  const { state } = run();
  const rolledBack = rollbackR63Evolution({ state, reason: 'REGRESSION_DETECTED', nowMs: T + 8000 });
  assert.equal(rolledBack.activeVersion.versionId, 'research:r63-v1');
  assert.equal(rolledBack.activeVersion.activationGeneration, 2);
  assert.equal(rolledBack.revision, 3);
  assert.equal(evaluateR63ActiveFreshness({ state: rolledBack, snapshotAgesMs: [600, 600] }).allow, true);
  assert.equal(rolledBack.history.at(-1).action, 'ROLLED_BACK');
  assert.deepEqual(inspectR63EvolutionState(copy(rolledBack)), rolledBack);
  assert.deepEqual(rolledBack.retiredCandidateMaxAgeMs, [500]);
});

test('R63 never silently retunes further or reapplies the rejected version after rollback', () => {
  const { state } = run();
  const f = fixture({ state, atMs: T + 7200000, firstEvent: 100, planNumber: 2 });
  rejects(() => registerR63Evaluation({ state, study: f.study, plan: f.plan, nowMs: f.nowMs }), 'R63_NO_FURTHER_AUTOMATIC_CHANGE');
  const rolledBack = rollbackR63Evolution({ state, reason: 'TECHNICAL_FAILURE', nowMs: T + 8000 });
  const next = fixture({ state: rolledBack, atMs: T + 7200000, firstEvent: 100, planNumber: 2 });
  rejects(() => registerR63Evaluation({ state: rolledBack, study: next.study, plan: next.plan, nowMs: next.nowMs }),
    'R63_NO_FURTHER_AUTOMATIC_CHANGE');
});

test('R63 limits rapid repeated research cycles and rejects recycled study evidence', () => {
  const f = registered();
  const { state } = runR63EvolutionCycle({ state: f.state, validationCases: [], nowMs: f.plan.endsAtMs });
  const rapid = fixture({ state, atMs: T + 20000, firstEvent: 100, planNumber: 2 });
  rejects(() => registerR63Evaluation({ state, study: rapid.study, plan: rapid.plan, nowMs: rapid.nowMs }), 'R63_EVOLUTION_COOLDOWN');
  const recycled = fixture({ state, atMs: T + 7200000, firstEvent: 1, planNumber: 2 });
  rejects(() => registerR63Evaluation({ state, study: recycled.study, plan: recycled.plan, nowMs: recycled.nowMs }),
    'R63_STUDY_EVIDENCE_ALREADY_USED');
});

test('R63 rejects time regression and arbitrary rollback instructions', () => {
  const { state } = run();
  rejects(() => rollbackR63Evolution({ state, reason: 'OWNER_REQUEST', nowMs: T }), 'R63_EVOLUTION_CLOCK_REGRESSION');
  rejects(() => rollbackR63Evolution({ state, reason: 'deploy() and disable stops', nowMs: T + 8000 }), 'R63_INVALID_ROLLBACK_REASON');
});

test('R63 policy records owner preapproval while preserving explicit operational and privacy boundaries', () => {
  const state = createR63EvolutionState({ scopeId, nowMs: T });
  assert.equal(state.policy.autoApprovalGranted, true);
  assert.equal(state.policy.alignmentGuardThreshold, 0.65);
  assert.equal(state.policy.privacyDisclosureRequiredForOperationalData, true);
  assert.equal(state.policy.operationalDataAccepted, false);
  assert.equal(state.policy.automaticDeploymentAllowed, false);
  assert.equal(state.policy.arbitraryCodeAllowed, false);
  assert.equal(Object.isFrozen(R63_EVOLUTION_POLICY), true);
  assert.equal(Object.isFrozen(state.activeVersion), true);
});

test('R63 rejects malformed pairs, free-text additions and injected production targets', () => {
  const state = fixture().state;
  for (const pair of [[100], [100, 100, 100], [-1, 100], ['100', 100], [Infinity, 100], [60001, 100]])
    rejects(() => evaluateR63ActiveFreshness({ state, snapshotAgesMs: pair }),
      pair.includes(Infinity) ? 'R63_EVOLUTION_NON_JSON_VALUE' : 'R63_INVALID_FRESHNESS_PAIR');
  rejects(() => createR63EvolutionState({ scopeId, nowMs: T, environment: 'production' }), 'R63_INVALID_EVOLUTION_CONTEXT');
  rejects(() => evaluateR63ActiveFreshness({ state, snapshotAgesMs: [100, 100], secret: 'not-recorded' }), 'R63_INVALID_ACTIVE_EVALUATION');
});
