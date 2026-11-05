import test from 'node:test';import assert from 'node:assert/strict';
import {compareOosThresholds,R21_OOS_ROWS} from '../lib/platform/research/robot-r21-alignment-oos.mjs';
import {estimateFillProbability,queueDeterioration,rateLimitGate,rankCryptoAssets,simulateHighTurnoverSession}
 from '../lib/platform/research/robot-r21-ultrafast-ranking.mjs';

test('R21 OOS sample is frozen and compares 0.50 vs 0.65 without auto promotion',()=>{
 const x=compareOosThresholds();
 assert.equal(x.sampleSize,2400);assert.equal(R21_OOS_ROWS.length,2400);
 assert.ok([.5,.65].includes(x.winner));assert.equal(x.promoteToProduction,false);assert.equal(x.ordersSent,0);
});

test('R21 fill probability falls with queue/latency and stays bounded',()=>{
 const fast=estimateFillProbability({depthUsd:2e6,queueAheadUsd:1000,tradeFlowPerSecUsd:50000,horizonMs:500,latencyMs:20});
 const slow=estimateFillProbability({depthUsd:2e6,queueAheadUsd:100000,tradeFlowPerSecUsd:50000,horizonMs:500,latencyMs:800});
 assert.ok(fast.fillProbability>slow.fillProbability);
 assert.ok(fast.fillProbability<=1&&slow.fillProbability>=0);
});

test('R21 queue deterioration increases with cancel/replace and latency',()=>{
 const a=queueDeterioration({initialQueueAheadUsd:10000,cancelReplaceCount:0,latencyMs:50,volatilityBps:10});
 const b=queueDeterioration({initialQueueAheadUsd:10000,cancelReplaceCount:5,latencyMs:900,volatilityBps:50});
 assert.ok(b.effectiveQueueAheadUsd>a.effectiveQueueAheadUsd);
});

test('R21 rate-limit gate fails closed at request or rejection limits',()=>{
 assert.equal(rateLimitGate({requestsLastSecond:9,requestsLastMinute:99,maxPerSecond:10,maxPerMinute:100,rejectionsLastMinute:0}).allow,true);
 assert.equal(rateLimitGate({requestsLastSecond:10,requestsLastMinute:99,maxPerSecond:10,maxPerMinute:100,rejectionsLastMinute:0}).allow,false);
 assert.equal(rateLimitGate({requestsLastSecond:1,requestsLastMinute:1,maxPerSecond:10,maxPerMinute:100,rejectionsLastMinute:5}).allow,false);
});

test('R21 ranks crypto by cost-adjusted edge, liquidity, activity and fill probability',()=>{
 const rows=[
  {symbol:'BTC-USD',spreadBps:1,volatilityBps:30,depthUsd:5000000,tradesPerMinute:300,roundTripCostBps:4,fillProbability:.8},
  {symbol:'ETH-USD',spreadBps:2,volatilityBps:35,depthUsd:3000000,tradesPerMinute:240,roundTripCostBps:5,fillProbability:.75},
  {symbol:'ILLQ-USD',spreadBps:15,volatilityBps:20,depthUsd:20000,tradesPerMinute:2,roundTripCostBps:10,fillProbability:.1}
 ];
 const r=rankCryptoAssets(rows);
 assert.equal(r[0].eligible,true);assert.equal(r.at(-1).eligible,false);
});

test('R21 high-turnover session halts on accumulated risk and never claims broker PnL',()=>{
 const attempts=Array.from({length:5000},(_,i)=>({grossR:i%7===0?.2:-.06,execute:true}));
 const x=simulateHighTurnoverSession({attempts,perTradeCostR:.02,maxDrawdownR:3,maxConsecutiveLosses:8});
 assert.ok(x.trades<5000);assert.ok(['DRAWDOWN_LIMIT','LOSS_STREAK_LIMIT'].includes(x.haltReason));
 assert.equal(x.actualBrokerPnl,null);assert.equal(x.ordersSent,0);assert.equal(x.paperOrdersSent,0);
});
