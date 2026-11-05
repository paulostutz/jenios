/**
 * R21 — UltraFast crypto ranking & execution capacity model.
 * Offline/synthetic inputs only.
 */
const fail=c=>{throw Object.assign(new Error(c),{code:c});};
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));

export function estimateFillProbability(x){
 if(!x||!finite(x.depthUsd)||x.depthUsd<0||!finite(x.queueAheadUsd)||x.queueAheadUsd<0||
  !finite(x.tradeFlowPerSecUsd)||x.tradeFlowPerSecUsd<0||!Number.isSafeInteger(x.horizonMs)||x.horizonMs<1||
  !Number.isSafeInteger(x.latencyMs)||x.latencyMs<0) fail('R21_INVALID_FILL_INPUT');
 const available=Math.max(0,x.tradeFlowPerSecUsd*(x.horizonMs/1000)-x.queueAheadUsd);
 const latencyPenalty=Math.exp(-Math.max(0,x.latencyMs-50)/600);
 const depthPenalty=x.depthUsd<=0?0:clamp(1-(x.queueAheadUsd/x.depthUsd)*.5,0,1);
 return Object.freeze({
  fillProbability:Number(clamp((available/(available+Math.max(1,x.queueAheadUsd+1)))*latencyPenalty*depthPenalty,0,1).toFixed(6))
 });
}

export function queueDeterioration({initialQueueAheadUsd,cancelReplaceCount,latencyMs,volatilityBps}={}){
 if(!finite(initialQueueAheadUsd)||initialQueueAheadUsd<0||!Number.isSafeInteger(cancelReplaceCount)||cancelReplaceCount<0||
  !Number.isSafeInteger(latencyMs)||latencyMs<0||!finite(volatilityBps)||volatilityBps<0)
  fail('R21_INVALID_QUEUE_INPUT');
 const multiplier=1+cancelReplaceCount*.12+Math.max(0,latencyMs-50)/1000*.25+volatilityBps/1000;
 return Object.freeze({effectiveQueueAheadUsd:Number((initialQueueAheadUsd*multiplier).toFixed(6)),multiplier:Number(multiplier.toFixed(6))});
}

export function rateLimitGate({requestsLastSecond,requestsLastMinute,maxPerSecond,maxPerMinute,rejectionsLastMinute}={}){
 for(const x of [requestsLastSecond,requestsLastMinute,maxPerSecond,maxPerMinute,rejectionsLastMinute])
  if(!Number.isSafeInteger(x)||x<0)fail('R21_INVALID_RATE_INPUT');
 const reasons=[];
 if(requestsLastSecond>=maxPerSecond)reasons.push('SECOND_RATE_LIMIT');
 if(requestsLastMinute>=maxPerMinute)reasons.push('MINUTE_RATE_LIMIT');
 if(rejectionsLastMinute>=5)reasons.push('BROKER_REJECTION_CLUSTER');
 return Object.freeze({allow:reasons.length===0,reasons:Object.freeze(reasons),ordersSent:0});
}

export function rankCryptoAssets(rows=[]){
 if(!Array.isArray(rows)||rows.length<1||rows.length>1000)fail('R21_INVALID_ASSET_ROWS');
 const scored=rows.map(x=>{
  if(!x||typeof x.symbol!=='string'||!/^[A-Z0-9-]{3,20}$/.test(x.symbol)||
   !finite(x.spreadBps)||x.spreadBps<0||!finite(x.volatilityBps)||x.volatilityBps<0||
   !finite(x.depthUsd)||x.depthUsd<0||!finite(x.tradesPerMinute)||x.tradesPerMinute<0||
   !finite(x.roundTripCostBps)||x.roundTripCostBps<0||!finite(x.fillProbability)||x.fillProbability<0||x.fillProbability>1)
   fail('R21_INVALID_ASSET_ROW');
  const edge=Math.max(0,x.volatilityBps-x.roundTripCostBps*1.75);
  const liquidity=Math.min(1,x.depthUsd/2_000_000);
  const activity=Math.min(1,x.tradesPerMinute/180);
  const spreadPenalty=Math.min(1,x.spreadBps/20);
  const score=edge*.35+liquidity*20+activity*20+x.fillProbability*20-spreadPenalty*10;
  const eligible=x.depthUsd>=100000&&x.tradesPerMinute>=10&&edge>0&&x.fillProbability>=.25;
  return Object.freeze({...x,eligible,score:Number(score.toFixed(6))});
 });
 return Object.freeze([...scored].sort((a,b)=>b.score-a.score||a.symbol.localeCompare(b.symbol)));
}

export function simulateHighTurnoverSession({attempts,perTradeCostR,maxDrawdownR,maxConsecutiveLosses}={}){
 if(!Array.isArray(attempts)||attempts.length<1||attempts.length>20000||!finite(perTradeCostR)||perTradeCostR<0||
   !finite(maxDrawdownR)||maxDrawdownR<=0||!Number.isSafeInteger(maxConsecutiveLosses)||maxConsecutiveLosses<1)
   fail('R21_INVALID_HIGH_TURNOVER');
 let realized=0,peak=0,dd=0,trades=0,lossStreak=0,haltReason=null;
 for(const a of attempts){
  if(!a||!finite(a.grossR)||typeof a.execute!=='boolean')fail('R21_INVALID_ATTEMPT');
  if(!a.execute)continue;
  const net=a.grossR-perTradeCostR;
  realized+=net;trades++;
  lossStreak=net<0?lossStreak+1:0;
  peak=Math.max(peak,realized);dd=Math.max(dd,peak-realized);
  if(dd>=maxDrawdownR){haltReason='DRAWDOWN_LIMIT';break;}
  if(lossStreak>=maxConsecutiveLosses){haltReason='LOSS_STREAK_LIMIT';break;}
 }
 return Object.freeze({trades,realizedSyntheticR:Number(realized.toFixed(6)),maxSyntheticDrawdownR:Number(dd.toFixed(6)),haltReason,
   actualBrokerPnl:null,ordersSent:0,paperOrdersSent:0});
}
