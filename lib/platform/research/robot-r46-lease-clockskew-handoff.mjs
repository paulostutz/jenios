/**
 * R46 — lease expiry, clock-skew defense, GC stall and leader handoff/crash recovery.
 * Extends R45 without modifying prior certified controls.
 * Synthetic/offline only. No real or external Paper execution.
 */
const fail=c=>{throw Object.assign(new Error(c),{code:c});};

export function createR46Cluster({replicas=5,leaseDurationMs=5000,maxClockSkewMs=1500}={}){
  if(!Number.isSafeInteger(replicas)||replicas<3||replicas%2===0||
     !Number.isSafeInteger(leaseDurationMs)||leaseDurationMs<100||
     !Number.isSafeInteger(maxClockSkewMs)||maxClockSkewMs<0||maxClockSkewMs>=leaseDurationMs)
    fail('R46_INVALID_CONFIG');
  return {
    replicas:Array.from({length:replicas},(_,i)=>({
      id:'R'+(i+1),online:true,localClockOffsetMs:0
    })),
    partitions:[Array.from({length:replicas},(_,i)=>'R'+(i+1))],
    term:0,leaderId:null,fencingToken:0,
    authorityTimeMs:0,leaseDurationMs,maxClockSkewMs,
    lease:{ownerId:null,fencingToken:0,notBeforeMs:0,expiresAtMs:0},
    acceptedWrites:0,staleWriterBlocks:0,expiredLeaseBlocks:0,
    handoffs:0,crashRecoveries:0
  };
}

function quorum(c){return Math.floor(c.replicas.length/2)+1;}
function partitionFor(c,id){return c.partitions.find(p=>p.includes(id))||[];}
function onlineInPartition(c,id){
  return partitionFor(c,id).filter(x=>c.replicas.find(r=>r.id===x)?.online);
}
function node(c,id){return c.replicas.find(r=>r.id===id);}

export function setR46Partitions(c,parts){
  if(!c||!Array.isArray(parts)||parts.length<1)fail('R46_INVALID_PARTITIONS');
  const known=new Set(c.replicas.map(r=>r.id)); const seen=new Set();
  for(const p of parts){
    if(!Array.isArray(p)||p.length<1)fail('R46_INVALID_PARTITION');
    for(const id of p){
      if(!known.has(id)||seen.has(id))fail('R46_INVALID_PARTITION_MEMBER');
      seen.add(id);
    }
  }
  if(seen.size!==known.size)fail('R46_PARTITION_COVERAGE');
  c.partitions=parts.map(p=>[...p]);
}

export function setR46ClockOffset(c,{nodeId,offsetMs}={}){
  if(!c||typeof nodeId!=='string'||!Number.isSafeInteger(offsetMs))fail('R46_INVALID_CLOCK_OFFSET');
  const n=node(c,nodeId); if(!n)fail('R46_UNKNOWN_NODE');
  n.localClockOffsetMs=offsetMs;
  return Object.freeze({nodeId,offsetMs});
}

export function advanceR46AuthorityTime(c,deltaMs){
  if(!c||!Number.isSafeInteger(deltaMs)||deltaMs<0)fail('R46_INVALID_TIME_ADVANCE');
  c.authorityTimeMs+=deltaMs;
  return c.authorityTimeMs;
}

export function readR46LocalTime(c,nodeId){
  const n=node(c,nodeId); if(!n)fail('R46_UNKNOWN_NODE');
  return c.authorityTimeMs+n.localClockOffsetMs;
}

function issueLease(c,leaderId){
  c.term++;
  c.leaderId=leaderId;
  c.fencingToken++;
  const notBefore=c.authorityTimeMs;
  c.lease={
    ownerId:leaderId,
    fencingToken:c.fencingToken,
    notBeforeMs:notBefore,
    expiresAtMs:notBefore+c.leaseDurationMs
  };
  return Object.freeze({
    elected:true,leaderId,term:c.term,fencingToken:c.fencingToken,
    notBeforeMs:c.lease.notBeforeMs,expiresAtMs:c.lease.expiresAtMs
  });
}

export function electR46Leader(c,{candidateId}={}){
  if(!c||typeof candidateId!=='string')fail('R46_INVALID_ELECTION');
  if(onlineInPartition(c,candidateId).length<quorum(c))
    return Object.freeze({elected:false,reason:'R46_NO_QUORUM'});
  return issueLease(c,candidateId);
}

