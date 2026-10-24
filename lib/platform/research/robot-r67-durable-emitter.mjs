/** R67 original private source + distinct durable batch outbox. No hosted or
 * operational activation. New process = new session, exact old records retained.
 * Expired ambiguous batches block their later session sequences; no re-signing.
 */
import { randomBytes } from 'node:crypto';
import { createR67PrivateCoreSource } from './robot-r67-private-source.mjs';
import { createR67PrivateCaptureOutbox, r67DeliveryState, R67_OUTBOX_LIMITS } from './robot-r67-private-capture-outbox.mjs';
import { R67_ORIGIN, R67_EVIDENCE, R67_BINDING, R67_INVARIANTS, fieldsR67,
  freezeR67, inspectR67Scenarios, r67InputDigest, inspectR67IntakeAcknowledgement } from './robot-r67-private-protocol.mjs';
const fail = code => { throw Object.assign(new Error(code), { name: 'ValidationError', code }); };
const CONFIG = ['enabled', 'domain', 'directory', 'key', 'scopeId', 'sourceId', 'privateKeyPem', 'handle', 'now'];
const integer = n => Number.isSafeInteger(n) && n >= 0;
async function responseBody(response) {
  if (!(response instanceof Response) || ![200, 202].includes(response.status) || response.redirected ||
      !/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type') || '')) fail('R67_DELIVERY_RESPONSE');
  const length = response.headers.get('content-length');
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > 8192)) fail('R67_DELIVERY_RESPONSE_SIZE');
  if (!response.body) fail('R67_DELIVERY_RESPONSE');
  const reader = response.body.getReader(), chunks = []; let size = 0;
  try {
    for (;;) {
      const part = await reader.read(); if (part.done) break;
      size += part.value.byteLength;
      if (size > 8192) { await reader.cancel(); fail('R67_DELIVERY_RESPONSE_SIZE'); }
      chunks.push(Buffer.from(part.value));
    }
  } finally { reader.releaseLock(); }
  try { return JSON.parse(Buffer.concat(chunks, size).toString('utf8')); }
  catch { fail('R67_DELIVERY_RESPONSE_JSON'); }
}
const earlierUnconfirmed = (entries, entry) => entries.some(prior =>
  prior.record.envelope.payload.sessionId === entry.record.envelope.payload.sessionId &&
  prior.record.envelope.payload.sequence < entry.record.envelope.payload.sequence && r67DeliveryState(prior) !== 'ACKNOWLEDGED');
