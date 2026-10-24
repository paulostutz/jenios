/**
 * R71 — complete native-plus-policy records persisted before delivery.
 * Reuses the certified R66 filesystem/HMAC mechanism through a closed R71 profile.
 * Native R67 records remain unchanged. The last consumed runtime view is kept
 * durably to refuse regression after process restart; this is not an external
 * witness against restoration of the entire private directory.
 *
 * One complete B297 batch is the unit of persistence and idempotency. Its async
 * producer runs under the exclusive transaction lock; no duplicate operation can
 * enter it concurrently. Expiry is never renewed. Historical signature checks
 * use the original capture time only to inspect retained bytes, not to authorize
 * fresh admission. A crashed lock owner requires explicit host recovery.
 */
import { randomBytes, createHash } from 'node:crypto';
import { createPrivateDurableFile, canonicalPrivateDurableJson } from './robot-private-durable-file.mjs';
import { verifyR71PrivateObservationRecord, inspectR71IntakeAcknowledgement, r71CaptureInputDigest } from './robot-r71-private-protocol.mjs';
import { inspectR67TrustedSource, r67SourceKeyDigest, r67EventId, R67_BINDING } from './robot-r67-private-protocol.mjs';
import { inspectR71RuntimeView, canonicalR71Json } from './robot-r71-policy.mjs';
import { checkR71RuntimeContinuity } from './robot-r71-private-source.mjs';

export const R71_OUTBOX_LIMITS = Object.freeze({ maxBytes: 32 * 1024 * 1024,
  maxEntries: 5000, maxSessions: 1024, maxAttempts: 100 });
export const R71_OUTBOX_FILE = 'r71-private-policy-outbox.json';
export const R71_OUTBOX_LOCK = 'r71-private-policy-outbox.lock';
export const R71_DELIVERY_LOCK = 'r71-private-policy-delivery.lock';
const SCHEMA = 'JENIOS_R71_PRIVATE_POLICY_OUTBOX_V1';
const HEX = /^[a-f0-9]{64}$/, OP = /^op:[a-f0-9]{32}$/, SESSION = /^session:[a-f0-9]{16}$/;
const fail = code => { throw Object.assign(new Error(code), { name: 'ValidationError', code }); };
const integer = n => Number.isSafeInteger(n) && n >= 0;
const canonical = value => canonicalPrivateDurableJson(value, 'R71_PRIVATE_EVOLUTION');
const copy = value => JSON.parse(canonical(value));
const same = (a, b) => canonical(a) === canonical(b);
const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).length === keys.length && Object.keys(value).every(key => keys.includes(key));
const freeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze); Object.freeze(value);
  }
  return value;
};
const empty = trust => ({ schema: SCHEMA, revision: 0, scopeId: trust.source.scopeId,
  sourceId: trust.source.sourceId, sourceKeySha256: trust.fingerprint,
  runtimeBinding: R67_BINDING, lastRuntimeView: null, sessions: [], entries: [] });

function recordInputDigest(record) {
  const a = record.annotation;
  return r71CaptureInputDigest(a.purpose === 'VALIDATION' ? { purpose: a.purpose, planId: a.planId } :
    { purpose: a.purpose, scenarios: record.originalRecord.envelope.payload.scenarios,
      positionContexts: a.entries.map(e => ({ scenarioId: e.scenarioId, positionOpen: e.positionOpen })) });
}
function boundToView(record, input) {
  const view = inspectR71RuntimeView(input), a = record.annotation;
  if (a.stateRevision !== view.revision || a.stateDigest !== view.stateDigest ||
      a.scopeId !== view.scopeId || a.sourceId !== view.sourceId) fail('R71_OUTBOX_RUNTIME_VIEW');
  const version = a.purpose === 'VALIDATION' ? view.pendingEvaluation?.candidateVersion : view.activeVersion;
  if (!version || canonicalR71Json(version) !== canonicalR71Json(a.wrapperVersion)) fail('R71_OUTBOX_RUNTIME_VERSION');
  if (a.purpose === 'VALIDATION') {
    const plan = view.pendingEvaluation;
    if (a.planId !== plan.planId || a.capturedAtMs < plan.startsAtMs || a.capturedAtMs >= plan.endsAtMs)
      fail('R71_OUTBOX_VALIDATION_PLAN');
    const cases = new Map(plan.caseDefinitions.map(d => [d.caseId, d]));
    for (const [i, entry] of a.entries.entries()) {
      const definition = cases.get(entry.caseId);
      if (!definition || definition.positionOpen !== entry.positionOpen ||
          canonicalR71Json(definition.scenario) !== canonicalR71Json(record.originalRecord.envelope.payload.scenarios[i]))
        fail('R71_OUTBOX_VALIDATION_PLAN');
    }
  }
}

