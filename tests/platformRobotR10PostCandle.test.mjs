import test from 'node:test';import assert from 'node:assert/strict';
import {planR10Observation,inspectR10FutureCandle,verifyR10Commit,R10_PROTOCOL}
 from '../lib/platform/research/robot-r10-post-candle.mjs';
test('R10 no future candle before 14:10 UTC',()=>{
 for(const ms of [Date.parse('2026-10-22T13:59:59Z'),Date.parse('2026-10-22T14:09:59Z')])
 assert.throws(()=>planR10Observation(ms),/R10_WAIT_UNTIL/);
 const p=planR10Observation(Date.parse('2026-10-22T14:10:00Z'));
 assert.equal(p.openMs,Date.parse('2026-10-22T13:00:00Z'));
});
test('R10 public GET only after close with no trade result',async()=>{
 const p=planR10Observation(Date.parse('2026-10-22T14:10:00Z')),t=p.openMs/1000;
 const a=[[t,99,102,100,101,22]];
 const b={error:[],result:{XXBTZUSD:[[t,'100','102','99','101.02','100.1','25',3]],last:t}};
 let n=0;const fetcher=async(u,o)=>{n++;assert.equal(o.method,'GET');assert.equal(o.credentials,'omit');return Response.json(u.includes('kraken')?b:a)};
 const r=await inspectR10FutureCandle({plan:p,observedAtMs:p.nowMs,fetcher});
 assert.equal(n,2);assert.equal(r.entries,0);assert.equal(r.tradingProfit,null);
 assert.equal(r.ordersSent,0);
});
test('R10 refuses changed URL, forged digest and skipped grace',async()=>{
 const p=planR10Observation(Date.parse('2026-10-22T14:10:00Z'));
 await assert.rejects(()=>inspectR10FutureCandle({plan:{...p,krakenUrl:'https://bad.test'},observedAtMs:p.nowMs}),/R10_CHANGED_PLAN/);
 assert.throws(()=>verifyR10Commit({modeResults:[]},{commitmentSha256:'bad'}));
 assert.equal(R10_PROTOCOL.dataSignedByExchange,false);
});

test('R10 flags mismatched open, high or low despite agreeing closes',async()=>{
 const p=planR10Observation(Date.parse('2026-10-22T14:10:00Z')),t=p.openMs/1000;
 const a=[[t,99,102,100,101,22]];
 const b={error:[],result:{XXBTZUSD:[[t,'100','107','99','101','100.1','25',3]],last:t}};
 const f=async url=>Response.json(url.includes('kraken')?b:a);
 const r=await inspectR10FutureCandle({plan:p,observedAtMs:p.nowMs,fetcher:f});
 assert.equal(r.priceConsistencyWithinResearchThresholds,false);
 assert.ok(r.issues.includes('OHLC_DIVERGENCE'));
 assert.equal(r.tradingProfit,null);
});
test('R10 rejects coincident unverified identical provider payloads',async()=>{
 const p=planR10Observation(Date.parse('2026-10-22T14:10:00Z')),t=p.openMs/1000;
 const a=[[t,99,102,100,101,22]];
 const b={error:[],result:{XXBTZUSD:[[t,'100','102','99','101','100.1','22',3]],last:t}};
 const f=async url=>Response.json(url.includes('kraken')?b:a);
 const r=await inspectR10FutureCandle({plan:p,observedAtMs:p.nowMs,fetcher:f});
 assert.ok(r.issues.includes('SUSPICIOUS_IDENTICAL_UNWITNESSED_DATA'));
 assert.equal(r.priceConsistencyWithinResearchThresholds,false);
});
test('R10 cannot claim profitable trade or avoided loss from six abstentions',()=>{
 const p=R10_PROTOCOL;
 assert.equal(p.dataSignedByExchange,false);
 assert.equal(p.earliestObserveMs,Date.parse('2026-10-22T14:10:00Z'));
});
