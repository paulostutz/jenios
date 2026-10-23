import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createR44Cluster,
  setR44Partitions,
  proposeR44Generation,
  recoverR44Cluster,
  detectR44SplitBrain,
  reconvergeR44,
  runR44Battery
} from '../lib/platform/research/robot-r44-splitbrain-reconvergence.mjs';
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
  regime:{regime:'R44_A',epoch,totalCostBps:1,fillProbability:.95,estimatedWinRate:.62,grossWinBps:15,grossLossBps:9},
  tradeNetR:.2
});
const sealedAt=n=>{
  const s=createR38State({dedupWindow:32,maxReorderGap:4,tombstoneWindow:128});
  for(let i=1;i<=n;i++)ingestR38Event(s,ev(i));
  return sealR41Snapshot(snapshotR39(s));
};

test('R44 five-replica quorum is three',()=>{
  const c=createR44Cluster();
  const x=proposeR44Generation(c,{proposerId:'R1',generation:1,sealed:sealedAt(10)});
  assert.equal(x.quorum,3);
  assert.equal(x.committed,true);
  assert.equal(c.highWaterMark,1);
});

test('R44 minority partition cannot promote generation',()=>{
  const c=createR44Cluster();
  proposeR44Generation(c,{proposerId:'R1',generation:1,sealed:sealedAt(10)});
  setR44Partitions(c,[['R1','R2'],['R3','R4','R5']]);
  const x=proposeR44Generation(c,{proposerId:'R1',generation:2,sealed:sealedAt(20)});
  assert.equal(x.committed,false);
  assert.equal(x.reason,'R44_PARTITION_NO_MAJORITY');
  assert.equal(c.highWaterMark,1);
});

test('R44 majority partition can promote while minority cannot',()=>{
  const c=createR44Cluster();
  proposeR44Generation(c,{proposerId:'R1',generation:1,sealed:sealedAt(10)});
  setR44Partitions(c,[['R1','R2'],['R3','R4','R5']]);
  const x=proposeR44Generation(c,{proposerId:'R3',generation:2,sealed:sealedAt(20)});
  assert.equal(x.committed,true);
  assert.equal(c.highWaterMark,2);
});

test('R44 detects split-brain divergence at same generation',()=>{
  const c=createR44Cluster();
  const s1=sealedAt(10),s2=sealedAt(20);
  proposeR44Generation(c,{proposerId:'R1',generation:1,sealed:s1});
  proposeR44Generation(c,{proposerId:'R1',generation:2,sealed:s2});
  c.replicas[0].record={schema:'JENIOS_R44_RECORD_V1',generation:2,sealed:JSON.parse(JSON.stringify(s1))};
  const d=detectR44SplitBrain(c);
  assert.equal(d.hasSplitBrain,true);
  assert.deepEqual(d.divergentGenerations,[2]);
});

test('R44 reconvergence rewrites all replicas to majority state',()=>{
  const c=createR44Cluster();
  const s1=sealedAt(10),s2=sealedAt(20),s3=sealedAt(30);
  proposeR44Generation(c,{proposerId:'R1',generation:1,sealed:s1});
  setR44Partitions(c,[['R1','R2'],['R3','R4','R5']]);
  proposeR44Generation(c,{proposerId:'R3',generation:2,sealed:s2});
  c.replicas[0].record={schema:'JENIOS_R44_RECORD_V1',generation:2,sealed:JSON.parse(JSON.stringify(s3))};
  c.replicas[1].record={schema:'JENIOS_R44_RECORD_V1',generation:2,sealed:JSON.parse(JSON.stringify(s3))};
  const before=recoverR44Cluster(c);
  assert.equal(before.ok,true);
  assert.equal(before.supportingReplicas.length,3);
  const rc=reconvergeR44(c);
  assert.equal(rc.ok,true);
  const after=recoverR44Cluster(c);
  assert.equal(after.ok,true);
  assert.equal(after.supportingReplicas.length,5);
});

test('R44 integrated battery preserves zero execution',()=>{
  const x=runR44Battery({sealedGenerations:[sealedAt(10),sealedAt(20),sealedAt(30)]});
  assert.equal(x.pass,true);
  assert.equal(x.minorityCannotPromote,true);
  assert.equal(x.majorityCanPromote,true);
  assert.equal(x.splitBrainDetected,true);
  assert.equal(x.clusterRecoversFromMajority,true);
  assert.equal(x.reconvergesToSingleState,true);
  assert.equal(x.ordersSent,0);
  assert.equal(x.paperOrdersSent,0);
  assert.equal(x.actualBrokerPnl,null);
  assert.equal(x.actualLossesAvoided,null);
  assert.equal(x.realTradeAccuracy,null);
});
