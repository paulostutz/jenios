import test from 'node:test';import assert from 'node:assert/strict';
import {compareR22Holdout,R22_HOLDOUT} from '../lib/platform/research/robot-r22-alignment-holdout.mjs';
import {inspectPublicCryptoSnapshot,rankPublicCryptoSnapshots,compareMakerTakerEconomics}
 from '../lib/platform/research/robot-r22-public-crypto-ranking.mjs';

test('R22 second holdout keeps production threshold conservative',()=>{
 const x=compareR22Holdout();
 assert.equal(x.sampleSize,3600);assert.equal(R22_HOLDOUT.length,3600);
 assert.ok([.5,.65].includes(x.winner));
 assert.equal(x.productionThreshold,.65);
 assert.equal(x.changeRecommended,false);
});

test('R22 public crypto score uses spread, depth, activity and short volatility',()=>{
 const x=inspectPublicCryptoSnapshot({symbol:'BTC-USD',provider:'kraken',bid:100,ask:100.02,
   depthUsd:5000000,tradesPerMinute:250,shortVolatilityBps:35,sourceAtMs:1000,observedAtMs:1200});
 assert.equal(x.eligible,true);assert.equal(x.readOnly,true);assert.equal(x.authenticated,false);assert.equal(x.ordersSent,0);
});

test('R22 rejects stale or structurally invalid public snapshots',()=>{
 assert.throws(()=>inspectPublicCryptoSnapshot({symbol:'BTC-USD',provider:'kraken',bid:100,ask:99,
   depthUsd:1,tradesPerMinute:1,shortVolatilityBps:1,sourceAtMs:1000,observedAtMs:1200}),/R22_INVALID_PUBLIC_SNAPSHOT/);
 assert.throws(()=>inspectPublicCryptoSnapshot({symbol:'BTC-USD',provider:'kraken',bid:100,ask:101,
   depthUsd:1,tradesPerMinute:1,shortVolatilityBps:1,sourceAtMs:1000,observedAtMs:7001}),/R22_INVALID_PUBLIC_SNAPSHOT/);
});

test('R22 ranks multiple public crypto snapshots deterministically',()=>{
 const r=rankPublicCryptoSnapshots([
  {symbol:'BTC-USD',provider:'kraken',bid:100,ask:100.01,depthUsd:5e6,tradesPerMinute:300,shortVolatilityBps:25,sourceAtMs:1000,observedAtMs:1100},
  {symbol:'ETH-USD',provider:'kraken',bid:50,ask:50.02,depthUsd:3e6,tradesPerMinute:200,shortVolatilityBps:35,sourceAtMs:1000,observedAtMs:1100},
  {symbol:'ABC-USD',provider:'kraken',bid:1,ask:1.02,depthUsd:10000,tradesPerMinute:2,shortVolatilityBps:5,sourceAtMs:1000,observedAtMs:1100}
 ]);
 assert.equal(r.length,3);assert.equal(r.at(-1).eligible,false);
});

test('R22 maker/taker economics account for non-fill risk',()=>{
 const highFill=compareMakerTakerEconomics({spreadBps:2,makerFeeBps:1,takerFeeBps:4,slippageBps:2,fillProbability:.9});
 const lowFill=compareMakerTakerEconomics({spreadBps:2,makerFeeBps:1,takerFeeBps:4,slippageBps:2,fillProbability:.05});
 assert.ok(highFill.makerExpectedCostBps<lowFill.makerExpectedCostBps);
 assert.equal(highFill.actualBrokerPnl,null);assert.equal(lowFill.ordersSent,0);
});
