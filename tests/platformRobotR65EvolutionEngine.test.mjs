import test from 'node:test';
import assert from 'node:assert/strict';
import {
  R65_EVOLUTION_POLICY, createR65EvolutionState, inspectR65EvolutionState,
  registerR65Evaluation, runR65EvolutionCycle, rollbackR65Evolution, executeR65ValidationCase,
} from '../lib/platform/research/robot-r65-evolution-engine.mjs';
import { verifyR64TelemetryEnvelope } from '../lib/platform/research/robot-r64-telemetry.mjs';
import { createR64TelemetryFixture, signR64QaPayload } from '../scripts/platform/research/r64-telemetry-fixtures.mjs';

const T = Date.UTC(2026, 9, 24, 12);
const SCOPE = 'scope:0000000000000001';
const clone = value => JSON.parse(JSON.stringify(value));
const denies = (fn, code) => assert.throws(fn, error => error?.code && (!code || error.code === code));
const id = (prefix, number) => prefix + ':' + number.toString(16).padStart(16, '0');

function fixture({ at = T, count = 7, firstEvent = 1, number = 1, caseOffset = 0,
  definitions, state, mutatePayload } = {}) {
  const source = createR64TelemetryFixture({ generatedAtMs: at, count });
  const envelopes = source.envelopes.map((raw, index) => {
    const payload = clone(raw.payload);
    payload.event.policyVersion = 'research:r65-v1';
    payload.eventId = id('evt', firstEvent + index);
    mutatePayload?.(payload, index);
    return signR64QaPayload(payload, source.privateKey);
  });
  const receipts = envelopes.map(envelope => verifyR64TelemetryEnvelope(envelope,
    { trustedSource: source.trustedSource, nowMs: at }));
  const caseDefinitions = (definitions ?? [[100, true], [200, true], [600, false],
    [700, false], [900, false], [1000, false]])
    .map(([age, expectedAllow], i) => ({ caseId: id('case', caseOffset + i + 1),
      snapshotAgesMs: [age, age], expectedAllow }));
  const plan = { planId: id('plan', number), scopeId: SCOPE, evidenceKind: 'SYNTHETIC_FIXTURE',
    startsAtMs: at + 1000, endsAtMs: at + 7000, caseDefinitions };
  const validationCases = caseDefinitions.map((c, i) => ({ ...clone(c), scopeId: SCOPE,
    evidenceKind: 'SYNTHETIC_FIXTURE', occurredAtMs: at + 1000 + i * 100 }));
  return { state: state ?? createR65EvolutionState({ scopeId: SCOPE, nowMs: at - 86400000 }),
    receipts, period: source.period, studyAtMs: at,
    sourceCycleId: '00000000-0000-4000-8000-' + number.toString(16).padStart(12, '0'),
    plan, nowMs: at + 1, validationCases };
}
function args(f, overrides = {}) {
  const { validationCases, ...input } = f;
  return { ...input, ...overrides };
}
const registered = f => registerR65Evaluation(args(f));
const finish = f => runR65EvolutionCycle({ state: registered(f), validationCases: f.validationCases, nowMs: f.plan.endsAtMs });

test('R65 state declares separate QA observations and synthetic validation with all real effects disabled', () => {
  const state = createR65EvolutionState({ scopeId: SCOPE, nowMs: T });
  assert.deepEqual(inspectR65EvolutionState(clone(state)), state);
  assert.equal(state.revision, 0);
  assert.equal(state.observationEvidenceKind, 'SIGNED_QA_REPLAY');
  assert.equal(state.validationEvidenceKind, 'SYNTHETIC_FIXTURE');
  assert.equal(state.applicationEnvironment, 'QA_RESEARCH_ONLY');
  assert.equal(state.activeVersion.activationGeneration, 0);
  assert.equal(state.policy.candidateMaxAgeMs, 500);
  assert(Object.isFrozen(state) && Object.isFrozen(state.policy));
  for (const key of ['operationalDataAccepted', 'liveExecutionAllowed', 'externalPaperExecutionAllowed',
    'productionConfigurationChanged', 'productionMonitoringStarted', 'deploymentPerformed', 'r15ProspectiveBackfill'])
    assert.equal(state[key], false);
  assert.equal(state.manualOperatorControlPreserved, true);
  assert.equal(state.alignmentGuardThreshold, 0.65);
  assert.equal(state.losseshometroSyntheticOnly, true);
  for (const key of ['actualBrokerPnl', 'actualLossesAvoided', 'realTradeAccuracy']) assert.equal(state[key], null);
  for (const key of ['realOrdersSent', 'externalPaperOrdersSent']) assert.equal(state[key], 0);
});

