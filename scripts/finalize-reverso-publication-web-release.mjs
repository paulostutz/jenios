/** REVPUB001 closure relative to the exact d71 REVFIN002 candidate. This writes only
 * the new manifest and verifier; no staging, commit, publication or activation.
 * Without --finalize it reports the inventory without modifying any file. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync, writeFileSync, lstatSync, existsSync} from 'node:fs';
import {createHash} from 'node:crypto';

const BASE = 'd71bf6cdc237c7fa1ba082242fa6f09f1cbf895a';
const BASE_TREE = 'db07e4e6b22d73af7e71db6dccf27de81a9af2a5';
const HELPER = 'scripts/check-ultra-owner-web.mjs';
const PREDECESSOR = 'scripts/check-reverso-publication-web-baseline.mjs';
const MANIFEST = 'docs/release/REVPUB001-WEB-RELEASE.json';
const PLACEHOLDER = '__REVPUB001_MANIFEST_BLOB__';
const REPLACEMENTS = [
  "app/api/platform/admin/robots/reverso/route.js",
  "app/api/platform/reverso/state/route.js",
  "app/api/platform/reverso/subscription/route.js",
  "app/components/platform/PlatformReversoSubscription.js",
  "lib/release/environment-scope.mjs",
  "scripts/check-s05-env-scope.mjs"
];
// Exact inventory agreed with the root-owned publication boundary and bootstrap.
const ADDITIONS = [
  "docs/release/REVPUB001-BOUNDARY.md",
  "docs/release/REVPUB001-SOURCE-VERIFICATION.md",
  "docs/release/REVFIN002-WEB-PREDECESSORS.pack",
  "lib/release/reverso-predecessor-objects.mjs",
  "lib/release/reverso-production-source.mjs",
  "lib/platform/reverso/publication-boundary-v1.mjs",
  "scripts/check-reverso-publication-web-baseline.mjs",
  "scripts/check-reverso-publication-web-release.mjs",
  "scripts/finalize-reverso-publication-web-release.mjs",
  "tests/release-s05/environment-reverso-publication.test.mjs",
  "tests/reverso-predecessor-objects.test.mjs",
  "tests/reverso-publication-boundary.test.mjs",
  "tests/reverso-publication-release.test.mjs"
];
const git = (...args) => execFileSync('git', args, {maxBuffer: 64 * 1024 * 1024});
const blob = bytes => createHash('sha1').update(Buffer.from('blob ' + bytes.byteLength + '\0')).update(bytes).digest('hex');
const paths = bytes => bytes.toString().split('\0').filter(Boolean);
const entries = () => Object.fromEntries(paths(git('ls-tree', '-r', '-z', BASE)).map(line => {
  const [metadata, path] = line.split('\t'), [mode, type, sha] = metadata.split(' ');
  assert.equal(type, 'blob', 'REVPUB001 source cannot introduce a submodule');
  return [path, {mode, sha}];
}));

const TEMPLATE = `// REVPUB001: exact successor of d71; user-authorized Web release with runtime and money disabled.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {verifyOwnerWebRelease as previous} from './check-reverso-publication-web-baseline.mjs';
const base='${BASE}',baseTree='${BASE_TREE}';
const manifest='${MANIFEST}',helper='${HELPER}',predecessor='${PREDECESSOR}';
const replacements=${JSON.stringify(REPLACEMENTS)};
const replacementDiagnostics=${JSON.stringify(Object.fromEntries(REPLACEMENTS.map(path=>[path, path==='app/api/platform/reverso/subscription/route.js'||path==='app/components/platform/PlatformReversoSubscription.js'?'REVFIN002 addition changed':path.startsWith('app/api/')?'REVFIN001 addition changed':'REVFIN001 inherited source changed'])))};
const pinnedManifestBlob='${PLACEHOLDER}';
const git=(...args)=>execFileSync('git',args,{maxBuffer:64*1024*1024});
const blob=bytes=>createHash('sha1').update(Buffer.from('blob '+bytes.byteLength+'\\0')).update(bytes).digest('hex');
const priorSources=new Map();
const readPrior=name=>{if(!priorSources.has(name))priorSources.set(name,git('show',base+':'+name));return Buffer.from(priorSources.get(name))};
const normalizeHelper=bytes=>{
 const text=bytes.toString(),pattern=/^const pinnedManifestBlob='([a-f0-9]{40})';$/gm;
 const pins=[...text.matchAll(pattern)];assert.equal(pins.length,1,'REVFIN001 verifier pin changed (REVFIN002 successor; REVPUB001)');
 assert.equal(pins[0][1],pinnedManifestBlob,'REVFIN001 verifier pin changed (REVFIN002 successor; REVPUB001)');
 return Buffer.from(text.replace(pattern,"const pinnedManifestBlob='${PLACEHOLDER}';"));
};
export function verifyOwnerWebRelease({read=readFileSync,tracked}={}){
 const bytes=read(manifest);assert.equal(blob(bytes),pinnedManifestBlob,'REVPUB001 manifest changed');
 const m=JSON.parse(bytes);assert.equal(m.schema,'JENIOS_REVPUB001_EXACT_WEB_SOURCE_V1');
 assert.equal(m.baseCommit,base);assert.equal(m.baseTree,baseTree);
 assert.equal(m.webPublicationApproved,true,'REVPUB001 Web publication approval required');
 assert.equal(m.publicationScope,'web-only-disabled-finance');
 assert.equal(m.releaseBranch,'release/jenios-reverso-revpub001-20261113');
 assert.equal(git('rev-parse',base+'^{tree}').toString().trim(),baseTree,'REVPUB001 predecessor tree changed');
 for(const key of ['publicationApproved','actualExecutionAuthorized','realDebitAuthorized','liveExecutionAllowed','realBillingAllowed','paymentIssuanceAllowed','brokerPermissionsGranted'])assert.equal(m[key],false,'REVPUB001 capability must stay false: '+key);
 const entries=Object.fromEntries(git('ls-tree','-r','-z',base).toString().split('\\0').filter(Boolean).map(line=>{const [meta,name]=line.split('\\t');return[name,meta.split(' ')[2]]}));
 const files=tracked??git('ls-files','-z').toString().split('\\0').filter(Boolean);
 assert.deepEqual([...files].sort(),[...Object.keys(entries),...Object.keys(m.additions),manifest].sort(),'REVFIN001 exact inventory (REVFIN002 successor; REVPUB001)');
 assert.deepEqual(Object.keys(m.replacements).sort(),[...replacements].sort(),'REVPUB001 replacement scope changed');
 assert.equal(blob(read(predecessor)),entries[helper],'REVPUB001 predecessor verifier changed');
 assert.equal(blob(normalizeHelper(read(helper))),m.verifierTemplateBlob,'REVFIN001 verifier source changed (REVFIN002 successor; REVPUB001)');
 // Run the unchanged d71 verifier on its exact inventory. Only the nominal
 // reviewed replacements and the current helper receive their d71 bytes.
 // All unchanged source is forwarded through read so inherited mutations
 // retain the original guard and diagnostic; current replacements are pinned below.
 const inherited=previous({tracked:Object.keys(entries),read:name=>name===helper?read(predecessor):replacements.includes(name)?readPrior(name):read(name)});
 for(const [name,sha] of Object.entries(entries)){
  if(name===helper)continue;
  const change=m.replacements[name];if(change)assert.equal(change.baseline,sha,'REVPUB001 replacement predecessor mismatch: '+name);
  assert.equal(blob(read(name)),change?.target??sha,(change?replacementDiagnostics[name]:'REVPUB001 inherited source changed')+' (REVPUB001 successor): '+name);
 }
 for(const [name,sha] of Object.entries(m.additions)){
  assert.ok(!Object.hasOwn(entries,name)&&name!==manifest,'REVPUB001 addition cannot replace predecessor: '+name);
  assert.match(sha,/^[a-f0-9]{40}$/);assert.equal(blob(read(name)),sha,'REVPUB001 addition changed: '+name);
 }
 return {...inherited,reversoWebPublicationRelease:true,webPublicationApproved:true,exactSource:true,publicationApproved:false,actualExecutionAuthorized:false,realDebitAuthorized:false,brokerPermissionsGranted:false,liveExecutionAllowed:false,realBillingAllowed:false,paymentIssuanceAllowed:false};
}
// Use check-reverso-publication-web-release.mjs: exact historical modules retain their CLI trailers.
`;

function normalizeCurrentHelper(bytes) {
  const value = bytes.toString();
  if (!value.startsWith('// REVPUB001: exact successor of d71;')) return null;
  const pattern = /^const pinnedManifestBlob='[a-f0-9]{40}';$/gm;
  assert.equal([...value.matchAll(pattern)].length, 1, 'Existing REVPUB001 verifier has an invalid manifest pin');
  return Buffer.from(value.replace(pattern, "const pinnedManifestBlob='" + PLACEHOLDER + "';"));
}

export function buildReversoPublicationWebReview() {
  assert.equal(git('rev-parse', BASE + '^{tree}').toString().trim(), BASE_TREE, 'Retain the exact d71 Git tree');
  const baseline = entries();
  assert.equal(blob(readFileSync(PREDECESSOR)), baseline[HELPER].sha, 'Keep the exact d71 verifier as predecessor');
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
      assert.ok(REPLACEMENTS.includes(name), 'REVPUB001 cannot change inherited source: ' + name);
      replacements[name] = {baseline: baseline[name].sha, target};
    }
  }
  assert.deepEqual(Object.keys(replacements).sort(), [...REPLACEMENTS].sort(), 'Review every nominal replacement explicitly');
  for (const name of files.sort()) {
    if (Object.hasOwn(baseline, name) || name === MANIFEST) continue;
    assert.ok(ADDITIONS.includes(name), 'Unreviewed REVPUB001 addition: ' + name);
    assert.ok(lstatSync(name).isFile(), 'REVPUB001 additions must be regular files: ' + name);
    additions[name] = blob(readFileSync(name));
  }
  assert.deepEqual(Object.keys(additions).sort(), [...ADDITIONS].sort(), 'The exact reviewed REVPUB001 addition inventory is required');
  const manifest = {schema: 'JENIOS_REVPUB001_EXACT_WEB_SOURCE_V1', baseCommit: BASE, baseTree: BASE_TREE,
    verifierTemplateBlob: blob(Buffer.from(TEMPLATE)), additions, replacements,
    webPublicationApproved: true, publicationScope: 'web-only-disabled-finance', releaseBranch: 'release/jenios-reverso-revpub001-20261113',
    authorizationReference: 'USER_JENIOS_CONCLUIR_E_PUBLICAR_REVERSO_20261113',
    publicationApproved: false, actualExecutionAuthorized: false, realDebitAuthorized: false,
    liveExecutionAllowed: false, realBillingAllowed: false, paymentIssuanceAllowed: false, brokerPermissionsGranted: false};
  const manifestBytes = Buffer.from(JSON.stringify(manifest, null, 2) + '\n');
  const helper = Buffer.from(TEMPLATE.replace(PLACEHOLDER, blob(manifestBytes)));
  assert.equal(blob(normalizeCurrentHelper(helper)), manifest.verifierTemplateBlob);
  return {manifest, manifestBytes, helper, manifestBlob: blob(manifestBytes), inventory: [...Object.keys(baseline), ...Object.keys(additions), MANIFEST].sort()};
}

if (process.argv[1]?.endsWith('/finalize-reverso-publication-web-release.mjs')) {
  const args = process.argv.slice(2);
  assert.ok(args.length === 0 || args.length === 1 && args[0] === '--finalize', 'Use no arguments for review or --finalize for closure');
  const review = buildReversoPublicationWebReview();
  if (args[0] === '--finalize') {writeFileSync(MANIFEST, review.manifestBytes); writeFileSync(HELPER, review.helper);}
  console.log(JSON.stringify({status: args[0] === '--finalize' ? 'exact_source_manifest_written' : 'review_only_no_files_changed',
    baseCommit: BASE, baseTree: BASE_TREE, manifest: MANIFEST, manifestBlob: review.manifestBlob,
    additions: Object.keys(review.manifest.additions), replacements: Object.keys(review.manifest.replacements), inventoryFiles: review.inventory.length,
    webPublicationApproved: true, publicationScope: 'web-only-disabled-finance',
    publicationApproved: false, realBillingAllowed: false, liveExecutionAllowed: false,
    next: 'Review and stage the exact files; run source and behavioral checks. Use the explicit REVPUB001 deployment gate; runtime, billing and execution remain disabled.'}, null, 2));
}
