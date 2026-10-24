/** Test-only signing material is generated in memory; no customer/source credentials. */
import { generateKeyPairSync, sign } from 'node:crypto';
import { R64_TELEMETRY_DOMAIN, canonicalR64TelemetryPayload, scheduleR64TelemetryPeriod,
  verifyR64TelemetryEnvelope, studyR64AcceptedTelemetry } from '../../../lib/platform/research/robot-r64-telemetry.mjs';

export function signR64QaPayload(payload, privateKey) {
  return { payload, signatureBase64: sign(null,
    Buffer.from(R64_TELEMETRY_DOMAIN + canonicalR64TelemetryPayload(payload)), privateKey).toString('base64') };
}

export function createR64TelemetryFixture({ generatedAtMs = Date.UTC(2026, 9, 24, 12),
  scopeId = 'scope:0000000000000001', sourceId = 'source:0000000000000001',
  sessionId = 'session:0000000000000001', count = 7 } = {}) {
  if (!Number.isSafeInteger(count) || count < 0 || count > 5000) throw new Error('Invalid fixture count');
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const trustedSource = { sourceId, scopeId, publicKeyPem: publicKey.export({ format: 'pem', type: 'spki' }),
    enabled: true, evidenceKind: 'SIGNED_QA_REPLAY' };
  const schedule = scheduleR64TelemetryPeriod({ nowMs: generatedAtMs });
  const period = schedule.period;
  const modes = ['manual', 'hybrid', 'reverse', 'ultrafast'];
  const envelopes = Array.from({ length: count }, (_, index) => {
    const stale = index >= 4;
    const payload = { schema: 'JENIOS_R64_SIGNED_QA_TELEMETRY_V1', evidenceKind: 'SIGNED_QA_REPLAY',
      scopeId, sourceId, sessionId, eventId: 'evt:' + (index + 1).toString(16).padStart(16, '0'),
      sequence: index + 1, expiresAtMs: generatedAtMs + 60000,
      event: { policyVersion: 'research:r63-v1', robot: stale ? 'ultrafast' : modes[index % 4],
        kind: stale ? 'incident' : 'decision', decision: stale ? 'BLOCK' : 'KEEP',
        issue: stale ? 'STALE_CONTEXT' : 'NONE', marketAgeMs: stale ? 650 : 100,
        occurredAtMs: period.endMs - 10000 - count + index, capturedAtMs: generatedAtMs - 1000 } };
    return signR64QaPayload(payload, privateKey);
  });
  const receipts = envelopes.map(envelope => verifyR64TelemetryEnvelope(envelope, { trustedSource, nowMs: generatedAtMs }));
  const study = studyR64AcceptedTelemetry(receipts, { scopeId, period, generatedAtMs });
  return { trustedSource, privateKey, envelopes, receipts, study, period, generatedAtMs };
}
