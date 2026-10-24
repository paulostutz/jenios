/**
 * R65 — opt-in emitter from the existing SYNTHETIC R61 runtime.
 *
 * The source executes the certified adapters; it never signs a caller-supplied
 * decision. Scope/source/session, signing key, sequence, active-state reader and
 * clocks are pinned by its server-side factory. No network or storage is used.
 * R64 envelopes remain SIGNED_QA_REPLAY. A separately signed sidecar preserves
 * R61_SYNTHETIC_RUNTIME / SYNTHETIC_FIXTURE origin and the activation generation;
 * it is not independent attestation of an executable, customer or broker.
 *
 * captureAssisted({operationId,input}) and captureUltra({operationId,event}) are
 * synchronous. operationId is op:32hex. Identical retries return the SAME frozen
 * record before reading state/clocks; conflicting reuse is rejected. This cache
 * is process-local, not a durable outbox. A host must retain the exact signed
 * record for retries across restarts, or allocate a new pinned session. Explicit
 * initialSequence does not restore prior operation IDs or a previous runtime.
 *
 * getOccurrenceTimeMs({capturedAtMs,sequence,operationId}) defaults to captured
 * time. A separately pinned synthetic replay clock is labelled as such and must
 * obey R64's 24-hour window. No capture caller can select either clock.
 */
import { createHash, createPrivateKey, createPublicKey, sign, verify } from 'node:crypto';
import { evaluateR61AssistedAcceptance } from './robot-r61-assisted-acceptance.mjs';
import { createR65ActiveRuntime, inspectR65ActiveRuntime, stepR65ActiveRuntime } from './robot-r65-active-runtime.mjs';
import { inspectR65EvolutionState } from './robot-r65-evolution-engine.mjs';
import { R64_TELEMETRY_DOMAIN, R64_TELEMETRY_LIMITS, canonicalR64Json,
  canonicalR64TelemetryPayload, digestR64Value, verifyR64TelemetryEnvelope,
  inspectR64TelemetryReceipt } from './robot-r64-telemetry.mjs';

export const R65_PROVENANCE_DOMAIN = 'JENIOS_R65_SYNTHETIC_RUNTIME_PROVENANCE_V1\0';
export const R65_OBSERVATION_SOURCE_LIMITS = Object.freeze({ maxCachedOperations: 5000,
  maxSequence: 1000000000, envelopeLifetimeMs: R64_TELEMETRY_LIMITS.maxEnvelopeAgeMs });

/** Existing external extension point, deliberately NOT connected by this module.
 * B297's analyzeRequest callback also needs independently verified executable
 * identity and separately authorized source activation before operational use.
 * Merely supplying a callback, key, consent object or OPERATIONAL label does not
 * satisfy those conditions. This R65 source has no operational activation path.
 */
export const R65_EXTERNAL_ANALYZE_REQUEST_CONTRACT = Object.freeze({
  schema: 'JENIOS_R65_EXTERNAL_ANALYZE_REQUEST_CONTRACT_V1', hook: 'analyzeRequest',
  reference: 'captureB297OriginalDecisions', status: 'PREPARED_INACTIVE',
  originalExecutableIdentityVerified: false, operationalSourceActivated: false,
  customerMonitoringActive: false, externalConnectionCertified: false,
  executionAllowed: false, realOrdersSent: 0, externalPaperOrdersSent: 0,
});

const SOURCE_DOMAIN = 'R61_SYNTHETIC_RUNTIME';
const RECORD_SCHEMA = 'JENIOS_R65_QA_OBSERVATION_V1';
const PROVENANCE_SCHEMA = 'JENIOS_R65_RUNTIME_PROVENANCE_V1';
const SHA = /^[a-f0-9]{64}$/;
const OP = /^op:[a-f0-9]{32}$/;
const POLICY = /^research:r65-v[1-9][0-9]{0,5}$/;
const SOURCE_KEYS = ['enabled', 'domain', 'scopeId', 'sourceId', 'sessionId', 'privateKeyPem',
  'getActiveState', 'ultraConfig', 'initialSequence', 'now', 'getOccurrenceTimeMs'];
const PROVENANCE_KEYS = ['schema', 'origin', 'runtimeEvidenceKind', 'transportEvidenceKind',
  'eventId', 'payloadDigest', 'inputDigest', 'policyVersion', 'activationGeneration', 'robot',
  'runtimeHook', 'controlEvent', 'clockSource', 'marketAgeOrigin', 'automaticPromotionAllowed',
  'executionAllowed', 'customerMonitoringActive', 'realOrdersSent', 'externalPaperOrdersSent',
  'actualBrokerPnl', 'actualLossesAvoided', 'realTradeAccuracy', 'independentBrokerAttestation',
  'independentCustomerConsentVerified'];
