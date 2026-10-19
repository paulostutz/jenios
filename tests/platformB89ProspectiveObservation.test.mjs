import test from 'node:test';
import assert from 'node:assert/strict';
import {captureProspectiveObservation,readProspectiveObservations,observationKey,prospectiveCoverage}
 from '../lib/platform/prospective-observation.mjs';
const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';
const clock=Date.parse('2026-10-19T19:00:00Z');
const store=()=>{const m=new Map();return {
 getItem:key=>m.has(key)?m.get(key):null,setItem:(k,v)=>m.set(k,String(v))
};};
const capture=(time,product='BTC-USD')=>({
 provider:'coinbase_exchange_public_rest',product,granularity:300,available:true,historicalOnly:true,liveStream:false,
 obtainedAt:new Date(time).toISOString(),lastCompleteCandle:new Date(time-300000).toISOString(),
 ageMs:0,candles:[{time:new Date(time-300000).toISOString(),close:50000+time%1000}]
});
test('B89 only verified Social/Platform account ID uses its separate local observation namespace',()=>{
 assert.notEqual(observationKey(a,'BTC-USD',300),observationKey(b,'BTC-USD',300));
 assert.notEqual(observationKey(a,'BTC-USD',300),observationKey(a,'ETH-USD',300));
 assert.equal(observationKey('guest','BTC-USD',300),null);
});
test('B89 prospectively registered observations cannot be backfilled from past or duplicate candle',()=>{
 const s=store(),at=clock;
 assert.equal(captureProspectiveObservation(s,'social_'+a,capture(at),{now:at}).ok,true);
 assert.equal(captureProspectiveObservation(s,'social_'+a,capture(at),{now:at}).reason,'NO_NEW_COMPLETE_CANDLE');
 assert.equal(captureProspectiveObservation(s,'social_'+a,capture(at-300000),{now:at-300000}).reason,'NO_NEW_COMPLETE_CANDLE');
 const next=captureProspectiveObservation(s,'social_'+a,capture(at+300000),{now:at+300000});
 assert.equal(next.ok,true);assert.equal(next.rows.length,2);
 assert.equal(next.rows[0].realOrder,false);
 assert.equal(next.rows[0].verifiedProfit,null);
});
test('B89 reject a stale or forged provider response and reversed timestamps',()=>{
 const s=store(),bad=capture(clock);
 assert.equal(captureProspectiveObservation(s,a,{...bad,provider:'untrusted'}, {now:clock}).ok,false);
 assert.equal(captureProspectiveObservation(s,a,{...bad,obtainedAt:new Date(clock-240000).toISOString()},{now:clock}).ok,false);
 assert.equal(captureProspectiveObservation(s,a,{...bad,liveStream:true},{now:clock}).ok,false);
 assert.equal(captureProspectiveObservation(s,a,{...bad,ageMs:999999},{now:clock}).ok,false);
 assert.deepEqual(readProspectiveObservations(s,b,'BTC-USD',300),[]);
});
test('B89 prospective coverage cannot count as strategy performance',()=>{
 const s=store();
 const result=captureProspectiveObservation(s,a,capture(clock),{now:clock});
 const metric=prospectiveCoverage(result.rows);
 assert.equal(metric.count,1);assert.equal(metric.usable,false);
 assert.equal(metric.verifiedPerformance,false);
});
