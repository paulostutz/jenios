/** R71 signed EXTERNAL runtime policy over an unchanged native R67 record.
 * A configured source signature authenticates a claim, not independent proof
 * of execution or a broker position. The branded source establishes local
 * execution; public fixtures remain explicitly labeled outside this wire.
 */
import { createHash, createPrivateKey, createPublicKey, sign, verify } from 'node:crypto';
import { inspectR67Scenarios, inspectR67TrustedSource, r67SourceKeyDigest,
  r67RecordDigest, r67ProvenanceForPayload, canonicalR67Json, R67_LIMITS, R67_EVIDENCE,
  verifyR67PrivateObservationRecord, inspectR67StoredObservation } from './robot-r67-private-protocol.mjs';
import { R71_POLICY, R71_BOUNDARIES, R71_LIMITS, canonicalR71Json, digestR71Value,
  fieldsR71, freezeR71, inspectR71Version, inspectR71RuntimeView } from './robot-r71-policy.mjs';
import { canonicalR70Json, inspectR70TargetPins, createR70PreflightRequest,
  verifyR70PreflightRequest } from './robot-r70-preflight-protocol.mjs';

export const R71_RUNTIME_ORIGIN = 'ORIGINAL_PRIVATE_CORE_WITH_VERSIONED_EXTERNAL_RUNTIME_POLICY_SYNTHETIC_QA';
export const R71_ANNOTATION_DOMAIN = 'JENIOS_R71_PRIVATE_POLICY_ANNOTATION_V1\0';
export const R71_STATE_QUERY_DOMAIN = 'JENIOS_R71_SOURCE_STATE_QUERY_V1\0';
export const R71_OBSERVATION_PATH = '/api/platform/robot-private-policy-observations';
export const R71_STATE_PATH = '/api/platform/robot-private-evolution-state';
const fail = code => { throw Object.assign(new Error(code), { name: 'ValidationError', code }); };
const exact = (value, keys, code) => fieldsR71(value, keys, keys, code);
const integer = value => Number.isSafeInteger(value) && value >= 0;
const HEX = /^[a-f0-9]{64}$/, PLAN = /^plan:[a-f0-9]{16}$/, CASE = /^case:[a-f0-9]{16}$/;
const sha = value => createHash('sha256').update(value).digest('hex');
const same = (a, b) => canonicalR71Json(a) === canonicalR71Json(b);
const copy = value => JSON.parse(canonicalR71Json(value));
const RECORD_KEYS = ['schema', 'originalRecord', 'annotation', 'signatureBase64'];
const ANNOTATION_KEYS = ['schema', 'recordDigest', 'purpose', 'planId', 'scopeId', 'sourceId', 'sessionId',
  'eventId', 'sequence', 'capturedAtMs', 'expiresAtMs', 'stateRevision', 'stateDigest', 'wrapperVersion',
  'entries', 'policyKind', 'runtimeEvidenceKind', 'internalCoreRetuning'];
const ENTRY_KEYS = ['scenarioId', 'positionOpen', 'caseId', 'nativeDecision', 'effectiveDecision',
  'nativeDecisionDigest', 'effectiveDecisionDigest', 'nativeRawOutputSha256'];
const RECEIPT_KEYS = ['schema', 'nativeReceipt', 'recordDigest', 'annotationDigest', 'sourceKeySha256',
  'purpose', 'planId', 'stateRevision', 'stateDigest', 'wrapperVersion', 'entryCount', 'admittedAtMs'];
const ACK_KEYS = ['schema', 'status', 'scopeId', 'sourceId', 'sessionId', 'eventId', 'sequence',
  'recordDigest', 'annotationDigest', 'purpose', 'planId', 'wrapperVersion', 'entryCount', ...Object.keys(R71_BOUNDARIES)];
