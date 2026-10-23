import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createR45Cluster,
  setR45Partitions,
  electR45Leader,
  authorizeR45Write,
  renewR45Lease,
  runR45Battery
} from '../lib/platform/research/robot-r45-leader-fencing.mjs';

test('R45 elects leader only with majority quorum',()=>{
  const c=createR45Cluster({replicas:5});
  setR45Partitions(c,[['R1','R2'],['R3','R4','R5']]);
  const minority=electR45Leader(c,{candidateId:'R1'});
  assert.equal(minority.elected,false);
  const majority=electR45Leader(c,{candidateId:'R3'});
  assert.equal(majority.elected,true);
  assert.equal(majority.leaderId,'R3');
});

test('R45 fencing token increases across leadership changes',()=>{
  const c=createR45Cluster({replicas:5});
  const a=electR45Leader(c,{candidateId:'R1'});
  setR45Partitions(c,[['R1','R2'],['R3','R4','R5']]);
  const b=electR45Leader(c,{candidateId:'R3'});
  assert.equal(b.elected,true);
  assert.ok(b.fencingToken>a.fencingToken);
  assert.ok(b.term>a.term);
});

test('R45 stale writer is blocked after new leader election',()=>{
  const c=createR45Cluster({replicas:5});
  const a=electR45Leader(c,{candidateId:'R1'});
  setR45Partitions(c,[['R1','R2'],['R3','R4','R5']]);
  const b=electR45Leader(c,{candidateId:'R3'});
  const stale=authorizeR45Write(c,{writerId:'R1',fencingToken:a.fencingToken,leaseEpoch:a.leaseEpoch});
  const fresh=authorizeR45Write(c,{writerId:'R3',fencingToken:b.fencingToken,leaseEpoch:b.leaseEpoch});
  assert.equal(stale.allow,false);
  assert.equal(fresh.allow,true);
});

test('R45 old leader cannot renew lease after losing quorum',()=>{
  const c=createR45Cluster({replicas:5});
  const a=electR45Leader(c,{candidateId:'R1'});
  setR45Partitions(c,[['R1','R2'],['R3','R4','R5']]);
  const x=renewR45Lease(c,{leaderId:'R1',fencingToken:a.fencingToken});
  assert.equal(x.renewed,false);
  assert.equal(x.reason,'R45_LEASE_LOST_QUORUM');
});

test('R45 stale writer stays blocked after reconvergence',()=>{
  const c=createR45Cluster({replicas:5});
  const a=electR45Leader(c,{candidateId:'R1'});
  setR45Partitions(c,[['R1','R2'],['R3','R4','R5']]);
  const b=electR45Leader(c,{candidateId:'R3'});
  setR45Partitions(c,[['R1','R2','R3','R4','R5']]);
  const stale=authorizeR45Write(c,{writerId:'R1',fencingToken:a.fencingToken,leaseEpoch:a.leaseEpoch});
  const good=authorizeR45Write(c,{writerId:'R3',fencingToken:b.fencingToken,leaseEpoch:b.leaseEpoch});
  assert.equal(stale.allow,false);
  assert.equal(good.allow,true);
});

test('R45 integrated battery preserves zero execution',()=>{
  const x=runR45Battery();
  assert.equal(x.pass,true);
  assert.equal(x.staleWriterBlockedDuringPartition,true);
  assert.equal(x.staleWriterBlockedAfterReconvergence,true);
  assert.equal(x.fencingTokenAdvanced,true);
  assert.equal(x.ordersSent,0);
  assert.equal(x.paperOrdersSent,0);
  assert.equal(x.actualBrokerPnl,null);
  assert.equal(x.actualLossesAvoided,null);
  assert.equal(x.realTradeAccuracy,null);
});
