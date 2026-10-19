import test from 'node:test';
import assert from 'node:assert/strict';
import {auditLocalProspectiveCohort,prospectiveReadinessLabel} from '../lib/platform/prospective-cohort.mjs';
const start=Date.parse('2026-10-19T09:00:00Z'),granularity=300,now=start+14*granularity*1000;
const r=i=>({source:'browser_public_candle_capture',realOrder:false,verifiedProfit:null,
  candleAt:new Date(start+i*granularity*1000).toISOString(),
  recordedAt:new Date(start+i*granularity*1000+1000).toISOString(),close:110+i});
test('B91 prospective local samples report limitations, never certify robots or independent timestamps',()=>{
 const series=Array.from({length:13},(_,i)=>r(i));
 const x=auditLocalProspectiveCohort(series,{granularity,now});
 assert.equal(x.valid,true);assert.equal(x.paperReviewReady,true);
 assert.equal(x.robotPerformanceCertified,false);
 assert.equal(x.independentTimestampVerified,false);
 assert.equal(x.externalProvenanceVerified,false);
 assert.equal(x.realExecutionAllowed,false);
 assert.match(prospectiveReadinessLabel(x),/não para certificação/);
});
test('B91 detects duplicate and edited backwards timestamps instead of silently accepting',()=>{
 const series=[r(0),r(1),r(1),r(2)];
 assert.equal(auditLocalProspectiveCohort(series,{granularity,now}).valid,false);
 assert.equal(auditLocalProspectiveCohort([r(2),r(1)],{granularity,now}).valid,false);
});
test('B91 forged P&L, future capture and implausible latency reject cohort',()=>{
 const x=r(0);
 for(const bad of [{...x,verifiedProfit:100},{...x,realOrder:true},
  {...x,recordedAt:new Date(now+60000).toISOString()},
  {...x,recordedAt:new Date(start+granularity*1000*15).toISOString()}]){
  assert.equal(auditLocalProspectiveCohort([bad],{granularity,now}).valid,false);
 }
});
test('B91 gaps are visible; delayed manual captures are not misreported as provider gaps',()=>{
 const x=auditLocalProspectiveCohort([r(0),r(3),r(4)],{granularity,now});
 assert.equal(x.valid,true);assert.equal(x.missingBuckets,2);
 assert(x.warnings.some(w=>w.includes('não observados')));
 assert.equal(x.paperReviewReady,false);
});
test('B91 empty and excess cohort fail closed',()=>{
 assert.equal(auditLocalProspectiveCohort([], {granularity,now}).valid,false);
 assert.equal(auditLocalProspectiveCohort(Array.from({length:121},(_,i)=>r(i)),{granularity,now}).valid,false);
});
