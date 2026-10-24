/**
 * R66 local acceptance transport. Only canonical literal loopback HTTP is
 * admitted; no hostname resolution, hosted endpoint, redirect or credentials.
 * The durable emitter owns persistence/ACK handling. This transport does not
 * register a worker or activate any operational/customer/provider connection.
 */
import { canonicalR64Json } from './robot-r64-telemetry.mjs';
import { verifyR65ObservationRecord } from './robot-r65-observation-source.mjs';

export const R66_OBSERVATION_PATH = '/api/platform/robot-evolution-observations';
export const R66_LOOPBACK_LIMITS = Object.freeze({ requestBytes: 32768,
  responseBytes: 4096, minimumTimeoutMs: 50, maximumTimeoutMs: 10000 });
const fail = code => { throw Object.assign(new Error(code), { code }); };

function pinnedOrigin(input) {
  let parsed;
  try { parsed = new URL(input); } catch { fail('R66_LOOPBACK_ORIGIN_REQUIRED'); }
  if (typeof input !== 'string' || parsed.origin !== input || parsed.protocol !== 'http:' ||
      !['127.0.0.1', '[::1]'].includes(parsed.hostname) || !parsed.port ||
      parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash)
    fail('R66_LOOPBACK_ORIGIN_REQUIRED');
  return parsed.origin;
}

async function boundedBody(response) {
  const reader = response.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > R66_LOOPBACK_LIMITS.responseBytes) {
        await reader.cancel();
        fail('R66_LOOPBACK_RESPONSE_TOO_LARGE');
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks, size);
}

export function createR66LoopbackObservationSender({ origin, trustedSource, timeoutMs = 5000 } = {}) {
  const target = pinnedOrigin(origin) + R66_OBSERVATION_PATH;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < R66_LOOPBACK_LIMITS.minimumTimeoutMs ||
      timeoutMs > R66_LOOPBACK_LIMITS.maximumTimeoutMs) fail('R66_LOOPBACK_TIMEOUT_INVALID');
  // Snapshot through strict JSON; no caller getters are evaluated or key values logged.
  let source;
  try { source = JSON.parse(canonicalR64Json(trustedSource)); }
  catch { fail('R66_LOOPBACK_TRUSTED_SOURCE_REQUIRED'); }
  if (source?.enabled !== true || source.evidenceKind !== 'SIGNED_QA_REPLAY' ||
      typeof source.publicKeyPem !== 'string') fail('R66_LOOPBACK_TRUSTED_SOURCE_REQUIRED');
  return async record => {
    const nowMs = Date.now();
    verifyR65ObservationRecord(record, { trustedSource: source, nowMs });
    const body = canonicalR64Json(record);
    if (Buffer.byteLength(body) > R66_LOOPBACK_LIMITS.requestBytes) fail('R66_LOOPBACK_REQUEST_TOO_LARGE');
    try {
      const response = await fetch(target, { method: 'POST',
        headers: { 'content-type': 'application/json' }, body,
        redirect: 'error', signal: AbortSignal.timeout(timeoutMs) });
      const bytes = await boundedBody(response);
      return new Response(bytes, { status: response.status,
        headers: { 'content-type': response.headers.get('content-type') || 'application/octet-stream' } });
    } catch (error) {
      if (error?.code === 'R66_LOOPBACK_RESPONSE_TOO_LARGE') throw error;
      fail('R66_LOOPBACK_REQUEST_UNCONFIRMED');
    }
  };
}
