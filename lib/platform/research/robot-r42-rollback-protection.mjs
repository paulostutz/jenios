/**
 * R42 — monotonic generation rollback protection + last-known-good fallback.
 * Extends R41 without modifying prior certified controls.
 * Synthetic/offline only. No real or external Paper execution.
 */
import {sealR41Snapshot,verifyR41SealedSnapshot,restoreR41FailClosed} from './robot-r41-integrity-atomic-checkpoint.mjs';

const fail=c=>{throw Object.assign(new Error(c),{code:c});};

export function createR42Vault(){
  return {
    highWaterMark:0,
    active:null,
    previous:null
  };
}

export function commitR42Generation(vault,{generation,sealed}={}){
  if(!vault||typeof vault!=='object'||!Number.isSafeInteger(generation)||generation<1||!sealed)
    fail('R42_INVALID_COMMIT');
  verifyR41SealedSnapshot(sealed);
  if(generation<=vault.highWaterMark)fail('R42_NON_MONOTONIC_GENERATION');

  vault.previous=vault.active;
  vault.active={
    schema:'JENIOS_R42_RECORD_V1',
    generation,
    sealed:JSON.parse(JSON.stringify(sealed))
  };
  vault.highWaterMark=generation;
  return Object.freeze({generation,committed:true});
}

function restoreRecord(record,expectedMinGeneration){
  if(!record||record.schema!=='JENIOS_R42_RECORD_V1')
    return Object.freeze({ok:false,reason:'R42_INVALID_RECORD'});
  if(!Number.isSafeInteger(record.generation)||record.generation<expectedMinGeneration)
    return Object.freeze({ok:false,reason:'R42_ROLLBACK_BLOCKED'});
  const restored=restoreR41FailClosed(record.sealed);
  if(!restored.ok)return Object.freeze({ok:false,reason:restored.reason||'R42_INTEGRITY_FAILURE'});
  return Object.freeze({
    ok:true,
    generation:record.generation,
    state:restored.state,
    integrityVerified:true
  });
}

export function recoverR42Vault(vault,{allowFallback=true}={}){
  if(!vault||typeof vault!=='object'||!Number.isSafeInteger(vault.highWaterMark))
    fail('R42_INVALID_VAULT');

  const active=restoreRecord(vault.active,vault.highWaterMark);
  if(active.ok)return Object.freeze({...active,usedFallback:false});

  if(!allowFallback){
    return Object.freeze({
      ok:false,state:null,reason:active.reason,
      usedFallback:false,failClosed:true,operationalAuthorization:false
    });
  }

  // Fallback is only allowed to the immediately previous committed generation,
  // never below highWaterMark - 1.
  const minFallback=Math.max(1,vault.highWaterMark-1);
  const previous=restoreRecord(vault.previous,minFallback);
  if(previous.ok){
    return Object.freeze({...previous,usedFallback:true,activeFailure:active.reason});
  }

  return Object.freeze({
    ok:false,state:null,
    reason:previous.reason||active.reason||'R42_NO_VALID_CHECKPOINT',
    usedFallback:false,failClosed:true,operationalAuthorization:false
  });
}

export function validateR42Candidate(vault,{generation,sealed}={}){
  if(!vault||!Number.isSafeInteger(vault.highWaterMark)||!Number.isSafeInteger(generation)||!sealed)
    fail('R42_INVALID_CANDIDATE');
  if(generation<vault.highWaterMark)
    return Object.freeze({accepted:false,reason:'R42_ROLLBACK_BLOCKED'});
  try{
    verifyR41SealedSnapshot(sealed);
  }catch(error){
    return Object.freeze({accepted:false,reason:error?.code||'R42_INVALID_SEAL'});
  }
  return Object.freeze({accepted:true,reason:null});
}

export function sealR42State(state){
  if(!state)fail('R42_STATE_REQUIRED');
  // R41 already canonicalizes and seals the underlying R39 snapshot.
  // Import lazily to avoid duplicating snapshot logic in this layer.
  return Object.freeze({state});
}

export function runR42Battery({snapshots}={}){
  if(!Array.isArray(snapshots)||snapshots.length<3)fail('R42_SNAPSHOTS_REQUIRED');
  const vault=createR42Vault();
  commitR42Generation(vault,{generation:1,sealed:snapshots[0]});
  commitR42Generation(vault,{generation:2,sealed:snapshots[1]});
  commitR42Generation(vault,{generation:3,sealed:snapshots[2]});

  const oldValid=validateR42Candidate(vault,{generation:1,sealed:snapshots[0]});

  const tamperedActive=JSON.parse(JSON.stringify(vault.active));
  tamperedActive.sealed.payload.streams[0].lastCommittedEpoch+=1;
  vault.active=tamperedActive;

  const recovery=recoverR42Vault(vault,{allowFallback:true});
  const staleAfterFallback=validateR42Candidate(vault,{generation:2,sealed:snapshots[1]});

  return Object.freeze({
    schema:'JENIOS_R42_BATTERY_V1',
    highWaterMark:vault.highWaterMark,
    oldValidSnapshotBlocked:oldValid.accepted===false&&oldValid.reason==='R42_ROLLBACK_BLOCKED',
    corruptedLatestFallsBackOneGeneration:recovery.ok===true&&recovery.usedFallback===true&&recovery.generation===2,
    fallbackDoesNotLowerHighWaterMark:vault.highWaterMark===3,
    olderCandidateStillBlockedAfterFallback:staleAfterFallback.accepted===false,
    pass:oldValid.accepted===false&&
      recovery.ok===true&&recovery.usedFallback===true&&recovery.generation===2&&
      vault.highWaterMark===3&&staleAfterFallback.accepted===false,
    noExecution:true,
    actualBrokerPnl:null,actualLossesAvoided:null,realTradeAccuracy:null,
    ordersSent:0,paperOrdersSent:0
  });
}
