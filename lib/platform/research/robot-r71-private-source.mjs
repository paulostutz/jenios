/** Branded original execution with a separately versioned external QA policy.
 * Commands contain synthetic scenarios/position context only. The active policy
 * is read from the trusted host's state dependency, never selected by commands.
 */
import { createPrivateKey, createPublicKey, sign } from 'node:crypto';
import { inspectR67VerifiedPrivateCore, captureR71VerifiedPrivateBatch } from './robot-r67-private-core-loader.mjs';
import { R67_EVIDENCE, R67_BINDING, R67_LIMITS, R67_PAYLOAD_DOMAIN, R67_PROVENANCE_DOMAIN,
  canonicalR67Json, inspectR67Scenarios, inspectR67TrustedSource, r67SourceKeyDigest, r67EventId,
  r67RecordDigest, r67ProvenanceForPayload } from './robot-r67-private-protocol.mjs';
import { R71_POLICY, R71_BOUNDARIES, fieldsR71, freezeR71, canonicalR71Json,
  inspectR71RuntimeView } from './robot-r71-policy.mjs';
import { R71_RUNTIME_ORIGIN, inspectR71PositionContexts, r71CaptureInputDigest,
  createR71PrivateObservationRecord, verifyR71PrivateObservationRecord } from './robot-r71-private-protocol.mjs';

