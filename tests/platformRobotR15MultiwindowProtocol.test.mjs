import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {R15_COHORT,validateR15WindowPrecommit,validateR15Outcome,aggregateR15Cohort}
 from '../lib/platform/research/robot-r15-multiwindow-protocol.mjs';

const E='9341d9243cbe742b90bf40149663e632fc472f5586c74bf70bdfcfd114e65aea';
const S='cbb92005459f79bf6e23a0edc7c5542cc62b632b6c301e3f23b98ebd514ce5be';
const make=(windowId='R15-W01')=>{
 const w=R15_COHORT.windows.find(x=>x.id===windowId),registeredAtMs=w.openMs-900000;
 return {schema:'JENIOS_R15_WINDOW_PRECOMMIT_V1',studyId:R15_COHORT.studyId,windowId,
  asset:'BTC-USD',capturedAtMs:registeredAtMs-20000,decidedAtMs:registeredAtMs-10000,
  registeredAtMs,inputSha256:'a'.repeat(64),engineSha256:E,serviceSha256:S,
  modeResults:['manual','hybrid','reverse'].flatMap(mode=>['buy','sell'].map(intent=>
   ({mode,intent,decisionClass:'ABSTAIN',side:null}))),ordersSent:0,paperOrdersSent:0};
};
test('R15 cohort has six immutable consecutive hourly windows',()=>{
 assert.equal(R15_COHORT.windows.length,6);
 for(let i=1;i<R15_COHORT.windows.length;i++)
  assert.equal(R15_COHORT.windows[i].openMs,R15_COHORT.windows[i-1].closeMs);
});
test('R15 accepts a complete abstention precommit only before lead gate',()=>{
 const p=make(),a=validateR15WindowPrecommit(p,{reviewedAtMs:p.registeredAtMs});
 assert.equal(a.abstentions,6);assert.equal(a.previews,0);assert.ok(a.leadMs>=600000);
});
test('R15 rejects late, duplicate, forged engine and order-bearing precommits',()=>{
 const p=make(),w=R15_COHORT.windows[0];
 for(const patch of [
  {registeredAtMs:w.openMs-599999,decidedAtMs:w.openMs-599999,capturedAtMs:w.openMs-599999},
  {engineSha256:'0'.repeat(64)},{ordersSent:1}
 ])assert.throws(()=>validateR15WindowPrecommit({...p,...patch},{reviewedAtMs:w.openMs}));
 const dup=structuredClone(p);dup.modeResults[5]={...dup.modeResults[0]};
 assert.throws(()=>validateR15WindowPrecommit(dup,{reviewedAtMs:p.registeredAtMs}));
});
test('R15 preview representation requires an explicit side',()=>{
 const p=make();p.modeResults[0]={...p.modeResults[0],decisionClass:'PREVIEW',side:'buy'};
 const a=validateR15WindowPrecommit(p,{reviewedAtMs:p.registeredAtMs});
 assert.equal(a.previews,1);
 p.modeResults[0].side=null;
 assert.throws(()=>validateR15WindowPrecommit(p,{reviewedAtMs:p.registeredAtMs}));
});
test('R15 outcome is only accepted after close plus ten minutes and never carries PnL',()=>{
 const p=make(),a=validateR15WindowPrecommit(p,{reviewedAtMs:p.registeredAtMs});
 const w=R15_COHORT.windows[0],o={schema:'JENIOS_R15_WINDOW_OUTCOME_V1',
  studyId:R15_COHORT.studyId,windowId:w.id,precommitSha256:a.canonicalSha256,
  observedAtMs:w.closeMs+600000,coinbaseSha256:'b'.repeat(64),krakenSha256:'c'.repeat(64),
  publicPriceConsistencyPassed:true,brokerOrdersSent:0,paperOrdersSent:0,
  actualBrokerPnl:null,actualLossesAvoided:null,commercialPerformanceCertified:false};
 assert.equal(validateR15Outcome(o,{reviewedAtMs:o.observedAtMs}).outcomeAccepted,true);
 assert.throws(()=>validateR15Outcome({...o,observedAtMs:w.closeMs+1},{reviewedAtMs:w.closeMs+1}));
 assert.throws(()=>validateR15Outcome({...o,actualBrokerPnl:1},{reviewedAtMs:o.observedAtMs}));
});
test('R15 aggregate links each outcome to the exact precommit hash',()=>{
 const audits=R15_COHORT.windows.map(w=>{
  const p=make(w.id);return validateR15WindowPrecommit(p,{reviewedAtMs:p.registeredAtMs});
 });
 const outcomes=audits.map((a,i)=>({windowId:a.windowId,precommitSha256:a.canonicalSha256,
  publicPriceConsistencyPassed:i%2===0}));
 const s=aggregateR15Cohort({precommits:audits,outcomes});
 assert.equal(s.preregisteredWindows,6);assert.equal(s.linkedOutcomes,6);
 assert.equal(s.previews,0);assert.equal(s.abstentions,36);assert.equal(s.actualBrokerPnl,null);
 const bad=structuredClone(outcomes);bad[0].precommitSha256='0'.repeat(64);
 assert.throws(()=>aggregateR15Cohort({precommits:audits,outcomes:bad}));
});
test('R15 protocol has no network, broker transport, secrets or proprietary imports',()=>{
 const s=readFileSync(new URL('../lib/platform/research/robot-r15-multiwindow-protocol.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(s,/\bfetch\s*\(|submitOrder|createOrder|OPENAI_API_KEY|process\.env|nucleo-privado|private-core/i);
 const v=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url),'utf8'));
 assert.equal(v.git.deploymentEnabled['research/jenios-robot-r15-multiwindow-prospective-20261022'],false);
});
