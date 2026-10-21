/** B201 — isolated read-only Alpaca Paper order evidence collection.
 * Reuses B165 encrypted vault, B166 official account reader, B196 identity preflight
 * and B197 strict pair comparison. It NEVER submits, cancels, resubmits or reconciles
 * a broker order. This file is not imported by Next.js routes.
 */
import {setTimeout as pause} from 'node:timers/promises';
import {decryptDemo,vaultReady} from './demo-vault.mjs';
import {nativeCustomerBinding} from './native-broker-bridge.mjs';
import {verifyPrivatePaperAccountRead} from './b196-private-account-preflight.mjs';
import {assessPairedPaperReads} from './b197-independent-order-observations.mjs';
import {readDemoBroker} from './demo-broker-reader.mjs';

const fail=code=>{throw Object.assign(new Error(code),{code});};
const KEY=/^[A-Za-z0-9_+/=-]{16,256}$/;
const ID=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/;
const SYMBOL=/^[A-Z][A-Z0-9.]{0,14}$/;
const MAX_BYTES=65536;
const API='https://paper-api.alpaca.markets';
function privateMode(env){
 if(env.VERCEL||env.VERCEL_ENV||env.JENIOS_PRIVATE_PAPER_REHEARSAL!=='true'||
    env.JENIOS_PRIVATE_PAPER_ACCOUNT_PREFLIGHT!=='true'||
    env.JENIOS_PRIVATE_PAPER_READ_OBSERVER!=='true'||!vaultReady(env))
   fail('ISOLATED_PAPER_READ_OBSERVER_DISABLED');
}
function freshConnection(row,stored,owner){
 if(!row||row.user_id!==owner||row.id!==stored.id||row.provider!=='alpaca'||
    row.environment!=='paper'||row.status!=='active'||row.revoked===true||
    row.identity_verified!==true||row.external_digest!==stored.external_digest||
    JSON.stringify(row.credential_box)!==JSON.stringify(stored.credential_box))
   fail('BROKER_CONNECTION_REVOKED_OR_ROTATED');
 return row;
}
async function parseLimitedJson(response){
 if(!response||response.redirected)fail('PAPER_ORDER_READ_NOT_CONFIRMED');
 if(response.status===404){await response.body?.cancel?.();return null;}
 if(response.status!==200||!response.ok)fail('PAPER_ORDER_READ_NOT_CONFIRMED');
 if(!/^application\/json(?:\s*;\s*charset=[a-z0-9-]+)?$/i.test(response.headers?.get('content-type')||''))
  fail('PAPER_ORDER_JSON_REQUIRED');
 const reader=response.body?.getReader?.();if(!reader)fail('PAPER_ORDER_STREAM_REQUIRED');
 const bytes=[];let length=0;
 try{
  while(true){
   let item;try{item=await reader.read();}catch{fail('PAPER_ORDER_STREAM_UNCONFIRMED');}
   if(item.done)break;
   length+=item.value.byteLength;
   if(length>MAX_BYTES){await reader.cancel();fail('PAPER_ORDER_RESPONSE_OVERSIZE');}
   bytes.push(item.value);
  }
 }finally{reader.releaseLock();}
 try{const value=JSON.parse(Buffer.concat(bytes).toString('utf8'));
  if(!value||typeof value!=='object'||Array.isArray(value))fail('PAPER_ORDER_JSON_INVALID');
  return value;
 }catch(e){fail(e?.code||'PAPER_ORDER_JSON_INVALID');}
}
async function readFixedOfficialOrder({fetcher,credentials,clientOrderId}){
 const url=new URL('/v2/orders:by_client_order_id',API);
 url.searchParams.set('client_order_id',clientOrderId);
 let response;
 try{
  response=await fetcher(url.toString(),{method:'GET',redirect:'error',cache:'no-store',
   signal:AbortSignal.timeout(10000),headers:{accept:'application/json',
    'APCA-API-KEY-ID':credentials.apiKey,'APCA-API-SECRET-KEY':credentials.secret}});
 }catch{fail('PAPER_ORDER_NETWORK_UNCERTAIN');}
 return parseLimitedJson(response);
}
export async function collectPrivatePaperOrderPair({session,storedConnection,clientOrderId,symbol,expectedQuantity,nowMs},
 {env=process.env,refreshConnection,reader=readDemoBroker,fetcher=fetch,
  now=Date.now,delay=ms=>pause(ms)}={}){
 privateMode(env);
 if(!session||session.authenticated!==true||session.diagnosticCompleted!==true||
    typeof refreshConnection!=='function'||typeof reader!=='function'||
    typeof fetcher!=='function'||typeof now!=='function'||typeof delay!=='function')
  fail('PRIVATE_PAPER_WORKER_DEPENDENCY_REQUIRED');
 if(!ID.test(clientOrderId||'')||!SYMBOL.test(symbol||'')||
    !Number.isSafeInteger(nowMs)||nowMs<=0)fail('INVALID_PRIVATE_PAPER_ORDER_SCOPE');
 const binding=nativeCustomerBinding(session.userId,storedConnection);
 if(binding.provider!=='alpaca'||binding.environment!=='paper')fail('ALPACA_PAPER_ONLY');
 await verifyPrivatePaperAccountRead({session,storedConnection,nowMs},
  {env,refreshConnection,reader,fetcher});
 // The private DB check is repeated before EACH official order lookup.
 const credentials=decryptDemo(storedConnection.credential_box,
  {userId:session.userId,id:binding.connectionId,provider:'alpaca',environment:'paper',kind:'credentials'},env);
 if(!KEY.test(credentials?.apiKey||'')||!KEY.test(credentials?.secret||''))
  fail('PRIVATE_PAPER_CREDENTIALS_INVALID');
 const observations=[];
 for(let step=0;step<2;step++){
  if(step===1)await delay(350);
  const at=now();
  if(!Number.isSafeInteger(at)||at<nowMs||at-nowMs>120000||
     (step===1&&(at-observations[0].receivedAtMs<250||at-observations[0].receivedAtMs>60000)))
   fail('PAPER_OBSERVATION_CLOCK_UNTRUSTED');
  let latest;try{latest=await refreshConnection({userId:session.userId,connectionId:binding.connectionId});}
  catch{fail('PRIVATE_ACCOUNT_REFRESH_UNAVAILABLE');}
  freshConnection(latest,storedConnection,session.userId);
  const order=await readFixedOfficialOrder({fetcher,credentials,clientOrderId});
  if(order===null)return Object.freeze({schema:'JENIOS_B201_PRIVATE_PAIRED_PAPER_READ',
   assessment:'ORDER_NOT_FOUND_IS_UNKNOWN',observationCount:step+1,
   manualBrokerReviewRequired:true,independentlyAttested:false,
   ledgerChanged:false,ordersSent:0,automaticResubmissionAllowed:false,
   liveExecutionAuthorized:false});
  observations.push({receivedAtMs:at,order});
 }
 const result=assessPairedPaperReads({clientOrderId,symbol,expectedQuantity,
  first:observations[0],second:observations[1],nowMs:now()});
 return Object.freeze({schema:'JENIOS_B201_PRIVATE_PAIRED_PAPER_READ',
  assessment:result.assessment,observationCount:2,
  orderReferenceDigest:result.orderReferenceDigest,
  lastObservedKind:result.lastObservedKind,
  lastCumulativeQuantity:result.lastCumulativeQuantity,
  manualBrokerReviewRequired:true,
  // Even two GET calls are not a legally attested independent witness.
  independentlyAttested:false,
  orderStateCommitted:false,ledgerChanged:false,ordersSent:0,
  automaticResubmissionAllowed:false,liveExecutionAuthorized:false});
}
