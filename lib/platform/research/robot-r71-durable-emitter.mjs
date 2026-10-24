/** R71 original private source + distinct durable batch outbox. No hosted or
 * operational activation. New process = new session, exact old records retained.
 * Expired ambiguous batches block their later session sequences; no re-signing.
 */
import { randomBytes } from 'node:crypto';
import { createR71PrivateCoreSource, checkR71RuntimeContinuity } from './robot-r71-private-source.mjs';
import { createR71PrivateCaptureOutbox, r71DeliveryState, R71_OUTBOX_LIMITS } from './robot-r71-private-capture-outbox.mjs';
import { inspectR67Scenarios, R67_BINDING } from './robot-r67-private-protocol.mjs';
import { fieldsR71, freezeR71, R71_BOUNDARIES } from './robot-r71-policy.mjs';
import { R71_RUNTIME_ORIGIN, inspectR71PositionContexts, r71CaptureInputDigest, inspectR71IntakeAcknowledgement } from './robot-r71-private-protocol.mjs';
const fail = code => { throw Object.assign(new Error(code), { name: 'ValidationError', code }); };
const CONFIG = ['enabled', 'directory', 'key', 'scopeId', 'sourceId', 'privateKeyPem', 'handle', 'getActiveState', 'now'];
const integer = n => Number.isSafeInteger(n) && n >= 0;
async function responseBody(response) {
  if (!(response instanceof Response) || ![200, 202].includes(response.status) || response.redirected ||
      !/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type') || '')) fail('R71_DELIVERY_RESPONSE');
  const length = response.headers.get('content-length');
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > 8192)) fail('R71_DELIVERY_RESPONSE_SIZE');
  if (!response.body) fail('R71_DELIVERY_RESPONSE');
  const reader = response.body.getReader(), chunks = []; let size = 0;
  try {
    for (;;) {
      const part = await reader.read(); if (part.done) break;
      size += part.value.byteLength;
      if (size > 8192) { await reader.cancel(); fail('R71_DELIVERY_RESPONSE_SIZE'); }
      chunks.push(Buffer.from(part.value));
    }
  } finally { reader.releaseLock(); }
  try { return JSON.parse(Buffer.concat(chunks, size).toString('utf8')); }
  catch { fail('R71_DELIVERY_RESPONSE_JSON'); }
}
const earlierUnconfirmed = (entries, entry) => entries.some(prior =>
  prior.record.annotation.sessionId === entry.record.annotation.sessionId &&
  prior.record.annotation.sequence < entry.record.annotation.sequence && r71DeliveryState(prior) !== 'ACKNOWLEDGED');
