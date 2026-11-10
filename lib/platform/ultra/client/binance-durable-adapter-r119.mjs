import {normalizeSpotReceipt,normalizeSpotOrderListReceipt,classifySpotOutcome} from './binance-spot-protocol-r119.mjs';
import {normalizeBinanceFuturesOrderR119,normalizeBinanceFuturesAlgoR119,classifyBinanceFuturesOutcomeR119} from './binance-futures-protocol-r119.mjs';
import {requireBinanceProtocolSandboxR119} from './binance-protocol-sandbox-r119.mjs';
const fail=code=>{throw Error(code);};
const safeRejections=new Set([-1013,-1021,-1022,-1100,-1101,-1102,-1103,-1111,-1121]);
/** Product-specific native protocol adapter, coupled to durable intents, but
 * deliberately bound to the in-memory sandbox. Not an Ultra live executor. */
export class DurableBinanceAdapterR119 {
 constructor({ledger,transport,now=Date.now}){
  this.ledger=ledger;this.product=ledger.product;this.transport=requireBinanceProtocolSandboxR119(transport,this.product);this.now=now;Object.freeze(this);
 }
 prepare(intent){return this.ledger.prepareNative(intent,this.now());}
 result(action){return {actionId:action.id,state:action.state,product:this.product,automaticResubmitAllowed:false,nativeValidated:false,realOrdersSent:0,protectionConfirmed:false,financialRecordPending:true};}
 normalize(body,action,source){
  const e=action.expected;
  if(this.product==='spot'){
   if(e.kind==='order')return normalizeSpotReceipt(body,{product:'spot',symbol:e.symbol,clientOrderId:e.clientId,...(e.side?{side:e.side}:{})});
   if(e.kind==='list')return normalizeSpotOrderListReceipt(body,{product:'spot',symbol:e.symbol,listClientOrderId:e.clientId,childClientOrderIds:e.childClientIds});
   fail('R119_SPOT_RECEIPT_KIND_INVALID');
  }
  const normalize=e.kind==='algo'?normalizeBinanceFuturesAlgoR119:normalizeBinanceFuturesOrderR119;
  const normalized=normalize({payload:body,binding:e.binding,source,observedAtMs:this.now()});
  if(normalized.clientId!==e.clientId||normalized.symbol!==e.symbol||e.side&&normalized.side!==e.side)fail('R119_FUTURES_RECEIPT_REFERENCE_MISMATCH');
  return normalized;
 }
 async dispatch(actionId){
  let action=this.ledger.nativeAction(actionId);if(!action)fail('R119_NATIVE_ACTION_MISSING');
  if(action.state!=='prepared')return this.result(action);
  this.ledger.transitionNative(actionId,'prepared','sending',{now:this.now()});
  action=this.ledger.nativeAction(actionId);
  let response;
  try{response=await this.transport.request(action.request);}
  catch{this.ledger.transitionNative(actionId,'sending','unknown',{now:this.now(),payload:{reason:'TRANSPORT_RESULT_UNKNOWN'}});return this.result(this.ledger.nativeAction(actionId));}
  return this.observe(action,response,'rest_ack',{initialAttempt:true});
 }
 observe(action,response,source,{initialAttempt=false}={}){
  const code=response.body?.code;
  const classification=this.product==='spot'
   ?classifySpotOutcome({httpStatus:response.httpStatus,code,receipt:response.body})
   :classifyBinanceFuturesOutcomeR119({httpStatus:response.httpStatus,code,message:typeof response.body?.msg==='string'?response.body.msg:''});
  // A query failure, including unknown order, never proves that the prior send
  // did not execute. Duplicate/cancel failures remain unresolved as well.
  if(response.httpStatus<200||response.httpStatus>=300||Number.isInteger(code)&&code<0){
   const rejected=initialAttempt&&response.httpStatus>=400&&response.httpStatus<500&&safeRejections.has(code);
   this.ledger.transitionNative(action.id,action.state,rejected?'rejected':'unknown',{now:this.now(),payload:{reason:rejected?'ATTEMPT_REJECTED':'NATIVE_RESULT_UNKNOWN',code:Number.isInteger(code)?code:null}});
   return {...this.result(this.ledger.nativeAction(action.id)),classification};
  }
  let normalized;
  try{normalized=this.normalize(response.body,action,source);}
  catch{this.ledger.transitionNative(action.id,action.state,'unknown',{now:this.now(),payload:{reason:'NATIVE_RECEIPT_UNVERIFIED'}});return this.result(this.ledger.nativeAction(action.id));}
  const payload={source,observedAtMs:this.now(),nativeObservation:normalized,evidenceAuthenticated:false,operationCompleted:false};
  this.ledger.transitionNative(action.id,action.state,'observed',{now:this.now(),payload});
  return {...this.result(this.ledger.nativeAction(action.id)),nativeObservation:normalized};
 }
 async reconcile(actionId){
  let action=this.ledger.nativeAction(actionId);if(!action)fail('R119_NATIVE_ACTION_MISSING');
  if(['prepared','not_sent','rejected'].includes(action.state))return this.result(action);
  if(action.state==='sending'){this.ledger.transitionNative(action.id,'sending','unknown',{now:this.now(),payload:{reason:'INTERRUPTED_SEND_REQUIRES_LOOKUP'}});action=this.ledger.nativeAction(actionId);}
  let response;
  try{const lookup=structuredClone(action.lookup);if(lookup.params.timestamp!==undefined)lookup.params.timestamp=this.now();response=await this.transport.request(lookup);}
  catch{this.ledger.transitionNative(action.id,action.state,'unknown',{now:this.now(),payload:{reason:'LOOKUP_UNAVAILABLE'}});return this.result(this.ledger.nativeAction(action.id));}
  return this.observe(action,response,'rest_query');
 }
 async recover(){
  const results=[];
  for(const action of this.ledger.nativeActions()){
   if(action.state==='prepared'){this.ledger.transitionNative(action.id,'prepared','not_sent',{now:this.now(),payload:{reason:'INTERRUPTED_BEFORE_SEND'}});results.push(this.result(this.ledger.nativeAction(action.id)));}
   else if(['sending','unknown','observed'].includes(action.state))results.push(await this.reconcile(action.id));
  }
  return results;
 }
}
