/** R77 — one-shot native Alpaca PAPER executor for an isolated, trusted private QA worker.
 * Not imported by HTTP routes; never supports a live account or live API host.
 * B152 ledger and B175 proposal remain canonical. Never automatically resubmit.
 */
import {readDemoBroker} from './demo-broker-reader.mjs';
import {digestDemoAccount} from './demo-vault.mjs';
import {alpacaPaperLedgerConnection,reserveAlpacaPaperProposal} from './alpaca-paper-risk-rehearsal.mjs';
import {observeAlpacaPaperOrder} from './paper-order-observation.mjs';
import {units,SCALE} from '../pilot-prep/contracts.mjs';

const HOST='https://paper-api.alpaca.markets';
const CREDENTIAL=/^[A-Za-z0-9_+/=-]{16,256}$/;
const EQUITY=/^[A-Z][A-Z0-9.]{0,14}$/;
const fail=code=>{throw Object.assign(new Error(code),{code});};

export function requireR77PrivatePaperGate(env={}){
 if(env.VERCEL_ENV!=='preview'||env.JENIOS_REAL_EXECUTION_ENABLED!=='false'||
  env.JENIOS_PRIVATE_PAPER_REHEARSAL!=='true'||
  env.JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED!=='true'||
  env.JENIOS_PRIVATE_PAPER_EXECUTOR!=='true')fail('PAPER_TRANSPORT_NOT_AUTHORIZED');
 return true;
}
export function verifyR77PaperApproval({approval,session,storedConnection,order,nowMs}){
 if(!approval||typeof approval!=='object'||Array.isArray(approval)||
  approval.consent!=='PAPER_TEST_ONLY'||approval.authorizedBy!==session?.userId||
  approval.connectionId!==storedConnection?.id||approval.provider!=='alpaca'||
  approval.environment!=='paper'||approval.liveAccount!==false||
  !Number.isSafeInteger(approval.authorizedAtMs)||approval.authorizedAtMs>nowMs||
  nowMs-approval.authorizedAtMs>600000||
  typeof approval.maxNotionalUnits!=='string'||!/^[1-9][0-9]{0,25}$/.test(approval.maxNotionalUnits)||
  !order||order.side!=='buy'||!EQUITY.test(order.symbol||''))
  fail('EXPLICIT_PRIVATE_PAPER_APPROVAL_REQUIRED');
 const notional=units(order.quantity)*units(order.entry)/SCALE;
 if(notional<=0n||notional>BigInt(approval.maxNotionalUnits))fail('PAPER_APPROVED_NOTIONAL_LIMIT');
 return true;
}

async function bounded(response){
 if(response?.redirected||!response?.ok)fail('PAPER_PROVIDER_RESPONSE_NOT_CONFIRMED');
 const reader=response.body?.getReader?.();
 if(!reader)fail('PAPER_PROVIDER_RESPONSE_INVALID');
 const chunks=[];let size=0;
 try{
  while(true){
   let data;try{data=await reader.read();}catch{fail('PAPER_NETWORK_UNKNOWN');}
   if(data.done)break;
   size+=data.value.byteLength;
   if(size>65536){await reader.cancel();fail('PAPER_PROVIDER_RESPONSE_TOO_LARGE');}
   chunks.push(data.value);
  }
 }finally{reader.releaseLock();}
 try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}
 catch{fail('PAPER_PROVIDER_RESPONSE_INVALID');}
}
async function getPaper(path,credentials,{fetcher}){
 if(typeof path!=='string'||!['/v2/account','/v2/clock'].includes(path)&&
  !/^\/v2\/assets\/[A-Z][A-Z0-9.]{0,14}$/.test(path))fail('PAPER_UNKNOWN_READ_PATH');
 let response;
 try{response=await fetcher(HOST+path,{method:'GET',cache:'no-store',redirect:'error',
  signal:AbortSignal.timeout(10000),headers:{
   accept:'application/json','APCA-API-KEY-ID':credentials.apiKey,
   'APCA-API-SECRET-KEY':credentials.secret}});}
 catch{fail('PAPER_NETWORK_UNKNOWN');}
 return bounded(response);
}

/** Read from the official PAPER account and asset/market endpoints, not operator assertions.
 * No part of the client browser is a trusted source of a trading approval.
 */
export async function readR77PaperExecutionPreflight({
 session,storedConnection,credentials,order,nowMs
},{env=process.env,fetcher=fetch,reader=readDemoBroker}={}){
 requireR77PrivatePaperGate(env);
 if(!Number.isSafeInteger(nowMs)||nowMs<=0||!session?.authenticated||
  storedConnection?.user_id!==session.userId||storedConnection?.provider!=='alpaca'||
  storedConnection?.environment!=='paper'||storedConnection?.identity_verified!==true||
  !CREDENTIAL.test(credentials?.apiKey||'')||!CREDENTIAL.test(credentials?.secret||'')||
  !EQUITY.test(order?.symbol||''))fail('PAPER_PREFLIGHT_SCOPE_NOT_VERIFIED');

 // Original owner/connection and age checks; unchanged from B175.
 alpacaPaperLedgerConnection(session.userId,storedConnection,{now:nowMs,env});
 let accountRead;
 try{
  accountRead=await reader({provider:'alpaca',environment:'paper',
    apiKey:credentials.apiKey,secret:credentials.secret},{fetcher,now:()=>nowMs});
 }catch{fail('PAPER_ACCOUNT_READ_UNCONFIRMED');}
 if(accountRead?.identityVerified!==true||accountRead?.snapshot?.complete!==true||
  accountRead.snapshot.accountReadConfirmed!==true||accountRead.observation?.summary?.status!=='ACTIVE'||
  accountRead.snapshot.observedAtMs!==nowMs)fail('PAPER_ACCOUNT_READ_UNCONFIRMED');
 const digest=digestDemoAccount(accountRead.accountRef,
  {userId:session.userId,provider:'alpaca',environment:'paper'},env);
 if(digest!==storedConnection.external_digest)fail('PAPER_ACCOUNT_CHANGED');
 const account=await getPaper('/v2/account',credentials,{fetcher});
 if(typeof account?.id!=='string'||accountRead.accountRef!=='account-'+account.id||
  account.status!=='ACTIVE'||account.trading_blocked!==false)fail('PAPER_ACCOUNT_CANNOT_TRADE');
 const asset=await getPaper('/v2/assets/'+order.symbol,credentials,{fetcher});
 if(asset?.symbol!==order.symbol||asset.tradable!==true||asset.status!=='active'||
  asset.class!=='us_equity'||units(order.quantity)%SCALE!==0n)fail('PAPER_ASSET_NOT_CERTIFIED');
 const clock=await getPaper('/v2/clock',credentials,{fetcher});
 const observed=Date.parse(clock?.timestamp||'');
 if(clock?.is_open!==true||!Number.isFinite(observed)||Math.abs(nowMs-observed)>60000)
  fail('PAPER_MARKET_NOT_VERIFIED');
 return Object.freeze({provider:'alpaca',environment:'paper',ownerVerified:true,
  accountReadConfirmed:true,assetVerified:true,marketOpen:true,certifiedForLive:false});
}

