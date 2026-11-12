/** R93: private GET-only recovery coordinator.
 * Composes the EXISTING B152/B165/B167/B175/R80 modules.
 * Not a worker runner, public HTTP route or order transmitter.
 */
import {PaperLedger} from '../pilot-prep/paper-ledger.mjs';
import {demoStore} from './demo-store.mjs';
import {decryptDemo,vaultReady} from './demo-vault.mjs';
import {alpacaPaperLedgerConnection} from './alpaca-paper-risk-rehearsal.mjs';
import {createR80PaperSafetyStore} from './paper-safety-store-r80.mjs';
import {recoverR80PaperAfterRestart} from './paper-worker-recovery-r80.mjs';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const TOKEN=/^[A-Za-z0-9_.-]{20,4096}$/;
const KEY=/^[A-Za-z0-9_+/=-]{16,256}$/;
const deny=code=>{throw Object.assign(new Error(code),{code});};
function privateGate(e){
 if(e.VERCEL_ENV!=='preview'||e.JENIOS_R93_PRIVATE_NODE_WORKER!=='true'||
    e.JENIOS_R93_READONLY_RECOVERY_ENABLED!=='true'||
    e.JENIOS_REAL_EXECUTION_ENABLED!=='false'||
    e.JENIOS_PRIVATE_PAPER_REHEARSAL!=='true'||
    e.JENIOS_PRIVATE_PAPER_RECOVERY_ENABLED!=='true'||
    e.JENIOS_PRIVATE_PAPER_EXECUTOR!=='false'||
    e.JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED!=='false'||
    e.JENIOS_R80_PRIVATE_ISSUER_ENABLED!=='false'||
    e.JENIOS_R82_ALPACA_LIVE_ORDER_EXECUTION_ENABLED!=='false'||
    e.JENIOS_R83_PRIVATE_NODE_WORKER!=='false'||
    e.JENIOS_PAY_PAYMENTS_ENABLED!=='false'||
    e.JENIOS_DEMO_CONNECTORS_ENABLED!=='true')deny('R93_PRIVATE_READONLY_DISABLED');
 if(!vaultReady(e))deny('R93_VAULT_REQUIRED');
}
async function ownerFromAuth(db,token){
 if(!db?.auth?.getUser||typeof db.from!=='function'||typeof db.rpc!=='function'||
    typeof token!=='string'||!TOKEN.test(token))deny('R93_AUTH_REQUIRED');
 let response;
 try{response=await db.auth.getUser(token);}catch{deny('R93_AUTH_REQUIRED');}
 const user=response?.data?.user;
 if(response?.error||!UUID.test(user?.id||'')||user.is_anonymous===true||
    !user.email_confirmed_at)deny('R93_AUTH_REQUIRED');
 return user.id;
}
function checkedAccount(row,owner,id,now){
 if(!row||row.user_id!==owner||row.id!==id||row.provider!=='alpaca'||
    row.environment!=='paper'||row.status!=='active'||
    row.identity_verified!==true||row.revoked===true||
    !/^[a-f0-9]{64}$/.test(row.external_digest||'')||
    !Number.isFinite(Date.parse(row.created_at||''))||
    !Number.isFinite(Date.parse(row.last_sync_at||''))||
    Date.parse(row.created_at)>now||Date.parse(row.last_sync_at)>now||
    now-Date.parse(row.last_sync_at)>300000)
    deny('R93_PAPER_ACCOUNT_NOT_VERIFIED');
 return row;
}
async function diagnostic(check,owner,id,now){
 let proof;
 try{proof=await check(Object.freeze({ownerUserId:owner,connectionId:id,nowMs:now}));}
 catch{deny('R93_DIAGNOSTIC_REQUIRED');}
 if(!proof||proof.source!=='JENIOS_PLATFORM_PRIVATE_DIAGNOSTIC'||
    proof.ownerUserId!==owner||proof.connectionId!==id||
    proof.verified!==true||!Number.isSafeInteger(proof.verifiedAtMs)||
    proof.verifiedAtMs>now||now-proof.verifiedAtMs>300000)
    deny('R93_DIAGNOSTIC_REQUIRED');
}
/** No client-provided owner, broker order list, risk flags or raw broker identifiers.
 * Missing broker receipts preserve UNKNOWN and held exposure, without replay.
 * Private Node host must provide diagnostic evidence and persistent B152 ledger.
 */
