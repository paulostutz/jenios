/** B180: the official Alpaca PAPER Trading API POST /v2/orders adapter.
 * Deliberately private-worker-only, with no Next.js route, no broker API replacement,
 * no Live host, no automatic network retry, and no logging of credentials/provider body.
 * This module is a transport primitive: it does NOT authorize a trade or reserve risk.
 */
import {assertPrivatePaperRuntime} from './alpaca-paper-dispatch-grant.mjs';
import {observeAlpacaPaperOrder} from './paper-order-observation.mjs';
import {units} from '../pilot-prep/contracts.mjs';
const ENDPOINT='https://paper-api.alpaca.markets/v2/orders';
const TOKEN=/^[A-Za-z0-9_+/=-]{16,256}$/;
const ID=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/;
const deny=code=>{throw Object.assign(new Error(code),{code});};
const eqKeys=(v,expected)=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===expected.slice().sort().join(',');
export function checkNativePaperBracket(body){
 if(!eqKeys(body,['symbol','qty','side','type','time_in_force','limit_price','order_class','take_profit','stop_loss','client_order_id'])||
 !/^[A-Z][A-Z0-9.]{0,14}$/.test(body.symbol||'')||!ID.test(body.client_order_id||'')||
 body.type!=='limit'||body.time_in_force!=='day'||body.order_class!=='bracket'||
 !['buy','sell'].includes(body.side)||!eqKeys(body.take_profit,['limit_price'])||!eqKeys(body.stop_loss,['stop_price']))deny('INVALID_NATIVE_PAPER_BODY');
 try{
  const qty=units(body.qty),entry=units(body.limit_price),stop=units(body.stop_loss.stop_price),target=units(body.take_profit.limit_price);
  if(qty<=0n||qty%100000000n!==0n||entry<=0n||entry%1000000n!==0n||stop<=0n||stop%1000000n!==0n||target<=0n||target%1000000n!==0n)deny('PAPER_QUANTITY_OR_TICK_INVALID');
  if(body.side==='buy'?!(stop<entry&&entry<target):!(target<entry&&entry<stop))deny('UNPROTECTED_OR_WRONG_SIDE_PAPER_ORDER');
 }catch(e){deny(e?.code||'PAPER_QUANTITY_OR_TICK_INVALID');}
 return Object.freeze(structuredClone(body));
}
async function readCappedResponse(res){
 if(res.redirected)deny('PAPER_RESPONSE_REDIRECT_DENIED');
 if(!res.ok)deny('PAPER_BROKER_RESPONSE_AMBIGUOUS'); // 4xx/5xx is not authority for safe resubmission
 if(!['application/json','application/json; charset=utf-8'].some(x=>(res.headers?.get('content-type')||'').toLowerCase()===x))deny('PAPER_RESPONSE_UNEXPECTED_TYPE');
 const reader=res.body?.getReader?.();if(!reader)deny('PAPER_RESPONSE_EMPTY');
 const chunks=[];let count=0;
 try{while(true){const p=await reader.read();if(p.done)break;count+=p.value.byteLength;
  if(count>65536){await reader.cancel();deny('PAPER_RESPONSE_OVER_LIMIT');}chunks.push(p.value);
 }}finally{reader.releaseLock();}
 try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{deny('PAPER_RESPONSE_INVALID_JSON');}
}
export async function postNativeAlpacaPaperOnce({body,credentials,expectedClientOrderId,nowMs},
 {env=process.env,fetcher=fetch}={}){
 assertPrivatePaperRuntime(env);
 if(!Number.isSafeInteger(nowMs)||nowMs<=0)deny('PAPER_INVALID_CLOCK');
 if(!credentials||!TOKEN.test(credentials.apiKey||'')||!TOKEN.test(credentials.secret||''))deny('PAPER_KEY_REJECTED');
 const native=checkNativePaperBracket(body);
 if(expectedClientOrderId!==native.client_order_id)deny('PAPER_CLIENT_ORDER_ID_MISMATCH');
 let response;
 try{response=await fetcher(ENDPOINT,{method:'POST',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(12000),
  headers:{accept:'application/json','content-type':'application/json','APCA-API-KEY-ID':credentials.apiKey,'APCA-API-SECRET-KEY':credentials.secret},
  body:JSON.stringify(native)});}catch{deny('PAPER_POST_TRANSPORT_UNKNOWN');}
 const result=await readCappedResponse(response);
 // Actual broker receipt, never a local self-confirmation. Must match client ID and requested instrument.
 let receipt;
 try{receipt=observeAlpacaPaperOrder({expectedClientOrderId,expectedSymbol:native.symbol,
   environment:'paper',accountMatched:true,observation:result,observedAtMs:nowMs});}
 catch{deny('PAPER_BROKER_RECEIPT_AMBIGUOUS');}
 if(units(result.qty)!==units(native.qty))deny('PAPER_BROKER_QUANTITY_MISMATCH');
 return Object.freeze({kind:receipt.event.kind==='UNKNOWN'?'ambiguous':'broker_receipt',
  brokerEvent:receipt.event,manualReview:receipt.manualReconciliationRequired,
  noAutomaticResubmission:true,ordersSentToPaper:1,realOrdersSent:0,liveExecution:false});
}
