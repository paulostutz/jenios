import test from 'node:test';
import assert from 'node:assert/strict';
import {B289_PROFILES,B289_PROTOCOL,evaluateB289OperatorLab} from '../lib/platform/research/b289-operator-reversal-lab.mjs';
const H=3600000,T=Date.parse('2026-09-01T00:00:00Z');
function bars(n=240,type='trend'){
 return Array.from({length:n},(_,i)=>{
  const p=type==='trend'?100*Math.exp(i*.006):100+3*Math.sin(i/5);
  const next=type==='trend'?100*Math.exp((i+1)*.006):100+3*Math.sin((i+1)/5);
  return {t:T+i*H,open:p,close:next,high:Math.max(p,next)*1.004,
   low:Math.min(p,next)*.996,volume:1000+i%10};
 });
}
const run=(x,options={})=>evaluateB289OperatorLab(x,{asOfMs:x.at(-1).t+H,...options});
test('B289 covers five distinct losing-operator behavioral hypotheses',()=>{
 const r=run(bars());
 assert.deepEqual(r.summary.map(x=>x.profile),B289_PROFILES);
 assert.equal(r.brokerOrdersSent,0);assert.equal(r.paperOrdersSent,0);
 assert.equal(r.originalRobotEvaluated,false);
 assert.equal(r.actualLosingOperatorsObserved,false);
 assert.equal(r.commercialClaimsAllowed,false);
 assert.equal(r.noParameterPromotion,true);
});
test('B289 strong mega trend blocks automatic reversal against direction',()=>{
 const r=run(bars(240,'trend'));
 assert.ok(r.events.some(e=>e.megaTrendDetected));
 assert.ok(r.events.some(e=>e.megaTrendInversionBlocked));
 for(const e of r.events.filter(x=>x.megaTrendDetected)){
  assert.ok(e.reverseDirection===0||e.reverseDirection===e.megaTrendDirection);
 }
});
test('B289 no mega trend can use contrary hypothetical direction',()=>{
 const r=run(bars(240,'sideways'));
 assert.ok(r.events.some(e=>!e.megaTrendDetected&&e.reverseDirection===-e.operatorDirection));
});
test('B289 future candle cannot be included before it closes',()=>{
 const x=bars();
 assert.throws(()=>evaluateB289OperatorLab(x,{asOfMs:x.at(-1).t+H-1}),/B289_UNCLOSED_CANDLE/);
});
test('B289 missing and malformed bars fail closed',()=>{
 const x=bars();
 assert.throws(()=>run(x.slice(0,90)),/B289_INVALID_CLOSED_HISTORY/);
 assert.throws(()=>run(x.map((b,i)=>i===40?{...b,t:b.t+H}:b)),/B289_INVALID_OR_GAPPED_CANDLE/);
 assert.throws(()=>run(x.map((b,i)=>i===50?{...b,high:0}:b)),/B289_INVALID_OR_GAPPED_CANDLE/);
});
test('B289 holds out first 100 bars and never invents executed fills',()=>{
 const x=bars(260);
 const r=run(x,{holdoutStartIndex:120});
 assert.ok(r.events.every(e=>e.signalClosedAtMs===e.targetBarOpenMs));
 assert.ok(r.events.every(e=>e.targetBarOpenMs>=x[120].t));
 assert.ok(r.events.every(e=>!e.realOrder&&!e.paperOrder));
 assert.equal(r.statisticalAdvantageCertified,false);
 assert.equal(r.shortBorrowFundingModeled,false);
});
test('B289 deterministic and no price-dependent re-optimization',()=>{
 const x=bars(220),a=run(x),b=run(x);
 assert.deepEqual(a,b);
 assert.deepEqual(B289_PROTOCOL.costBps,[0,10,30]);
 assert.equal(B289_PROTOCOL.megaTrendMinAlignedBars,8);
});