function signatureBytes(input) {
  if (typeof input !== 'string' || !/^[A-Za-z0-9+/]{86}==$/.test(input)) fail('R71_SIGNATURE_FORMAT');
  const bytes = Buffer.from(input, 'base64');
  if (bytes.length !== 64 || bytes.toString('base64') !== input) fail('R71_SIGNATURE_FORMAT');
  return bytes;
}
function signingKey(value) {
  if (typeof value !== 'string' || value.length > 4096) fail('R71_SIGNING_KEY');
  let key;
  try { key = createPrivateKey(value); } catch { fail('R71_SIGNING_KEY'); }
  if (key.asymmetricKeyType !== 'ed25519') fail('R71_SIGNING_KEY');
  return key;
}
function recordJson(value) {
  const text = canonicalR71Json(value);
  if (Buffer.byteLength(text) > R71_LIMITS.recordBytes) fail('R71_RECORD_TOO_LARGE');
  return JSON.parse(text);
}
export const r71RecordDigest = record => sha('JENIOS_R71_PRIVATE_POLICY_RECORD_V1\0' + canonicalR71Json(record));
export const r71AnnotationDigest = annotation => sha(R71_ANNOTATION_DOMAIN + canonicalR71Json(annotation));

export function inspectR71PositionContexts(input, rawScenarios) {
  const scenarios = inspectR67Scenarios(rawScenarios), contexts = copy(input);
  if (!Array.isArray(contexts) || contexts.length !== scenarios.length) fail('R71_POSITION_CONTEXTS');
  return freezeR71(contexts.map((raw, index) => {
    const c = exact(raw, ['scenarioId', 'positionOpen'], 'R71_POSITION_CONTEXTS');
    if (c.scenarioId !== scenarios[index].id || typeof c.positionOpen !== 'boolean') fail('R71_POSITION_CONTEXTS');
    return c;
  }));
}
export function r71CaptureInputDigest(input) {
  const c = fieldsR71(input, ['purpose', 'planId', 'scenarios', 'positionContexts'], ['purpose'], 'R71_CAPTURE_INPUT');
  if (c.purpose === 'VALIDATION') {
    if (!same(Object.keys(c).sort(), ['planId', 'purpose']) || !PLAN.test(c.planId || '')) fail('R71_CAPTURE_INPUT');
    return digestR71Value({ purpose: 'VALIDATION', planId: c.planId });
  }
  if (c.purpose !== 'OBSERVATION' || !same(Object.keys(c).sort(), ['positionContexts', 'purpose', 'scenarios']))
    fail('R71_CAPTURE_INPUT');
  const scenarios = inspectR67Scenarios(c.scenarios), positionContexts = inspectR71PositionContexts(c.positionContexts, scenarios);
  return digestR71Value({ purpose: 'OBSERVATION', scenarios, positionContexts });
}
function nativeStructure(value) {
  const text = canonicalR67Json(value);
  if (Buffer.byteLength(text) > R67_LIMITS.maxBytes) fail('R71_NATIVE_RECORD_TOO_LARGE');
  const r = exact(JSON.parse(text), ['schema', 'envelope', 'provenance', 'provenanceSignatureBase64'], 'R71_NATIVE_RECORD');
  if (r.schema !== 'JENIOS_R67_PRIVATE_QA_OBSERVATION_V1') fail('R71_NATIVE_RECORD');
  const envelope = exact(r.envelope, ['payload', 'signatureBase64'], 'R71_NATIVE_RECORD');
  // Reuse the original closed payload/provenance inspector; never reinterpret
  // the native core's fixed generation0 as the wrapper generation.
  const expected = r67ProvenanceForPayload(envelope.payload, r.provenance?.operationId);
  if (canonicalR67Json(expected) !== canonicalR67Json(r.provenance)) fail('R71_NATIVE_RECORD');
  signatureBytes(envelope.signatureBase64); signatureBytes(r.provenanceSignatureBase64);
  return r;
}
function inspectSummary(input) {
  const s = exact(input, ['action', 'side', 'mayClose'], 'R71_DECISION');
  if (typeof s.action !== 'string' || ![null, 'buy', 'sell'].includes(s.side) || s.mayClose !== true) fail('R71_DECISION');
  return s;
}
function inspectRecord(input) {
  const r = exact(recordJson(input), RECORD_KEYS, 'R71_RECORD');
  if (r.schema !== 'JENIOS_R71_PRIVATE_POLICY_OBSERVATION_V1') fail('R71_RECORD');
  const originalRecord = nativeStructure(r.originalRecord), p = originalRecord.envelope.payload;
  const a = exact(r.annotation, ANNOTATION_KEYS, 'R71_ANNOTATION');
  if (a.schema !== 'JENIOS_R71_PRIVATE_POLICY_ANNOTATION_V1' || a.recordDigest !== r67RecordDigest(originalRecord) ||
      !['OBSERVATION', 'VALIDATION'].includes(a.purpose) ||
      (a.purpose === 'OBSERVATION' ? a.planId !== null : !PLAN.test(a.planId || '')) ||
      !integer(a.stateRevision) || a.stateRevision > R71_LIMITS.revisions || !HEX.test(a.stateDigest || '') ||
      a.policyKind !== R71_POLICY.kind || a.runtimeEvidenceKind !== R71_RUNTIME_ORIGIN || a.internalCoreRetuning !== false)
    fail('R71_ANNOTATION');
  for (const field of ['scopeId', 'sourceId', 'sessionId', 'eventId', 'sequence', 'capturedAtMs', 'expiresAtMs'])
    if (a[field] !== p[field]) fail('R71_NATIVE_BINDING');
  const version = inspectR71Version(a.wrapperVersion);
  if (a.purpose === 'VALIDATION' && !version.forwardPositionOpen) fail('R71_VALIDATION_VERSION');
  if (!Array.isArray(a.entries) || a.entries.length !== p.scenarios.length) fail('R71_ENTRIES');
  const caseIds = new Set();
  const entries = a.entries.map((raw, i) => {
    const e = exact(raw, ENTRY_KEYS, 'R71_ENTRY'), scenario = p.scenarios[i], native = p.capture.entries[i];
    if (e.scenarioId !== scenario.id || e.scenarioId !== native.id || typeof e.positionOpen !== 'boolean' ||
        (a.purpose === 'OBSERVATION' ? e.caseId !== null : !CASE.test(e.caseId || '') || caseIds.has(e.caseId)))
      fail('R71_ENTRY');
    if (e.caseId !== null) caseIds.add(e.caseId);
    const nativeDecision = inspectSummary(e.nativeDecision), effectiveDecision = inspectSummary(e.effectiveDecision);
    if (nativeDecision.action !== native.action || nativeDecision.side !== native.suggestedSide ||
        e.nativeRawOutputSha256 !== native.rawOutputSha256 ||
        e.nativeDecisionDigest !== digestR71Value(nativeDecision) || e.effectiveDecisionDigest !== digestR71Value(effectiveDecision))
      fail('R71_DECISION_BINDING');
    const routed = version.forwardPositionOpen && e.positionOpen && scenario.mode !== 'manual' &&
      scenario.paused !== true && nativeDecision.action !== 'pause_new_entries';
    const expected = routed ? { action: 'manage_existing_position', side: null, mayClose: true } : nativeDecision;
    if (!same(effectiveDecision, expected)) fail('R71_POLICY_DECISION');
    return { ...e, nativeDecision, effectiveDecision };
  });
  signatureBytes(r.signatureBase64);
  return freezeR71({ ...r, originalRecord, annotation: { ...a, wrapperVersion: version, entries } });
}
function receiptFor(record, nativeReceipt) {
  const a = record.annotation;
  return freezeR71({ schema: 'JENIOS_R71_PRIVATE_POLICY_RECEIPT_V1', nativeReceipt,
    recordDigest: r71RecordDigest(record), annotationDigest: r71AnnotationDigest(a),
    sourceKeySha256: nativeReceipt.sourceKeySha256, purpose: a.purpose, planId: a.planId,
    stateRevision: a.stateRevision, stateDigest: a.stateDigest, wrapperVersion: a.wrapperVersion,
    entryCount: a.entries.length, admittedAtMs: nativeReceipt.admittedAtMs });
}
export function verifyR71PrivateObservationRecord(input, options) {
  const c = exact(options, ['trustedSource', 'nowMs'], 'R71_VERIFICATION_CONTEXT');
  const source = inspectR67TrustedSource(c.trustedSource), record = inspectRecord(input);
  const native = verifyR67PrivateObservationRecord(record.originalRecord, { trustedSource: source, nowMs: c.nowMs });
  if (!verify(null, Buffer.from(R71_ANNOTATION_DOMAIN + canonicalR71Json(record.annotation)),
    createPublicKey(source.publicKeyPem), signatureBytes(record.signatureBase64))) fail('R71_ANNOTATION_SIGNATURE');
  return freezeR71({ receipt: receiptFor(record, native.receipt), record });
}
export function inspectR71StoredObservation(input) {
  const c = exact(input, ['receipt', 'record'], 'R71_STORED_SCHEMA'), record = inspectRecord(c.record);
  const receipt = exact(copy(c.receipt), RECEIPT_KEYS, 'R71_RECEIPT_SCHEMA');
  const native = inspectR67StoredObservation({ receipt: receipt.nativeReceipt, record: record.originalRecord });
  if (!same(receipt, receiptFor(record, native.receipt))) fail('R71_RECEIPT_BINDING');
  return freezeR71({ receipt, record });
}
/** Pure claim builder. No executable is loaded and no execution is attested. */
export function createR71PrivateObservationRecord(input) {
  const c = exact(input, ['originalRecord', 'annotation', 'privateKeyPem'], 'R71_SIGN_CONFIG');
  const key = signingKey(c.privateKeyPem), originalRecord = nativeStructure(c.originalRecord);
  const p = originalRecord.envelope.payload;
  const trustedSource = inspectR67TrustedSource({ scopeId: p.scopeId, sourceId: p.sourceId,
    publicKeyPem: createPublicKey(key).export({ type: 'spki', format: 'pem' }), enabled: true, evidenceKind: R67_EVIDENCE });
  const record = { schema: 'JENIOS_R71_PRIVATE_POLICY_OBSERVATION_V1', originalRecord, annotation: copy(c.annotation),
    signatureBase64: sign(null, Buffer.from(R71_ANNOTATION_DOMAIN + canonicalR71Json(c.annotation)), key).toString('base64') };
  return verifyR71PrivateObservationRecord(record, { trustedSource, nowMs: p.capturedAtMs }).record;
}
function acknowledgement(record, status) {
  if (!['STORED', 'ALREADY_STORED'].includes(status)) fail('R71_ACK_STATUS');
  const a = record.annotation;
  return freezeR71({ schema: 'JENIOS_R71_PRIVATE_POLICY_ACK_V1', status,
    scopeId: a.scopeId, sourceId: a.sourceId, sessionId: a.sessionId, eventId: a.eventId, sequence: a.sequence,
    recordDigest: r71RecordDigest(record), annotationDigest: r71AnnotationDigest(a), purpose: a.purpose,
    planId: a.planId, wrapperVersion: a.wrapperVersion, entryCount: a.entries.length, ...R71_BOUNDARIES });
}
export function createR71IntakeAcknowledgement(input, status) {
  return acknowledgement(inspectR71StoredObservation(input).record, status);
}
export function inspectR71IntakeAcknowledgement(input, rawRecord, httpStatus) {
  const body = exact(copy(input), ACK_KEYS, 'R71_ACK_BINDING'), record = inspectRecord(rawRecord);
  if (!((httpStatus === 202 && body.status === 'STORED') || (httpStatus === 200 && body.status === 'ALREADY_STORED')) ||
      !same(body, acknowledgement(record, body.status))) fail('R71_ACK_BINDING');
  return freezeR71({ httpStatus, body });
}

