/** B293: read-only audit of declared private signal evidence. Never an executor. */
import {createHash} from 'node:crypto';
const fail=c=>{throw Object.assign(new Error(c),{code:c});};
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const modes=['manual','hybrid','reverse'];
export function inspectB293PrivateSignalEvidence(batch,{nowMs=Date.now()}={}){
 if(!batch||batch.schema!=='JENIOS_B293_PRIVATE_SIGNAL_EVIDENCE_V1'||
 !Array.isArray(batch.events)||batch.events.length<3||batch.events.length>10000||
 !Number.isSafeInteger(nowMs)||typeof batch.coreSha256!=='string'||
 !/^[a-f0-9]{64}$/.test(batch.coreSha256)||batch.readOnly!==true||
 batch.transportEnabled!==false)fail('B293_UNTRUSTED_BATCH');
 const ids=new Set(),counts={manual:0,hybrid:0,reverse:0};
 for(const e of batch.events){
  if(!e||!modes.includes(e.mode)||typeof e.id!=='string'||
  !/^[A-Za-z0-9._-]{1,80}$/.test(e.id)||ids.has(e.id)||
  !Number.isSafeInteger(e.emittedAtMs)||!Number.isSafeInteger(e.targetOpenMs)||
  e.emittedAtMs>=e.targetOpenMs||e.targetOpenMs>nowMs+86400000||
  !['UP','DOWN','ABSTAIN'].includes(e.direction)||
  e.orderSubmitted!==false||e.privateSourceAttested!==false)
   fail('B293_INVALID_SIGNAL_EVENT');
  ids.add(e.id);counts[e.mode]++;
 }
 if(Object.values(counts).some(x=>x===0))fail('B293_INCOMPLETE_MODES');
 const body={schema:batch.schema,coreSha256:batch.coreSha256,
  readOnly:batch.readOnly,transportEnabled:batch.transportEnabled,events:batch.events};
 if(sha(body)!==batch.sha256)fail('B293_EVIDENCE_TAMPERED');
 return Object.freeze({schema:'JENIOS_B293_PRIVATE_SIGNAL_READINESS_V1',
  counts,total:batch.events.length,batchSha256:batch.sha256,
  declaredCoreSha256:batch.coreSha256,
  executableBytesVerified:false,independentOriginAttested:false,
  deliveryVerified:false,operatorOrderFeedVerified:false,
  realSignalEmissionVerified:false,lossesNeutralizedVerified:false,
  ordersSent:0,realExecutionEnabled:false,performanceCertified:false,
  status:'DECLARED_UNATTESTED_EVENTS_REQUIRE_PRIVATE_RUNNER'});
}
