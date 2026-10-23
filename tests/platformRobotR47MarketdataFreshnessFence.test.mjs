import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createR47FeedState,
  beginR47Connection,
  ingestR47MarketData,
  authorizeR47Decision,
  rotateR47LeaderFence,
  runR47Battery
} from '../lib/platform/research/robot-r47-marketdata-freshness-fence.mjs';

test('R47 requires consecutive fresh snapshots after connect',()=>{
  const f=createR47FeedState({maxAgeMs:500,minConsecutiveFresh:2});
  beginR47Connection(f,{sourceEpoch:1,fencingToken:1});
  const a=ingestR47MarketData(f,{sourceEpoch:1,sequence:1,exchangeTsMs:1000,authorityNowMs:1100,fencingToken:1});
  const b=ingestR47MarketData(f,{sourceEpoch:1,sequence:2,exchangeTsMs:1200,authorityNowMs:1250,fencingToken:1});
  assert.equal(a.ready,false); assert.equal(b.ready,true);
});
test('R47 stale data is blocked',()=>{
  const f=createR47FeedState({maxAgeMs:300,minConsecutiveFresh:1});
  beginR47Connection(f,{sourceEpoch:1,fencingToken:1});
  const x=ingestR47MarketData(f,{sourceEpoch:1,sequence:1,exchangeTsMs:1000,authorityNowMs:1401,fencingToken:1});
  assert.equal(x.accepted,false); assert.equal(x.reason,'R47_STALE_MARKET_DATA');
});
test('R47 sequence gap revokes readiness',()=>{
  const f=createR47FeedState({maxAgeMs:500,minConsecutiveFresh:1});
  beginR47Connection(f,{sourceEpoch:1,fencingToken:1});
  ingestR47MarketData(f,{sourceEpoch:1,sequence:1,exchangeTsMs:1000,authorityNowMs:1050,fencingToken:1});
  const x=ingestR47MarketData(f,{sourceEpoch:1,sequence:3,exchangeTsMs:1100,authorityNowMs:1150,fencingToken:1});
  assert.equal(x.accepted,false); assert.equal(f.ready,false);
});
test('R47 reconnect rejects old source epoch',()=>{
  const f=createR47FeedState({maxAgeMs:500,minConsecutiveFresh:1});
  beginR47Connection(f,{sourceEpoch:1,fencingToken:1});
  beginR47Connection(f,{sourceEpoch:2,fencingToken:1});
  const x=ingestR47MarketData(f,{sourceEpoch:1,sequence:1,exchangeTsMs:1000,authorityNowMs:1050,fencingToken:1});
  assert.equal(x.accepted,false); assert.equal(x.reason,'R47_SOURCE_EPOCH_MISMATCH');
});
test('R47 handoff requires fresh resync under new fence',()=>{
  const f=createR47FeedState({maxAgeMs:500,minConsecutiveFresh:2});
  beginR47Connection(f,{sourceEpoch:1,fencingToken:1});
  ingestR47MarketData(f,{sourceEpoch:1,sequence:1,exchangeTsMs:1000,authorityNowMs:1050,fencingToken:1});
  ingestR47MarketData(f,{sourceEpoch:1,sequence:2,exchangeTsMs:1100,authorityNowMs:1150,fencingToken:1});
  rotateR47LeaderFence(f,{newFencingToken:2});
  const old=authorizeR47Decision(f,{authorityNowMs:1160,fencingToken:1,sourceEpoch:1});
  assert.equal(old.allow,false);
  beginR47Connection(f,{sourceEpoch:2,fencingToken:2});
  const a=ingestR47MarketData(f,{sourceEpoch:2,sequence:1,exchangeTsMs:1200,authorityNowMs:1250,fencingToken:2});
  const b=ingestR47MarketData(f,{sourceEpoch:2,sequence:2,exchangeTsMs:1300,authorityNowMs:1350,fencingToken:2});
  assert.equal(a.ready,false); assert.equal(b.ready,true);
});
test('R47 integrated battery preserves zero execution',()=>{
  const x=runR47Battery();
  assert.equal(x.pass,true);
  assert.equal(x.ordersSent,0); assert.equal(x.paperOrdersSent,0);
  assert.equal(x.actualBrokerPnl,null); assert.equal(x.actualLossesAvoided,null); assert.equal(x.realTradeAccuracy,null);
});