export function renewR46Lease(c,{leaderId,fencingToken}={}){
  if(!c||leaderId!==c.leaderId||fencingToken!==c.fencingToken)
    return Object.freeze({renewed:false,reason:'R46_INVALID_LEASE_OWNER'});
  if(onlineInPartition(c,leaderId).length<quorum(c))
    return Object.freeze({renewed:false,reason:'R46_LEASE_LOST_QUORUM'});
  if(c.authorityTimeMs>c.lease.expiresAtMs)
    return Object.freeze({renewed:false,reason:'R46_LEASE_ALREADY_EXPIRED'});
  c.lease={
    ownerId:leaderId,
    fencingToken,
    notBeforeMs:c.authorityTimeMs,
    expiresAtMs:c.authorityTimeMs+c.leaseDurationMs
  };
  return Object.freeze({renewed:true,expiresAtMs:c.lease.expiresAtMs});
}

export function authorizeR46Write(c,{writerId,fencingToken,observedLocalTimeMs}={}){
  if(!c||typeof writerId!=='string'||!Number.isSafeInteger(fencingToken)||
     !Number.isSafeInteger(observedLocalTimeMs))fail('R46_INVALID_WRITE_AUTH');
  const n=node(c,writerId); if(!n)fail('R46_UNKNOWN_NODE');
  const skew=Math.abs(observedLocalTimeMs-c.authorityTimeMs);
  const leaseExpired=c.authorityTimeMs>c.lease.expiresAtMs;
  const valid=
    writerId===c.leaderId &&
    fencingToken===c.fencingToken &&
    c.lease.ownerId===writerId &&
    c.lease.fencingToken===fencingToken &&
    !leaseExpired &&
    skew<=c.maxClockSkewMs &&
    onlineInPartition(c,writerId).length>=quorum(c);

  if(!valid){
    c.staleWriterBlocks++;
    if(leaseExpired)c.expiredLeaseBlocks++;
    return Object.freeze({
      allow:false,
      reason:leaseExpired?'R46_LEASE_EXPIRED':
        skew>c.maxClockSkewMs?'R46_CLOCK_SKEW_EXCEEDED':'R46_STALE_OR_UNFENCED_WRITER',
      skewMs:skew
    });
  }
  c.acceptedWrites++;
  return Object.freeze({allow:true,skewMs:skew});
}

export function simulateR46GcStall(c,{leaderId,stallMs}={}){
  if(!c||typeof leaderId!=='string'||!Number.isSafeInteger(stallMs)||stallMs<0)
    fail('R46_INVALID_STALL');
  const before=readR46LocalTime(c,leaderId);
  advanceR46AuthorityTime(c,stallMs);
  const after=readR46LocalTime(c,leaderId);
  return Object.freeze({leaderId,stallMs,beforeLocalTimeMs:before,afterLocalTimeMs:after});
}

export function gracefulR46Handoff(c,{fromLeaderId,toLeaderId}={}){
  if(!c||fromLeaderId!==c.leaderId||typeof toLeaderId!=='string')
    return Object.freeze({handedOff:false,reason:'R46_INVALID_HANDOFF'});
  if(onlineInPartition(c,toLeaderId).length<quorum(c))
    return Object.freeze({handedOff:false,reason:'R46_TARGET_NO_QUORUM'});
  // Revoke current lease immediately, then issue a higher fencing token.
  c.lease.expiresAtMs=c.authorityTimeMs-1;
  const next=issueLease(c,toLeaderId);
  c.handoffs++;
  return Object.freeze({handedOff:true,...next});
}

export function crashR46Leader(c,{leaderId}={}){
  if(!c||typeof leaderId!=='string')fail('R46_INVALID_CRASH');
  const n=node(c,leaderId); if(!n)fail('R46_UNKNOWN_NODE');
  n.online=false;
  if(c.leaderId===leaderId){
    c.lease.expiresAtMs=Math.min(c.lease.expiresAtMs,c.authorityTimeMs);
  }
  return Object.freeze({crashed:true,leaderId});
}

export function recoverR46AfterCrash(c,{candidateId}={}){
  const elected=electR46Leader(c,{candidateId});
  if(elected.elected)c.crashRecoveries++;
  return elected;
}

