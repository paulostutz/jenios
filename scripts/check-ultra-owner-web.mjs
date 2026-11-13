// REVPUB001: exact successor of d71; user-authorized Web release with runtime and money disabled.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {verifyOwnerWebRelease as previous} from './check-reverso-publication-web-baseline.mjs';
const base='d71bf6cdc237c7fa1ba082242fa6f09f1cbf895a',baseTree='db07e4e6b22d73af7e71db6dccf27de81a9af2a5';
const manifest='docs/release/REVPUB001-WEB-RELEASE.json',helper='scripts/check-ultra-owner-web.mjs',predecessor='scripts/check-reverso-publication-web-baseline.mjs';
const replacements=["app/api/platform/admin/robots/reverso/route.js","app/api/platform/reverso/state/route.js","app/api/platform/reverso/subscription/route.js","app/components/platform/PlatformReversoSubscription.js","lib/release/environment-scope.mjs","scripts/check-s05-env-scope.mjs"];
const replacementDiagnostics={"app/api/platform/admin/robots/reverso/route.js":"REVFIN001 addition changed","app/api/platform/reverso/state/route.js":"REVFIN001 addition changed","app/api/platform/reverso/subscription/route.js":"REVFIN002 addition changed","app/components/platform/PlatformReversoSubscription.js":"REVFIN002 addition changed","lib/release/environment-scope.mjs":"REVFIN001 inherited source changed","scripts/check-s05-env-scope.mjs":"REVFIN001 inherited source changed"};
const pinnedManifestBlob='e72d2acd2c79dd9125b0eaa89151eea685705df3';
const git=(...args)=>execFileSync('git',args,{maxBuffer:64*1024*1024});
const blob=bytes=>createHash('sha1').update(Buffer.from('blob '+bytes.byteLength+'\0')).update(bytes).digest('hex');
const priorSources=new Map();
const readPrior=name=>{if(!priorSources.has(name))priorSources.set(name,git('show',base+':'+name));return Buffer.from(priorSources.get(name))};
const normalizeHelper=bytes=>{
 const text=bytes.toString(),pattern=/^const pinnedManifestBlob='([a-f0-9]{40})';$/gm;
 const pins=[...text.matchAll(pattern)];assert.equal(pins.length,1,'REVFIN001 verifier pin changed (REVFIN002 successor; REVPUB001)');
 assert.equal(pins[0][1],pinnedManifestBlob,'REVFIN001 verifier pin changed (REVFIN002 successor; REVPUB001)');
 return Buffer.from(text.replace(pattern,"const pinnedManifestBlob='__REVPUB001_MANIFEST_BLOB__';"));
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
 const entries=Object.fromEntries(git('ls-tree','-r','-z',base).toString().split('\0').filter(Boolean).map(line=>{const [meta,name]=line.split('\t');return[name,meta.split(' ')[2]]}));
 const files=tracked??git('ls-files','-z').toString().split('\0').filter(Boolean);
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