/** One logical order -> at most one POST attempt. The durable SUBMITTING ledger event
 * is written *before* the fetch; any ambiguity remains UNKNOWN and holds capital.
 * There is intentionally no retry loop and no order endpoint on the website.
 */
export async function submitAlpacaPaperOnce({
 session,storedConnection,credentials,approval,mode,signal,order,source,
 meta,quote,costs,nowMs
},{ledger,env=process.env,fetcher=fetch,reader=readDemoBroker}={}){
 requireR77PrivatePaperGate(env);
 if(!ledger||typeof ledger.reserve!=='function'||typeof ledger.event!=='function'||
  typeof ledger.snapshot!=='function')fail('DURABLE_PRIVATE_LEDGER_REQUIRED');
 if(!Number.isSafeInteger(nowMs)||nowMs<=0)fail('PAPER_CLOCK_REQUIRED');
 verifyR77PaperApproval({approval,session,storedConnection,order,nowMs});
 const preflight=await readR77PaperExecutionPreflight({session,storedConnection,credentials,order,nowMs},
  {env,fetcher,reader});
 if(!preflight.marketOpen||preflight.certifiedForLive)fail('PAPER_PREFLIGHT_FAILED');

 const reserved=reserveAlpacaPaperProposal({
  session,storedConnection,mode,signal,order,source,meta,quote,costs,nowMs
 },{ledger,env});
 if(reserved.duplicate)return Object.freeze({state:reserved.riskState,duplicate:true,
  postAttempted:false,autoResubmitAllowed:false,paperOnly:true,liveExecution:false});
 if(!reserved.riskReserved||reserved.riskState!=='RESERVED'||!reserved.nativeProposal||
  reserved.nativeProposal.canSubmit!==false)fail('PAPER_RISK_RESERVATION_NOT_VERIFIED');
 const body=reserved.nativeProposal.body;
 if(body.client_order_id!==order.clientOrderId||body.symbol!==order.symbol||
  body.side!=='buy'||body.order_class!=='bracket'||body.type!=='limit'||
  body.time_in_force!=='day')fail('PAPER_NATIVE_ORDER_NOT_APPROVED');
 const connection=alpacaPaperLedgerConnection(session.userId,storedConnection,{now:nowMs,env});
 ledger.event(session,connection,order.clientOrderId,{
  id:'r77-submitting-'+order.clientOrderId,kind:'SUBMITTING',atMs:nowMs,cumulativeQuantity:'0'
 });
 let wire;
 try{
  wire=await fetcher(HOST+'/v2/orders',{method:'POST',cache:'no-store',redirect:'error',
   signal:AbortSignal.timeout(10000),headers:{accept:'application/json',
    'content-type':'application/json','APCA-API-KEY-ID':credentials.apiKey,
    'APCA-API-SECRET-KEY':credentials.secret},body:JSON.stringify(body)});
  const observed=await bounded(wire);
  const proof=observeAlpacaPaperOrder({expectedClientOrderId:order.clientOrderId,
   expectedSymbol:order.symbol,environment:'paper',accountMatched:true,
   observation:observed,observedAtMs:nowMs+1});
  const receipt=ledger.event(session,connection,order.clientOrderId,proof.event);
  return Object.freeze({state:receipt.state,duplicate:false,postAttempted:true,
   paperOnly:true,liveExecution:false,autoResubmitAllowed:false,
   brokerReceiptVerified:true,manualReview:proof.manualReconciliationRequired,
   riskHeldUnits:receipt.heldRiskUnits??null});
 }catch{
  // 4xx, 5xx, timeout, malformed body and dropped response are all UNKNOWN.
  // A 404 after the fact or a failure to obtain a receipt never authorizes retransmission.
  let state='UNKNOWN';
  try{
   const event=ledger.event(session,connection,order.clientOrderId,{
    id:'r77-unknown-'+order.clientOrderId,kind:'UNKNOWN',
    atMs:nowMs+2,cumulativeQuantity:'0'});
   state=event.state;
  }catch{
   // If the journal cannot be updated, the recorded SUBMITTING still blocks re-send.
   state='SUBMITTING';
  }
  return Object.freeze({state,duplicate:false,postAttempted:true,
   paperOnly:true,liveExecution:false,autoResubmitAllowed:false,
   brokerReceiptVerified:false,manualReview:true});
 }
}