export function createR71DurableEmitter(input = {}) {
  const c = fieldsR71(input, CONFIG, CONFIG.filter(k => k !== 'now'), 'R71_EMITTER_CONFIG');
  if (c.enabled !== true) fail('R71_EMITTER_DISABLED');
  if (typeof c.getActiveState !== 'function') fail('R71_EMITTER_CONFIG');
  if (c.now !== undefined && typeof c.now !== 'function') fail('R71_EMITTER_CONFIG');
  const now = c.now ?? Date.now, sessionId = 'session:' + randomBytes(8).toString('hex');
  let minimumView = null;
  const source = createR71PrivateCoreSource({ enabled: true, handle: c.handle,
    scopeId: c.scopeId, sourceId: c.sourceId, sessionId, privateKeyPem: c.privateKeyPem, now,
    getActiveState: async () => checkR71RuntimeContinuity(minimumView, await c.getActiveState(), source.trustedSource) });
  const trustedSource = source.trustedSource;
  const outbox = createR71PrivateCaptureOutbox({ directory: c.directory, key: c.key, trustedSource });
  minimumView = outbox.read().lastRuntimeView;
  outbox.reserveSession({ sessionId, startedAtMs: now() });
  let invalidated = false;
  const ensureHealthy = () => { if (invalidated) fail('R71_EMITTER_REOPEN_REQUIRED'); };
  async function capture(purpose, input) {
    ensureHealthy();
    const cmd = purpose === 'OBSERVATION' ? fieldsR71(input, ['operationId', 'scenarios', 'positionContexts'],
      ['operationId', 'scenarios', 'positionContexts'], 'R71_EMITTER_COMMAND') :
      fieldsR71(input, ['operationId', 'planId'], ['operationId', 'planId'], 'R71_EMITTER_COMMAND');
    const scenarios = purpose === 'OBSERVATION' ? inspectR67Scenarios(cmd.scenarios) : null;
    const positionContexts = purpose === 'OBSERVATION' ? inspectR71PositionContexts(cmd.positionContexts, scenarios) : null;
    const inputDigest = r71CaptureInputDigest(purpose === 'OBSERVATION' ? { purpose, scenarios, positionContexts } :
      { purpose, planId: cmd.planId });
    const current = outbox.read();
    // Exact committed retries remain available even if the old batch expired.
    if (!current.entries.some(e => e.operationId === cmd.operationId) && current.entries.some(e =>
        e.record.annotation.sessionId === sessionId && r71DeliveryState(e) !== 'ACKNOWLEDGED' &&
        now() >= e.record.annotation.expiresAtMs)) fail('R71_EMITTER_SESSION_EXPIRED_REOPEN_REQUIRED');
    let produced = false;
    try {
      const result = await outbox.capture({ operationId: cmd.operationId, inputDigest, sessionId, produce: async ({ lastRuntimeView }) => {
        minimumView = lastRuntimeView;
        const record = purpose === 'OBSERVATION'
          ? await source.captureBatch({ operationId: cmd.operationId, scenarios, positionContexts })
          : await source.captureValidation({ operationId: cmd.operationId, planId: cmd.planId });
        produced = true; minimumView = source.inspect().lastRuntimeView;
        return { record, runtimeView: minimumView };
      } });
      return result.record;
    } catch (error) {
      if (produced || /^R71_OUTBOX_(?:DIRECTORY|FILE|LOCK|OWNERSHIP|HMAC|INVALID|COMMIT|SIZE)/.test(error?.code || ''))
        invalidated = true;
      throw error;
    }
  }
  function inspect() {
    const base = { schema: 'JENIOS_R71_DURABLE_EMITTER_STATE_V1', sessionId, scopeId: c.scopeId, sourceId: c.sourceId,
      coreBinding: R67_BINDING, runtimeOrigin: R71_RUNTIME_ORIGIN, ...R71_BOUNDARIES,
      nativeAnalysesCompleted: source.inspect().nativeAnalysesCompleted,
      durableOutbox: true, runtimeRestored: false, freshSessionAfterRestart: true,
      orphanLockRecovery: 'EXPLICIT_HOST_RECOVERY', invalidated, reopenRequired: invalidated };
    if (invalidated) return freezeR71({ ...base, queue: null });
    const snapshot = outbox.read(), queue = { total: snapshot.entries.length, pending: 0, acknowledged: 0,
      unconfirmed: 0, expiredUnconfirmed: 0, blockedByEarlierUnconfirmed: 0 };
    for (const entry of snapshot.entries) {
      const state = r71DeliveryState(entry);
      queue[{ PENDING: 'pending', ACKNOWLEDGED: 'acknowledged', UNCONFIRMED: 'unconfirmed',
        EXPIRED_UNCONFIRMED: 'expiredUnconfirmed' }[state]]++;
      if (['PENDING', 'UNCONFIRMED'].includes(state) && earlierUnconfirmed(snapshot.entries, entry)) queue.blockedByEarlierUnconfirmed++;
    }
    return freezeR71({ ...base, outboxRevision: snapshot.revision, nextSequence: source.inspect().nextSequence,
      lastRuntimeView: snapshot.lastRuntimeView, queue });
  }
  async function flush(input = {}) {
    ensureHealthy();
    const f = fieldsR71(input, ['send', 'limit'], ['send'], 'R71_DELIVERY_CONFIG'), limit = f.limit ?? 20;
    if (typeof f.send !== 'function' || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) fail('R71_DELIVERY_CONFIG');
    // The host's sender must bound both request and response body. The provided
    // loopback sender does so. Do not race a sender with a timer releasing lease.
    return outbox.withDeliveryLease(async () => {
      let attempted = 0, acknowledged = 0, expired = 0, unconfirmed = 0, stoppedReason = null;
      for (let index = 0; index < limit; index++) {
        const at = now(); if (!integer(at)) fail('R71_DELIVERY_CLOCK');
        expired += outbox.expire({ nowMs: at }).expired;
        const snapshot = outbox.read(), pending = snapshot.entries.filter(e => ['PENDING', 'UNCONFIRMED'].includes(r71DeliveryState(e)));
        const entry = pending.find(e => !earlierUnconfirmed(snapshot.entries, e));
        if (!entry) { if (pending.length) stoppedReason = 'EXPIRED_SESSION_REQUIRES_NEW_SESSION'; break; }
        if (entry.attempts.length >= R71_OUTBOX_LIMITS.maxAttempts) { stoppedReason = 'ATTEMPT_LIMIT'; break; }
        const { attemptId, record } = outbox.beginAttempt({ operationId: entry.operationId, nowMs: at }); attempted++;
        let acknowledgement = null;
        try {
          const response = await f.send(record), body = await responseBody(response);
          acknowledgement = inspectR71IntakeAcknowledgement(body, record, response.status);
        } catch { stoppedReason = 'SEND_UNCONFIRMED'; }
        const resolvedAtMs = now();
        if (!integer(resolvedAtMs) || resolvedAtMs < at) { invalidated = true; fail('R71_DELIVERY_CLOCK'); }
        try { outbox.resolveAttempt({ operationId: entry.operationId, attemptId, nowMs: resolvedAtMs, acknowledgement }); }
        catch (error) { invalidated = true; throw error; }
        if (acknowledgement) acknowledged++;
        else { unconfirmed++; break; }
      }
      return freezeR71({ schema: 'JENIOS_R71_PRIVATE_POLICY_FLUSH_RESULT_V1', attempted, acknowledged, expired,
        unconfirmed, stoppedReason, runtimeOrigin: R71_RUNTIME_ORIGIN, ...R71_BOUNDARIES });
    });
  }
  return Object.freeze({ trustedSource, sessionId, captureBatch: input => capture('OBSERVATION', input),
    captureValidation: input => capture('VALIDATION', input), inspect, flush });
}
