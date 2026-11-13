// REVFIN002: exact successor of e53; production and environment gates unchanged.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {verifyOwnerWebRelease as previous} from './check-reverso-v2-web-baseline.mjs';
const base='e53d946e0434a6c8d2480ecf781f4b63707389b6',baseTree='83fd126ccd0d98c8d7782fe3e832659cd64f2424';
const manifest='docs/release/REVFIN002-WEB-RELEASE.json',helper='scripts/check-ultra-owner-web.mjs',predecessor='scripts/check-reverso-v2-web-baseline.mjs';
const replacements=["app/components/platform/PlatformReversoFinance.js","app/components/social-auth-return.mjs","tests/reverso-ui.test.mjs"];
const pinnedManifestBlob='9ffba183f9b2d2b10ee158e2e7ff41197e45dc13';
const git=(...args)=>execFileSync('git',args,{maxBuffer:64*1024*1024});
const blob=bytes=>createHash('sha1').update(Buffer.from('blob '+bytes.byteLength+'\0')).update(bytes).digest('hex');
const priorSources=new Map();
const readPrior=name=>{if(!priorSources.has(name))priorSources.set(name,git('show',base+':'+name));return Buffer.from(priorSources.get(name))};
const normalizeHelper=bytes=>{
 const text=bytes.toString(),pattern=/^const pinnedManifestBlob='([a-f0-9]{40})';$/gm;
 const pins=[...text.matchAll(pattern)];assert.equal(pins.length,1,'REVFIN001 verifier pin changed (REVFIN002 successor)');
 assert.equal(pins[0][1],pinnedManifestBlob,'REVFIN001 verifier pin changed (REVFIN002 successor)');
 return Buffer.from(text.replace(pattern,"const pinnedManifestBlob='__REVFIN002_MANIFEST_BLOB__';"));
};
export function verifyOwnerWebRelease({read=readFileSync,tracked}={}){
 const bytes=read(manifest);assert.equal(blob(bytes),pinnedManifestBlob,'REVFIN002 manifest changed');
 const m=JSON.parse(bytes);assert.equal(m.schema,'JENIOS_REVFIN002_EXACT_WEB_SOURCE_V1');
 assert.equal(m.baseCommit,base);assert.equal(m.baseTree,baseTree);
 assert.equal(git('rev-parse',base+'^{tree}').toString().trim(),baseTree,'REVFIN002 predecessor tree changed');
 for(const key of ['publicationApproved','actualExecutionAuthorized','realDebitAuthorized','liveExecutionAllowed','realBillingAllowed','paymentIssuanceAllowed','brokerPermissionsGranted'])assert.equal(m[key],false,'REVFIN002 capability must stay false: '+key);
 const entries=Object.fromEntries(git('ls-tree','-r','-z',base).toString().split('\0').filter(Boolean).map(line=>{const [meta,name]=line.split('\t');return[name,meta.split(' ')[2]]}));
 const files=tracked??git('ls-files','-z').toString().split('\0').filter(Boolean);
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
