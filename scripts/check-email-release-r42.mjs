import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
const baseline=JSON.parse(readFileSync('docs/platform/R42-PRODUCTION-BASELINE.json','utf8'));
const exceptions=new Set(baseline.reviewedModifications);
assert.deepEqual([...exceptions].sort(),['app/admin/page.js','lib/release/environment-scope.mjs']);
let preserved=0;
for(const [path,expected] of Object.entries(baseline.blobs)){
 const body=readFileSync(path);
 if(exceptions.has(path))continue;
 const actual=createHash('sha1').update(Buffer.from('blob '+body.byteLength+'\0')).update(body).digest('hex');
 assert.equal(actual,expected,'Production file changed outside the email release: '+path);preserved++;
}
console.log('R42_PRODUCTION_BASELINE_PASS='+preserved+' unchanged files; two reviewed Admin/release-scope additions; no Auth/payment/broker changes');