function validateSnapshot(raw, trust) {
  const value = copy(raw);
  if (!exact(value, ['schema', 'revision', 'scopeId', 'sourceId', 'sourceKeySha256', 'runtimeBinding', 'lastRuntimeView', 'sessions', 'entries']) ||
      value.schema !== SCHEMA || !integer(value.revision) || value.scopeId !== trust.source.scopeId ||
      value.sourceId !== trust.source.sourceId || value.sourceKeySha256 !== trust.fingerprint ||
      !same(value.runtimeBinding, R67_BINDING) || !Array.isArray(value.sessions) ||
      value.sessions.length > R71_OUTBOX_LIMITS.maxSessions || !Array.isArray(value.entries) ||
      value.entries.length > R71_OUTBOX_LIMITS.maxEntries) fail('R71_OUTBOX_INVALID_SNAPSHOT');
  if (value.lastRuntimeView !== null) checkR71RuntimeContinuity(null, value.lastRuntimeView, trust.source);
  if (value.entries.length && value.lastRuntimeView === null) fail('R71_OUTBOX_RUNTIME_VIEW');
  const sessions = new Map(), ops = new Set(), events = new Set(), attemptIds = new Set();
  for (const session of value.sessions) {
    if (!exact(session, ['sessionId', 'startedAtMs']) || typeof session.sessionId !== 'string' ||
        !SESSION.test(session.sessionId) || !integer(session.startedAtMs) || sessions.has(session.sessionId))
      fail('R71_OUTBOX_SESSION');
    sessions.set(session.sessionId, { count: 0, at: session.startedAtMs });
  }
  let attemptCount = 0;
  for (const entry of value.entries) {
    if (!exact(entry, ['operationId', 'inputDigest', 'record', 'attempts', 'expiredAtMs']) ||
        typeof entry.operationId !== 'string' || !OP.test(entry.operationId) || typeof entry.inputDigest !== 'string' ||
        !HEX.test(entry.inputDigest) || ops.has(entry.operationId) || !Array.isArray(entry.attempts) ||
        entry.attempts.length > R71_OUTBOX_LIMITS.maxAttempts) fail('R71_OUTBOX_ENTRY');
    const payload = entry.record?.annotation;
    if (!payload || !integer(payload.capturedAtMs) || payload.stateRevision > value.lastRuntimeView?.revision) fail('R71_OUTBOX_ENTRY');
    verifyR71PrivateObservationRecord(entry.record, { trustedSource: trust.source, nowMs: payload.capturedAtMs });
    const session = sessions.get(payload.sessionId);
    if (!session || payload.sequence !== session.count + 1 || payload.capturedAtMs < session.at ||
        events.has(payload.eventId) || entry.inputDigest !== recordInputDigest(entry.record))
      fail('R71_OUTBOX_SEQUENCE_BINDING');
    if (entry.record.originalRecord.provenance.operationId !== entry.operationId || payload.eventId !== r67EventId({
      scopeId: payload.scopeId, sourceId: payload.sourceId, sessionId: payload.sessionId,
      sequence: payload.sequence, operationId: entry.operationId })) fail('R71_OUTBOX_OPERATION_BINDING');
    session.count++; session.at = payload.capturedAtMs; ops.add(entry.operationId); events.add(payload.eventId);
    let latestAt = payload.capturedAtMs, acknowledged = false;
    for (const [index, attempt] of entry.attempts.entries()) {
      if (!exact(attempt, ['attemptId', 'startedAtMs', 'resolvedAtMs', 'outcome', 'ack']) ||
          typeof attempt.attemptId !== 'string' || !/^attempt:[a-f0-9]{32}$/.test(attempt.attemptId) ||
          attemptIds.has(attempt.attemptId) || !integer(attempt.startedAtMs) || attempt.startedAtMs < latestAt ||
          attempt.startedAtMs >= payload.expiresAtMs || acknowledged ||
          !['IN_FLIGHT', 'UNCERTAIN', 'ACKNOWLEDGED'].includes(attempt.outcome)) fail('R71_OUTBOX_ATTEMPT');
      if (attempt.outcome === 'IN_FLIGHT') {
        if (index !== entry.attempts.length - 1 || attempt.resolvedAtMs !== null || attempt.ack !== null)
          fail('R71_OUTBOX_ATTEMPT');
      } else {
        if (!integer(attempt.resolvedAtMs) || attempt.resolvedAtMs < attempt.startedAtMs) fail('R71_OUTBOX_ATTEMPT');
        if (attempt.outcome === 'ACKNOWLEDGED') {
          if (!exact(attempt.ack, ['httpStatus', 'body'])) fail('R71_OUTBOX_ACK_BINDING');
          inspectR71IntakeAcknowledgement(attempt.ack.body, entry.record, attempt.ack.httpStatus); acknowledged = true;
        } else if (attempt.ack !== null) fail('R71_OUTBOX_ATTEMPT');
      }
      latestAt = attempt.resolvedAtMs ?? attempt.startedAtMs; attemptIds.add(attempt.attemptId); attemptCount++;
    }
    if (entry.expiredAtMs !== null && (!integer(entry.expiredAtMs) || entry.expiredAtMs < payload.expiresAtMs ||
        entry.expiredAtMs < latestAt || acknowledged)) fail('R71_OUTBOX_EXPIRY');
  }
  if (value.revision < value.sessions.length + value.entries.length + attemptCount) fail('R71_OUTBOX_REVISION');
  return freeze(value);
}

