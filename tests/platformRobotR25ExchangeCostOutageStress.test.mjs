import test from 'node:test';import assert from 'node:assert/strict';
import {normalizeCostProfile,evaluateTradeEconomics,exchangeHealthGate,stressAssetSession,runR25Matrix}
 from '../lib/platform/research/robot-r25-exchange-cost-outage-stress.mjs';

const low={name:'LOW',makerBps:.5,takerBps:2,slippageBps:1,spreadBps:1,fundingBpsPerSession:0};
const high={name:'HIGH',makerBps:3,takerBps:9,slippageBps:5,spreadBps:8,fundingBpsPerSession:1};

test('R25 normalizes configurable cost profiles without claiming provider fees',()=>{
 assert.equal(normalizeCostProfile(low).name,'LOW');
 assert.throws(()=>normalizeCostProfile({...low,makerBps:-1}),/R25_INVALID_COST_PROFILE/);
});

test('R25 economics blocks edges that do not clear configured friction',()=>{
 const good=evaluateTradeEconomics({style:'maker',grossEdgeBps:20,fillProbability:.9,profile:low});
 const bad=evaluateTradeEconomics({style:'taker',grossEdgeBps:4,fillProbability:1,profile:high});
 assert.equal(good.viable,true);assert.equal(bad.viable,false);
 assert.equal(good.actualBrokerPnl,null);
});

test('R25 exchange health fails closed on degraded, stale or rejection states',()=>{
 assert.equal(exchangeHealthGate({exchangeStatus:'online',symbolStatus:'online',marketDataAgeMs:100,orderAckLatencyMs:100,rejectionsLastMinute:0}).allow,true);
 for(const patch of [
  {exchangeStatus:'maintenance'},{exchangeStatus:'offline'},{marketDataAgeMs:1001},
  {orderAckLatencyMs:2001},{rejectionsLastMinute:5},{symbolStatus:'offline'}
 ]){
  const x=exchangeHealthGate({exchangeStatus:'online',symbolStatus:'online',marketDataAgeMs:100,orderAckLatencyMs:100,rejectionsLastMinute:0,...patch});
  assert.equal(x.allow,false);
 }
});

test('R25 per-asset stress handles outage and maintenance without external execution',()=>{
 const x=stressAssetSession({symbol:'BTC-USD',attempts:10000,grossEdgeBps:20,winRate:.56,fillProbability:.8,
  style:'maker',profile:low,maxDrawdownR:100,maxLossStreak:100,outageEvery:1000,maintenanceAt:5000});
 assert.equal(x.haltReason,'MAINTENANCE');assert.ok(x.blockedAttempts>0);
 assert.equal(x.ordersSent,0);assert.equal(x.paperOrdersSent,0);assert.equal(x.actualBrokerPnl,null);
});

test('R25 matrix spans assets, styles, cost profiles, edges, fills and win rates',()=>{
 const x=runR25Matrix();
 assert.equal(x.total,3*3*2*5*4*4);
 assert.ok(x.viable>0);assert.ok(x.nonViable>0);
 assert.equal(x.ordersSent,0);assert.equal(x.paperOrdersSent,0);assert.equal(x.actualBrokerPnl,null);
});
