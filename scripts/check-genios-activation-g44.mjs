import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
const baseline=JSON.parse(readFileSync('docs/assistant/G44-PRODUCTION-BASELINE.json','utf8'));
assert.equal(baseline.commit,'43283a1833e8c9527f452a29fa5912b910ed5a00');
assert.equal(baseline.assistantBase,'15bff4f432cc45f61b2d32fd0aa29a45e8366c3c');
const exceptions=new Set(baseline.reviewedModifications);
for(const path of exceptions){
 assert.match(path,/^(?:app\/(?:admin\/page\.js|api\/(?:assistant\/|platform\/assistant\/)|components\/(?:assistant\/|learning\/LearningRoom\.js)|genios-pro\/|platform\/assistente\/)|lib\/(?:assistant\/|release\/environment-scope\.mjs)|tests\/|scripts\/check-s05-env-scope\.mjs)/);
 assert.ok(!/email|jenios-pay|subscription|webhook|broker/i.test(path),'Unrelated production area in review exceptions: '+path);
}
let preserved=0;
for(const [path,expected] of Object.entries(baseline.blobs)){
 const body=readFileSync(path);
 if(exceptions.has(path))continue;
 const actual=createHash('sha1').update(Buffer.from('blob '+body.byteLength+'\0')).update(body).digest('hex');
 assert.equal(actual,expected,'Published R43 source changed outside reviewed assistant activation: '+path);
 preserved++;
}
console.log('G44_PRODUCTION_BASELINE_PASS='+preserved+' unchanged published R43 files; '+exceptions.size+' reviewed assistant/build files; Work source, email, Auth, PAY, Inter and brokers preserved.');
