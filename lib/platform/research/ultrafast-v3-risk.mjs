/** R112 / Block 2 — offline portfolio stress & mark-to-market.
 * Input risk budget belongs to owner. Do not infer ability to stop at stopPrice.
 */
const fail=c=>{throw Object.assign(Error(c),{code:c});};
const f=x=>typeof x==='number'&&Number.isFinite(x);
const pos=x=>f(x)&&x>=0;
const round=x=>Number(x.toFixed(8));
export function markUltraSpotPortfolio({positions,nowMs,maxQuoteAgeMs=1000,exitFeeBps=3,
  gapStressBps=150}={}){
 if(!Array.isArray(positions)||positions.length>200||!Number.isSafeInteger(nowMs)||
   !Number.isSafeInteger(maxQuoteAgeMs)||maxQuoteAgeMs<1||!pos(exitFeeBps)||!pos(gapStressBps))
   fail('R112_MARK_INVALID_INPUT');
 let unrealized=0,stressLoss=0,exposure=0;const issues=[],seen=new Set(),rows=[];
 for(const p of positions){
   if(!p||typeof p.symbol!=='string'||!p.symbol||seen.has(p.symbol)||
      !f(p.quantity)||p.quantity<=0||!f(p.entryPrice)||p.entryPrice<=0||
      !f(p.bid)||p.bid<=0||!Number.isSafeInteger(p.quoteAtMs)||p.quoteAtMs>nowMs||
      !f(p.stopPrice)||p.stopPrice<=0)fail('R112_MARK_INVALID_POSITION');
   seen.add(p.symbol);
   if(nowMs-p.quoteAtMs>maxQuoteAgeMs)issues.push('STALE_MARK_'+p.symbol);
   if(p.stopPrice>=p.bid)issues.push('STOP_ABOVE_OR_AT_BID_'+p.symbol);
   const markValue=p.quantity*p.bid;
   const entryValue=p.quantity*p.entryPrice;
   const afterExit=markValue*(1-exitFeeBps/10000);
   const pnl=afterExit-entryValue;
   // Conservative stop scenario: lower of current bid and stop, then gap below it.
   const stressedExit=Math.min(p.bid,p.stopPrice)*Math.max(0,1-gapStressBps/10000);
   const stressedValue=p.quantity*stressedExit*(1-exitFeeBps/10000);
   const lossFromMarkedEquity=Math.max(0,afterExit-stressedValue);
   exposure+=markValue;unrealized+=pnl;stressLoss+=lossFromMarkedEquity;
   rows.push(Object.freeze({symbol:p.symbol,markValueUsd:round(markValue),
      unrealizedPnlUsd:round(pnl),additionalGapStopRiskUsd:round(lossFromMarkedEquity),
      stressedExitPrice:round(stressedExit)}));
 }
 return Object.freeze({schema:'JENIOS_R112_MARK_TO_MARKET_V1',allow:issues.length===0,
   issues:Object.freeze(issues),positions:Object.freeze(rows),grossExposureUsd:round(exposure),
   unrealizedPnlUsd:round(unrealized),additionalGapStopRiskUsd:round(stressLoss),
   cashNotVerified:true,markNotBrokerConfirmed:true,actualBrokerPnl:null,
   ordersSent:0});
}