test('R65 reconstructs the whole admitted QA study and freezes an independent prospective fixture plan', () => {
  const f = fixture(), state = registered(f), pending = state.pendingEvaluation;
  assert.equal(state.revision, 1);
  assert.equal(state.journal.length, 1);
  assert.equal(state.history.length, 1);
  assert.equal(pending.observation.study.receiptCount, 7);
  assert.equal(pending.observation.study.evidenceKind, 'SIGNED_QA_REPLAY');
  assert.equal(pending.plan.evidenceKind, 'SYNTHETIC_FIXTURE');
  assert.equal(pending.observation.sourceCycleId, f.sourceCycleId);
  assert.equal(pending.observation.proposal.assessment, 'HYPOTHESIS_REQUIRES_INDEPENDENT_VALIDATION');
  assert.equal(pending.observation.proposal.origin, 'DETERMINISTIC_OBSERVATION_RULE');
  assert.deepEqual(state.journal[0].receipts, f.receipts);
  assert.equal(state.activeVersion.maxAgeMs, 750);
  assert.deepEqual(inspectR65EvolutionState(clone(state)), state);
  assert.deepEqual(registerR65Evaluation(args(f, { state })), state);
});

test('R65 measures a strict R47 improvement before one bounded application and records causal evidence', () => {
  const f = fixture(), result = finish(f);
  assert.equal(result.evaluation.status, 'AUTO_APPLIED');
  assert.equal(result.evaluation.reason, 'INDEPENDENT_SYNTHETIC_IMPROVEMENT');
  assert.equal(result.evaluation.baseline.falseAllows, 2);
  assert.equal(result.evaluation.candidate.falseAllows, 0);
  assert.equal(result.evaluation.candidate.falseBlocks, 0);
  assert.equal(result.evaluation.observationEvidenceKind, 'SIGNED_QA_REPLAY');
  assert.equal(result.evaluation.validationEvidenceKind, 'SYNTHETIC_FIXTURE');
  assert.equal(result.state.activeVersion.versionId, 'research:r65-v2');
  assert.equal(result.state.activeVersion.maxAgeMs, 500);
  assert.equal(result.state.activeVersion.activationGeneration, 1);
  assert.equal(result.state.revision, 2);
  assert.equal(result.state.history.length, 2);
  assert.equal(result.state.journal.length, 2);
  assert.equal(result.state.versions.length, 2);
  assert.equal(result.state.pendingEvaluation, null);
  assert.deepEqual(inspectR65EvolutionState(clone(result.state)), result.state);
});

for (const [name, definitions, reason] of [
  ['false blocks', [[100, true], [200, true], [600, true], [700, false], [900, false], [1000, false]], 'CANDIDATE_FALSE_BLOCK_REGRESSION'],
  ['remaining false allows', [[100, true], [200, true], [400, false], [700, false], [900, false], [1000, false]], 'CANDIDATE_FALSE_ALLOWS_REMAIN'],
  ['no measurable improvement', [[100, true], [200, true], [850, false], [950, false], [900, false], [1000, false]], 'NO_MEASURABLE_IMPROVEMENT'],
]) {
  test(`R65 rejects ${name} without changing the active configuration`, () => {
    const result = finish(fixture({ definitions }));
    assert.equal(result.evaluation.status, 'REJECTED');
    assert.equal(result.evaluation.reason, reason);
    assert.equal(result.state.activeVersion.maxAgeMs, 750);
    assert.equal(result.state.activeVersion.activationGeneration, 0);
    assert.equal(result.state.versions.length, 1);
  });
}

test('R65 requires the complete preregistered window and records an incomplete evaluation as rejected', () => {
  const f = fixture(), state = registered(f);
  denies(() => runR65EvolutionCycle({ state, validationCases: f.validationCases,
    nowMs: f.plan.endsAtMs - 1 }), 'R65_EVALUATION_WINDOW_NOT_CLOSED');
  const result = runR65EvolutionCycle({ state, validationCases: f.validationCases.slice(0, 5), nowMs: f.plan.endsAtMs });
  assert.equal(result.evaluation.status, 'REJECTED');
  assert.equal(result.evaluation.reason, 'INCOMPLETE_PREREGISTERED_WINDOW');
  assert.equal(result.evaluation.baseline, null);
  assert.equal(result.evaluation.candidate, null);
});

