// Exact predecessor is retained and executed before the command extension.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {verifyOwnerWebRelease as previous} from './check-ultra-production-diagnostic-baseline.mjs';
const base='b69c93ce8a8a776af72c6f535826a10974dfb265',manifest='docs/release/ULTRA-MINIMAL-VERCEL-CONFIG-RELEASE.json',helper='scripts/check-ultra-owner-web.mjs';
const manifestSha='fff107579f23f49eca2b4143524fae44c93aa272';
const git=(...a)=>execFileSync('git',a,{maxBuffer:64*1024*1024});
const blob=b=>createHash('sha1').update(Buffer.from('blob '+b.byteLength+'\0')).update(b).digest('hex');
export function verifyOwnerWebRelease({read=readFileSync,tracked}={}){
 const bytes=read(manifest);assert.equal(blob(bytes),manifestSha,'Command manifest changed');const m=JSON.parse(bytes);
 const entries=Object.fromEntries(git('ls-tree','-r','-z',base).toString().split('\0').filter(Boolean).map(l=>{const [a,n]=l.split('\t');return[n,a.split(' ')[2]]}));
 const files=tracked??git('ls-files','-z').toString().split('\0').filter(Boolean);
 assert.deepEqual([...files].sort(),[...Object.keys(entries),...Object.keys(m.additions),manifest].sort(),'Command exact inventory');
 const result=previous({tracked:Object.keys(entries),read:name=>name===helper||Object.hasOwn(m.replacements,name)?git('show',base+':'+name):read(name)});
 assert.equal(blob(read('scripts/check-ultra-production-diagnostic-baseline.mjs')),entries[helper],'Predecessor verifier changed');
 for(const [name,sha] of Object.entries(entries)){if(name===helper)continue;const change=m.replacements[name];if(change)assert.equal(change.baseline,sha);assert.equal(blob(read(name)),change?.target??sha,'Command source changed: '+name);}
 for(const [name,sha] of Object.entries(m.additions)){assert.ok(!Object.hasOwn(entries,name));assert.equal(blob(read(name)),sha,'Command addition changed: '+name);}
 return {...result,ultraMinimalVercelConfigRelease:true,liveExecutionAllowed:false,realBillingAllowed:false};
}
if(process.argv[1]?.endsWith('/check-ultra-owner-web.mjs'))console.log(verifyOwnerWebRelease());
