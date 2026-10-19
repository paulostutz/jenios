/** B83: next-bar long-only paper replay with fees, slippage and stop losses.
 * Illustrative hypothesis independent of protected JENIOS robots.
 * Price signals use only bars <= i-1; hypothetical fills occur on bar i.
 */
import {inspectHistoricalBars} from './historical-quality.mjs';
const avg=a=>a.reduce((s,v)=>s+v,0)/a.length;
const fixed=(x,n=4)=>Number(x.toFixed(n));
const valid=(x,lower,upper)=>typeof x==='number'&&Number.isFinite(x)&&x>=lower&&x<=upper;
export function replayHistoricalScenario(input,{now=Date.now(),mode='direto',
 initialBalance=100000,allocationPct=0.1,feeBps=5,slippageBps=5,stopPct=0.02}={}){
 if(!['direto','reverso','hibrido'].includes(mode)||!valid(initialBalance,100,100000000)
  ||!valid(allocationPct,0.001,0.25)||!valid(feeBps,0,300)
  ||!valid(slippageBps,0,300)||!valid(stopPct,0.001,0.1))
  throw Error('INVALID_PAPER_CONFIGURATION');
 const quality=inspectHistoricalBars(input,{now});
 if(!quality.replayEligible)return {
  ok:false,reason:'HISTORICAL_DATA_QUALITY_FAILED',quality:{
   observations:quality.count,warnings:quality.warnings,gaps:quality.gaps.length},
  realExecutionAllowed:false,providerVerified:false
 };
 const rows=quality.bars,closes=rows.map(x=>x.close);
 const evaluationStart=Math.max(60,Math.floor(rows.length*0.7));
 const charges=feeBps/10000,slippage=slippageBps/10000;
 let cash=initialBalance,quantity=0,position=null;
 let peak=initialBalance,maxDrawdown=0,entries=0,stops=0;
 const paperFills=[],equityCurve=[];
 for(let i=evaluationStart;i<rows.length;i++){
  const current=rows[i],previous=closes[i-1],before=closes[i-2];
  // The latest available signal is the previous candle's close.
  const fast=avg(closes.slice(i-20,i)),slow=avg(closes.slice(i-50,i));
  const shortSlope=previous-before;
  const trend=fast>slow?'up':fast<slow?'down':'flat';
  const hypothesis=mode==='direto'?trend==='up':
   mode==='reverso'?trend==='down'&&shortSlope>0:
   trend==='up'||(trend==='down'&&shortSlope>0&&previous>avg(closes.slice(i-5,i)));
  let closedThisBar=false;
  if(position){
   if(!hypothesis){
    const price=current.open*(1-slippage);
    const gross=quantity*price,fee=gross*charges;
    const net=gross-fee;
    cash+=net;
    paperFills.push({kind:'exit',reason:'prior_bar_signal',decisionBar:i-1,fillBar:i,
      price:fixed(price),quantity:fixed(quantity,8),fee:fixed(fee),paperPnl:fixed(net-position.totalCost)});
    quantity=0;position=null;closedThisBar=true;
   }else if(current.low<=position.stop){
    const reference=current.open<position.stop?current.open:position.stop;
    const price=reference*(1-slippage);
    const gross=quantity*price,fee=gross*charges,net=gross-fee;
    cash+=net;stops++;
    paperFills.push({kind:'exit',reason:'intrabar_stop_conservative',decisionBar:i-1,fillBar:i,
      price:fixed(price),quantity:fixed(quantity,8),fee:fixed(fee),paperPnl:fixed(net-position.totalCost)});
    quantity=0;position=null;closedThisBar=true;
   }
  }
  if(!position&&!closedThisBar&&hypothesis){
   const openWithSlippage=current.open*(1+slippage);
   const budget=Math.min(cash*allocationPct,cash/(1+charges));
   const fee=budget*charges;
   if(budget>=1&&budget+fee<=cash){
    quantity=budget/openWithSlippage;cash-=budget+fee;entries++;
    position={entryIndex:i,totalCost:budget+fee,
      stop:openWithSlippage*(1-stopPct),entryPrice:openWithSlippage};
    paperFills.push({kind:'entry',reason:'previous_close_hypothesis',decisionBar:i-1,fillBar:i,
      price:fixed(openWithSlippage),quantity:fixed(quantity,8),fee:fixed(fee)});
    // If the next unseen intrabar low hits the stop in the same candle,
    // pessimistically close rather than granting a risk-free holding period.
    if(current.low<=position.stop){
     const exitRef=current.open<position.stop?current.open:position.stop;
     const exitPrice=exitRef*(1-slippage),gross=quantity*exitPrice,
      exitFee=gross*charges,net=gross-exitFee;
     cash+=net;stops++;
     paperFills.push({kind:'exit',reason:'entry_bar_stop_conservative',
      decisionBar:i-1,fillBar:i,price:fixed(exitPrice),
      quantity:fixed(quantity,8),fee:fixed(exitFee),paperPnl:fixed(net-position.totalCost)});
     quantity=0;position=null;
    }
   }
  }
  const equity=cash+quantity*current.close;
  peak=Math.max(peak,equity);
  maxDrawdown=Math.max(maxDrawdown,peak>0?(peak-equity)/peak:0);
  equityCurve.push({barIndex:i,time:current.time,hypotheticalEquity:fixed(equity)});
 }
 const equity=cash+quantity*rows.at(-1).close;
 const closed=paperFills.filter(x=>x.kind==='exit');
 const baseline=100*(rows.at(-1).close/rows[evaluationStart].open-1);
 return Object.freeze({
  ok:true,source:'unverified_historical_bar_replay',providerVerified:false,live:false,
  strategy:'illustrative_sma_hypothesis_not_protected_robot',mode,
  evaluationStart,evaluationBars:rows.length-evaluationStart,holdoutOnly:true,
  hypothesisTimedAt:'previous_bar_close',fillAssumption:'next_bar_open_with_costs_and_conservative_stop',
  firstEvaluation:rows[evaluationStart].time,lastEvaluation:rows.at(-1).time,
  initialBalance,assumptions:{allocationPct,feeBps,slippageBps,stopPct},
  hypotheticalFinalEquity:fixed(equity),
  hypotheticalReturnPct:fixed(100*(equity/initialBalance-1)),
  hypotheticalBenchmarkPct:fixed(baseline),
  hypotheticalMaxDrawdownPct:fixed(maxDrawdown*100),
  entries,closedTrades:closed.length,paperStops:stops,openPosition:position!==null,
  paperFills,equityCurve,
  orderAuthorized:false,brokerConnected:false,verifiedProfit:null,avoidedLoss:null,
  caution:'Resultado hipotético em dados importados não verificados; sem validação prospectiva, liquidez real, spread variável, execução real ou garantia de desempenho.'
 });
}
