/** Closed policy for the EXISTING private chooseMode position-context input.
 * This is a versioned external runtime policy in synthetic QA. It neither
 * replaces the original core nor transfers the R65 UltraFast certification.
 */
import { createHash } from 'node:crypto';
import { canonicalPrivateDurableJson } from './robot-private-durable-file.mjs';
import { fieldsR67, freezeR67 } from './robot-r67-private-protocol.mjs';

export const freezeR71 = freezeR67;
export const fieldsR71 = fieldsR67;
export const R71_LIMITS = Object.freeze({ recordBytes: 524288, stateBytes: 8388608,
  snapshotRecords: 256, snapshotEntries: 8000, pageSize: 10, revisions: 32,
  validationCases: 8, lifetimeMs: 120000 });
export const R71_POLICY = freezeR71({
  kind: 'HONOR_EXISTING_POSITION_CONTEXT_FOR_ASSISTED', maxPromotions: 1,
  minimumMissedContexts: 3, validationStartDelayMs: 1000, validationWindowMs: 10000,
  studyWindowMs: 86400000, baselineVersionId: 'private:r71-reference-v1',
  candidateVersionId: 'private:r71-position-context-v1', allowedModes: ['hybrid', 'reverse'],
  manualMode: 'OBSERVE_ONLY', ultrafastPolicy: 'R65_SEPARATE_UNCHANGED',
  authorizationId: 'OWNER_PREAPPROVAL_QA_20261024', applicationEnvironment: 'SYNTHETIC_QA_ONLY',
  arbitraryCodeAllowed: false, financialParameterChangesAllowed: false,
});
export const R71_BOUNDARIES = Object.freeze({ operationalReady: false,
  customerMonitoringActive: false, privateOperationalSourceActive: false,
  internalCoreRetuning: false, independentRuntimeAttestation: false,
  commercialPerformanceCertified: false, productionChanged: false, paidGenerationEnabled: false,
  realOrdersSent: 0, externalPaperOrdersSent: 0, paidProviderCalls: 0,
  actualBrokerPnl: null, actualLossesAvoided: null, realTradeAccuracy: null,
  manualOperatorControlPreserved: true });

