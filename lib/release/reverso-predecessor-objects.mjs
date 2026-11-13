import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';

// Original REVFIN001/002 objects are proof inputs, not new release approvals.
// The connected Git transport creates a new commit on the published branch;
// this bounded local object pack preserves the exact historical verifier chain.
export const REVERSO_PREDECESSOR_PACK_V1 = Object.freeze({
  path: 'docs/release/REVFIN002-WEB-PREDECESSORS.pack',
  sha256: '19c32ec2c1b3bd1c0840e0d30928ced8882cab2e2849460b7423d7a1572d5f24',
  bytes: 180527,
  prerequisite: '0edbbef8c4b6bd5c9a6f5fb5e93c33eb7f11ce47',
  commit: 'd71bf6cdc237c7fa1ba082242fa6f09f1cbf895a',
  tree: 'db07e4e6b22d73af7e71db6dccf27de81a9af2a5',
});
const required = [
  [
    "0edbbef8c4b6bd5c9a6f5fb5e93c33eb7f11ce47",
    "c86e7eaef0a3c96efdb2daedf40ecccfcc56af32"
  ],
  [
    "2c8ba6ed56178add03b1cebcab88599e27abb3c4",
    "068b4dc3eae6e5d45c3ec35d42459eaca638f423"
  ],
  [
    "3086fb4ccf257d438958945b517bd242a491d506",
    "3086fb4ccf257d438958945b517bd242a491d506"
  ],
  [
    "31baf4346c048f4f52ec5fff3bd9e6c8487eeda3",
    "31baf4346c048f4f52ec5fff3bd9e6c8487eeda3"
  ],
  [
    "6d1f58efc6e5d79aac30e4e8e29c60995ef411ea",
    "943d8683b46e322698c5dd11a1a574617094847d"
  ],
  [
    "6fb555dd07b67237168647da9560d68d5c627701",
    "6fb555dd07b67237168647da9560d68d5c627701"
  ],
  [
    "7954dffbcff7e81c6a3f0b368fdf28d0c3b07065",
    "7954dffbcff7e81c6a3f0b368fdf28d0c3b07065"
  ],
  [
    "b69c93ce8a8a776af72c6f535826a10974dfb265",
    "b69c93ce8a8a776af72c6f535826a10974dfb265"
  ],
  [
    "b8003cbc3320e3470ba221a83c7938294a335b3b",
    "b8003cbc3320e3470ba221a83c7938294a335b3b"
  ],
  [
    "d71bf6cdc237c7fa1ba082242fa6f09f1cbf895a",
    "db07e4e6b22d73af7e71db6dccf27de81a9af2a5"
  ],
  [
    "e53d946e0434a6c8d2480ecf781f4b63707389b6",
    "83fd126ccd0d98c8d7782fe3e832659cd64f2424"
  ]
];

export function restoreReversoPredecessorObjects({cwd = process.cwd(), read = readFileSync,
  git = (...args) => execFileSync('git', args, {cwd, maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe']}),
  importPack = bytes => execFileSync('git', ['index-pack', '--stdin'], {cwd, input: bytes, maxBuffer: 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe']})} = {}) {
  const spec = REVERSO_PREDECESSOR_PACK_V1;
  const bytes = read(resolve(cwd, spec.path));
  assert.equal(bytes.byteLength, spec.bytes, 'REVPUB001 predecessor pack length changed');
  assert.equal(createHash('sha256').update(bytes).digest('hex'), spec.sha256, 'REVPUB001 predecessor pack changed');
  const present = () => required.every(([commit, tree]) => {
    try { return git('rev-parse', '--verify', commit + '^{tree}').toString().trim() === tree; }
    catch { return false; }
  });
  if (present()) return {restored: false, verified: true, commit: spec.commit, tree: spec.tree};
  try { git('cat-file', '-e', spec.prerequisite + '^{commit}'); }
  catch { throw Error('REVPUB001 published predecessor unavailable; restore the published Git history'); }
  // Git verifies object identities while indexing the hash-pinned pack. No
  // network, branch rewrite, remote configuration or source mutation.
  importPack(bytes);
  assert.ok(present(), 'REVPUB001 predecessor object tree mismatch after restore');
  return {restored: true, verified: true, commit: spec.commit, tree: spec.tree};
}
