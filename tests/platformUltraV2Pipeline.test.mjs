import test from 'node:test';import assert from 'node:assert/strict';
import {createUltraV2ResearchPipeline} from '../lib/platform/research/ultrafast-v2-pipeline.mjs';
const now=1_800_000_000_000;
const market={symbol:'BTC-USD',venue:'kraken',timestampMs:now-100,bid:100,ask:100.02,
 last:100.3,referencePrice:100,shortVolatilityBps:55,bidDepthUsd:2000000,
 askDepthUsd:2000000,tradesPerMinute:160,aggressiveBuyUsd:200000,
 aggressiveSellUsd:100000,roundTripCostBps:3,expectedSlippageBps:1,
 fillProbability:.9,stabilityRatio:.95,marketOpen:true,symbolOnline:true,maintenance:false};
const baseLegacy={scoreUltrafastAsset:()=>({eligible:true}),scoreR53Asset:()=>({eligible:true}),
 adaptiveBreakevenGate:()=>({allow:true}),availabilityGate:()=>({allow:true}),
 sessionKillSwitch:()=>({halt:false})};
const cfg={market,nowMs:now,
 feedSamples:[{timestampMs:now-150,sequence:1,bid:100,ask:100.02},
 {timestampMs:now-80,sequence:2,bid:100.01,ask:100.03}],
 riskBudget:{accountEquityUsd:10000,orderNotionalUsd:200,stopLossBps:15,
 existingExposureUsd:300,correlatedExposureUsd:300,
 realizedSessionLossUsd:0,realizedDailyLossUsd:0,maxTradeLossPct:.25,
 maxSessionLossPct:2,maxDailyLossPct:3,maxTotalExposurePct:50,
 maxCorrelatedExposurePct:40,userStopped:false},
 executionEconomics:{spreadBps:2,makerFeeBps:0,takerFeeBps:2,slippageBps:1,
 adverseSelectionBps:1,makerFillProbability:.9,expectedGrossEdgeBps:20,
 latencyMs:90,queueAheadUsd:1000,availableDepthUsd:2000000,orderNotionalUsd:200},
 estimatedTradeEconomics:{totalCostBps:4,fillProbability:.9,estimatedWinRate:.68,grossWinBps:35,grossLossBps:15},
 safety:{sessionRealizedR:0,sessionDrawdownPct:0,consecutiveLosses:0,
 quoteAgeMs:100,rejectionsLastMinute:0,marketOpen:true,userStopped:false},
 exchangeReadiness:{venue:'kraken',publicMarketDataAvailable:true,authenticatedPaperVerified:false,
 realAccountApproved:false,reconciliationCertified:false,killSwitchCertified:false,
 stopProtectionCertified:false,regulatoryReviewComplete:false}};
test('composite pipeline reuses five historical guards and yields a research-only candidate',()=>{
 const run=createUltraV2ResearchPipeline(baseLegacy);
 const x=run(cfg);
 assert.equal(x.eligibleForFurtherResearch,true);
 assert.equal(x.liveExecutionEnabled,false);assert.equal(x.ordersSent,0);
 assert.deepEqual(Object.values(x.preservedHistoricalGates),[true,true,true,true,true]);
});
test('historical breakeven denial is never overridden by new scoring',()=>{
 const run=createUltraV2ResearchPipeline({...baseLegacy,adaptiveBreakevenGate:()=>({allow:false})});
 const x=run(cfg);assert.equal(x.eligibleForFurtherResearch,false);
 assert.ok(x.blockers.includes('R28_DYNAMIC_BREAKEVEN'));
});
test('historical kill switch and fresh-feed checks remain fail-closed',()=>{
 const run=createUltraV2ResearchPipeline({...baseLegacy,sessionKillSwitch:()=>({halt:true})});
 assert.ok(run(cfg).blockers.includes('R18_KILL_SWITCH'));
 const bad= createUltraV2ResearchPipeline(baseLegacy)({...cfg,feedSamples:[
 {timestampMs:now-5000,sequence:1,bid:100,ask:100.02},
 {timestampMs:now-4000,sequence:2,bid:100,ask:100.02}]});
 assert.equal(bad.eligibleForFurtherResearch,false);
});