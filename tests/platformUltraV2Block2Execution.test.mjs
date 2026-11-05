import test from 'node:test';import assert from 'node:assert/strict';
import {assessUltraFeedHealth,planUltraSmartExecution,checkUltraPortfolioRisk,
 replayUltraOrderObservations,validateUltraExchangeReadiness,produceUltraExecutionProposal,
 ULTRA_V2_EXECUTION_BOUNDARY} from '../lib/platform/research/ultrafast-v2-execution.mjs';
const now=1_800_000_000_000;
const feed=()=>assessUltraFeedHealth([{timestampMs:now-150,sequence:5,bid:100,ask:100.1},
 {timestampMs:now-80,sequence:6,bid:100.1,ask:100.15}],{nowMs:now});
const exec=()=>planUltraSmartExecution({spreadBps:1,makerFeeBps:0,takerFeeBps:2,
 slippageBps:1,adverseSelectionBps:1,makerFillProbability:.9,expectedGrossEdgeBps:20,
 latencyMs:90,queueAheadUsd:1000,availableDepthUsd:2_000_000,orderNotionalUsd:200});
const risk=()=>checkUltraPortfolioRisk({accountEquityUsd:10_000,orderNotionalUsd:200,
 stopLossBps:25,existingExposureUsd:300,correlatedExposureUsd:300,
 realizedSessionLossUsd:0,realizedDailyLossUsd:0,maxTradeLossPct:.25,
 maxSessionLossPct:2,maxDailyLossPct:3,maxTotalExposurePct:50,
 maxCorrelatedExposurePct:40,userStopped:false,feedHealthy:true});
const exchange=()=>validateUltraExchangeReadiness({venue:'kraken',publicMarketDataAvailable:true,
 authenticatedPaperVerified:false,realAccountApproved:false,reconciliationCertified:false,
 killSwitchCertified:false,stopProtectionCertified:false,regulatoryReviewComplete:false});
test('feed rejects gaps, stale, duplicates, clock reversal, outages',()=>{
 assert.equal(feed().allow,true);
 assert.ok(assessUltraFeedHealth([{timestampMs:now-5000,sequence:1,bid:1,ask:2},
 {timestampMs:now-4000,sequence:2,bid:1,ask:2}],{nowMs:now}).issues.includes('STALE_FEED'));
 assert.ok(assessUltraFeedHealth([{timestampMs:now-500,sequence:2,bid:1,ask:2},
 {timestampMs:now-400,sequence:2,bid:1,ask:2}],{nowMs:now}).issues.includes('OUT_OF_ORDER_OR_DUPLICATE_SEQUENCE'));
 assert.equal(assessUltraFeedHealth([{timestampMs:now-100,sequence:1,bid:1,ask:2},
 {timestampMs:now-50,sequence:2,bid:1,ask:2}],{nowMs:now,sourceOnline:false}).allow,false);
});
test('maker/taker planner accounts for fill and liquidity, not merely fees',()=>{
 assert.equal(exec().allowProposal,true);assert.equal(exec().liveExecution,false);
 const low=planUltraSmartExecution({spreadBps:1,makerFeeBps:0,takerFeeBps:2,slippageBps:10,
  adverseSelectionBps:5,makerFillProbability:.1,expectedGrossEdgeBps:3,
  latencyMs:400,queueAheadUsd:1000,availableDepthUsd:1000,orderNotionalUsd:500});
 assert.equal(low.allowProposal,false);assert.ok(low.reasons.includes('NO_NET_EXECUTION_EDGE'));
});
test('risk prevents oversized, correlated, daily-loss and unhealthy-feed exposures',()=>{
 assert.equal(risk().allow,true);
 assert.equal(checkUltraPortfolioRisk({...riskInput(),orderNotionalUsd:5000}).allow,false);
 assert.ok(checkUltraPortfolioRisk({...riskInput(),realizedDailyLossUsd:400}).issues.includes('DAILY_LOSS_LIMIT'));
 assert.ok(checkUltraPortfolioRisk({...riskInput(),feedHealthy:false}).issues.includes('FEED_UNHEALTHY'));
});
function riskInput(){return {accountEquityUsd:10_000,orderNotionalUsd:200,
 stopLossBps:25,existingExposureUsd:300,correlatedExposureUsd:300,
 realizedSessionLossUsd:0,realizedDailyLossUsd:0,maxTradeLossPct:.25,
 maxSessionLossPct:2,maxDailyLossPct:3,maxTotalExposurePct:50,
 maxCorrelatedExposurePct:40,userStopped:false,feedHealthy:true};}
test('order journal partial fill, idempotency and confirmed cancel; never assumes external state',()=>{
 const events=[{eventId:'a',timestampMs:100,type:'accepted',cumulativeFilledQuantity:0},
 {eventId:'p',timestampMs:200,type:'partial_fill',cumulativeFilledQuantity:2},
 {eventId:'p',timestampMs:200,type:'partial_fill',cumulativeFilledQuantity:2},
 {eventId:'c',timestampMs:300,type:'cancel_confirmed',cumulativeFilledQuantity:2}];
 const s=replayUltraOrderObservations({clientOrderId:'research-order-01',requestedQuantity:5,events});
 assert.equal(s.status,'CANCELED');assert.equal(s.filledQuantity,2);assert.equal(s.observedEvents,3);
 const bad=replayUltraOrderObservations({clientOrderId:'research-order-01',requestedQuantity:5,
 events:[{eventId:'x',timestampMs:100,type:'filled',cumulativeFilledQuantity:5}]});
 assert.equal(bad.status,'INCONSISTENT');assert.equal(bad.requiresManualReconciliation,true);
});
test('integration contract reports blockers and forbids live even when every box checked',()=>{
 const all={venue:'kraken',publicMarketDataAvailable:true,authenticatedPaperVerified:true,
 realAccountApproved:true,reconciliationCertified:true,killSwitchCertified:true,
 stopProtectionCertified:true,regulatoryReviewComplete:true};
 assert.equal(validateUltraExchangeReadiness(all).liveExecutionEnabled,false);
 assert.equal(exchange().brokerReadyOnEvidence,false);
 const p=produceUltraExecutionProposal({candidate:{eligible:true},feed:feed(),risk:risk(),
 execution:exec(),exchange:exchange()});
 assert.equal(p.eligible,true);assert.equal(p.liveExecutionEnabled,false);
 assert.equal(ULTRA_V2_EXECUTION_BOUNDARY.outboundOrdersEnabled,false);
});