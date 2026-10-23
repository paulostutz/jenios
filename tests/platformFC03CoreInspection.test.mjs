import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir, symlink, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inspectFC03OriginalCore } from '../lib/platform/research/fc03-original-core-inspection.mjs';

test('FC03 absent core stays explicitly unverified, never a completed runtime test', async () => {
  for (const directory of [undefined, '', 'relative/path']) {
    const r = await inspectFC03OriginalCore(directory);
    assert.equal(r.originalBytesMatch, false);
    assert.equal(r.runtimeImported, false);
    assert.equal(r.privateEngineLoaded, false);
    assert.equal(r.status, 'ORIGINAL_CORE_UNAVAILABLE_OR_UNVERIFIED');
    assert.equal(r.actualBrokerPnl, null);
  }
});
test('FC03 missing private files are reported by filename without leaking local paths', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'fc03-private-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const r = await inspectFC03OriginalCore(dir);
  assert.deepEqual(r.files.map(f => f.status), ['MISSING', 'MISSING']);
  assert.equal(JSON.stringify(r).includes(dir), false);
});
test('FC03 wrong executable bytes are hashed without import or modification', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'fc03-private-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const source = 'throw new Error("MUST_NEVER_BE_IMPORTED"); export const fake = true;';
  for (const name of ['engine.mjs', 'service.mjs']) await writeFile(join(dir, name), source);
  const r = await inspectFC03OriginalCore(dir);
  assert.deepEqual(r.files.map(f => f.status), ['HASH_MISMATCH', 'HASH_MISMATCH']);
  assert.equal(r.originalBytesMatch, false);
  assert.equal(r.runtimeImported, false);
  assert.equal(JSON.stringify(r).includes(source), false);
  assert.equal(await readFile(join(dir, 'engine.mjs'), 'utf8'), source);
});
test('FC03 directories and symlinks cannot stand in for private executable files', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'fc03-private-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await mkdir(join(dir, 'engine.mjs'));
  await writeFile(join(dir, 'target.mjs'), 'not original');
  await symlink(join(dir, 'target.mjs'), join(dir, 'service.mjs'));
  const r = await inspectFC03OriginalCore(dir);
  assert.deepEqual(r.files.map(f => f.status), ['NOT_REGULAR_FILE', 'UNREADABLE_OR_SYMLINK']);
  assert.equal(r.originalBytesMatch, false);
});
