/** Pin only the explicitly reviewed delta; preserve every predecessor. */
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {BASE, BASE_TREE, BRANCH, MANIFEST, CHECKER, REPLACEMENTS, ADDITIONS,
  FALSE_CAPABILITIES, baseEntries, inventory, blob, normalizedChecker} from './check-reverso-revpub002.mjs';
assert.deepEqual(process.argv.slice(2), ['--finalize']);
const entries = baseEntries(), files = inventory();
assert.deepEqual([...new Set([...files, MANIFEST])].sort(), [...Object.keys(entries), ...ADDITIONS].sort(), 'Unreviewed inventory');
for (const [name, entry] of Object.entries(entries)) {
  if (!REPLACEMENTS.includes(name)) assert.equal(blob(readFileSync(name)), entry.sha, 'Unreviewed change: ' + name);
}
const normalized = normalizedChecker(readFileSync(CHECKER));
const manifest = {schema: 'JENIOS_REVPUB002_EXACT_WEB_V1', baseCommit: BASE, baseTree: BASE_TREE,
  releaseBranch: BRANCH, authorizationReference: 'USER_REVERSO_PLANOS_10_AVULSO_20_20261113',
  webPublicationApproved: true, publicationScope: 'web-only-disabled-finance',
  ...Object.fromEntries(FALSE_CAPABILITIES.map(flag => [flag, false])),
  verifierTemplateBlob: blob(normalized),
  replacements: Object.fromEntries(REPLACEMENTS.map(name => [name, {baseline: entries[name].sha, target: blob(readFileSync(name))}])),
  additions: Object.fromEntries(ADDITIONS.filter(name => name !== MANIFEST && name !== CHECKER).map(name => [name, blob(readFileSync(name))]))};
const bytes = Buffer.from(JSON.stringify(manifest, null, 2) + '\n');
writeFileSync(MANIFEST, bytes);
writeFileSync(CHECKER, normalized.toString().replace("const pinnedManifestBlob='__REVPUB002_MANIFEST_BLOB__';", "const pinnedManifestBlob='" + blob(bytes) + "';"));
console.log('REVPUB002_MANIFEST_FINALIZED', blob(bytes));