const fail = code => { throw Object.assign(new Error(code), { name: 'ValidationError', code }); };
const integer = value => Number.isSafeInteger(value) && value >= 0;
const identifier = (value, prefix) => typeof value === 'string' &&
  new RegExp('^' + prefix + ':[a-f0-9]{16}$').test(value);
const sha = value => createHash('sha256').update(value).digest('hex');
const freeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze); Object.freeze(value);
  }
  return value;
};
function record(value, allowed, required, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail(code);
  const descriptors = Object.getOwnPropertyDescriptors(value), keys = Reflect.ownKeys(descriptors);
  if (keys.some(key => typeof key !== 'string' || !allowed.includes(key) ||
      !descriptors[key].enumerable || !Object.hasOwn(descriptors[key], 'value')) ||
      required.some(key => !Object.hasOwn(descriptors, key))) fail(code);
  return Object.fromEntries(keys.map(key => [key, descriptors[key].value]));
}
const exact = (value, keys, code) => record(value, keys, keys, code);
const copy = value => JSON.parse(canonicalR64Json(value));
const invariants = () => ({ automaticPromotionAllowed: false, executionAllowed: false,
  customerMonitoringActive: false, realOrdersSent: 0, externalPaperOrdersSent: 0,
  actualBrokerPnl: null, actualLossesAvoided: null, realTradeAccuracy: null,
  independentBrokerAttestation: false, independentCustomerConsentVerified: false });

/** A projected evaluation is freshly computed from R61 inputs, never imported. */
export function projectR65AssistedObservation(input) {
  const result = evaluateR61AssistedAcceptance(copy(input));
  const decisions = { MANUAL_CONTROL: 'KEEP', ADVISE_REVIEW: 'ADVISE',
    KEEP_OPERATOR_DECISION: 'KEEP', REVERSE_REFERENCE: 'ADVISE' };
  const decision = decisions[result.action];
  if (!decision || result.source !== 'synthetic_fixture' ||
      result.provenance.kind !== 'SYNTHETIC_FIXTURE' || result.executed !== false ||
      result.operatorRetainsControl !== true || result.realOrdersSent !== 0 ||
      result.externalPaperOrdersSent !== 0) fail('R65_SOURCE_UNSUPPORTED_ASSISTED_RESULT');
  return freeze({ robot: result.mode, kind: 'decision', decision, issue: 'NONE', marketAgeMs: 0,
    runtimeHook: 'R61_ASSISTED_ACCEPTANCE', controlEvent: 'assisted_evaluation',
    marketAgeOrigin: 'NO_MARKET_OBSERVATION' });
}

/** Inspect replays the active wrapper; a fabricated result cannot be projected. */
export function projectR65UltraObservation(input) {
  const runtime = inspectR65ActiveRuntime(input);
  const last = runtime.events.at(-1);
  const type = last?.type;
  if (!['snapshot', 'pause', 'resume'].includes(type) ||
      !['ALLOW', 'BLOCK'].includes(runtime.decision) ||
      runtime.runtimeEvidenceKind !== 'SYNTHETIC_FIXTURE' ||
      runtime.observationEvidenceKind !== 'SIGNED_QA_REPLAY') fail('R65_SOURCE_UNSUPPORTED_ULTRA_RESULT');
  // R64 has no control-event kind. Preserve the exact control event in the
  // sidecar and emit only the resulting decision; legitimate pause != incident.
  const isControl = type !== 'snapshot';
  if (isControl && (runtime.issue !== 'NONE' || runtime.decision !== 'BLOCK'))
    fail('R65_SOURCE_INVALID_CONTROL_PROJECTION');
  return freeze({ robot: 'ultrafast', kind: runtime.issue === 'NONE' ? 'decision' : 'incident',
    decision: runtime.decision, issue: runtime.issue, marketAgeMs: isControl ? 0 : runtime.marketAgeMs,
    runtimeHook: 'R65_ACTIVE_RUNTIME_R61_AND_R47', controlEvent: type,
    marketAgeOrigin: isControl ? 'NO_MARKET_OBSERVATION' : 'SYNTHETIC_INPUT',
    policyVersion: runtime.policyVersion, activationGeneration: runtime.activationGeneration });
}

