/**
 * R44 — five-replica partitions, split-brain defense and reconvergence.
 * Extends R43 without modifying prior certified controls.
 * Synthetic/offline only. No real or external Paper execution.
 */
import {verifyR41SealedSnapshot,restoreR41FailClosed} from './robot-r41-integrity-atomic-checkpoint.mjs';

const fail=c=>{throw Object.assign(new Error(c),{code:c});};

export function createR44Cluster(){
  return {
    highWaterMark:0,
    replicas:Array.from({length:5},(_,i)=>({id:'R'+(i+1),record:null,online:true})),
    partitions:[['R1','R2','R3','R4','R5']]
  };
}

function quorumSize(cluster){ return Math.floor(cluster.replicas.length/2)+1; }
function recKey(r){ return r?JSON.stringify({g:r.generation,c:r.sealed?.checksum||null}):null; }

export function setR44Partitions(cluster,partitions){
  if(!cluster||!Array.isArray(cluster.replicas)||!Array.isArray(partitions)||partitions.length<1)
    fail('R44_INVALID_PARTITIONS');
  const known=new Set(cluster.replicas.map(r=>r.id));
  const seen=new Set();
  for(const p of partitions){
    if(!Array.isArray(p)||p.length<1)fail('R44_INVALID_PARTITION');
    for(const id of p){
      if(!known.has(id)||seen.has(id))fail('R44_INVALID_PARTITION_MEMBER');
      seen.add(id);
    }
  }
  if(seen.size!==cluster.replicas.length)fail('R44_PARTITION_COVERAGE');
  cluster.partitions=partitions.map(p=>[...p]);
  return cluster.partitions;
}

function partitionFor(cluster,id){ return cluster.partitions.find(p=>p.includes(id))||[]; }

export function proposeR44Generation(cluster,{proposerId,generation,sealed}={}){
  if(!cluster||!Number.isSafeInteger(generation)||generation<1||!sealed||typeof proposerId!=='string')
    fail('R44_INVALID_PROPOSAL');
  verifyR41SealedSnapshot(sealed);
  if(generation<=cluster.highWaterMark)fail('R44_NON_MONOTONIC_GENERATION');
  const partition=partitionFor(cluster,proposerId);
  const quorum=quorumSize(cluster);
  if(partition.length<quorum){
    return Object.freeze({committed:false,reason:'R44_PARTITION_NO_MAJORITY',generation,written:0,quorum});
  }
  let written=0;
  for(const id of partition){
    const r=cluster.replicas.find(x=>x.id===id);
    if(r?.online){
      r.record={schema:'JENIOS_R44_RECORD_V1',generation,sealed:JSON.parse(JSON.stringify(sealed))};
      written++;
    }
  }
  if(written>=quorum){
    cluster.highWaterMark=generation;
    return Object.freeze({committed:true,generation,written,quorum});
  }
  return Object.freeze({committed:false,reason:'R44_INSUFFICIENT_ONLINE_QUORUM',generation,written,quorum});
}

export function recoverR44Cluster(cluster){
  if(!cluster||!Array.isArray(cluster.replicas))fail('R44_INVALID_CLUSTER');
  const quorum=quorumSize(cluster);
  const groups=new Map();
  for(const r of cluster.replicas){
    if(!r.online||!r.record)continue;
    if(r.record.generation<cluster.highWaterMark-1)continue;
    try{verifyR41SealedSnapshot(r.record.sealed);}catch{continue;}
    const key=recKey(r.record);
    const g=groups.get(key)||{record:r.record,ids:[]};
    g.ids.push(r.id); groups.set(key,g);
  }
  const candidates=[...groups.values()].filter(g=>g.ids.length>=quorum).sort((a,b)=>b.record.generation-a.record.generation);
  const best=candidates[0];
  if(!best){
    return Object.freeze({ok:false,state:null,reason:'R44_NO_CLUSTER_QUORUM',failClosed:true,operationalAuthorization:false});
  }
  const restored=restoreR41FailClosed(best.record.sealed);
  if(!restored.ok){
    return Object.freeze({ok:false,state:null,reason:restored.reason||'R44_RESTORE_FAILED',failClosed:true,operationalAuthorization:false});
  }
  return Object.freeze({
    ok:true,generation:best.record.generation,
    supportingReplicas:Object.freeze(best.ids),
    usedFallback:best.record.generation<cluster.highWaterMark,
    highWaterMark:cluster.highWaterMark,
    state:restored.state
  });
}

