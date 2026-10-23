import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createR46Cluster,
  setR46Partitions,
  setR46ClockOffset,
  advanceR46AuthorityTime,
  readR46LocalTime,
  electR46Leader,
  renewR46Lease,
  authorizeR46Write,
  simulateR46GcStall,
  gracefulR46Handoff,
  crashR46Leader,
  recoverR46AfterCrash,
  runR46Battery
} from '../lib/platform/research/robot-r46-lease-clockskew-handoff.mjs';

test('R46 bounded clock skew does not extend lease authority',()=>{
  const c=createR46Cluster({leaseDurationMs:5000,maxClockSkewMs:1500});
  const e=electR46Leader(c,{candidateId:'R1'});
  setR46ClockOffset(c,{nodeId:'R1',offsetMs:1200});
  const ok=authorizeR46Write(c,{writerId:'R1',fencingToken:e.fencingToken,observedLocalTimeMs:readR46LocalTime(c,'R1')});
  assert.equal(ok.allow,true);
  advanceR46AuthorityTime(c,6000);
  const expired=authorizeR46Write(c,{writerId:'R1',fencingToken:e.fencingToken,observedLocalTimeMs:readR46LocalTime(c,'R1')});
  assert.equal(expired.allow,false);
  assert.equal(expired.reason,'R46_LEASE_EXPIRED');
});

test('R46 excessive positive or negative skew is blocked',()=>{
  for(const offsetMs of [2000,-2000]){
    const c=createR46Cluster({leaseDurationMs:5000,maxClockSkewMs:1500});
    const e=electR46Leader(c,{candidateId:'R1'});
    setR46ClockOffset(c,{nodeId:'R1',offsetMs});
    const x=authorizeR46Write(c,{writerId:'R1',fencingToken:e.fencingToken,observedLocalTimeMs:readR46LocalTime(c,'R1')});
    assert.equal(x.allow,false);
    assert.equal(x.reason,'R46_CLOCK_SKEW_EXCEEDED');
  }
});

test('R46 GC stall beyond lease duration blocks stale leader',()=>{
  const c=createR46Cluster({leaseDurationMs:3000,maxClockSkewMs:1000});
  const e=electR46Leader(c,{candidateId:'R1'});
  simulateR46GcStall(c,{leaderId:'R1',stallMs:4000});
  const x=authorizeR46Write(c,{writerId:'R1',fencingToken:e.fencingToken,observedLocalTimeMs:readR46LocalTime(c,'R1')});
  assert.equal(x.allow,false);
  assert.equal(x.reason,'R46_LEASE_EXPIRED');
});

test('R46 leader that loses quorum cannot renew lease',()=>{
  const c=createR46Cluster({replicas:5});
  const e=electR46Leader(c,{candidateId:'R1'});
  setR46Partitions(c,[['R1','R2'],['R3','R4','R5']]);
  const x=renewR46Lease(c,{leaderId:'R1',fencingToken:e.fencingToken});
  assert.equal(x.renewed,false);
  assert.equal(x.reason,'R46_LEASE_LOST_QUORUM');
});

test('R46 graceful handoff revokes old writer and advances fence',()=>{
  const c=createR46Cluster({replicas:5});
  const a=electR46Leader(c,{candidateId:'R1'});
  const h=gracefulR46Handoff(c,{fromLeaderId:'R1',toLeaderId:'R2'});
  assert.equal(h.handedOff,true);
  assert.ok(h.fencingToken>a.fencingToken);
  const stale=authorizeR46Write(c,{writerId:'R1',fencingToken:a.fencingToken,observedLocalTimeMs:readR46LocalTime(c,'R1')});
  const fresh=authorizeR46Write(c,{writerId:'R2',fencingToken:h.fencingToken,observedLocalTimeMs:readR46LocalTime(c,'R2')});
  assert.equal(stale.allow,false);
  assert.equal(fresh.allow,true);
});

test('R46 abrupt leader crash followed by recovery preserves monotonic fencing',()=>{
  const c=createR46Cluster({replicas:5});
  const a=electR46Leader(c,{candidateId:'R1'});
  crashR46Leader(c,{leaderId:'R1'});
  const b=recoverR46AfterCrash(c,{candidateId:'R2'});
  assert.equal(b.elected,true);
  assert.ok(b.fencingToken>a.fencingToken);
  const stale=authorizeR46Write(c,{writerId:'R1',fencingToken:a.fencingToken,observedLocalTimeMs:readR46LocalTime(c,'R1')});
  const fresh=authorizeR46Write(c,{writerId:'R2',fencingToken:b.fencingToken,observedLocalTimeMs:readR46LocalTime(c,'R2')});
  assert.equal(stale.allow,false);
  assert.equal(fresh.allow,true);
});

test('R46 integrated battery preserves zero execution',()=>{
  const x=runR46Battery();
  assert.equal(x.pass,true);
  assert.equal(x.excessiveClockSkewBlocked,true);
  assert.equal(x.gcStallExpiresLease,true);
  assert.equal(x.gracefulHandoffAdvancesFence,true);
  assert.equal(x.crashRecoveryAdvancesFence,true);
  assert.equal(x.ordersSent,0);
  assert.equal(x.paperOrdersSent,0);
  assert.equal(x.actualBrokerPnl,null);
  assert.equal(x.actualLossesAvoided,null);
  assert.equal(x.realTradeAccuracy,null);
});