test('R65 executes frozen fixtures only during their open window and does not accept boolean authority', () => {
  const f = fixture(), state = registered(f);
  const run = (caseId, nowMs = f.plan.startsAtMs) => executeR65ValidationCase({ state, caseId, nowMs });
  assert.deepEqual(run(id('case', 1)), { baselineAllow: true, candidateAllow: true });
  assert.deepEqual(run(id('case', 3)), { baselineAllow: true, candidateAllow: false });
  assert.deepEqual(run(id('case', 6)), { baselineAllow: false, candidateAllow: false });
  denies(() => run(id('case', 1), f.plan.startsAtMs - 1), 'R65_VALIDATION_WINDOW_NOT_OPEN');
  denies(() => run(id('case', 1), f.plan.endsAtMs), 'R65_VALIDATION_WINDOW_NOT_OPEN');
  denies(() => run(id('case', 9)), 'R65_INVALID_OR_REUSED_CASE_ID');
  denies(() => executeR65ValidationCase({ state, caseId: id('case', 1), nowMs: f.plan.startsAtMs,
    baselineAllow: true }), 'R65_INVALID_VALIDATION_EXECUTION');
  denies(() => executeR65ValidationCase({ state: f.state, caseId: id('case', 1), nowMs: T }), 'R65_NO_PENDING_EVALUATION');
});

test('R65 refuses retrospective plans, missing classes, insufficient cases and mutable plan fields', () => {
  const f = fixture();
  for (const [change, code] of [
    [p => { p.startsAtMs = f.nowMs; }, 'R65_PLAN_SCOPE_OR_TIME_MISMATCH'],
    [p => { p.endsAtMs = p.startsAtMs; }, 'R65_PLAN_SCOPE_OR_TIME_MISMATCH'],
    [p => { p.evidenceKind = 'SIGNED_QA_REPLAY'; }, 'R65_PLAN_SCOPE_OR_TIME_MISMATCH'],
    [p => { p.scopeId = 'scope:ffffffffffffffff'; }, 'R65_PLAN_SCOPE_OR_TIME_MISMATCH'],
    [p => { p.caseDefinitions.pop(); }, 'R65_INSUFFICIENT_PREREGISTERED_CASES'],
    [p => { p.caseDefinitions.forEach(c => { c.expectedAllow = false; }); }, 'R65_PREREGISTERED_CLASSES_REQUIRED'],
    [p => { p.pass = true; }, 'R65_INVALID_EVALUATION_PLAN'],
  ]) {
    const plan = clone(f.plan); change(plan);
    denies(() => registerR65Evaluation(args(f, { plan })), code);
  }
});

test('R65 freezes every case identity, input, label, scope, provenance and occurrence boundary', () => {
  const f = fixture(), state = registered(f);
  for (const [change, code] of [
    [c => { c.snapshotAgesMs = [100, 100]; }, 'R65_PREREGISTERED_CASE_CHANGED'],
    [c => { c.expectedAllow = true; }, 'R65_PREREGISTERED_CASE_CHANGED'],
    [c => { c.caseId = id('case', 99); }, 'R65_INVALID_OR_REUSED_CASE_ID'],
    [c => { c.scopeId = 'scope:ffffffffffffffff'; }, 'R65_VALIDATION_SCOPE_MISMATCH'],
    [c => { c.evidenceKind = 'SIGNED_QA_REPLAY'; }, 'R65_VALIDATION_SCOPE_MISMATCH'],
    [c => { c.occurredAtMs = f.plan.startsAtMs - 1; }, 'R65_VALIDATION_TIME_MISMATCH'],
    [c => { c.occurredAtMs = f.plan.endsAtMs; }, 'R65_VALIDATION_TIME_MISMATCH'],
    [c => { c.pass = true; }, 'R65_INVALID_VALIDATION_CASE'],
  ]) {
    const validationCases = clone(f.validationCases); change(validationCases[2]);
    denies(() => runR65EvolutionCycle({ state, validationCases, nowMs: f.plan.endsAtMs }), code);
  }
  denies(() => runR65EvolutionCycle({ state, validationCases: [...f.validationCases, f.validationCases[0]],
    nowMs: f.plan.endsAtMs }), 'R65_INVALID_OR_REUSED_CASE_ID');
});

test('R65 uses all receipts, so a control violation outside the analyst sample prevents registration', () => {
  const f = fixture({ count: 55, mutatePayload: (p, i) => {
    if (i === 0) { p.event.kind = 'incident'; p.event.issue = 'CONTROL_VIOLATION'; }
  } });
  denies(() => registered(f), 'R65_CONTROL_VIOLATION_REQUIRES_REVIEW');
});

