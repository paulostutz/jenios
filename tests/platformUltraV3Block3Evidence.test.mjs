import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateUltraCandidateHoldout} from '../lib/platform/research/ultrafast-v3-validation.mjs';
import {buildUltraDecisionChain,inspectUltraWatchdog,transitionUltraResearchRecovery}
 from '../lib/platform/research/ultrafast-v3-operations.mjs';
import {evaluateUltraV3ResearchReadiness} from '../lib/platform/research/ultrafast-v3-gate.mjs';
const base=1800000000000;
const fold={trainEndMs:base-120000,testStartMs:base,testEndMs:base+400000};
const tr=(net,signal)=>({signalAtMs:signal,entryAtMs:signal+100,exitAtMs:signal+200,
 netPnlBps:net,costBps:2});
const baseline=Array.from({length:100},(_,i)=>tr(i%4===0?-1:1,base+1000+i*1000));
const trials=baseline.map(x=>({...x,netPnlBps:x.netPnlBps+5}));
const cfg={folds:[{...fold,baselineTrades:baseline}],
 candidates:[{id:'ultra-v3',folds:[{trades:trials}]}],operatorApproved:false};
test('walkforward resamples paired holdout with nonzero embargo and never promotes',()=>{
 const x=evaluateUltraCandidateHoldout(cfg);
 assert.equal(x.comparisons[0].pairedSamples,100);
 assert.ok(x.comparisons[0].lowerBoundBps>0);
 assert.deepEqual(x.passingCandidateIds,['ultra-v3']);
 assert.equal(x.modelPromoted,false);assert.equal(x.financialPerformanceCertified,false);
});
test('walkforward blocks lookahead, non-paired events and weak candidate',()=>{
 const wrong=[...trials];wrong[10]={...wrong[10],entryAtMs:wrong[10].signalAtMs};
 assert.throws(()=>evaluateUltraCandidateHoldout({...cfg,candidates:[{id:'weak',folds:[{trades:wrong}]}]}),/LOOKAHEAD_OR_ORDER/);
 const bad=baseline.map(x=>({...x,netPnlBps:x.netPnlBps-5}));
 assert.equal(evaluateUltraCandidateHoldout({...cfg,candidates:[{id:'weak',folds:[{trades:bad}]}]})
  .passingCandidateIds.length,0);
 const badFold={...fold,trainEndMs:fold.testStartMs-1000,baselineTrades:baseline};
 assert.throws(()=>evaluateUltraCandidateHoldout({...cfg,folds:[badFold]}),/FOLD_LEAKAGE/);
});
test('audit chain tampering changes cryptographic fingerprint, no PII payload',()=>{
 const input={sourceDigest:'a'.repeat(64),events:[
  {id:'event-1',timestampMs:10,type:'WAIT',reasons:['NO_EDGE'],strategyVersion:'r112'},
  {id:'event-2',timestampMs:20,type:'RISK_REVIEW',reasons:['GAP_RISK'],strategyVersion:'r112'}]};
 const a=buildUltraDecisionChain(input),b=buildUltraDecisionChain(input);
 assert.equal(a.rootDigest,b.rootDigest);assert.equal(a.eventCount,2);
 assert.notEqual(a.rootDigest,buildUltraDecisionChain({...input,events:[input.events[0],
  {...input.events[1],reasons:['WIDE_SPREAD']}]}).rootDigest);
 assert.throws(()=>buildUltraDecisionChain({...input,events:[input.events[0],input.events[0]]}),/INVALID_EVENT/);
});
const now=1800000000000;
const healthy={nowMs:now,lastMarketDataAtMs:now-100,lastBrokerStateAtMs:now-100,
 disconnectCount:0,brokerErrors:0,unknownOrderCount:0,unreconciledFillCount:0,
 exchangeMaintenance:false,ownerStopped:false};
test('watchdog fails closed on missing source/broker order, cannot initiate new orders',()=>{
 const ok=inspectUltraWatchdog(healthy);assert.equal(ok.healthy,true);
 assert.equal(ok.allowNewEntries,false);
 const bad=inspectUltraWatchdog({...healthy,unknownOrderCount:1,lastMarketDataAtMs:now-3000});
 assert.equal(bad.healthy,false);assert.ok(bad.reasons.includes('ORDER_STATUS_UNKNOWN'));
 assert.ok(bad.reasons.includes('MARKET_DATA_STALE'));
});
test('recovery never auto-reenables even if feed recovers; needs human & reconciliation',()=>{
 const h=transitionUltraResearchRecovery({state:'HALTED',event:'SOURCE_RECOVERED',watchdogHealthy:true,
  orderReconciliationVerified:true,ownerApproved:false});
 assert.equal(h.state,'HALTED');
 const c=transitionUltraResearchRecovery({state:'HALTED',event:'BEGIN_REVIEW',watchdogHealthy:true,
  orderReconciliationVerified:false,ownerApproved:false});
 assert.equal(c.state,'CHECKING');
 assert.equal(transitionUltraResearchRecovery({state:'CHECKING',event:'HUMAN_RESET',watchdogHealthy:true,
  orderReconciliationVerified:false,ownerApproved:true}).state,'CHECKING');
 const ready=transitionUltraResearchRecovery({state:'CHECKING',event:'HUMAN_RESET',watchdogHealthy:true,
  orderReconciliationVerified:true,ownerApproved:true});
 assert.equal(ready.state,'RESEARCH_HEALTHY');assert.equal(ready.liveOrderEnabled,false);
});
test('composite R112 gate reuses R111 and always remains read-only',()=>{
 const ok=evaluateUltraV3ResearchReadiness({
  v2Report:{schema:'JENIOS_ULTRA_V2_CERTIFIED_RESEARCH_CYCLE_V1',eligibleForFurtherResearch:true},
  book:{allow:true},exchangeRule:{allowResearchProposal:true},
  tokenSecurity:{eligibleForFurtherResearch:true},stressBudget:{allowFurtherResearch:true},
  watchdog:{healthy:true}});
 assert.equal(ok.canContinueOfflineResearch,true);assert.equal(ok.liveExecutionEnabled,false);
 const denial=evaluateUltraV3ResearchReadiness({v2Report:{schema:'JENIOS_ULTRA_V2_CERTIFIED_RESEARCH_CYCLE_V1',eligibleForFurtherResearch:false},
  book:{allow:false},exchangeRule:{allowResearchProposal:true},
  tokenSecurity:{eligibleForFurtherResearch:true},stressBudget:{allowFurtherResearch:true},
  watchdog:{healthy:true}});
 assert.equal(denial.canContinueOfflineResearch,false);
 assert.ok(denial.blockers.includes('R111_V2_RESEARCH_GATE'));
 assert.ok(denial.blockers.includes('R112_BOOK_INTEGRITY'));
});