export function detectR44SplitBrain(cluster){
  const byGen=new Map();
  for(const r of cluster.replicas){
    if(!r.record)continue;
    const arr=byGen.get(r.record.generation)||[];
    arr.push({id:r.id,key:recKey(r.record)});
    byGen.set(r.record.generation,arr);
  }
  const divergent=[];
  for(const [generation,items] of byGen){
    if(new Set(items.map(x=>x.key)).size>1)divergent.push(generation);
  }
  return Object.freeze({hasSplitBrain:divergent.length>0,divergentGenerations:Object.freeze(divergent.sort((a,b)=>a-b))});
}

export function reconvergeR44(cluster){
  const recovery=recoverR44Cluster(cluster);
  if(!recovery.ok)return Object.freeze({ok:false,reason:recovery.reason});
  const source=cluster.replicas.find(r=>r.record?.generation===recovery.generation&&recKey(r.record)===recKey({
    generation:recovery.generation,
    sealed:cluster.replicas.find(x=>recovery.supportingReplicas.includes(x.id))?.record?.sealed
  }));
  const record=cluster.replicas.find(r=>recovery.supportingReplicas.includes(r.id))?.record;
  if(!record)return Object.freeze({ok:false,reason:'R44_NO_RECONVERGENCE_SOURCE'});
  for(const r of cluster.replicas){
    r.record=JSON.parse(JSON.stringify(record));
  }
  setR44Partitions(cluster,[cluster.replicas.map(r=>r.id)]);
  return Object.freeze({ok:true,generation:record.generation,replicasUpdated:cluster.replicas.length});
}

export function runR44Battery({sealedGenerations}={}){
  if(!Array.isArray(sealedGenerations)||sealedGenerations.length<3)fail('R44_GENERATIONS_REQUIRED');
  const c=createR44Cluster();
  proposeR44Generation(c,{proposerId:'R1',generation:1,sealed:sealedGenerations[0]});
  setR44Partitions(c,[['R1','R2'],['R3','R4','R5']]);
  const minority=proposeR44Generation(c,{proposerId:'R1',generation:2,sealed:sealedGenerations[1]});
  const majority=proposeR44Generation(c,{proposerId:'R3',generation:2,sealed:sealedGenerations[1]});

  const alt=JSON.parse(JSON.stringify(sealedGenerations[2]));
  // valid alternative payload/checksum pair would require resealing; instead copy generation-2 majority
  // then create divergent minority record at generation 2 with invalid checksum to test detection+quorum.
  c.replicas.find(r=>r.id==='R1').record={schema:'JENIOS_R44_RECORD_V1',generation:2,sealed:alt};
  c.replicas.find(r=>r.id==='R2').record={schema:'JENIOS_R44_RECORD_V1',generation:2,sealed:alt};
  const split=detectR44SplitBrain(c);
  const recovery=recoverR44Cluster(c);
  const reconverged=reconvergeR44(c);
  const after=recoverR44Cluster(c);

  return Object.freeze({
    schema:'JENIOS_R44_BATTERY_V1',
    minorityCannotPromote:minority.committed===false&&minority.reason==='R44_PARTITION_NO_MAJORITY',
    majorityCanPromote:majority.committed===true,
    splitBrainDetected:split.hasSplitBrain===true,
    clusterRecoversFromMajority:recovery.ok===true&&recovery.generation===2,
    reconvergesToSingleState:reconverged.ok===true&&after.ok===true&&after.supportingReplicas.length===5,
    highWaterMarkPreserved:after.highWaterMark===2,
    pass:minority.committed===false&&majority.committed===true&&split.hasSplitBrain===true&&
      recovery.ok===true&&recovery.generation===2&&reconverged.ok===true&&
      after.ok===true&&after.supportingReplicas.length===5&&after.highWaterMark===2,
    noExecution:true,
    actualBrokerPnl:null,actualLossesAvoided:null,realTradeAccuracy:null,
    ordersSent:0,paperOrdersSent:0
  });
}
