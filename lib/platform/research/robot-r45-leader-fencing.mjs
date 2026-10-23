/**
 * R45 — leader election + monotonic fencing token / lease.
 * Extends R44 without modifying prior certified controls.
 * Synthetic/offline only. No real or external Paper execution.
 */
const fail=c=>{throw Object.assign(new Error(c),{code:c});};

export function createR45Cluster({replicas=5}={}){
  if(!Number.isSafeInteger(replicas)||replicas<3||replicas%2===0)fail('R45_INVALID_REPLICA_COUNT');
  return {
    replicas:Array.from({length:replicas},(_,i)=>({id:'R'+(i+1),online:true})),
    term:0,
    leaderId:null,
    fencingToken:0,
    leaseEpoch:0,
    acceptedWrites:0,
    staleWriterBlocks:0,
    partitions:[Array.from({length:replicas},(_,i)=>'R'+(i+1))]
  };
}

function quorum(cluster){return Math.floor(cluster.replicas.length/2)+1;}
function partitionFor(cluster,id){return cluster.partitions.find(p=>p.includes(id))||[];}

export function setR45Partitions(cluster,parts){
  if(!cluster||!Array.isArray(parts)||parts.length<1)fail('R45_INVALID_PARTITIONS');
  const ids=new Set(cluster.replicas.map(r=>r.id));
  const seen=new Set();
  for(const p of parts){
    if(!Array.isArray(p)||p.length<1)fail('R45_INVALID_PARTITION');
    for(const id of p){
      if(!ids.has(id)||seen.has(id))fail('R45_INVALID_PARTITION_MEMBER');
      seen.add(id);
    }
  }
  if(seen.size!==ids.size)fail('R45_PARTITION_COVERAGE');
  cluster.partitions=parts.map(p=>[...p]);
}

export function electR45Leader(cluster,{candidateId}={}){
  if(!cluster||typeof candidateId!=='string')fail('R45_INVALID_ELECTION');
  const part=partitionFor(cluster,candidateId);
  const online=part.filter(id=>cluster.replicas.find(r=>r.id===id)?.online);
  if(online.length<quorum(cluster)){
    return Object.freeze({elected:false,reason:'R45_NO_QUORUM'});
  }
  cluster.term++;
  cluster.leaderId=candidateId;
  cluster.fencingToken++;
  cluster.leaseEpoch++;
  return Object.freeze({
    elected:true,
    leaderId:candidateId,
    term:cluster.term,
    fencingToken:cluster.fencingToken,
    leaseEpoch:cluster.leaseEpoch
  });
}

export function authorizeR45Write(cluster,{writerId,fencingToken,leaseEpoch}={}){
  if(!cluster||typeof writerId!=='string'||!Number.isSafeInteger(fencingToken)||!Number.isSafeInteger(leaseEpoch))
    fail('R45_INVALID_WRITE_AUTH');
  const part=partitionFor(cluster,writerId);
  const online=part.filter(id=>cluster.replicas.find(r=>r.id===id)?.online);
  const valid=
    writerId===cluster.leaderId &&
    fencingToken===cluster.fencingToken &&
    leaseEpoch===cluster.leaseEpoch &&
    online.length>=quorum(cluster);

  if(!valid){
    cluster.staleWriterBlocks++;
    return Object.freeze({allow:false,reason:'R45_STALE_OR_UNFENCED_WRITER'});
  }
  cluster.acceptedWrites++;
  return Object.freeze({allow:true});
}

export function renewR45Lease(cluster,{leaderId,fencingToken}={}){
  if(!cluster||leaderId!==cluster.leaderId||fencingToken!==cluster.fencingToken)
    return Object.freeze({renewed:false,reason:'R45_INVALID_LEASE_OWNER'});
  const part=partitionFor(cluster,leaderId);
  const online=part.filter(id=>cluster.replicas.find(r=>r.id===id)?.online);
  if(online.length<quorum(cluster))
    return Object.freeze({renewed:false,reason:'R45_LEASE_LOST_QUORUM'});
  cluster.leaseEpoch++;
  return Object.freeze({renewed:true,leaseEpoch:cluster.leaseEpoch});
}

export function runR45Battery(){
  const c=createR45Cluster({replicas:5});
  const first=electR45Leader(c,{candidateId:'R1'});
  const write1=authorizeR45Write(c,{
    writerId:'R1',
    fencingToken:first.fencingToken,
    leaseEpoch:first.leaseEpoch
  });

  setR45Partitions(c,[['R1','R2'],['R3','R4','R5']]);
  const lostRenew=renewR45Lease(c,{leaderId:'R1',fencingToken:first.fencingToken});
  const second=electR45Leader(c,{candidateId:'R3'});

  const staleWrite=authorizeR45Write(c,{
    writerId:'R1',
    fencingToken:first.fencingToken,
    leaseEpoch:first.leaseEpoch
  });
  const freshWrite=authorizeR45Write(c,{
    writerId:'R3',
    fencingToken:second.fencingToken,
    leaseEpoch:second.leaseEpoch
  });

  setR45Partitions(c,[['R1','R2','R3','R4','R5']]);
  const staleAfterReconvergence=authorizeR45Write(c,{
    writerId:'R1',
    fencingToken:first.fencingToken,
    leaseEpoch:first.leaseEpoch
  });
  const renewed=renewR45Lease(c,{leaderId:'R3',fencingToken:second.fencingToken});
  const writeAfterRenew=authorizeR45Write(c,{
    writerId:'R3',
    fencingToken:second.fencingToken,
    leaseEpoch:renewed.leaseEpoch
  });

  return Object.freeze({
    schema:'JENIOS_R45_BATTERY_V1',
    firstLeaderElected:first.elected===true,
    initialWriteAllowed:write1.allow===true,
    oldLeaderLosesLeaseWithoutQuorum:lostRenew.renewed===false,
    newMajorityLeaderElected:second.elected===true&&second.leaderId==='R3',
    fencingTokenAdvanced:second.fencingToken>first.fencingToken,
    staleWriterBlockedDuringPartition:staleWrite.allow===false,
    newLeaderWriteAllowed:freshWrite.allow===true,
    staleWriterBlockedAfterReconvergence:staleAfterReconvergence.allow===false,
    renewedLeaderWriteAllowed:writeAfterRenew.allow===true,
    staleWriterBlocks:c.staleWriterBlocks,
    pass:first.elected===true&&write1.allow===true&&lostRenew.renewed===false&&
      second.elected===true&&second.fencingToken>first.fencingToken&&
      staleWrite.allow===false&&freshWrite.allow===true&&
      staleAfterReconvergence.allow===false&&renewed.renewed===true&&writeAfterRenew.allow===true,
    noExecution:true,
    actualBrokerPnl:null,
    actualLossesAvoided:null,
    realTradeAccuracy:null,
    ordersSent:0,
    paperOrdersSent:0
  });
}
