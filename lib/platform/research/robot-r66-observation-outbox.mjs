/**
 * R66 — local durable queue for the unchanged signed R65 QA protocol.
 * The original signed record is fsynced before capture returns. No network is
 * performed here. Signatures are inspected at their ORIGINAL capture time for
 * historical integrity only; transmission still observes the original expiry.
 *
 * HMAC and private filesystem ownership protect local state, not an external
 * monotonic witness. Replacing the entire directory with an older valid backup
 * is not detectable here. Never auto-remove an orphan lock: host recovery must
 * first establish exclusive ownership and inspect the completed snapshot.
 */
import {
  constants, openSync, closeSync, fstatSync, lstatSync, realpathSync, readSync,
  writeFileSync, fsyncSync, fchmodSync, renameSync, unlinkSync,
} from 'node:fs';
import { createHash, createHmac, createPublicKey, timingSafeEqual, randomBytes } from 'node:crypto';
import { isAbsolute, resolve, relative, join, sep, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyR65ObservationRecord } from './robot-r65-observation-source.mjs';
import { inspectR65EvolutionState } from './robot-r65-evolution-engine.mjs';
import { canonicalR64Json } from './robot-r64-telemetry.mjs';

export const R66_OUTBOX_LIMITS = Object.freeze({ maxBytes: 32 * 1024 * 1024,
  maxEntries: 5000, maxSessions: 1024, maxAttempts: 100 });
export const R66_OUTBOX_FILE = 'r66-observation-outbox.json';
export const R66_OUTBOX_LOCK = 'r66-observation-outbox.lock';
export const R66_DELIVERY_LOCK = 'r66-observation-delivery.lock';
const SCHEMA = 'JENIOS_R66_OBSERVATION_OUTBOX_V1';
const ENVELOPE = 'JENIOS_R66_LOCAL_HMAC_ENVELOPE_V1';
const DOMAIN = 'JENIOS_R66_LOCAL_OBSERVATION_OUTBOX_V1\0';
const HEX = /^[a-f0-9]{64}$/;
const OP = /^op:[a-f0-9]{32}$/;
const SESSION = /^session:[a-f0-9]{16}$/;
const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const fail = code => { throw Object.assign(new Error(code), { name: 'ValidationError', code }); };
const integer = n => Number.isSafeInteger(n) && n >= 0;
const sha = input => createHash('sha256').update(input).digest('hex');
const sameFile = (a, b) => a.dev === b.dev && a.ino === b.ino;
const privateMode = (stat, mode) => (stat.mode & 0o7777) === mode;
const descendant = (root, candidate) => {
  const rel = relative(root, candidate);
  return rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel));
};
const freeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze); Object.freeze(value);
  }
  return value;
};
// Canonical JSON rejects accessor properties, prototypes, non-finite numbers,
// sparse arrays and extra array properties. It never calls toJSON/toString.
function canonical(input) {
  let visited = 0;
  function encode(value, depth) {
    if (++visited > 500000 || depth > 64) fail('R66_OUTBOX_JSON_LIMIT');
    if (value === null || typeof value === 'boolean') return JSON.stringify(value);
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) fail('R66_OUTBOX_NON_JSON_VALUE');
      return JSON.stringify(value);
    }
    if (typeof value === 'string') {
      if (value.length > R66_OUTBOX_LIMITS.maxBytes) fail('R66_OUTBOX_JSON_LIMIT');
      return JSON.stringify(value);
    }
    if (!value || typeof value !== 'object') fail('R66_OUTBOX_NON_JSON_VALUE');
    if (Array.isArray(value)) {
      const properties = Object.getOwnPropertyDescriptors(value);
      const keys = Reflect.ownKeys(properties);
      if (keys.length !== value.length + 1 || keys.some(key =>
        key !== 'length' && (typeof key !== 'string' || !/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= value.length)))
        fail('R66_OUTBOX_NON_JSON_VALUE');
      const encoded = [];
      for (let index = 0; index < value.length; index++) {
        const property = properties[String(index)];
        if (!property || !Object.hasOwn(property, 'value') || !property.enumerable) fail('R66_OUTBOX_NON_JSON_VALUE');
        encoded.push(encode(property.value, depth + 1));
      }
      return `[${encoded.join(',')}]`;
    }
    if (![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail('R66_OUTBOX_NON_JSON_VALUE');
    const properties = Object.getOwnPropertyDescriptors(value), keys = Reflect.ownKeys(properties);
    if (keys.some(key => typeof key !== 'string' || !Object.hasOwn(properties[key], 'value') || !properties[key].enumerable))
      fail('R66_OUTBOX_NON_JSON_VALUE');
    return `{${keys.sort().map(key => `${JSON.stringify(key)}:${encode(properties[key].value, depth + 1)}`).join(',')}}`;
  }
  return encode(input, 0);
}
const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).length === keys.length && Object.keys(value).every(key => keys.includes(key));
const sameJson = (a, b) => canonical(a) === canonical(b);

