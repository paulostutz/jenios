/**
 * R67 — a distinct, signed batch protocol for the pinned original private core.
 * Native B297 actions are retained. These records never enter the R64 study or
 * the R65 UltraFast policy. Signatures authenticate a configured source's claim;
 * they do not independently attest the source host or any customer/broker.
 */
import { createHash, createPublicKey, verify } from 'node:crypto';
import { canonicalR64Json } from './robot-r64-telemetry.mjs';
import { B297_ENGINE_SHA256, B297_SERVICE_SHA256, verifyB297CaptureChain } from './b297-private-readonly-audit.mjs';

export const R67_ORIGIN = 'ORIGINAL_PRIVATE_CORE_SYNTHETIC_RUNTIME';
export const R67_EVIDENCE = 'SIGNED_PRIVATE_QA_CAPTURE';
export const R67_RUNTIME_EVIDENCE = 'SYNTHETIC_PRIVATE_LAB_ONLY';
export const R67_PAYLOAD_DOMAIN = 'JENIOS_R67_SIGNED_PRIVATE_QA_TELEMETRY_V1\0';
export const R67_PROVENANCE_DOMAIN = 'JENIOS_R67_PRIVATE_RUNTIME_PROVENANCE_V1\0';
export const R67_LIMITS = Object.freeze({ maxBytes: 262144, maxScenarios: 60,
  lifetimeMs: 120000, maxSequence: 1000000000 });
export const R67_BINDING = Object.freeze({ engineSha256: B297_ENGINE_SHA256,
  serviceSha256: B297_SERVICE_SHA256, originalVersion: 'jenios-research-r29.1',
  policyVersion: 'private:r67-v1', generation: 0 });
export const R67_INVARIANTS = Object.freeze({ automaticPromotionAllowed: false,
  executionAllowed: false, customerMonitoringActive: false, privateOperationalSourceActive: false,
  realOrdersSent: 0, externalPaperOrdersSent: 0, paidProviderCalls: 0,
  actualBrokerPnl: null, actualLossesAvoided: null, realTradeAccuracy: null,
  commercialPerformanceCertified: false, independentRuntimeAttestation: false,
  independentBrokerAttestation: false, independentCustomerConsentVerified: false });
const fail = code => { throw Object.assign(new Error(code), { name: 'ValidationError', code }); };
const SHA = /^[a-f0-9]{64}$/;
const OP = /^op:[a-f0-9]{32}$/;
const ID = /^[A-Za-z0-9._-]{1,80}$/;
const MODES = ['manual', 'hybrid', 'reverse'];
const ACTION_BY_MODE = {
  manual: ['manual_preview', 'wait_for_context', 'pause_new_entries', 'manage_existing_position'],
  hybrid: ['hybrid_preview', 'wait_for_confluence', 'wait_for_context', 'pause_new_entries', 'manage_existing_position'],
  reverse: ['reverse_preview', 'reverse_not_calibrated', 'preserve_trend_aligned_intent',
    'suggest_trend_aligned_preview', 'wait_for_context', 'pause_new_entries', 'manage_existing_position'],
};
const NO_SIDE = ['wait_for_context', 'wait_for_confluence', 'reverse_not_calibrated',
  'pause_new_entries', 'manage_existing_position'];
const PAYLOAD_KEYS = ['schema', 'evidenceKind', 'scopeId', 'sourceId', 'sessionId', 'eventId',
  'sequence', 'capturedAtMs', 'expiresAtMs', 'scenarios', 'capture'];
const CAPTURE_KEYS = ['schema', 'source', 'counts', 'entries', 'finalEntrySha256', 'engineSha256Expected',
  'executableBytesVerifiedByAdapter', 'originalCallbackIdentityAttested', 'remoteDeliveryAcknowledged',
  'authorizedBrokerFeedObserved', 'readOnly', 'ordersSent', 'paperOrdersSent', 'executionEnabled',
  'profitCertified', 'lossesActuallyAvoided'];
// B297 hashes JSON.stringify of this insertion-ordered body, not sorted JSON.
// Reconstruct this known order before verifying its chain. Transport canonical
// JSON may sort object keys without changing the B297 data or native digest.
const ENTRY_BODY_KEYS = ['id', 'commercialMode', 'operatorIntent', 'horizon', 'decisionAtMs',
  'observedAtMs', 'action', 'suggestedSide', 'originalVersion', 'rawOutputSha256',
  'previousSha256', 'delivery', 'source'];
