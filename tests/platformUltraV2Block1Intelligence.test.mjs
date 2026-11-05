import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeUltraSnapshot, classifyUltraRegime, analyzeUltraOrderFlow,
  flagUltraManipulationRisk, assessUltraCrossAssetContext, scanUltraOpportunities,
  designUltraScalp, ULTRA_V2_INTELLIGENCE} from '../lib/platform/research/ultrafast-v2-intelligence.mjs';
const now = 1_800_000_000_000;
const base = Object.freeze({symbol:'BTC-USD',venue:'kraken',timestampMs:now-100,bid:100,ask:100.02,
  last:100.3,referencePrice:100,shortVolatilityBps:55,bidDepthUsd:2_000_000,
  askDepthUsd:2_000_000,tradesPerMinute:160,aggressiveBuyUsd:200_000,
  aggressiveSellUsd:100_000,roundTripCostBps:3,expectedSlippageBps:1,
  fillProbability:.9,stabilityRatio:.95,marketOpen:true,symbolOnline:true,maintenance:false});
const normalized=() => normalizeUltraSnapshot(base,now);
test('normalizes cost, spread, quote age; rejects invalid inverted books/future quotes',()=>{
 const x=normalized(); assert.equal(x.quoteAgeMs,100);assert.ok(x.spreadBps>0);
 assert.equal(x.estimatedTotalFrictionBps,4);
 assert.throws(()=>normalizeUltraSnapshot({...base,bid:101},now),/ULTRA_V2_INVALID_SNAPSHOT/);
 assert.throws(()=>normalizeUltraSnapshot({...base,timestampMs:now+10},now),/ULTRA_V2_INVALID_SNAPSHOT/);
});
test('classifies range, directional regimes and breakout without claiming forecast',()=>{
 assert.equal(classifyUltraRegime([100,100.1,100.03,100.08,100.02,100.05]).regime,'RANGE');
 assert.equal(classifyUltraRegime([100,100.2,100.3,100.1,100.4,101.2]).regime,'BREAKOUT');
 assert.equal(classifyUltraRegime([100,95,105,91,110,100]).regime,'HIGH_VOLATILITY');
});
test('orderflow measures book and tape, no assertion that suspicious moves prove manipulation',()=>{
 const flow=analyzeUltraOrderFlow(normalized());assert.equal(flow.direction,'BUY_PRESSURE');
 assert.equal(flow.evidenceSufficient,true);
 const flagged=flagUltraManipulationRisk({...normalized(),depthUsd:1000,spreadBps:20});
 assert.equal(flagged.flagged,true);assert.match(flagged.evidenceType,/NOT_PROOF/);
});
test('cross-asset comparison requires aligned return windows and identifies concentration risk',()=>{
 const r=assessUltraCrossAssetContext({returnsBps:[1,3,-1,2,5,-2]},{returnsBps:[2,6,-2,4,10,-4]});
 assert.equal(r.correlation,1);assert.equal(r.correlationRisk,true);
 assert.throws(()=>assessUltraCrossAssetContext({returnsBps:[1,2]},{returnsBps:[1]}));
});
test('scanner filters stale, risky and high-friction assets, ranks market candidates',()=>{
 const all=scanUltraOpportunities([base,{...base,symbol:'DOGE-USD',timestampMs:now-1500,
  bidDepthUsd:1200,askDepthUsd:1100,roundTripCostBps:90}],{nowMs:now});
 assert.equal(all[0].symbol,'BTC-USD');assert.equal(all[0].eligible,true);
 assert.equal(all[1].eligible,false);assert.ok(all[1].reasons.includes('STALE_QUOTE'));
 const plan=designUltraScalp(all[0],{stopLossBps:15,expectedWinRate:.68,fillProbability:.9});
 assert.equal(plan.classification,'RESEARCH_CANDIDATE');
 const weak=designUltraScalp(all[0],{stopLossBps:35,expectedWinRate:.2,fillProbability:.5});
 assert.equal(weak.classification,'WAIT');
});
test('spot research avoids blind sell, and no live-order execution surface is exposed',()=>{
 const sell=scanUltraOpportunities([{...base,aggressiveBuyUsd:10000,aggressiveSellUsd:400000,
  bidDepthUsd:500000,askDepthUsd:3000000}],{nowMs:now})[0];
 const plan=designUltraScalp(sell,{stopLossBps:15,expectedWinRate:.7,fillProbability:.9});
 assert.equal(plan.classification,'WAIT');assert.ok(plan.reasons.includes('SPOT_SELL_REQUIRES_INVENTORY'));
 assert.equal(ULTRA_V2_INTELLIGENCE.liveExecutionEnabled,false);
});