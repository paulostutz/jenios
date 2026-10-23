import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {scoreUltrafastAsset,planUltrafastSession,decideUltrafastDirection,sessionKillSwitch}
 from '../lib/platform/research/robot-r18-ultrafast-foundation.mjs';

test('R18 ranks liquid, active and volatile assets only when costs are cleared',()=>{
 const good=scoreUltrafastAsset({assetClass:'crypto',spreadBps:2,volatilityBps:35,depthUsd:3000000,
  tradesPerMinute:200,expectedRoundTripCostBps:5,maxStaleMs:250,marketOpen:true});
 assert.equal(good.eligible,true);
 const bad=scoreUltrafastAsset({assetClass:'equity',spreadBps:8,volatilityBps:9,depthUsd:50000,
  tradesPerMinute:5,expectedRoundTripCostBps:7,maxStaleMs:1500,marketOpen:true});
 assert.equal(bad.eligible,false);
 assert.ok(bad.issues.includes('NO_COST_ADJUSTED_EDGE'));
});

test('R18 session planning blocks oversized risk and microscopic targets',()=>{
 const safe=planUltrafastSession({sessionMode:'timed_session',accountEquity:100000,tradeValue:1000,
  leverage:2,stopLossBps:15,takeProfitBps:35,roundTripCostBps:4,slippageBufferBps:2,
  maxTrades:10,durationMinutes:60,marketOpen:true});
 assert.equal(safe.allowed,true);
 const bad=planUltrafastSession({sessionMode:'timed_session',accountEquity:1000,tradeValue:1000,
  leverage:10,stopLossBps:50,takeProfitBps:5,roundTripCostBps:6,slippageBufferBps:4,
  maxTrades:100,durationMinutes:60,marketOpen:true});
 assert.equal(bad.allowed,false);
 assert.ok(bad.issues.includes('TRADE_RISK_TOO_HIGH'));
 assert.ok(bad.issues.includes('SESSION_RISK_TOO_HIGH'));
 assert.ok(bad.issues.includes('TARGET_TOO_SMALL_AFTER_COSTS'));
});

test('R18 direction requires fresh quotes and cost-adjusted micro edge',()=>{
 const buy=decideUltrafastDirection({microMomentumBps:8,orderBookImbalance:.5,shortVolatilityBps:20,
  roundTripCostBps:3,spreadBps:2,quoteAgeMs:100});
 assert.equal(buy.side,'buy');assert.equal(buy.classification,'ULTRAFAST_PREVIEW');
 const wait=decideUltrafastDirection({microMomentumBps:1,orderBookImbalance:.1,shortVolatilityBps:5,
  roundTripCostBps:3,spreadBps:3,quoteAgeMs:1500});
 assert.equal(wait.classification,'WAIT');assert.equal(wait.side,null);
});

test('R18 kill switch halts on user stop, closed market, drawdown, losses, stale feed or rejects',()=>{
 for(const patch of [
  {userStopped:true},{marketOpen:false},{sessionDrawdownPct:2},
  {consecutiveLosses:5},{quoteAgeMs:1001},{rejectionsLastMinute:5}
 ]){
  const x=sessionKillSwitch({sessionRealizedR:0,sessionDrawdownPct:0,consecutiveLosses:0,
   quoteAgeMs:100,rejectionsLastMinute:0,marketOpen:true,userStopped:false,...patch});
  assert.equal(x.halt,true);assert.equal(x.ordersSent,0);
 }
});

test('R18 module has no network, broker transport or secret integration',()=>{
 const s=readFileSync(new URL('../lib/platform/research/robot-r18-ultrafast-foundation.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(s,/\bfetch\s*\(|submitOrder|createOrder|OPENAI_API_KEY|process\.env/i);
});