const PROVENANCE_KEYS = ['schema', 'origin', 'runtimeEvidenceKind', 'transportEvidenceKind',
  'eventId', 'operationId', 'payloadDigest', 'inputDigest', 'captureDigest',
  ...Object.keys(R67_BINDING), 'runtimeHook', 'clockSource', 'loaderEvidence',
  'localExecutableBytesVerified', ...Object.keys(R67_INVARIANTS)];
const RECEIPT_KEYS = ['schema', 'evidenceKind', 'runtimeOrigin', 'scopeId', 'sourceId', 'sessionId',
  'eventId', 'sequence', 'capturedAtMs', 'expiresAtMs', 'admittedAtMs', 'payloadDigest',
  'provenanceDigest', 'recordDigest', 'captureCount', 'counts', ...Object.keys(R67_BINDING), 'sourceKeySha256'];
const ACK_KEYS = ['schema', 'status', 'scopeId', 'sourceId', 'sessionId', 'eventId', 'sequence',
  'recordDigest', 'payloadDigest', 'captureCount', ...Object.keys(R67_BINDING),
  'evidenceKind', 'runtimeOrigin', ...Object.keys(R67_INVARIANTS)];
const integer = n => Number.isSafeInteger(n) && n >= 0;
const identifier = (v, prefix) => typeof v === 'string' && new RegExp(`^${prefix}:[a-f0-9]{16}$`).test(v);
const sha = text => createHash('sha256').update(text).digest('hex');
export const canonicalR67Json = canonicalR64Json;
export const digestR67Value = value => sha('JENIOS_R67_CANONICAL_JSON_V1\0' + canonicalR67Json(value));
export const r67PayloadDigest = payload => sha(R67_PAYLOAD_DOMAIN + canonicalR67Json(payload));
export const r67ProvenanceDigest = value => sha(R67_PROVENANCE_DOMAIN + canonicalR67Json(value));
export const r67RecordDigest = record => sha('JENIOS_R67_SIGNED_RECORD_V1\0' + canonicalR67Json(record));
export function freezeR67(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freezeR67); Object.freeze(value);
  }
  return value;
}
export function fieldsR67(input, allowed, required, code) {
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(input))) fail(code);
  const props = Object.getOwnPropertyDescriptors(input), keys = Reflect.ownKeys(props);
  if (keys.some(k => typeof k !== 'string' || !allowed.includes(k) || !props[k].enumerable ||
      !Object.hasOwn(props[k], 'value')) || required.some(k => !Object.hasOwn(props, k))) fail(code);
  return Object.fromEntries(keys.map(k => [k, props[k].value]));
}
const exact = (input, keys, code) => fieldsR67(input, keys, keys, code);
const copy = value => JSON.parse(canonicalR67Json(value));
export function inspectR67Scenarios(input) {
  const scenarios = copy(input);
  if (!Array.isArray(scenarios) || scenarios.length < 3 || scenarios.length > R67_LIMITS.maxScenarios)
    fail('R67_SCENARIOS');
  const seen = new Set(), counts = { manual: 0, hybrid: 0, reverse: 0 };
  for (const raw of scenarios) {
    const c = fieldsR67(raw, ['id', 'mode', 'intent', 'horizon', 'paused'],
      ['id', 'mode', 'intent', 'horizon'], 'R67_SCENARIO');
    if (typeof c.id !== 'string' || !ID.test(c.id) || seen.has(c.id) || !MODES.includes(c.mode) ||
        !['buy', 'sell'].includes(c.intent) || !['day', 'swing'].includes(c.horizon) ||
        (Object.hasOwn(c, 'paused') && typeof c.paused !== 'boolean')) fail('R67_SCENARIO');
    seen.add(c.id); counts[c.mode]++;
  }
  if (MODES.some(m => !counts[m])) fail('R67_THREE_MODES_REQUIRED');
  return freezeR67(scenarios);
}
export const r67InputDigest = scenarios => digestR67Value({ kind: 'private_batch', scenarios: inspectR67Scenarios(scenarios) });
export function r67EventId(input) {
  const p = exact(input, ['scopeId', 'sourceId', 'sessionId', 'sequence', 'operationId'], 'R67_EVENT_BINDING');
  if (!identifier(p.scopeId, 'scope') || !identifier(p.sourceId, 'source') || !identifier(p.sessionId, 'session') ||
      !Number.isSafeInteger(p.sequence) || p.sequence < 1 || p.sequence > R67_LIMITS.maxSequence ||
      typeof p.operationId !== 'string' || !OP.test(p.operationId)) fail('R67_EVENT_BINDING');
  return 'evt:' + sha('JENIOS_R67_PRIVATE_SOURCE_EVENT_V1\0' + canonicalR67Json(p)).slice(0, 16);
}
export function inspectR67TrustedSource(input) {
  const s = exact(copy(input), ['scopeId', 'sourceId', 'publicKeyPem', 'enabled', 'evidenceKind'], 'R67_TRUST_ROOT');
  if (!identifier(s.scopeId, 'scope') || !identifier(s.sourceId, 'source') || s.enabled !== true ||
      s.evidenceKind !== R67_EVIDENCE || typeof s.publicKeyPem !== 'string' || s.publicKeyPem.length > 4096)
    fail('R67_TRUST_ROOT');
  let key;
  try { key = createPublicKey(s.publicKeyPem); } catch { fail('R67_TRUST_ROOT'); }
  if (key.asymmetricKeyType !== 'ed25519') fail('R67_TRUST_ROOT');
  return freezeR67(s);
}
export function r67SourceKeyDigest(trustedSource) {
  const s = inspectR67TrustedSource(trustedSource);
  return sha(createPublicKey(s.publicKeyPem).export({ type: 'spki', format: 'der' }));
}
function inspectCapture(input, scenarios, capturedAtMs) {
  const c = exact(input, CAPTURE_KEYS, 'R67_CAPTURE_SCHEMA');
  if (c.schema !== 'JENIOS_B297_PRIVATE_READONLY_CAPTURE_V1' || c.source !== R67_RUNTIME_EVIDENCE ||
      c.engineSha256Expected !== B297_ENGINE_SHA256 || c.executableBytesVerifiedByAdapter !== false ||
      c.originalCallbackIdentityAttested !== false || c.remoteDeliveryAcknowledged !== false ||
      c.authorizedBrokerFeedObserved !== false || c.readOnly !== true || c.ordersSent !== 0 ||
      c.paperOrdersSent !== 0 || c.executionEnabled !== false || c.profitCertified !== false ||
      c.lossesActuallyAvoided !== null || !Array.isArray(c.entries) || c.entries.length !== scenarios.length ||
      typeof c.finalEntrySha256 !== 'string' || !SHA.test(c.finalEntrySha256)) fail('R67_CAPTURE_VALUE');
  exact(c.counts, MODES, 'R67_CAPTURE_COUNTS');
  const entries = c.entries.map((raw, i) => {
    const e = exact(raw, [...ENTRY_BODY_KEYS, 'entrySha256'], 'R67_CAPTURE_ENTRY_SCHEMA'), s = scenarios[i];
    if (e.id !== s.id || e.commercialMode !== s.mode || e.operatorIntent !== s.intent || e.horizon !== s.horizon ||
        !integer(e.decisionAtMs) || e.decisionAtMs > capturedAtMs || e.observedAtMs !== capturedAtMs ||
        capturedAtMs - e.decisionAtMs > 86400000 || !ACTION_BY_MODE[s.mode].includes(e.action) ||
        ![null, 'buy', 'sell'].includes(e.suggestedSide) ||
        (NO_SIDE.includes(e.action) && e.suggestedSide !== null) ||
        (s.mode === 'manual' && e.suggestedSide !== null && e.suggestedSide !== s.intent) ||
        (e.action === 'reverse_preview' && e.suggestedSide !== (s.intent === 'buy' ? 'sell' : 'buy')) ||
        e.originalVersion !== R67_BINDING.originalVersion || typeof e.rawOutputSha256 !== 'string' ||
        !SHA.test(e.rawOutputSha256) || typeof e.previousSha256 !== 'string' || !SHA.test(e.previousSha256) ||
        typeof e.entrySha256 !== 'string' || !SHA.test(e.entrySha256) ||
        e.delivery !== 'LOCAL_CAPTURE_NO_PROVIDER_ACK' || e.source !== R67_RUNTIME_EVIDENCE)
      fail('R67_CAPTURE_ENTRY_VALUE');
    return Object.fromEntries([...ENTRY_BODY_KEYS, 'entrySha256'].map(k => [k, e[k]]));
  });
  if (MODES.some(m => !Number.isSafeInteger(c.counts[m]) || c.counts[m] < 1)) fail('R67_CAPTURE_COUNTS');
  verifyB297CaptureChain({ ...c, entries });
  return c;
}
function inspectPayload(input) {
  const p = exact(input, PAYLOAD_KEYS, 'R67_PAYLOAD_SCHEMA');
  if (p.schema !== 'JENIOS_R67_SIGNED_PRIVATE_QA_TELEMETRY_V1' || p.evidenceKind !== R67_EVIDENCE ||
      !identifier(p.scopeId, 'scope') || !identifier(p.sourceId, 'source') || !identifier(p.sessionId, 'session') ||
      !identifier(p.eventId, 'evt') || !Number.isSafeInteger(p.sequence) || p.sequence < 1 ||
      p.sequence > R67_LIMITS.maxSequence || !integer(p.capturedAtMs) || !integer(p.expiresAtMs) ||
      p.expiresAtMs - p.capturedAtMs !== R67_LIMITS.lifetimeMs) fail('R67_PAYLOAD_VALUE');
  inspectCapture(p.capture, inspectR67Scenarios(p.scenarios), p.capturedAtMs);
  return p;
}
/** Builds a claim to sign; only the branded-loader source establishes local execution. */
export function r67ProvenanceForPayload(payload, operationId) {
  const p = inspectPayload(copy(payload));
  if (p.eventId !== r67EventId({ scopeId: p.scopeId, sourceId: p.sourceId, sessionId: p.sessionId,
      sequence: p.sequence, operationId })) fail('R67_PROVENANCE_EVENT');
  return freezeR67({ schema: 'JENIOS_R67_PRIVATE_RUNTIME_PROVENANCE_V1', origin: R67_ORIGIN,
    runtimeEvidenceKind: R67_RUNTIME_EVIDENCE, transportEvidenceKind: R67_EVIDENCE,
    eventId: p.eventId, operationId, payloadDigest: r67PayloadDigest(p), inputDigest: r67InputDigest(p.scenarios),
    captureDigest: digestR67Value(p.capture), ...R67_BINDING, runtimeHook: 'B297_CAPTURE_VERIFIED_ANALYZE_REQUEST',
    clockSource: 'WALL_CLOCK_QA_EXECUTION', loaderEvidence: 'VM_SOURCE_TEXT_MODULE_PINNED_BYTES',
    localExecutableBytesVerified: true, ...R67_INVARIANTS });
}
function signatureBytes(value) {
  if (typeof value !== 'string' || !/^(?:[A-Za-z0-9+/]{4}){21}[A-Za-z0-9+/]{2}==$/.test(value)) fail('R67_SIGNATURE_FORMAT');
  const bytes = Buffer.from(value, 'base64');
  if (bytes.length !== 64 || bytes.toString('base64') !== value) fail('R67_SIGNATURE_FORMAT');
  return bytes;
}
function inspectRecord(input) {
  const serialized = canonicalR67Json(input);
  if (Buffer.byteLength(serialized) > R67_LIMITS.maxBytes) fail('R67_RECORD_TOO_LARGE');
  const r = exact(JSON.parse(serialized), ['schema', 'envelope', 'provenance', 'provenanceSignatureBase64'], 'R67_RECORD_SCHEMA');
  if (r.schema !== 'JENIOS_R67_PRIVATE_QA_OBSERVATION_V1') fail('R67_RECORD_SCHEMA');
  exact(r.envelope, ['payload', 'signatureBase64'], 'R67_ENVELOPE_SCHEMA');
  const p = inspectPayload(r.envelope.payload), prov = exact(r.provenance, PROVENANCE_KEYS, 'R67_PROVENANCE_SCHEMA');
  if (canonicalR67Json(prov) !== canonicalR67Json(r67ProvenanceForPayload(p, prov.operationId)))
    fail('R67_PROVENANCE_BINDING');
  signatureBytes(r.envelope.signatureBase64); signatureBytes(r.provenanceSignatureBase64);
  return r;
}
function makeReceipt(record, admittedAtMs, sourceKeySha256) {
  const p = record.envelope.payload;
  return { schema: 'JENIOS_R67_PRIVATE_QA_RECEIPT_V1', evidenceKind: R67_EVIDENCE, runtimeOrigin: R67_ORIGIN,
    scopeId: p.scopeId, sourceId: p.sourceId, sessionId: p.sessionId, eventId: p.eventId, sequence: p.sequence,
    capturedAtMs: p.capturedAtMs, expiresAtMs: p.expiresAtMs, admittedAtMs,
    payloadDigest: r67PayloadDigest(p), provenanceDigest: r67ProvenanceDigest(record.provenance),
    recordDigest: r67RecordDigest(record), captureCount: p.capture.entries.length, counts: p.capture.counts,
    ...R67_BINDING, sourceKeySha256 };
}
export function verifyR67PrivateObservationRecord(input, options) {
  const context = exact(options, ['trustedSource', 'nowMs'], 'R67_VERIFICATION_CONTEXT');
  const trustedSource = inspectR67TrustedSource(context.trustedSource), record = inspectRecord(input), p = record.envelope.payload;
  if (p.scopeId !== trustedSource.scopeId || p.sourceId !== trustedSource.sourceId) fail('R67_SOURCE_BINDING');
  if (!integer(context.nowMs) || context.nowMs < p.capturedAtMs || context.nowMs >= p.expiresAtMs) fail('R67_RECORD_TIME');
  const key = createPublicKey(trustedSource.publicKeyPem);
  if (!verify(null, Buffer.from(R67_PAYLOAD_DOMAIN + canonicalR67Json(p)), key, signatureBytes(record.envelope.signatureBase64)))
    fail('R67_PAYLOAD_SIGNATURE');
  if (!verify(null, Buffer.from(R67_PROVENANCE_DOMAIN + canonicalR67Json(record.provenance)), key,
      signatureBytes(record.provenanceSignatureBase64))) fail('R67_PROVENANCE_SIGNATURE');
  return freezeR67({ schema: 'JENIOS_R67_VERIFIED_PRIVATE_QA_OBSERVATION_V1',
    receipt: makeReceipt(record, context.nowMs, r67SourceKeyDigest(trustedSource)), record,
    configuredSourceSignatureVerified: true, independentRuntimeAttestation: false });
}
/** Historical structure/digest inspection ONLY. It does not reverify signatures,
 * current expiry or independent execution. Use the verifier at HTTP admission. */
