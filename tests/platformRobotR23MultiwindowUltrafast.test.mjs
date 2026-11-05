import test from 'node:test';import assert from 'node:assert/strict';
import {aggregateMultiwindowAsset,availabilityGate,compareAssetExecutionStyle,runTurnoverStress,rankMultiwindowAssets}
 from '../lib/platform/research/robot-r23-multiwindow-ultrafast.mjs';

const win=(symbol,score,eligible=true)=>({symbol,provider:'kraken',score,spreadBps:1,shortVolatilityBps:20,
 depthUsd:1e6,tradesPerMinute:50,fillProbability:.7,eligible});

test('R23 multiwindow aggregation rewards stability and penalizes intermittent eligibility',()=>{
 const stable=aggregateMultiwindowAsset([win('BTC-USD',60),win('BTC-USD',62),win('BTC-USD',61)]);
 const unstable=aggregateMultiwindowAsset([win('SOL-USD',80),win('SOL-USD',80,false),win('SOL-USD',80,false)]);
 assert.equal(stable.eligible,true);assert.equal(unstable.eligible,false);
 assert.ok(stable.aggregateScore>unstable.aggregateScore);
});

test('R23 availability blocks maintenance, closed, offline and stale states',()=>{
 assert.equal(availabilityGate({symbol:'BTC-USD',marketStatus:'open',symbolStatus:'online',maintenance:false,sourceAgeMs:100}).allow,true);
 for(const patch of [{maintenance:true},{marketStatus:'closed'},{symbolStatus:'offline'},{sourceAgeMs:3001}]){
  const x=availabilityGate({symbol:'BTC-USD',marketStatus:'open',symbolStatus:'online',maintenance:false,sourceAgeMs:100,...patch});
  assert.equal(x.allow,false);
 }
});

test('R23 maker/taker style includes adverse-selection cost',()=>{
 const a=compareAssetExecutionStyle({spreadBps:2,makerFeeBps:1,takerFeeBps:4,slippageBps:2,fillProbability:.9,adverseSelectionBps:2});
 const b=compareAssetExecutionStyle({spreadBps:2,makerFeeBps:1,takerFeeBps:4,slippageBps:2,fillProbability:.1,adverseSelectionBps:8});
 assert.ok(a.makerAdjustedCostBps<b.makerAdjustedCostBps);
 assert.equal(a.actualBrokerPnl,null);
});

test('R23 stresses 10k and 20k attempt sessions with cumulative cost',()=>{
 for(const attempts of [10000,20000]){
  const x=runTurnoverStress({attempts,edgeR:.06,costR:.02,winRate:.56,maxDrawdownR:30,maxLossStreak:15});
  assert.ok(x.tradesExecuted<=attempts);assert.equal(x.actualBrokerPnl,null);assert.equal(x.ordersSent,0);
 }
});

test('R23 multiwindow ranking is deterministic',()=>{
 const r=rankMultiwindowAssets([
  [win('BTC-USD',55),win('BTC-USD',56),win('BTC-USD',57)],
  [win('ETH-USD',40),win('ETH-USD',41),win('ETH-USD',42)],
  [win('SOL-USD',65),win('SOL-USD',66),win('SOL-USD',67)]
 ]);
 assert.equal(r[0].symbol,'SOL-USD');assert.equal(r.at(-1).symbol,'ETH-USD');
});
