import test from 'node:test';
import assert from 'node:assert/strict';
import {markUltraSpotPortfolio,assessUltraStressBudget,suggestUltraCapitalWeights}
  from '../lib/platform/research/ultrafast-v3-risk.mjs';
import {simulateUltraDepthSweep,simulateUltraMakerQueue,assessUltraExecutionSlippage}
  from '../lib/platform/research/ultrafast-v3-microstructure.mjs';
const now=1800000000000;
const mark=markUltraSpotPortfolio({positions:[
  {symbol:'BTCUSD',quantity:1,entryPrice:100,bid:97,stopPrice:95,quoteAtMs:now-100}],nowMs:now,
  exitFeeBps:5,gapStressBps:200});
const budget={baseEquityUsd:10000,mark,realizedSessionLossUsd:0,realizedDailyLossUsd:0,
 pendingOrderWorstLossUsd:0,pendingNotionalUsd:0,proposedNotionalUsd:100,
 proposedStopBps:20,gapBps:20,slippageBps:10,exitFeeBps:5,
 correlatedExposureUsd:100,maxTradeLossPct:.25,maxSessionLossPct:2,maxDailyLossPct:3,
 maxGrossExposurePct:50,maxCorrelatedExposurePct:40,exchangeHealthy:true,ownerStopped:false};
test('mark to market records underwater positions, open gap risk and stale bid',()=>{
 assert.equal(mark.allow,true);assert.ok(mark.unrealizedPnlUsd<0);
 assert.ok(mark.additionalGapStopRiskUsd>0);
 const bad=markUltraSpotPortfolio({positions:[{symbol:'BTCUSD',quantity:1,entryPrice:100,bid:97,stopPrice:95,quoteAtMs:now-5000}],nowMs:now});
 assert.ok(bad.issues.includes('STALE_MARK_BTCUSD'));
});
test('stress risk includes unrealized loss, pending orders, gap, fees and emergency state',()=>{
 const ok=assessUltraStressBudget(budget);assert.equal(ok.allowFurtherResearch,true);
 assert.ok(ok.openUnrealizedLossUsd>0);assert.ok(ok.openGapRiskUsd>0);
 const bad=assessUltraStressBudget({...budget,realizedDailyLossUsd:310});
 assert.ok(bad.issues.includes('DAILY_STRESS_EXCEEDED'));
 assert.ok(assessUltraStressBudget({...budget,proposedNotionalUsd:9000}).issues.includes('GROSS_EXPOSURE_EXCEEDED'));
 assert.ok(assessUltraStressBudget({...budget,ownerStopped:true}).issues.includes('OWNER_STOPPED'));
 assert.ok(assessUltraStressBudget({...budget,exchangeHealthy:false}).issues.includes('EXCHANGE_UNHEALTHY'));
});
test('allocator caps per asset and correlation cluster; never invests cash',()=>{
 const w=suggestUltraCapitalWeights([{symbol:'BTC',riskCluster:'BTC',score:5,eligible:true},
 {symbol:'ETH',riskCluster:'BTC',score:5,eligible:true},
 {symbol:'SOL',riskCluster:'ALT',score:4,eligible:true}],
 {maximumPerAssetPct:20,totalAllocationPct:60,clusterMaximumPct:30});
 const sum=w.weights.reduce((s,x)=>s+x.recommendedResearchWeightPct,0);
 assert.ok(sum<=60);assert.ok(w.weights[0].recommendedResearchWeightPct<=20);
 assert.ok(w.weights.filter(x=>x.riskCluster==='BTC').reduce((s,x)=>s+x.recommendedResearchWeightPct,0)<=30);
 assert.equal(w.noPositionChanges,true);
});
test('taker sweep walks price levels and refuses to invent unlisted liquidity',()=>{
 const a=simulateUltraDepthSweep({side:'BUY',quantity:3,referencePrice:100,levels:
 [{price:100.1,qty:1},{price:100.2,qty:1},{price:100.4,qty:1}],maxAdverseSlippageBps:30});
 assert.equal(a.simulatedFilledQuantity,2);assert.equal(a.unfilledQuantity,1);
 assert.equal(a.partialFillOnly,true);assert.equal(a.fillIsHypothetical,true);
 const b=simulateUltraDepthSweep({side:'SELL',quantity:1,referencePrice:100,levels:[{price:99.9,qty:1}]});
 assert.equal(b.simulatedFilledQuantity,1);
});
test('maker queue never fills before order activation, never skips ahead in queue',()=>{
 const data=[{timestampMs:200,aggressorSide:'SELL',price:100,quantity:10},
 {timestampMs:400,aggressorSide:'SELL',price:100,quantity:3},
 {timestampMs:500,aggressorSide:'SELL',price:100,quantity:4}];
 const q=simulateUltraMakerQueue({side:'BUY',limitPrice:100,quantity:3,queueAheadQty:5,
 submittedAtMs:100,latencyMs:150,expiresAtMs:1000,events:data,makerFeeBps:1});
 assert.equal(q.filledHypotheticalQty,2);assert.equal(q.queueAheadRemainingQty,0);
 const no=simulateUltraMakerQueue({side:'BUY',limitPrice:100,quantity:2,queueAheadQty:99,
 submittedAtMs:100,latencyMs:150,expiresAtMs:1000,events:data});
 assert.equal(no.filledHypotheticalQty,0);assert.equal(no.notBrokerFillEvidence,true);
});
test('execution quality distinguishes simulated and read-only broker evidence',()=>{
 const q=assessUltraExecutionSlippage({expectedPrice:100,observedPrice:101,side:'BUY',
  expectedFeeUsd:1,observedFeeUsd:2,quantity:1,source:'SIMULATED'});
 assert.ok(q.priceSlippageBps>0);assert.equal(q.providerConfirmationRequired,true);
 assert.throws(()=>assessUltraExecutionSlippage({expectedPrice:100,observedPrice:101,side:'BUY',
  expectedFeeUsd:1,observedFeeUsd:2,quantity:1,source:'LIVE_ORDER'}),/R112_QUALITY_INVALID/);
});