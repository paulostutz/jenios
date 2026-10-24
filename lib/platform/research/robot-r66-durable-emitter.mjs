/**
 * R66 — durable wrapper around the unchanged R65 QA emitter.
 *
 * Opening a wrapper reserves a NEW session. Old signed records and operation
 * IDs survive restart, but old runtime history/freshness does not. A retry of an
 * earlier operation returns exactly its committed record, never advancing the
 * new runtime. The first two NEW fresh observations are required after opening.
 *
 * Capture has no transport. flush requires an explicit host-supplied sender and
 * only accepts the existing R65 Response contract. The host must pin the QA
 * destination and enforce a deadline covering request AND response body. This
 * generic queue never races an untrusted callback with a timer that would release
 * its delivery lease while the callback can still send. The R66 loopback sender
 * supplies the bounded transport for the certified path. No operational source,
 * provider, order or hosted worker is enabled.
 */
import { createPrivateKey, createPublicKey, randomBytes } from 'node:crypto';
import { createR65ObservationSource } from './robot-r65-observation-source.mjs';
import { canonicalR64Json, digestR64Value } from './robot-r64-telemetry.mjs';
import { inspectR65EvolutionState } from './robot-r65-evolution-engine.mjs';
import { createR66ObservationOutbox, r66DeliveryState, inspectR66IntakeAcknowledgement,
  R66_OUTBOX_LIMITS } from './robot-r66-observation-outbox.mjs';

const fail = code => { throw Object.assign(new Error(code), { name: 'ValidationError', code }); };
const integer = n => Number.isSafeInteger(n) && n >= 0;
const freeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze); Object.freeze(value);
  }
  return value;
};
const copy = v => JSON.parse(canonicalR64Json(v));
const invariants = () => ({ observationEvidenceKind: 'SIGNED_QA_REPLAY', runtimeOrigin: 'R61_SYNTHETIC_RUNTIME',
  validationEvidenceKind: 'SYNTHETIC_FIXTURE', customerMonitoringActive: false, privateEngineConnected: false,
  executionAllowed: false, realOrdersSent: 0, externalPaperOrdersSent: 0, paidProviderCalls: 0,
  actualBrokerPnl: null, actualLossesAvoided: null, realTradeAccuracy: null, commercialPerformanceCertified: false });
function fields(input, allowed, required, code) {
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(input))) fail(code);
  const d = Object.getOwnPropertyDescriptors(input), keys = Reflect.ownKeys(d);
  if (keys.some(k => typeof k !== 'string' || !allowed.includes(k) || !d[k].enumerable || !Object.hasOwn(d[k], 'value')) ||
      required.some(k => !Object.hasOwn(d, k))) fail(code);
  return Object.fromEntries(keys.map(k => [k, d[k].value]));
}
const CONFIG = ['enabled', 'domain', 'directory', 'key', 'scopeId', 'sourceId', 'privateKeyPem',
  'getActiveState', 'ultraConfig', 'now'];
const REQUIRED = CONFIG.filter(k => k !== 'now');

async function boundedResponse(response) {
  if (!(response instanceof Response) || ![200, 202].includes(response.status) || response.redirected ||
      !/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type') || '')) fail('R66_DELIVERY_RESPONSE');
  const length = response.headers.get('content-length');
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > 8192)) fail('R66_DELIVERY_RESPONSE_SIZE');
  if (!response.body) fail('R66_DELIVERY_RESPONSE');
  const reader = response.body.getReader(), chunks = []; let size = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > 8192) { await reader.cancel(); fail('R66_DELIVERY_RESPONSE_SIZE'); }
      chunks.push(Buffer.from(part.value));
    }
  } finally { reader.releaseLock(); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { fail('R66_DELIVERY_RESPONSE_JSON'); }
}

