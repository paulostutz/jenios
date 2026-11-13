import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync, mkdirSync, readFileSync, copyFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve, dirname} from 'node:path';
import {restoreReversoPredecessorObjects, REVERSO_PREDECESSOR_PACK_V1 as spec} from '../lib/release/reverso-predecessor-objects.mjs';

const repo = resolve(new URL('..', import.meta.url).pathname);
const original = readFileSync(resolve(repo, spec.path));
const git = (cwd, ...args) => execFileSync('git', args, {cwd, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024}).toString().trim();
function sandbox() {
  const cwd = mkdtempSync(resolve(tmpdir(), 'reverso-proof-'));
  git(cwd, 'init', '-q'); mkdirSync(dirname(resolve(cwd, spec.path)), {recursive: true});
  copyFileSync(resolve(repo, spec.path), resolve(cwd, spec.path)); return cwd;
}

test('historical proof pack detects same-length corruption before using Git', () => {
  const corrupt = Buffer.from(original); corrupt[100] ^= 1; let calls = 0;
  assert.throws(() => restoreReversoPredecessorObjects({read: () => corrupt, git: () => {calls++;}}), /predecessor pack changed/);
  assert.equal(calls, 0);
});
test('proof restoration is a verified no-op when original objects are available', () => {
  let imports = 0;
  const result = restoreReversoPredecessorObjects({cwd: repo, importPack: () => {imports++;}});
  assert.equal(result.restored, false); assert.equal(result.verified, true); assert.equal(imports, 0);
});
test('missing published predecessor fails closed without importing the pack', () => {
  const cwd = sandbox(); let imports = 0;
  try {
    assert.throws(() => restoreReversoPredecessorObjects({cwd, importPack: () => {imports++;}}), /published predecessor unavailable/);
    assert.equal(imports, 0);
  } finally {rmSync(cwd, {recursive: true, force: true});}
});
test('a depth-one published checkout restores every historical verifier without a network or ref change', () => {
  const cwd = sandbox();
  try {
    git(cwd, 'fetch', '--depth=1', repo, spec.prerequisite);
    git(cwd, 'checkout', '--detach', spec.prerequisite);
    assert.throws(() => git(cwd, 'cat-file', '-e', spec.commit + '^{commit}'));
    const head = git(cwd, 'rev-parse', 'HEAD'), refs = git(cwd, 'show-ref', '--head'), remotes = git(cwd, 'remote', '-v');
    const result = restoreReversoPredecessorObjects({cwd}); assert.equal(result.restored, true);
    assert.equal(git(cwd, 'rev-parse', spec.commit + '^{tree}'), spec.tree);
    assert.equal(git(cwd, 'rev-parse', 'HEAD'), head);
    assert.equal(git(cwd, 'show-ref', '--head'), refs); assert.equal(git(cwd, 'remote', '-v'), remotes);
    // Restore exactly d71 as a separate disposable source tree, preserving the
    // original historical source validator and its unmodified CLI.
    git(cwd, 'checkout', '--detach', spec.commit);
    const output = execFileSync(process.execPath, ['scripts/check-reverso-v2-web-release.mjs'], {cwd, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024});
    assert.match(output, /PASS/);
    assert.equal(restoreReversoPredecessorObjects({cwd}).restored, false);
  } finally {rmSync(cwd, {recursive: true, force: true});}
});
