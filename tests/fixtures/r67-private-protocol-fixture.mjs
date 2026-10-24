/** PUBLIC PROTOCOL FIXTURE. No private engine bytes are loaded or executed.
 * A generated test key signs a modeled source claim to test admission/transport.
 * This fixture cannot create a branded loader handle and is never evidence of
 * original private execution, customers, broker activity or financial results.
 */
import { generateKeyPairSync, createPrivateKey, createPublicKey, sign } from 'node:crypto';
import { captureB297OriginalDecisions } from '../../lib/platform/research/b297-private-readonly-audit.mjs';
import { R67_BINDING, R67_EVIDENCE, R67_PAYLOAD_DOMAIN, R67_PROVENANCE_DOMAIN, canonicalR67Json,
  r67EventId, r67ProvenanceForPayload } from '../../lib/platform/research/robot-r67-private-protocol.mjs';

export const R67_PROTOCOL_FIXTURE_KIND = 'PUBLIC_PROTOCOL_FIXTURE_NO_PRIVATE_EXECUTION';
export const R67_FIXTURE_SCENARIOS = Object.freeze([
  Object.freeze({ id: 'fixture-manual', mode: 'manual', intent: 'buy', horizon: 'day' }),
  Object.freeze({ id: 'fixture-hybrid', mode: 'hybrid', intent: 'sell', horizon: 'swing' }),
  Object.freeze({ id: 'fixture-reverse', mode: 'reverse', intent: 'buy', horizon: 'day' }),
]);
export async function createR67ProtocolFixture({ nowMs = Date.now(), sequence = 1,
  sessionId = 'session:6767676767676767', operationId = 'op:' + '67'.repeat(16),
  scopeId = 'scope:6767676767676767', sourceId = 'source:6767676767676767',
  privateKeyPem, scenarios = R67_FIXTURE_SCENARIOS } = {}) {
  const key = privateKeyPem ? createPrivateKey(privateKeyPem) : generateKeyPairSync('ed25519').privateKey;
  const privatePem = key.export({ type: 'pkcs8', format: 'pem' });
  const trustedSource = { scopeId, sourceId, enabled: true, evidenceKind: R67_EVIDENCE,
    publicKeyPem: createPublicKey(key).export({ type: 'spki', format: 'pem' }) };
  const capture = await captureB297OriginalDecisions({ scenarios, nowMs, analyzeRequest: async req => ({
    ok: true, simulation: true, executionEnabled: false, sourceMode: 'synthetic',
    symbol: 'LABORATÓRIO SINTÉTICO', version: R67_BINDING.originalVersion,
    fixtureEvidence: R67_PROTOCOL_FIXTURE_KIND, scan: { decisionAt: nowMs },
    decision: { action: req.mode === 'manual' ? 'manual_preview' : req.mode === 'hybrid' ?
      'wait_for_confluence' : 'reverse_not_calibrated', side: req.mode === 'manual' ? req.intent : null, mayClose: true },
  }) });
  const payload = { schema: 'JENIOS_R67_SIGNED_PRIVATE_QA_TELEMETRY_V1', evidenceKind: R67_EVIDENCE,
    scopeId, sourceId, sessionId, eventId: r67EventId({ scopeId, sourceId, sessionId, sequence, operationId }),
    sequence, capturedAtMs: nowMs, expiresAtMs: nowMs + 120000, scenarios, capture };
  const provenance = r67ProvenanceForPayload(payload, operationId);
  const record = { schema: 'JENIOS_R67_PRIVATE_QA_OBSERVATION_V1', envelope: { payload,
    signatureBase64: sign(null, Buffer.from(R67_PAYLOAD_DOMAIN + canonicalR67Json(payload)), key).toString('base64') },
    provenance, provenanceSignatureBase64: sign(null, Buffer.from(R67_PROVENANCE_DOMAIN + canonicalR67Json(provenance)), key).toString('base64') };
  return { record, trustedSource, privateKeyPem: privatePem, scenarios,
    fixtureEvidence: R67_PROTOCOL_FIXTURE_KIND };
}