function noSymlinks(directory) {
  let current = sep;
  for (const part of directory.split(sep).filter(Boolean)) {
    current = join(current, part);
    const stat = lstatSync(current);
    if (stat.isSymbolicLink() || !stat.isDirectory()) fail('R66_OUTBOX_DIRECTORY_UNSAFE');
  }
}
function openDirectory(directory) {
  if (typeof process.getuid !== 'function' || !constants.O_NOFOLLOW || !constants.O_DIRECTORY)
    fail('R66_OUTBOX_PLATFORM_UNSUPPORTED');
  if (typeof directory !== 'string' || !isAbsolute(directory) || directory.includes('\0'))
    fail('R66_OUTBOX_DIRECTORY_UNSAFE');
  const path = resolve(directory), cwd = realpathSync(process.cwd());
  if (descendant(cwd, path) || descendant(REPOSITORY_ROOT, path)) fail('R66_OUTBOX_IN_REPOSITORY_FORBIDDEN');
  let descriptor;
  try {
    noSymlinks(path);
    const stat = lstatSync(path);
    if (realpathSync(path) !== path || !stat.isDirectory() || stat.uid !== process.getuid() || !privateMode(stat, 0o700))
      fail('R66_OUTBOX_DIRECTORY_UNSAFE');
    descriptor = openSync(path, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
    const opened = fstatSync(descriptor);
    if (!sameFile(stat, opened)) fail('R66_OUTBOX_DIRECTORY_UNSAFE');
    return { path, descriptor, stat: opened };
  } catch (error) {
    if (descriptor !== undefined) closeSync(descriptor);
    if (error?.code?.startsWith('R66_')) throw error;
    fail('R66_OUTBOX_DIRECTORY_UNSAFE');
  }
}
function checkDirectory(context) {
  noSymlinks(context.path);
  const stat = lstatSync(context.path);
  if (!sameFile(stat, context.stat) || stat.uid !== process.getuid() || !privateMode(stat, 0o700))
    fail('R66_OUTBOX_DIRECTORY_CHANGED');
}
function absentLock(context) {
  try { lstatSync(join(context.path, R66_OUTBOX_LOCK)); } catch (error) {
    if (error?.code === 'ENOENT') return;
    fail('R66_OUTBOX_LOCK_UNSAFE');
  }
  fail('R66_OUTBOX_LOCKED');
}
function safeFile(stat) {
  if (!stat.isFile() || stat.uid !== process.getuid() || stat.nlink !== 1 || !privateMode(stat, 0o600))
    fail('R66_OUTBOX_FILE_UNSAFE');
}
function readBoundedFile(context) {
  let descriptor;
  try {
    descriptor = openSync(join(context.path, R66_OUTBOX_FILE), constants.O_RDONLY | constants.O_NOFOLLOW);
    const before = fstatSync(descriptor); safeFile(before);
    if (before.size < 1 || before.size > R66_OUTBOX_LIMITS.maxBytes) fail('R66_OUTBOX_SIZE_LIMIT');
    const bytes = Buffer.alloc(before.size + 1);
    let total = 0;
    while (total < bytes.length) {
      const count = readSync(descriptor, bytes, total, bytes.length - total, null);
      if (count === 0) break;
      total += count;
    }
    const after = fstatSync(descriptor);
    if (total !== before.size || after.size !== before.size || after.mtimeMs !== before.mtimeMs || after.ctimeMs !== before.ctimeMs)
      fail('R66_OUTBOX_FILE_CHANGED');
    return bytes.subarray(0, total).toString('utf8');
  } catch (error) {
    if (descriptor === undefined && error?.code === 'ENOENT') return null;
    if (error?.code?.startsWith('R66_')) throw error;
    fail('R66_OUTBOX_FILE_UNSAFE');
  } finally { if (descriptor !== undefined) closeSync(descriptor); }
}
function acquireLock(context, filename = R66_OUTBOX_LOCK) {
  const path = join(context.path, filename);
  let descriptor;
  try {
    descriptor = openSync(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    fchmodSync(descriptor, 0o600);
    const stat = fstatSync(descriptor), token = randomBytes(16).toString('hex');
    writeFileSync(descriptor, JSON.stringify({ pid: process.pid, token }), 'utf8');
    fsyncSync(descriptor);
    return { path, stat, token };
  } catch (error) {
    if (error?.code === 'EEXIST') fail('R66_OUTBOX_LOCKED');
    fail('R66_OUTBOX_LOCK_UNSAFE');
  } finally { if (descriptor !== undefined) closeSync(descriptor); }
}
function removeOwned(path, stat) {
  let actual;
  try { actual = lstatSync(path); } catch (error) { if (error?.code === 'ENOENT') return; throw error; }
  if (!sameFile(actual, stat) || !actual.isFile() || actual.uid !== process.getuid()) fail('R66_OUTBOX_OWNERSHIP_CHANGED');
  unlinkSync(path);
}
function releaseLock(context, lock) {
  checkDirectory(context);
  let descriptor;
  try {
    descriptor = openSync(lock.path, constants.O_RDONLY | constants.O_NOFOLLOW);
    const stat = fstatSync(descriptor); safeFile(stat);
    if (!sameFile(stat, lock.stat) || stat.size < 1 || stat.size > 256) fail('R66_OUTBOX_OWNERSHIP_CHANGED');
    const bytes = Buffer.alloc(stat.size + 1);
    const length = readSync(descriptor, bytes, 0, bytes.length, 0);
    if (length !== stat.size) fail('R66_OUTBOX_OWNERSHIP_CHANGED');
    let stored;
    try { stored = JSON.parse(bytes.subarray(0, length).toString('utf8')); }
    catch { fail('R66_OUTBOX_OWNERSHIP_CHANGED'); }
    if (!sameJson(stored, { pid: process.pid, token: lock.token })) fail('R66_OUTBOX_OWNERSHIP_CHANGED');
  } catch (error) {
    if (error?.code?.startsWith('R66_')) throw error;
    fail('R66_OUTBOX_OWNERSHIP_CHANGED');
  } finally { if (descriptor !== undefined) closeSync(descriptor); }
  removeOwned(lock.path, lock.stat);
  fsyncSync(context.descriptor);
}


const copy = input => JSON.parse(canonical(input));
function trustRoot(input) {
  const source = copy(input);
  if (!exact(source, ['scopeId', 'sourceId', 'publicKeyPem', 'enabled', 'evidenceKind']) ||
      !/^scope:[a-f0-9]{16}$/.test(source.scopeId) || !/^source:[a-f0-9]{16}$/.test(source.sourceId) ||
      source.enabled !== true || source.evidenceKind !== 'SIGNED_QA_REPLAY' ||
      typeof source.publicKeyPem !== 'string' || source.publicKeyPem.length > 4096) fail('R66_OUTBOX_TRUST_ROOT');
  let key;
  try { key = createPublicKey(source.publicKeyPem); } catch { fail('R66_OUTBOX_TRUST_ROOT'); }
  if (key.asymmetricKeyType !== 'ed25519') fail('R66_OUTBOX_TRUST_ROOT');
  return { source: freeze(source), fingerprint: sha(key.export({ format: 'der', type: 'spki' })) };
}
function evolution(value, previous, scopeId) {
  const state = inspectR65EvolutionState(value);
  if (state.scopeId !== scopeId || (previous && (state.createdAtMs !== previous.createdAtMs ||
      state.revision < previous.revision || state.updatedAtMs < previous.updatedAtMs ||
      !sameJson(state.journal.slice(0, previous.revision), previous.journal))))
    fail('R66_OUTBOX_EVOLUTION_REGRESSION');
  return state;
}
const ACK_KEYS = ['schema', 'status', 'eventId', 'scopeId', 'observationEvidenceKind',
  'runtimeOrigin', 'validationEvidenceKind', 'customerMonitoringActive',
  'privateEngineConnected', 'realOrdersSent', 'externalPaperOrdersSent'];
/** This validates the existing HTTP protocol, not an independent server signature. */
export function inspectR66IntakeAcknowledgement(input, record, httpStatus) {
  const value = copy(input), payload = record.envelope.payload;
  if (!exact(value, ACK_KEYS) || value.schema !== 'JENIOS_R65_INTAKE_RESULT_V1' ||
      !((httpStatus === 202 && value.status === 'STORED') || (httpStatus === 200 && value.status === 'ALREADY_STORED')) ||
      value.eventId !== payload.eventId || value.scopeId !== payload.scopeId ||
      value.observationEvidenceKind !== 'SIGNED_QA_REPLAY' || value.runtimeOrigin !== 'R61_SYNTHETIC_RUNTIME' ||
      value.validationEvidenceKind !== 'SYNTHETIC_FIXTURE' || value.customerMonitoringActive !== false ||
      value.privateEngineConnected !== false || value.realOrdersSent !== 0 || value.externalPaperOrdersSent !== 0)
    fail('R66_OUTBOX_ACK_BINDING');
  return freeze({ httpStatus, body: value });
}
const empty = trust => ({ schema: SCHEMA, revision: 0, scopeId: trust.source.scopeId,
  sourceId: trust.source.sourceId, sourceKeySha256: trust.fingerprint,
  evolutionState: null, sessions: [], entries: [] });
function validateSnapshot(raw, trust) {
  const value = copy(raw);
  if (!exact(value, ['schema', 'revision', 'scopeId', 'sourceId', 'sourceKeySha256', 'evolutionState', 'sessions', 'entries']) ||
      value.schema !== SCHEMA || !integer(value.revision) || value.scopeId !== trust.source.scopeId ||
      value.sourceId !== trust.source.sourceId || value.sourceKeySha256 !== trust.fingerprint ||
      !Array.isArray(value.sessions) || value.sessions.length > R66_OUTBOX_LIMITS.maxSessions ||
      !Array.isArray(value.entries) || value.entries.length > R66_OUTBOX_LIMITS.maxEntries)
    fail('R66_OUTBOX_INVALID_SNAPSHOT');
  if (value.evolutionState === null) {
    if (value.revision || value.sessions.length || value.entries.length) fail('R66_OUTBOX_INVALID_SNAPSHOT');
  } else value.evolutionState = evolution(value.evolutionState, null, value.scopeId);
  const sessions = new Map(), ops = new Set(), events = new Set(), attemptIds = new Set();
  for (const session of value.sessions) {
    if (!exact(session, ['sessionId', 'startedAtMs']) || !SESSION.test(session.sessionId) ||
        !integer(session.startedAtMs) || sessions.has(session.sessionId)) fail('R66_OUTBOX_SESSION');
    sessions.set(session.sessionId, { ...session, count: 0, at: session.startedAtMs, occurredAtMs: -1 });
  }
  let attemptCount = 0;
  for (const entry of value.entries) {
    if (!exact(entry, ['operationId', 'inputDigest', 'record', 'attempts', 'expiredAtMs']) ||
        !OP.test(entry.operationId) || !HEX.test(entry.inputDigest) || ops.has(entry.operationId) ||
        !Array.isArray(entry.attempts) || entry.attempts.length > R66_OUTBOX_LIMITS.maxAttempts)
      fail('R66_OUTBOX_ENTRY');
    const payload = entry.record?.envelope?.payload;
    if (!payload || !integer(payload.event?.capturedAtMs)) fail('R66_OUTBOX_ENTRY');
    // Historical verification deliberately uses capture time. It cannot authorize
    // fresh admission of an expired record, and is never used by the transmitter.
    verifyR65ObservationRecord(entry.record, { trustedSource: trust.source, nowMs: payload.event.capturedAtMs });
    const session = sessions.get(payload.sessionId);
    if (!session || payload.sequence !== session.count + 1 || payload.event.capturedAtMs < session.at ||
        payload.event.occurredAtMs < session.occurredAtMs || events.has(payload.eventId) ||
        entry.inputDigest !== entry.record.provenance.inputDigest ||
        entry.record.provenance.activationGeneration > value.evolutionState.activeVersion.activationGeneration)
      fail('R66_OUTBOX_SEQUENCE_BINDING');
    const expectedEventId = 'evt:' + sha('JENIOS_R65_SOURCE_EVENT_V1\0' + canonicalR64Json({
      scopeId: payload.scopeId, sourceId: payload.sourceId, sessionId: payload.sessionId,
      sequence: payload.sequence, operationId: entry.operationId })).slice(0, 16);
    if (expectedEventId !== payload.eventId) fail('R66_OUTBOX_OPERATION_BINDING');
    session.count++; session.at = payload.event.capturedAtMs; session.occurredAtMs = payload.event.occurredAtMs;
    ops.add(entry.operationId); events.add(payload.eventId);
    let latestAt = payload.event.capturedAtMs, acknowledged = false;
    for (const [index, attempt] of entry.attempts.entries()) {
      if (!exact(attempt, ['attemptId', 'startedAtMs', 'resolvedAtMs', 'outcome', 'ack']) ||
          !/^attempt:[a-f0-9]{32}$/.test(attempt.attemptId) || attemptIds.has(attempt.attemptId) ||
          !integer(attempt.startedAtMs) || attempt.startedAtMs < latestAt || attempt.startedAtMs >= payload.expiresAtMs ||
          acknowledged || !['IN_FLIGHT', 'UNCERTAIN', 'ACKNOWLEDGED'].includes(attempt.outcome))
        fail('R66_OUTBOX_ATTEMPT');
      if (attempt.outcome === 'IN_FLIGHT') {
        if (index !== entry.attempts.length - 1 || attempt.resolvedAtMs !== null || attempt.ack !== null)
          fail('R66_OUTBOX_ATTEMPT');
      } else {
        if (!integer(attempt.resolvedAtMs) || attempt.resolvedAtMs < attempt.startedAtMs) fail('R66_OUTBOX_ATTEMPT');
        if (attempt.outcome === 'ACKNOWLEDGED') {
          if (!exact(attempt.ack, ['httpStatus', 'body'])) fail('R66_OUTBOX_ACK_BINDING');
          inspectR66IntakeAcknowledgement(attempt.ack.body, entry.record, attempt.ack.httpStatus);
          acknowledged = true;
        } else if (attempt.ack !== null) fail('R66_OUTBOX_ATTEMPT');
      }
      latestAt = attempt.resolvedAtMs ?? attempt.startedAtMs;
      attemptIds.add(attempt.attemptId); attemptCount++;
    }
    if (entry.expiredAtMs !== null) {
      if (!integer(entry.expiredAtMs) || entry.expiredAtMs < payload.expiresAtMs ||
          entry.expiredAtMs < latestAt || acknowledged) fail('R66_OUTBOX_EXPIRY');
    }
  }
  if (value.revision < value.sessions.length + value.entries.length + attemptCount)
    fail('R66_OUTBOX_REVISION');
  return freeze(value);
}
const signature = (payload, key) => createHmac('sha256', key).update(DOMAIN).update(canonical(payload)).digest();
function load(context, key, trust) {
  checkDirectory(context);
  const text = readBoundedFile(context);
  if (text === null) return freeze(empty(trust));
  let envelope;
  try { envelope = JSON.parse(text); } catch { fail('R66_OUTBOX_INVALID_JSON'); }
  if (!exact(envelope, ['schema', 'payload', 'hmac']) || envelope.schema !== ENVELOPE ||
      typeof envelope.hmac !== 'string' || !HEX.test(envelope.hmac)) fail('R66_OUTBOX_INVALID_ENVELOPE');
  if (!timingSafeEqual(signature(envelope.payload, key), Buffer.from(envelope.hmac, 'hex')))
    fail('R66_OUTBOX_HMAC_MISMATCH');
  return validateSnapshot(envelope.payload, trust);
}
function write(context, secret, snapshot) {
  const bytes = Buffer.from(canonical({ schema: ENVELOPE, payload: snapshot,
    hmac: signature(snapshot, secret).toString('hex') }), 'utf8');
  if (bytes.length > R66_OUTBOX_LIMITS.maxBytes) fail('R66_OUTBOX_SIZE_LIMIT');
  checkDirectory(context);
  const temporary = join(context.path, `.r66-outbox.${randomBytes(16).toString('hex')}.tmp`);
  let temporaryStat, renamed = false;
  try {
    const descriptor = openSync(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    try {
      temporaryStat = fstatSync(descriptor); fchmodSync(descriptor, 0o600);
      writeFileSync(descriptor, bytes); fsyncSync(descriptor);
    } finally { closeSync(descriptor); }
    checkDirectory(context);
    // Once rename is attempted, failure is uncertain and the transaction retains
    // its lock. A later host recovery must inspect, never guess or reset state.
    try {
      renameSync(temporary, join(context.path, R66_OUTBOX_FILE)); renamed = true;
      fsyncSync(context.descriptor);
    } catch (cause) { throw Object.assign(new Error('R66_OUTBOX_COMMIT_UNCERTAIN'),
      { name: 'ValidationError', code: 'R66_OUTBOX_COMMIT_UNCERTAIN', cause }); }
  } finally { if (!renamed && temporaryStat) removeOwned(temporary, temporaryStat); }
}
export function r66DeliveryState(entry) {
  if (entry.attempts.at(-1)?.outcome === 'ACKNOWLEDGED') return 'ACKNOWLEDGED';
  if (entry.expiredAtMs !== null) return 'EXPIRED_UNCONFIRMED';
  if (entry.attempts.length) return 'UNCONFIRMED';
  return 'PENDING';
}

export function createR66ObservationOutbox(input) {
  if (!input || typeof input !== 'object') fail('R66_OUTBOX_CONFIG');
  const args = Object.getOwnPropertyDescriptors(input);
  if (Reflect.ownKeys(args).length !== 3 || !['directory', 'key', 'trustedSource'].every(k =>
      args[k] && args[k].enumerable && Object.hasOwn(args[k], 'value'))) fail('R66_OUTBOX_CONFIG');
  const { directory, key, trustedSource } = input;
  if (typeof key !== 'string' || !HEX.test(key)) fail('R66_OUTBOX_KEY_REQUIRED');
  const trust = trustRoot(trustedSource);
  function read() {
    const secret = Buffer.from(key, 'hex'), context = openDirectory(directory);
    try { absentLock(context); const current = load(context, secret, trust); absentLock(context); return current; }
    finally { closeSync(context.descriptor); secret.fill(0); }
  }
  function mutate(operation) {
    const secret = Buffer.from(key, 'hex'), context = openDirectory(directory);
    let lock, keepLock = false;
    try {
      lock = acquireLock(context); fsyncSync(context.descriptor);
      const current = load(context, secret, trust), next = copy(current);
      const change = operation(next);
      if (change.changed) {
        next.revision = current.revision + 1;
        const validated = validateSnapshot(next, trust);
        try { write(context, secret, validated); }
        catch (error) { if (error.code === 'R66_OUTBOX_COMMIT_UNCERTAIN') keepLock = true; throw error; }
      }
      return freeze(change.value);
    } finally {
      try { if (lock && !keepLock) releaseLock(context, lock); }
      finally { closeSync(context.descriptor); secret.fill(0); }
    }
  }
  function reserveSession({ sessionId, startedAtMs, evolutionState } = {}) {
    if (!SESSION.test(sessionId) || !integer(startedAtMs)) fail('R66_OUTBOX_SESSION');
    return mutate(next => {
      if (next.sessions.some(s => s.sessionId === sessionId)) fail('R66_OUTBOX_SESSION_REUSED');
      if (next.sessions.length >= R66_OUTBOX_LIMITS.maxSessions) fail('R66_OUTBOX_SESSION_LIMIT');
      const state = evolution(evolutionState, next.evolutionState, next.scopeId);
      if (startedAtMs < state.updatedAtMs) fail('R66_OUTBOX_SESSION_CLOCK');
      next.evolutionState = copy(state); next.sessions.push({ sessionId, startedAtMs });
      return { changed: true, value: { sessionId } };
    });
  }
  function capture({ operationId, inputDigest, sessionId, produce } = {}) {
    if (!OP.test(operationId) || !HEX.test(inputDigest) || !SESSION.test(sessionId) || typeof produce !== 'function')
      fail('R66_OUTBOX_CAPTURE');
    return mutate(next => {
      const previous = next.entries.find(e => e.operationId === operationId);
      if (previous) {
        if (previous.inputDigest !== inputDigest) fail('R66_OUTBOX_OPERATION_CONFLICT');
        return { changed: false, value: { record: previous.record, replayed: true } };
      }
      if (next.entries.length >= R66_OUTBOX_LIMITS.maxEntries) fail('R66_OUTBOX_ENTRY_LIMIT');
      if (!next.sessions.some(s => s.sessionId === sessionId)) fail('R66_OUTBOX_SESSION');
      const result = produce();
      if (!exact(result, ['record', 'evolutionState'])) fail('R66_OUTBOX_CAPTURE_RESULT');
      const state = evolution(result.evolutionState, next.evolutionState, next.scopeId), record = copy(result.record);
      if (record.envelope?.payload?.sessionId !== sessionId || record.provenance?.inputDigest !== inputDigest ||
          record.provenance?.activationGeneration !== state.activeVersion.activationGeneration ||
          record.provenance?.policyVersion !== state.activeVersion.versionId) fail('R66_OUTBOX_CAPTURE_BINDING');
      next.evolutionState = copy(state);
      next.entries.push({ operationId, inputDigest, record, attempts: [], expiredAtMs: null });
      return { changed: true, value: { record, replayed: false } };
    });
  }
  function expire({ nowMs } = {}) {
    if (!integer(nowMs)) fail('R66_OUTBOX_CLOCK');
    return mutate(next => {
      let count = 0;
      for (const entry of next.entries) {
        if (entry.expiredAtMs === null && r66DeliveryState(entry) !== 'ACKNOWLEDGED' && nowMs >= entry.record.envelope.payload.expiresAtMs) {
          entry.expiredAtMs = nowMs; count++;
        }
      }
      // Revision counts operations; one expiry call may mark several records.
      // Validator consequently does not equate revision with expired-row count.
      return { changed: count > 0, value: { expired: count } };
    });
  }
  function beginAttempt({ operationId, nowMs } = {}) {
    if (!OP.test(operationId) || !integer(nowMs)) fail('R66_OUTBOX_ATTEMPT');
    return mutate(next => {
      const entry = next.entries.find(e => e.operationId === operationId);
      if (!entry || ['ACKNOWLEDGED', 'EXPIRED_UNCONFIRMED'].includes(r66DeliveryState(entry)) ||
          nowMs >= entry.record.envelope.payload.expiresAtMs || entry.attempts.length >= R66_OUTBOX_LIMITS.maxAttempts)
        fail('R66_OUTBOX_ATTEMPT_FORBIDDEN');
      const prior = entry.attempts.at(-1);
      if (prior?.outcome === 'IN_FLIGHT') { prior.outcome = 'UNCERTAIN'; prior.resolvedAtMs = nowMs; }
      const attemptId = 'attempt:' + randomBytes(16).toString('hex');
      entry.attempts.push({ attemptId, startedAtMs: nowMs, resolvedAtMs: null, outcome: 'IN_FLIGHT', ack: null });
      return { changed: true, value: { attemptId, record: entry.record } };
    });
  }
  function resolveAttempt({ operationId, attemptId, nowMs, acknowledgement = null } = {}) {
    if (!OP.test(operationId) || !/^attempt:[a-f0-9]{32}$/.test(attemptId) || !integer(nowMs)) fail('R66_OUTBOX_ATTEMPT');
    return mutate(next => {
      const entry = next.entries.find(e => e.operationId === operationId), attempt = entry?.attempts.at(-1);
      if (!attempt || attempt.attemptId !== attemptId || attempt.outcome !== 'IN_FLIGHT') fail('R66_OUTBOX_ATTEMPT_BINDING');
      if (acknowledgement !== null) {
        if (entry.expiredAtMs !== null || !exact(acknowledgement, ['body', 'httpStatus'])) fail('R66_OUTBOX_ACK_BINDING');
        attempt.ack = inspectR66IntakeAcknowledgement(acknowledgement.body, entry.record, acknowledgement.httpStatus);
        attempt.outcome = 'ACKNOWLEDGED';
      } else attempt.outcome = 'UNCERTAIN';
      attempt.resolvedAtMs = nowMs;
      return { changed: true, value: { operationId, state: r66DeliveryState(entry) } };
    });
  }
  async function withDeliveryLease(operation) {
    if (typeof operation !== 'function') fail('R66_DELIVERY_OPERATION');
    const context = openDirectory(directory); let lock;
    try { lock = acquireLock(context, R66_DELIVERY_LOCK); fsyncSync(context.descriptor); return await operation(); }
    finally { try { if (lock) releaseLock(context, lock); } finally { closeSync(context.descriptor); } }
  }
  read();
  return Object.freeze({ read, reserveSession, capture, expire, beginAttempt, resolveAttempt, withDeliveryLease });
}
