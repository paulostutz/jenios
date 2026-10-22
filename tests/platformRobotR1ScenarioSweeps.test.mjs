
import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewR1ManualSignalWindow,reviewR1HybridSafety,
 reviewR1ReverseEligibility,reviewR1PairedLossAttribution}
 from '../lib/platform/research/robot-r1-adversarial-gates.mjs';
const T=20000000;
test('R1-R2 Manual — 72 declared delivery combinations, no real receipt claims',()=>{
 let n=0;
 for(const direction of ['UP','DOWN','ABSTAIN'])
 for(const deliveredAtMs of [null,1400,9000,100000,100001,95000])
 for(const budget of [1000,5000,60000,3600000]){
  const r=reviewR1ManualSignalWindow({signalId:'a',asset:'BTC-USD',
   mode:'manual',direction,emittedAtMs:1000,recordedAtMs:1200,
   declaredReceivedAtMs:deliveredAtMs,targetOpenMs:100000,observedAtMs:150000,
   isOrder:false,executed:false,source:'CALLER_SUPPLIED_SYNTHETIC'},
   {latencyBudgetMs:budget});
  const expected=direction!=='ABSTAIN'&&deliveredAtMs!==null&&
   deliveredAtMs<100000&&deliveredAtMs-1000<=budget;
  assert.equal(r.declaredTimely,expected);
  assert.equal(r.deliveryProviderReceiptIndependentlyVerified,false);
  assert.equal(r.originalSignalProvenanceVerified,false);
  assert.equal(r.ordersSent,0);assert.equal(r.paperOrdersSent,0);n++;
 }
 assert.equal(n,72);
});
test('R1-R2 Híbrido — 1,536 context combinations reject every danger',()=>{
 let total=0,wait=0;
 for(const intervalMs of [60000,300000,900000,3600000])
 for(const atrPct of [0,3,6,6.1])
 for(const spreadBps of [0,10,30,31])
 for(const marketBias of ['UP','DOWN','NEUTRAL'])
 for(const liquidityState of ['unknown','declared_adequate','thin','halted'])
 for(const paused of [false,true])
 for(const stale of [false,true]){
  const x=reviewR1HybridSafety({intervalMs,paused,positionOpen:false,
   liquidityState,context:{mode:'hybrid',asset:'BTC-USD',closedAtMs:T,
    observedAtMs:T+(stale?intervalMs+300001:intervalMs),
    atrPct,spreadBps,maxRiskPct:1,marketBias,providerSigned:false,
    operatorApproved:false}});
  const shouldWait=atrPct>6||spreadBps>30||marketBias==='NEUTRAL'||
   liquidityState!=='declared_adequate'||paused||stale;
  assert.equal(x.classification,shouldWait?'WAIT_AND_REVIEW':
   'DESCRIPTIVE_CONTEXT_UNVERIFIED');
  assert.equal(x.operatorDecides,true);
  assert.equal(x.hybridInvertsOrders,false);
  assert.equal(x.entryPriceSuggestion,null);
  assert.equal(x.ordersSent,0);
  total++;if(shouldWait)wait++;
 }
 assert.equal(total,1536);assert.ok(wait>1200);
});
test('R1-R2 Reverso — 2,304 combinations never authorize execution',()=>{
 let total=0,blocked=0;
 for(const marketType of ['spot','margin','perpetual'])
 for(const side of ['buy','sell'])
 for(const megaTrendDirection of [null,'buy','sell'])
 for(const paused of [false,true])
 for(const positionOpen of [false,true])
 for(const borrowAvailableDeclared of [false,true])
 for(const localConsentDeclared of [false,true])
 for(const fundingBps of [null,10])
 for(const metadataAgeMs of [1000,10001])
 for(const spreadBps of [5,31]){
  const x=reviewR1ReverseEligibility({
   command:{eventId:'stress-a',action:'open',side},marketType,
   megaTrendDirection,paused,positionOpen,borrowAvailableDeclared,
   localConsentDeclared,fundingBps,metadataAgeMs,metadataMaxAgeMs:10000,
   spreadBps,maxSpreadBps:30});
  assert.equal(x.ordersSent,0);assert.equal(x.paperOrdersSent,0);
  assert.equal(x.privateCoreDecisionAttested,false);
  assert.equal(x.orderTransportAuthorized,false);
  assert.equal(x.commercialPerformanceClaimAllowed,false);
  if(x.classification==='BLOCK_NEW_EXPOSURE'){
   assert.equal(x.referenceSide,null);assert.ok(x.reasonCodes.length>0);blocked++;
  }else{
   assert.equal(x.classification,'REFERENCE_FOR_HUMAN_REVIEW_ONLY');
   assert.ok(['buy','sell'].includes(x.referenceSide));
   assert.equal(x.reasonCodes.length,0);
  }
  if(marketType==='spot'&&megaTrendDirection==='sell')
   assert.equal(x.classification,'BLOCK_NEW_EXPOSURE');
  total++;
 }
 assert.equal(total,2304);assert.ok(blocked>2000);
});
test('R1-R2 Lossômetro — 500 paired hypotheses, no invented real savings',()=>{
 const items=Array.from({length:500},(_,i)=>{
  const referenceNetR=[-1.5,-0.6,0,0.8,2][i%5];
  const interventionKind=i%7===0?'ABSTAIN':
   i%3===0?'REVERSE_REFERENCE':'KEEP';
  const interventionNetR=interventionKind==='ABSTAIN'?0:
   [1,-1.7,-0.2,0,0.3][i%5];
  return {id:'pair-'+i,cohortKey:'h-'+i,referenceNetR,
   interventionNetR,interventionKind,source:'SYNTHETIC_PAIRED_UNVERIFIED'};
 });
 const x=reviewR1PairedLossAttribution(items);
 assert.equal(x.paired,500);
 assert.equal(x.actualLossesAvoided,null);
 assert.equal(x.actualBrokerRealizedPnl,null);
 assert.equal(x.customerEconomyObserved,false);
 assert.equal(x.statisticalAdvantageCertified,false);
 assert.equal(x.ordersSent,0);
 const net=items.reduce((s,e)=>s+e.interventionNetR-e.referenceNetR,0);
 assert.equal(x.netDifferenceR,Number(net.toFixed(6)));
 assert.ok(x.hypotheticalLossesFullyAvoided>0);
 assert.ok(x.hypotheticalNewLossesIntroduced>0);
 assert.ok(x.hypotheticalGainsForegone>0);
 assert.throws(()=>reviewR1PairedLossAttribution([...items,items[0]]),
   /ROBOT_R1_INVALID_PAIRED_ROWS/);
 assert.deepEqual(x,reviewR1PairedLossAttribution(items));
});
