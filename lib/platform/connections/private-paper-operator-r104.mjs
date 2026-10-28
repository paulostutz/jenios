/** R104: one request, authenticated Platform owner, existing private journal.
 * Composes the existing diagnostic, vault, reader, recovery and cancellation.
 * No server, queue, new order, risk configuration or automatic retry.
 */
import {lstatSync,realpathSync} from 'node:fs';
import {resolve} from 'node:path';
import {PaperLedger} from '../pilot-prep/paper-ledger.mjs';
import {readVerifiedDiagnostic} from '../diagnostic-server.mjs';
import {demoStore} from './demo-store.mjs';
import {decryptDemo,digestDemoAccount,vaultReady} from './demo-vault.mjs';
import {readDemoBroker} from './demo-broker-reader.mjs';
import {createR80PaperSafetyStore} from './paper-safety-store-r80.mjs';
import {alpacaPaperLedgerConnection} from './alpaca-paper-risk-rehearsal.mjs';
import {verifyR94PrivateVolume} from './private-host-preflight-r94.mjs';
import {reconcileR93PrivatePaperAfterRestart} from './paper-private-coordinator-r93.mjs';
import {lookupOwnAlpacaPaperOrder} from './alpaca-native-paper-order-lookup.mjs';
import {cancelR103PrivatePaperOnce} from './alpaca-private-cancel-r103.mjs';
const fail=code=>{throw Object.assign(new Error(code),{code});};
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const OFF=['JENIOS_REAL_EXECUTION_ENABLED','JENIOS_PRIVATE_PAPER_EXECUTOR',
 'JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED','JENIOS_R80_PRIVATE_ISSUER_ENABLED',
 'JENIOS_R82_ALPACA_LIVE_ORDER_EXECUTION_ENABLED','JENIOS_R83_PRIVATE_NODE_WORKER',
 'JENIOS_PAY_PAYMENTS_ENABLED','JENIOS_INTER_CHARGES_ENABLED','JENIOS_R100_INERT_WORKER_ENABLED'];