const fail = code => { throw Object.assign(new Error(code), { name: 'ValidationError', code }); };
const integer = value => Number.isSafeInteger(value) && value >= 0;
const same = (a, b) => canonicalR71Json(a) === canonicalR71Json(b);
const OP = /^op:[a-f0-9]{32}$/, PLAN = /^plan:[a-f0-9]{16}$/;
export function checkR71RuntimeContinuity(previous, input, trustedSource) {
  const view = inspectR71RuntimeView(input), source = inspectR67TrustedSource(trustedSource);
  if (view.scopeId !== source.scopeId || view.sourceId !== source.sourceId ||
      view.sourceKeySha256 !== r67SourceKeyDigest(source)) fail('R71_SOURCE_STATE_IDENTITY');
  if (previous !== null && previous !== undefined) {
    const prior = inspectR71RuntimeView(previous);
    if (prior.scopeId !== view.scopeId || prior.sourceId !== view.sourceId || prior.sourceKeySha256 !== view.sourceKeySha256 ||
        view.revision < prior.revision || view.activeVersion.activationGeneration < prior.activeVersion.activationGeneration ||
        (view.revision === prior.revision && !same(view, prior)) ||
        (view.activeVersion.activationGeneration === prior.activeVersion.activationGeneration &&
          !same(view.activeVersion, prior.activeVersion))) fail('R71_SOURCE_STATE_REGRESSION');
  }
  return view;
}
export function createR71PrivateCoreSource(input) {
  const keys = ['enabled', 'handle', 'scopeId', 'sourceId', 'sessionId', 'privateKeyPem', 'getActiveState', 'now'];
  const c = fieldsR71(input, keys, keys.filter(k => k !== 'now'), 'R71_SOURCE_CONFIG');
  if (c.enabled !== true) fail('R71_SOURCE_DISABLED');
  const core = inspectR67VerifiedPrivateCore(c.handle);
  if (!/^session:[a-f0-9]{16}$/.test(c.sessionId || '') || typeof c.getActiveState !== 'function' ||
      (c.now !== undefined && typeof c.now !== 'function') || typeof c.privateKeyPem !== 'string' || c.privateKeyPem.length > 4096)
    fail('R71_SOURCE_CONFIG');
  let key;
  try { key = createPrivateKey(c.privateKeyPem); } catch { fail('R71_SOURCE_SIGNING_KEY'); }
  if (key.asymmetricKeyType !== 'ed25519') fail('R71_SOURCE_SIGNING_KEY');
  const trustedSource = inspectR67TrustedSource({ scopeId: c.scopeId, sourceId: c.sourceId, enabled: true,
    evidenceKind: R67_EVIDENCE, publicKeyPem: createPublicKey(key).export({ type: 'spki', format: 'pem' }) });
  const now = c.now ?? Date.now, cache = new Map();
  let sequence = 1, lastCapturedAtMs = -1, lastRuntimeView = null, busy = false, nativeAnalysesCompleted = 0;

  async function capture(purpose, raw) {
    const command = purpose === 'OBSERVATION'
      ? fieldsR71(raw, ['operationId', 'scenarios', 'positionContexts'], ['operationId', 'scenarios', 'positionContexts'], 'R71_SOURCE_COMMAND')
      : fieldsR71(raw, ['operationId', 'planId'], ['operationId', 'planId'], 'R71_SOURCE_COMMAND');
    if (!OP.test(command.operationId || '') || (purpose === 'VALIDATION' && !PLAN.test(command.planId || '')))
      fail('R71_SOURCE_OPERATION');
    let scenarios = purpose === 'OBSERVATION' ? inspectR67Scenarios(command.scenarios) : null;
    let positionContexts = purpose === 'OBSERVATION' ? inspectR71PositionContexts(command.positionContexts, scenarios) : null;
    const inputDigest = r71CaptureInputDigest(purpose === 'OBSERVATION' ? { purpose, scenarios, positionContexts } :
      { purpose, planId: command.planId });
    const previous = cache.get(command.operationId);
    if (previous) {
      if (previous.inputDigest !== inputDigest) fail('R71_SOURCE_OPERATION_CONFLICT');
      return previous.record;
    }
    if (busy) fail('R71_SOURCE_BUSY');
    if (cache.size >= 5000 || sequence > R67_LIMITS.maxSequence) fail('R71_SOURCE_LIMIT');
    busy = true;
    try {
      const view = checkR71RuntimeContinuity(lastRuntimeView, await c.getActiveState(), trustedSource);
      const capturedAtMs = now();
      if (!integer(capturedAtMs) || capturedAtMs < lastCapturedAtMs || !integer(capturedAtMs + R67_LIMITS.lifetimeMs))
        fail('R71_SOURCE_CLOCK');
      const plan = purpose === 'VALIDATION' ? view.pendingEvaluation : null;
      if (purpose === 'VALIDATION') {
        if (!plan || plan.planId !== command.planId) fail('R71_SOURCE_PENDING_PLAN');
        if (capturedAtMs < plan.startsAtMs || capturedAtMs >= plan.endsAtMs) fail('R71_VALIDATION_WINDOW');
        scenarios = plan.caseDefinitions.map(d => d.scenario);
        positionContexts = plan.caseDefinitions.map(d => ({ scenarioId: d.scenario.id, positionOpen: d.positionOpen }));
      }
      const wrapperVersion = plan ? plan.candidateVersion : view.activeVersion;
      const captured = await captureR71VerifiedPrivateBatch(c.handle, { scenarios, positionContexts,
        forwardPositionOpen: wrapperVersion.forwardPositionOpen, nowMs: capturedAtMs });
      nativeAnalysesCompleted += captured.nativeCapture.entries.length;
      const completedAtMs = now();
      if (!integer(completedAtMs) || completedAtMs < capturedAtMs) fail('R71_SOURCE_CLOCK');
      if (plan && completedAtMs >= plan.endsAtMs) fail('R71_VALIDATION_WINDOW');
      const payload = { schema: 'JENIOS_R67_SIGNED_PRIVATE_QA_TELEMETRY_V1', evidenceKind: R67_EVIDENCE,
        scopeId: c.scopeId, sourceId: c.sourceId, sessionId: c.sessionId,
        eventId: r67EventId({ scopeId: c.scopeId, sourceId: c.sourceId, sessionId: c.sessionId,
          sequence, operationId: command.operationId }), sequence, capturedAtMs,
        expiresAtMs: capturedAtMs + R67_LIMITS.lifetimeMs, scenarios, capture: captured.nativeCapture };
      const provenance = r67ProvenanceForPayload(payload, command.operationId);
      const originalRecord = { schema: 'JENIOS_R67_PRIVATE_QA_OBSERVATION_V1', envelope: { payload,
        signatureBase64: sign(null, Buffer.from(R67_PAYLOAD_DOMAIN + canonicalR67Json(payload)), key).toString('base64') },
        provenance, provenanceSignatureBase64: sign(null,
          Buffer.from(R67_PROVENANCE_DOMAIN + canonicalR67Json(provenance)), key).toString('base64') };
      const annotation = { schema: 'JENIOS_R71_PRIVATE_POLICY_ANNOTATION_V1', recordDigest: r67RecordDigest(originalRecord),
        purpose, planId: plan?.planId ?? null, scopeId: c.scopeId, sourceId: c.sourceId, sessionId: c.sessionId,
        eventId: payload.eventId, sequence, capturedAtMs, expiresAtMs: payload.expiresAtMs,
        stateRevision: view.revision, stateDigest: view.stateDigest, wrapperVersion,
        entries: captured.policyDecisions.map((decision, i) => ({ ...decision, caseId: plan?.caseDefinitions[i].caseId ?? null })),
        policyKind: R71_POLICY.kind, runtimeEvidenceKind: R71_RUNTIME_ORIGIN, internalCoreRetuning: false };
      const record = createR71PrivateObservationRecord({ originalRecord, annotation, privateKeyPem: c.privateKeyPem });
      verifyR71PrivateObservationRecord(record, { trustedSource, nowMs: now() });
      cache.set(command.operationId, { inputDigest, record });
      sequence++; lastCapturedAtMs = capturedAtMs; lastRuntimeView = view;
      return record;
    } finally { busy = false; }
  }
  function inspect() {
    return freezeR71({ schema: 'JENIOS_R71_PRIVATE_SOURCE_STATE_V1', scopeId: c.scopeId, sourceId: c.sourceId,
      sessionId: c.sessionId, nextSequence: sequence, cachedBatches: cache.size, busy,
      nativeAnalysesCompleted, coreBinding: R67_BINDING, core, lastRuntimeView,
      runtimeOrigin: R71_RUNTIME_ORIGIN, positionContextEvidence: 'SYNTHETIC_FIXTURE_ONLY', ...R71_BOUNDARIES });
  }
  return Object.freeze({ trustedSource, captureBatch: command => capture('OBSERVATION', command),
    captureValidation: command => capture('VALIDATION', command), inspect });
}
