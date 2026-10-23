/**
 * R43 — replicated checkpoint quorum + divergence detection.
 * Extends R42 without modifying prior certified controls.
 * Synthetic/offline only. No real or external Paper execution.
 */
import {verifyR41SealedSnapshot,restoreR41FailClosed} from './robot-r41-integrity-atomic-checkpoint.mjs';

const fail=c=>{throw Object.assign(new Error(c),{code:c});};

export function createR43ReplicaSet({replicas=3}={}){
  if(!Number.isSafeInteger(replicas)||replicas<3||replicas>9||replicas%2===0)fail('R43_INVALID_REPLICA_COUNT');
  return {
    highWaterMark:0,
    replicas:Array.from({length:replicas},(_,i)=>({id:'R'+(i+1),record:null}))
  };
}

function fingerprintRecord(record){
  if(!record)return null;
  return JSON.stringify({
    generation:record.generation,
    checksum:record.sealed?.checksum||null,
    schema:record.schema||null
  });
}

export function writeR43Replicas(set,{generation,sealed,targetIds=null}={}){
  if(!set||!Array.isArray(set.replicas)||!Number.isSafeInteger(generation)||generation<1||!sealed)
    fail('R43_INVALID_WRITE');
  verifyR41SealedSnapshot(sealed);
  if(generation<=set.highWaterMark)fail('R43_NON_MONOTONIC_GENERATION');
  const ids=targetIds??set.replicas.map(r=>r.id);
  const chosen=new Set(ids);
  for(const r of set.replicas){
    if(chosen.has(r.id)){
      r.record={schema:'JENIOS_R43_RECORD_V1',generation,sealed:JSON.parse(JSON.stringify(sealed))};
    }
  }
  const quorum=Math.floor(set.replicas.length/2)+1;
  const written=set.replicas.filter(r=>r.record?.generation===generation).length;
  if(written>=quorum)set.highWaterMark=generation;
  return Object.freeze({generation,written,quorum,committed:written>=quorum});
}

export function recoverR43Quorum(set){
  if(!set||!Array.isArray(set.replicas)||!Number.isSafeInteger(set.highWaterMark))
    fail('R43_INVALID_SET');
  const quorum=Math.floor(set.replicas.length/2)+1;
  const groups=new Map();

  for(const replica of set.replicas){
    const record=replica.record;
    if(!record)continue;
    if(record.schema!=='JENIOS_R43_RECORD_V1')continue;
    if(record.generation<set.highWaterMark-1)continue;
    try{ verifyR41SealedSnapshot(record.sealed); }catch{ continue; }
    const key=fingerprintRecord(record);
    const g=groups.get(key)||{record,replicas:[]};
    g.replicas.push(replica.id);
    groups.set(key,g);
  }

  const candidates=[...groups.values()]
    .filter(g=>g.replicas.length>=quorum)
    .sort((a,b)=>b.record.generation-a.record.generation);

  const best=candidates[0];
  if(!best){
    return Object.freeze({
      ok:false,state:null,reason:'R43_NO_QUORUM',
      failClosed:true,operationalAuthorization:false
    });
  }

  if(best.record.generation<set.highWaterMark-1){
    return Object.freeze({
      ok:false,state:null,reason:'R43_ROLLBACK_BEYOND_FALLBACK',
      failClosed:true,operationalAuthorization:false
    });
  }

  const restored=restoreR41FailClosed(best.record.sealed);
  if(!restored.ok){
    return Object.freeze({
      ok:false,state:null,reason:restored.reason||'R43_RESTORE_FAILED',
      failClosed:true,operationalAuthorization:false
    });
  }

  return Object.freeze({
    ok:true,
    generation:best.record.generation,
    supportingReplicas:Object.freeze(best.replicas),
    usedFallback:best.record.generation<set.highWaterMark,
    highWaterMark:set.highWaterMark,
    state:restored.state
  });
}

export function detectR43Divergence(set){
  if(!set||!Array.isArray(set.replicas))fail('R43_INVALID_SET');
  const valid=set.replicas.map(r=>({
    id:r.id,
    generation:r.record?.generation??null,
    fingerprint:fingerprintRecord(r.record)
  }));
  const byGeneration=new Map();
  for(const x of valid){
    if(x.generation===null)continue;
    const arr=byGeneration.get(x.generation)||[];
    arr.push(x);
    byGeneration.set(x.generation,arr);
  }
  const divergent=[];
  for(const [generation,items] of byGeneration){
    const fps=new Set(items.map(x=>x.fingerprint));
    if(fps.size>1)divergent.push(generation);
  }
  return Object.freeze({
    divergentGenerations:Object.freeze(divergent.sort((a,b)=>a-b)),
    hasDivergence:divergent.length>0
  });
}

export function runR43Battery({sealedGenerations}={}){
  if(!Array.isArray(sealedGenerations)||sealedGenerations.length<3)fail('R43_GENERATIONS_REQUIRED');
  const set=createR43ReplicaSet({replicas:3});
  writeR43Replicas(set,{generation:1,sealed:sealedGenerations[0]});
  writeR43Replicas(set,{generation:2,sealed:sealedGenerations[1]});
  writeR43Replicas(set,{generation:3,sealed:sealedGenerations[2]});

  // Corrupt active replica R1 and delete R2 active copy; quorum for gen3 disappears.
  const broken=JSON.parse(JSON.stringify(set.replicas[0].record));
  broken.sealed.payload.streams[0].lastCommittedEpoch+=1;
  set.replicas[0].record=broken;
  set.replicas[1].record={schema:'JENIOS_R43_RECORD_V1',generation:2,sealed:JSON.parse(JSON.stringify(sealedGenerations[1]))};
  set.replicas[2].record={schema:'JENIOS_R43_RECORD_V1',generation:2,sealed:JSON.parse(JSON.stringify(sealedGenerations[1]))};

  const fallback=recoverR43Quorum(set);

  // Create divergence at generation 3 across replicas without quorum.
  set.replicas[0].record={schema:'JENIOS_R43_RECORD_V1',generation:3,sealed:JSON.parse(JSON.stringify(sealedGenerations[2]))};
  const alt=JSON.parse(JSON.stringify(sealedGenerations[2]));
  alt.payload.streams[0].lastCommittedEpoch+=2;
  alt.checksum='0'.repeat(64);
  set.replicas[1].record={schema:'JENIOS_R43_RECORD_V1',generation:3,sealed:alt};
  set.replicas[2].record={schema:'JENIOS_R43_RECORD_V1',generation:2,sealed:JSON.parse(JSON.stringify(sealedGenerations[1]))};
  const divergence=detectR43Divergence(set);
  const noQuorum=recoverR43Quorum(set);

  return Object.freeze({
    schema:'JENIOS_R43_BATTERY_V1',
    fallbackToPreviousQuorum:fallback.ok===true&&fallback.generation===2&&fallback.usedFallback===true,
    highWaterMarkPreserved:fallback.highWaterMark===3,
    divergenceDetected:divergence.hasDivergence===true,
    noQuorumFailsClosed:noQuorum.ok===false&&noQuorum.failClosed===true,
    pass:fallback.ok===true&&fallback.generation===2&&fallback.usedFallback===true&&
      fallback.highWaterMark===3&&divergence.hasDivergence===true&&
      noQuorum.ok===false&&noQuorum.failClosed===true,
    noExecution:true,
    actualBrokerPnl:null,actualLossesAvoided:null,realTradeAccuracy:null,
    ordersSent:0,paperOrdersSent:0
  });
}
