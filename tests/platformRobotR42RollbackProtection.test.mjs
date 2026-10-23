import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createR42Vault,
  commitR42Generation,
  recoverR42Vault,
  validateR42Candidate,
  runR42Battery
} from '../lib/platform/research/robot-r42-rollback-protection.mjs';
import {createR38State,ingestR38Event} from '../lib/platform/research/robot-r38-multistream-expiry.mjs';
import {snapshotR39} from '../lib/platform/research/robot-r39-state-restore-session-rotation.mjs';
import {sealR41Snapshot} from '../lib/platform/research/robot-r41-integrity-atomic-checkpoint.mjs';

const ready=[
  {transportConnected:true},
  {marketDataFresh:true,sequenceContinuous:true},
  {openOrdersKnown:true,positionsKnown:true},
  {riskLedgerMatches:true,unknownExposure:false}
];
const ev=(epoch)=>({
  streamId:'A',eventId:'A-E'+epoch,sessionId:'A-S1',authorizationId:'A-A1',
  resetComplete:epoch===1,recoverySequence:ready,
  regime:{regime:'R42_A',epoch,totalCostBps:1,fillProbability:.95,estimatedWinRate:.62,grossWinBps:15,grossLossBps:9},
  tradeNetR:.2
});
const sealedAt=(n)=>{
  const s=createR38State({dedupWindow:32,maxReorderGap:4,tombstoneWindow:128});
  for(let i=1;i<=n;i++)ingestR38Event(s,ev(i));
  return sealR41Snapshot(snapshotR39(s));
};

test('R42 accepts strictly increasing committed generations',()=>{
  const v=createR42Vault();
  commitR42Generation(v,{generation:1,sealed:sealedAt(10)});
  commitR42Generation(v,{generation:2,sealed:sealedAt(20)});
  assert.equal(v.highWaterMark,2);
  assert.equal(v.active.generation,2);
  assert.equal(v.previous.generation,1);
});

test('R42 rejects non-monotonic generation even when checksum is valid',()=>{
  const v=createR42Vault();
  const s1=sealedAt(10),s2=sealedAt(20);
  commitR42Generation(v,{generation:1,sealed:s1});
  commitR42Generation(v,{generation:2,sealed:s2});
  assert.throws(()=>commitR42Generation(v,{generation:2,sealed:s2}),/R42_NON_MONOTONIC_GENERATION/);
  assert.throws(()=>commitR42Generation(v,{generation:1,sealed:s1}),/R42_NON_MONOTONIC_GENERATION/);
});

test('R42 blocks old but cryptographically valid candidate below high-water mark',()=>{
  const v=createR42Vault();
  const s1=sealedAt(10),s2=sealedAt(20),s3=sealedAt(30);
  commitR42Generation(v,{generation:1,sealed:s1});
  commitR42Generation(v,{generation:2,sealed:s2});
  commitR42Generation(v,{generation:3,sealed:s3});
  const x=validateR42Candidate(v,{generation:1,sealed:s1});
  assert.equal(x.accepted,false);
  assert.equal(x.reason,'R42_ROLLBACK_BLOCKED');
});

test('R42 falls back only one committed generation when latest is corrupted',()=>{
  const v=createR42Vault();
  const s1=sealedAt(10),s2=sealedAt(20),s3=sealedAt(30);
  commitR42Generation(v,{generation:1,sealed:s1});
  commitR42Generation(v,{generation:2,sealed:s2});
  commitR42Generation(v,{generation:3,sealed:s3});
  const broken=JSON.parse(JSON.stringify(v.active));
  broken.sealed.payload.streams[0].lastCommittedEpoch+=1;
  v.active=broken;
  const x=recoverR42Vault(v,{allowFallback:true});
  assert.equal(x.ok,true);
  assert.equal(x.usedFallback,true);
  assert.equal(x.generation,2);
  assert.equal(v.highWaterMark,3);
});

test('R42 fails closed if both latest and previous checkpoints are invalid',()=>{
  const v=createR42Vault();
  commitR42Generation(v,{generation:1,sealed:sealedAt(10)});
  commitR42Generation(v,{generation:2,sealed:sealedAt(20)});
  v.active={...v.active,sealed:{...v.active.sealed,payload:null}};
  v.previous={...v.previous,sealed:{...v.previous.sealed,payload:null}};
  const x=recoverR42Vault(v,{allowFallback:true});
  assert.equal(x.ok,false);
  assert.equal(x.failClosed,true);
  assert.equal(x.operationalAuthorization,false);
});

test('R42 integrated battery protects against rollback with zero execution',()=>{
  const x=runR42Battery({snapshots:[sealedAt(10),sealedAt(20),sealedAt(30)]});
  assert.equal(x.pass,true);
  assert.equal(x.oldValidSnapshotBlocked,true);
  assert.equal(x.corruptedLatestFallsBackOneGeneration,true);
  assert.equal(x.fallbackDoesNotLowerHighWaterMark,true);
  assert.equal(x.olderCandidateStillBlockedAfterFallback,true);
  assert.equal(x.ordersSent,0);
  assert.equal(x.paperOrdersSent,0);
  assert.equal(x.actualBrokerPnl,null);
  assert.equal(x.actualLossesAvoided,null);
  assert.equal(x.realTradeAccuracy,null);
});