test('R65 rejects weak, mismatched, tampered or relabelled observation evidence', () => {
  denies(() => registered(fixture({ count: 6 })), 'R65_NO_ELIGIBLE_OBSERVATION_HYPOTHESIS');
  denies(() => registered(fixture({ mutatePayload: p => { p.event.policyVersion = 'research:r63-v1'; } })),
    'R65_OBSERVATION_POLICY_VERSION_MISMATCH');
  const f = fixture();
  const corrupt = clone(f.receipts); corrupt[4].event.marketAgeMs++;
  denies(() => registerR65Evaluation(args(f, { receipts: corrupt })), 'R64_TELEMETRY_RECEIPT_INTEGRITY');
  const relabelled = clone(f.receipts); relabelled[4].evidenceKind = 'SYNTHETIC_FIXTURE';
  denies(() => registerR65Evaluation(args(f, { receipts: relabelled })), 'R64_TELEMETRY_PAYLOAD_VALUE');
  denies(() => registerR65Evaluation(args(f, { sourceCycleId: 'fake-cycle' })), 'R65_INVALID_OBSERVATION_CONTEXT');
  denies(() => registerR65Evaluation(args(f, { nowMs: f.studyAtMs })), 'R65_OBSERVATION_MUST_PRECEDE_REGISTRATION');
  denies(() => registerR65Evaluation(args(f, { studyAtMs: f.nowMs + 1 })), 'R65_INVALID_OBSERVATION_CONTEXT');
  denies(() => registerR65Evaluation({ ...args(f), study: {} }), 'R65_INVALID_REGISTRATION_INPUT');
});

test('R65 deduplicates identical admitted receipts without counting duplicate episodes', () => {
  const f = fixture(), state = registerR65Evaluation(args(f, { receipts: [...f.receipts, ...f.receipts] }));
  assert.equal(state.pendingEvaluation.observation.study.receiptCount, 7);
  assert.equal(state.journal[0].receipts.length, 7);
  const repeated = fixture({ mutatePayload: (p, i) => { if (i >= 4) p.event.occurredAtMs = T - 32400000 - 1000; } });
  denies(() => registered(repeated), 'R65_NO_ELIGIBLE_OBSERVATION_HYPOTHESIS');
});

test('R65 rechecks model references and retains hypothesis-only status before independent evaluation', () => {
  const f = fixture();
  const analystHypothesis = { kind: 'TIGHTEN_MARKET_FRESHNESS', maxAgeMs: 500,
    evidenceEventIds: f.receipts.slice(4).map(r => r.eventId),
    assessment: 'HYPOTHESIS_REQUIRES_INDEPENDENT_VALIDATION' };
  const state = registerR65Evaluation(args(f, { analystHypothesis }));
  assert.equal(state.activeVersion.maxAgeMs, 750);
  assert.equal(state.pendingEvaluation.observation.proposal.origin, 'MODEL_PROPOSAL_INDEPENDENTLY_RECHECKED');
  for (const [patch, code] of [
    [{ maxAgeMs: 400 }, 'R65_UNSUPPORTED_ANALYST_HYPOTHESIS'],
    [{ evidenceEventIds: [id('evt', 1), id('evt', 2), id('evt', 3)] }, 'R65_UNSUPPORTED_ANALYST_HYPOTHESIS'],
    [{ assessment: 'APPROVED' }, 'R65_UNSUPPORTED_ANALYST_HYPOTHESIS'],
    [{ mayPromote: true }, 'R65_INVALID_ANALYST_HYPOTHESIS'],
  ]) denies(() => registerR65Evaluation(args(f, { analystHypothesis: { ...analystHypothesis, ...patch } })), code);
});

test('R65 retires consumed cycles, plans, validation identities and observation identities', () => {
  const first = fixture(), state = runR65EvolutionCycle({ state: registered(first), validationCases: [], nowMs: first.plan.endsAtMs }).state;
  const next = fixture({ at: T + 86400000, state, firstEvent: 101, number: 2, caseOffset: 100 });
  denies(() => registerR65Evaluation(args(next, { sourceCycleId: first.sourceCycleId })), 'R65_SOURCE_CYCLE_ALREADY_USED');
  denies(() => registerR65Evaluation(args(next, { plan: { ...next.plan, planId: first.plan.planId } })), 'R65_EVALUATION_PLAN_ALREADY_USED');
  const oldCases = clone(next.plan); oldCases.caseDefinitions.forEach((c, i) => { c.caseId = first.plan.caseDefinitions[i].caseId; });
  denies(() => registerR65Evaluation(args(next, { plan: oldCases })), 'R65_VALIDATION_CASE_ALREADY_USED');
  const oldEventIds = fixture({ at: T + 86400000, state, firstEvent: 1, number: 2, caseOffset: 100 });
  denies(() => registered(oldEventIds), 'R65_OBSERVATION_EVIDENCE_ALREADY_USED');
  const oldTime = fixture({ state, firstEvent: 101, number: 2, caseOffset: 100 });
  denies(() => registerR65Evaluation(args(oldTime, { plan: next.plan, nowMs: next.nowMs })), 'R65_NEW_OBSERVATION_MUST_BE_PROSPECTIVE');
  assert.equal(registered(next).revision, 3);
});

