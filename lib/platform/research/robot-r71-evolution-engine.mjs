/** Deterministic, replayable QA state machine for one bounded external policy.
 * Derived scores, versions and history are reconstructed from the journal.
 * Applying this wrapper does not retune the unchanged original private core.
 */
import { R71_POLICY, R71_LIMITS, copyR71, sameR71, freezeR71, fieldsR71,
  inspectR71Plan, createR71Plan, inspectR71RuntimeView, r71ReferenceVersion } from './robot-r71-policy.mjs';
import { inspectR71PrivateStudy, inspectR71Decision, isR71ExistingPositionRouted } from './robot-r71-private-study.mjs';

const fail = code => { throw Object.assign(Error(code), { name: 'ValidationError', code }); };
const exact = (v, keys, code) => fieldsR71(v, keys, keys, code);
const integer = (n, min = 0, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(n) && n >= min && n <= max;
const SHA = /^[a-f0-9]{64}$/;
const STATE_KEYS = ['schema', 'scopeId', 'sourceId', 'sourceKeySha256', 'createdAtMs', 'revision',
  'activeVersion', 'promotions', 'candidateRetired', 'latestStudy', 'pendingEvaluation', 'evaluations', 'history', 'journal'];
const CASE_KEYS = ['planId', 'caseId', 'eventId', 'recordDigest', 'capturedAtMs', 'admittedAtMs', 'nativeDecision', 'effectiveDecision'];
function identity(scopeId, sourceId, sourceKeySha256) {
  if (!/^scope:[a-f0-9]{16}$/.test(scopeId || '') || !/^source:[a-f0-9]{16}$/.test(sourceId || '') ||
      !SHA.test(sourceKeySha256 || '')) fail('R71_STATE_IDENTITY');
}
function initial(command) {
  const c = exact(command, ['action', 'atMs', 'scopeId', 'sourceId', 'sourceKeySha256'], 'R71_INITIALIZE');
  if (c.action !== 'INITIALIZE' || !integer(c.atMs, 1)) fail('R71_INITIALIZE');
  identity(c.scopeId, c.sourceId, c.sourceKeySha256);
  return { schema: 'JENIOS_R71_PRIVATE_EVOLUTION_STATE_V1', scopeId: c.scopeId, sourceId: c.sourceId,
    sourceKeySha256: c.sourceKeySha256, createdAtMs: c.atMs, revision: 0, activeVersion: r71ReferenceVersion(0),
    promotions: 0, candidateRetired: false, latestStudy: null, pendingEvaluation: null,
    evaluations: [], history: [], journal: [copyR71(c)] };
}
function eligibleStudy(state) {
  const study = state.latestStudy;
  return study && !state.activeVersion.forwardPositionOpen &&
    study.hypothesis.source === 'BOUNDED_DETERMINISTIC_POLICY' &&
    study.hypothesis.eligibleGenerations.includes(state.activeVersion.activationGeneration) &&
    study.metrics.byVersion.some(v => v.versionId === state.activeVersion.versionId &&
      v.activationGeneration === state.activeVersion.activationGeneration && v.protectedCaseChanges === 0 &&
      v.missedExistingPositionRouting >= R71_POLICY.minimumMissedContexts &&
      v.missedByMode.hybrid > 0 && v.missedByMode.reverse > 0);
}
function checkedCases(raw, plan) {
  if (!Array.isArray(raw) || raw.length > R71_LIMITS.validationCases) fail('R71_VALIDATION_CASES');
  const ids = new Set(), events = new Map();
  const cases = raw.map(input => {
    const c = exact(copyR71(input), CASE_KEYS, 'R71_VALIDATION_CASE');
    if (c.planId !== plan.planId || !plan.caseDefinitions.some(d => d.caseId === c.caseId) || ids.has(c.caseId) ||
        !/^evt:[a-f0-9]{16}$/.test(c.eventId || '') || !SHA.test(c.recordDigest || '') ||
        !integer(c.capturedAtMs, plan.startsAtMs, plan.endsAtMs - 1) ||
        !integer(c.admittedAtMs, c.capturedAtMs, plan.endsAtMs - 1)) fail('R71_VALIDATION_CASE_WINDOW');
    if (events.has(c.eventId) && events.get(c.eventId) !== c.recordDigest) fail('R71_VALIDATION_EVENT_CONFLICT');
    events.set(c.eventId, c.recordDigest); ids.add(c.caseId);
    c.nativeDecision = inspectR71Decision(c.nativeDecision); c.effectiveDecision = inspectR71Decision(c.effectiveDecision);
    return c;
  });
  return plan.caseDefinitions.flatMap(d => cases.filter(c => c.caseId === d.caseId));
}
function measure(plan, cases, completedAtMs) {
  const caseResults = cases.map(c => {
    const d = plan.caseDefinitions.find(d => d.caseId === c.caseId);
    const required = d.expectedRouting === 'MANAGE_EXISTING_POSITION';
    const protectedChanged = !required && !sameR71(c.nativeDecision, c.effectiveDecision);
    const baselineMissed = required && !isR71ExistingPositionRouted(c.nativeDecision);
    const candidateMissed = required && !isR71ExistingPositionRouted(c.effectiveDecision);
    const unsupportedCandidate = required ? candidateMissed : protectedChanged;
    return { caseId: c.caseId, eventId: c.eventId, recordDigest: c.recordDigest,
      capturedAtMs: c.capturedAtMs, admittedAtMs: c.admittedAtMs, expectedRouting: d.expectedRouting,
      nativeDecision: c.nativeDecision, effectiveDecision: c.effectiveDecision,
      baselineMissed, candidateMissed, protectedChanged, unsupportedCandidate };
  });
  const count = key => caseResults.filter(c => c[key]).length;
  const summary = { expectedCases: R71_LIMITS.validationCases, observedCases: cases.length,
    baselineMissedExistingPositionRouting: count('baselineMissed'), candidateMissedExistingPositionRouting: count('candidateMissed'),
    protectedCaseChanges: count('protectedChanged'), unsupportedCandidateOutcomes: count('unsupportedCandidate') };
  const missingCaseIds = plan.caseDefinitions.filter(d => !cases.some(c => c.caseId === d.caseId)).map(d => d.caseId);
  const status = missingCaseIds.length ? 'REJECTED_INCOMPLETE' :
    summary.protectedCaseChanges || summary.unsupportedCandidateOutcomes ? 'REJECTED_POLICY' :
      summary.baselineMissedExistingPositionRouting <= 0 || summary.candidateMissedExistingPositionRouting !== 0
        ? 'REJECTED_NO_IMPROVEMENT' : 'APPLIED';
  return { schema: 'JENIOS_R71_EVALUATION_RESULT_V1', planId: plan.planId, snapshotId: plan.snapshotId,
    studyDigest: plan.studyDigest, completedAtMs, status, eligibleToApply: status === 'APPLIED',
    summary, caseResults, missingCaseIds };
}
function advance(current, raw) {
  if (!integer(raw?.atMs, current.journal.at(-1).atMs) || current.revision + 1 >= R71_LIMITS.revisions)
    fail('R71_STATE_CLOCK_OR_LIMIT');
  const next = copyR71(current), from = current.activeVersion;
  let command, history = null;
  if (raw.action === 'STUDY') {
    const c = exact(raw, ['action', 'atMs', 'study'], 'R71_STUDY_COMMAND');
    if (current.pendingEvaluation || current.promotions || current.candidateRetired || current.evaluations.length)
      fail('R71_STUDY_NOT_OPEN');
    const study = inspectR71PrivateStudy(c.study);
    if (study.scopeId !== current.scopeId || study.sourceId !== current.sourceId || study.sourceKeySha256 !== current.sourceKeySha256 ||
        study.generatedAtMs > c.atMs) fail('R71_STUDY_STATE_BINDING');
    next.latestStudy = study; command = { action: 'STUDY', atMs: c.atMs, study };
  } else if (raw.action === 'REGISTER') {
    const c = exact(raw, ['action', 'atMs', 'plan'], 'R71_REGISTER_COMMAND');
    if (current.pendingEvaluation || current.promotions || current.candidateRetired || current.evaluations.length || !eligibleStudy(current))
      fail('R71_NO_AUTHORIZED_HYPOTHESIS');
    const plan = inspectR71Plan(c.plan), study = current.latestStudy;
    if (c.atMs !== plan.registeredAtMs || !sameR71(plan, createR71Plan({ snapshotId: study.snapshot.snapshotId,
      studyDigest: study.studyDigest, activeVersion: current.activeVersion, nowMs: c.atMs }))) fail('R71_PLAN_STUDY_BINDING');
    next.pendingEvaluation = plan; command = { action: 'REGISTER', atMs: c.atMs, plan };
    history = { action: 'REGISTERED', atMs: c.atMs, fromVersionId: from.versionId, toVersionId: from.versionId,
      activationGeneration: from.activationGeneration, planId: plan.planId, studyDigest: study.studyDigest, reason: null };
  } else if (raw.action === 'EVALUATE') {
    const c = exact(raw, ['action', 'atMs', 'cases'], 'R71_EVALUATE_COMMAND'), plan = current.pendingEvaluation;
    if (!plan || c.atMs < plan.endsAtMs || current.promotions || current.candidateRetired || current.evaluations.length)
      fail('R71_EVALUATION_WINDOW_NOT_CLOSED');
    const cases = checkedCases(c.cases, plan), evaluation = measure(plan, cases, c.atMs);
    if (evaluation.eligibleToApply) { next.activeVersion = plan.candidateVersion; next.promotions++; }
    else next.candidateRetired = true;
    next.evaluations.push(evaluation); next.pendingEvaluation = null;
    command = { action: 'EVALUATE', atMs: c.atMs, cases };
    history = { action: evaluation.status, atMs: c.atMs, fromVersionId: from.versionId, toVersionId: next.activeVersion.versionId,
      activationGeneration: next.activeVersion.activationGeneration, planId: plan.planId, studyDigest: plan.studyDigest, reason: null };
  } else if (raw.action === 'ROLLBACK') {
    const c = exact(raw, ['action', 'atMs', 'reason'], 'R71_ROLLBACK_COMMAND');
    if (!['OWNER_REQUEST', 'TECHNICAL_FAILURE', 'REGRESSION_DETECTED'].includes(c.reason) ||
        !current.activeVersion.forwardPositionOpen || current.promotions !== 1 || current.pendingEvaluation || current.candidateRetired)
      fail('R71_ROLLBACK_NOT_OPEN');
    next.activeVersion = r71ReferenceVersion(from.activationGeneration + 1); next.candidateRetired = true;
    command = { action: 'ROLLBACK', atMs: c.atMs, reason: c.reason };
    const evaluation = current.evaluations.at(-1);
    history = { action: 'ROLLED_BACK', atMs: c.atMs, fromVersionId: from.versionId, toVersionId: next.activeVersion.versionId,
      activationGeneration: next.activeVersion.activationGeneration, planId: evaluation.planId,
      studyDigest: evaluation.studyDigest, reason: c.reason };
  } else fail('R71_COMMAND');
  next.revision++; next.journal.push(command); if (history) next.history.push(history);
  // Serialization bounds apply to the whole replayable state, including facts.
  return copyR71(next);
}
export function inspectR71EvolutionState(input) {
  const state = exact(copyR71(input), STATE_KEYS, 'R71_STATE');
  if (state.schema !== 'JENIOS_R71_PRIVATE_EVOLUTION_STATE_V1' || !Array.isArray(state.journal) ||
      state.journal.length < 1 || state.journal.length > R71_LIMITS.revisions ||
      !integer(state.revision, 0, R71_LIMITS.revisions - 1) || state.journal.length !== state.revision + 1)
    fail('R71_STATE');
  let rebuilt = initial(state.journal[0]);
  for (const command of state.journal.slice(1)) rebuilt = advance(rebuilt, command);
  if (!sameR71(state, rebuilt)) fail('R71_STATE_RECONSTRUCTION');
  return freezeR71(rebuilt);
}
export function createR71EvolutionState(input) {
  const a = exact(input, ['scopeId', 'sourceId', 'sourceKeySha256', 'nowMs'], 'R71_INITIAL_CONFIG');
  return freezeR71(initial({ action: 'INITIALIZE', atMs: a.nowMs, scopeId: a.scopeId,
    sourceId: a.sourceId, sourceKeySha256: a.sourceKeySha256 }));
}
export function recordR71Study(input) {
  const a = exact(input, ['state', 'study', 'nowMs'], 'R71_STUDY_CONFIG');
  return freezeR71(advance(inspectR71EvolutionState(a.state), { action: 'STUDY', atMs: a.nowMs, study: a.study }));
}
export function registerR71Evaluation(input) {
  const a = exact(input, ['state', 'plan', 'nowMs'], 'R71_REGISTER_CONFIG');
  return freezeR71(advance(inspectR71EvolutionState(a.state), { action: 'REGISTER', atMs: a.nowMs, plan: a.plan }));
}
export function evaluateR71Evolution(input) {
  const a = exact(input, ['state', 'cases', 'nowMs'], 'R71_EVALUATE_CONFIG');
  const state = freezeR71(advance(inspectR71EvolutionState(a.state), { action: 'EVALUATE', atMs: a.nowMs, cases: a.cases }));
  return freezeR71({ state, evaluation: state.evaluations.at(-1) });
}
export function rollbackR71Evolution(input) {
  const a = exact(input, ['state', 'reason', 'nowMs'], 'R71_ROLLBACK_CONFIG');
  return freezeR71(advance(inspectR71EvolutionState(a.state), { action: 'ROLLBACK', atMs: a.nowMs, reason: a.reason }));
}
export function projectR71RuntimeView(input) {
  const row = fieldsR71(input, ['scopeId', 'sourceId', 'revision', 'stateDigest', 'state', 'replayed'],
    ['scopeId', 'sourceId', 'revision', 'stateDigest', 'state'], 'R71_STATE_ROW');
  const state = inspectR71EvolutionState(row.state);
  if (row.scopeId !== state.scopeId || row.sourceId !== state.sourceId || row.revision !== state.revision ||
      !SHA.test(row.stateDigest || '')) fail('R71_STATE_ROW');
  return inspectR71RuntimeView({ schema: 'JENIOS_R71_RUNTIME_VIEW_V1', scopeId: state.scopeId,
    sourceId: state.sourceId, sourceKeySha256: state.sourceKeySha256, revision: state.revision,
    stateDigest: row.stateDigest, activeVersion: state.activeVersion, pendingEvaluation: state.pendingEvaluation });
}
