/** R68 host inputs and lifetime lease only. No replacement outbox or recovery.
 * Paths stay private; exported errors contain closed codes rather than paths.
 */
import { constants, openSync, closeSync, lstatSync, fstatSync, realpathSync, readSync,
  writeFileSync, fchmodSync, fsyncSync, unlinkSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPOSITORY = resolve(fileURLToPath(new URL('../../../', import.meta.url)));
export const R68_HOST_LOCK = 'r68-private-host.lock';
const fail = code => { throw Object.assign(new Error(code), { name: 'ValidationError', code }); };
const same = (a, b) => a.dev === b.dev && a.ino === b.ino;
const within = (root, path) => { const r = relative(root, path); return r === '' ||
  (!r.startsWith('..' + sep) && r !== '..' && !isAbsolute(r)); };
function canonicalPath(path) {
  if (typeof process.getuid !== 'function' || !constants.O_NOFOLLOW || !constants.O_DIRECTORY)
    fail('R68_HOST_PLATFORM');
  if (typeof path !== 'string' || !isAbsolute(path) || path.includes('\0') ||
      path.length > 4096 || resolve(path) !== path) fail('R68_HOST_PRIVATE_PATH');
  let cwd;
  try { cwd = realpathSync(process.cwd()); } catch { fail('R68_HOST_PRIVATE_PATH'); }
  if (within(REPOSITORY, path) || within(cwd, path)) fail('R68_HOST_IN_REPOSITORY');
  return path;
}
function noSymlinks(path) {
  let current = sep;
  for (const component of path.split(sep).filter(Boolean)) {
    current = join(current, component);
    const stat = lstatSync(current);
    if (stat.isSymbolicLink() || !stat.isDirectory()) fail('R68_HOST_PRIVATE_DIRECTORY');
  }
}
export function inspectR68PrivateDirectory(raw) {
  const path = canonicalPath(raw);
  try {
    noSymlinks(path); const stat = lstatSync(path);
    if (realpathSync(path) !== path || !stat.isDirectory() || stat.uid !== process.getuid() ||
        (stat.mode & 0o7777) !== 0o700) fail('R68_HOST_PRIVATE_DIRECTORY');
    return { path, stat };
  } catch (error) {
    if (/^R68_HOST_/.test(error?.code || '')) throw error;
    fail('R68_HOST_PRIVATE_DIRECTORY');
  }
}
function privateFile(stat, maxBytes) {
  return stat.isFile() && stat.uid === process.getuid() && stat.nlink === 1 &&
    (stat.mode & 0o7777) === 0o600 && stat.size >= 1 && stat.size <= maxBytes;
}
function readDescriptor(fd, maxBytes) {
  const before = fstatSync(fd);
  if (!privateFile(before, maxBytes)) fail('R68_HOST_PRIVATE_FILE');
  const bytes = Buffer.alloc(before.size + 1); let length = 0;
  while (length < bytes.length) {
    const n = readSync(fd, bytes, length, bytes.length - length, length);
    if (!n) break; length += n;
  }
  const after = fstatSync(fd);
  if (!privateFile(after, maxBytes) || !same(before, after) || length !== before.size ||
      after.size !== before.size || after.mtimeMs !== before.mtimeMs || after.ctimeMs !== before.ctimeMs)
    fail('R68_HOST_PRIVATE_FILE_CHANGED');
  return { bytes: bytes.subarray(0, length), stat: after };
}
/** A complete atomic replacement may be read on the next tick; this descriptor
 * always yields one internally consistent, private, bounded file snapshot.
 */
export function readR68PrivateFile(raw, maxBytes) {
  const path = canonicalPath(raw);
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > 262144) fail('R68_HOST_FILE_LIMIT');
  const directory = inspectR68PrivateDirectory(dirname(path));
  let fd;
  try {
    fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const result = readDescriptor(fd, maxBytes);
    const afterDirectory = inspectR68PrivateDirectory(directory.path);
    if (!same(directory.stat, afterDirectory.stat)) fail('R68_HOST_PRIVATE_FILE_CHANGED');
    let text;
    try { text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(result.bytes); }
    catch { fail('R68_HOST_PRIVATE_FILE_ENCODING'); }
    if (!Buffer.from(text).equals(result.bytes)) fail('R68_HOST_PRIVATE_FILE_ENCODING');
    return { text, identity: { dev: result.stat.dev, ino: result.stat.ino } };
  } catch (error) {
    if (/^R68_HOST_/.test(error?.code || '')) throw error;
    fail('R68_HOST_PRIVATE_FILE');
  } finally { if (fd !== undefined) closeSync(fd); }
}

/** A new exclusive lease is kept for the lifetime of one host process. A stale
 * lease is never stolen, and release verifies both descriptor and pathname.
 */
export function acquireR68HostLease(raw) {
  const directory = inspectR68PrivateDirectory(raw), path = join(directory.path, R68_HOST_LOCK);
  let directoryFd, fd, stat;
  const token = randomBytes(16).toString('hex');
  const body = JSON.stringify({ pid: process.pid, token });
  function checkDirectory() {
    const checked = inspectR68PrivateDirectory(directory.path);
    if (!same(checked.stat, directory.stat) || !same(fstatSync(directoryFd), directory.stat))
      fail('R68_HOST_LEASE_OWNERSHIP_CHANGED');
  }
  try {
    directoryFd = openSync(directory.path, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
    checkDirectory();
    fd = openSync(path, constants.O_RDWR | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    fchmodSync(fd, 0o600); stat = fstatSync(fd);
    writeFileSync(fd, body, 'utf8'); fsyncSync(fd); fsyncSync(directoryFd); checkDirectory();
  } catch (error) {
    // An uncertain partially acquired lease is retained for explicit review.
    if (fd !== undefined) closeSync(fd);
    if (directoryFd !== undefined) closeSync(directoryFd);
    if (error?.code === 'EEXIST') fail('R68_HOST_LOCKED');
    if (/^R68_HOST_/.test(error?.code || '')) throw error;
    fail('R68_HOST_LEASE_UNCERTAIN');
  }
  let released = false;
  function assertOwned() {
    if (released) fail('R68_HOST_LEASE_OWNERSHIP_CHANGED');
    try {
      checkDirectory();
      const actual = lstatSync(path), read = readDescriptor(fd, 256);
      if (!same(actual, stat) || !same(read.stat, stat) || !privateFile(actual, 256) ||
          read.bytes.toString('utf8') !== body) fail('R68_HOST_LEASE_OWNERSHIP_CHANGED');
    } catch (error) {
      if (/^R68_HOST_/.test(error?.code || '')) throw error;
      fail('R68_HOST_LEASE_OWNERSHIP_CHANGED');
    }
  }
  return Object.freeze({ assertOwned, release() {
    if (released) return;
    try {
      assertOwned();
      unlinkSync(path); fsyncSync(directoryFd); released = true;
    } catch (error) {
      if (/^R68_HOST_/.test(error?.code || '')) throw error;
      fail('R68_HOST_LEASE_UNCERTAIN');
    } finally { closeSync(fd); closeSync(directoryFd); released = true; }
  } });
}
