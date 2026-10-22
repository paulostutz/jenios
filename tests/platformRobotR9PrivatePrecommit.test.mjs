import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {reviewR9PrivatePrecommit,recordR9UnavailableFreshContext}
 from '../lib/platform/research/robot-r9-private-precommit.mjs';
const target=Date.parse('2026-10-22T16:00:00Z');
const fixture=()=>({schema:'JENIOS_R9_PRIVATE_ORIGINAL_PRECOMMIT_V1',
 studyId:'synthetic-no-trade',asset:'BTC-USD',targetOpenMs:target,
 targetCloseMs:target+3600000,capturedAtMs:target-900000,
 decidedAtMs:target-850000,registeredAtMs:target-800000,
 engineSha256:'9341d9243cbe742b90bf40149663e632fc472f5586c74bf70bdfcfd114e65aea',
 serviceSha256:'cbb92005459f79bf6e23a0edc7c5542cc62b632b6c301e3f23b98ebd514ce5be',
 inputSha256:'a'.repeat(64),modeResults:['manual','hybrid','reverse'].flatMap(mode=>
 ['buy','sell'].map(intent=>({mode,intent,action:'wait_for_context',side:null}))),
 originalCorePrivate:true,liveExecutionDisabled:true,ordersSent:0});
test('R9 draft accepted but independent original source and clock remain unproven',()=>{
 const r=reviewR9PrivatePrecommit(fixture(),{reviewedAtMs:target-700000});
 assert.equal(r.declaredLeadMs,800000);
 assert.equal(r.independentRegistrationTimestampVerified,false);
 assert.equal(r.outcomeObserved,false);assert.equal(r.ordersSent,0);
});
test('R9 strictly refuses tardy or backdated synthetic forecasts',()=>{
 const f=fixture();
 for(const patch of [{registeredAtMs:target-599999},
 {capturedAtMs:f.decidedAtMs+1},{decidedAtMs:f.registeredAtMs+1}])
 assert.throws(()=>reviewR9PrivatePrecommit({...f,...patch},{reviewedAtMs:target}));
});
test('R9 refuses forged trade, profits or independent attestation fields',()=>{
 const f=fixture();
 for(const patch of [{actualPnl:500},{ordersSent:1},{independentTimestampVerified:true},
 {originalCorePrivate:false},{engineSha256:'a'.repeat(64)}])
 assert.throws(()=>reviewR9PrivatePrecommit({...f,...patch},{reviewedAtMs:target}));
});
test('R9 all 3x2 mode intent tuples required',()=>{
 const f=fixture();assert.throws(()=>reviewR9PrivatePrecommit({...f,
 modeResults:[...f.modeResults.slice(0,5),f.modeResults[0]]},{reviewedAtMs:target}));
});
test('R9 R8 captured public data cannot be used as a fresh forward registered decision',()=>{
 const r=recordR9UnavailableFreshContext({lastCapturedAtMs:Date.parse('2026-10-22T11:23:05Z'),
 checkedAtMs:Date.parse('2026-10-22T12:09:00Z'),targetOpenMs:target});
 assert.equal(r.genuinePrivateForecastRecorded,false);
 assert.equal(r.staleR8InputCannotClaimNewProspectiveSignal,true);
});
test('R9 code does not send orders, fetch markets or import proprietary core',()=>{
 const s=readFileSync(new URL('../lib/platform/research/robot-r9-private-precommit.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(s,/submitOrder|fetch\s*\(|process\.env|from ['"].*engine\.mjs/);
 const v=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url)));
 assert.equal(v.git.deploymentEnabled['fix/jenios-robot-r9-forward-private-core-prereg-20261022'],false);
});