export function inspectR67StoredObservation(input) {
  const s = exact(input, ['receipt', 'record'], 'R67_STORED_SCHEMA'), record = inspectRecord(s.record);
  const receipt = exact(copy(s.receipt), RECEIPT_KEYS, 'R67_RECEIPT_SCHEMA'), p = record.envelope.payload;
  if (!integer(receipt.admittedAtMs) || receipt.admittedAtMs < p.capturedAtMs || receipt.admittedAtMs >= p.expiresAtMs ||
      typeof receipt.sourceKeySha256 !== 'string' || !SHA.test(receipt.sourceKeySha256) ||
      canonicalR67Json(receipt) !== canonicalR67Json(makeReceipt(record, receipt.admittedAtMs, receipt.sourceKeySha256)))
    fail('R67_RECEIPT_BINDING');
  return freezeR67({ receipt, record });
}
export function createR67IntakeAcknowledgement(input, status) {
  const { receipt: r } = inspectR67StoredObservation(input);
  if (!['STORED', 'ALREADY_STORED'].includes(status)) fail('R67_ACK_STATUS');
  return freezeR67({ schema: 'JENIOS_R67_PRIVATE_INTAKE_RESULT_V1', status,
    scopeId: r.scopeId, sourceId: r.sourceId, sessionId: r.sessionId, eventId: r.eventId, sequence: r.sequence,
    recordDigest: r.recordDigest, payloadDigest: r.payloadDigest, captureCount: r.captureCount,
    ...R67_BINDING, evidenceKind: R67_EVIDENCE, runtimeOrigin: R67_ORIGIN, ...R67_INVARIANTS });
}
/** ACK is a pinned HTTP peer's response, not an independent signed receipt. */
export function inspectR67IntakeAcknowledgement(input, rawRecord, httpStatus) {
  const ack = exact(copy(input), ACK_KEYS, 'R67_OUTBOX_ACK_BINDING'), record = inspectRecord(rawRecord);
  if (!((httpStatus === 202 && ack.status === 'STORED') || (httpStatus === 200 && ack.status === 'ALREADY_STORED')))
    fail('R67_OUTBOX_ACK_BINDING');
  const receipt = makeReceipt(record, record.envelope.payload.capturedAtMs, '0'.repeat(64));
  if (canonicalR67Json(ack) !== canonicalR67Json(createR67IntakeAcknowledgement({ receipt, record }, ack.status)))
    fail('R67_OUTBOX_ACK_BINDING');
  return freezeR67({ httpStatus, body: ack });
}
