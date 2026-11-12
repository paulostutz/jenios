/** R103: explicit owner-requested cancellation of an unfilled Alpaca PAPER entry.
 * No web route, scheduler, live host, bulk cancellation or automatic retry.
 * 204 means accepted, NOT cancelled. Only subsequent GET evidence reconciles risk.
 */
import {PaperLedger} from '../pilot-prep/paper-ledger.mjs';
import {digest,units} from '../pilot-prep/contracts.mjs';
import {demoStore} from './demo-store.mjs';
import {decryptDemo,digestDemoAccount,vaultReady} from './demo-vault.mjs';
import {createR80PaperSafetyStore} from './paper-safety-store-r80.mjs';
import {alpacaPaperLedgerConnection} from './alpaca-paper-risk-rehearsal.mjs';
import {observeAlpacaPaperOrder} from './paper-order-observation.mjs';
import {reconcileOwnAlpacaPaperLedger} from './alpaca-paper-ledger-reconcile.mjs';
const HOST='https://paper-api.alpaca.markets';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const KEY=/^[A-Za-z0-9_+/=-]{16,256}$/;
const fail=code=>{throw Object.assign(new Error(code),{code});};
const OFF=['JENIOS_REAL_EXECUTION_ENABLED','JENIOS_PRIVATE_PAPER_EXECUTOR',
 'JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED','JENIOS_R80_PRIVATE_ISSUER_ENABLED',
 'JENIOS_R82_ALPACA_LIVE_ORDER_EXECUTION_ENABLED','JENIOS_R83_PRIVATE_NODE_WORKER',
 'JENIOS_PAY_PAYMENTS_ENABLED','JENIOS_INTER_CHARGES_ENABLED','JENIOS_R100_INERT_WORKER_ENABLED'];
