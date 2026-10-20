/** B183: verify PAPER bracket protection using the broker's own nested order response.
 * Read-only, no client-supplied URLs, no cancellation and NO guarantee of stop fills.
 * Bracket exits may activate only after entry fill; missing legs => pending review, never verified.
 */
import {units} from '../pilot-prep/contracts.mjs';
import {assertPrivatePaperRuntime} from './alpaca-paper-dispatch-grant.mjs';
import {checkNativePaperBracket} from './alpaca-paper-native-submit.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const KEY=/^[A-Za-z0-9_+/=-]{16,256}$/;
const deny=code=>{throw Object.assign(new Error(code),{code});};
function parseJsonLimited(response){
 if(!response||!response.ok||response.redirected)deny('BRACKET_BROKER_LOOKUP_UNCONFIRMED');
 const typ=response.headers?.get('content-type')||'';if(!/^application\/json(?:\s*;\s*charset=[a-z0-9-]+)?$/i.test(typ))deny('BRACKET_BROKER_LOOKUP_INVALID');
 return response.text().then(s=>{if(s.length>131072)deny('BRACKET_BROKER_LOOKUP_OVERSIZE');try{return JSON.parse(s)}catch{deny('BRACKET_BROKER_LOOKUP_INVALID')}});
}
export function inspectPaperBracketReply({parent,body,brokerOrderId}){
 const b=checkNativePaperBracket(body);
 const pending=(reason)=>Object.freeze({bracketConfirmed:false,reviewRequired:true,reason,
  stopFillGuaranteed:false,automaticOrderResubmissionAllowed:false,liveExecution:false});
 if(!parent||typeof parent!=='object'||Array.isArray(parent))return pending('PARENT_ORDER_NOT_VERIFIED');
 if(parent.id!==brokerOrderId||parent.client_order_id!==b.client_order_id||parent.symbol!==b.symbol||parent.order_class!=='bracket'||parent.side!==b.side||String(parent.qty)!==String(b.qty))return pending('PARENT_BROKER_SCOPE_MISMATCH');
 if(!Array.isArray(parent.legs)||parent.legs.length!==2)return pending('PROTECTIVE_LEGS_NOT_YET_CONFIRMED');
 const opposite=b.side==='buy'?'sell':'buy';
 let foundProfit=false,foundStop=false;
 try{
  for(const leg of parent.legs){
   if(!leg||leg.symbol!==b.symbol||leg.side!==opposite||units(String(leg.qty))!==units(b.qty))return pending('EXIT_SIDE_OR_QUANTITY_MISMATCH');
   if(parent.group_id&&leg.group_id&&leg.group_id!==parent.group_id)return pending('ORDER_GROUP_MISMATCH');
   if(leg.type==='limit'&&units(String(leg.limit_price))===units(b.take_profit.limit_price)&&(!leg.group_role||leg.group_role==='take_profit')){foundProfit=true;continue;}
   if(['stop','stop_limit'].includes(leg.type)&&units(String(leg.stop_price))===units(b.stop_loss.stop_price)&&(!leg.group_role||leg.group_role==='stop_loss')){foundStop=true;continue;}
   return pending('PROTECTIVE_LEG_PRICE_MISMATCH');
  }
 }catch{return pending('PROTECTIVE_LEG_SCHEMA_MISMATCH');}
 if(!foundProfit||!foundStop)return pending('PROTECTIVE_LEGS_MISSING');
 return Object.freeze({bracketConfirmed:true,reviewRequired:false,reason:'BROKER_REPORTED_BRACKET_LEGS',
  stopFillGuaranteed:false,brokerReconciliationStillRequired:true,automaticOrderResubmissionAllowed:false,liveExecution:false});
}
export async function auditAlpacaPaperBracket({body,brokerOrderId,credentials},{env=process.env,fetcher=fetch}={}){
 assertPrivatePaperRuntime(env);
 if(!UUID.test(brokerOrderId||'')||!KEY.test(credentials?.apiKey||'')||!KEY.test(credentials?.secret||''))deny('INVALID_BRACKET_AUDIT_SCOPE');
 const url='https://paper-api.alpaca.markets/v2/orders/'+brokerOrderId+'?nested=true';
 let response;try{response=await fetcher(url,{method:'GET',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(12000),
  headers:{accept:'application/json','APCA-API-KEY-ID':credentials.apiKey,'APCA-API-SECRET-KEY':credentials.secret}});}
 catch{deny('BRACKET_BROKER_LOOKUP_UNCONFIRMED');}
 const data=await parseJsonLimited(response);
 return inspectPaperBracketReply({parent:data,body,brokerOrderId});
}
