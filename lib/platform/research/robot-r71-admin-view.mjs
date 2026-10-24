/** Browser-safe closed report. No journal, capture, scenario, key or signature is projected. */
const ORIGIN = 'ORIGINAL_PRIVATE_CORE_WITH_VERSIONED_EXTERNAL_RUNTIME_POLICY_SYNTHETIC_QA';
const POLICY = 'HONOR_EXISTING_POSITION_CONTEXT_FOR_ASSISTED';
const boundaries = Object.freeze({ operationalReady: false, customerMonitoringActive: false,
  privateOperationalSourceActive: false, internalCoreRetuning: false, independentRuntimeAttestation: false,
  commercialPerformanceCertified: false, productionChanged: false, paidGenerationEnabled: false,
  realOrdersSent: 0, externalPaperOrdersSent: 0, paidProviderCalls: 0,
  actualBrokerPnl: null, actualLossesAvoided: null, realTradeAccuracy: null, manualOperatorControlPreserved: true });
const integer = (v, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(v) && v >= 0 && v <= max;
const hex = v => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
const id = (v, p) => typeof v === 'string' && new RegExp('^' + p + ':[a-f0-9]{16}$').test(v);
const uuid = v => typeof v === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(v);
const versionId = v => ['private:r71-reference-v1', 'private:r71-position-context-v1'].includes(v);
function exact(v, keys) {
  if (!v || typeof v !== 'object' || Array.isArray(v) || ![Object.prototype, null].includes(Object.getPrototypeOf(v))) return false;
  const own = Reflect.ownKeys(v);
  return own.length === keys.length && own.every(k => typeof k === 'string' && keys.includes(k) &&
    Object.hasOwn(Object.getOwnPropertyDescriptor(v, k), 'value') && Object.getOwnPropertyDescriptor(v, k).enumerable);
}
function list(v, max, check) {
  if (!Array.isArray(v) || v.length > max || Reflect.ownKeys(v).length !== v.length + 1) return false;
  for (let i = 0; i < v.length; i++) {
    const d = Object.getOwnPropertyDescriptor(v, String(i));
    if (!d || !Object.hasOwn(d, 'value') || !check(d.value)) return false;
  }
  return true;
}
const version = v => exact(v, ['versionId', 'activationGeneration', 'forwardPositionOpen']) &&
  integer(v.activationGeneration, 31) && typeof v.forwardPositionOpen === 'boolean' &&
  v.versionId === (v.forwardPositionOpen ? 'private:r71-position-context-v1' : 'private:r71-reference-v1');
const period = v => exact(v, ['startMs', 'endMs']) && integer(v.startMs) && integer(v.endMs) && v.endMs > v.startMs;
const snapshot = v => exact(v, ['snapshotId', 'period', 'frozenAtMs', 'totalRecords', 'totalEntries', 'membershipDigest']) &&
  uuid(v.snapshotId) && period(v.period) && integer(v.frozenAtMs) && v.frozenAtMs >= v.period.endMs &&
  integer(v.totalRecords, 256) && integer(v.totalEntries, 8000) && hex(v.membershipDigest);
const studyMetrics = v => exact(v, ['totalRecords', 'totalEntries', 'observationRecords', 'observationEntries',
  'validationRecords', 'validationEntries', 'baselineMissedExistingPositionRouting', 'protectedCaseChanges']) &&
  integer(v.totalRecords, 256) && integer(v.totalEntries, 8000) && integer(v.observationRecords, 256) &&
  integer(v.validationRecords, 256) && v.observationRecords + v.validationRecords === v.totalRecords &&
  integer(v.observationEntries, 8000) && integer(v.validationEntries, 8000) &&
  v.observationEntries + v.validationEntries === v.totalEntries &&
  integer(v.baselineMissedExistingPositionRouting, v.observationEntries) && integer(v.protectedCaseChanges, v.totalEntries);
const finding = v => exact(v, ['code', 'mode', 'count']) && v.code === 'MISSING_EXISTING_POSITION_CONTEXT' &&
  ['hybrid', 'reverse'].includes(v.mode) && integer(v.count, 8000) && v.count > 0;
const hypothesis = v => exact(v, ['source', 'kind', 'eligibleGenerations', 'providerEnabled', 'paidProviderCalls']) &&
  v.source === 'BOUNDED_DETERMINISTIC_POLICY' && v.kind === POLICY &&
  list(v.eligibleGenerations, 32, x => integer(x, 31)) &&
  new Set(v.eligibleGenerations).size === v.eligibleGenerations.length && v.providerEnabled === false && v.paidProviderCalls === 0;
const study = v => v === null || (exact(v, ['snapshot', 'generatedAtMs', 'studyDigest', 'metrics', 'findings', 'hypothesis']) &&
  snapshot(v.snapshot) && integer(v.generatedAtMs) && hex(v.studyDigest) && studyMetrics(v.metrics) &&
  v.metrics.totalRecords === v.snapshot.totalRecords && v.metrics.totalEntries === v.snapshot.totalEntries &&
  list(v.findings, 2, finding) && new Set(v.findings.map(x => x.mode)).size === v.findings.length && hypothesis(v.hypothesis));
const plan = v => v === null || (exact(v, ['planId', 'snapshotId', 'studyDigest', 'registeredAtMs', 'startsAtMs', 'endsAtMs',
  'baselineVersion', 'candidateVersion', 'caseCount', 'capturedCases']) && id(v.planId, 'plan') && uuid(v.snapshotId) &&
  hex(v.studyDigest) && integer(v.registeredAtMs) && integer(v.startsAtMs) && integer(v.endsAtMs) &&
  v.startsAtMs - v.registeredAtMs === 1000 && v.endsAtMs - v.startsAtMs === 10000 &&
  version(v.baselineVersion) && !v.baselineVersion.forwardPositionOpen && version(v.candidateVersion) &&
  v.candidateVersion.forwardPositionOpen && v.candidateVersion.activationGeneration === v.baselineVersion.activationGeneration + 1 &&
  v.caseCount === 8 && integer(v.capturedCases, 8));
const evaluationStatus = v => ['APPLIED', 'REJECTED_INCOMPLETE', 'REJECTED_NO_IMPROVEMENT', 'REJECTED_POLICY'].includes(v);
const score = v => v === null || integer(v, 8);
const summary = v => exact(v, ['expectedCases', 'observedCases', 'baselineMissedExistingPositionRouting',
  'candidateMissedExistingPositionRouting', 'protectedCaseChanges', 'unsupportedCandidateOutcomes']) &&
  v.expectedCases === 8 && integer(v.observedCases, 8) &&
  ['baselineMissedExistingPositionRouting', 'candidateMissedExistingPositionRouting', 'protectedCaseChanges',
    'unsupportedCandidateOutcomes'].every(k => score(v[k]));
const evaluation = v => v === null || (exact(v, ['planId', 'snapshotId', 'studyDigest', 'completedAtMs', 'status', 'summary']) &&
  id(v.planId, 'plan') && uuid(v.snapshotId) && hex(v.studyDigest) && integer(v.completedAtMs) &&
  evaluationStatus(v.status) && summary(v.summary) &&
  (v.status !== 'APPLIED' || (v.summary.observedCases === 8 && v.summary.baselineMissedExistingPositionRouting > 0 &&
    v.summary.candidateMissedExistingPositionRouting === 0 && v.summary.protectedCaseChanges === 0 && v.summary.unsupportedCandidateOutcomes === 0)));
const history = v => exact(v, ['action', 'atMs', 'fromVersionId', 'toVersionId', 'reason']) &&
  (['REGISTERED', 'ROLLED_BACK'].includes(v.action) || evaluationStatus(v.action)) && integer(v.atMs) &&
  (v.fromVersionId === null || versionId(v.fromVersionId)) && (v.toVersionId === null || versionId(v.toVersionId)) &&
  (v.reason === null || (typeof v.reason === 'string' && /^[A-Z_]{1,90}$/.test(v.reason)));
const operation = v => exact(v, ['operationId', 'revision', 'action', 'stateDigest', 'storedAtMs']) &&
  typeof v.operationId === 'string' && /^op:[a-f0-9]{32}$/.test(v.operationId) && integer(v.revision, 31) &&
  ['INITIALIZE', 'STUDY', 'REGISTER', 'EVALUATE', 'ROLLBACK'].includes(v.action) && hex(v.stateDigest) && integer(v.storedAtMs);
const state = v => v === null || (exact(v, ['revision', 'stateDigest', 'activeVersion', 'promotions', 'candidateRetired',
  'latestStudy', 'pendingEvaluation', 'lastEvaluation', 'history', 'maturity']) && integer(v.revision, 31) && hex(v.stateDigest) &&
  version(v.activeVersion) && integer(v.promotions, 1) && typeof v.candidateRetired === 'boolean' &&
  study(v.latestStudy) && plan(v.pendingEvaluation) && evaluation(v.lastEvaluation) && list(v.history, 32, history) &&
  ['BASELINE', 'EVALUATING', 'QA_APPLIED', 'QA_ROLLED_BACK', 'QA_REJECTED'].includes(v.maturity));

export function isR71AdminFeed(feed) {
  return exact(feed, ['schema', 'adminOnly', 'scopeId', 'sourceId', 'sourceKeySha256', 'generatedAtMs',
    'runtimeOrigin', 'positionContextEvidence', 'originalCoreVersion', 'originalPolicyVersion', 'originalGeneration',
    'policyKind', 'currentPrivateHostIndependentlyObserved', 'hostedAuthenticationCertified',
    'state', 'snapshots', 'operations', ...Object.keys(boundaries)]) &&
    feed.schema === 'JENIOS_R71_PRIVATE_EVOLUTION_ADMIN_FEED_V1' && feed.adminOnly === true &&
    id(feed.scopeId, 'scope') && id(feed.sourceId, 'source') && hex(feed.sourceKeySha256) && integer(feed.generatedAtMs) &&
    feed.runtimeOrigin === ORIGIN && feed.positionContextEvidence === 'SYNTHETIC_FIXTURE_ONLY' &&
    feed.originalCoreVersion === 'jenios-research-r29.1' && feed.originalPolicyVersion === 'private:r67-v1' &&
    feed.originalGeneration === 0 && feed.policyKind === POLICY &&
    feed.currentPrivateHostIndependentlyObserved === false && feed.hostedAuthenticationCertified === false &&
    state(feed.state) && list(feed.snapshots, 30, snapshot) && list(feed.operations, 30, operation) &&
    Object.entries(boundaries).every(([key, value]) => feed[key] === value);
}
export function requireR71AdminFeed(feed) {
  if (!isR71AdminFeed(feed)) throw Error('R71_ADMIN_FEED_INVALID');
  return feed;
}
const projectSnapshot = s => ({ snapshotId: s.snapshotId, period: { startMs: s.period.startMs, endMs: s.period.endMs },
  frozenAtMs: s.frozenAtMs, totalRecords: s.totalRecords, totalEntries: s.totalEntries, membershipDigest: s.membershipDigest });
const projectMetrics = m => Object.fromEntries(['totalRecords', 'totalEntries', 'observationRecords', 'observationEntries',
  'validationRecords', 'validationEntries', 'baselineMissedExistingPositionRouting', 'protectedCaseChanges'].map(k => [k, m[k]]));
function projectStudy(s) {
  return s ? { snapshot: projectSnapshot(s.snapshot), generatedAtMs: s.generatedAtMs, studyDigest: s.studyDigest,
    metrics: projectMetrics(s.metrics), findings: s.findings.map(x => ({ code: x.code, mode: x.mode, count: x.count })),
    hypothesis: { source: s.hypothesis.source, kind: s.hypothesis.kind, eligibleGenerations: [...s.hypothesis.eligibleGenerations],
      providerEnabled: s.hypothesis.providerEnabled, paidProviderCalls: s.hypothesis.paidProviderCalls } } : null;
}
function projectEvaluation(v) {
  if (!v) return null;
  const measured = v.status !== 'REJECTED_INCOMPLETE';
  return { planId: v.planId, snapshotId: v.snapshotId, studyDigest: v.studyDigest, completedAtMs: v.completedAtMs, status: v.status,
    summary: { expectedCases: v.summary.expectedCases, observedCases: v.summary.observedCases,
      ...Object.fromEntries(['baselineMissedExistingPositionRouting', 'candidateMissedExistingPositionRouting',
        'protectedCaseChanges', 'unsupportedCandidateOutcomes'].map(k => [k, measured ? v.summary[k] : null])) } };
}
export function projectR71AdminFeed({ scopeId, sourceId, sourceKeySha256, overview, validationCases = [], generatedAtMs }) {
  if (overview.scopeId !== scopeId || overview.sourceId !== sourceId || overview.sourceKeySha256 !== sourceKeySha256 ||
      !Array.isArray(overview.snapshots) || !Array.isArray(overview.operations)) throw Error('R71_ADMIN_SCOPE');
  for (const s of overview.snapshots) if (s.scopeId !== scopeId || s.sourceId !== sourceId || s.sourceKeySha256 !== sourceKeySha256)
    throw Error('R71_ADMIN_SCOPE');
  let projected = null;
  if (overview.state) {
    const row = overview.state, s = row.state, p = s.pendingEvaluation;
    if (row.scopeId !== scopeId || row.sourceId !== sourceId || s.scopeId !== scopeId || s.sourceId !== sourceId ||
        s.sourceKeySha256 !== sourceKeySha256 || row.revision !== s.revision) throw Error('R71_ADMIN_SCOPE');
    if (!Array.isArray(validationCases) || validationCases.length > 8 ||
        validationCases.some(c => !p || c.planId !== p.planId || !p.caseDefinitions.some(d => d.caseId === c.caseId)) ||
        new Set(validationCases.map(c => c.caseId)).size !== validationCases.length) throw Error('R71_ADMIN_CASES');
    projected = { revision: row.revision, stateDigest: row.stateDigest, activeVersion: { ...s.activeVersion },
      promotions: s.promotions, candidateRetired: s.candidateRetired, latestStudy: projectStudy(s.latestStudy),
      pendingEvaluation: p ? { planId: p.planId, snapshotId: p.snapshotId, studyDigest: p.studyDigest,
        registeredAtMs: p.registeredAtMs, startsAtMs: p.startsAtMs, endsAtMs: p.endsAtMs,
        baselineVersion: { ...p.baselineVersion }, candidateVersion: { ...p.candidateVersion },
        caseCount: p.caseDefinitions.length, capturedCases: validationCases.length } : null,
      lastEvaluation: projectEvaluation(s.evaluations.at(-1)),
      history: s.history.map(h => ({ action: h.action, atMs: h.atMs, fromVersionId: h.fromVersionId, toVersionId: h.toVersionId, reason: h.reason })),
      maturity: p ? 'EVALUATING' : s.activeVersion.forwardPositionOpen ? 'QA_APPLIED' :
        s.activeVersion.activationGeneration === 2 ? 'QA_ROLLED_BACK' : s.candidateRetired ? 'QA_REJECTED' : 'BASELINE' };
  } else if (validationCases.length) throw Error('R71_ADMIN_CASES');
  return requireR71AdminFeed({ schema: 'JENIOS_R71_PRIVATE_EVOLUTION_ADMIN_FEED_V1', adminOnly: true,
    scopeId, sourceId, sourceKeySha256, generatedAtMs, runtimeOrigin: ORIGIN, positionContextEvidence: 'SYNTHETIC_FIXTURE_ONLY',
    originalCoreVersion: 'jenios-research-r29.1', originalPolicyVersion: 'private:r67-v1', originalGeneration: 0,
    policyKind: POLICY, currentPrivateHostIndependentlyObserved: false, hostedAuthenticationCertified: false,
    state: projected, snapshots: overview.snapshots.map(projectSnapshot), operations: overview.operations.map(o => ({
      operationId: o.operationId, revision: o.revision, action: o.action, stateDigest: o.stateDigest, storedAtMs: o.storedAtMs })),
    ...boundaries });
}
