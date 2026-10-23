/**
 * R20 — UltraFast execution microstructure simulator.
 * Offline synthetic execution only; does not submit Paper or real broker orders.
 */
const fail=c=>{throw Object.assign(new Error(c),{code:c});};
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));

export function simulateMicroExecution(x){
 if(!x||!['maker','taker'].includes(x.orderStyle)||!['buy','sell'].includes(x.side)||
  !finite(x.notionalUsd)||x.notionalUsd<=0||
  !finite(x.spreadBps)||x.spreadBps<0||
  !finite(x.makerFeeBps)||x.makerFeeBps<0||
  !finite(x.takerFeeBps)||x.takerFeeBps<0||
  !finite(x.slippageBps)||x.slippageBps<0||
  !finite(x.queueAheadUsd)||x.queueAheadUsd<0||
  !finite(x.tradeFlowUsd)||x.tradeFlowUsd<0||
  !Number.isSafeInteger(x.latencyMs)||x.latencyMs<0||
  !Number.isSafeInteger(x.cancelAfterMs)||x.cancelAfterMs<1||
  !finite(x.adverseMoveBps))
  fail('R20_INVALID_MICRO_INPUT');

 const stalePenalty=Math.max(0,(x.latencyMs-100)/1000*2);
 const fee=x.orderStyle==='maker'?x.makerFeeBps:x.takerFeeBps;
 let fillRatio;
 if(x.orderStyle==='taker') fillRatio=1;
 else fillRatio=clamp((x.tradeFlowUsd-x.queueAheadUsd)/Math.max(1,x.notionalUsd),0,1);

 const timedOut=x.orderStyle==='maker'&&x.latencyMs>x.cancelAfterMs;
 if(timedOut)fillRatio=0;

 const partial=fillRatio>0&&fillRatio<1;
 const executionCostBps=fee + (x.orderStyle==='taker'?x.spreadBps/2+x.slippageBps:0) + stalePenalty;
 const adverseAfterLatencyBps=x.adverseMoveBps + stalePenalty;
 const needsCancelReplace=x.orderStyle==='maker'&&(fillRatio<1||timedOut);

 return Object.freeze({
  schema:'JENIOS_R20_MICRO_EXECUTION_V1',
  fillRatio:Number(fillRatio.toFixed(6)),
  partialFill:partial,
  timedOut,
  needsCancelReplace,
  executionCostBps:Number(executionCostBps.toFixed(6)),
  adverseAfterLatencyBps:Number(adverseAfterLatencyBps.toFixed(6)),
  queuePositionModeled:x.orderStyle==='maker',
  brokerReceiptVerified:false,
  actualBrokerPnl:null,
  ordersSent:0,paperOrdersSent:0
 });
}

export function simulateTimedUltraSession({durationSec,marketCloseInSec,maxTrades,drawdownLimitPct,
 events}={}){
 if(!Number.isSafeInteger(durationSec)||durationSec<1||durationSec>86400||
  !Number.isSafeInteger(marketCloseInSec)||marketCloseInSec<0||
  !Number.isSafeInteger(maxTrades)||maxTrades<1||maxTrades>100000||
  !finite(drawdownLimitPct)||drawdownLimitPct<=0||drawdownLimitPct>10||
  !Array.isArray(events)||events.length>100000) fail('R20_INVALID_SESSION');

 const stopAt=Math.min(durationSec,marketCloseInSec);
 let realizedR=0,peakR=0,drawdownPct=0,trades=0,haltReason=null,partialFills=0,cancelReplaces=0;
 for(const e of events){
  if(!e||!Number.isSafeInteger(e.atSec)||e.atSec<0||!finite(e.resultR)||
   !finite(e.fillRatio)||e.fillRatio<0||e.fillRatio>1||typeof e.cancelReplace!=='boolean')
   fail('R20_INVALID_SESSION_EVENT');
  if(e.atSec>=stopAt){haltReason='TIME_OR_MARKET_CLOSE';break;}
  if(trades>=maxTrades){haltReason='MAX_TRADES';break;}
  realizedR+=e.resultR*e.fillRatio;
  trades++;
  if(e.fillRatio<1)partialFills++;
  if(e.cancelReplace)cancelReplaces++;
  peakR=Math.max(peakR,realizedR);
  drawdownPct=Math.max(drawdownPct,(peakR-realizedR));
  if(drawdownPct>=drawdownLimitPct){haltReason='DRAWDOWN_LIMIT';break;}
 }
 return Object.freeze({
  schema:'JENIOS_R20_TIMED_SESSION_V1',
  stopAtSec:stopAt,trades,realizedSyntheticR:Number(realizedR.toFixed(6)),
  maxSyntheticDrawdownR:Number(drawdownPct.toFixed(6)),
  partialFills,cancelReplaces,haltReason,
  actualBrokerPnl:null,ordersSent:0,paperOrdersSent:0
 });
}

export function runR20MicrostructureSweep(){
 let total=0,partial=0,cancel=0,timeouts=0,taker=0,maker=0;
 for(const orderStyle of ['maker','taker'])
 for(const spreadBps of [1,2,4,8,12])
 for(const makerFeeBps of [0,1,2])
 for(const takerFeeBps of [2,4,8])
 for(const slippageBps of [1,2,4])
 for(const queueAheadUsd of [0,1000,10000,100000])
 for(const tradeFlowUsd of [1000,5000,25000,150000])
 for(const latencyMs of [20,80,150,500,1500])
 for(const cancelAfterMs of [100,500,2000])
 for(const adverseMoveBps of [-6,0,6]){
  total++;
  const r=simulateMicroExecution({orderStyle,side:'buy',notionalUsd:5000,spreadBps,
   makerFeeBps,takerFeeBps,slippageBps,queueAheadUsd,tradeFlowUsd,latencyMs,cancelAfterMs,adverseMoveBps});
  if(r.partialFill)partial++;
  if(r.needsCancelReplace)cancel++;
  if(r.timedOut)timeouts++;
  if(orderStyle==='maker')maker++;else taker++;
 }
 return Object.freeze({total,partial,cancel,timeouts,maker,taker,ordersSent:0,paperOrdersSent:0,actualBrokerPnl:null});
}
