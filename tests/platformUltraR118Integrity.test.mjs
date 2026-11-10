import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inflateRawSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {verifyR106PublicGuidance} from '../scripts/check-authentication-r106.mjs';
test('R118 checkpoint ZIP matches source, declares no native validation and contains no state',()=>{
 const zip=readFileSync('public/downloads/jenios-ultra-r118-checkpoint.zip'),files=new Map();let offset=0;
 while(zip.readUInt32LE(offset)===0x04034b50){const size=zip.readUInt32LE(offset+18),names=zip.readUInt16LE(offset+26),extra=zip.readUInt16LE(offset+28),path=zip.subarray(offset+30,offset+30+names).toString(),start=offset+30+names+extra;files.set(path,inflateRawSync(zip.subarray(start,start+size)));offset=start+size;}
 const hashes=JSON.parse(files.get('INTEGRIDADE.json'));assert.equal(files.size,Object.keys(hashes).length+1);
 for(const [path,hash] of Object.entries(hashes)){assert.equal(createHash('sha256').update(files.get(path)).digest('hex'),hash);if(!path.endsWith('.md'))assert.deepEqual(files.get(path),readFileSync(path));}
 assert.ok(![...files.keys()].some(p=>/\.env|\.sqlite|\.dll|node_modules|__pycache__/.test(p)));assert.match(files.get('LEIA-ME.md').toString(),/ainda não operacional/);assert.match(files.get('LEIA-ME.md').toString(),/Não foi promovido para produção/);
});
test('R118 guard pins additive sources and rejects manifest or inherited changes',()=>{
 assert.equal(verifyR106PublicGuidance().exactSource,true);
 for(const target of ['docs/release/R118-EXECUTION-CHECKPOINT-EXTENSION.json','lib/platform/ultra/client/execution-runtime.mjs','lib/platform/ultra/client/binance-collector.mjs','lib/platform/ultra/client/binance-preflight.mjs','scripts/platform/ultra/profit_sdk_inventory.py','lib/platform/research/robot-r18-ultrafast-foundation.mjs'])assert.throws(()=>verifyR106PublicGuidance({read:path=>path===target?Buffer.from('unreviewed'):readFileSync(path)}));
});
