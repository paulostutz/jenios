import test from 'node:test';import assert from 'node:assert/strict';
import {replayUltraShadowSession,summarizeUltraShadowPerformance,
 assessUltraAdaptiveCandidate,buildUltraResearchDashboard,
 describeUltraExchangeIntegration,ULTRA_V2_SHADOW_SPEC}
 from '../lib/platform/research/ultrafast-v2-shadow.mjs';
const data=[
 {timestampMs:1000,bid:100,ask:100.1,signal:'buy'},
 {timestampMs:2000,bid:100.0,ask:100.1,signal:'wait'},
 {timestampMs:3000,bid:101.2,ask:101.3,signal:'wait'},
 {timestampMs:4000,bid:101.1,ask:101.2,signal:'buy'},
 {timestampMs:5000,bid:100.9,ask:101,signal:'wait'},
 {timestampMs:6000,bid:99.9,ask:100,signal:'wait'},
 {timestampMs:7000,bid:101,ask:101.1,signal:'wait'}];
test('uses next observable quote to enter; accounts for spreads fees and slippage',()=>{
 const x=replayUltraShadowSession(data,{startingCashUsd:10000,tradeNotionalUsd:500,
  stopLossBps:25,takeProfitBps:35,feePerSideBps:2,slippagePerSideBps:1});
 assert.equal(x.trades[0].entryTimestampMs,2000);assert.equal(x.trades[0].exitTimestampMs,3000);
 assert.ok(x.totalHypotheticalFeesUsd>0);assert.ok(x.totalHypotheticalSlippageUsd>0);
 assert.equal(x.financialPerformanceCertified,false);assert.equal(x.ordersSent,0);
 const m=summarizeUltraShadowPerformance(x);assert.equal(m.hypotheticalTradeCount,2);
 assert.equal(m.actualBrokerPnl,null);
});
test('rejects non-monotonic ticks and bad prices; blocks spot naked shorts',()=>{
 assert.throws(()=>replayUltraShadowSession([data[0],data[0]]),/ULTRA_V2_SHADOW_INVALID_TICK/);
 const x=replayUltraShadowSession([{timestampMs:1,bid:10,ask:10.1,signal:'sell'},
  {timestampMs:2,bid:9,ask:9.1,signal:'wait'}]);
 assert.equal(x.entryCount,0);assert.equal(x.blockedSignals,1);
});
test('risk stops and no-trade periods are distinguished from alleged real profits',()=>{
 const x=replayUltraShadowSession(data,{maxSessionLossPct:.01,tradeNotionalUsd:5000});
 assert.equal(x.stoppedByRisk,true);assert.equal(x.liveExecutionEnabled,false);
 const flat=replayUltraShadowSession([{timestampMs:1,bid:10,ask:11,signal:'wait'},
 {timestampMs:2,bid:10,ask:11,signal:'wait'}]);
 assert.equal(summarizeUltraShadowPerformance(flat).hypotheticalWinRate,null);
});
test('adaptive candidate is supervised and requires independent prospective holdout',()=>{
 const base={observations:500,netReturnPct:1,maxDrawdownPct:2,costBps:3,dataOrigin:'PROSPECTIVE_SHADOW'};
 const cand={...base,netReturnPct:2,maxDrawdownPct:1.8,costBps:3.2};
 assert.equal(assessUltraAdaptiveCandidate({baseline:base,candidate:cand}).recommendForHumanReview,false);
 const x=assessUltraAdaptiveCandidate({baseline:base,candidate:cand,holdoutMonths:2,operatorApproved:true});
 assert.equal(x.recommendForHumanReview,true);assert.equal(x.automaticDeployment,false);
});
test('dashboard clearly labels hypothetical metrics; exchange contract is read-only',()=>{
 const shadow=replayUltraShadowSession(data);
 const dash=buildUltraResearchDashboard({shadow,checkedAtMs:10000,
 ranking:[{symbol:'BTC-USD',venue:'kraken',eligible:true,score:80,reasons:[]}],
 feed:{allow:true},risk:{allow:true},exchange:{brokerReadyOnEvidence:false}});
 assert.equal(dash.topOpportunities.length,1);assert.equal(dash.actualBrokerPnl,null);
 assert.match(dash.activityLabel,/NOT_REAL/);
 const c=describeUltraExchangeIntegration('kraken',{publicOrderBook:true,publicTrades:false,publicTicker:true});
 assert.deepEqual(c.missingFeeds,['publicTrades']);assert.equal(c.liveExecutionEnabled,false);
 assert.equal(ULTRA_V2_SHADOW_SPEC.externalPaperEnabled,false);
});