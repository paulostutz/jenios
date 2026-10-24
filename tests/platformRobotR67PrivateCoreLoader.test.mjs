/** Public negative tests only. No private bytes or synthetic callback is passed
 * off as a verified executable. Positive original-source execution is a separate
 * explicitly private acceptance run, not a skipped public test.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, linkSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadR67VerifiedPrivateCore, inspectR67VerifiedPrivateCore,
  captureR67VerifiedPrivateBatch } from '../lib/platform/research/robot-r67-private-core-loader.mjs';

const denied = (fn, code) => assert.rejects(fn, error => error?.name === 'ValidationError' && error?.code === code);
function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'jenios-r67-public-negative-'));
  chmodSync(directory, 0o700);
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}
const wrongModule = (directory, name = 'engine.mjs', mode = 0o600, bytes = 'export const notThePrivateCore = true;\n') => {
  const path = join(directory, name); writeFileSync(path, bytes, { mode }); return path;
};

test('R67 loader exposes only the fixed directory-based loader and branded operations', async () => {
  for (const fn of [loadR67VerifiedPrivateCore, inspectR67VerifiedPrivateCore, captureR67VerifiedPrivateBatch])
    assert.equal(typeof fn, 'function');
  for (const options of [undefined, null, {}, [], { directory: '/tmp', expectedHash: '0'.repeat(64) },
    { directory: '/tmp', analyzeRequest() {} }, { directory: '/tmp', decision: 'ALLOW' }])
    await denied(() => loadR67VerifiedPrivateCore(options), 'R67_CORE_CONFIG');
});

test('R67 config accessors and custom prototypes are refused without invocation', async () => {
  let calls = 0;
  const options = { get directory() { calls++; return '/tmp'; } };
  await denied(() => loadR67VerifiedPrivateCore(options), 'R67_CORE_CONFIG');
  await denied(() => loadR67VerifiedPrivateCore(Object.assign(Object.create({}), { directory: '/tmp' })), 'R67_CORE_CONFIG');
  assert.equal(calls, 0);
});

test('R67 loader requires a canonical absolute private directory', async t => {
  const directory = fixture(t);
  for (const value of ['', '.', 'relative', null, 42, directory + '/', directory + '/..', '/tmp/\0invalid'])
    await denied(() => loadR67VerifiedPrivateCore({ directory: value }), 'R67_CORE_DIRECTORY');
  await denied(() => loadR67VerifiedPrivateCore({ directory: join(directory, 'missing') }), 'R67_CORE_DIRECTORY');
});

test('R67 loader rejects source directories inside the public checkout before reading code', async () => {
  const repository = fileURLToPath(new URL('../', import.meta.url)).replace(/\/$/, '');
  await denied(() => loadR67VerifiedPrivateCore({ directory: repository }), 'R67_CORE_DIRECTORY_IN_REPOSITORY');
  await denied(() => loadR67VerifiedPrivateCore({ directory: join(repository, 'lib') }), 'R67_CORE_DIRECTORY_IN_REPOSITORY');
});

test('R67 source directory must be private and cannot be a symlink', async t => {
  const directory = fixture(t), alias = join(directory, 'alias'), target = join(directory, 'target');
  mkdirSync(target, { mode: 0o700 }); symlinkSync(target, alias);
  await denied(() => loadR67VerifiedPrivateCore({ directory: alias }), 'R67_CORE_DIRECTORY');
  chmodSync(target, 0o755);
  await denied(() => loadR67VerifiedPrivateCore({ directory: target }), 'R67_CORE_DIRECTORY');
});

test('R67 missing private module is rejected without creating or repairing anything', async t => {
  await denied(() => loadR67VerifiedPrivateCore({ directory: fixture(t) }), 'R67_CORE_FILE');
});

test('R67 module descriptor rejects symlink and directory targets', async t => {
  const directory = fixture(t), target = wrongModule(directory, 'other.mjs');
  symlinkSync(target, join(directory, 'engine.mjs'));
  await denied(() => loadR67VerifiedPrivateCore({ directory }), 'R67_CORE_FILE');
  rmSync(join(directory, 'engine.mjs')); mkdirSync(join(directory, 'engine.mjs'), { mode: 0o700 });
  await denied(() => loadR67VerifiedPrivateCore({ directory }), 'R67_CORE_FILE');
});

test('R67 private module cannot be group or world readable', async t => {
  const directory = fixture(t), path = wrongModule(directory);
  chmodSync(path, 0o644);
  await denied(() => loadR67VerifiedPrivateCore({ directory }), 'R67_CORE_FILE');
});

test('R67 private module rejects hardlinks and bounded-size violations', async t => {
  const directory = fixture(t), path = wrongModule(directory);
  linkSync(path, join(directory, 'hardlink.mjs'));
  await denied(() => loadR67VerifiedPrivateCore({ directory }), 'R67_CORE_FILE');
  rmSync(join(directory, 'hardlink.mjs')); writeFileSync(path, Buffer.alloc(65537, 32));
  await denied(() => loadR67VerifiedPrivateCore({ directory }), 'R67_CORE_FILE');
  writeFileSync(path, '');
  await denied(() => loadR67VerifiedPrivateCore({ directory }), 'R67_CORE_FILE');
});

test('R67 mismatched bytes are rejected before any source evaluation', async t => {
  const directory = fixture(t);
  wrongModule(directory, 'engine.mjs', 0o600, 'globalThis.__R67_PUBLIC_NEGATIVE_EXECUTED__ = true;\n');
  await denied(() => loadR67VerifiedPrivateCore({ directory }), 'R67_CORE_HASH_MISMATCH');
  assert.equal(Object.hasOwn(globalThis, '__R67_PUBLIC_NEGATIVE_EXECUTED__'), false);
});

test('R67 declared metadata, copied shapes and arbitrary callbacks never form a verified handle', async () => {
  let calls = 0;
  const fake = Object.freeze({ schema: 'JENIOS_R67_PRIVATE_CORE_HANDLE_V1',
    localExecutableBytesVerified: true, analyzeRequest() { calls++; },
    runtimeOrigin: 'ORIGINAL_PRIVATE_CORE_SYNTHETIC_RUNTIME' });
  for (const handle of [null, undefined, {}, fake, Object.create(fake), []]) {
    assert.throws(() => inspectR67VerifiedPrivateCore(handle), error => error.code === 'R67_CORE_HANDLE');
    await denied(() => captureR67VerifiedPrivateBatch(handle, { scenarios: [], nowMs: 0 }), 'R67_CORE_HANDLE');
  }
  assert.equal(calls, 0);
});

test('R67 invalid handle rejects before inspecting batch getters or caller callbacks', async () => {
  let calls = 0;
  await denied(() => captureR67VerifiedPrivateBatch({}, {
    get scenarios() { calls++; return []; }, get nowMs() { calls++; return 0; },
    analyzeRequest() { calls++; },
  }), 'R67_CORE_HANDLE');
  assert.equal(calls, 0);
});