export function r71DeliveryState(entry) {
  if (entry.attempts.at(-1)?.outcome === 'ACKNOWLEDGED') return 'ACKNOWLEDGED';
  if (entry.expiredAtMs !== null) return 'EXPIRED_UNCONFIRMED';
  if (entry.attempts.length) return 'UNCONFIRMED';
  return 'PENDING';
}

function diagnoseSnapshot(file, trust) {
  const { payload, ...inspection } = file.inspectReadOnly();
  if (!inspection.observationStable) return freeze({ ...inspection,
    snapshot: { ...inspection.snapshot, validated: false, revision: null }, queue: null, limits: R71_OUTBOX_LIMITS });
  const value = payload === null ? freeze(empty(trust)) : validateSnapshot(payload, trust);
  return freeze({ ...inspection, snapshot: { ...inspection.snapshot, validated: inspection.snapshot.present,
    revision: inspection.snapshot.present ? value.revision : null }, limits: R71_OUTBOX_LIMITS,
    queue: { scopeId: value.scopeId, sourceId: value.sourceId, sourceKeySha256: value.sourceKeySha256,
      revision: value.revision, sessionCount: value.sessions.length, entries: value.entries.map(entry => {
        const p = entry.record.annotation, last = entry.attempts.at(-1);
        return { sessionId: p.sessionId, sequence: p.sequence,
          recordSha256: createHash('sha256').update(canonical(entry.record)).digest('hex'),
          capturedAtMs: p.capturedAtMs, expiresAtMs: p.expiresAtMs, expiredAtMs: entry.expiredAtMs,
          persistedState: r71DeliveryState(entry), attemptCount: entry.attempts.length,
          lastAttemptOutcome: last?.outcome ?? null, lastAttemptAtMs: last?.resolvedAtMs ?? last?.startedAtMs ?? null };
      }) } });
}

