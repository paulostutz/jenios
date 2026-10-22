/**
 * R23 — multiwindow UltraFast ranking and availability/stress model.
 * Offline/read-only evidence model. No authenticated transport or order submission.
 */
import {compareMakerTakerEconomics} from './robot-r22-public-crypto-ranking.mjs';

const fail=c=>{throw Object.assign(new Error(c),{code:c});};
const finite=x=>typeof x==='number'&&Number.isFinite(x);

export function aggregateMultiwindowAsset(rows=[]){
 if(!Array.isArray(rows)||rows.length<2||rows.length>5000)fail('R23_INVALID_WINDOWS');
 const symbol=rows[0]?.symbol,provider=rows[0]?.provider;
 if(typeof symbol!=='string'||typeof provider!=='string')fail('R23_INVALID_WINDOWS');
 let score=0,eligible=0,spread=0,vol=0,depth=0,activity=0,fill=0;
 for(const r of rows){
  if(!r||r.symbol!==symbol||r.provider!==provider||
   !finite(r.score)||!finite(r.spreadBps)||!finite(r.shortVolatilityBps)||
   !finite(r.depthUsd)||!finite(r.tradesPerMinute)||!finite(r.fillProbability)||
   typeof r.eligible!=='boolean')fail('R23_INCONSISTENT_WINDOW');
  score+=r.score; spread+=r.spreadBps; vol+=r.shortVolatilityBps;
  depth+=r.depthUsd; activity+=r.tradesPerMinute; fill+=r.fillProbability;
  if(r.eligible)eligible++;
 }
 const n=rows.length;
 const eligibleRatio=eligible/n;
 const stabilityPenalty=Math.max(0,1-eligibleRatio)*25;
 const aggregateScore=score/n-stabilityPenalty;
 return Object.freeze({
  schema:'JENIOS_R23_MULTIWINDOW_ASSET_V1',symbol,provider,windows:n,
  eligibleWindows:eligible,eligibleRatio:Number(eligibleRatio.toFixed(6)),
  avgScore:Number((score/n).toFixed(6)),
  avgSpreadBps:Number((spread/n).toFixed(6)),
  avgShortVolatilityBps:Number((vol/n).toFixed(6)),
  avgDepthUsd:Number((depth/n).toFixed(2)),
  avgTradesPerMinute:Number((activity/n).toFixed(6)),
  avgFillProbability:Number((fill/n).toFixed(6)),
  aggregateScore:Number(aggregateScore.toFixed(6)),
  eligible:eligibleRatio>=.67,
  ordersSent:0
 });
}

export function availabilityGate({symbol,marketStatus,symbolStatus,maintenance,sourceAgeMs}={}){
 if(typeof symbol!=='string'||!/^[A-Z0-9-]{3,20}$/.test(symbol)||
   !['open','closed','unknown'].includes(marketStatus)||
   !['online','offline','unknown'].includes(symbolStatus)||
   typeof maintenance!=='boolean'||!Number.isSafeInteger(sourceAgeMs)||sourceAgeMs<0)
   fail('R23_INVALID_AVAILABILITY');
 const reasons=[];
 if(marketStatus!=='open')reasons.push('MARKET_NOT_OPEN');
 if(symbolStatus!=='online')reasons.push('SYMBOL_NOT_ONLINE');
 if(maintenance)reasons.push('MAINTENANCE');
 if(sourceAgeMs>3000)reasons.push('STATUS_STALE');
 return Object.freeze({allow:reasons.length===0,reasons:Object.freeze(reasons),ordersSent:0});
}

export function compareAssetExecutionStyle(x){
 if(!x||!finite(x.spreadBps)||!finite(x.makerFeeBps)||!finite(x.takerFeeBps)||
   !finite(x.slippageBps)||!finite(x.fillProbability)||!finite(x.adverseSelectionBps))
   fail('R23_INVALID_EXECUTION_STYLE');
 const base=compareMakerTakerEconomics(x);
 const makerAdj=base.makerExpectedCostBps + (1-x.fillProbability)*Math.max(0,x.adverseSelectionBps);
 const takerAdj=base.takerCostBps + Math.max(0,x.adverseSelectionBps)*.25;
 return Object.freeze({
  schema:'JENIOS_R23_EXECUTION_STYLE_V1',
  makerAdjustedCostBps:Number(makerAdj.toFixed(6)),
  takerAdjustedCostBps:Number(takerAdj.toFixed(6)),
  preferred:makerAdj<takerAdj?'maker':'taker',
  actualBrokerPnl:null,ordersSent:0
 });
}

export function runTurnoverStress({attempts,edgeR,costR,winRate,maxDrawdownR,maxLossStreak}={}){
 if(!Number.isSafeInteger(attempts)||attempts<10000||attempts>20000||
   !finite(edgeR)||!finite(costR)||!finite(winRate)||winRate<0||winRate>1||
   !finite(maxDrawdownR)||maxDrawdownR<=0||
   !Number.isSafeInteger(maxLossStreak)||maxLossStreak<1)fail('R23_INVALID_STRESS');
 let r=0,peak=0,dd=0,losses=0,trades=0,haltReason=null;
 for(let i=0;i<attempts;i++){
   // deterministic pseudo-outcome, no randomness.
   const win=((i*1103515245+12345)>>>0)%100000 < Math.round(winRate*100000);
   const net=(win?edgeR:-edgeR)-costR;
   r+=net; trades++;
   losses=net<0?losses+1:0;
   peak=Math.max(peak,r); dd=Math.max(dd,peak-r);
   if(dd>=maxDrawdownR){haltReason='DRAWDOWN_LIMIT';break;}
   if(losses>=maxLossStreak){haltReason='LOSS_STREAK_LIMIT';break;}
 }
 return Object.freeze({
  schema:'JENIOS_R23_HIGH_TURNOVER_STRESS_V1',
  attemptsRequested:attempts,tradesExecuted:trades,
  realizedSyntheticR:Number(r.toFixed(6)),
  maxSyntheticDrawdownR:Number(dd.toFixed(6)),
  haltReason,
  actualBrokerPnl:null,ordersSent:0,paperOrdersSent:0
 });
}

export function rankMultiwindowAssets(groups=[]){
 if(!Array.isArray(groups)||groups.length<1||groups.length>200)fail('R23_INVALID_GROUPS');
 const rows=groups.map(aggregateMultiwindowAsset);
 return Object.freeze([...rows].sort((a,b)=>b.aggregateScore-a.aggregateScore||a.symbol.localeCompare(b.symbol)));
}