function gate(e){
 if(e.VERCEL!==undefined||e.NEXT_RUNTIME!==undefined||e.AWS_LAMBDA_FUNCTION_NAME!==undefined||
    e.VERCEL_ENV!=='preview'||e.JENIOS_R103_PRIVATE_PAPER_CANCEL_ENABLED!=='true'||
    e.JENIOS_PRIVATE_PAPER_REHEARSAL!=='true'||OFF.some(k=>e[k]!=='false')||!vaultReady(e))
   fail('R103_PRIVATE_PAPER_ONLY');
}
async function json(response){
 if(response?.redirected||response?.status!==200)fail('R103_READ_UNCONFIRMED');
 const reader=response.body?.getReader?.();if(!reader)fail('R103_READ_UNCONFIRMED');
 const chunks=[];let bytes=0;
 try{
  while(true){const p=await reader.read();if(p.done)break;
   bytes+=p.value.length;if(bytes>65536){await reader.cancel();fail('R103_READ_UNCONFIRMED');}
   chunks.push(p.value);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
 }catch{fail('R103_READ_UNCONFIRMED');}finally{reader.releaseLock();}
}
function proof(data,details,atMs,expectedBrokerId){
 const order=details.order;
 if(!UUID.test(data?.id||'')||(expectedBrokerId&&data.id!==expectedBrokerId)||
    data.side!==order.side||data.side!=='buy'||data.order_class!=='bracket'||
    data.type!=='limit'||data.time_in_force!=='day'||
    units(data.qty)!==units(order.quantity)||units(data.limit_price)!==units(order.entry))
   fail('R103_ORDER_CONTRACT_MISMATCH');
 const normalized=observeAlpacaPaperOrder({expectedClientOrderId:order.clientOrderId,
  expectedSymbol:order.symbol,environment:'paper',accountMatched:true,observation:data,observedAtMs:atMs});
 return {found:true,state:normalized.event.kind,event:normalized.event,
  manualReview:normalized.manualReconciliationRequired};
}
/** The request selects a local intent, never an external order UUID or owner.
 * Dependencies are supplied only by the trusted private host, not request JSON.
 */
export async function cancelR103PrivatePaperOnce(request,{
 db,ledger,verifyDiagnostic,env=process.env,fetcher=fetch,clock=Date.now
}={}){
 gate(env);
 if(!request||Object.keys(request).sort().join(',')!=='accessToken,clientOrderId,confirmation,connectionId'||
    request.confirmation!=='CANCEL_UNFILLED_PAPER_ENTRY_ONLY'||!UUID.test(request.connectionId||'')||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/.test(request.clientOrderId||'')||
    typeof request.accessToken!=='string'||!/^[A-Za-z0-9_.-]{20,4096}$/.test(request.accessToken)||
    !(ledger instanceof PaperLedger)||typeof db?.auth?.getUser!=='function'||
    typeof verifyDiagnostic!=='function')fail('R103_INVALID_PRIVATE_REQUEST');
 const started=clock();let previous=started;
 function tick(){const t=clock();if(!Number.isSafeInteger(started)||started<=0||
   !Number.isSafeInteger(t)||t<previous||t-started>60000)fail('R103_CLOCK_EXPIRED');previous=t;return t;}
 tick();
 let auth;
 try{auth=await db.auth.getUser(request.accessToken);}catch{fail('R103_AUTH_REQUIRED');}
 const user=auth?.data?.user;
 if(auth?.error||!UUID.test(user?.id||'')||user.is_anonymous===true||!user.email_confirmed_at)
   fail('R103_AUTH_REQUIRED');
 const owner=user.id,{connectionId,clientOrderId}=request;
 const session=Object.freeze({userId:owner,authenticated:true,diagnosticCompleted:true});
 const store=demoStore(db),safetyStore=createR80PaperSafetyStore(db);
 async function scope(){
  let row,safety;
  try{row=await store.findById(owner,connectionId);
   safety=await safetyStore.readSafety({ownerUserId:owner,connectionId});}
  catch{fail('R103_SCOPE_UNAVAILABLE');}
  const now=tick();
  if(!safety||safety.liveExecutionEnabled!==false||!safety.paperConsentEnabled||
     safety.checkedAtMs>now||now-safety.checkedAtMs>30000)fail('R103_CONSENT_REQUIRED');
  // PAUSED/kill stays engaged: cancelling an unfilled entry is not new exposure.
  const bound=alpacaPaperLedgerConnection(owner,row,{now,env});
  return {row,bound};
 }
 const {row,bound}=await scope();
 const credentialDigest=digest(row.credential_box);
 let diagnostic;
 try{diagnostic=await verifyDiagnostic({ownerUserId:owner,connectionId,nowMs:tick()});}
 catch{fail('R103_DIAGNOSTIC_REQUIRED');}
 if(diagnostic?.source!=='JENIOS_PLATFORM_PRIVATE_DIAGNOSTIC'||diagnostic.ownerUserId!==owner||
    diagnostic.connectionId!==connectionId||diagnostic.verified!==true||
    !Number.isSafeInteger(diagnostic.verifiedAtMs)||diagnostic.verifiedAtMs>tick()||
    tick()-diagnostic.verifiedAtMs>300000)fail('R103_DIAGNOSTIC_REQUIRED');
 let details=ledger.orderDetails(session,bound,clientOrderId);
 const result=(patch={})=>Object.freeze({schema:'JENIOS_R103_PAPER_CANCEL_V1',paperOnly:true,
  liveExecution:false,ordersSent:0,cancelAttempts:0,cancelAccepted:false,
  cancellationConfirmed:false,autoRetryAllowed:false,manualReview:true,
  protectionVerified:false,...patch});
 if(details.cancellationAttempted)return result({reason:'ALREADY_ATTEMPTED_RECONCILE_ONLY'});
 if(!['SUBMITTING','ACK','UNKNOWN'].includes(details.state)||BigInt(details.filled)!==0n)
  return result({reason:'ENTRY_NOT_ELIGIBLE'});
 let credentials;
 try{credentials=decryptDemo(row.credential_box,{userId:owner,id:connectionId,
  provider:'alpaca',environment:'paper',kind:'credentials'},env);}
 catch{fail('R103_VAULT_UNAVAILABLE');}
 if(!KEY.test(credentials?.apiKey||'')||!KEY.test(credentials?.secret||''))fail('R103_VAULT_UNAVAILABLE');
 const headers={accept:'application/json','APCA-API-KEY-ID':credentials.apiKey,
  'APCA-API-SECRET-KEY':credentials.secret};
 async function get(path){
  try{return await json(await fetcher(HOST+path,{method:'GET',headers,
   cache:'no-store',redirect:'error',signal:AbortSignal.timeout(10000)}));}
  catch{fail('R103_READ_UNCONFIRMED');}
 }
 const account=await get('/v2/account');
 if(!UUID.test(account?.id||'')||account.status!=='ACTIVE'||
    digestDemoAccount('account-'+account.id,{userId:owner,provider:'alpaca',environment:'paper'},env)!==row.external_digest)
   fail('R103_ACCOUNT_MISMATCH');
 const path='/v2/orders:by_client_order_id?'+new URLSearchParams({client_order_id:clientOrderId});
 const before=await get(path),observed=proof(before,details,tick());
 async function reconcile(receipt){return reconcileOwnAlpacaPaperLedger({session,
  storedConnection:row,clientOrderId,symbol:details.order.symbol,nowMs:tick()},
  {ledger,env,lookup:async()=>receipt});}
 await reconcile(observed);
 if(!['new','accepted'].includes(before.status)||units(before.filled_qty)!==0n)
  return result({reason:'BROKER_ENTRY_NOT_ELIGIBLE'});
 // Refresh consent, ownership and connection immediately before durable claim.
 const latest=await scope();
 if(latest.row.external_digest!==row.external_digest||digest(latest.row.credential_box)!==credentialDigest||
    digest(latest.bound)!==digest(bound))fail('R103_CONNECTION_CHANGED');
 details=ledger.orderDetails(session,bound,clientOrderId);
 const claim=ledger.claimCancellation(session,bound,clientOrderId,{
  fingerprint:details.fingerprint,updatedAtMs:details.updatedAtMs,
  brokerDigest:digest(before.id),nowMs:tick()});
 if(!claim.claimed)return result({reason:'ALREADY_ATTEMPTED_RECONCILE_ONLY'});
 let accepted=false;
 try{
  const response=await fetcher(HOST+'/v2/orders/'+before.id,{method:'DELETE',headers,
   cache:'no-store',redirect:'error',signal:AbortSignal.timeout(10000)});
  accepted=!response.redirected&&response.status===204;
  await response.body?.cancel?.();
 }catch{/* durable UNKNOWN already written; no retry, regardless of HTTP outcome */}
 try{
  const after=await get(path);
  const outcome=await reconcile(proof(after,details,tick(),before.id));
  return result({cancelAttempts:1,cancelAccepted:accepted,
   cancellationConfirmed:outcome.state==='CANCELLED',state:outcome.state,
   riskHeldUnits:outcome.riskHeldUnits,manualReview:outcome.manualReview||outcome.state!=='CANCELLED'});
 }catch{return result({cancelAttempts:1,cancelAccepted:accepted,reason:'RECONCILIATION_REQUIRED'});}
}
