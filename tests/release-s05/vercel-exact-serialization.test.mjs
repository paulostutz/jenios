import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {verifyOwnerWebRelease} from '../../scripts/check-ultra-owner-web.mjs';
// Exact remote evidence: dpl_7UyPYpudjksUdCh2wMjS1WizDH2g, source 2513957.
const expected='{"$schema":"https://openapi.vercel.sh/vercel.json"}\n';
test('Vercel config matches the remotely observed 52 bytes and SHA256 exactly',()=>{
 const bytes=readFileSync('vercel.json');assert.equal(bytes.length,52);assert.equal(bytes.toString('utf8'),expected);
 assert.equal(createHash('sha256').update(bytes).digest('hex'),'b0c3e7edc7d00c4682c759c53b8709170a63ee44a579620745565646bb9609aa');
 assert.deepEqual(JSON.parse(bytes.toString('utf8')),{$schema:'https://openapi.vercel.sh/vercel.json'});
 assert.equal(verifyOwnerWebRelease().ultraVercelExactSerializationRelease,true);
});
test('content guard still rejects every tested whitespace or semantic variation',()=>{
 for(const text of [expected.trimEnd(),expected+'\n',expected.replace('\n','\r\n'),JSON.stringify(JSON.parse(expected),null,2)+'\n',JSON.stringify({...JSON.parse(expected),buildCommand:'next build'})])assert.throws(()=>verifyOwnerWebRelease({read:name=>name==='vercel.json'?Buffer.from(text):readFileSync(name)}));
});
