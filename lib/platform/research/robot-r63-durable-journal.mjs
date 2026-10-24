/**
 * R63 — private LOCAL durable outbox for synthetic research cycles.
 * HMAC authenticates this local envelope to a configured secret, not a broker,
 * customer consent, real execution, notification delivery or profitability.
 * Every read reconstructs study, evolution and report. Append-only CAS rejects
 * divergent state branches. Replacing the entire directory with an older valid
 * backup cannot be detected without an independent monotonic witness.
 *
 * A crashed process may leave its lock. Never steal/remove somebody else's lock:
 * explicit operator recovery is required. A successful append is fsynced before
 * the lock is released. No network, database migration or application write path.
 */
import {
  constants, openSync, closeSync, fstatSync, lstatSync, realpathSync, readSync,
  writeFileSync, fsyncSync, fchmodSync, renameSync, unlinkSync,
} from 'node:fs';
import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto';
import { isAbsolute, resolve, relative, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { studyR63Observations } from './robot-r63-observation-study.mjs';
import { inspectR63EvolutionState } from './robot-r63-continuous-evolution.mjs';
import { buildR63AdminReport } from './robot-r63-admin-report.mjs';

export const R63_JOURNAL_LIMITS = Object.freeze({ maxBytes: 8 * 1024 * 1024, maxEntries: 100 });
export const R63_JOURNAL_FILE = 'r63-journal.json';
export const R63_JOURNAL_LOCK = 'r63-journal.lock';
export const R63_WORKER_LOCK = 'r63-worker.lock';
const SCHEMA = 'JENIOS_R63_DURABLE_JOURNAL_V1';
const ENVELOPE = 'JENIOS_R63_LOCAL_HMAC_ENVELOPE_V1';
const DOMAIN = 'JENIOS_R63_DURABLE_JOURNAL_V1\0';
const CYCLE = /^cycle:[a-f0-9]{16}$/;
const HEX = /^[a-f0-9]{64}$/;
const REPOSITORY_ROOT = resolve(fileURLToPath(new URL('../../../', import.meta.url)));
const fail = code => { throw Object.assign(new Error(code), { code }); };
const sameFile = (a, b) => a.dev === b.dev && a.ino === b.ino;
const privateMode = (stat, mode) => (stat.mode & 0o7777) === mode;
const descendant = (root, candidate) => {
  const rel = relative(root, candidate);
  return rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel));
};
const freeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
};

// Canonical JSON rejects accessor properties, prototypes, non-finite numbers,
// sparse arrays and extra array properties. It never calls toJSON/toString.
function canonical(input) {
  let visited = 0;
  function encode(value, depth) {
    if (++visited > 500000 || depth > 64) fail('R63_JOURNAL_JSON_LIMIT');
    if (value === null || typeof value === 'boolean') return JSON.stringify(value);
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) fail('R63_JOURNAL_NON_JSON_VALUE');
      return JSON.stringify(value);
    }
    if (typeof value === 'string') {
      if (value.length > R63_JOURNAL_LIMITS.maxBytes) fail('R63_JOURNAL_JSON_LIMIT');
      return JSON.stringify(value);
    }
    if (!value || typeof value !== 'object') fail('R63_JOURNAL_NON_JSON_VALUE');
    if (Array.isArray(value)) {
      const properties = Object.getOwnPropertyDescriptors(value);
      const keys = Reflect.ownKeys(properties);
      if (keys.length !== value.length + 1 || keys.some(key =>
        key !== 'length' && (typeof key !== 'string' || !/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= value.length)))
        fail('R63_JOURNAL_NON_JSON_VALUE');
      const encoded = [];
      for (let index = 0; index < value.length; index++) {
        const property = properties[String(index)];
        if (!property || !Object.hasOwn(property, 'value') || !property.enumerable) fail('R63_JOURNAL_NON_JSON_VALUE');
        encoded.push(encode(property.value, depth + 1));
      }
      return `[${encoded.join(',')}]`;
    }
    if (![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail('R63_JOURNAL_NON_JSON_VALUE');
    const properties = Object.getOwnPropertyDescriptors(value), keys = Reflect.ownKeys(properties);
    if (keys.some(key => typeof key !== 'string' || !Object.hasOwn(properties[key], 'value') || !properties[key].enumerable))
      fail('R63_JOURNAL_NON_JSON_VALUE');
    return `{${keys.sort().map(key => `${JSON.stringify(key)}:${encode(properties[key].value, depth + 1)}`).join(',')}}`;
  }
  return encode(input, 0);
}
const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).length === keys.length && Object.keys(value).every(key => keys.includes(key));
const sameJson = (a, b) => canonical(a) === canonical(b);