export function requireR104OperatorGate(env,action){
 if(!['inspect','recover','cancel'].includes(action)||env.VERCEL!==undefined||
    env.VERCEL_ENV!==undefined||env.NEXT_RUNTIME!==undefined||env.AWS_LAMBDA_FUNCTION_NAME!==undefined||
    env.JENIOS_R104_PRIVATE_OPERATOR_ENABLED!=='true'||
    env.JENIOS_PRIVATE_PAPER_REHEARSAL!=='true'||env.JENIOS_DEMO_CONNECTORS_ENABLED!=='true'||
    OFF.some(k=>env[k]!=='false')||!vaultReady(env))fail('R104_PRIVATE_OPERATOR_DISABLED');
 const recovery=action==='recover'?'true':'false';
 if(env.JENIOS_R93_PRIVATE_NODE_WORKER!==recovery||env.JENIOS_R93_READONLY_RECOVERY_ENABLED!==recovery||
    env.JENIOS_PRIVATE_PAPER_RECOVERY_ENABLED!==recovery||
    env.JENIOS_R103_PRIVATE_PAPER_CANCEL_ENABLED!==(action==='cancel'?'true':'false'))
   fail('R104_ACTION_NOT_CONFIGURED');
}
function journalPath(volume,id){
 const path=resolve(verifyR94PrivateVolume(volume),'paper-'+id+'.sqlite');
 let exists=true;
 for(const suffix of ['', '-wal','-shm']){
  let st;
  try{st=lstatSync(path+suffix);}catch(e){if(e.code==='ENOENT'){if(!suffix)exists=false;continue;}fail('R104_JOURNAL_UNSAFE');}
  if(!st.isFile()||st.isSymbolicLink()||st.nlink!==1||(st.mode&0o077)!==0||
     (typeof process.getuid==='function'&&st.uid!==process.getuid())||
     realpathSync(path+suffix)!==path+suffix||(!suffix&&st.size===0))fail('R104_JOURNAL_UNSAFE');
 }
 return exists?path:null;
}
async function diagnostic(db,user,id,now){
 let d;
 try{d=await readVerifiedDiagnostic(db,user);}catch{fail('R104_DIAGNOSTIC_UNAVAILABLE');}
 if(d?.verified!==true||d.completed!==true||!Number.isFinite(Date.parse(d.createdAt))||
    Date.parse(d.createdAt)>now)fail('R104_DIAGNOSTIC_REQUIRED');
 // Fresh verification time of the persisted record, not invented completion time.
 return Object.freeze({source:'JENIOS_PLATFORM_PRIVATE_DIAGNOSTIC',ownerUserId:user.id,
  connectionId:id,verified:true,verifiedAtMs:now});
}
export async function runR104PrivatePaperOperator(request,{db,env=process.env,clock=Date.now,fetcher=fetch}={}){
 const action=request?.action;
 requireR104OperatorGate(env,action);
 const fields=action==='cancel'?['action','accessToken','connectionId','clientOrderId','confirmation']:['action','accessToken','connectionId'];
 if(!request||Array.isArray(request)||Object.keys(request).sort().join(',')!==fields.sort().join(',')||
    !UUID.test(request.connectionId||'')||typeof request.accessToken!=='string'||
    !/^[A-Za-z0-9_.-]{20,4096}$/.test(request.accessToken))fail('R104_INVALID_REQUEST');
 if(action==='cancel'&&(!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/.test(request.clientOrderId||'')||
    request.confirmation!=='CANCEL_UNFILLED_PAPER_ENTRY_ONLY'))fail('R104_INVALID_REQUEST');
 if(typeof db?.auth?.getUser!=='function')fail('R104_PLATFORM_AUTH_REQUIRED');
 let auth;try{auth=await db.auth.getUser(request.accessToken);}catch{fail('R104_PLATFORM_AUTH_REQUIRED');}
 const user=auth?.data?.user;
 if(auth?.error||!UUID.test(user?.id||'')||user.is_anonymous===true||!user.email_confirmed_at)
  fail('R104_PLATFORM_AUTH_REQUIRED');
 let previous=0;
 const tick=()=>{const n=clock();if(!Number.isSafeInteger(n)||n<=0||n<previous)fail('R104_CLOCK_INVALID');previous=n;return n;};
 const {connectionId}=request;
 // Legacy modules use preview as a PAPER-only contract. An actual Vercel
 // runtime was refused above; this never changes the process environment.
 const legacyEnv={...env,VERCEL_ENV:'preview'};
 let row;
 try{row=await demoStore(db).findById(user.id,connectionId);}catch{fail('R104_CONNECTION_UNAVAILABLE');}
 if(row?.id!==connectionId||row.user_id!==user.id)fail('R104_CONNECTION_UNAVAILABLE');
 const bound=alpacaPaperLedgerConnection(user.id,row,{env:legacyEnv,now:tick()});
 const verifyDiagnostic=async({ownerUserId,connectionId:scopeId})=>{
  if(ownerUserId!==user.id||scopeId!==connectionId)fail('R104_DIAGNOSTIC_SCOPE');
  return diagnostic(db,user,connectionId,tick());
 };
 await verifyDiagnostic({ownerUserId:user.id,connectionId});
 const path=journalPath(env.JENIOS_R104_PRIVATE_VOLUME,connectionId);
 if(!path&&action!=='inspect')fail('R104_EXISTING_JOURNAL_REQUIRED');
 const session={userId:user.id,authenticated:true,diagnosticCompleted:true};
 let ledger;
 try{
  if(path)ledger=new PaperLedger(path);
  // Also verifies the durable account fingerprint. Never configure an account,
  // raise limits, seed an order or silently replace a missing/corrupt journal.
  const pending=ledger?ledger.pendingRecovery(session,bound):null;
  if(action==='inspect'){
   const safety=await createR80PaperSafetyStore(db).readSafety({ownerUserId:user.id,connectionId});
   const credentials=decryptDemo(row.credential_box,{userId:user.id,id:connectionId,
    provider:'alpaca',environment:'paper',kind:'credentials'},env);
   const at=tick();
   const read=await readDemoBroker({provider:'alpaca',environment:'paper',...credentials},{fetcher,now:()=>at});
   if(read.identityVerified!==true||read.snapshot?.complete!==true||
      read.snapshot.accountReadConfirmed!==true||read.snapshot.observedAtMs!==at||
      digestDemoAccount(read.accountRef,{userId:user.id,provider:'alpaca',environment:'paper'},env)!==row.external_digest)
     fail('R104_ACCOUNT_NOT_VERIFIED');
   return Object.freeze({schema:'JENIOS_R104_PRIVATE_OPERATOR_V1',action,ownerAuthenticated:true,
    diagnosticVerified:true,accountReadVerified:true,localJournalAvailable:!!ledger,
    pendingOrderCount:pending?.length??null,paperSafetyAvailable:!!safety,
    paused:safety? safety.status==='PAUSED'||safety.killSwitchEngaged:null,
    paperConsentEnabled:safety?.paperConsentEnabled===true,
    readOnly:true,ordersSent:0,liveExecution:false,readyForLive:false,externalHomologationCertified:false});
  }
  if(action==='recover'){
   const outcome=await reconcileR93PrivatePaperAfterRestart({accessToken:request.accessToken,connectionId},
    {db,ledger,verifyDiagnostic,env:legacyEnv,clock:tick,
     lookup:(input,deps)=>lookupOwnAlpacaPaperOrder(input,{...deps,fetcher})});
   const states={};for(const r of outcome.reports)states[r.state]=(states[r.state]||0)+1;
   return Object.freeze({schema:'JENIOS_R104_PRIVATE_OPERATOR_V1',action,readOnly:true,
    ordersSent:0,liveExecution:false,readyForLive:false,autoResubmitAllowed:false,
    paused:outcome.paused,pendingBefore:pending.length,pendingAfter:ledger.pendingRecovery(session,bound).length,
    states:Object.freeze(states),requiresManualReview:outcome.requiresManualReview});
  }
  const {action:ignored,...payload}=request;
  const outcome=await cancelR103PrivatePaperOnce(payload,{db,ledger,verifyDiagnostic,env:legacyEnv,fetcher,clock:tick});
  return Object.freeze({...outcome,operatorSchema:'JENIOS_R104_PRIVATE_OPERATOR_V1',action,readyForLive:false});
 }finally{ledger?.close();}
}
