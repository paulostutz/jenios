/** Alpaca Paper native order lookup by the customer's client_order_id.
 * Private worker only. GET-only; never resubmit after ambiguous outcomes.
 */
import {digestDemoAccount,vaultReady} from './demo-vault.mjs';
import {nativeCustomerBinding} from './native-broker-bridge.mjs';
import {readDemoBroker} from './demo-broker-reader.mjs';
import {observeAlpacaPaperOrder} from './paper-order-observation.mjs';
const fail=code=>{throw Object.assign(new Error(code),{code});};
const KEY=/^[A-Za-z0-9_+/=-]{16,256}$/;
const ID=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/;
const BASE='https://paper-api.alpaca.markets';
async function parseBounded(r){
 if(r?.redirected||!r?.ok)fail('BROKER_ORDER_LOOKUP_REJECTED');
 const stream=r.body?.getReader?.();if(!stream)fail('BROKER_RESPONSE_INVALID');
 const parts=[];let size=0;
 try{while(true){let p;try{p=await stream.read();}catch{fail('BROKER_NETWORK_UNKNOWN');}
  if(p.done)break;size+=p.value.byteLength;if(size>65536){await stream.cancel();fail('BROKER_RESPONSE_TOO_LARGE');}parts.push(p.value);}}
 finally{stream.releaseLock();}
 try{return JSON.parse(Buffer.concat(parts).toString('utf8'));}catch{fail('BROKER_RESPONSE_INVALID');}
}
export async function lookupOwnAlpacaPaperOrder({verifiedUserId,storedConnection,credentials,clientOrderId,symbol},
 {env=process.env,fetcher=fetch,reader=readDemoBroker,now=Date.now}={}){
 if(env.VERCEL_ENV==='production'||env.JENIOS_DEMO_CONNECTORS_ENABLED!=='true'||!vaultReady(env))fail('PAPER_RECONCILIATION_DISABLED');
 const binding=nativeCustomerBinding(verifiedUserId,storedConnection);
 if(binding.provider!=='alpaca'||binding.environment!=='paper')fail('ALPACA_PAPER_ONLY');
 if(!credentials||!KEY.test(credentials.apiKey||'')||!KEY.test(credentials.secret||''))fail('INVALID_PAPER_CREDENTIALS');
 if(!ID.test(clientOrderId||'')||!ID.test(symbol||''))fail('INVALID_ORDER_REFERENCE');
 const checkedAt=now();if(!Number.isSafeInteger(checkedAt)||checkedAt<0)fail('INVALID_CLOCK');
 // Recheck the account through the existing official broker reader.
 const verified=await reader({provider:'alpaca',environment:'paper',apiKey:credentials.apiKey,secret:credentials.secret},{fetcher,now:()=>checkedAt});
 if(verified?.identityVerified!==true||verified.snapshot?.accountReadConfirmed!==true)fail('BROKER_ACCOUNT_NOT_VERIFIED');
 const digest=digestDemoAccount(verified.accountRef,{userId:verifiedUserId,provider:'alpaca',environment:'paper'},env);
 if(digest!==binding.accountDigest)fail('BROKER_ACCOUNT_CHANGED');
 const url=new URL('/v2/orders:by_client_order_id',BASE);url.searchParams.set('client_order_id',clientOrderId);
 let response;try{response=await fetcher(url.toString(),{method:'GET',cache:'no-store',redirect:'error',
  signal:AbortSignal.timeout(10000),headers:{accept:'application/json','APCA-API-KEY-ID':credentials.apiKey,'APCA-API-SECRET-KEY':credentials.secret}});}
 catch{fail('BROKER_NETWORK_UNKNOWN');}
 if(response.status===404)return Object.freeze({found:false,state:'UNKNOWN',manualReview:true,
  automaticResubmissionAllowed:false,ordersSent:0,liveExecution:false});
 const data=await parseBounded(response);
 const normalized=observeAlpacaPaperOrder({expectedClientOrderId:clientOrderId,expectedSymbol:symbol,environment:'paper',accountMatched:true,observation:data,observedAtMs:checkedAt});
 return Object.freeze({found:true,state:normalized.event.kind,event:normalized.event,
  manualReview:normalized.manualReconciliationRequired,automaticResubmissionAllowed:false,ordersSent:0,liveExecution:false});
}
