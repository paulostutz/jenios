import {rankUltraCandidates,sizeUltraPosition} from '../selection.mjs';
import {normalizeUltraConfig,assessUltraLeverage} from '../policy.mjs';
import {decideUltrafastDirection} from '../../research/robot-r18-ultrafast-foundation.mjs';
import {validateClosedTrade} from './reporting.mjs';
const fail=code=>{throw Object.assign(Error(code),{code});};
/** Offline integration kernel, not a certified live executor. Public CLI never starts it. */
export class UltraClientEngine {
 constructor({config,market,journal,adapter,now=Date.now,onWarning=async()=>false}){
  if(adapter?.executionEnvironment!=='offline_fixture')fail('EXECUTION_ADAPTER_NOT_RELEASED');
  this.config=normalizeUltraConfig(config);this.budget=this.config.markets.find(x=>x.id===market);
  if(!this.budget)fail('MARKET_NOT_SELECTED');this.journal=journal;this.adapter=adapter;this.now=now;this.onWarning=onWarning;
  this.deadline=0;this.busy=false;this.lastDecision=null;
 }
 async start({recover=false}={}){
  const now=this.now();this.journal.claim(now,{recover});
  const assessment=assessUltraLeverage(this.config);
  if(assessment.requiresAcknowledgement&&!await this.onWarning(assessment))fail('RISK_ACKNOWLEDGEMENT_REQUIRED');
  const ready=await this.adapter.inspect();
  if(ready.accountBinding!==this.journal.binding||ready.accountCurrency!==this.budget.currency||ready.tradingAllowed!==true||ready.protectionSupported!==true||ready.instrumentRulesVerified!==true)fail('BROKER_PREFLIGHT_REQUIRED');
  await this.reconcile();this.journal.resume();this.deadline=now+this.config.sessionMinutes*60000;
 }
 async reconcile(){
  for(const order of this.journal.pending()){
   if(order.state==='prepared'){this.journal.transition(order.id,'prepared','cancelled',{reason:'NOT_SENT_BEFORE_RECOVERY'},this.now());continue;}
   const result=await this.adapter.lookup(order.id,order.request,order.receipt);
   if(!result||result.scopeVerified!==true||!['working','closed','cancelled','rejected'].includes(result.state)){if(order.state!=='unknown')this.journal.transition(order.id,order.state,'unknown',{reason:'LOOKUP_UNCONFIRMED'},this.now());this.journal.pause();continue;}
   // A missing open order does not prove a closed position. Fills require a position receipt.
   if(['closed','cancelled','rejected'].includes(result.state)&&result.positionReconciled!==true){if(order.state!=='unknown')this.journal.transition(order.id,order.state,'unknown',{reason:'POSITION_UNCONFIRMED'},this.now());this.journal.pause();continue;}
   this.journal.transition(order.id,order.state,result.state,result,this.now());
  }
  const reports=await this.adapter.closedTrades();
  if(!Array.isArray(reports))fail('BROKER_HISTORY_UNAVAILABLE');
  for(const trade of reports){validateClosedTrade(trade);if(trade.market!==this.budget.id||trade.currency!==this.budget.currency)fail('BROKER_HISTORY_SCOPE_MISMATCH');this.journal.record(trade);}
 }
 async tick(){
  if(this.busy)return {state:'busy'};this.busy=true;
  try{
   const now=this.now();this.journal.heartbeat(now);
   await this.reconcile();await this.adapter.protectExisting();
   if(now>=this.deadline)this.journal.pause();
   if(this.journal.paused())return {state:'paused',positionsManaged:true};
   const account=await this.adapter.account();
   if(!account||account.accountBinding!==this.journal.binding||account.reconciled!==true||!Number.isFinite(account.freeMargin)||account.freeMargin<0||!Number.isFinite(account.realizedLossToday)||account.realizedLossToday<0||!Number.isFinite(account.openLoss)||account.openLoss<0||!Number.isSafeInteger(account.observedAtMs)||account.observedAtMs>now||now-account.observedAtMs>5000)fail('ACCOUNT_SNAPSHOT_UNAVAILABLE');
   if(account.realizedLossToday+account.openLoss>=this.budget.capital*this.config.dailyLossPct/100){this.journal.pause();return {state:'daily_limit',positionsManaged:true};}
   const active=this.journal.pending();
   if(active.length>=this.config.maxPositions||active.some(x=>['sending','unknown'].includes(x.state)))return {state:'awaiting_reconciliation'};
   const observations=await this.adapter.observations();const ranked=rankUltraCandidates(this.config,observations,this.now());
   for(const rank of ranked.filter(r=>r.eligible)){
    const x=observations.find(o=>o.market===rank.market&&o.symbol===rank.symbol);
    if(x.market!==this.budget.id||active.some(o=>o.request.symbol===x.symbol))continue;
    // The market adapter must supply measured inputs; no invented Forex order book.
    if(x.directionInputsVerified!==true||x.instrumentRulesVerified!==true)continue;
    const direction=decideUltrafastDirection({microMomentumBps:x.microMomentumBps,orderBookImbalance:x.orderBookImbalance,shortVolatilityBps:x.volatilityBps,roundTripCostBps:x.roundTripCostBps,spreadBps:x.spreadBps,quoteAgeMs:this.now()-x.observedAtMs});
    if(!direction.side)continue;
    const reserved=active.reduce((n,o)=>n+o.request.reservedMargin,0);
    const available=Math.max(0,Math.min(this.budget.capital-reserved,account.freeMargin-reserved));
    const sized=sizeUltraPosition({capital:this.budget.capital,leverage:this.budget.leverage,entryPrice:direction.side==='buy'?x.ask:x.bid,stopDistance:x.stopDistance,contractMultiplier:x.contractMultiplier,quoteToAccount:x.quoteToAccount,lotStep:x.lotStep,minLot:x.minLot,freeMargin:available,marginPerLot:x.marginPerLot,costPerLot:x.costPerLot,tradeRiskPct:this.config.tradeRiskPct,maxAssetPct:this.config.maxAssetPct});
    if(!sized.lots||!Number.isFinite(x.targetDistance)||x.targetDistance<=0||sized.notional+active.reduce((n,o)=>n+o.request.notional,0)>this.budget.capital*this.budget.leverage)continue;
    const decision={market:x.market,symbol:x.symbol,side:direction.side,quantity:sized.lots,entryPrice:direction.side==='buy'?x.ask:x.bid,stopDistance:x.stopDistance,targetDistance:x.targetDistance,reservedMargin:sized.lots*x.marginPerLot,notional:sized.notional,estimatedLoss:sized.estimatedLoss,currency:this.budget.currency,observedAtMs:x.observedAtMs,leverage:this.budget.leverage};
    const preflight=await this.adapter.preflight(decision);
    if(preflight?.allowed!==true||preflight?.protectionSupported!==true)continue;
    this.journal.heartbeat(this.now());const intent=this.journal.prepare(decision,this.now());if(!intent.created)continue;
    this.journal.transition(intent.id,'prepared','sending',null,this.now());
    try{
     const receipt=await this.adapter.submitProtected({...decision,clientOrderId:intent.id});
     const valid=receipt?.clientOrderId===intent.id&&receipt.scopeVerified===true&&receipt.protectionConfirmed===true;
     this.journal.transition(intent.id,'sending',valid?'working':'unknown',valid?receipt:{reason:'UNCONFIRMED_SUBMISSION'},this.now());
     if(!valid)this.journal.pause();return {state:valid?'submitted':'reconciliation_required',clientOrderId:intent.id};
    }catch{this.journal.transition(intent.id,'sending','unknown',{reason:'TRANSPORT_RESULT_UNKNOWN'},this.now());this.journal.pause();return {state:'reconciliation_required',clientOrderId:intent.id};}
   }
   return {state:'waiting_for_opportunity'};
  }catch(e){this.journal.pause();throw e;}finally{this.busy=false;}
 }
 pause(){this.journal.pause();}
 async closePositions(){this.pause();return this.adapter.closeOwnedPositions(this.journal.pending());}
}
