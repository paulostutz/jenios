import test from 'node:test';import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {inspectB293PrivateSignalEvidence} from '../lib/platform/research/b293-private-evidence-readiness.mjs';
const core={schema:'JENIOS_B293_PRIVATE_SIGNAL_EVIDENCE_V1',coreSha256:'a'.repeat(64),
 readOnly:true,transportEnabled:false,
 events:['manual','hybrid','reverse'].map((mode,i)=>({mode,id:'e'+i,
 emittedAtMs:1000,targetOpenMs:4000,direction:i===1?'ABSTAIN':'UP',
 orderSubmitted:false,privateSourceAttested:false}))};
const seal=x=>({...x,sha256:createHash('sha256').update(JSON.stringify(x)).digest('hex')});
test('B293 audits three declared modes but never certifies private engine',()=>{
 const x=inspectB293PrivateSignalEvidence(seal(core),{nowMs:5000});
 assert.equal(x.total,3);assert.equal(x.ordersSent,0);
 assert.equal(x.executableBytesVerified,false);
 assert.equal(x.realSignalEmissionVerified,false);
});
test('B293 rejects forged source claims, lookahead and duplicates',()=>{
 for(const patch of [{privateSourceAttested:true},{emittedAtMs:5000},{id:'e1'}]){
  const events=core.events.map((x,i)=>i===0?{...x,...patch}:x);
  assert.throws(()=>inspectB293PrivateSignalEvidence(seal({...core,events}),{nowMs:5000}),/B293_INVALID_SIGNAL_EVENT/);
 }
});
test('B293 rejects post-hoc edits of the sealed event',()=>{
 const batch=seal(core),events=[{...core.events[0],direction:'DOWN'},...core.events.slice(1)];
 assert.throws(()=>inspectB293PrivateSignalEvidence({...batch,events},{nowMs:5000}),/B293_EVIDENCE_TAMPERED/);
});
test('B293 refuses transport enabled',()=>{
 assert.throws(()=>inspectB293PrivateSignalEvidence(seal({...core,transportEnabled:true}),{nowMs:5000}),/B293_UNTRUSTED_BATCH/);
});
