import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {verifyR106PublicGuidance as verifyPrevious} from './check-r106-production-baseline.mjs';
const base='6d1f58efc6e5d79aac30e4e8e29c60995ef411ea';
const path='docs/release/ULTRA-OWNER-WEB-RELEASE.json',helper='scripts/check-ultra-owner-web.mjs';
const manifestSha='ddd93d25828f21ed65582ee74474e3e572c9f6fd';
const git=(...args)=>execFileSync('git',args,{maxBuffer:64*1024*1024});
const blob=b=>createHash('sha1').update(Buffer.from('blob '+b.byteLength+'\0')).update(b).digest('hex');
export function verifyOwnerWebRelease({read=readFileSync,tracked}={}){
 const bytes=read(path);assert.equal(blob(bytes),manifestSha,'Owner web manifest changed');const m=JSON.parse(bytes);assert.equal(m.baseCommit,base);
 assert.equal(git('rev-parse',base+'^{tree}').toString().trim(),m.baseTree);
 const entries=Object.fromEntries(git('ls-tree','-r','-z',base).toString().split('\0').filter(Boolean).map(line=>{const [meta,name]=line.split('\t');return [name,meta.split(' ')[2]]}));
 const files=tracked??git('ls-files','-z').toString().split('\0').filter(Boolean);
 assert.deepEqual([...files].sort(),[...Object.keys(entries),...Object.keys(m.additions),path,helper].sort(),'Owner web exact inventory');
 const previous=verifyPrevious({tracked:Object.keys(entries),read:name=>Object.hasOwn(m.replacements,name)?git('show',base+':'+name):read(name)});
 assert.equal(blob(read('scripts/check-r106-production-baseline.mjs')),entries['scripts/check-authentication-r106.mjs'],'Production predecessor verifier changed');
 for(const [name,sha] of Object.entries(entries)){
  const change=m.replacements[name];if(change)assert.equal(change.baseline,sha);
  assert.equal(blob(read(name)),change?.target??sha,'Owner web source changed: '+name);
 }
 for(const [name,sha] of Object.entries(m.additions)){assert.ok(!Object.hasOwn(entries,name));assert.equal(blob(read(name)),sha,'Owner web addition changed: '+name);}
 for(const name of Object.keys(m.replacements))assert.ok(Object.hasOwn(entries,name));
 return {...previous,ownerWebRelease:true,exactSource:true,brokerPermissionsGranted:false,liveExecutionAllowed:false,realBillingAllowed:false};
}
if(process.argv[1]?.endsWith('/check-ultra-owner-web.mjs'))console.log(verifyOwnerWebRelease());
