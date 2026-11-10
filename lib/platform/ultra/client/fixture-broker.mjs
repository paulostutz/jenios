import {initialOperation,units12} from '../operation.mjs';
const scale=1000000000000n;
export const quantityText=n=>`${n/scale}.${String(n%scale).padStart(12,'0')}`;
const money=n=>`${n<0n?'-':''}${(n<0n?-n:n)/100000000n}.${String((n<0n?-n:n)%100000000n).padStart(8,'0')}`;
/** Deterministic, in-memory broker for tests only. No network, secrets or SDK. */
export class OfflineFixtureBroker {
 constructor({binding,market,currency,now=Date.now,entry='partial',symbol='FIXTURE',freeMargin=1000}){
  this.executionEnvironment='offline_fixture';this.binding=binding;this.market=market;this.currency=currency;this.now=now;this.entry=entry;this.symbol=symbol;this.freeMargin=freeMargin;
  this.orders=new Map();this.cancelledEntries=new Set();this.commandReceipts=new Map();this.sequence=0;this.submissions=0;this.commandSubmissions=0;this.connected=true;this.failAfterSubmit=false;this.failAfterCommand=false;this.history=[];this.protection=true;
 }
 check(){if(!this.connected)throw Error('FIXTURE_DISCONNECTED');}
 async inspect(){this.check();return {accountBinding:this.binding,accountCurrency:this.currency,protectionSupported:true,instrumentRulesVerified:true};}
 async account(){this.check();return {accountBinding:this.binding,reconciled:true,freeMargin:this.freeMargin,realizedLossToday:0,openLoss:0,observedAtMs:this.now()};}
 async observations(){this.check();return [{market:this.market,symbol:this.symbol,marketOpen:true,observedAtMs:this.now(),liquidityVerified:true,volatilityBps:40,spreadBps:1,depthUsd:3000000,fillProbability:.9,roundTripCostBps:3,adverseSelectionBps:1,stabilityRatio:.9,directionInputsVerified:true,instrumentRulesVerified:true,microMomentumBps:10,orderBookImbalance:.7,bid:10,ask:10.01,stopDistance:.1,targetDistance:.2,contractMultiplier:1,quoteToAccount:1,lotStep:.01,minLot:.01,marginPerLot:10,costPerLot:.1}];}
 async preflight(){this.check();return {allowed:this.freeMargin>0,protectionSupported:true};}
 async protectExisting(){this.check();return {verified:this.protection};}
 receipt(operation,commandId=null){
  const updated={...operation,updatedAt:new Date(this.now()).toISOString()};
  return {receiptId:'fixture_receipt_'+(++this.sequence),accountBinding:this.binding,clientOrderId:operation.id,commandId,observedAtMs:this.now(),orderState:{open:'working',partially_closed:'working',sending:'working'}[operation.state]||operation.state,positionReconciled:true,protectionConfirmed:this.protection,entryRemainderCancelled:this.cancelledEntries.has(operation.id),operation:updated};
 }
 async submitProtected(request){
  this.check();this.submissions++;
  if(this.orders.has(request.clientOrderId))throw Error('FIXTURE_DUPLICATE_SUBMISSION');
  const base=initialOperation(request,request.clientOrderId,this.now());
  const entry=this.entry==='none'||this.entry==='reject'?0n:units12(base.requestedQuantity)/(this.entry==='partial'?2n:1n);
  const operation={...base,state:this.entry==='reject'?'rejected':entry?'open':'sending',entryQuantity:quantityText(entry),entryPrice:entry?request.entryPrice.toFixed(12):null,openedAt:entry?base.createdAt:null,brokerRefs:['fixture_order_'+this.submissions],reason:this.entry==='reject'?'FIXTURE_BROKER_REJECTION':null};
  this.orders.set(operation.id,operation);
  if(this.failAfterSubmit)throw Error('FIXTURE_RESPONSE_LOST');
  return this.receipt(operation);
 }
 async lookup(id){this.check();const operation=this.orders.get(id);return operation?this.receipt(operation):null;}
 async collectReceipts(){this.check();const rows=this.history.splice(0);return rows.map(row=>this.receipt(row));}
 async cancelRemainder(command,operation){
  this.check();this.commandSubmissions++;
  const current=this.orders.get(operation.id);
  if(!current)throw Error('FIXTURE_OPERATION_MISSING');
  const next={...current,state:units12(current.entryQuantity)>0n?current.state:'cancelled',reason:'ENTRY_REMAINDER_CANCELLED'};
  this.orders.set(next.id,next);this.cancelledEntries.add(next.id);this.commandReceipts.set(command.id,next);
  if(this.failAfterCommand)throw Error('FIXTURE_RESPONSE_LOST');
  return this.receipt(next,command.id);
 }
 async closeOwned(command,operation){
  this.check();this.commandSubmissions++;
  const current=this.orders.get(operation.id),quantity=units12(command.request.quantity);
  if(!current||quantity>units12(current.entryQuantity)-units12(current.exitQuantity))throw Error('FIXTURE_CLOSE_QUANTITY');
  const exit=units12(current.exitQuantity)+quantity,flat=exit===units12(current.entryQuantity),entryPrice=units12(current.entryPrice),price=entryPrice+100000000000n;
  const gross=(price-entryPrice)*exit/(scale*10000n)*(current.side==='buy'?1n:-1n);
  const next={...current,state:flat?'closed':'partially_closed',exitQuantity:quantityText(exit),exitPrice:quantityText(price),gross:money(gross),fees:'0.01000000',financing:null,costsComplete:false,closedAt:flat?new Date(this.now()).toISOString():null,reason:flat?'COSTS_PENDING':null};
  this.orders.set(next.id,next);this.commandReceipts.set(command.id,next);
  if(this.failAfterCommand)throw Error('FIXTURE_RESPONSE_LOST');
  return this.receipt(next,command.id);
 }
 async lookupCommand(command){this.check();const operation=this.commandReceipts.get(command.id);return operation?this.receipt(operation,command.id):null;}
 completeCosts(id){const old=this.orders.get(id);if(old?.state!=='closed')throw Error('FIXTURE_NOT_CLOSED');const next={...old,financing:'-0.00200000',costsComplete:true,reason:null};this.orders.set(id,next);this.history.push(next);}
}