const queryDigest = query => sha('JENIOS_R71_SOURCE_STATE_QUERY_DIGEST_V1\0' + canonicalR71Json(query));
export function createR71SourceStateQuery(input) {
  const c = fieldsR71(input, ['targetPins', 'trustedSource', 'privateKeyPem', 'nowMs', 'nonce'],
    ['targetPins', 'trustedSource', 'privateKeyPem'], 'R71_STATE_QUERY_CONFIG');
  const challenge = createR70PreflightRequest(c), key = signingKey(c.privateKeyPem);
  return freezeR71({ schema: 'JENIOS_R71_SOURCE_STATE_QUERY_V1', challenge,
    signatureBase64: sign(null, Buffer.from(R71_STATE_QUERY_DOMAIN + canonicalR71Json(challenge)), key).toString('base64') });
}
export function verifyR71SourceStateQuery(input, options) {
  const c = fieldsR71(options, ['trustedSource', 'nowMs'], ['trustedSource'], 'R71_STATE_VERIFY_CONFIG');
  const query = exact(copy(input), ['schema', 'challenge', 'signatureBase64'], 'R71_STATE_QUERY');
  if (query.schema !== 'JENIOS_R71_SOURCE_STATE_QUERY_V1' || Buffer.byteLength(canonicalR71Json(query)) > 8192)
    fail('R71_STATE_QUERY');
  const trustedSource = inspectR67TrustedSource(c.trustedSource);
  const verified = verifyR70PreflightRequest(query.challenge, { trustedSource,
    ...(c.nowMs === undefined ? {} : { nowMs: c.nowMs }) });
  if (!verify(null, Buffer.from(R71_STATE_QUERY_DOMAIN + canonicalR71Json(verified.request)),
    createPublicKey(trustedSource.publicKeyPem), signatureBytes(query.signatureBase64))) fail('R71_STATE_QUERY_SIGNATURE');
  return freezeR71({ query, challenge: verified.request, requestDigest: queryDigest(query),
    nonce: verified.request.payload.nonce, expiresAtMs: verified.request.payload.expiresAtMs });
}
function boundRuntimeView(input, trustedSource) {
  const view = inspectR71RuntimeView(input), source = inspectR67TrustedSource(trustedSource);
  if (view.scopeId !== source.scopeId || view.sourceId !== source.sourceId || view.sourceKeySha256 !== r67SourceKeyDigest(source))
    fail('R71_STATE_VIEW_SOURCE');
  return view;
}
export function createR71SourceStateResult(input) {
  const c = fieldsR71(input, ['query', 'runtimeView', 'trustedSource', 'nowMs'],
    ['query', 'runtimeView', 'trustedSource'], 'R71_STATE_RESULT_CONFIG');
  const verified = verifyR71SourceStateQuery(c.query, { trustedSource: c.trustedSource,
    ...(c.nowMs === undefined ? {} : { nowMs: c.nowMs }) });
  return freezeR71({ schema: 'JENIOS_R71_SOURCE_STATE_RESULT_V1', requestDigest: verified.requestDigest,
    nonce: verified.nonce, expiresAtMs: verified.expiresAtMs, runtimeView: boundRuntimeView(c.runtimeView, c.trustedSource) });
}
export function inspectR71SourceStateResult(input, options) {
  const c = fieldsR71(options, ['query', 'trustedSource', 'targetPins', 'nowMs'],
    ['query', 'trustedSource', 'targetPins'], 'R71_STATE_RESULT_INSPECT_CONFIG');
  const verified = verifyR71SourceStateQuery(c.query, { trustedSource: c.trustedSource,
    ...(c.nowMs === undefined ? {} : { nowMs: c.nowMs }) });
  const targetPins = inspectR70TargetPins(c.targetPins), result = exact(copy(input),
    ['schema', 'requestDigest', 'nonce', 'expiresAtMs', 'runtimeView'], 'R71_STATE_RESULT');
  if (canonicalR70Json(targetPins) !== canonicalR70Json(verified.challenge.payload.targetPins) ||
      result.schema !== 'JENIOS_R71_SOURCE_STATE_RESULT_V1' || result.requestDigest !== verified.requestDigest ||
      result.nonce !== verified.nonce || result.expiresAtMs !== verified.expiresAtMs ||
      Buffer.byteLength(canonicalR71Json(result)) > 8192) fail('R71_STATE_RESULT_BINDING');
  return freezeR71({ ...result, runtimeView: boundRuntimeView(result.runtimeView, c.trustedSource) });
}
