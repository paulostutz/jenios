/** PUBLIC PROTOCOL FIXTURE: signed modeled claims, never original private execution.
 * No loader handle is created, forged or substituted. Private acceptance uses
 * the pinned loader and actual source instead of this helper.
 */
import { createR67ProtocolFixture } from './r67-private-protocol-fixture.mjs';
import { r67SourceKeyDigest, verifyR67PrivateObservationRecord } from '../../lib/platform/research/robot-r67-private-protocol.mjs';
import { digestR71Value, inspectR71RuntimeView, r71ReferenceVersion, r71ExpectedRouting } from '../../lib/platform/research/robot-r71-policy.mjs';
import { createR71PrivateObservationRecord, verifyR71PrivateObservationRecord } from '../../lib/platform/research/robot-r71-private-protocol.mjs';

export const R71_PROTOCOL_FIXTURE_KIND = 'PUBLIC_PROTOCOL_FIXTURE_NO_PRIVATE_EXECUTION';
export const R71_FIXTURE_SCENARIOS = Object.freeze([
  { id: 'r71_manual_open', mode: 'manual', intent: 'buy', horizon: 'day', paused: false },
  { id: 'r71_manual_closed', mode: 'manual', intent: 'sell', horizon: 'day', paused: false },
  { id: 'r71_hybrid_open', mode: 'hybrid', intent: 'buy', horizon: 'day', paused: false },
  { id: 'r71_hybrid_closed', mode: 'hybrid', intent: 'buy', horizon: 'day', paused: false },
  { id: 'r71_reverse_swing_open', mode: 'reverse', intent: 'buy', horizon: 'swing', paused: false },
  { id: 'r71_reverse_swing_closed', mode: 'reverse', intent: 'sell', horizon: 'swing', paused: false },
  { id: 'r71_hybrid_paused_open', mode: 'hybrid', intent: 'buy', horizon: 'day', paused: true },
  { id: 'r71_reverse_day_open', mode: 'reverse', intent: 'buy', horizon: 'day', paused: false },
].map(Object.freeze));
export const R71_FIXTURE_POSITION_CONTEXTS = Object.freeze(R71_FIXTURE_SCENARIOS.map(s =>
  Object.freeze({ scenarioId: s.id, positionOpen: !s.id.endsWith('_closed') })));

export async function createR71ProtocolFixture({ nowMs = Date.now(), scopeId = 'scope:' + '71'.repeat(8),
  sourceId = 'source:' + '71'.repeat(8), sessionId = 'session:' + '71'.repeat(8),
  operationId = 'op:' + '71'.repeat(16), sequence = 1, privateKeyPem,
  scenarios, positionContexts, runtimeView, purpose = 'OBSERVATION', planId = null } = {}) {
  if (!['OBSERVATION', 'VALIDATION'].includes(purpose)) throw Error('R71_FIXTURE_PURPOSE');
  const plan = runtimeView?.pendingEvaluation;
  const selectedScenarios = scenarios ?? (purpose === 'VALIDATION' ? plan?.caseDefinitions.map(c => c.scenario) : R71_FIXTURE_SCENARIOS);
  const selectedContexts = positionContexts ?? (purpose === 'VALIDATION'
    ? plan?.caseDefinitions.map(c => ({ scenarioId: c.scenario.id, positionOpen: c.positionOpen }))
    : R71_FIXTURE_POSITION_CONTEXTS);
  if (!Array.isArray(selectedScenarios) || !Array.isArray(selectedContexts) || selectedContexts.length !== selectedScenarios.length)
    throw Error('R71_FIXTURE_CONTEXT');
  const native = await createR67ProtocolFixture({ nowMs, scopeId, sourceId, sessionId, operationId,
    sequence, privateKeyPem, scenarios: selectedScenarios });
  const sourceKeySha256 = r67SourceKeyDigest(native.trustedSource);
  const view = inspectR71RuntimeView(runtimeView ?? { schema: 'JENIOS_R71_RUNTIME_VIEW_V1', scopeId, sourceId,
    sourceKeySha256, revision: 0, stateDigest: '71'.repeat(32), activeVersion: r71ReferenceVersion(0), pendingEvaluation: null });
  const original = verifyR67PrivateObservationRecord(native.record, { trustedSource: native.trustedSource, nowMs });
  const version = purpose === 'VALIDATION' ? plan?.candidateVersion : view.activeVersion;
  if (!version || (purpose === 'VALIDATION' && planId !== null && planId !== plan.planId)) throw Error('R71_FIXTURE_PLAN');
  const p = native.record.envelope.payload;
  const entries = p.capture.entries.map((entry, index) => {
    const scenario = selectedScenarios[index], context = selectedContexts[index];
    if (context.scenarioId !== scenario.id || typeof context.positionOpen !== 'boolean') throw Error('R71_FIXTURE_CONTEXT');
    const nativeDecision = { action: entry.action, side: entry.suggestedSide, mayClose: true };
    const effectiveDecision = version.forwardPositionOpen && r71ExpectedRouting(scenario, context.positionOpen) === 'MANAGE_EXISTING_POSITION'
      ? { action: 'manage_existing_position', side: null, mayClose: true } : { ...nativeDecision };
    const definition = purpose === 'VALIDATION' ? plan.caseDefinitions.find(c => c.scenario.id === scenario.id) : null;
    if (purpose === 'VALIDATION' && !definition) throw Error('R71_FIXTURE_PLAN');
    return { scenarioId: scenario.id, positionOpen: context.positionOpen, caseId: definition?.caseId ?? null,
      nativeDecision, effectiveDecision, nativeDecisionDigest: digestR71Value(nativeDecision),
      effectiveDecisionDigest: digestR71Value(effectiveDecision), nativeRawOutputSha256: entry.rawOutputSha256 };
  });
  const annotation = { schema: 'JENIOS_R71_PRIVATE_POLICY_ANNOTATION_V1', recordDigest: original.receipt.recordDigest,
    purpose, planId: purpose === 'VALIDATION' ? plan.planId : null, scopeId, sourceId, sessionId,
    eventId: p.eventId, sequence, capturedAtMs: nowMs, expiresAtMs: p.expiresAtMs,
    stateRevision: view.revision, stateDigest: view.stateDigest, wrapperVersion: version, entries,
    policyKind: 'HONOR_EXISTING_POSITION_CONTEXT_FOR_ASSISTED',
    runtimeEvidenceKind: 'ORIGINAL_PRIVATE_CORE_WITH_VERSIONED_EXTERNAL_RUNTIME_POLICY_SYNTHETIC_QA', internalCoreRetuning: false };
  const record = createR71PrivateObservationRecord({ originalRecord: native.record, annotation, privateKeyPem: native.privateKeyPem });
  const checked = verifyR71PrivateObservationRecord(record, { trustedSource: native.trustedSource, nowMs });
  return { ...checked, trustedSource: native.trustedSource, privateKeyPem: native.privateKeyPem,
    scenarios: selectedScenarios, positionContexts: selectedContexts, runtimeView: view,
    fixtureEvidence: R71_PROTOCOL_FIXTURE_KIND };
}