export function assessUltraStressBudget({baseEquityUsd,mark,realizedSessionLossUsd,
 realizedDailyLossUsd,pendingOrderWorstLossUsd,pendingNotionalUsd,
 proposedNotionalUsd,proposedStopBps,gapBps,slippageBps,exitFeeBps,
 correlatedExposureUsd,maxTradeLossPct,maxSessionLossPct,maxDailyLossPct,
 maxGrossExposurePct,maxCorrelatedExposurePct,exchangeHealthy,ownerStopped}={}){
 const vals=[baseEquityUsd,realizedSessionLossUsd,realizedDailyLossUsd,pendingOrderWorstLossUsd,
   pendingNotionalUsd,proposedNotionalUsd,proposedStopBps,gapBps,slippageBps,exitFeeBps,
   correlatedExposureUsd,maxTradeLossPct,maxSessionLossPct,maxDailyLossPct,
   maxGrossExposurePct,maxCorrelatedExposurePct];
 if(vals.some(v=>!pos(v))||baseEquityUsd<=0||proposedNotionalUsd<=0||
    !mark||mark.schema!=='JENIOS_R112_MARK_TO_MARKET_V1'||
    typeof exchangeHealthy!=='boolean'||typeof ownerStopped!=='boolean'||
    maxTradeLossPct>5||maxSessionLossPct>10||maxDailyLossPct>20||
    maxGrossExposurePct>300||maxCorrelatedExposurePct>300||
    maxTradeLossPct<=0||maxSessionLossPct<=0||maxDailyLossPct<=0)
   fail('R112_STRESS_INVALID_INPUT');
 const issues=[];
 if(!mark.allow)issues.push('UNVERIFIED_POSITIONS_OR_MARKS');
 if(!exchangeHealthy)issues.push('EXCHANGE_UNHEALTHY');
 if(ownerStopped)issues.push('OWNER_STOPPED');
 const markedEquity=baseEquityUsd+mark.unrealizedPnlUsd;
 if(markedEquity<=0)issues.push('EQUITY_EXHAUSTED');
 // Include current mark-to-market shortfall and incremental stop/gap losses.
 const openLossUsd=Math.max(0,-mark.unrealizedPnlUsd);
 const atRiskOpen=mark.additionalGapStopRiskUsd;
 const proposedWorstLossUsd=proposedNotionalUsd*(proposedStopBps+gapBps+slippageBps+exitFeeBps)/10000;
 const pendingPlusOpen=pendingOrderWorstLossUsd+openLossUsd+atRiskOpen;
 const atRiskSession=realizedSessionLossUsd+pendingPlusOpen+proposedWorstLossUsd;
 const atRiskDay=realizedDailyLossUsd+pendingPlusOpen+proposedWorstLossUsd;
 const exposure=(mark.grossExposureUsd+pendingNotionalUsd+proposedNotionalUsd);
 const correlated=correlatedExposureUsd+proposedNotionalUsd;
 const pct=x=>x/baseEquityUsd*100;
 if(pct(proposedWorstLossUsd)>maxTradeLossPct)issues.push('PROPOSED_TRADE_STRESS_EXCEEDED');
 if(pct(atRiskSession)>maxSessionLossPct)issues.push('SESSION_STRESS_EXCEEDED');
 if(pct(atRiskDay)>maxDailyLossPct)issues.push('DAILY_STRESS_EXCEEDED');
 if(pct(exposure)>maxGrossExposurePct)issues.push('GROSS_EXPOSURE_EXCEEDED');
 if(pct(correlated)>maxCorrelatedExposurePct)issues.push('CORRELATED_EXPOSURE_EXCEEDED');
 return Object.freeze({schema:'JENIOS_R112_STRESS_BUDGET_V1',allowFurtherResearch:issues.length===0,
   issues:Object.freeze([...new Set(issues)]),markedEquityUsd:round(markedEquity),
   openUnrealizedLossUsd:round(openLossUsd),openGapRiskUsd:round(atRiskOpen),
   proposedWorstCaseLossUsd:round(proposedWorstLossUsd),
   sessionWorstCaseLossUsd:round(atRiskSession),dailyWorstCaseLossUsd:round(atRiskDay),
   totalExposureUsd:round(exposure),correlatedExposureUsd:round(correlated),
   stopIsNotGuaranteed:true,liveExecutionEnabled:false,ordersSent:0});
}

/** Allocator: suggest per-symbol weights subject to owner-provided stress caps. */
export function suggestUltraCapitalWeights(candidates,{maximumPerAssetPct=20,
  totalAllocationPct=60,clusterMaximumPct=35}={}){
 if(!Array.isArray(candidates)||candidates.length<1||candidates.length>100||
   !pos(maximumPerAssetPct)||!pos(totalAllocationPct)||!pos(clusterMaximumPct)||
   maximumPerAssetPct>100||totalAllocationPct>100||clusterMaximumPct>100)
   fail('R112_ALLOC_INVALID_INPUT');
 const names=new Set(),valid=[];
 for(const c of candidates){
   if(!c||typeof c.symbol!=='string'||!c.symbol||names.has(c.symbol)||
      typeof c.riskCluster!=='string'||!c.riskCluster||!pos(c.score)||
      typeof c.eligible!=='boolean')fail('R112_ALLOC_INVALID_CANDIDATE');
   names.add(c.symbol); if(c.eligible)valid.push(c);
 }
 valid.sort((a,b)=>b.score-a.score||a.symbol.localeCompare(b.symbol));
 const remainingByCluster=new Map(),rows=[];let remaining=totalAllocationPct;
 const totalScore=valid.reduce((s,c)=>s+c.score,0);
 for(const c of valid){
   const assigned=remainingByCluster.get(c.riskCluster)||0;
   const raw=totalScore?totalAllocationPct*c.score/totalScore:0;
   const weight=Math.max(0,Math.min(raw,maximumPerAssetPct,clusterMaximumPct-assigned,remaining));
   remaining-=weight;remainingByCluster.set(c.riskCluster,assigned+weight);
   rows.push(Object.freeze({symbol:c.symbol,riskCluster:c.riskCluster,
     recommendedResearchWeightPct:round(weight)}));
 }
 return Object.freeze({schema:'JENIOS_R112_ALLOCATION_V1',weights:Object.freeze(rows),
  unallocatedCapitalPct:round(100-rows.reduce((s,r)=>s+r.recommendedResearchWeightPct,0)),
  reallocationRequiresNewEvidence:true,noPositionChanges:true,ordersSent:0});
}