export function createR67DurableEmitter(input = {}) {
  const c = fieldsR67(input, CONFIG, CONFIG.filter(k => k !== 'now'), 'R67_EMITTER_CONFIG');
  if (c.enabled !== true || c.domain !== R67_ORIGIN) fail('R67_EMITTER_DISABLED');
  if (c.now !== undefined && typeof c.now !== 'function') fail('R67_EMITTER_CONFIG');
  const now = c.now ?? Date.now, sessionId = 'session:' + randomBytes(8).toString('hex');
  const source = createR67PrivateCoreSource({ enabled: true, domain: c.domain, handle: c.handle,
    scopeId: c.scopeId, sourceId: c.sourceId, sessionId, privateKeyPem: c.privateKeyPem, now });
  const trustedSource = source.trustedSource;
  const outbox = createR67PrivateCaptureOutbox({ directory: c.directory, key: c.key, trustedSource });
  outbox.reserveSession({ sessionId, startedAtMs: now() });
  let invalidated = false;
  const ensureHealthy = () => { if (invalidated) fail('R67_EMITTER_REOPEN_REQUIRED'); };
  async function captureBatch(input) {
    ensureHealthy();
    const cmd = fieldsR67(input, ['operationId', 'scenarios'], ['operationId', 'scenarios'], 'R67_EMITTER_COMMAND');
    const scenarios = inspectR67Scenarios(cmd.scenarios), inputDigest = r67InputDigest(scenarios);
    const current = outbox.read();
    // Exact committed retries remain available even if the old batch expired.
    if (!current.entries.some(e => e.operationId === cmd.operationId) && current.entries.some(e =>
        e.record.envelope.payload.sessionId === sessionId && r67DeliveryState(e) !== 'ACKNOWLEDGED' &&
        now() >= e.record.envelope.payload.expiresAtMs)) fail('R67_EMITTER_SESSION_EXPIRED_REOPEN_REQUIRED');
    let produced = false;
    try {
      const result = await outbox.capture({ operationId: cmd.operationId, inputDigest, sessionId, produce: async () => {
        const record = await source.captureBatch({ operationId: cmd.operationId, scenarios });
        produced = true; return { record };
      } });
      return result.record;
    } catch (error) {
      if (produced || /^R67_OUTBOX_(?:DIRECTORY|FILE|LOCK|OWNERSHIP|HMAC|INVALID|COMMIT|SIZE)/.test(error?.code || ''))
        invalidated = true;
      throw error;
    }
  }
  function inspect() {
    const base = { schema: 'JENIOS_R67_DURABLE_EMITTER_STATE_V1', sessionId, scopeId: c.scopeId, sourceId: c.sourceId,
      ...R67_BINDING, evidenceKind: R67_EVIDENCE, runtimeOrigin: R67_ORIGIN, ...R67_INVARIANTS,
      durableOutbox: true, runtimeRestored: false, freshSessionAfterRestart: true,
      orphanLockRecovery: 'EXPLICIT_HOST_RECOVERY', invalidated, reopenRequired: invalidated };
    if (invalidated) return freezeR67({ ...base, queue: null });
    const snapshot = outbox.read(), queue = { total: snapshot.entries.length, pending: 0, acknowledged: 0,
      unconfirmed: 0, expiredUnconfirmed: 0, blockedByEarlierUnconfirmed: 0 };
    for (const entry of snapshot.entries) {
      const state = r67DeliveryState(entry);
      queue[{ PENDING: 'pending', ACKNOWLEDGED: 'acknowledged', UNCONFIRMED: 'unconfirmed',
        EXPIRED_UNCONFIRMED: 'expiredUnconfirmed' }[state]]++;
      if (['PENDING', 'UNCONFIRMED'].includes(state) && earlierUnconfirmed(snapshot.entries, entry)) queue.blockedByEarlierUnconfirmed++;
    }
    return freezeR67({ ...base, outboxRevision: snapshot.revision, nextSequence: source.inspect().nextSequence, queue });
  }
  async function flush(input = {}) {
    ensureHealthy();
    const f = fieldsR67(input, ['send', 'limit'], ['send'], 'R67_DELIVERY_CONFIG'), limit = f.limit ?? 20;
    if (typeof f.send !== 'function' || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) fail('R67_DELIVERY_CONFIG');
    // The host's sender must bound both request and response body. The provided
    // loopback sender does so. Do not race a sender with a timer releasing lease.
    return outbox.withDeliveryLease(async () => {
      let attempted = 0, acknowledged = 0, expired = 0, unconfirmed = 0, stoppedReason = null;
      for (let index = 0; index < limit; index++) {
        const at = now(); if (!integer(at)) fail('R67_DELIVERY_CLOCK');
        expired += outbox.expire({ nowMs: at }).expired;
        const snapshot = outbox.read(), pending = snapshot.entries.filter(e => ['PENDING', 'UNCONFIRMED'].includes(r67DeliveryState(e)));
        const entry = pending.find(e => !earlierUnconfirmed(snapshot.entries, e));
        if (!entry) { if (pending.length) stoppedReason = 'EXPIRED_SESSION_REQUIRES_NEW_SESSION'; break; }
        if (entry.attempts.length >= R67_OUTBOX_LIMITS.maxAttempts) { stoppedReason = 'ATTEMPT_LIMIT'; break; }
        const { attemptId, record } = outbox.beginAttempt({ operationId: entry.operationId, nowMs: at }); attempted++;
        let acknowledgement = null;
        try {
          const response = await f.send(record), body = await responseBody(response);
          acknowledgement = inspectR67IntakeAcknowledgement(body, record, response.status);
        } catch { stoppedReason = 'SEND_UNCONFIRMED'; }
        const resolvedAtMs = now();
        if (!integer(resolvedAtMs) || resolvedAtMs < at) { invalidated = true; fail('R67_DELIVERY_CLOCK'); }
        try { outbox.resolveAttempt({ operationId: entry.operationId, attemptId, nowMs: resolvedAtMs, acknowledgement }); }
        catch (error) { invalidated = true; throw error; }
        if (acknowledgement) acknowledged++;
        else { unconfirmed++; break; }
      }
      return freezeR67({ schema: 'JENIOS_R67_PRIVATE_FLUSH_RESULT_V1', attempted, acknowledged, expired,
        unconfirmed, stoppedReason, evidenceKind: R67_EVIDENCE, runtimeOrigin: R67_ORIGIN, ...R67_INVARIANTS });
    });
  }
  return Object.freeze({ trustedSource, sessionId, captureBatch, inspect, flush });
}
