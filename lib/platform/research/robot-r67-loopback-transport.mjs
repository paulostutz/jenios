/** Explicit isolated QA transport. Literal loopback, no DNS/redirect/credentials.
 * It cannot target a hosted service, customer feed, provider or broker. */
import { canonicalR67Json, R67_LIMITS, inspectR67TrustedSource,
  verifyR67PrivateObservationRecord } from './robot-r67-private-protocol.mjs';
export const R67_OBSERVATION_PATH = '/api/platform/robot-private-observations';
const fail = code => { throw Object.assign(new Error(code), { code }); };
function origin(input) {
  let p; try { p = new URL(input); } catch { fail('R67_LOOPBACK_ORIGIN_REQUIRED'); }
  if (typeof input !== 'string' || p.origin !== input || p.protocol !== 'http:' ||
      !['127.0.0.1', '[::1]'].includes(p.hostname) || !p.port || p.username || p.password ||
      p.pathname !== '/' || p.search || p.hash) fail('R67_LOOPBACK_ORIGIN_REQUIRED');
  return p.origin;
}
export function createR67LoopbackObservationSender({ origin: input, trustedSource, timeoutMs = 5000 } = {}) {
  const target = origin(input) + R67_OBSERVATION_PATH, source = inspectR67TrustedSource(trustedSource);
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 50 || timeoutMs > 10000) fail('R67_LOOPBACK_TIMEOUT_INVALID');
  return async record => {
    verifyR67PrivateObservationRecord(record, { trustedSource: source, nowMs: Date.now() });
    const body = canonicalR67Json(record);
    if (Buffer.byteLength(body) > R67_LIMITS.maxBytes) fail('R67_LOOPBACK_REQUEST_TOO_LARGE');
    try {
      const response = await fetch(target, { method: 'POST', headers: { 'content-type': 'application/json' },
        body, redirect: 'error', signal: AbortSignal.timeout(timeoutMs) });
      const reader = response.body?.getReader(), chunks = []; let size = 0;
      if (!reader) fail('R67_LOOPBACK_RESPONSE_REQUIRED');
      try {
        for (;;) {
          const part = await reader.read(); if (part.done) break;
          size += part.value.byteLength;
          if (size > 8192) { await reader.cancel(); fail('R67_LOOPBACK_RESPONSE_TOO_LARGE'); }
          chunks.push(Buffer.from(part.value));
        }
      } finally { reader.releaseLock(); }
      return new Response(Buffer.concat(chunks, size), { status: response.status,
        headers: { 'content-type': response.headers.get('content-type') || 'application/octet-stream' } });
    } catch (error) {
      if (error?.code === 'R67_LOOPBACK_RESPONSE_TOO_LARGE') throw error;
      fail('R67_LOOPBACK_REQUEST_UNCONFIRMED');
    }
  };
}