/** This inspection creates no session and grants no authority to release a lock. */
export function diagnoseR71PrivateCaptureOutbox(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('R71_OUTBOX_CONFIG');
  const args = Object.getOwnPropertyDescriptors(input);
  if (Reflect.ownKeys(args).length !== 3 || !['directory', 'key', 'trustedSource'].every(k =>
      args[k] && args[k].enumerable && Object.hasOwn(args[k], 'value'))) fail('R71_OUTBOX_CONFIG');
  const { directory, key, trustedSource } = input;
  if (typeof key !== 'string' || !HEX.test(key)) fail('R71_OUTBOX_KEY_REQUIRED');
  const source = inspectR67TrustedSource(trustedSource), trust = { source, fingerprint: r67SourceKeyDigest(source) };
  return diagnoseSnapshot(createPrivateDurableFile({ profile: 'R71_PRIVATE_EVOLUTION', directory, key }), trust);
}

export function createR71PrivateCaptureOutbox(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('R71_OUTBOX_CONFIG');
  const args = Object.getOwnPropertyDescriptors(input);
  if (Reflect.ownKeys(args).length !== 3 || !['directory', 'key', 'trustedSource'].every(k =>
      args[k] && args[k].enumerable && Object.hasOwn(args[k], 'value'))) fail('R71_OUTBOX_CONFIG');
  const { directory, key, trustedSource } = input;
  if (typeof key !== 'string' || !HEX.test(key)) fail('R71_OUTBOX_KEY_REQUIRED');
  const source = inspectR67TrustedSource(trustedSource), trust = { source, fingerprint: r67SourceKeyDigest(source) };
  const file = createPrivateDurableFile({ profile: 'R71_PRIVATE_EVOLUTION', directory, key });
  function current(raw) { return raw === null ? freeze(empty(trust)) : validateSnapshot(raw, trust); }
  function read() { return current(file.readPayload()); }
  function commit(previous, next, change) {
    if (!change.changed) return { changed: false, value: change.value };
    next.revision = previous.revision + 1;
    return { changed: true, payload: validateSnapshot(next, trust), value: change.value };
  }
  const mutate = operation => file.transact(raw => {
    const previous = current(raw), next = copy(previous);
    return commit(previous, next, operation(next));
  });
  const mutateAsync = operation => file.transactAsync(async raw => {
    const previous = current(raw), next = copy(previous);
    return commit(previous, next, await operation(next));
  });
  function reserveSession({ sessionId, startedAtMs } = {}) {
    if (typeof sessionId !== 'string' || !SESSION.test(sessionId) || !integer(startedAtMs)) fail('R71_OUTBOX_SESSION');
    return mutate(next => {
      if (next.sessions.some(s => s.sessionId === sessionId)) fail('R71_OUTBOX_SESSION_REUSED');
      if (next.sessions.length >= R71_OUTBOX_LIMITS.maxSessions) fail('R71_OUTBOX_SESSION_LIMIT');
      next.sessions.push({ sessionId, startedAtMs });
      return { changed: true, value: { sessionId } };
    });
  }
  async function capture({ operationId, inputDigest, sessionId, produce } = {}) {
    if (typeof operationId !== 'string' || !OP.test(operationId) || typeof inputDigest !== 'string' ||
        !HEX.test(inputDigest) || typeof sessionId !== 'string' || !SESSION.test(sessionId) || typeof produce !== 'function')
      fail('R71_OUTBOX_CAPTURE');
    return mutateAsync(async next => {
      const previous = next.entries.find(e => e.operationId === operationId);
      if (previous) {
        if (previous.inputDigest !== inputDigest) fail('R71_OUTBOX_OPERATION_CONFLICT');
        return { changed: false, value: { record: previous.record, replayed: true } };
      }
      if (next.entries.length >= R71_OUTBOX_LIMITS.maxEntries) fail('R71_OUTBOX_ENTRY_LIMIT');
      if (!next.sessions.some(s => s.sessionId === sessionId)) fail('R71_OUTBOX_SESSION');
      const result = await produce({ lastRuntimeView: next.lastRuntimeView });
      if (!exact(result, ['record', 'runtimeView'])) fail('R71_OUTBOX_CAPTURE_RESULT');
      const record = copy(result.record);
      if (record.annotation?.sessionId !== sessionId || recordInputDigest(record) !== inputDigest ||
          record.originalRecord.provenance?.operationId !== operationId) fail('R71_OUTBOX_CAPTURE_BINDING');
      const runtimeView = checkR71RuntimeContinuity(next.lastRuntimeView, result.runtimeView, trust.source);
      boundToView(record, runtimeView);
      next.lastRuntimeView = runtimeView;
      next.entries.push({ operationId, inputDigest, record, attempts: [], expiredAtMs: null });
      return { changed: true, value: { record, replayed: false } };
    });
  }
  function expire({ nowMs } = {}) {
    if (!integer(nowMs)) fail('R71_OUTBOX_CLOCK');
    return mutate(next => {
      let count = 0;
      for (const entry of next.entries) {
        if (entry.expiredAtMs === null && r71DeliveryState(entry) !== 'ACKNOWLEDGED' && nowMs >= entry.record.annotation.expiresAtMs) {
          entry.expiredAtMs = nowMs; count++;
        }
      }
      return { changed: count > 0, value: { expired: count } };
    });
  }
  function beginAttempt({ operationId, nowMs } = {}) {
    if (typeof operationId !== 'string' || !OP.test(operationId) || !integer(nowMs)) fail('R71_OUTBOX_ATTEMPT');
    return mutate(next => {
      const entry = next.entries.find(e => e.operationId === operationId);
      if (!entry || ['ACKNOWLEDGED', 'EXPIRED_UNCONFIRMED'].includes(r71DeliveryState(entry)) ||
          nowMs >= entry.record.annotation.expiresAtMs || entry.attempts.length >= R71_OUTBOX_LIMITS.maxAttempts)
        fail('R71_OUTBOX_ATTEMPT_FORBIDDEN');
      const p = entry.record.annotation;
      if (next.entries.some(e => e.record.annotation.sessionId === p.sessionId &&
          e.record.annotation.sequence < p.sequence && r71DeliveryState(e) !== 'ACKNOWLEDGED'))
        fail('R71_OUTBOX_PRIOR_SEQUENCE_UNCONFIRMED');
      const prior = entry.attempts.at(-1);
      if (prior?.outcome === 'IN_FLIGHT') { prior.outcome = 'UNCERTAIN'; prior.resolvedAtMs = nowMs; }
      const attemptId = 'attempt:' + randomBytes(16).toString('hex');
      entry.attempts.push({ attemptId, startedAtMs: nowMs, resolvedAtMs: null, outcome: 'IN_FLIGHT', ack: null });
      return { changed: true, value: { attemptId, record: entry.record } };
    });
  }
  function resolveAttempt({ operationId, attemptId, nowMs, acknowledgement = null } = {}) {
    if (typeof operationId !== 'string' || !OP.test(operationId) || typeof attemptId !== 'string' ||
        !/^attempt:[a-f0-9]{32}$/.test(attemptId) || !integer(nowMs)) fail('R71_OUTBOX_ATTEMPT');
    return mutate(next => {
      const entry = next.entries.find(e => e.operationId === operationId), attempt = entry?.attempts.at(-1);
      if (!attempt || attempt.attemptId !== attemptId || attempt.outcome !== 'IN_FLIGHT') fail('R71_OUTBOX_ATTEMPT_BINDING');
      if (acknowledgement !== null) {
        if (entry.expiredAtMs !== null || !exact(acknowledgement, ['body', 'httpStatus'])) fail('R71_OUTBOX_ACK_BINDING');
        attempt.ack = inspectR71IntakeAcknowledgement(acknowledgement.body, entry.record, acknowledgement.httpStatus);
        attempt.outcome = 'ACKNOWLEDGED';
      } else attempt.outcome = 'UNCERTAIN';
      attempt.resolvedAtMs = nowMs;
      return { changed: true, value: { operationId, state: r71DeliveryState(entry) } };
    });
  }
  const withDeliveryLease = operation => file.withDeliveryLease(operation);
  const diagnose = () => diagnoseSnapshot(file, trust);
  read();
  return Object.freeze({ read, reserveSession, capture, expire, beginAttempt, resolveAttempt, withDeliveryLease, diagnose });
}
