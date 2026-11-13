import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {verifyOwnerWebRelease} from '../scripts/check-ultra-owner-web.mjs';

// Reads the finalized, reviewed source. Never generates or rewrites a manifest.
const manifestPath = 'docs/release/REVFIN001-WEB-RELEASE.json';
const helperPath = 'scripts/check-ultra-owner-web.mjs';
const predecessorPath = 'scripts/check-reverso-web-baseline.mjs';
const trackedFiles = () => execFileSync('git', ['ls-files', '-z'], {maxBuffer: 64 * 1024 * 1024}).toString().split('\0').filter(Boolean);
const manifest = () => JSON.parse(readFileSync(manifestPath, 'utf8'));
const readWith = (target, transform) => name => name === target ? transform(readFileSync(name)) : readFileSync(name);
const changed = bytes => Buffer.concat([bytes, Buffer.from('\n// Synthetic source-integrity mutation.\n')]);
const manifestFlags = ['publicationApproved', 'actualExecutionAuthorized', 'realDebitAuthorized', 'liveExecutionAllowed', 'realBillingAllowed', 'paymentIssuanceAllowed'];

test('REVFIN001 accepts the exact finalized source and retains the prior verification chain', () => {
  const result = verifyOwnerWebRelease();
  assert.equal(result.reversoFinanceRelease, true);
  assert.equal(result.exactSource, true);
  assert.equal(result.ultraProductionScopeRelease, true);
  assert.equal(result.ultraVercelExactSerializationRelease, true);
  assert.equal(result.reversoHistorySourceRelease, true);
  assert.deepEqual(verifyOwnerWebRelease({read: readFileSync, tracked: trackedFiles().reverse()}), result);
});

test('REVFIN001 source verification grants no publication, execution, debit or billing capability', () => {
  const result = verifyOwnerWebRelease(), review = manifest();
  for (const key of manifestFlags) {
    assert.equal(review[key], false, 'Manifest capability: ' + key);
    assert.equal(result[key], false, 'Verifier capability: ' + key);
  }
  assert.equal(result.brokerPermissionsGranted, false);
  assert.equal(review.schema, 'JENIOS_REVFIN001_EXACT_WEB_SOURCE_V1');
  assert.equal(review.baseCommit, '0edbbef8c4b6bd5c9a6f5fb5e93c33eb7f11ce47');
  assert.equal(review.baseTree, 'c86e7eaef0a3c96efdb2daedf40ecccfcc56af32');
});

for (const path of [
  'lib/platform/reverso/state-reader.mjs',
  'lib/platform/reverso/state-contract.mjs',
  'lib/platform/reverso/access.mjs',
  'lib/platform/reverso/subscription/isolation-rpc-v1.mjs',
]) test('REVFIN001 rejects a mutation of the reviewed Reverso module: ' + path, () => {
  assert.throws(() => verifyOwnerWebRelease({read: readWith(path, changed)}), /REVFIN001 addition changed/);
});

for (const path of [
  'lib/pay/catalog.mjs',
  'app/dashboard-logado/page.js',
  'app/platform/admin/robos/page.js',
  'lib/pay/letter-billing-cb006.mjs',
  'lib/platform/monthly-billing.mjs',
]) test('REVFIN001 rejects a mutation of the reviewed catalog, navigation or disabled-isolation consumer: ' + path, () => {
  assert.throws(() => verifyOwnerWebRelease({read: readWith(path, changed)}), /REVFIN001 inherited source changed/);
});

test('REVFIN001 refuses a changed exact predecessor instead of bypassing its guards', () => {
  assert.throws(() => verifyOwnerWebRelease({read: readWith(predecessorPath, changed)}), /REVFIN001 predecessor verifier changed/);
});

test('REVFIN001 refuses a changed exact history verifier from the reviewed local checkpoint', () => {
  assert.throws(() => verifyOwnerWebRelease({read: readWith('scripts/check-reverso-web-history.mjs', changed)}), /REVFIN001 history verifier changed/);
});

test('REVFIN001 refuses a changed exact history manifest from the reviewed local checkpoint', () => {
  assert.throws(() => verifyOwnerWebRelease({read: readWith('docs/release/REVFIN001-HISTORY-WEB-PREDECESSOR.json', changed)}), /REVFIN001 history manifest changed/);
});

test('REVFIN001 refuses a changed verifier body', () => {
  assert.throws(() => verifyOwnerWebRelease({read: readWith(helperPath, changed)}), /REVFIN001 verifier source changed/);
});

test('REVFIN001 refuses a verifier pin differing from the executing reviewed verifier', () => {
  const alteredPin = bytes => {
    const value = bytes.toString();
    const changedValue = value.replace(/^const pinnedManifestBlob='([a-f0-9]{40})';$/m, (_line, pin) =>
      "const pinnedManifestBlob='" + (pin[0] === '0' ? '1' : '0') + pin.slice(1) + "';");
    assert.notEqual(changedValue, value, 'The finalized verifier must contain its manifest pin');
    return Buffer.from(changedValue);
  };
  assert.throws(() => verifyOwnerWebRelease({read: readWith(helperPath, alteredPin)}), /REVFIN001 verifier pin changed/);
});

test('REVFIN001 refuses a manifest byte change even if its JSON meaning is unchanged', () => {
  assert.throws(() => verifyOwnerWebRelease({read: readWith(manifestPath, bytes => Buffer.concat([bytes, Buffer.from('\n')]))}), /REVFIN001 manifest changed/);
});

for (const flag of manifestFlags) test('REVFIN001 refuses a manifest enabling ' + flag, () => {
  const enabled = bytes => Buffer.from(JSON.stringify({...JSON.parse(bytes), [flag]: true}, null, 2) + '\n');
  assert.throws(() => verifyOwnerWebRelease({read: readWith(manifestPath, enabled)}), /REVFIN001 manifest changed/);
});

test('REVFIN001 rejects an additional file outside the exact reviewed inventory', () => {
  const files = trackedFiles(), extra = 'lib/platform/reverso/unreviewed-financial-source.mjs';
  assert.equal(files.includes(extra), false);
  assert.throws(() => verifyOwnerWebRelease({read: readFileSync, tracked: [...files, extra]}), /REVFIN001 exact inventory/);
});

test('REVFIN001 rejects a missing reviewed file without changing the working tree', () => {
  const files = trackedFiles(), missing = 'lib/platform/reverso/state-reader.mjs';
  assert.ok(files.includes(missing));
  assert.throws(() => verifyOwnerWebRelease({read: readFileSync, tracked: files.filter(path => path !== missing)}), /REVFIN001 exact inventory/);
});
