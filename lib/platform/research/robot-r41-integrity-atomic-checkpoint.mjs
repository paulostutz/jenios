/**
 * R41 — cryptographic integrity + atomic checkpoint protocol.
 * Extends R40 without modifying prior certified controls.
 * Synthetic/offline only. No real or external Paper execution.
 */
import {createHash} from 'node:crypto';
import {snapshotR39} from './robot-r39-state-restore-session-rotation.mjs';
import {validateR40Snapshot,restoreR40FailClosed} from './robot-r40-failclosed-snapshot.mjs';

const fail=c=>{throw Object.assign(new Error(c),{code:c});};

function stable(value){
  if(Array.isArray(value))return '['+value.map(stable).join(',')+']';
  if(value&&typeof value==='object'){
    return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stable(value[k])).join(',')+'}';
  }
  return JSON.stringify(value);
}

export function checksumR41(payload){
  return createHash('sha256').update(stable(payload)).digest('hex');
}

export function sealR41Snapshot(snapshot){
  validateR40Snapshot(snapshot);
  const payload=JSON.parse(JSON.stringify(snapshot));
  return Object.freeze({
    schema:'JENIOS_R41_SEALED_SNAPSHOT_V1',
    algorithm:'sha256',
    payload,
    checksum:checksumR41(payload)
  });
}

export function verifyR41SealedSnapshot(sealed){
  if(!sealed||sealed.schema!=='JENIOS_R41_SEALED_SNAPSHOT_V1')
    fail('R41_INCOMPATIBLE_SEALED_VERSION');
  if(sealed.algorithm!=='sha256'||typeof sealed.checksum!=='string'||sealed.checksum.length!==64)
    fail('R41_INVALID_INTEGRITY_METADATA');
  if(!sealed.payload||typeof sealed.payload!=='object')
    fail('R41_TRUNCATED_SNAPSHOT');
  const actual=checksumR41(sealed.payload);
  if(actual!==sealed.checksum)fail('R41_CHECKSUM_MISMATCH');
  validateR40Snapshot(sealed.payload);
  return true;
}

export function restoreR41FailClosed(sealed){
  try{
    verifyR41SealedSnapshot(sealed);
    const restored=restoreR40FailClosed(sealed.payload);
    if(!restored.ok)fail(restored.reason||'R41_INNER_RESTORE_FAILED');
    return Object.freeze({ok:true,state:restored.state,reason:null,integrityVerified:true});
  }catch(error){
    return Object.freeze({
      ok:false,state:null,
      reason:error?.code||'R41_RESTORE_FAILED',
      integrityVerified:false,
      operationalAuthorization:false,
      failClosed:true
    });
  }
}

export function createR41CheckpointSlots(){
  return {active:null,staging:null,generation:0};
}

export function stageR41Checkpoint(slots,state){
  if(!slots||typeof slots!=='object'||!state)fail('R41_INVALID_CHECKPOINT_ARGS');
  const sealed=sealR41Snapshot(snapshotR39(state));
  slots.staging={
    schema:'JENIOS_R41_CHECKPOINT_RECORD_V1',
    generation:slots.generation+1,
    phase:'STAGED',
    sealed
  };
  return Object.freeze({generation:slots.staging.generation,phase:'STAGED'});
}

export function commitR41Checkpoint(slots){
  if(!slots?.staging||slots.staging.phase!=='STAGED')fail('R41_NO_STAGED_CHECKPOINT');
  verifyR41SealedSnapshot(slots.staging.sealed);
  slots.active={
    ...slots.staging,
    phase:'COMMITTED'
  };
  slots.generation=slots.active.generation;
  slots.staging=null;
  return Object.freeze({generation:slots.generation,phase:'COMMITTED'});
}

export function recoverR41Checkpoint(slots){
  if(!slots||typeof slots!=='object')fail('R41_INVALID_SLOTS');
  // Never recover from an uncommitted staging record.
  if(!slots.active){
    return Object.freeze({ok:false,state:null,reason:'R41_NO_COMMITTED_CHECKPOINT',failClosed:true,operationalAuthorization:false});
  }
  if(slots.active.phase!=='COMMITTED'){
    return Object.freeze({ok:false,state:null,reason:'R41_ACTIVE_NOT_COMMITTED',failClosed:true,operationalAuthorization:false});
  }
  return restoreR41FailClosed(slots.active.sealed);
}

export function simulateR41InterruptedWrite({state,interruptAt='after_stage'}={}){
  const slots=createR41CheckpointSlots();
  stageR41Checkpoint(slots,state);
  if(interruptAt==='after_stage'){
    return Object.freeze({slots,recovery:recoverR41Checkpoint(slots)});
  }
  if(interruptAt==='after_commit'){
    commitR41Checkpoint(slots);
    return Object.freeze({slots,recovery:recoverR41Checkpoint(slots)});
  }
  fail('R41_INVALID_INTERRUPT_POINT');
}

export function runR41Battery(state){
  if(!state)fail('R41_STATE_REQUIRED');
  const sealed=sealR41Snapshot(snapshotR39(state));
  const tampered=JSON.parse(JSON.stringify(sealed));
  tampered.payload.streams[0].lastCommittedEpoch+=1;
  const truncated={...sealed,payload:null};

  const tamper=restoreR41FailClosed(tampered);
  const trunc=restoreR41FailClosed(truncated);
  const interrupted=simulateR41InterruptedWrite({state,interruptAt:'after_stage'});
  const committed=simulateR41InterruptedWrite({state,interruptAt:'after_commit'});

  return Object.freeze({
    schema:'JENIOS_R41_BATTERY_V1',
    tamperBlocked:tamper.ok===false&&tamper.failClosed===true,
    truncationBlocked:trunc.ok===false&&trunc.failClosed===true,
    interruptedStageNotRecoverable:interrupted.recovery.ok===false,
    committedCheckpointRecoverable:committed.recovery.ok===true,
    checksumVerifiedOnCommitted:committed.recovery.integrityVerified===true,
    pass:tamper.ok===false&&trunc.ok===false&&
      interrupted.recovery.ok===false&&committed.recovery.ok===true,
    noExecution:true,
    actualBrokerPnl:null,actualLossesAvoided:null,realTradeAccuracy:null,
    ordersSent:0,paperOrdersSent:0
  });
}
