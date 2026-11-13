import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {verifyOwnerWebRelease} from '../scripts/check-ultra-owner-web.mjs';

// Tests consume only the finalized source. No file, manifest or Git object is written.
const base = 'e53d946e0434a6c8d2480ecf781f4b63707389b6';
const manifestPath = 'docs/release/REVFIN002-WEB-RELEASE.json';
const helperPath = 'scripts/check-ultra-owner-web.mjs';
const predecessorPath = 'scripts/check-reverso-v2-web-baseline.mjs';
const git = (...args) => execFileSync('git', args, {maxBuffer: 64 * 1024 * 1024});
const tracked = () => git('ls-files', '-z').toString().split('\0').filter(Boolean);
const manifest = () => JSON.parse(readFileSync(manifestPath));
const blob = bytes => createHash('sha1').update(Buffer.from('blob ' + bytes.byteLength + '\0')).update(bytes).digest('hex');
const changed = bytes => Buffer.concat([bytes, Buffer.from('\n// Synthetic integrity mutation.\n')]);
const readWith = (target, transform = changed) => name => name === target ? transform(readFileSync(name)) : readFileSync(name);
const flags = ['publicationApproved', 'actualExecutionAuthorized', 'realDebitAuthorized', 'liveExecutionAllowed', 'realBillingAllowed', 'paymentIssuanceAllowed', 'brokerPermissionsGranted'];

test('REVFIN002 accepts exactly the frozen successor and retains the complete e53 verification chain', () => {
  const result = verifyOwnerWebRelease(), m = manifest();
  assert.equal(result.reversoConclusionSourceRelease, true); assert.equal(result.reversoFinanceRelease, true);
  assert.equal(result.reversoHistorySourceRelease, true); assert.equal(result.ultraProductionScopeRelease, true);
  assert.equal(result.ultraVercelExactSerializationRelease, true); assert.equal(result.exactSource, true);
  assert.equal(m.schema, 'JENIOS_REVFIN002_EXACT_WEB_SOURCE_V1'); assert.equal(m.baseCommit, base);
  assert.equal(m.baseTree, '83fd126ccd0d98c8d7782fe3e832659cd64f2424');
  assert.deepEqual(verifyOwnerWebRelease({read: readFileSync, tracked: tracked().reverse()}), result);
});

test('REVFIN002 keeps predecessor verifier, original manifest and historical release tests byte-exact', () => {
  assert.deepEqual(readFileSync(predecessorPath), git('show', base + ':' + helperPath));
  assert.equal(blob(readFileSync(predecessorPath)), '6b1d203c10f9873e908bd93b324963e11aa7c85b');
  for (const name of ['docs/release/REVFIN001-WEB-RELEASE.json', 'tests/reverso-release.test.mjs',
    'scripts/check-reverso-web-baseline.mjs', 'scripts/check-reverso-web-history.mjs']) assert.deepEqual(readFileSync(name), git('show', base + ':' + name));
});

test('REVFIN002 source approval grants no deployment, real money, real execution or broker capability', () => {
  const result = verifyOwnerWebRelease(), m = manifest();
  for (const flag of flags) {assert.equal(m[flag], false); assert.equal(result[flag], false);}
});

for (const path of ['app/components/platform/PlatformReversoFinance.js', 'app/components/social-auth-return.mjs', 'tests/reverso-ui.test.mjs'])
  test('REVFIN002 rejects a mutation of the current nominal replacement: ' + path, () => {
    const entry = manifest().replacements[path]; assert.equal(entry.baseline, blob(git('show', base + ':' + path)));
    assert.throws(() => verifyOwnerWebRelease({read: readWith(path)}), /REVFIN002 inherited source changed/);
  });

for (const path of [
  'app/api/platform/reverso/subscription/route.js',
  'app/components/platform/PlatformReversoSubscription.js',
  'app/components/platform/PlatformReversoSubscription.module.css',
  'lib/platform/reverso/subscription/client-v2.mjs',
  'lib/platform/reverso/subscription/view-v2.mjs',
  'lib/platform/reverso/subscription/http-v2.mjs',
  'lib/platform/reverso/subscription/runtime-source-v2.mjs',
  'tests/helpers/reverso-journey-harness-v2.mjs',
  'tests/reverso-subscription-ui-v2.test.mjs',
  'tests/reverso-release-v2.test.mjs',
  'scripts/finalize-reverso-v2-web-release.mjs',
  'scripts/render-reverso-v2-ui-fixtures.mjs',
  'scripts/check-reverso-v2-web-release.mjs',
  'docs/release/REVFIN002-SOURCE-VERIFICATION.md',
  'docs/reverso/REVFIN002-UI-JOURNEYS.md',
]) test('REVFIN002 rejects a mutation of its exact addition: ' + path, () => {
  assert.throws(() => verifyOwnerWebRelease({read: readWith(path)}), /REVFIN002 addition changed/);
});

test('REVFIN002 rejects a changed e53 predecessor before executing it', () => {
  assert.throws(() => verifyOwnerWebRelease({read: readWith(predecessorPath)}), /REVFIN002 predecessor verifier changed/);
});

test('REVFIN002 preserves the inherited source and original manifest guards', () => {
  for (const [path, diagnostic] of [
    ['lib/platform/reverso/state-reader.mjs', /REVFIN001 addition changed/],
    ['lib/pay/catalog.mjs', /REVFIN001 inherited source changed/],
    ['app/dashboard-logado/page.js', /REVFIN001 inherited source changed/],
    ['docs/release/REVFIN001-WEB-RELEASE.json', /REVFIN001 manifest changed/],
  ]) assert.throws(() => verifyOwnerWebRelease({read: readWith(path)}), diagnostic);
});

test('REVFIN002 rejects changed helper code and a pin different from the executing module', () => {
  assert.throws(() => verifyOwnerWebRelease({read: readWith(helperPath)}), /verifier source changed.*REVFIN002/);
  const altered = bytes => Buffer.from(bytes.toString().replace(/^const pinnedManifestBlob='([a-f0-9]{40})';$/m,
    (_line, pin) => "const pinnedManifestBlob='" + (pin[0] === '0' ? '1' : '0') + pin.slice(1) + "';"));
  assert.notDeepEqual(altered(readFileSync(helperPath)), readFileSync(helperPath));
  assert.throws(() => verifyOwnerWebRelease({read: readWith(helperPath, altered)}), /verifier pin changed.*REVFIN002/);
});

test('REVFIN002 rejects manifest byte changes even when the JSON meaning is unchanged', () => {
  assert.throws(() => verifyOwnerWebRelease({read: readWith(manifestPath, bytes => Buffer.concat([bytes, Buffer.from('\n')]))}), /REVFIN002 manifest changed/);
});

for (const flag of flags) test('REVFIN002 rejects an enabled manifest capability: ' + flag, () => {
  assert.throws(() => verifyOwnerWebRelease({read: readWith(manifestPath, bytes => Buffer.from(JSON.stringify({...JSON.parse(bytes), [flag]: true}) + '\n'))}), /REVFIN002 manifest changed/);
});

test('REVFIN002 refuses an additional, missing or duplicated inventory entry', () => {
  const files = tracked(), extra = 'lib/platform/reverso/subscription/unreviewed-v2.mjs';
  assert.equal(files.includes(extra), false);
  for (const candidate of [[...files, extra], files.filter(name => name !== 'lib/platform/reverso/subscription/client-v2.mjs'), [...files, files[0]]])
    assert.throws(() => verifyOwnerWebRelease({read: readFileSync, tracked: candidate}), /exact inventory.*REVFIN002/);
});