const SHA = /^[a-f0-9]{64}$/;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const PLAN = /^plan:[a-f0-9]{16}$/;
const fail = code => { throw Object.assign(new Error(code), { name: 'ValidationError', code }); };
const integer = (n, min = 0, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(n) && n >= min && n <= max;
const id = (value, prefix) => typeof value === 'string' && new RegExp('^' + prefix + ':[a-f0-9]{16}$').test(value);
const exact = (v, keys, code) => fieldsR71(v, keys, keys, code);
export function canonicalR71Json(value) {
  let text;
  try { text = canonicalPrivateDurableJson(value, 'R71_PRIVATE_EVOLUTION'); }
  catch { fail('R71_JSON_VALUE'); }
  if (Buffer.byteLength(text) > R71_LIMITS.stateBytes) fail('R71_JSON_LIMIT');
  return text;
}
export const digestR71Value = value => createHash('sha256').update('JENIOS_R71_CANONICAL_JSON_V1\0' + canonicalR71Json(value)).digest('hex');
export const copyR71 = value => JSON.parse(canonicalR71Json(value));
export const sameR71 = (a, b) => canonicalR71Json(a) === canonicalR71Json(b);
export const r71OperationId = (...parts) => 'op:' + digestR71Value(parts).slice(0, 32);

export function inspectR71Version(input) {
  const v = exact(input, ['versionId', 'activationGeneration', 'forwardPositionOpen'], 'R71_VERSION');
  if (typeof v.forwardPositionOpen !== 'boolean' || !integer(v.activationGeneration, 0, R71_LIMITS.revisions) ||
      v.versionId !== (v.forwardPositionOpen ? R71_POLICY.candidateVersionId : R71_POLICY.baselineVersionId)) fail('R71_VERSION');
  return freezeR71({ ...v });
}
export const r71ReferenceVersion = generation => inspectR71Version({ versionId: R71_POLICY.baselineVersionId,
  activationGeneration: generation, forwardPositionOpen: false });
export const r71CandidateVersion = generation => inspectR71Version({ versionId: R71_POLICY.candidateVersionId,
  activationGeneration: generation, forwardPositionOpen: true });
export function r71ExpectedRouting(scenario, positionOpen) {
  return R71_POLICY.allowedModes.includes(scenario.mode) && positionOpen === true && scenario.paused !== true
    ? 'MANAGE_EXISTING_POSITION' : 'UNCHANGED';
}
function definitions(planId) {
  const specs = [
    ['manual_open', 'manual', 'buy', 'day', false, true],
    ['manual_closed', 'manual', 'sell', 'day', false, false],
    ['hybrid_open', 'hybrid', 'buy', 'day', false, true],
    ['hybrid_closed', 'hybrid', 'buy', 'day', false, false],
    ['reverse_swing_open', 'reverse', 'buy', 'swing', false, true],
    ['reverse_swing_closed', 'reverse', 'sell', 'swing', false, false],
    ['hybrid_paused_open', 'hybrid', 'buy', 'day', true, true],
    ['reverse_day_open', 'reverse', 'buy', 'day', false, true],
  ];
  return specs.map(([name, mode, intent, horizon, paused, positionOpen], index) => {
    const scenario = { id: 'r71_' + name, mode, intent, horizon, paused };
    return { caseId: 'case:' + digestR71Value([planId, index]).slice(0, 16), scenario, positionOpen,
      expectedRouting: r71ExpectedRouting(scenario, positionOpen) };
  });
}
export function inspectR71Plan(input) {
  const p = exact(copyR71(input), ['schema', 'planId', 'snapshotId', 'studyDigest', 'registeredAtMs',
    'startsAtMs', 'endsAtMs', 'baselineVersion', 'candidateVersion', 'caseDefinitions'], 'R71_PLAN');
  if (p.schema !== 'JENIOS_R71_EVALUATION_PLAN_V1' || !PLAN.test(p.planId || '') ||
      !UUID.test(p.snapshotId || '') || !SHA.test(p.studyDigest || '') || !integer(p.registeredAtMs, 1) ||
      !integer(p.startsAtMs) || !integer(p.endsAtMs) ||
      p.startsAtMs - p.registeredAtMs !== R71_POLICY.validationStartDelayMs ||
      p.endsAtMs - p.startsAtMs !== R71_POLICY.validationWindowMs) fail('R71_PLAN');
  const baseline = inspectR71Version(p.baselineVersion), candidate = inspectR71Version(p.candidateVersion);
  if (baseline.forwardPositionOpen || !candidate.forwardPositionOpen ||
      candidate.activationGeneration !== baseline.activationGeneration + 1 ||
      !sameR71(p.caseDefinitions, definitions(p.planId))) fail('R71_PLAN');
  return freezeR71(p);
}
export function createR71Plan(input) {
  const a = exact(input, ['snapshotId', 'studyDigest', 'activeVersion', 'nowMs'], 'R71_PLAN_CONFIG');
  const version = inspectR71Version(a.activeVersion);
  const planId = 'plan:' + digestR71Value([a.snapshotId, a.studyDigest, version, a.nowMs]).slice(0, 16);
  return inspectR71Plan({ schema: 'JENIOS_R71_EVALUATION_PLAN_V1', planId,
    snapshotId: a.snapshotId, studyDigest: a.studyDigest, registeredAtMs: a.nowMs,
    startsAtMs: a.nowMs + R71_POLICY.validationStartDelayMs,
    endsAtMs: a.nowMs + R71_POLICY.validationStartDelayMs + R71_POLICY.validationWindowMs,
    baselineVersion: version, candidateVersion: r71CandidateVersion(version.activationGeneration + 1),
    caseDefinitions: definitions(planId) });
}
export function inspectR71RuntimeView(input) {
  const v = exact(copyR71(input), ['schema', 'scopeId', 'sourceId', 'sourceKeySha256', 'revision',
    'stateDigest', 'activeVersion', 'pendingEvaluation'], 'R71_RUNTIME_VIEW');
  if (v.schema !== 'JENIOS_R71_RUNTIME_VIEW_V1' || !id(v.scopeId, 'scope') || !id(v.sourceId, 'source') ||
      !SHA.test(v.sourceKeySha256 || '') || !SHA.test(v.stateDigest || '') ||
      !integer(v.revision, 0, R71_LIMITS.revisions - 1)) fail('R71_RUNTIME_VIEW');
  v.activeVersion = inspectR71Version(v.activeVersion);
  if (v.pendingEvaluation !== null) {
    v.pendingEvaluation = inspectR71Plan(v.pendingEvaluation);
    if (!sameR71(v.pendingEvaluation.baselineVersion, v.activeVersion)) fail('R71_RUNTIME_VIEW');
  }
  return freezeR71(v);
}
