/** Exact, bounded successor: publish financial visibility, never activate money. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync, lstatSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {verifyOwnerWebRelease as verifyPrevious} from './check-ultra-owner-web.mjs';
import {restoreReversoPredecessorObjects} from '../lib/release/reverso-predecessor-objects.mjs';

export const BASE = 'da47f25126612fe0c94241db7616b76b3852b1a3';
export const BASE_TREE = '3208df55107cbe8485a1baeb671d34128a82ef7e';
export const BRANCH = 'release/jenios-reverso-revpub002-20261113';
export const MANIFEST = 'docs/release/REVPUB002-WEB-RELEASE.json';
export const CHECKER = 'scripts/check-reverso-revpub002.mjs';
export const REPLACEMENTS = Object.freeze([
  'app/components/platform/PlatformAdminAccess.js',
  'app/components/platform/PlatformReversoFinance.js',
  'app/platform/admin/robos/reverso/page.js',
  'package.json',
  'tests/helpers/reverso-journey-harness-v2.mjs',
]);
export const ADDITIONS = Object.freeze([
  MANIFEST, CHECKER,
  'docs/reverso/REVPUB002-FINANCE-STATUS.md',
  'scripts/finalize-reverso-revpub002.mjs',
  'scripts/check-reverso-revpub002-deployment.mjs',
  'tests/reverso-login-return-revsrc001.test.mjs',
  'tests/reverso-revpub002.test.mjs',
]);
export const FALSE_CAPABILITIES = Object.freeze([
  'publicationApproved', 'actualExecutionAuthorized', 'realDebitAuthorized',
  'liveExecutionAllowed', 'realBillingAllowed', 'paymentIssuanceAllowed', 'brokerPermissionsGranted',
]);
const pinnedManifestBlob='7c7cf9f7dd3a3fb6680112b9560446fcb319221e';
export const git = (...args) => execFileSync('git', args, {maxBuffer: 64 * 1024 * 1024});
export const paths = bytes => bytes.toString().split('\0').filter(Boolean);
export const blob = bytes => createHash('sha1').update(Buffer.from('blob ' + bytes.byteLength + '\0')).update(bytes).digest('hex');
export const inventory = () => paths(git('ls-files', '--cached', '--others', '--exclude-standard', '-z'));
export function baseEntries() {
  assert.equal(git('rev-parse', BASE + '^{tree}').toString().trim(), BASE_TREE);
  return Object.fromEntries(paths(git('ls-tree', '-r', '-z', BASE)).map(line => {
    const [metadata, name] = line.split('\t'), [mode, type, sha] = metadata.split(' ');
    assert.equal(type, 'blob'); assert.ok(['100644', '100755'].includes(mode));
    return [name, {mode, sha}];
  }));
}
export function normalizedChecker(bytes, expectedPin) {
  const pattern = /^const pinnedManifestBlob='([a-f0-9]{40}|__REVPUB002_MANIFEST_BLOB__)';$/gm;
  const text = bytes.toString(), pins = [...text.matchAll(pattern)];
  assert.equal(pins.length, 1, 'REVPUB002 unique verifier pin required');
  if (expectedPin !== undefined) assert.equal(pins[0][1], expectedPin, 'REVPUB002 verifier pin changed');
  return Buffer.from(text.replace(pattern, "const pinnedManifestBlob='__REVPUB002_MANIFEST_BLOB__';"));
}
const prior = new Map();
const readPrior = name => {
  if (!prior.has(name)) prior.set(name, git('show', BASE + ':' + name));
  return Buffer.from(prior.get(name));
};
export function verifyReversoRevpub002({read = readFileSync, tracked} = {}) {
  assert.match(pinnedManifestBlob, /^[a-f0-9]{40}$/, 'REVPUB002 source not finalized');
  const bytes = read(MANIFEST), m = JSON.parse(bytes);
  assert.equal(blob(bytes), pinnedManifestBlob, 'REVPUB002 manifest changed');
  assert.equal(m.schema, 'JENIOS_REVPUB002_EXACT_WEB_V1');
  assert.equal(m.baseCommit, BASE); assert.equal(m.baseTree, BASE_TREE);
  assert.equal(m.releaseBranch, BRANCH); assert.equal(m.webPublicationApproved, true);
  assert.equal(m.publicationScope, 'web-only-disabled-finance');
  for (const flag of FALSE_CAPABILITIES) assert.equal(m[flag], false, 'REVPUB002 financial capability changed');
  assert.deepEqual(Object.keys(m.replacements).sort(), [...REPLACEMENTS].sort());
  assert.deepEqual(Object.keys(m.additions).sort(), ADDITIONS.filter(n => n !== MANIFEST && n !== CHECKER).sort());
  const entries = baseEntries(), files = tracked ?? inventory();
  assert.deepEqual([...files].sort(), [...Object.keys(entries), ...ADDITIONS].sort(), 'REVPUB002 exact inventory required');
  assert.equal(blob(normalizedChecker(read(CHECKER), pinnedManifestBlob)), m.verifierTemplateBlob, 'REVPUB002 verifier source changed');
  for (const [name, entry] of Object.entries(entries)) {
    const replacement = m.replacements[name];
    if (replacement) assert.equal(replacement.baseline, entry.sha);
    assert.equal(blob(read(name)), replacement?.target ?? entry.sha, 'REVPUB002 source changed: ' + name);
  }
  for (const [name, sha] of Object.entries(m.additions)) assert.equal(blob(read(name)), sha, 'REVPUB002 addition changed: ' + name);
  for (const name of files) {
    const stat = lstatSync(name);
    assert.ok(stat.isFile() && !stat.isSymbolicLink(), 'REVPUB002 regular file required');
    assert.equal(stat.mode & 0o111 ? '100755' : '100644', entries[name]?.mode ?? '100644', 'REVPUB002 mode changed');
  }
  restoreReversoPredecessorObjects();
  const previous = verifyPrevious({tracked: Object.keys(entries), read: name => REPLACEMENTS.includes(name) ? readPrior(name) : read(name)});
  assert.equal(previous.exactSource, true); assert.equal(previous.reversoWebPublicationRelease, true);
  return Object.freeze({...previous, reversoRevpub002Release: true, webPublicationApproved: true,
    publicationScope: m.publicationScope, releaseBranch: BRANCH,
    ...Object.fromEntries(FALSE_CAPABILITIES.map(flag => [flag, false]))});
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.equal(process.argv.length, 2);
  console.log('REVPUB002_EXACT_WEB_SOURCE_PASS', verifyReversoRevpub002());
}