function provenanceRecord(input, receipt) {
  const p = exact(input, PROVENANCE_KEYS, 'R65_PROVENANCE_SCHEMA');
  if (p.schema !== PROVENANCE_SCHEMA || p.origin !== SOURCE_DOMAIN ||
      p.runtimeEvidenceKind !== 'SYNTHETIC_FIXTURE' || p.transportEvidenceKind !== 'SIGNED_QA_REPLAY' ||
      p.eventId !== receipt.eventId || p.payloadDigest !== receipt.payloadDigest ||
      !SHA.test(p.inputDigest || '') || !POLICY.test(p.policyVersion || '') ||
      p.policyVersion !== receipt.event.policyVersion || p.robot !== receipt.event.robot ||
      !integer(p.activationGeneration) ||
      !['WALL_CLOCK_QA_EXECUTION', 'PINNED_QA_REPLAY_CLOCK'].includes(p.clockSource) ||
      (p.clockSource === 'WALL_CLOCK_QA_EXECUTION') !==
        (receipt.event.occurredAtMs === receipt.event.capturedAtMs)) fail('R65_PROVENANCE_VALUE');
  if (p.robot === 'ultrafast') {
    if (p.runtimeHook !== 'R65_ACTIVE_RUNTIME_R61_AND_R47' ||
        !['snapshot', 'pause', 'resume'].includes(p.controlEvent) ||
        p.marketAgeOrigin !== (p.controlEvent === 'snapshot' ? 'SYNTHETIC_INPUT' : 'NO_MARKET_OBSERVATION'))
      fail('R65_PROVENANCE_RUNTIME');
    if (p.controlEvent !== 'snapshot' && (receipt.event.issue !== 'NONE' ||
        receipt.event.kind !== 'decision' || receipt.event.decision !== 'BLOCK' || receipt.event.marketAgeMs !== 0))
      fail('R65_PROVENANCE_CONTROL');
  } else if (p.runtimeHook !== 'R61_ASSISTED_ACCEPTANCE' || p.controlEvent !== 'assisted_evaluation' ||
      p.marketAgeOrigin !== 'NO_MARKET_OBSERVATION' || receipt.event.marketAgeMs !== 0 ||
      receipt.event.kind !== 'decision' || receipt.event.issue !== 'NONE' ||
      !['KEEP', 'ADVISE'].includes(receipt.event.decision) ||
      (p.robot === 'manual' && receipt.event.decision !== 'KEEP')) fail('R65_PROVENANCE_RUNTIME');
  for (const [key, value] of Object.entries(invariants())) if (p[key] !== value)
    fail('R65_PROVENANCE_UNSUPPORTED_CLAIM');
  return p;
}

/** Historical trusted-store validation only: checks structure and receipt
 * binding without rechecking a signature, expiry, host or executable identity.
 * HTTP intake must first use verifyR65ObservationRecord on the signed record.
 */
export function inspectR65StoredProvenance(input, receipt) {
  return freeze(provenanceRecord(copy(input), inspectR64TelemetryReceipt(receipt)));
}

/** Intake-time verification. Expired records are not re-signed by this helper.
 * The sidecar proves a configured source's statement of synthetic execution;
 * it does not independently attest its host, executable or any external data.
 */
export function verifyR65ObservationRecord(input, options) {
  const r = exact(input, ['schema', 'envelope', 'provenance', 'provenanceSignatureBase64'], 'R65_OBSERVATION_RECORD');
  if (r.schema !== RECORD_SCHEMA) fail('R65_OBSERVATION_RECORD');
  const context = exact(options, ['trustedSource', 'nowMs'], 'R65_OBSERVATION_CONTEXT');
  const receipt = verifyR64TelemetryEnvelope(r.envelope, context);
  const p = provenanceRecord(r.provenance, receipt);
  if (typeof r.provenanceSignatureBase64 !== 'string' ||
      !/^(?:[A-Za-z0-9+/]{4}){21}[A-Za-z0-9+/]{2}==$/.test(r.provenanceSignatureBase64))
    fail('R65_PROVENANCE_SIGNATURE');
  const signature = Buffer.from(r.provenanceSignatureBase64, 'base64');
  if (signature.length !== 64 || signature.toString('base64') !== r.provenanceSignatureBase64 ||
      !verify(null, Buffer.from(R65_PROVENANCE_DOMAIN + canonicalR64Json(p)),
        createPublicKey(context.trustedSource.publicKeyPem), signature)) fail('R65_PROVENANCE_SIGNATURE');
  return freeze({ schema: 'JENIOS_R65_VERIFIED_QA_OBSERVATION_V1', receipt, provenance: p,
    configuredRuntimeProvenanceSignatureVerified: true, independentRuntimeAttestation: false });
}