export async function reconcileR93PrivatePaperAfterRestart({accessToken,connectionId},
 {db,ledger,verifyDiagnostic,env=process.env,clock=Date.now,lookup}={}){
 privateGate(env);
 if(!UUID.test(connectionId||'')||!(ledger instanceof PaperLedger)||
    typeof verifyDiagnostic!=='function'||
    (lookup!==undefined&&typeof lookup!=='function'))
    deny('R93_PRIVATE_DEPENDENCIES_REQUIRED');
 const owner=await ownerFromAuth(db,accessToken);
 const now=clock();
 if(!Number.isSafeInteger(now)||now<=0)deny('R93_CLOCK_INVALID');
 let record;
 try{record=await demoStore(db).findById(owner,connectionId);}
 catch{deny('R93_CONNECTION_STORE_UNAVAILABLE');}
 const row=checkedAccount(record,owner,connectionId,now);
 await diagnostic(verifyDiagnostic,owner,connectionId,now);
 const session=Object.freeze({userId:owner,authenticated:true,diagnosticCompleted:true});
 const safetyStore=createR80PaperSafetyStore(db);
 let binding,orders,safety;
 try{
  binding=alpacaPaperLedgerConnection(owner,row,{now,env});
  safety=await safetyStore.readSafety({ownerUserId:owner,connectionId});
  if(!safety||safety.ownerUserId!==owner||safety.connectionId!==connectionId||
     safety.liveExecutionEnabled!==false||!['ACTIVE','PAUSED'].includes(safety.status))
    deny('R93_SAFETY_REQUIRED');
  orders=ledger.pendingRecovery(session,binding);
 }catch(error){
  if(error?.code==='R93_SAFETY_REQUIRED')throw error;
  deny('R93_DURABLE_RECOVERY_UNAVAILABLE');
 }
 if(!Array.isArray(orders)||orders.length>30)deny('R93_RECOVERY_BATCH_INVALID');
 const paused=safety.status==='PAUSED'||safety.killSwitchEngaged===true;
 if(orders.length===0)return Object.freeze({schema:'JENIOS_R93_PRIVATE_RECOVERY_V1',
  readOnly:true,paperOnly:true,liveExecution:false,paused,
  ordersSent:0,autoResubmitAllowed:false,
  requiresManualReview:false,reports:Object.freeze([])});
 let credentials;
 try{credentials=decryptDemo(row.credential_box,{
   userId:owner,id:connectionId,provider:'alpaca',environment:'paper',kind:'credentials'
  },env);}
 catch{deny('R93_VAULT_DECRYPT_FAILED');}
 if(!KEY.test(credentials?.apiKey||'')||!KEY.test(credentials?.secret||''))
  deny('R93_PAPER_CREDENTIALS_UNAVAILABLE');
 const outcome=await recoverR80PaperAfterRestart({
  session,storedConnection:row,credentials,orders,nowMs:now
 },{ledger,safetyStore,env,lookup});
 if(outcome.ordersSent!==0||outcome.liveExecution!==false||
    outcome.autoResubmitAllowed!==false||outcome.killSwitchUnchanged!==true)
   deny('R93_UNSAFE_RECOVERY_RECEIPT');
 return Object.freeze({schema:'JENIOS_R93_PRIVATE_RECOVERY_V1',
  readOnly:true,paperOnly:true,liveExecution:false,paused,
  ordersSent:0,autoResubmitAllowed:false,
  requiresManualReview:outcome.requiresManualReview,reports:outcome.reports});
}