export function createR66DurableEmitter(input = {}) {
  const c = fields(input, CONFIG, REQUIRED, 'R66_EMITTER_CONFIG');
  if (c.enabled !== true) fail('R66_EMITTER_DISABLED');
  if (c.domain !== 'R61_SYNTHETIC_RUNTIME') fail('R66_OPERATIONAL_SOURCE_INACTIVE');
  if (typeof c.getActiveState !== 'function' || (c.now !== undefined && typeof c.now !== 'function'))
    fail('R66_EMITTER_CONFIG');
  const now = c.now ?? Date.now;
  let key;
  try { key = createPrivateKey(c.privateKeyPem); } catch { fail('R66_EMITTER_SIGNING_KEY'); }
  if (key.asymmetricKeyType !== 'ed25519') fail('R66_EMITTER_SIGNING_KEY');
  const publicKeyPem = createPublicKey(key).export({ type: 'spki', format: 'pem' });
  const trustedSource = freeze({ scopeId: c.scopeId, sourceId: c.sourceId, publicKeyPem,
    enabled: true, evidenceKind: 'SIGNED_QA_REPLAY' });
  const ultra = copy(c.ultraConfig);
  if (!ultra || typeof ultra !== 'object' || Array.isArray(ultra) || Object.hasOwn(ultra, 'sessionId'))
    fail('R66_EMITTER_SESSION_MUST_BE_NEW');
  const outbox = createR66ObservationOutbox({ directory: c.directory, key: c.key, trustedSource });
  const sessionId = 'session:' + randomBytes(8).toString('hex');
  let latestState;
  const source = createR65ObservationSource({ enabled: true, domain: c.domain, scopeId: c.scopeId,
    sourceId: c.sourceId, sessionId, privateKeyPem: c.privateKeyPem,
    getActiveState: () => { latestState = inspectR65EvolutionState(c.getActiveState()); return latestState; },
    initialSequence: 1, now, ultraConfig: { ...ultra, sessionId } });
  const startedAtMs = now();
  outbox.reserveSession({ sessionId, startedAtMs, evolutionState: latestState });
  let invalidated = false;
  const ensureHealthy = () => { if (invalidated) fail('R66_EMITTER_REOPEN_REQUIRED'); };
  function capture(kind, raw) {
    ensureHealthy();
    const field = kind === 'assisted' ? 'input' : 'event';
    const command = fields(copy(raw), ['operationId', field], ['operationId', field], 'R66_EMITTER_COMMAND');
    if (typeof command.operationId !== 'string' || !/^op:[a-f0-9]{32}$/.test(command.operationId))
      fail('R66_EMITTER_OPERATION_ID');
    const inputDigest = digestR64Value({ kind, [field]: command[field] });
    let sourceAdvanced = false;
    try {
      const result = outbox.capture({ operationId: command.operationId, inputDigest, sessionId, produce: () => {
        const record = kind === 'assisted' ? source.captureAssisted(command) : source.captureUltra(command);
        sourceAdvanced = true;
        return { record, evolutionState: latestState };
      } });
      return result.record;
    } catch (error) {
      // Once capture advanced locally, no later error may leave a usable runtime
      // whose history contains a decision that was not durably confirmed.
      if (sourceAdvanced || /^R66_OUTBOX_(?:DIRECTORY|FILE|LOCK|OWNERSHIP|HMAC|INVALID|COMMIT|SIZE)/.test(error?.code || ''))
        invalidated = true;
      throw error;
    }
  }
  function inspect() {
    const local = source.inspect();
    if (invalidated) return freeze({ schema: 'JENIOS_R66_DURABLE_EMITTER_STATE_V1', sessionId,
      invalidated: true, reopenRequired: true, durableOutbox: true, queue: null, ...invariants() });
    const snapshot = outbox.read(), queue = { total: snapshot.entries.length, pending: 0, acknowledged: 0,
      unconfirmed: 0, expiredUnconfirmed: 0 };
    for (const entry of snapshot.entries) {
      const state = r66DeliveryState(entry);
      queue[{ PENDING: 'pending', ACKNOWLEDGED: 'acknowledged', UNCONFIRMED: 'unconfirmed',
        EXPIRED_UNCONFIRMED: 'expiredUnconfirmed' }[state]]++;
    }
    return freeze({ schema: 'JENIOS_R66_DURABLE_EMITTER_STATE_V1', sessionId, scopeId: c.scopeId,
      sourceId: c.sourceId, nextSequence: local.nextSequence, ultraEventCount: local.ultraEventCount,
      ultraStatus: local.ultraStatus, policyVersion: local.policyVersion, activationGeneration: local.activationGeneration,
      outboxRevision: snapshot.revision, queue, durableOutbox: true, runtimeRestored: false,
      freshSessionAfterRestart: true, newFreshConfirmationsRequired: 2, orphanLockRecovery: 'EXPLICIT_HOST_RECOVERY',
      invalidated: false, reopenRequired: false, ...invariants() });
  }
  async function flush(input = {}) {
    ensureHealthy();
    const f = fields(input, ['send', 'limit'], ['send'], 'R66_DELIVERY_CONFIG');
    const limit = f.limit ?? 20;
    if (typeof f.send !== 'function' || !Number.isSafeInteger(limit) || limit < 1 || limit > 100)
      fail('R66_DELIVERY_CONFIG');
    return outbox.withDeliveryLease(async () => {
      let attempted = 0, acknowledged = 0, expired = 0, unconfirmed = 0, stoppedReason = null;
      for (let index = 0; index < limit; index++) {
        const at = now(); if (!integer(at)) fail('R66_DELIVERY_CLOCK');
        expired += outbox.expire({ nowMs: at }).expired;
        const snapshot = outbox.read();
        const entry = snapshot.entries.find(e => ['PENDING', 'UNCONFIRMED'].includes(r66DeliveryState(e)));
        if (!entry) break;
        if (entry.attempts.length >= R66_OUTBOX_LIMITS.maxAttempts) { stoppedReason = 'ATTEMPT_LIMIT'; break; }
        const { attemptId, record } = outbox.beginAttempt({ operationId: entry.operationId, nowMs: at });
        attempted++;
        let acknowledgement = null;
        try {
          const response = await f.send(record);
          const body = await boundedResponse(response);
          acknowledgement = inspectR66IntakeAcknowledgement(body, record, response.status);
        } catch {
          // Never store exception text: it could contain endpoint tokens or keys.
          stoppedReason = 'SEND_UNCONFIRMED';
        }
        const resolvedAtMs = now();
        if (!integer(resolvedAtMs) || resolvedAtMs < at) { invalidated = true; fail('R66_DELIVERY_CLOCK'); }
        try {
          outbox.resolveAttempt({ operationId: entry.operationId, attemptId, nowMs: resolvedAtMs, acknowledgement });
        } catch (error) { invalidated = true; throw error; }
        if (acknowledgement) acknowledged++;
        else { unconfirmed++; break; }
      }
      return freeze({ schema: 'JENIOS_R66_FLUSH_RESULT_V1', attempted, acknowledged, expired,
        unconfirmed, stoppedReason, ...invariants() });
    });
  }
  return Object.freeze({ trustedSource, sessionId,
    captureAssisted: command => capture('assisted', command),
    captureUltra: command => capture('ultra', command), inspect, flush });
}
