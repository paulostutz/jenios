import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
const baseline=JSON.parse(readFileSync('docs/platform/R42-PRODUCTION-BASELINE.json','utf8'));
const exceptions=new Set(baseline.reviewedModifications);
assert.deepEqual([...exceptions].sort(),['app/admin/page.js','lib/release/environment-scope.mjs']);
// R43 extends the user-approved scope to client access and simulation controls.
// Pin each reviewed file to its exact Git blob; all other baseline files remain locked.
const clientReview=JSON.parse(readFileSync('docs/platform/R43-CLIENT-READINESS-BASELINE.json','utf8'));
assert.equal(clientReview.baseCommit,'e9926d975a48c72ac3815de6fc6d3bdae717d7c5');
const experienceReview=JSON.parse(readFileSync('docs/platform/R44-CLIENT-EXPERIENCE-BASELINE.json','utf8'));
assert.equal(experienceReview.baseCommit,'43283a1833e8c9527f452a29fa5912b910ed5a00');
const blob=body=>createHash('sha1').update(Buffer.from('blob '+body.byteLength+'\0')).update(body).digest('hex');
for(const [path,hash] of Object.entries(clientReview.reviewedBlobs))
 assert.equal(blob(readFileSync(path)),experienceReview.reviewedBlobs[path]||hash,'Reviewed R43 file changed: '+path);
for(const [path,hash] of Object.entries(experienceReview.reviewedBlobs))
 assert.equal(blob(readFileSync(path)),hash,'Reviewed R44 file changed: '+path);
let preserved=0;
for(const [path,expected] of Object.entries(baseline.blobs)){
 const body=readFileSync(path);
 if(exceptions.has(path))continue;
 const actual=blob(body);
 assert.equal(actual,experienceReview.reviewedBlobs[path]||clientReview.reviewedBlobs[path]||expected,'Production file changed outside reviewed R42/R43/R44 scope: '+path);preserved++;
}
console.log('R42_R43_R44_PRODUCTION_BASELINE_PASS='+preserved+' baseline files checked; exact reviewed client changes; email/payment/broker engines preserved');
