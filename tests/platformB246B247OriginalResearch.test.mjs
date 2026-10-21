import test from 'node:test';import assert from 'node:assert/strict';
import {inspectCoreResearchAcceptance} from '../lib/platform/release250/b246-original-research-review.mjs';
import {inspectOriginalProspectiveCandidate} from '../lib/platform/release250/b247-prospective-review.mjs';
const core='9341d9243cbe742b90bf40149663e632fc472f5586c74bf70bdfcfd114e65aea';
const modes=['direct','reverse','hybrid'],assets=['BTCUSDT','ETHUSDT','SOLUSDT'],costs=[0,10,30];
const rows=modes.flatMap(mode=>assets.flatMap(asset=>costs.map(costBps=>({mode,asset,costBps,trades:40,netR:1,drawdownR:3,sample:'holdout'}))));
const raw={originalCoreSha256:core,frozenHoldout:true,rows};
test('B246 even hypothetical all-positive historical rows cannot certify independent profitability',()=>{
 const a=inspectCoreResearchAcceptance(raw);
 assert.equal(a.assessment,'RESEARCH_ONLY_NO_GO');assert.equal(a.robotProfitabilityCertified,false);
 assert.equal(a.baselineOpportunities,1656);assert.equal(a.ordersSent,0);
});
test('B246 one negative asset-mode-cost bucket is research only',()=>{
 const data={...raw,rows:rows.map((x,i)=>i===0?{...x,netR:-2}:x)};
 const a=inspectCoreResearchAcceptance(data);
 assert.equal(a.assessment,'RESEARCH_ONLY_NEGATIVE_OR_MIXED');assert.equal(a.reportedNegativeCells,1);
});
test('B246 forged engine SHA is rejected',()=>{
 const a=inspectCoreResearchAcceptance({...raw,originalCoreSha256:'a'.repeat(64)});
 assert.equal(a.assessment,'RESEARCH_ONLY_NO_GO');assert.equal(a.robotProfitabilityCertified,false);
});
const now=1792540000000;const inputs=[
 {eventId:'e1',mode:'direct',asset:'BTCUSDT',signalAtMs:now-30000,closeAtMs:now-29000,recordedAtMs:now-28000,realOrder:false,predictedProfit:null},
 {eventId:'e2',mode:'reverse',asset:'ETHUSDT',signalAtMs:now-20000,closeAtMs:now-19000,recordedAtMs:now-18000,realOrder:false,predictedProfit:null},
 {eventId:'e3',mode:'hybrid',asset:'SOLUSDT',signalAtMs:now-10000,closeAtMs:now-9000,recordedAtMs:now-8000,realOrder:false,predictedProfit:null}
];
test('B247 valid local prospective timing does not impersonate independent provider witness',()=>{
 const a=inspectOriginalProspectiveCandidate(inputs,{nowMs:now});
 assert.equal(a.threeModesRepresented,true);assert.equal(a.independentClockWitnessed,false);assert.equal(a.originalCoreSignalsVerified,false);
 assert.equal(a.performanceReadyForPromotion,false);
});
test('B247 duplicate, lookahead and future records never become accepted outcomes',()=>{
 assert.throws(()=>inspectOriginalProspectiveCandidate([inputs[0],inputs[0],inputs[2]],{nowMs:now}));
 assert.throws(()=>inspectOriginalProspectiveCandidate(inputs.map((x,i)=>i===2?{...x,recordedAtMs:now+1}:x),{nowMs:now}));
 assert.throws(()=>inspectOriginalProspectiveCandidate(inputs.map((x,i)=>i===1?{...x,closeAtMs:x.signalAtMs-1}:x),{nowMs:now}));
});
