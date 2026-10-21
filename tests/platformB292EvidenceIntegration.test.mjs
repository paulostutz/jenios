import test from 'node:test';import assert from 'node:assert/strict';
import {reviewB292HybridClosedMarket,reviewB292ManualDeliveryAndRisk,reviewB292ReverseReference} from '../lib/platform/research/b292-evidence-integration.mjs';
const H=3600000,T=Date.parse('2026-09-01T00:00:00Z');
const candles=(n=100)=>Array.from({length:n},(_,i)=>{
 const p=100+i*.1,close=p+.07;
 return {t:T+i*H,open:p,high:close+.2,low:p-.2,close,volume:1000+i%9};
});
test('B292 hybrid reuses closed-candle features and never invents executable signals',()=>{
 const x=candles(),r=reviewB292HybridClosedMarket(x,{asOfMs:x.at(-1).t+H});
 assert.equal(r.sourceBars,100);assert.equal(r.ordersSent,0);
 assert.equal(r.copilot.humanDecisionRequired,true);
 assert.equal(r.copilot.entryPriceSuggestion,null);
 assert.equal(r.privateRobotSignalsVerified,false);
 assert.equal(r.geniosProviderCalled,false);
});
test('B292 rejects unclosed future bar',()=>{
 const x=candles();assert.throws(()=>reviewB292HybridClosedMarket(x,{asOfMs:x.at(-1).t+H-1}),/RESEARCH_OPEN_OR_FUTURE_CANDLE/);
});
test('B292 manual delivered before target and streak remains optional',()=>{
 const signal={mode:'manual',direction:'UP',emittedAtMs:1000,targetCandleOpenMs:4000,isOrder:false};
 const x=reviewB292ManualDeliveryAndRisk({signal,recordedAtMs:2000,deliveredAtMs:3000,
 closedTrades:[1,-1,-1,-1].map((netResult,i)=>({closedAtMs:100+i,netResult,verifiedClosedTrade:true}))});
 assert.equal(x.risk.pauseSuggested,true);assert.equal(x.automaticModeSwitch,false);
 assert.equal(x.actualDeliveryVerified,false);
});
test('B292 reverse transforms operator reference but does not claim actual feed',()=>{
 const x=reviewB292ReverseReference({command:{eventId:'a',action:'open',side:'buy'}});
 assert.equal(x.result.side,'sell');assert.equal(x.ordersSent,0);
 assert.equal(x.originalOrderFeedVerified,false);
});
test('B292 reverse respects mega trend and lifecycle',()=>{
 const c={eventId:'a',action:'open',side:'buy'};
 assert.equal(reviewB292ReverseReference({command:c,megaTrendDirection:'buy'}).result.side,'buy');
 assert.equal(reviewB292ReverseReference({command:{...c,action:'close'}}).result.noNewExposure,true);
});
