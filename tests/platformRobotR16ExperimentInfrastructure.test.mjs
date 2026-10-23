import test from 'node:test';
import assert from 'node:assert/strict';
import {R15_COHORT,validateR15WindowPrecommit} from '../lib/platform/research/robot-r15-multiwindow-protocol.mjs';

const E='9341d9243cbe742b90bf40149663e632fc472f5586c74bf70bdfcfd114e65aea';
const S='cbb92005459f79bf6e23a0edc7c5542cc62b632b6c301e3f23b98ebd514ce5be';
function record(w,leadMs){
 const t=w.openMs-leadMs;
 return {schema:'JENIOS_R15_WINDOW_PRECOMMIT_V1',studyId:R15_COHORT.studyId,
  windowId:w.id,asset:'BTC-USD',capturedAtMs:t-2000,decidedAtMs:t-1000,registeredAtMs:t,
  inputSha256:'a'.repeat(64),engineSha256:E,serviceSha256:S,
  modeResults:['manual','hybrid','reverse'].flatMap(mode=>['buy','sell'].map(intent=>
   ({mode,intent,decisionClass:'ABSTAIN',side:null}))),ordersSent:0,paperOrdersSent:0};
}

test('R16 experiment infra rehearses lead-time boundaries for all six prospective windows',()=>{
 let valid=0,rejected=0;
 for(const w of R15_COHORT.windows)
 for(const leadMs of [1,599999,600000,600001,900000,1200000]){
  const r=record(w,leadMs);
  if(leadMs>=600000){
   const a=validateR15WindowPrecommit(r,{reviewedAtMs:r.registeredAtMs});
   assert.equal(a.registeredBeforeWindow,true);valid++;
  }else{
   assert.throws(()=>validateR15WindowPrecommit(r,{reviewedAtMs:r.registeredAtMs}),
    /R15_LATE_OR_INCONSISTENT_PRECOMMIT/);rejected++;
  }
 }
 assert.equal(valid,24);assert.equal(rejected,12);
});

test('R16 infra rejects post-hoc mutation across every window and decision pair',()=>{
 let n=0;
 for(const w of R15_COHORT.windows){
  const r=record(w,900000);
  for(let i=0;i<r.modeResults.length;i++){
   const altered=structuredClone(r);
   altered.modeResults[i]={...altered.modeResults[i],decisionClass:'PREVIEW',side:null};
   assert.throws(()=>validateR15WindowPrecommit(altered,{reviewedAtMs:r.registeredAtMs}),
    /R15_INVALID_DECISION/);n++;
  }
 }
 assert.equal(n,36);
});

test('R16 infrastructure never reclassifies an invalid/late window as valid',()=>{
 const w=R15_COHORT.windows[1];
 const late=record(w,599999);
 for(const reviewDelta of [0,1000,600000,3600000])
  assert.throws(()=>validateR15WindowPrecommit(late,{reviewedAtMs:late.registeredAtMs+reviewDelta}),
   /R15_LATE_OR_INCONSISTENT_PRECOMMIT/);
});