export function runR46Battery(){
  const c=createR46Cluster({replicas:5,leaseDurationMs:5000,maxClockSkewMs:1500});
  const first=electR46Leader(c,{candidateId:'R1'});
  const initialWrite=authorizeR46Write(c,{
    writerId:'R1',fencingToken:first.fencingToken,
    observedLocalTimeMs:readR46LocalTime(c,'R1')
  });

  setR46ClockOffset(c,{nodeId:'R1',offsetMs:1200});
  const skewWithin=authorizeR46Write(c,{
    writerId:'R1',fencingToken:first.fencingToken,
    observedLocalTimeMs:readR46LocalTime(c,'R1')
  });

  setR46ClockOffset(c,{nodeId:'R1',offsetMs:2200});
  const skewTooLarge=authorizeR46Write(c,{
    writerId:'R1',fencingToken:first.fencingToken,
    observedLocalTimeMs:readR46LocalTime(c,'R1')
  });

  setR46ClockOffset(c,{nodeId:'R1',offsetMs:-1200});
  simulateR46GcStall(c,{leaderId:'R1',stallMs:6000});
  const afterStall=authorizeR46Write(c,{
    writerId:'R1',fencingToken:first.fencingToken,
    observedLocalTimeMs:readR46LocalTime(c,'R1')
  });

  const second=electR46Leader(c,{candidateId:'R2'});
  const staleR1=authorizeR46Write(c,{
    writerId:'R1',fencingToken:first.fencingToken,
    observedLocalTimeMs:readR46LocalTime(c,'R1')
  });
  const freshR2=authorizeR46Write(c,{
    writerId:'R2',fencingToken:second.fencingToken,
    observedLocalTimeMs:readR46LocalTime(c,'R2')
  });

  const handoff=gracefulR46Handoff(c,{fromLeaderId:'R2',toLeaderId:'R3'});
  const staleR2=authorizeR46Write(c,{
    writerId:'R2',fencingToken:second.fencingToken,
    observedLocalTimeMs:readR46LocalTime(c,'R2')
  });
  const freshR3=authorizeR46Write(c,{
    writerId:'R3',fencingToken:handoff.fencingToken,
    observedLocalTimeMs:readR46LocalTime(c,'R3')
  });

  crashR46Leader(c,{leaderId:'R3'});
  const recovered= recoverR46AfterCrash(c,{candidateId:'R4'});
  const staleR3=authorizeR46Write(c,{
    writerId:'R3',fencingToken:handoff.fencingToken,
    observedLocalTimeMs:readR46LocalTime(c,'R3')
  });
  const freshR4=authorizeR46Write(c,{
    writerId:'R4',fencingToken:recovered.fencingToken,
    observedLocalTimeMs:readR46LocalTime(c,'R4')
  });

  return Object.freeze({
    schema:'JENIOS_R46_BATTERY_V1',
    initialWriteAllowed:initialWrite.allow===true,
    boundedClockSkewAllowed:skewWithin.allow===true,
    excessiveClockSkewBlocked:skewTooLarge.allow===false&&skewTooLarge.reason==='R46_CLOCK_SKEW_EXCEEDED',
    gcStallExpiresLease:afterStall.allow===false&&afterStall.reason==='R46_LEASE_EXPIRED',
    newLeaderFencingAdvances:second.fencingToken>first.fencingToken,
    staleOldLeaderBlocked:staleR1.allow===false,
    newLeaderWriteAllowed:freshR2.allow===true,
    gracefulHandoffAdvancesFence:handoff.handedOff===true&&handoff.fencingToken>second.fencingToken,
    oldLeaderBlockedAfterHandoff:staleR2.allow===false,
    handoffLeaderAllowed:freshR3.allow===true,
    crashRecoveryAdvancesFence:recovered.elected===true&&recovered.fencingToken>handoff.fencingToken,
    crashedLeaderBlocked:staleR3.allow===false,
    recoveredLeaderAllowed:freshR4.allow===true,
    pass:initialWrite.allow===true&&skewWithin.allow===true&&skewTooLarge.allow===false&&
      afterStall.allow===false&&second.fencingToken>first.fencingToken&&staleR1.allow===false&&
      freshR2.allow===true&&handoff.handedOff===true&&staleR2.allow===false&&freshR3.allow===true&&
      recovered.elected===true&&staleR3.allow===false&&freshR4.allow===true,
    noExecution:true,
    actualBrokerPnl:null,actualLossesAvoided:null,realTradeAccuracy:null,
    ordersSent:0,paperOrdersSent:0
  });
}
