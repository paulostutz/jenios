/** B153 format-only contracts. No socket, fetch, signing key or live-order sender exists here. */
import {insist,id,time,units,decimal,SCALE,assertRehearsal,instrument,record} from './contracts.mjs';
import {orderRisk} from './risk.mjs';
export const PROVIDERS=Object.freeze([
 Object.freeze({id:'ctrader',name:'cTrader Open API',status:'format_tested_not_connected',auth:'OAuth 2.0; first scope accounts (read-only)',approval:'Application registration/approval and supported broker required',docs:'https://help.ctrader.com/open-api/',liveExecution:false}),
 Object.freeze({id:'kraken-futures',name:'Kraken Derivatives',status:'format_tested_not_connected',auth:'Per-account API credentials; no withdrawal permissions',approval:'Account/product eligibility and current demo availability must be confirmed',docs:'https://docs.kraken.com/api-reference/order-management/send-order',liveExecution:false}),
 Object.freeze({id:'ibkr',name:'Interactive Brokers',status:'documentation_only',auth:'Third-party integration subject to provider onboarding',approval:'Vendor/compliance and market-data permissions required',docs:'https://www.interactivebrokers.com/campus/ibkr-api-page/webapi-doc/',liveExecution:false}),
 Object.freeze({id:'b3',name:'B3 through a participating broker',status:'partner_not_selected',auth:null,approval:'Broker/provider contract and supported API required; no generic B3 client-order API assumed',docs:null,liveExecution:false})
]);
function exactPrice(s){const n=Number(s);insist(Number.isFinite(n)&&units(String(n))===units(s),'UNSUPPORTED_PRICE_PRECISION');return n;}
function safeInt(s){insist(typeof s==='string'&&/^[1-9]\d{0,15}$/.test(s)&&Number.isSafeInteger(Number(s)),'UNSUPPORTED_INTEGER_PRECISION');return Number(s);}
export function limitDraft(session,connection,{order,meta,now,costs}){
 record(costs,['roundTripFeeBps','slippageBps','fundingCost']);const access=assertRehearsal(session,connection);insist(session.diagnosticCompleted===true,'DIAGNOSTIC_REQUIRED');
 insist(connection.permissions.includes('trade'),'TRADE_PERMISSION_REQUIRED');
 const m=instrument(meta,now);insist(m.provider===connection.provider,'PROVIDER_MISMATCH');id(order.clientOrderId);
 const risk=orderRisk(order,m,{now,...costs});
 let request;
 if(connection.provider==='ctrader'){
  insist(m.quantityUnit==='base'&&units(m.contractSize)===SCALE&&m.marketType!=='inverse','UNSUPPORTED_CTRADER_QUANTITY_MODEL');
  const q=units(order.quantity);insist(q%(SCALE/100n)===0n,'CTRADER_CENTIUNIT_PRECISION');
  const volume=q/(SCALE/100n);insist(volume<=BigInt(Number.MAX_SAFE_INTEGER),'UNSUPPORTED_INTEGER_PRECISION');
  insist(order.clientOrderId.length<=50,'CLIENT_ID_TOO_LONG');
  request={clientMsgId:order.clientOrderId,payloadType:2106,payload:{ctidTraderAccountId:safeInt(connection.accountId),symbolId:safeInt(m.id),orderType:2,tradeSide:order.side==='buy'?1:2,volume:Number(volume),limitPrice:exactPrice(order.entry),stopLoss:exactPrice(order.stop),takeProfit:exactPrice(order.target),clientOrderId:order.clientOrderId}};
 }else{
  insist(m.quantityUnit==='contracts','KRAKEN_CONTRACT_UNITS_REQUIRED');
  request={method:'POST',path:'/derivatives/api/v3/sendorder',query:{orderType:'lmt',symbol:m.id,side:order.side,size:decimal(units(order.quantity)),limitPrice:decimal(units(order.entry)),cliOrdId:order.clientOrderId,reduceOnly:'false'}};
 }
 return {access,provider:connection.provider,request,risk,networkSent:false,liveExecution:false,protectionStatus:connection.provider==='ctrader'?'attached_limit_fields_require_broker_confirmation':'separate_protective_orders_not_sent; live_readiness_blocked'};
}
export function actionPlan(session,connection,action){
 assertRehearsal(session,connection);
 insist(['pause_entries','cancel_pending','close_positions','disconnect'].includes(action),'UNSUPPORTED_ACTION');
 return {action,networkSent:false,requiresExplicitConfirmation:action!=='pause_entries',newEntriesBlocked:true,cancelsOrders:action==='cancel_pending',closesPositions:action==='close_positions',warning:action==='disconnect'?'Disconnecting does not close positions or cancel protective orders.':null};
}
export function submitLive(){throw Object.assign(Error('LIVE_EXECUTION_DISABLED'),{code:'LIVE_EXECUTION_DISABLED'});}
