import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {verifyOwnerWebRelease} from '../scripts/check-ultra-owner-web.mjs';
import {buildReversoPublicationWebReview} from '../scripts/finalize-reverso-publication-web-release.mjs';

// Frozen-source checks use only file reads and local Git reads. Mutations are
// injected through a reader; no checkout, manifest, remote or payment is changed.
const base='d71bf6cdc237c7fa1ba082242fa6f09f1cbf895a';
const manifestPath='docs/release/REVPUB001-WEB-RELEASE.json';
const helperPath='scripts/check-ultra-owner-web.mjs';
const predecessorPath='scripts/check-reverso-publication-web-baseline.mjs';
const git=(...args)=>execFileSync('git',args,{maxBuffer:64*1024*1024});
const tracked=()=>git('ls-files','-z').toString().split('\0').filter(Boolean);
const manifest=()=>JSON.parse(readFileSync(manifestPath));
const blob=bytes=>createHash('sha1').update(Buffer.from('blob '+bytes.byteLength+'\0')).update(bytes).digest('hex');
const changed=bytes=>Buffer.concat([bytes,Buffer.from('\nSynthetic source-integrity mutation.\n')]);
const readWith=(target,transform=changed)=>name=>name===target?transform(readFileSync(name)):readFileSync(name);
const flags=['publicationApproved','actualExecutionAuthorized','realDebitAuthorized','liveExecutionAllowed',
 'realBillingAllowed','paymentIssuanceAllowed','brokerPermissionsGranted'];

test('REVPUB001 accepts its frozen source while retaining both Reverso predecessors and the Ultra verification chain',()=>{
 const result=verifyOwnerWebRelease(),m=manifest();
 for(const field of ['reversoWebPublicationRelease','reversoConclusionSourceRelease','reversoFinanceRelease',
  'reversoHistorySourceRelease','ultraProductionScopeRelease','ultraVercelExactSerializationRelease','exactSource'])assert.equal(result[field],true,field);
 assert.equal(m.schema,'JENIOS_REVPUB001_EXACT_WEB_SOURCE_V1');assert.equal(m.baseCommit,base);
 assert.equal(m.baseTree,'db07e4e6b22d73af7e71db6dccf27de81a9af2a5');
 assert.deepEqual(verifyOwnerWebRelease({read:readFileSync,tracked:tracked().reverse()}),result);
});

test('REVPUB001 keeps historical verifiers, manifests, tests and the Ultra production verifier byte-exact',()=>{
 assert.deepEqual(readFileSync(predecessorPath),git('show',base+':'+helperPath));
 for(const path of ['docs/release/REVFIN001-WEB-RELEASE.json','docs/release/REVFIN002-WEB-RELEASE.json',
  'tests/reverso-release.test.mjs','tests/reverso-release-v2.test.mjs','scripts/check-reverso-web-baseline.mjs',
  'scripts/check-reverso-web-history.mjs','scripts/check-reverso-v2-web-baseline.mjs','lib/release/ultra-production-source.mjs'])
  assert.deepEqual(readFileSync(path),git('show',base+':'+path),path);
});

test('REVPUB001 records only the current user-authorized Web scope and grants no real capability',()=>{
 const result=verifyOwnerWebRelease(),m=manifest();
 assert.equal(result.webPublicationApproved,true);assert.equal(m.webPublicationApproved,true);
 assert.equal(m.publicationScope,'web-only-disabled-finance');
 assert.equal(m.releaseBranch,'release/jenios-reverso-revpub001-20261113');
 assert.equal(m.authorizationReference,'USER_JENIOS_CONCLUIR_E_PUBLICAR_REVERSO_20261113');
 for(const flag of flags){assert.equal(m[flag],false,flag);assert.equal(result[flag],false,flag);}
});

test('REVPUB001 read-only closure reproduces the frozen manifest and verifier without rewriting source',()=>{
 const review=buildReversoPublicationWebReview();
 assert.deepEqual(review.manifestBytes,readFileSync(manifestPath));
 assert.deepEqual(review.helper,readFileSync(helperPath));
 assert.equal(review.manifestBlob,blob(readFileSync(manifestPath)));
 assert.deepEqual(review.inventory,tracked().sort());
});

