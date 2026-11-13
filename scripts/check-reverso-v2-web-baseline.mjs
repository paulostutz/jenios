// REVFIN001: exact reviewed source; production/environment gates are unchanged.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {verifyOwnerWebRelease as previous} from './check-reverso-web-history.mjs';
const base='0edbbef8c4b6bd5c9a6f5fb5e93c33eb7f11ce47',baseTree='c86e7eaef0a3c96efdb2daedf40ecccfcc56af32';
const manifest='docs/release/REVFIN001-WEB-RELEASE.json',helper='scripts/check-ultra-owner-web.mjs',predecessor='scripts/check-reverso-web-baseline.mjs';
const historyCommit='2c8ba6ed56178add03b1cebcab88599e27abb3c4',historyTree='068b4dc3eae6e5d45c3ec35d42459eaca638f423';
const historyHelper='scripts/check-reverso-web-history.mjs',historyManifest='docs/release/REVFIN001-HISTORY-WEB-PREDECESSOR.json';
const pinnedManifestBlob='4861a42d21ec0944eb35687fc32aac7e671336c0';
const git=(...args)=>execFileSync('git',args,{maxBuffer:64*1024*1024});
const blob=bytes=>createHash('sha1').update(Buffer.from('blob '+bytes.byteLength+'\0')).update(bytes).digest('hex');
const historySources=new Map();
const readHistory=name=>{if(!historySources.has(name))historySources.set(name,git('show',historyCommit+':'+name));return Buffer.from(historySources.get(name))};
const normalizeHelper=bytes=>{
 const value=bytes.toString(),pattern=/^const pinnedManifestBlob='([a-f0-9]{40})';$/gm;
 const pins=[...value.matchAll(pattern)];assert.equal(pins.length,1,'REVFIN001 verifier pin changed');
 assert.equal(pins[0][1],pinnedManifestBlob,'REVFIN001 verifier pin changed');
 return Buffer.from(value.replace(pattern,"const pinnedManifestBlob='__REVFIN_MANIFEST_BLOB__';"));
};
export function verifyOwnerWebRelease({read=readFileSync,tracked}={}){
 const bytes=read(manifest);assert.equal(blob(bytes),pinnedManifestBlob,'REVFIN001 manifest changed');
 const m=JSON.parse(bytes);assert.equal(m.schema,'JENIOS_REVFIN001_EXACT_WEB_SOURCE_V1');
 assert.equal(m.baseCommit,base);assert.equal(m.baseTree,baseTree);
 assert.equal(git('rev-parse',base+'^{tree}').toString().trim(),baseTree,'REVFIN001 predecessor tree changed');
 for(const key of ['publicationApproved','actualExecutionAuthorized','realDebitAuthorized','liveExecutionAllowed','realBillingAllowed','paymentIssuanceAllowed'])assert.equal(m[key],false,'REVFIN001 capability must stay false: '+key);
 const entries=Object.fromEntries(git('ls-tree','-r','-z',base).toString().split('\0').filter(Boolean).map(line=>{const [meta,name]=line.split('\t');return[name,meta.split(' ')[2]]}));
 const files=tracked??git('ls-files','-z').toString().split('\0').filter(Boolean);
 assert.deepEqual([...files].sort(),[...Object.keys(entries),...Object.keys(m.additions),manifest].sort(),'REVFIN001 exact inventory');
 assert.deepEqual(Object.keys(m.replacements).sort(),['app/dashboard-logado/page.js','app/platform/admin/robos/page.js','lib/pay/catalog.mjs','lib/pay/letter-billing-cb006.mjs','lib/platform/monthly-billing.mjs','tests/payCatalog.test.mjs'],'REVFIN001 replacement scope changed');
 assert.equal(blob(read(predecessor)),entries[helper],'REVFIN001 predecessor verifier changed');
 assert.equal(blob(normalizeHelper(read(helper))),m.verifierTemplateBlob,'REVFIN001 verifier source changed');
 assert.equal(blob(read(historyHelper)),'ac41d6c1a3f4164991246aca17aa787360af5928','REVFIN001 history verifier changed');
 assert.equal(blob(read(historyManifest)),'5ebd3fecf1ea3e9bee28f2694e303024d9f5a818','REVFIN001 history manifest changed');
 assert.equal(git('rev-parse',historyCommit+'^{tree}').toString().trim(),historyTree,'REVFIN001 history checkpoint changed');
 const historyFiles=git('ls-tree','-r','--name-only','-z',historyCommit).toString().split('\0').filter(Boolean);
 const inherited=previous({tracked:historyFiles,read:name=>name===helper?read(historyHelper):name===manifest?read(historyManifest):readHistory(name)});
 for(const [name,sha] of Object.entries(entries)){
  if(name===helper)continue;
  const change=m.replacements[name];if(change)assert.equal(change.baseline,sha,'REVFIN001 replacement predecessor mismatch: '+name);
  assert.equal(blob(read(name)),change?.target??sha,'REVFIN001 inherited source changed: '+name);
 }
 for(const [name,sha] of Object.entries(m.additions)){
  assert.ok(!Object.hasOwn(entries,name)&&name!==manifest,'REVFIN001 addition cannot replace predecessor: '+name);
  assert.match(sha,/^[a-f0-9]{40}$/);assert.equal(blob(read(name)),sha,'REVFIN001 addition changed: '+name);
 }
 return {...inherited,reversoHistorySourceRelease:true,reversoFinanceRelease:true,exactSource:true,publicationApproved:false,actualExecutionAuthorized:false,realDebitAuthorized:false,brokerPermissionsGranted:false,liveExecutionAllowed:false,realBillingAllowed:false,paymentIssuanceAllowed:false};
}
if(process.argv[1]?.endsWith('/check-ultra-owner-web.mjs'))console.log('REVFIN001_EXACT_WEB_SOURCE_PASS',verifyOwnerWebRelease());
