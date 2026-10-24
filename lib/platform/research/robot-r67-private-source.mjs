/** R67 source: executes only a branded handle for pinned original bytes.
 * No caller decision/callback, mutable strategy, provider or market source is
 * accepted. The separate durable wrapper commits the complete batch before it
 * can be sent. This process-local cache alone is not restart recovery.
 */
import { createPrivateKey, createPublicKey, sign } from 'node:crypto';
import { inspectR67VerifiedPrivateCore, captureR67VerifiedPrivateBatch } from './robot-r67-private-core-loader.mjs';
import { R67_ORIGIN, R67_EVIDENCE, R67_BINDING, R67_INVARIANTS, R67_LIMITS,
  R67_PAYLOAD_DOMAIN, R67_PROVENANCE_DOMAIN, canonicalR67Json, freezeR67, fieldsR67,
  inspectR67Scenarios, inspectR67TrustedSource, r67InputDigest, r67EventId,
  r67ProvenanceForPayload, verifyR67PrivateObservationRecord } from './robot-r67-private-protocol.mjs';
const fail = code => { throw Object.assign(new Error(code), { name: 'ValidationError', code }); };
const CONFIG = ['enabled', 'domain', 'handle', 'scopeId', 'sourceId', 'sessionId', 'privateKeyPem', 'now'];
export function createR67PrivateCoreSource(input = {}) {
  const c = fieldsR67(input, CONFIG, CONFIG.filter(k => k !== 'now'), 'R67_SOURCE_CONFIG');
  if (c.enabled !== true || c.domain !== R67_ORIGIN) fail('R67_SOURCE_DISABLED');
  const core = inspectR67VerifiedPrivateCore(c.handle);
  if (!/^session:[a-f0-9]{16}$/.test(c.sessionId || '') ||
      (c.now !== undefined && typeof c.now !== 'function')) fail('R67_SOURCE_CONFIG');
  if (typeof c.privateKeyPem !== 'string' || c.privateKeyPem.length > 4096) fail('R67_SOURCE_SIGNING_KEY');
  let key;
  try { key = createPrivateKey(c.privateKeyPem); } catch { fail('R67_SOURCE_SIGNING_KEY'); }
  if (key.asymmetricKeyType !== 'ed25519') fail('R67_SOURCE_SIGNING_KEY');
  const trustedSource = inspectR67TrustedSource({ scopeId: c.scopeId, sourceId: c.sourceId, enabled: true,
    evidenceKind: R67_EVIDENCE, publicKeyPem: createPublicKey(key).export({ type: 'spki', format: 'pem' }) });
  const now = c.now ?? Date.now, cache = new Map();
  let sequence = 1, lastCapturedAtMs = -1, busy = false;
  async function captureBatch(input) {
    const cmd = fieldsR67(input, ['operationId', 'scenarios'], ['operationId', 'scenarios'], 'R67_SOURCE_COMMAND');
    if (typeof cmd.operationId !== 'string' || !/^op:[a-f0-9]{32}$/.test(cmd.operationId)) fail('R67_SOURCE_OPERATION_ID');
    const scenarios = inspectR67Scenarios(cmd.scenarios), inputDigest = r67InputDigest(scenarios);
    const previous = cache.get(cmd.operationId);
    if (previous) {
      if (previous.inputDigest !== inputDigest) fail('R67_SOURCE_OPERATION_CONFLICT');
      return previous.record;
    }
    if (busy) fail('R67_SOURCE_BUSY');
    if (cache.size >= 5000 || sequence > R67_LIMITS.maxSequence) fail('R67_SOURCE_LIMIT');
    const capturedAtMs = now();
    if (!Number.isSafeInteger(capturedAtMs) || capturedAtMs < 0 || capturedAtMs < lastCapturedAtMs ||
        !Number.isSafeInteger(capturedAtMs + R67_LIMITS.lifetimeMs)) fail('R67_SOURCE_CLOCK');
    busy = true;
    try {
      const capture = await captureR67VerifiedPrivateBatch(c.handle, { scenarios, nowMs: capturedAtMs });
      const payload = { schema: 'JENIOS_R67_SIGNED_PRIVATE_QA_TELEMETRY_V1', evidenceKind: R67_EVIDENCE,
        scopeId: c.scopeId, sourceId: c.sourceId, sessionId: c.sessionId,
        eventId: r67EventId({ scopeId: c.scopeId, sourceId: c.sourceId, sessionId: c.sessionId,
          sequence, operationId: cmd.operationId }), sequence, capturedAtMs,
        expiresAtMs: capturedAtMs + R67_LIMITS.lifetimeMs, scenarios, capture };
      const provenance = r67ProvenanceForPayload(payload, cmd.operationId);
      const record = { schema: 'JENIOS_R67_PRIVATE_QA_OBSERVATION_V1', envelope: { payload,
        signatureBase64: sign(null, Buffer.from(R67_PAYLOAD_DOMAIN + canonicalR67Json(payload)), key).toString('base64') },
        provenance, provenanceSignatureBase64: sign(null, Buffer.from(R67_PROVENANCE_DOMAIN + canonicalR67Json(provenance)), key).toString('base64') };
      const checked = verifyR67PrivateObservationRecord(record, { trustedSource, nowMs: now() }).record;
      cache.set(cmd.operationId, { inputDigest, record: checked });
      sequence++; lastCapturedAtMs = capturedAtMs;
      return checked;
    } finally { busy = false; }
  }
  function inspect() {
    return freezeR67({ schema: 'JENIOS_R67_PRIVATE_SOURCE_STATE_V1', scopeId: c.scopeId, sourceId: c.sourceId,
      sessionId: c.sessionId, nextSequence: sequence, cachedBatches: cache.size, busy,
      core, ...R67_BINDING, runtimeOrigin: R67_ORIGIN, evidenceKind: R67_EVIDENCE, ...R67_INVARIANTS });
  }
  return Object.freeze({ trustedSource, captureBatch, inspect });
}