test('REVPUB001 checks the actual new bytes of every allowed replacement after validating their predecessor',()=>{
 const replacements=manifest().replacements;
 assert.deepEqual(Object.keys(replacements).sort(),[
  'app/api/platform/admin/robots/reverso/route.js','app/api/platform/reverso/state/route.js',
  'app/api/platform/reverso/subscription/route.js','app/components/platform/PlatformReversoSubscription.js',
  'lib/release/environment-scope.mjs','scripts/check-s05-env-scope.mjs'].sort());
 for(const [path,entry] of Object.entries(replacements)){
  assert.equal(entry.baseline,blob(git('show',base+':'+path)),path);
  assert.equal(entry.target,blob(readFileSync(path)),path);
  assert.throws(()=>verifyOwnerWebRelease({read:readWith(path)}),/changed \(REVPUB001 successor\)/,path);
 }
});

test('REVPUB001 pins the deployed boundary, source gate, bootstrap and bundled original objects',()=>{
 for(const path of ['lib/platform/reverso/publication-boundary-v1.mjs','lib/release/reverso-production-source.mjs',
  'lib/release/reverso-predecessor-objects.mjs','docs/release/REVFIN002-WEB-PREDECESSORS.pack',
  'scripts/finalize-reverso-publication-web-release.mjs','tests/reverso-publication-release.test.mjs']){
  assert.equal(manifest().additions[path],blob(readFileSync(path)),path);
  assert.throws(()=>verifyOwnerWebRelease({read:readWith(path)}),/REVPUB001 addition changed/,path);
 }
});

test('REVPUB001 refuses a changed predecessor and continues to reject inherited source and manifest changes',()=>{
 for(const [path,diagnostic] of [
  [predecessorPath,/REVPUB001 predecessor verifier changed/],
  ['docs/release/REVFIN002-WEB-RELEASE.json',/REVFIN002 manifest changed/],
  ['docs/release/REVFIN001-WEB-RELEASE.json',/REVFIN001 manifest changed/],
  ['lib/platform/reverso/state-reader.mjs',/REVFIN001 addition changed/],
  ['lib/pay/catalog.mjs',/REVFIN001 inherited source changed/],
  ['app/components/platform/PlatformReversoFinance.js',/REVFIN002 inherited source changed/],
 ])assert.throws(()=>verifyOwnerWebRelease({read:readWith(path)}),diagnostic,path);
});

test('REVPUB001 rejects changed verifier source or a pin different from the executing verifier',()=>{
 assert.throws(()=>verifyOwnerWebRelease({read:readWith(helperPath)}),/verifier source changed.*REVPUB001/);
 const alterPin=bytes=>Buffer.from(bytes.toString().replace(/^const pinnedManifestBlob='([a-f0-9]{40})';$/m,
  (_line,pin)=>"const pinnedManifestBlob='"+(pin[0]==='0'?'1':'0')+pin.slice(1)+"';"));
 assert.notDeepEqual(alterPin(readFileSync(helperPath)),readFileSync(helperPath));
 assert.throws(()=>verifyOwnerWebRelease({read:readWith(helperPath,alterPin)}),/verifier pin changed.*REVPUB001/);
});

test('REVPUB001 rejects manifest byte changes, a broadened approval and any enabled financial capability',()=>{
 assert.throws(()=>verifyOwnerWebRelease({read:readWith(manifestPath,bytes=>Buffer.concat([bytes,Buffer.from('\n')]))}),/REVPUB001 manifest changed/);
 for(const change of [...flags.map(flag=>({[flag]:true})),{webPublicationApproved:false},
  {publicationScope:'unrestricted'},{releaseBranch:'main'},{authorizationReference:'unapproved'}]){
  assert.throws(()=>verifyOwnerWebRelease({read:readWith(manifestPath,bytes=>Buffer.from(JSON.stringify({...JSON.parse(bytes),...change})+'\n'))}),/REVPUB001 manifest changed/);
 }
});

test('REVPUB001 refuses an extra, missing or duplicated tracked path',()=>{
 const files=tracked(),extra='lib/platform/reverso/unreviewed-runtime.mjs';assert.equal(files.includes(extra),false);
 for(const candidate of [[...files,extra],files.filter(path=>path!=='lib/release/reverso-predecessor-objects.mjs'),[...files,files[0]]])
  assert.throws(()=>verifyOwnerWebRelease({read:readFileSync,tracked:candidate}),/exact inventory.*REVPUB001/);
});
