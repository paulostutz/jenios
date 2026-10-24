import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
const baseline=JSON.parse(readFileSync('docs/assistant/G43-PRODUCTION-BASELINE.json','utf8'));
assert.equal(baseline.commit,'e9926d975a48c72ac3815de6fc6d3bdae717d7c5');
const exceptions=new Set(baseline.reviewedModifications);
for(const path of exceptions){
 assert.match(path,/^(?:app\/(?:admin\/page\.js|api\/(?:assistant\/|platform\/assistant\/)|components\/(?:assistant\/|learning\/LearningRoom\.js)|genios-pro\/|platform\/assistente\/)|lib\/(?:assistant\/|release\/environment-scope\.mjs)|tests\/)/);
 assert.ok(!/email|jenios-pay|auth|subscription|webhook|broker/i.test(path),'Unrelated production area in review exceptions: '+path);
}
let preserved=0;
for(const [path,expected] of Object.entries(baseline.blobs)){
 const body=readFileSync(path);
 if(exceptions.has(path))continue;
 const actual=createHash('sha1').update(Buffer.from('blob '+body.byteLength+'\0')).update(body).digest('hex');
 assert.equal(actual,expected,'Production source changed outside assistant scope: '+path);preserved++;
}
console.log('G43_PRODUCTION_BASELINE_PASS='+preserved+' unchanged production files; '+exceptions.size+' reviewed assistant files; email/Auth/PAY/broker source preserved.');
