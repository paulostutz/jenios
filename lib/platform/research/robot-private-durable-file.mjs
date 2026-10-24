/**
 * Private durable-file kernel shared by the CLOSED R66 and R67 QA domains.
 * File names, HMAC domains, schemas, limits and error prefixes cannot be supplied
 * by a caller. This layer authenticates and commits local JSON; protocol wrappers
 * remain responsible for verifying every record and every state transition.
 *
 * The mechanics were extracted unchanged from the certified R66 outbox: 0700
 * directory, 0600 single-link files, no symlink paths, exclusive locks, bounded
 * reads, temporary-file fsync and atomic rename followed by directory fsync.
 * Orphan locks are never stolen. Whole-directory rollback still requires an
 * independent monotonic witness. No network, broker or hosted service is used.
 */
import {
  constants, openSync, closeSync, fstatSync, lstatSync, realpathSync, readSync,
  writeFileSync, fsyncSync, fchmodSync, renameSync, unlinkSync,
} from 'node:fs';
import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto';
import { isAbsolute, resolve, relative, join, sep, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROFILES = Object.freeze({
  R66_OBSERVATION: Object.freeze({
    file: 'r66-observation-outbox.json', lock: 'r66-observation-outbox.lock',
    deliveryLock: 'r66-observation-delivery.lock', temporaryPrefix: '.r66-outbox.',
    envelope: 'JENIOS_R66_LOCAL_HMAC_ENVELOPE_V1',
    domain: 'JENIOS_R66_LOCAL_OBSERVATION_OUTBOX_V1\0',
    errorPrefix: 'R66_OUTBOX', deliveryOperationError: 'R66_DELIVERY_OPERATION', maxBytes: 32 * 1024 * 1024,
  }),
  R67_PRIVATE_CAPTURE: Object.freeze({
    file: 'r67-private-capture-outbox.json', lock: 'r67-private-capture-outbox.lock',
    deliveryLock: 'r67-private-capture-delivery.lock', temporaryPrefix: '.r67-private-capture.',
    envelope: 'JENIOS_R67_PRIVATE_CAPTURE_HMAC_ENVELOPE_V1',
    domain: 'JENIOS_R67_PRIVATE_CAPTURE_OUTBOX_V1\0',
    errorPrefix: 'R67_OUTBOX', deliveryOperationError: 'R67_DELIVERY_OPERATION', maxBytes: 32 * 1024 * 1024,
  }),
});
const HEX = /^[a-f0-9]{64}$/;
const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const failure = (profile, code) => { throw Object.assign(new Error(profile.errorPrefix + '_' + code),
  { name: 'ValidationError', code: profile.errorPrefix + '_' + code }); };
function selectedProfile(name) {
  if (typeof name !== 'string' || !Object.hasOwn(PROFILES, name))
    throw Object.assign(new Error('PRIVATE_DURABLE_PROFILE'), { name: 'ValidationError', code: 'PRIVATE_DURABLE_PROFILE' });
  return PROFILES[name];
}
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
const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).length === keys.length && Object.keys(value).every(key => keys.includes(key));
// Canonical JSON rejects accessor properties, prototypes, non-finite numbers,
// sparse arrays and extra array properties. It never calls toJSON/toString.
export function canonicalPrivateDurableJson(input, profileName) {
  const profile = selectedProfile(profileName), fail = code => failure(profile, code);
  let visited = 0;
  function encode(value, depth) {
    if (++visited > 500000 || depth > 64) fail('JSON_LIMIT');
    if (value === null || typeof value === 'boolean') return JSON.stringify(value);
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) fail('NON_JSON_VALUE');
      return JSON.stringify(value);
    }
    if (typeof value === 'string') {
      if (value.length > profile.maxBytes) fail('JSON_LIMIT');
      return JSON.stringify(value);
    }
    if (!value || typeof value !== 'object') fail('NON_JSON_VALUE');
    if (Array.isArray(value)) {
      const properties = Object.getOwnPropertyDescriptors(value);
      const keys = Reflect.ownKeys(properties);
      if (keys.length !== value.length + 1 || keys.some(key =>
        key !== 'length' && (typeof key !== 'string' || !/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= value.length)))
        fail('NON_JSON_VALUE');
      const encoded = [];
      for (let index = 0; index < value.length; index++) {
        const property = properties[String(index)];
        if (!property || !Object.hasOwn(property, 'value') || !property.enumerable) fail('NON_JSON_VALUE');
        encoded.push(encode(property.value, depth + 1));
      }
      return `[${encoded.join(',')}]`;
    }
    if (![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail('NON_JSON_VALUE');
    const properties = Object.getOwnPropertyDescriptors(value), keys = Reflect.ownKeys(properties);
    if (keys.some(key => typeof key !== 'string' || !Object.hasOwn(properties[key], 'value') || !properties[key].enumerable))
      fail('NON_JSON_VALUE');
    return `{${keys.sort().map(key => `${JSON.stringify(key)}:${encode(properties[key].value, depth + 1)}`).join(',')}}`;
  }
  return encode(input, 0);
}

