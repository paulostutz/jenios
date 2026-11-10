import {normalizeUltraConfig,assessUltraLeverage} from '../policy.mjs';
import {rankUltraCandidates,sizeUltraPosition} from '../selection.mjs';
import {decideUltrafastDirection} from '../../research/robot-r18-ultrafast-foundation.mjs';
import {units12} from '../operation.mjs';
const fail=code=>{throw Error(code);};
/** Offline qualification only. This module never authorizes a native/live adapter. */
export class UltraExecutionRuntime {
 constructor({config,market,ledger,adapter,now=Date.now,onWarning=async()=>false}){
  if(adapter?.executionEnvironment!=='offline_fixture')fail('NATIVE_EXECUTION_NOT_RELEASED');
  this.config=normalizeUltraConfig(config);this.budget=this.config.markets.find(m=>m.id===market);
  if(!this.budget)fail('MARKET_NOT_SELECTED');
  this.ledger=ledger;this.adapter=adapter;this.now=now;this.onWarning=onWarning;this.busy=false;this.deadline=0;
 }
 async start({recover=false}={}){
  if(this.busy)fail('RUNTIME_BUSY');this.busy=true;
  try{
   this.ledger.claim(this.now(),{recover});
   const assessment=assessUltraLeverage(this.config);
   if(assessment.requiresAcknowledgement&&!await this.onWarning(assessment))fail('RISK_ACKNOWLEDGEMENT_REQUIRED');
   const ready=await this.adapter.inspect();
   if(ready?.accountBinding!==this.ledger.binding||ready.accountCurrency!==this.budget.currency||ready.protectionSupported!==true||ready.instrumentRulesVerified!==true)fail('BROKER_PREFLIGHT_REQUIRED');
   await this.reconcile();this.ledger.heartbeat(this.now());this.ledger.resume();this.deadline=this.now()+this.config.sessionMinutes*60000;
  }catch(error){this.ledger.pause();throw error;}finally{this.busy=false;}
 }
 async accept(receipt,commandId=null){
  if(!receipt){this.ledger.pause();return false;}
  const result=this.ledger.applyReceipt(receipt,{commandId,now:this.now()});
  return result.operation?.state!=='unknown'&&(!commandId||result.commandConfirmed===true);
 }
 async reconcile(){
  for(const order of this.ledger.pending()){
   if(order.state==='prepared'){this.ledger.transition(order.id,'prepared','cancelled',{reason:'NOT_SENT_BEFORE_RECOVERY'},this.now());continue;}
   let receipt=null;
   try{receipt=await this.adapter.lookup(order.id,order.request,order.receipt);if(receipt)await this.accept(receipt);}
   catch{receipt=null;}
   if(!receipt){
    const current=this.ledger.order(order.id);
    if(current.state!=='unknown')this.ledger.transition(order.id,current.state,'unknown',{reason:'LOOKUP_UNCONFIRMED'},this.now());
    this.ledger.pause();
   }
  }
  for(const command of this.ledger.commands()){
   if(command.state==='prepared'){this.ledger.markCommand(command.id,'prepared','cancelled',this.now());continue;}
   try{const receipt=await this.adapter.lookupCommand(command);if(receipt&&await this.accept(receipt,command.id))continue;}catch{}
   if(this.ledger.commands().find(c=>c.id===command.id)?.state==='sending')this.ledger.markCommand(command.id,'sending','unknown',this.now());
   this.ledger.pause();
  }
  // Include final operations whose commission/funding may arrive later. A fresh
  // snapshot is recorded only when the provider proves the same local identity.
  const late=await this.adapter.collectReceipts();
  if(!Array.isArray(late)||late.length>20000)fail('BROKER_HISTORY_UNAVAILABLE');
  for(const receipt of late)await this.accept(receipt);
 }
 async tick(){
  if(this.busy)return {state:'busy'};this.busy=true;
  try{
   this.ledger.heartbeat(this.now());await this.reconcile();
   const protectedState=await this.adapter.protectExisting(this.ledger.pending());
   if(protectedState?.verified!==true){this.ledger.pause();return {state:'protection_unconfirmed'};}
   if(this.now()>=this.deadline)this.ledger.pause();
   if(this.ledger.paused())return {state:'paused',positionsManaged:true};
   const now=this.now(),account=await this.adapter.account();
   if(account?.accountBinding!==this.ledger.binding||account.reconciled!==true||['freeMargin','realizedLossToday','openLoss'].some(k=>!Number.isFinite(account[k])||account[k]<0)||!Number.isSafeInteger(account.observedAtMs)||account.observedAtMs>now||now-account.observedAtMs>5000)fail('ACCOUNT_SNAPSHOT_UNAVAILABLE');
   if(account.realizedLossToday+account.openLoss>=this.budget.capital*this.config.dailyLossPct/100){this.ledger.pause();return {state:'daily_limit',positionsManaged:true};}
   const active=this.ledger.pending();
   if(active.length>=this.config.maxPositions||this.ledger.commands().length||active.some(o=>['sending','unknown'].includes(o.state)))return {state:'awaiting_reconciliation'};
   const observations=await this.adapter.observations();
   const ranked=rankUltraCandidates(this.config,observations,this.now());
   for(const rank of ranked.filter(r=>r.eligible&&r.market===this.budget.id)){
    const x=observations.find(o=>o.market===rank.market&&o.symbol===rank.symbol);
    if(active.some(o=>o.request.symbol===x.symbol)||x.directionInputsVerified!==true||x.instrumentRulesVerified!==true)continue;
    const direction=decideUltrafastDirection({microMomentumBps:x.microMomentumBps,orderBookImbalance:x.orderBookImbalance,shortVolatilityBps:x.volatilityBps,roundTripCostBps:x.roundTripCostBps,spreadBps:x.spreadBps,quoteAgeMs:this.now()-x.observedAtMs});
    if(!direction.side)continue;
    const reserved=active.reduce((n,o)=>n+o.request.reservedMargin,0),available=Math.max(0,Math.min(this.budget.capital-reserved,account.freeMargin-reserved));
    const sized=sizeUltraPosition({capital:this.budget.capital,leverage:this.budget.leverage,entryPrice:direction.side==='buy'?x.ask:x.bid,stopDistance:x.stopDistance,contractMultiplier:x.contractMultiplier,quoteToAccount:x.quoteToAccount,lotStep:x.lotStep,minLot:x.minLot,freeMargin:available,marginPerLot:x.marginPerLot,costPerLot:x.costPerLot,tradeRiskPct:this.config.tradeRiskPct,maxAssetPct:this.config.maxAssetPct});
    if(!sized.lots||!Number.isFinite(x.targetDistance)||x.targetDistance<=0||sized.notional+active.reduce((n,o)=>n+o.request.notional,0)>this.budget.capital*this.budget.leverage)continue;
    const request={market:x.market,symbol:x.symbol,side:direction.side,quantity:sized.lots,entryPrice:direction.side==='buy'?x.ask:x.bid,stopDistance:x.stopDistance,targetDistance:x.targetDistance,reservedMargin:sized.lots*x.marginPerLot,notional:sized.notional,estimatedLoss:sized.estimatedLoss,currency:this.budget.currency,observedAtMs:x.observedAtMs,leverage:this.budget.leverage};
    const check=await this.adapter.preflight(request);
    if(check?.allowed!==true||check.protectionSupported!==true)continue;
    if(this.ledger.paused()||this.now()>=this.deadline){this.ledger.pause();return {state:'paused'};}
    if(this.now()-x.observedAtMs>1000||this.now()-account.observedAtMs>5000)continue;
    this.ledger.heartbeat(this.now());const intent=this.ledger.prepare(request,this.now());if(!intent.created)continue;
    this.ledger.transition(intent.id,'prepared','sending',null,this.now());
    try{
     const receipt=await this.adapter.submitProtected({...request,clientOrderId:intent.id});
     if(!receipt||receipt.clientOrderId!==intent.id)fail('UNCONFIRMED_SUBMISSION');
     await this.accept(receipt);const saved=this.ledger.operation(intent.id);
     return {state:saved.state==='unknown'?'reconciliation_required':saved.state,clientOrderId:intent.id};
    }catch{
     if(this.ledger.order(intent.id).state==='sending')this.ledger.transition(intent.id,'sending','unknown',{reason:'TRANSPORT_RESULT_UNKNOWN'},this.now());
     this.ledger.pause();return {state:'reconciliation_required',clientOrderId:intent.id};
    }
   }
   return {state:'waiting_for_opportunity'};
  }catch(error){this.ledger.pause();throw error;}finally{this.busy=false;}
 }
 pause(){this.ledger.pause();}
 async resume(){return this.start();}
 async command(kind,operationId,quantity=null){
  if(this.busy)fail('RUNTIME_BUSY');this.busy=true;this.pause();
  try{
   this.ledger.heartbeat(this.now());await this.reconcile();
   const prepared=this.ledger.prepareCommand(kind,operationId,{quantity},this.now());if(!prepared.created)return {state:'already_recorded',commandId:prepared.id};
   this.ledger.markCommand(prepared.id,'prepared','sending',this.now());
   const command=this.ledger.commands().find(c=>c.id===prepared.id);
   try{
    const receipt=await this.adapter[kind==='cancel'?'cancelRemainder':'closeOwned'](command,this.ledger.operation(operationId));
    if(!receipt||!await this.accept(receipt,command.id))fail('COMMAND_RESULT_UNKNOWN');
    return {state:'confirmed',commandId:command.id};
   }catch{if(this.ledger.commands().find(c=>c.id===command.id)?.state==='sending')this.ledger.markCommand(command.id,'sending','unknown',this.now());return {state:'reconciliation_required',commandId:command.id};}
  }finally{this.busy=false;}
 }
 cancel(operationId){return this.command('cancel',operationId);}
 close(operationId,quantity){return this.command('close',operationId,quantity);}
 async closePositions(){
  if(this.busy)fail('RUNTIME_BUSY');this.pause();this.busy=true;
  let operations;
  const unresolved=()=>[...new Set([
   ...this.ledger.pending().filter(o=>!['closed','cancelled','rejected'].includes(o.state)).map(o=>o.id),
   ...this.ledger.commands().map(c=>c.operation_id)
  ])];
  try{
   await this.reconcile();
   const uncertain=this.ledger.pending().filter(o=>['sending','unknown'].includes(o.state));
   if(uncertain.length||this.ledger.commands().length)return {state:'reconciliation_required',results:[],unresolvedOperationIds:unresolved()};
   operations=this.ledger.operations().filter(o=>['open','partially_closed','sending'].includes(o.state));
  }finally{this.busy=false;}
  const results=[];
  for(const selected of operations){
   let operation=this.ledger.operation(selected.id),order=this.ledger.order(selected.id);
   if(units12(operation.entryQuantity)<units12(operation.requestedQuantity)&&order.receipt?.entryRemainderCancelled!==true){
    let cancelled;
    try{cancelled=await this.cancel(operation.id);}
    catch(error){
     const current=this.ledger.operation(operation.id),currentOrder=this.ledger.order(operation.id);
     if(error.message!=='NO_UNFILLED_ENTRY'||currentOrder?.state!=='working'||units12(current.entryQuantity)!==units12(current.requestedQuantity))throw error;
    }
    if(cancelled){results.push(cancelled);if(cancelled.state!=='confirmed')return {state:'reconciliation_required',results,unresolvedOperationIds:unresolved()};}
   }
   // Cancellation can race another entry fill. Re-read its confirmed snapshot
   // before deciding the amount, then verify the whole exposure after the close.
   operation=this.ledger.operation(selected.id);
   const quantity=units12(operation.entryQuantity)-units12(operation.exitQuantity);
   if(quantity>0n){
    const text=(quantity/1000000000000n)+'.'+String(quantity%1000000000000n).padStart(12,'0');
    const result=await this.close(operation.id,text);results.push(result);
    if(result.state!=='confirmed')return {state:'reconciliation_required',results,unresolvedOperationIds:unresolved()};
   }
  }
  await this.reconcile();
  const remaining=unresolved();
  return {state:remaining.length?'reconciliation_required':operations.length?'confirmed':'no_owned_exposure',results,unresolvedOperationIds:remaining};
 }
}
