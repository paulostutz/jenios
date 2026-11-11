import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectVercelConfig} from '../../lib/release/vercel-config-diagnostic.mjs';
const known=JSON.stringify({$schema:'https://openapi.vercel.sh/vercel.json'},null,2);
const inspect=(text,source=known+'\n')=>inspectVercelConfig({readCurrent:()=>Buffer.from(text),readSource:()=>Buffer.from(source)});
test('known schema-only bytes expose exact escaped whitespace and semantic equality, not an authorization',()=>{
 const d=inspect(known);assert.equal(d.semanticEqualToGit,true);assert.equal(d.knownSafeOriginalUtf8,known);assert.notEqual(d.sha256,d.sourceSha256);assert.equal(d.byteLength,d.sourceByteLength-1);
 assert.equal(JSON.parse(JSON.stringify(d)).knownSafeOriginalUtf8,known);
});
test('unknown keys and duplicate hidden values never expose their values or original bytes',()=>{
 const secret='DO-NOT-LOG-THIS-VALUE';
 for(const text of [JSON.stringify({$schema:'https://openapi.vercel.sh/vercel.json',env:{secret}}),'{"$schema":"'+secret+'","$schema":"https://openapi.vercel.sh/vercel.json"}',JSON.stringify({$schema:secret}),'{"invalid":'+secret]){
  const d=inspect(text);assert.equal(d.knownSafeOriginalUtf8,undefined);assert.ok(!JSON.stringify(d).includes(secret));
 }
 assert.deepEqual(inspect(JSON.stringify({env:{secret}})).keys,['env']);
});
test('diagnostic bounds large files and key names and handles missing source without values',()=>{
 const big=inspectVercelConfig({readCurrent:()=>({byteLength:100000,limited:true})});assert.equal(big.sha256,null);assert.equal(big.limited,true);
 const entries=Object.fromEntries(Array.from({length:30},(_,i)=>['key'+i+'\n\x1b'+'x'.repeat(100),'secret']));const d=inspect(JSON.stringify(entries));assert.equal(d.keys.length,20);assert.ok(d.keys.every(k=>k.length<=60&&!/[\n\x1b]/.test(k)));
 assert.equal(inspectVercelConfig({readCurrent:()=>Buffer.from(known),readSource:()=>{throw Error('secret')}}).sourceUnavailable,true);
 assert.deepEqual(inspectVercelConfig({readCurrent:()=>{throw Error('sensitive')}}),{unavailable:true,semanticEqualToGit:false});
});