test('R65 rollback preserves history, increments generation and permanently retires the candidate', () => {
  const f = fixture(), applied = finish(f).state;
  const state = rollbackR65Evolution({ state: applied, reason: 'REGRESSION_DETECTED', nowMs: f.plan.endsAtMs + 1 });
  assert.equal(state.activeVersion.versionId, 'research:r65-v1');
  assert.equal(state.activeVersion.maxAgeMs, 750);
  assert.equal(state.activeVersion.activationGeneration, 2);
  assert.equal(state.revision, 3);
  assert.equal(state.history.at(-1).action, 'ROLLED_BACK');
  assert.deepEqual(state.retiredCandidateMaxAgeMs, [500]);
  assert.equal(state.versions.length, 2);
  assert.deepEqual(state.journal.slice(0, 2), applied.journal);
  assert.deepEqual(inspectR65EvolutionState(clone(state)), state);
  const next = fixture({ at: T + 86400000, state, firstEvent: 101, number: 2, caseOffset: 100 });
  denies(() => registered(next), 'R65_NO_FURTHER_AUTOMATIC_CHANGE');
  denies(() => rollbackR65Evolution({ state, reason: 'OWNER_REQUEST', nowMs: f.plan.endsAtMs + 2 }), 'R65_NO_PREVIOUS_VERSION');
  denies(() => rollbackR65Evolution({ state: applied, reason: 'disable risk', nowMs: f.plan.endsAtMs + 2 }), 'R65_INVALID_ROLLBACK_REASON');
});

test('R65 rejects state edits by replay and never invokes malicious descriptors', () => {
  const state = finish(fixture()).state;
  for (const change of [
    s => { s.activeVersion.maxAgeMs = 1000; }, s => { s.policy.alignmentGuardThreshold = 0; },
    s => { s.evaluations[0].candidate.falseAllows = 99; }, s => { s.history[0].reason = 'APPROVED'; },
    s => { s.revision++; }, s => { s.actualBrokerPnl = 1; }, s => { s.journal[0].receipts[4].event.marketAgeMs++; },
  ]) {
    const forged = clone(state); change(forged); denies(() => inspectR65EvolutionState(forged));
  }
  let calls = 0;
  const accessor = clone(state);
  Object.defineProperty(accessor.activeVersion, 'maxAgeMs', { enumerable: true, get() { calls++; return 500; } });
  denies(() => inspectR65EvolutionState(accessor), 'R65_EVOLUTION_NON_JSON_VALUE');
  const input = { scopeId: SCOPE, nowMs: T };
  Object.defineProperty(input, 'nowMs', { enumerable: true, get() { calls++; return T; } });
  denies(() => createR65EvolutionState(input), 'R65_INVALID_EVOLUTION_CONTEXT');
  assert.equal(calls, 0);
  const sparse = clone(state); delete sparse.journal[0].plan.caseDefinitions[0];
  denies(() => inspectR65EvolutionState(sparse), 'R65_EVOLUTION_INVALID_ARRAY');
});

test('R65 keeps no-change reads idempotent and enforces monotonic command clocks', () => {
  const f = fixture(), result = finish(f);
  const noChange = runR65EvolutionCycle({ state: result.state, validationCases: [], nowMs: f.plan.endsAtMs + 1 });
  assert.equal(noChange.evaluation.status, 'NO_CHANGE');
  assert.deepEqual(noChange.state, result.state);
  denies(() => runR65EvolutionCycle({ state: result.state, validationCases: [], nowMs: T }), 'R65_EVOLUTION_CLOCK_REGRESSION');
  denies(() => rollbackR65Evolution({ state: result.state, reason: 'OWNER_REQUEST', nowMs: T }), 'R65_EVOLUTION_CLOCK_REGRESSION');
  assert.equal(R65_EVOLUTION_POLICY.maxPromotions, 1);
  assert.equal(R65_EVOLUTION_POLICY.minConsecutiveFresh, 2);
});