function validatedRecord(untrusted) {
  // Copy only through the strict JSON encoder before reading any caller fields.
  let value;
  try { value = JSON.parse(canonical(untrusted)); } catch { fail('R63_JOURNAL_INVALID_RECORD'); }
  if (!exact(value, ['cycleId', 'study', 'evolution', 'report']) || typeof value.cycleId !== 'string' || !CYCLE.test(value.cycleId))
    fail('R63_JOURNAL_INVALID_RECORD');
  try {
    const study = studyR63Observations(value.study.events, {
      scopeId: value.study.scopeId, nowMs: value.study.asOfMs, windowStartMs: value.study.windowStartMs,
    });
    if (!sameJson(study, value.study)) fail('R63_JOURNAL_STUDY_MISMATCH');
    const evolution = inspectR63EvolutionState(value.evolution);
    if (!sameJson(evolution, value.evolution)) fail('R63_JOURNAL_EVOLUTION_MISMATCH');
    const report = buildR63AdminReport({ study, evolution, period: value.report.period,
      generatedAtMs: value.report.generatedAtMs });
    if (!sameJson(report, value.report)) fail('R63_JOURNAL_REPORT_MISMATCH');
    return freeze({ cycleId: value.cycleId, study, evolution, report });
  } catch (error) {
    if (/^R63_JOURNAL_(STUDY|EVOLUTION|REPORT)_MISMATCH$/.test(error?.code || '')) throw error;
    fail('R63_JOURNAL_INVALID_RECORD');
  }
}

function validateContinuation(previous, current) {
  if (!previous) return;
  const a = previous.evolution, b = current.evolution;
  if (a.scopeId !== b.scopeId || a.createdAtMs !== b.createdAtMs ||
      b.revision < a.revision || b.updatedAtMs < a.updatedAtMs ||
      b.activeVersion.activationGeneration < a.activeVersion.activationGeneration ||
      current.study.asOfMs < previous.study.asOfMs ||
      current.study.windowStartMs < previous.study.windowStartMs ||
      current.report.generatedAtMs < previous.report.generatedAtMs ||
      current.report.period.endMs < previous.report.period.endMs ||
      b.journal.length < a.journal.length ||
      a.journal.some((command, index) => !sameJson(command, b.journal[index])))
    fail('R63_JOURNAL_SCOPE_STATE_REGRESSION');
  const known = new Map(previous.study.events.map(event => [event.eventId, event]));
  for (const event of current.study.events) {
    if (known.has(event.eventId) && !sameJson(known.get(event.eventId), event)) fail('R63_JOURNAL_EVENT_REPLAY_CONFLICT');
  }
}

function validateSnapshot(value) {
  if (!exact(value, ['schema', 'revision', 'entries']) || value.schema !== SCHEMA ||
      !Number.isSafeInteger(value.revision) || !Array.isArray(value.entries) ||
      value.revision !== value.entries.length || value.entries.length > R63_JOURNAL_LIMITS.maxEntries)
    fail('R63_JOURNAL_INVALID_SNAPSHOT');
  const seenCycles = new Set(), scopes = new Map(), observedEvents = new Map();
  const entries = value.entries.map(raw => {
    const entry = validatedRecord(raw);
    if (seenCycles.has(entry.cycleId)) fail('R63_JOURNAL_DUPLICATE_CYCLE');
    seenCycles.add(entry.cycleId);
    const scope = entry.study.scopeId;
    validateContinuation(scopes.get(scope), entry);
    // Check every retained occurrence, not only the immediately previous batch.
    for (const event of entry.study.events) {
      const eventKey = `${scope}/${event.eventId}`;
      if (observedEvents.has(eventKey) && !sameJson(observedEvents.get(eventKey), event))
        fail('R63_JOURNAL_EVENT_REPLAY_CONFLICT');
      observedEvents.set(eventKey, event);
    }
    scopes.set(scope, entry);
    return entry;
  });
  return freeze({ schema: SCHEMA, revision: entries.length, entries });
}

function validateKey(key) {
  if (typeof key !== 'string' || !HEX.test(key)) fail('R63_JOURNAL_KEY_REQUIRED');
  return Buffer.from(key, 'hex');
}

