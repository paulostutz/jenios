/** R85: read-only operational readiness, no worker activation or external orders. */
import {createR80PaperSafetyStore} from './paper-safety-store-r80.mjs';
import {PaperLedger} from '../pilot-prep/paper-ledger.mjs';
const deny=code=>{throw Object.assign(new Error(code),{code});};
export async function inspectR85PaperWorkerReadiness({
 ownerUserId,connectionId,session,storedConnection,ledger
},{db,env=process.env}={}){
 if(env.JENIOS_REAL_EXECUTION_ENABLED!=='false'||
    env.JENIOS_PRIVATE_PAPER_EXECUTOR!=='false'||
    env.JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED!=='false'||
    env.JENIOS_R80_PRIVATE_ISSUER_ENABLED!=='false'||
    env.JENIOS_R83_PRIVATE_NODE_WORKER!=='false')
  deny('R85_READINESS_MUST_BE_INERT');
 if(!session?.authenticated||session.userId!==ownerUserId||
    storedConnection?.id!==connectionId||storedConnection?.user_id!==ownerUserId||
    storedConnection?.environment!=='paper'||storedConnection?.provider!=='alpaca')
  deny('R85_OWNER_SCOPE_DENIED');
 if(!db?.rpc||!(ledger instanceof PaperLedger))
  deny('R85_DURABLE_DEPENDENCIES_REQUIRED');
 const safety=await createR80PaperSafetyStore(db).readSafety({ownerUserId,connectionId});
 if(!safety)return Object.freeze({ready:false,reason:'SAFETY_NOT_INITIALIZED',paperOnly:true,
  liveOrdersEnabled:false,ordersSent:0});
 // A paused or missing risk state is observable but cannot be promoted by this function.
 const eligible=safety.status==='ACTIVE'&&!safety.killSwitchEngaged&&
   safety.paperConsentEnabled===true&&safety.liveExecutionEnabled===false;
 return Object.freeze({ready:false,reason:eligible?'WORKER_NOT_DEPLOYED':'SAFETY_PAUSED',
  paperOnly:true,liveOrdersEnabled:false,ordersSent:0,
  requiresExternalPaperReceipt:true,requiresManualApproval:true});
}
