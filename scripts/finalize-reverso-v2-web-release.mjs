/** REVFIN002 closure relative to the exact e53 candidate. This writes only
 * the new manifest and verifier; no staging, commit, publication or activation.
 * Without --finalize it reports the inventory without modifying any file. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync, writeFileSync, lstatSync, existsSync} from 'node:fs';
import {createHash} from 'node:crypto';

const BASE = 'e53d946e0434a6c8d2480ecf781f4b63707389b6';
const BASE_TREE = '83fd126ccd0d98c8d7782fe3e832659cd64f2424';
const HELPER = 'scripts/check-ultra-owner-web.mjs';
const PREDECESSOR = 'scripts/check-reverso-v2-web-baseline.mjs';
const MANIFEST = 'docs/release/REVFIN002-WEB-RELEASE.json';
const PLACEHOLDER = '__REVFIN002_MANIFEST_BLOB__';
const REPLACEMENTS = [
  'app/components/platform/PlatformReversoFinance.js',
  'app/components/social-auth-return.mjs',
  'tests/reverso-ui.test.mjs',
];
const ADDITIONS = [
  'app/api/platform/reverso/subscription/route.js',
  'app/components/platform/PlatformReversoSubscription.js',
  'app/components/platform/PlatformReversoSubscription.module.css',
  'docs/release/REVFIN002-SOURCE-VERIFICATION.md',
  'docs/reverso/REVFIN002-UI-JOURNEYS.md',
  'lib/platform/reverso/subscription/client-v2.mjs',
  'lib/platform/reverso/subscription/http-v2.mjs',
  'lib/platform/reverso/subscription/runtime-source-v2.mjs',
  'lib/platform/reverso/subscription/view-v2.mjs',
  PREDECESSOR,
  'scripts/check-reverso-v2-web-release.mjs',
  'scripts/finalize-reverso-v2-web-release.mjs',
  'scripts/render-reverso-v2-ui-fixtures.mjs',
  'tests/helpers/reverso-journey-harness-v2.mjs',
  'tests/reverso-release-v2.test.mjs',
  'tests/reverso-subscription-ui-v2.test.mjs',
];
const git = (...args) => execFileSync('git', args, {maxBuffer: 64 * 1024 * 1024});
const blob = bytes => createHash('sha1').update(Buffer.from('blob ' + bytes.byteLength + '\0')).update(bytes).digest('hex');
const paths = bytes => bytes.toString().split('\0').filter(Boolean);
const entries = () => Object.fromEntries(paths(git('ls-tree', '-r', '-z', BASE)).map(line => {
  const [metadata, path] = line.split('\t'), [mode, type, sha] = metadata.split(' ');
  assert.equal(type, 'blob', 'REVFIN002 source cannot introduce a submodule');
  return [path, {mode, sha}];
}));

const TEMPLATE = `// REVFIN002: exact successor of e53; production and environment gates unchanged.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {verifyOwnerWebRelease as previous} from './check-reverso-v2-web-baseline.mjs';
const base='${BASE}',baseTree='${BASE_TREE}';
const manifest='${MANIFEST}',helper='${HELPER}',predecessor='${PREDECESSOR}';
const replacements=${JSON.stringify(REPLACEMENTS)};
const pinnedManifestBlob='${PLACEHOLDER}';
const git=(...args)=>execFileSync('git',args,{maxBuffer:64*1024*1024});
const blob=bytes=>createHash('sha1').update(Buffer.from('blob '+bytes.byteLength+'\\0')).update(bytes).digest('hex');
const priorSources=new Map();
const readPrior=name=>{if(!priorSources.has(name))priorSources.set(name,git('show',base+':'+name));return Buffer.from(priorSources.get(name))};
const normalizeHelper=bytes=>{
 const text=bytes.toString(),pattern=/^const pinnedManifestBlob='([a-f0-9]{40})';$/gm;
 const pins=[...text.matchAll(pattern)];assert.equal(pins.length,1,'REVFIN001 verifier pin changed (REVFIN002 successor)');
 assert.equal(pins[0][1],pinnedManifestBlob,'REVFIN001 verifier pin changed (REVFIN002 successor)');
 return Buffer.from(text.replace(pattern,"const pinnedManifestBlob='${PLACEHOLDER}';"));
};
export function verifyOwnerWebRelease({read=readFileSync,tracked}={}){
 const bytes=read(manifest);assert.equal(blob(bytes),pinnedManifestBlob,'REVFIN002 manifest changed');
 const m=JSON.parse(bytes);assert.equal(m.schema,'JENIOS_REVFIN002_EXACT_WEB_SOURCE_V1');
 assert.equal(m.baseCommit,base);assert.equal(m.baseTree,baseTree);
 assert.equal(git('rev-parse',base+'^{tree}').toString().trim(),baseTree,'REVFIN002 predecessor tree changed');
 for(const key of ['publicationApproved','actualExecutionAuthorized','realDebitAuthorized','liveExecutionAllowed','realBillingAllowed','paymentIssuanceAllowed','brokerPermissionsGranted'])assert.equal(m[key],false,'REVFIN002 capability must stay false: '+key);
 const entries=Object.fromEntries(git('ls-tree','-r','-z',base).toString().split('\\0').filter(Boolean).map(line=>{const [meta,name]=line.split('\\t');return[name,meta.split(' ')[2]]}));
 const files=tracked??git('ls-files','-z').toString().split('\\0').filter(Boolean);
 assert.deepEqual([...files].sort(),[...Object.keys(entries),...Object.keys(m.additions),manifest].sort(),'REVFIN001 exact inventory (REVFIN002 successor)');
 assert.deepEqual(Object.keys(m.replacements).sort(),[...replacements].sort(),'REVFIN002 replacement scope changed');
 assert.equal(blob(read(predecessor)),entries[helper],'REVFIN002 predecessor verifier changed');
 assert.equal(blob(normalizeHelper(read(helper))),m.verifierTemplateBlob,'REVFIN001 verifier source changed (REVFIN002 successor)');
 // Run the unchanged e53 verifier on its exact inventory. Only the three
 // reviewed replacements and the current helper receive their e53 bytes.
 // All unchanged source is forwarded through read so inherited mutations
 // retain the original guard and diagnostic; current replacements are pinned below.
 const inherited=previous({tracked:Object.keys(entries),read:name=>name===helper?read(predecessor):replacements.includes(name)?readPrior(name):read(name)});
 for(const [name,sha] of Object.entries(entries)){
  if(name===helper)continue;
  const change=m.replacements[name];if(change)assert.equal(change.baseline,sha,'REVFIN002 replacement predecessor mismatch: '+name);
  assert.equal(blob(read(name)),change?.target??sha,'REVFIN002 inherited source changed: '+name);
 }
 for(const [name,sha] of Object.entries(m.additions)){
  assert.ok(!Object.hasOwn(entries,name)&&name!==manifest,'REVFIN002 addition cannot replace predecessor: '+name);
  assert.match(sha,/^[a-f0-9]{40}$/);assert.equal(blob(read(name)),sha,'REVFIN002 addition changed: '+name);
 }
 return {...inherited,reversoConclusionSourceRelease:true,exactSource:true,publicationApproved:false,actualExecutionAuthorized:false,realDebitAuthorized:false,brokerPermissionsGranted:false,liveExecutionAllowed:false,realBillingAllowed:false,paymentIssuanceAllowed:false};
}
// Use check-reverso-v2-web-release.mjs: exact historical modules retain their CLI trailers.
`;

function normalizeCurrentHelper(bytes) {
  const value = bytes.toString();
  if (!value.startsWith('// REVFIN002: exact successor of e53;')) return null;
  const pattern = /^const pinnedManifestBlob='[a-f0-9]{40}';$/gm;
  assert.equal([...value.matchAll(pattern)].length, 1, 'Existing REVFIN002 verifier has an invalid manifest pin');
  return Buffer.from(value.replace(pattern, "const pinnedManifestBlob='" + PLACEHOLDER + "';"));
}

export function buildReversoV2WebReview() {
  assert.equal(git('rev-parse', BASE + '^{tree}').toString().trim(), BASE_TREE, 'Retain the exact e53 Git tree');
  const baseline = entries();
  assert.equal(blob(readFileSync(PREDECESSOR)), baseline[HELPER].sha, 'Keep the exact e53 verifier as predecessor');
  const current = readFileSync(HELPER);
  if (blob(current) !== baseline[HELPER].sha) {
    const normalized = normalizeCurrentHelper(current);
    assert.ok(normalized, 'Unknown verifier modifications cannot be overwritten');
    assert.equal(blob(normalized), blob(Buffer.from(TEMPLATE)), 'Review verifier changes explicitly before finalization');
  }
  const files = [...new Set(paths(git('ls-files', '--cached', '--others', '--exclude-standard', '-z')))];
  const additions = {}, replacements = {};
  for (const name of Object.keys(baseline)) {
    assert.ok(files.includes(name) && existsSync(name) && lstatSync(name).isFile(), 'Inherited source deleted or replaced by a non-file: ' + name);
    if (name === HELPER) continue;
    const target = blob(readFileSync(name));
    if (target !== baseline[name].sha) {
      assert.ok(REPLACEMENTS.includes(name), 'REVFIN002 cannot change inherited source: ' + name);
      replacements[name] = {baseline: baseline[name].sha, target};
    }
  }
  assert.deepEqual(Object.keys(replacements).sort(), [...REPLACEMENTS].sort(), 'Review the three nominal replacements explicitly');
  for (const name of files.sort()) {
    if (Object.hasOwn(baseline, name) || name === MANIFEST) continue;
    assert.ok(ADDITIONS.includes(name), 'Unreviewed REVFIN002 addition: ' + name);
    assert.ok(lstatSync(name).isFile(), 'REVFIN002 additions must be regular files: ' + name);
    additions[name] = blob(readFileSync(name));
  }
  assert.deepEqual(Object.keys(additions).sort(), [...ADDITIONS].sort(), 'The exact reviewed REVFIN002 addition inventory is required');
  const manifest = {schema: 'JENIOS_REVFIN002_EXACT_WEB_SOURCE_V1', baseCommit: BASE, baseTree: BASE_TREE,
    verifierTemplateBlob: blob(Buffer.from(TEMPLATE)), additions, replacements,
    publicationApproved: false, actualExecutionAuthorized: false, realDebitAuthorized: false,
    liveExecutionAllowed: false, realBillingAllowed: false, paymentIssuanceAllowed: false, brokerPermissionsGranted: false};
  const manifestBytes = Buffer.from(JSON.stringify(manifest, null, 2) + '\n');
  const helper = Buffer.from(TEMPLATE.replace(PLACEHOLDER, blob(manifestBytes)));
  assert.equal(blob(normalizeCurrentHelper(helper)), manifest.verifierTemplateBlob);
  return {manifest, manifestBytes, helper, manifestBlob: blob(manifestBytes), inventory: [...Object.keys(baseline), ...Object.keys(additions), MANIFEST].sort()};
}

if (process.argv[1]?.endsWith('/finalize-reverso-v2-web-release.mjs')) {
  const args = process.argv.slice(2);
  assert.ok(args.length === 0 || args.length === 1 && args[0] === '--finalize', 'Use no arguments for review or --finalize for closure');
  const review = buildReversoV2WebReview();
  if (args[0] === '--finalize') {writeFileSync(MANIFEST, review.manifestBytes); writeFileSync(HELPER, review.helper);}
  console.log(JSON.stringify({status: args[0] === '--finalize' ? 'exact_source_manifest_written' : 'review_only_no_files_changed',
    baseCommit: BASE, baseTree: BASE_TREE, manifest: MANIFEST, manifestBlob: review.manifestBlob,
    additions: Object.keys(review.manifest.additions), replacements: Object.keys(review.manifest.replacements), inventoryFiles: review.inventory.length,
    publicationApproved: false, realBillingAllowed: false, liveExecutionAllowed: false,
    next: 'Review and stage the exact files; run source and behavioral checks. The production gate is unchanged.'}, null, 2));
}
