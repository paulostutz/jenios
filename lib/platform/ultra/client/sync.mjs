import {digest} from './journal.mjs';
/** The device token only uploads this robot's records; it cannot trade or read other accounts. */
export async function synchronizeOperations({ledger,token,provider,environment,runtimeState='monitoring',fetchImpl=fetch}){
 if(typeof token!=='string'||!/^ju_dev_[a-f0-9]{64}$/.test(token))throw Error('INVALID_SYNC_TOKEN');
 const device=digest(token),batch=ledger.outbox(device);
 const response=await fetchImpl('https://www.jenios.com.br/api/platform/ultra/telemetry',{method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({schema:'JENIOS_ULTRA_TELEMETRY_V1',provider,environment,runtimeState,connectionFingerprint:ledger.binding,operations:batch.map(x=>x.operation)})});
 if(!response.ok)throw Error(response.status===401?'SYNC_TOKEN_EXPIRED_OR_REVOKED':'SYNC_UNAVAILABLE');
 const result=await response.json();
 if(result.ok!==true||result.accepted!==batch.length)throw Error('SYNC_ACKNOWLEDGEMENT_INVALID');
 if(batch.length)ledger.acknowledge(device,batch.at(-1).seq);return {synced:batch.length};
}