/** The operation callback is a trusted wrapper transaction, never a protocol verifier supplied through configuration. */
export function createPrivateDurableFile(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw Object.assign(new Error('PRIVATE_DURABLE_CONFIG'), { code: 'PRIVATE_DURABLE_CONFIG' });
  const args = Object.getOwnPropertyDescriptors(input);
  if (Reflect.ownKeys(args).length !== 3 || !['profile', 'directory', 'key'].every(k =>
      args[k] && args[k].enumerable && Object.hasOwn(args[k], 'value')))
    throw Object.assign(new Error('PRIVATE_DURABLE_CONFIG'), { code: 'PRIVATE_DURABLE_CONFIG' });
  const profileName = args.profile.value, profile = selectedProfile(profileName);
  const directory = args.directory.value, key = args.key.value;
  const fail = code => failure(profile, code);
  if (typeof key !== 'string' || !HEX.test(key)) fail('KEY_REQUIRED');
  const canonical = value => canonicalPrivateDurableJson(value, profileName);
  const sameJson = (a, b) => canonical(a) === canonical(b);
function noSymlinks(directory) {
  let current = sep;
  for (const part of directory.split(sep).filter(Boolean)) {
    current = join(current, part);
    const stat = lstatSync(current);
    if (stat.isSymbolicLink() || !stat.isDirectory()) fail('DIRECTORY_UNSAFE');
  }
}
function openDirectory(directory) {
  if (typeof process.getuid !== 'function' || !constants.O_NOFOLLOW || !constants.O_DIRECTORY)
    fail('PLATFORM_UNSUPPORTED');
  if (typeof directory !== 'string' || !isAbsolute(directory) || directory.includes('\0'))
    fail('DIRECTORY_UNSAFE');
  const path = resolve(directory), cwd = realpathSync(process.cwd());
  if (descendant(cwd, path) || descendant(REPOSITORY_ROOT, path)) fail('IN_REPOSITORY_FORBIDDEN');
  let descriptor;
  try {
    noSymlinks(path);
    const stat = lstatSync(path);
    if (realpathSync(path) !== path || !stat.isDirectory() || stat.uid !== process.getuid() || !privateMode(stat, 0o700))
      fail('DIRECTORY_UNSAFE');
    descriptor = openSync(path, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
    const opened = fstatSync(descriptor);
    if (!sameFile(stat, opened)) fail('DIRECTORY_UNSAFE');
    return { path, descriptor, stat: opened };
  } catch (error) {
    if (descriptor !== undefined) closeSync(descriptor);
    if (error?.code?.startsWith(profile.errorPrefix + '_')) throw error;
    fail('DIRECTORY_UNSAFE');
  }
}
function checkDirectory(context) {
  noSymlinks(context.path);
  const stat = lstatSync(context.path);
  if (!sameFile(stat, context.stat) || stat.uid !== process.getuid() || !privateMode(stat, 0o700))
    fail('DIRECTORY_CHANGED');
}
function absentLock(context) {
  try { lstatSync(join(context.path, profile.lock)); } catch (error) {
    if (error?.code === 'ENOENT') return;
    fail('LOCK_UNSAFE');
  }
  fail('LOCKED');
}
function safeFile(stat) {
  if (!stat.isFile() || stat.uid !== process.getuid() || stat.nlink !== 1 || !privateMode(stat, 0o600))
    fail('FILE_UNSAFE');
}
function readBoundedFile(context) {
  let descriptor;
  try {
    descriptor = openSync(join(context.path, profile.file), constants.O_RDONLY | constants.O_NOFOLLOW);
    const before = fstatSync(descriptor); safeFile(before);
    if (before.size < 1 || before.size > profile.maxBytes) fail('SIZE_LIMIT');
    const bytes = Buffer.alloc(before.size + 1);
    let total = 0;
    while (total < bytes.length) {
      const count = readSync(descriptor, bytes, total, bytes.length - total, null);
      if (count === 0) break;
      total += count;
    }
    const after = fstatSync(descriptor);
    if (total !== before.size || after.size !== before.size || after.mtimeMs !== before.mtimeMs || after.ctimeMs !== before.ctimeMs)
      fail('FILE_CHANGED');
    return bytes.subarray(0, total).toString('utf8');
  } catch (error) {
    if (descriptor === undefined && error?.code === 'ENOENT') return null;
    if (error?.code?.startsWith(profile.errorPrefix + '_')) throw error;
    fail('FILE_UNSAFE');
  } finally { if (descriptor !== undefined) closeSync(descriptor); }
}
function acquireLock(context, filename = profile.lock) {
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
    if (error?.code === 'EEXIST') fail('LOCKED');
    fail('LOCK_UNSAFE');
  } finally { if (descriptor !== undefined) closeSync(descriptor); }
}
function removeOwned(path, stat) {
  let actual;
  try { actual = lstatSync(path); } catch (error) { if (error?.code === 'ENOENT') return; throw error; }
  if (!sameFile(actual, stat) || !actual.isFile() || actual.uid !== process.getuid()) fail('OWNERSHIP_CHANGED');
  unlinkSync(path);
}
function releaseLock(context, lock) {
  checkDirectory(context);
  let descriptor;
  try {
    descriptor = openSync(lock.path, constants.O_RDONLY | constants.O_NOFOLLOW);
    const stat = fstatSync(descriptor); safeFile(stat);
    if (!sameFile(stat, lock.stat) || stat.size < 1 || stat.size > 256) fail('OWNERSHIP_CHANGED');
    const bytes = Buffer.alloc(stat.size + 1);
    const length = readSync(descriptor, bytes, 0, bytes.length, 0);
    if (length !== stat.size) fail('OWNERSHIP_CHANGED');
    let stored;
    try { stored = JSON.parse(bytes.subarray(0, length).toString('utf8')); }
    catch { fail('OWNERSHIP_CHANGED'); }
    if (!sameJson(stored, { pid: process.pid, token: lock.token })) fail('OWNERSHIP_CHANGED');
  } catch (error) {
    if (error?.code?.startsWith(profile.errorPrefix + '_')) throw error;
    fail('OWNERSHIP_CHANGED');
  } finally { if (descriptor !== undefined) closeSync(descriptor); }
  removeOwned(lock.path, lock.stat);
  fsyncSync(context.descriptor);
}



  const signature = (payload, secret) => createHmac('sha256', secret).update(profile.domain).update(canonical(payload)).digest();
  function load(context, secret) {
    checkDirectory(context);
    const text = readBoundedFile(context);
    if (text === null) return null;
    let envelope;
    try { envelope = JSON.parse(text); } catch { fail('INVALID_JSON'); }
    if (!exact(envelope, ['schema', 'payload', 'hmac']) || envelope.schema !== profile.envelope ||
        typeof envelope.hmac !== 'string' || !HEX.test(envelope.hmac)) fail('INVALID_ENVELOPE');
    if (!timingSafeEqual(signature(envelope.payload, secret), Buffer.from(envelope.hmac, 'hex')))
      fail('HMAC_MISMATCH');
    return freeze(envelope.payload);
  }
  function write(context, secret, payload) {
    const bytes = Buffer.from(canonical({ schema: profile.envelope, payload,
      hmac: signature(payload, secret).toString('hex') }), 'utf8');
    if (bytes.length > profile.maxBytes) fail('SIZE_LIMIT');
    checkDirectory(context);
    const temporary = join(context.path, `${profile.temporaryPrefix}${randomBytes(16).toString('hex')}.tmp`);
    let temporaryStat, renamed = false;
    try {
      const descriptor = openSync(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
      try {
        temporaryStat = fstatSync(descriptor); fchmodSync(descriptor, 0o600);
        writeFileSync(descriptor, bytes); fsyncSync(descriptor);
      } finally { closeSync(descriptor); }
      checkDirectory(context);
      try {
        renameSync(temporary, join(context.path, profile.file)); renamed = true;
        fsyncSync(context.descriptor);
      } catch (cause) {
        const code = profile.errorPrefix + '_COMMIT_UNCERTAIN';
        throw Object.assign(new Error(code), { name: 'ValidationError', code, cause });
      }
    } finally { if (!renamed && temporaryStat) removeOwned(temporary, temporaryStat); }
  }
  function readPayload() {
    const secret = Buffer.from(key, 'hex'), context = openDirectory(directory);
    try { absentLock(context); const payload = load(context, secret); absentLock(context); return payload; }
    finally { closeSync(context.descriptor); secret.fill(0); }
  }
  function acquireTransaction(operation) {
    if (typeof operation !== 'function') fail('TRANSACTION_OPERATION');
    const secret = Buffer.from(key, 'hex'), context = openDirectory(directory);
    const tx = { secret, context, lock: null, keepLock: false };
    try { tx.lock = acquireLock(context); fsyncSync(context.descriptor); return tx; }
    catch (error) { finishTransaction(tx); throw error; }
  }
  function finishTransaction(tx) {
    try { if (tx.lock && !tx.keepLock) releaseLock(tx.context, tx.lock); }
    finally { closeSync(tx.context.descriptor); tx.secret.fill(0); }
  }
  function commitTransaction(tx, change) {
    if (!change || typeof change !== 'object' || typeof change.changed !== 'boolean' ||
        (change.changed && !Object.hasOwn(change, 'payload'))) fail('TRANSACTION_RESULT');
    if (change.changed) {
      try { write(tx.context, tx.secret, change.payload); }
      catch (error) { if (error.code === profile.errorPrefix + '_COMMIT_UNCERTAIN') tx.keepLock = true; throw error; }
    }
    return freeze(change.value);
  }
  function transact(operation) {
    const tx = acquireTransaction(operation);
    try {
      const change = operation(load(tx.context, tx.secret));
      // A synchronous caller cannot accidentally release a lock across an await.
      if (change && typeof change.then === 'function') fail('ASYNC_TRANSACTION_REQUIRED');
      return commitTransaction(tx, change);
    } finally { finishTransaction(tx); }
  }
  async function transactAsync(operation) {
    const tx = acquireTransaction(operation);
    try { return commitTransaction(tx, await operation(load(tx.context, tx.secret))); }
    finally { finishTransaction(tx); }
  }
  async function withDeliveryLease(operation) {
    if (typeof operation !== 'function') {
      const code = profile.deliveryOperationError;
      throw Object.assign(new Error(code), { name: 'ValidationError', code });
    }
    const context = openDirectory(directory); let lock;
    try { lock = acquireLock(context, profile.deliveryLock); fsyncSync(context.descriptor); return await operation(); }
    finally { try { if (lock) releaseLock(context, lock); } finally { closeSync(context.descriptor); } }
  }
  return Object.freeze({ readPayload, transact, transactAsync, withDeliveryLease });
}