function noSymlinks(directory) {
  let current = sep;
  for (const part of directory.split(sep).filter(Boolean)) {
    current = join(current, part);
    const stat = lstatSync(current);
    if (stat.isSymbolicLink() || !stat.isDirectory()) fail('R63_JOURNAL_DIRECTORY_UNSAFE');
  }
}
function openDirectory(directory) {
  if (typeof process.getuid !== 'function' || !constants.O_NOFOLLOW || !constants.O_DIRECTORY)
    fail('R63_JOURNAL_PLATFORM_UNSUPPORTED');
  if (typeof directory !== 'string' || !isAbsolute(directory) || directory.includes('\0'))
    fail('R63_JOURNAL_DIRECTORY_UNSAFE');
  const path = resolve(directory), cwd = realpathSync(process.cwd());
  if (descendant(cwd, path) || descendant(REPOSITORY_ROOT, path)) fail('R63_JOURNAL_IN_REPOSITORY_FORBIDDEN');
  let descriptor;
  try {
    noSymlinks(path);
    const stat = lstatSync(path);
    if (realpathSync(path) !== path || !stat.isDirectory() || stat.uid !== process.getuid() || !privateMode(stat, 0o700))
      fail('R63_JOURNAL_DIRECTORY_UNSAFE');
    descriptor = openSync(path, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
    const opened = fstatSync(descriptor);
    if (!sameFile(stat, opened)) fail('R63_JOURNAL_DIRECTORY_UNSAFE');
    return { path, descriptor, stat: opened };
  } catch (error) {
    if (descriptor !== undefined) closeSync(descriptor);
    if (error?.code?.startsWith('R63_')) throw error;
    fail('R63_JOURNAL_DIRECTORY_UNSAFE');
  }
}
function checkDirectory(context) {
  noSymlinks(context.path);
  const stat = lstatSync(context.path);
  if (!sameFile(stat, context.stat) || stat.uid !== process.getuid() || !privateMode(stat, 0o700))
    fail('R63_JOURNAL_DIRECTORY_CHANGED');
}
function absentLock(context) {
  try { lstatSync(join(context.path, R63_JOURNAL_LOCK)); } catch (error) {
    if (error?.code === 'ENOENT') return;
    fail('R63_JOURNAL_LOCK_UNSAFE');
  }
  fail('R63_JOURNAL_LOCKED');
}
function safeFile(stat) {
  if (!stat.isFile() || stat.uid !== process.getuid() || stat.nlink !== 1 || !privateMode(stat, 0o600))
    fail('R63_JOURNAL_FILE_UNSAFE');
}
function readBoundedFile(context) {
  let descriptor;
  try {
    descriptor = openSync(join(context.path, R63_JOURNAL_FILE), constants.O_RDONLY | constants.O_NOFOLLOW);
    const before = fstatSync(descriptor); safeFile(before);
    if (before.size < 1 || before.size > R63_JOURNAL_LIMITS.maxBytes) fail('R63_JOURNAL_SIZE_LIMIT');
    const bytes = Buffer.alloc(before.size + 1);
    let total = 0;
    while (total < bytes.length) {
      const count = readSync(descriptor, bytes, total, bytes.length - total, null);
      if (count === 0) break;
      total += count;
    }
    const after = fstatSync(descriptor);
    if (total !== before.size || after.size !== before.size || after.mtimeMs !== before.mtimeMs || after.ctimeMs !== before.ctimeMs)
      fail('R63_JOURNAL_FILE_CHANGED');
    return bytes.subarray(0, total).toString('utf8');
  } catch (error) {
    if (descriptor === undefined && error?.code === 'ENOENT') return null;
    if (error?.code?.startsWith('R63_')) throw error;
    fail('R63_JOURNAL_FILE_UNSAFE');
  } finally { if (descriptor !== undefined) closeSync(descriptor); }
}
const signature = (payload, key) => createHmac('sha256', key).update(DOMAIN).update(canonical(payload)).digest();
function load(context, key) {
  checkDirectory(context);
  const text = readBoundedFile(context);
  if (text === null) return freeze({ schema: SCHEMA, revision: 0, entries: [] });
  let envelope;
  try { envelope = JSON.parse(text); } catch { fail('R63_JOURNAL_INVALID_JSON'); }
  if (!exact(envelope, ['schema', 'payload', 'hmac']) || envelope.schema !== ENVELOPE ||
      typeof envelope.hmac !== 'string' || !HEX.test(envelope.hmac)) fail('R63_JOURNAL_INVALID_ENVELOPE');
  if (!timingSafeEqual(signature(envelope.payload, key), Buffer.from(envelope.hmac, 'hex')))
    fail('R63_JOURNAL_HMAC_MISMATCH');
  return validateSnapshot(envelope.payload);
}

export function readR63Journal({ directory, key } = {}) {
  const secret = validateKey(key), context = openDirectory(directory);
  try { absentLock(context); const snapshot = load(context, secret); absentLock(context); return snapshot; }
  finally { closeSync(context.descriptor); secret.fill(0); }
}

function acquireLock(context, filename = R63_JOURNAL_LOCK) {
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
    if (error?.code === 'EEXIST') fail('R63_JOURNAL_LOCKED');
    fail('R63_JOURNAL_LOCK_UNSAFE');
  } finally { if (descriptor !== undefined) closeSync(descriptor); }
}
function removeOwned(path, stat) {
  let actual;
  try { actual = lstatSync(path); } catch (error) { if (error?.code === 'ENOENT') return; throw error; }
  if (!sameFile(actual, stat) || !actual.isFile() || actual.uid !== process.getuid()) fail('R63_JOURNAL_OWNERSHIP_CHANGED');
  unlinkSync(path);
}
function releaseLock(context, lock) {
  checkDirectory(context);
  let descriptor;
  try {
    descriptor = openSync(lock.path, constants.O_RDONLY | constants.O_NOFOLLOW);
    const stat = fstatSync(descriptor); safeFile(stat);
    if (!sameFile(stat, lock.stat) || stat.size < 1 || stat.size > 256) fail('R63_JOURNAL_OWNERSHIP_CHANGED');
    const bytes = Buffer.alloc(stat.size + 1);
    const length = readSync(descriptor, bytes, 0, bytes.length, 0);
    if (length !== stat.size) fail('R63_JOURNAL_OWNERSHIP_CHANGED');
    let stored;
    try { stored = JSON.parse(bytes.subarray(0, length).toString('utf8')); }
    catch { fail('R63_JOURNAL_OWNERSHIP_CHANGED'); }
    if (!sameJson(stored, { pid: process.pid, token: lock.token })) fail('R63_JOURNAL_OWNERSHIP_CHANGED');
  } catch (error) {
    if (error?.code?.startsWith('R63_')) throw error;
    fail('R63_JOURNAL_OWNERSHIP_CHANGED');
  } finally { if (descriptor !== undefined) closeSync(descriptor); }
  removeOwned(lock.path, lock.stat);
  fsyncSync(context.descriptor);
}

