import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createR43ReplicaSet,
  writeR43Replicas,
  recoverR43Quorum,
  detectR43Divergence,
  runR43Battery
} from '../lib/platform/research/robot-r43-quorum-checkpoint.mjs';
import {createR38State,ingestR38Event} from '../lib/platform/research/robot-r38-multistream-expiry.mjs';
import {snapshotR39} from '../lib/platform/research/robot-r39-state-restore-session-rotation.mjs';
import {sealR41Snapshot} from '../lib/platform/research/robot-r41-integrity-atomic-checkpoint.mjs';

const ready=[
  {transportConnected:true},
  {marketDataFresh:true,sequenceContinuous:true},
  {openOrdersKnown:true,positionsKnown:true},
  {riskLedgerMatches:true,unknownExposure:false}
];
const ev=epoch=>({
  streamId:'A',eventId:'A-E'+epoch,sessionId:'A-S1',authorizationId:'A-A1',
  resetComplete:epoch===1,recoverySequence:ready,
  regime:{regime:'R43_A',epoch,totalCostBps:1,fillProbability:.95,estimatedWinRate:.62,grossWinBps:15,grossLossBps:9},
  tradeNetR:.2
});
const sealedAt=n=>{
  const s=createR38State({dedupWindow:32,maxReorderGap:4,tombstoneWindow:128});
  for(let i=1;i<=n;i++)ingestR38Event(s,ev(i));
  return sealR41Snapshot(snapshotR39(s));
};

test('R43 quorum commit advances high-water mark only with majority',()=>{
  const set=createR43ReplicaSet({replicas:3});
  const a=writeR43Replicas(set,{generation:1,sealed:sealedAt(10),targetIds:['R1']});
  assert.equal(a.committed,false);
  assert.equal(set.highWaterMark,0);
  const b=writeR43Replicas(set,{generation:1,sealed:sealedAt(10),targetIds:['R1','R2']});
  assert.equal(b.committed,true);
  assert.equal(set.highWaterMark,1);
});

test('R43 recovers latest generation when quorum agrees',()=>{
  const set=createR43ReplicaSet({replicas:3});
  const s1=sealedAt(10),s2=sealedAt(20);
  writeR43Replicas(set,{generation:1,sealed:s1});
  writeR43Replicas(set,{generation:2,sealed:s2});
  const x=recoverR43Quorum(set);
  assert.equal(x.ok,true);
  assert.equal(x.generation,2);
  assert.equal(x.supportingReplicas.length,3);
});

test('R43 detects divergent copies at same generation',()=>{
  const set=createR43ReplicaSet({replicas:3});
  const s1=sealedAt(10);
  writeR43Replicas(set,{generation:1,sealed:s1});
  const altered=JSON.parse(JSON.stringify(set.replicas[0].record));
  altered.sealed.checksum='0'.repeat(64);
  set.replicas[1].record=altered;
  const x=detectR43Divergence(set);
  assert.equal(x.hasDivergence,true);
  assert.deepEqual(x.divergentGenerations,[1]);
});

test('R43 falls back one generation only when previous copy has quorum',()=>{
  const set=createR43ReplicaSet({replicas:3});
  const s1=sealedAt(10),s2=sealedAt(20),s3=sealedAt(30);
  writeR43Replicas(set,{generation:1,sealed:s1});
  writeR43Replicas(set,{generation:2,sealed:s2});
  writeR43Replicas(set,{generation:3,sealed:s3});
  set.replicas[0].record={schema:'JENIOS_R43_RECORD_V1',generation:3,sealed:{...JSON.parse(JSON.stringify(s3)),payload:null}};
  set.replicas[1].record={schema:'JENIOS_R43_RECORD_V1',generation:2,sealed:JSON.parse(JSON.stringify(s2))};
  set.replicas[2].record={schema:'JENIOS_R43_RECORD_V1',generation:2,sealed:JSON.parse(JSON.stringify(s2))};
  const x=recoverR43Quorum(set);
  assert.equal(x.ok,true);
  assert.equal(x.generation,2);
  assert.equal(x.usedFallback,true);
  assert.equal(x.highWaterMark,3);
});

test('R43 fails closed when no valid quorum exists',()=>{
  const set=createR43ReplicaSet({replicas:3});
  const s1=sealedAt(10);
  writeR43Replicas(set,{generation:1,sealed:s1});
  set.replicas[0].record=null;
  set.replicas[1].record={schema:'JENIOS_R43_RECORD_V1',generation:1,sealed:{...JSON.parse(JSON.stringify(s1)),payload:null}};
  const x=recoverR43Quorum(set);
  assert.equal(x.ok,false);
  assert.equal(x.failClosed,true);
  assert.equal(x.operationalAuthorization,false);
});

test('R43 integrated battery preserves zero execution',()=>{
  const x=runR43Battery({sealedGenerations:[sealedAt(10),sealedAt(20),sealedAt(30)]});
  assert.equal(x.pass,true);
  assert.equal(x.fallbackToPreviousQuorum,true);
  assert.equal(x.highWaterMarkPreserved,true);
  assert.equal(x.divergenceDetected,true);
  assert.equal(x.noQuorumFailsClosed,true);
  assert.equal(x.ordersSent,0);
  assert.equal(x.paperOrdersSent,0);
  assert.equal(x.actualBrokerPnl,null);
  assert.equal(x.actualLossesAvoided,null);
  assert.equal(x.realTradeAccuracy,null);
});
