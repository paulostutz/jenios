/** JENIOS R95 — offline private-host storage continuity probe.
 * It runs no strategy, provider network, recovery, or order dispatcher.
 * Filesystem reopen in one process is NOT proof of disk persistence across deploys.
 */
import {statSync} from 'node:fs';
import {inspectR94PrivateHost,openR94PrivateJournal} from './private-host-preflight-r94.mjs';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const deny=code=>{throw Object.assign(new Error(code),{code});};
export function runR95OfflineStorageProbe({env=process.env,volumePath,canaryConnectionId}={}){
 if(env.VERCEL==='1'||env.VERCEL_ENV!==undefined||
    env.JENIOS_R95_OFFLINE_STORAGE_PROBE_ENABLED!=='true'||
    env.JENIOS_R95_PRIVATE_RUNTIME_CLASS!=='isolated-node')
    deny('R95_NOT_ISOLATED_PRIVATE_NODE');
 if(!UUID.test(canaryConnectionId||''))deny('R95_CANARY_UUID_REQUIRED');
 // R94 enforces that EVERY external order/billing flag is explicitly false.
 const host=inspectR94PrivateHost({env,volumePath});
 let opened,reopened,path;
 try{
  opened=openR94PrivateJournal({env,volumePath,connectionId:canaryConnectionId});
  path=opened.storagePath;
  if(typeof opened.journal?.pendingRecovery!=='function')
   deny('R95_DURABLE_LEDGER_CONTRACT_MISSING');
  opened.close();opened=null;
  const stat=statSync(path);
  if(!stat.isFile()||(stat.mode&0o077)!==0||stat.size<=0)
   deny('R95_JOURNAL_STORAGE_INVALID');
  reopened=openR94PrivateJournal({env,volumePath,connectionId:canaryConnectionId});
  if(reopened.storagePath!==path||
     typeof reopened.journal?.pendingRecovery!=='function')
   deny('R95_JOURNAL_REOPEN_FAILED');
  return Object.freeze({schema:'JENIOS_R95_OFFLINE_STORAGE_PROBE_V1',
   localSqliteReopenVerified:true,storagePermissionsVerified:true,
   actualPersistentMountCertified:false,
   restoreAfterDeploymentCertified:false,
   workerDeployed:false,providerAuthenticated:false,
   customerSessionAuthenticated:false,liveExecution:false,
   paperOrderExecution:false,brokerCalls:0,ordersSent:0,
   custody:false,paymentsEnabled:false,
   requiresIndependentInfrastructureApproval:true});
 }catch(error){
  if(error?.code)throw error;
  deny('R95_LOCAL_STORAGE_PROBE_FAILED');
 }finally{
  try{reopened?.close();}catch{}
  try{opened?.close();}catch{}
 }
}