/**
 * Serialize the entire trusted worker operation before any provider request or
 * budget reservation. The caller bounds its work/requests; this lease is retained
 * until that Promise settles and is never stolen on a timer. Admin reads may
 * still read the last completed journal snapshot, and append has its own lock.
 */
export async function withR63WorkerLease({ directory, operation } = {}) {
  if (typeof operation !== 'function') fail('R63_WORKER_LEASE_OPERATION_REQUIRED');
  const context = openDirectory(directory);
  let lock;
  try {
    try { lock = acquireLock(context, R63_WORKER_LOCK); }
    catch (error) {
      if (error?.code === 'R63_JOURNAL_LOCKED') fail('R63_WORKER_LOCKED');
      throw error;
    }
    // Persist the lease name before the first potentially paid external call.
    fsyncSync(context.descriptor);
    return await operation();
  } finally {
    try { if (lock) releaseLock(context, lock); }
    finally { closeSync(context.descriptor); }
  }
}

export function appendR63Journal({ directory, key, record, expectedRevision } = {}) {
  const secret = validateKey(key);
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) fail('R63_JOURNAL_REVISION_REQUIRED');
  const entry = validatedRecord(record), context = openDirectory(directory);
  let lock, temporary, temporaryStat, keepLock = false;
  try {
    lock = acquireLock(context);
    const current = load(context, secret);
    const existing = current.entries.find(item => item.cycleId === entry.cycleId);
    if (existing) {
      if (!sameJson(existing, entry)) fail('R63_JOURNAL_CYCLE_REPLAY_CONFLICT');
      // An acknowledged-or-crashed retry can carry its previous expected revision.
      if (expectedRevision > current.revision) fail('R63_JOURNAL_REVISION_MISMATCH');
      return current;
    }
    if (current.revision !== expectedRevision) fail('R63_JOURNAL_REVISION_MISMATCH');
    if (current.entries.length >= R63_JOURNAL_LIMITS.maxEntries) fail('R63_JOURNAL_ENTRY_LIMIT');
    const next = validateSnapshot({ schema: SCHEMA, revision: current.revision + 1, entries: [...current.entries, entry] });
    const bytes = Buffer.from(canonical({ schema: ENVELOPE, payload: next, hmac: signature(next, secret).toString('hex') }), 'utf8');
    if (bytes.length > R63_JOURNAL_LIMITS.maxBytes) fail('R63_JOURNAL_SIZE_LIMIT');
    checkDirectory(context);
    temporary = join(context.path, `.r63-journal.${randomBytes(16).toString('hex')}.tmp`);
    const descriptor = openSync(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    try {
      temporaryStat = fstatSync(descriptor);
      fchmodSync(descriptor, 0o600);
      writeFileSync(descriptor, bytes);
      fsyncSync(descriptor);
    } finally { closeSync(descriptor); }
    checkDirectory(context);
    // Uncertain completion after rename retains the lock, requiring recovery.
    keepLock = true;
    renameSync(temporary, join(context.path, R63_JOURNAL_FILE));
    fsyncSync(context.descriptor);
    keepLock = false;
    return next;
  } finally {
    try {
      if (temporary && temporaryStat) removeOwned(temporary, temporaryStat);
      if (lock && !keepLock) releaseLock(context, lock);
    } finally { closeSync(context.descriptor); secret.fill(0); }
  }
}
