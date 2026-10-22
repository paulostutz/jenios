import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {planR14Observation,captureR14Outcome,R14_POST_PROTOCOL}
 from '../lib/platform/research/robot-r14-post-candle.mjs';

const cb=[[1792695600,100,102,101,101.5,25]];
const kr={error:[],result:{XXBTZUSD:[[1792695600,'101','102.02','100','101.52','101.2','30',1]],last:1792699200}};
const fetcher=async url=>Response.json(url.includes('coinbase')?cb:kr);

test('R14 refuses observation before closed plus ten minutes',()=>{
 assert.throws(()=>planR14Observation(R14_POST_PROTOCOL.earliestObserveMs-1),
  e=>e?.code==='R14_WAIT_UNTIL_2026_10_22_20_10_UTC');
});

test('R14 plan is fixed to the preregistered 19-20 UTC BTC-USD window',()=>{
 const p=planR14Observation(R14_POST_PROTOCOL.earliestObserveMs);
 assert.equal(p.openMs,Date.parse('2026-10-22T19:00:00Z'));
 assert.equal(p.closeMs,Date.parse('2026-10-22T20:00:00Z'));
 assert.match(p.coinbaseUrl,/BTC-USD/);
 assert.match(p.krakenUrl,/XBTUSD/);
 assert.equal(p.precommitSha256,'94ab2789d74b709fa86d7afaceb767532d1c5e8c39c34fac8ebb9a09981b5fba');
});

test('R14 descriptive observation stays non-commercial',async()=>{
 const now=R14_POST_PROTOCOL.earliestObserveMs;
 const p=planR14Observation(now);
 const {observation}=await captureR14Outcome({plan:p,observedAtMs:now,fetcher});
 assert.equal(observation.precommitSha256,'94ab2789d74b709fa86d7afaceb767532d1c5e8c39c34fac8ebb9a09981b5fba');
 assert.equal(observation.brokerOrdersSent,0);
 assert.equal(observation.paperOrdersSent,0);
 assert.equal(observation.actualBrokerRealizedPnl,null);
 assert.equal(observation.actualLossesAvoided,null);
 assert.equal(observation.tradeAccuracy,null);
 assert.equal(observation.commercialPerformanceCertified,false);
});

test('R14 rejects tampered plan and bad public responses',async()=>{
 const now=R14_POST_PROTOCOL.earliestObserveMs,p=planR14Observation(now);
 await assert.rejects(()=>captureR14Outcome({plan:{...p,openMs:1},observedAtMs:now,fetcher}));
 await assert.rejects(()=>captureR14Outcome({plan:p,observedAtMs:now,
  fetcher:async()=>new Response('{}',{status:500})}));
});

test('R14 post-candle module contains no broker/order/secret transport',()=>{
 const s=readFileSync(new URL('../lib/platform/research/robot-r14-post-candle.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(s,/submitOrder|createOrder|OPENAI_API_KEY|process\.env|private-core|nucleo-privado/i);
 const v=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url),'utf8'));
 assert.equal(v.git.deploymentEnabled['research/jenios-robot-r14-evidence-20261022'],false);
});