/** Operational callbacks are deliberately never inspected, invoked or loaded. */
export function createR65ExternalObservationSource() { fail('R65_OPERATIONAL_SOURCE_INACTIVE'); }

export function createR65ObservationSource(input = {}) {
  const c = record(input, SOURCE_KEYS, [], 'R65_SOURCE_CONFIG');
  if (c.enabled !== true) fail('R65_SOURCE_DISABLED');
  if (c.domain !== SOURCE_DOMAIN) fail('R65_OPERATIONAL_SOURCE_INACTIVE');
  if (!identifier(c.scopeId, 'scope') || !identifier(c.sourceId, 'source') ||
      !identifier(c.sessionId, 'session') || !Number.isSafeInteger(c.initialSequence) ||
      c.initialSequence < 1 || c.initialSequence > R65_OBSERVATION_SOURCE_LIMITS.maxSequence ||
      typeof c.getActiveState !== 'function' || (c.now !== undefined && typeof c.now !== 'function') ||
      (c.getOccurrenceTimeMs !== undefined && typeof c.getOccurrenceTimeMs !== 'function'))
    fail('R65_SOURCE_CONFIG');
  if (typeof c.privateKeyPem !== 'string' || c.privateKeyPem.length > 4096)
    fail('R65_SOURCE_SIGNING_KEY');
  let privateKey;
  try { privateKey = createPrivateKey(c.privateKeyPem); } catch { fail('R65_SOURCE_SIGNING_KEY'); }
  if (privateKey.asymmetricKeyType !== 'ed25519') fail('R65_SOURCE_SIGNING_KEY');
  const publicKeyPem = createPublicKey(privateKey).export({ format: 'pem', type: 'spki' });
  const trustedSource = freeze({ scopeId: c.scopeId, sourceId: c.sourceId, publicKeyPem,
    enabled: true, evidenceKind: 'SIGNED_QA_REPLAY' });
  let latestGeneration = -1, latestPolicyVersion = null, latestState = null;
  function activeState() {
    const state = inspectR65EvolutionState(c.getActiveState());
    if (state.scopeId !== c.scopeId) fail('R65_SOURCE_STATE_SCOPE');
    if (latestState && (state.createdAtMs !== latestState.createdAtMs || state.revision < latestState.revision ||
        JSON.stringify(state.journal.slice(0, latestState.revision)) !== JSON.stringify(latestState.journal)))
      fail('R65_SOURCE_STATE_CONTINUITY');
    if (!POLICY.test(state.activeVersion.versionId) ||
        state.activeVersion.activationGeneration < latestGeneration ||
        (state.activeVersion.activationGeneration === latestGeneration && latestPolicyVersion !== null &&
          state.activeVersion.versionId !== latestPolicyVersion)) fail('R65_SOURCE_STATE_REGRESSION');
    return state;
  }
  const initialState = activeState(), ultraConfig = copy(c.ultraConfig);
  if (!ultraConfig || typeof ultraConfig !== 'object' || ultraConfig.sessionId !== c.sessionId)
    fail('R65_SOURCE_SESSION_PIN');
  let runtime = createR65ActiveRuntime({ state: initialState, config: ultraConfig });
  latestGeneration = initialState.activeVersion.activationGeneration;
  latestPolicyVersion = initialState.activeVersion.versionId;
  latestState = initialState;
  let sequence = c.initialSequence, lastCapturedAtMs = -1, lastOccurredAtMs = -1;
  const now = c.now ?? Date.now;
  const occurrenceTime = c.getOccurrenceTimeMs ?? (({ capturedAtMs }) => capturedAtMs);
  const cache = new Map();

  function capture(kind, raw) {
    const field = kind === 'assisted' ? 'input' : 'event';
    const command = exact(copy(raw), ['operationId', field], 'R65_SOURCE_COMMAND');
    if (typeof command.operationId !== 'string' || !OP.test(command.operationId)) fail('R65_SOURCE_OPERATION_ID');
    const inputDigest = digestR64Value({ kind, [field]: command[field] });
    const previous = cache.get(command.operationId);
    if (previous) {
      if (previous.inputDigest !== inputDigest) fail('R65_SOURCE_OPERATION_CONFLICT');
      return previous.record;
    }
    if (cache.size >= R65_OBSERVATION_SOURCE_LIMITS.maxCachedOperations) fail('R65_SOURCE_CACHE_LIMIT');
    if (sequence > R65_OBSERVATION_SOURCE_LIMITS.maxSequence) fail('R65_SOURCE_SEQUENCE_LIMIT');
    const state = activeState(), capturedAtMs = now();
    const occurredAtMs = occurrenceTime(freeze({ capturedAtMs, sequence, operationId: command.operationId }));
    if (!integer(capturedAtMs) || capturedAtMs < state.updatedAtMs || !integer(occurredAtMs) || occurredAtMs > capturedAtMs ||
        capturedAtMs - occurredAtMs > R64_TELEMETRY_LIMITS.maxReplayAgeMs ||
        capturedAtMs < lastCapturedAtMs || occurredAtMs < lastOccurredAtMs ||
        !Number.isSafeInteger(capturedAtMs + R65_OBSERVATION_SOURCE_LIMITS.envelopeLifetimeMs))
      fail('R65_SOURCE_CLOCK');
    let nextRuntime = runtime;
    const projection = kind === 'assisted' ? projectR65AssistedObservation(command.input) : (() => {
      nextRuntime = stepR65ActiveRuntime({ runtime, state, event: command.event });
      return projectR65UltraObservation(nextRuntime);
    })();
    const policyVersion = state.activeVersion.versionId;
    const activationGeneration = state.activeVersion.activationGeneration;
    if (kind === 'ultra' && (projection.policyVersion !== policyVersion ||
        projection.activationGeneration !== activationGeneration)) fail('R65_SOURCE_RUNTIME_VERSION');
    const eventId = 'evt:' + sha('JENIOS_R65_SOURCE_EVENT_V1\0' + canonicalR64Json({
      scopeId: c.scopeId, sourceId: c.sourceId, sessionId: c.sessionId, sequence,
      operationId: command.operationId })).slice(0, 16);
    const payload = { schema: 'JENIOS_R64_SIGNED_QA_TELEMETRY_V1', evidenceKind: 'SIGNED_QA_REPLAY',
      scopeId: c.scopeId, sourceId: c.sourceId, sessionId: c.sessionId, eventId, sequence,
      expiresAtMs: capturedAtMs + R65_OBSERVATION_SOURCE_LIMITS.envelopeLifetimeMs,
      event: { policyVersion, robot: projection.robot, kind: projection.kind, decision: projection.decision,
        issue: projection.issue, marketAgeMs: projection.marketAgeMs, occurredAtMs, capturedAtMs } };
    const message = R64_TELEMETRY_DOMAIN + canonicalR64TelemetryPayload(payload);
    const envelope = { payload, signatureBase64: sign(null, Buffer.from(message), privateKey).toString('base64') };
    const provenance = { schema: PROVENANCE_SCHEMA, origin: SOURCE_DOMAIN,
      runtimeEvidenceKind: 'SYNTHETIC_FIXTURE', transportEvidenceKind: 'SIGNED_QA_REPLAY',
      eventId, payloadDigest: sha(message), inputDigest, policyVersion, activationGeneration,
      robot: projection.robot, runtimeHook: projection.runtimeHook, controlEvent: projection.controlEvent,
      clockSource: occurredAtMs === capturedAtMs ? 'WALL_CLOCK_QA_EXECUTION' : 'PINNED_QA_REPLAY_CLOCK',
      marketAgeOrigin: projection.marketAgeOrigin, ...invariants() };
    const result = freeze({ schema: RECORD_SCHEMA, envelope, provenance,
      provenanceSignatureBase64: sign(null,
        Buffer.from(R65_PROVENANCE_DOMAIN + canonicalR64Json(provenance)), privateKey).toString('base64') });
    // Commit local progress only after the complete record validates. Signing,
    // projection or clock failure cannot consume a sequence or advance runtime.
    verifyR65ObservationRecord(result, { trustedSource, nowMs: capturedAtMs });
    runtime = nextRuntime; latestGeneration = activationGeneration; latestPolicyVersion = policyVersion; latestState = state;
    lastCapturedAtMs = capturedAtMs; lastOccurredAtMs = occurredAtMs; sequence++;
    cache.set(command.operationId, { inputDigest, record: result });
    return result;
  }

  return Object.freeze({ trustedSource,
    captureAssisted: command => capture('assisted', command),
    captureUltra: command => capture('ultra', command),
    inspect: () => freeze({ schema: 'JENIOS_R65_OBSERVATION_SOURCE_STATE_V1', domain: SOURCE_DOMAIN,
      scopeId: c.scopeId, sourceId: c.sourceId, sessionId: c.sessionId,
      nextSequence: sequence, cachedOperations: cache.size, policyVersion: latestPolicyVersion,
      activationGeneration: latestGeneration, ultraEventCount: runtime.session.eventCount,
      ultraStatus: runtime.session.status, durableOutbox: false, ...invariants() }),
  });
}
