/**
 * JENIOS UltraFast V2 — Block 3, deterministic no-network shadow research.
 * Uses NEXT observation for hypothetical entries (no entry at signal timestamp).
 * Does not model actual order-book queue, market impact or broker performance.
 */
const fail=code=>{throw Object.assign(new Error(code),{code});};
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const round=x=>Number(x.toFixed(8));
export const ULTRA_V2_SHADOW_SPEC=Object.freeze({schema:'JENIOS_ULTRA_V2_SHADOW_V1',
 financialPerformanceCertified:false,externalPaperEnabled:false,
 liveExecutionEnabled:false,autoParameterPromotion:false,ordersSent:0});

export function replayUltraShadowSession(ticks,{startingCashUsd=10_000,tradeNotionalUsd=500,
 stopLossBps=20,takeProfitBps=35,feePerSideBps=2,slippagePerSideBps=1,
 maxTrades=25,maxSessionLossPct=2}={}) {
 if(!Array.isArray(ticks)||ticks.length<2||ticks.length>100_000||
  !finite(startingCashUsd)||startingCashUsd<=0||
  !finite(tradeNotionalUsd)||tradeNotionalUsd<=0||tradeNotionalUsd>startingCashUsd||
  !finite(stopLossBps)||stopLossBps<=0||!finite(takeProfitBps)||takeProfitBps<=0||
  !finite(feePerSideBps)||feePerSideBps<0||!finite(slippagePerSideBps)||slippagePerSideBps<0||
  !Number.isSafeInteger(maxTrades)||maxTrades<1||maxTrades>10000||
  !finite(maxSessionLossPct)||maxSessionLossPct<=0||maxSessionLossPct>20)
  fail('ULTRA_V2_SHADOW_INVALID_CONFIG');
 const clean=[];
 let lastTime=-1;
 for(const t of ticks){
  if(!t||!Number.isSafeInteger(t.timestampMs)||t.timestampMs<=lastTime||
   !finite(t.bid)||t.bid<=0||!finite(t.ask)||t.ask<t.bid||
   !['buy','sell','wait'].includes(t.signal))fail('ULTRA_V2_SHADOW_INVALID_TICK');
  lastTime=t.timestampMs;clean.push(t);
 }
 const entryFeeFactor=feePerSideBps/10000,slipFactor=slippagePerSideBps/10000;
 let cash=startingCashUsd,open=null,peakEquity=startingCashUsd,maxDrawdownUsd=0,
  blockedSignals=0,entries=0,halted=false,totalFees=0,totalSlippage=0;
 const trades=[],equityCurve=[];
 let pending=null;
 const exit=(t,reason)=>{
  // Hypothetical crossing at observable bid, with an extra slippage haircut.
  const exitPrice=t.bid*(1-slipFactor);
  const grossProceeds=open.quantity*exitPrice;
  const exitFee=grossProceeds*entryFeeFactor;
  cash+=grossProceeds-exitFee;
  const pnlUsd=grossProceeds-exitFee-open.totalEntryCost;
  const slippageUsd=open.quantity*t.bid*slipFactor;
  totalSlippage+=slippageUsd;
  totalFees+=exitFee;
  trades.push(Object.freeze({entryTimestampMs:open.entryTimestampMs,
   exitTimestampMs:t.timestampMs,quantity:round(open.quantity),entryPrice:round(open.entryPrice),
   exitPrice:round(exitPrice),grossReferenceMoveUsd:round(open.quantity*(t.bid-open.entryPrice)),
   pnlNetUsd:round(pnlUsd),costUsd:round(open.entryFee+exitFee),exitReason:reason}));
  open=null;
 };
 for(let i=0;i<clean.length;i++){
  const t=clean[i];
  if(open){
   const move=(t.bid/open.entryPrice-1)*10000;
   if(move<=-stopLossBps)exit(t,'STOP');
   else if(move>=takeProfitBps)exit(t,'TARGET');
  }
  if(i < clean.length-1 && !open&&pending==='buy'&&!halted&&entries<maxTrades){
   const entryPrice=t.ask*(1+slipFactor);
   // Treat tradeNotional as total spend; fees reduce purchased quantity.
   if(cash>=tradeNotionalUsd){
    const entryFee=tradeNotionalUsd*entryFeeFactor;
    const quantity=(tradeNotionalUsd-entryFee)/entryPrice;
    cash-=tradeNotionalUsd;
    totalFees+=entryFee;
    totalSlippage+=quantity*t.ask*slipFactor;
    open={entryTimestampMs:t.timestampMs,entryPrice,quantity,entryFee,totalEntryCost:tradeNotionalUsd};
    entries++;
   }else blockedSignals++;
  }
  pending=null;
  // Observation at t can only request a position at t+1, never at t.
  if(t.signal==='buy'&& !open&&!halted&&entries<maxTrades){pending='buy';}
  if(t.signal==='sell')blockedSignals++; // Spot-only: no synthetic naked short.
  const equity=cash+(open?open.quantity*t.bid*(1-entryFeeFactor):0);
  peakEquity=Math.max(peakEquity,equity);
  maxDrawdownUsd=Math.max(maxDrawdownUsd,peakEquity-equity);
  if((startingCashUsd-equity)/startingCashUsd*100>=maxSessionLossPct){halted=true;pending=null;}
  equityCurve.push(Object.freeze({timestampMs:t.timestampMs,equityUsd:round(equity)}));
 }
 if(open)exit(clean.at(-1),'END_OF_SAMPLE');
 const netPnlUsd=cash-startingCashUsd;
 return Object.freeze({schema:'JENIOS_ULTRA_V2_SHADOW_REPLAY_V1',
  dataset:'CALLER_SUPPLIED_SNAPSHOTS_NOT_EXCHANGE_FILLS',
  realizedHypotheticalNetPnlUsd:round(netPnlUsd),endCashUsd:round(cash),
  startingCashUsd,entryCount:entries,closedTradeCount:trades.length,blockedSignals,
  maxObservedHypotheticalDrawdownUsd:round(maxDrawdownUsd),
  totalHypotheticalFeesUsd:round(totalFees),totalHypotheticalSlippageUsd:round(totalSlippage),
  stoppedByRisk:halted,trades:Object.freeze(trades),equityCurve:Object.freeze(equityCurve),
  actualBrokerPnl:null,financialPerformanceCertified:false,
  externalPaperEnabled:false,liveExecutionEnabled:false,ordersSent:0});
}

export function summarizeUltraShadowPerformance(replay){
 if(!replay||replay.schema!=='JENIOS_ULTRA_V2_SHADOW_REPLAY_V1'||!Array.isArray(replay.trades))
  fail('ULTRA_V2_SHADOW_INVALID_REPORT');
 const results=replay.trades.map(t=>t.pnlNetUsd);
 const wins=results.filter(v=>v>0),losses=results.filter(v=>v<0);
 const grossWins=wins.reduce((a,b)=>a+b,0),grossLosses=-losses.reduce((a,b)=>a+b,0);
 return Object.freeze({schema:'JENIOS_ULTRA_V2_SHADOW_KPI_V1',
  hypotheticalTradeCount:results.length,
  hypotheticalWinRate:results.length?round(wins.length/results.length):null,
  hypotheticalProfitFactor:grossLosses>0?round(grossWins/grossLosses):null,
  hypotheticalAvgNetUsd:results.length?round(results.reduce((a,b)=>a+b,0)/results.length):null,
  hypotheticalNetReturnPct:round(replay.realizedHypotheticalNetPnlUsd/replay.startingCashUsd*100),
  hypotheticalMaxDrawdownPct:round(replay.maxObservedHypotheticalDrawdownUsd/replay.startingCashUsd*100),
  realizedHypotheticalNetPnlUsd:replay.realizedHypotheticalNetPnlUsd,
  totalHypotheticalFeesUsd:replay.totalHypotheticalFeesUsd,
  totalHypotheticalSlippageUsd:replay.totalHypotheticalSlippageUsd,
  actualBrokerPnl:null,financialPerformanceCertified:false});
}

export function assessUltraAdaptiveCandidate({baseline,candidate,holdoutMonths=0,operatorApproved=false}={}){
 const ok=x=>x&&Number.isSafeInteger(x.observations)&&x.observations>=0&&
  finite(x.netReturnPct)&&finite(x.maxDrawdownPct)&&x.maxDrawdownPct>=0&&
  finite(x.costBps)&&x.costBps>=0&&x.dataOrigin==='PROSPECTIVE_SHADOW';
 if(!ok(baseline)||!ok(candidate)||!Number.isSafeInteger(holdoutMonths)||holdoutMonths<0||
  typeof operatorApproved!=='boolean')fail('ULTRA_V2_ADAPT_INVALID');
 const reasons=[];
 if(baseline.observations<200||candidate.observations<200)reasons.push('INSUFFICIENT_PROSPECTIVE_SAMPLE');
 if(holdoutMonths<1)reasons.push('INDEPENDENT_HOLDOUT_REQUIRED');
 if(candidate.netReturnPct<=baseline.netReturnPct)reasons.push('NO_NET_OUTPERFORMANCE');
 if(candidate.maxDrawdownPct>baseline.maxDrawdownPct)reasons.push('DRAWDOWN_REGRESSION');
 if(candidate.costBps>baseline.costBps*1.2)reasons.push('COST_REGRESSION');
 if(!operatorApproved)reasons.push('OWNER_APPROVAL_PENDING');
 return Object.freeze({recommendForHumanReview:reasons.length===0,
  reasons:Object.freeze(reasons),automaticDeployment:false,
  parametersModified:false,liveExecutionEnabled:false});
}

export function buildUltraResearchDashboard({ranking=[],feed=null,risk=null,shadow=null,
 exchange=null,checkedAtMs=null}={}){
 if(!Array.isArray(ranking)||ranking.length>300||
  (checkedAtMs!==null&&!Number.isSafeInteger(checkedAtMs)) ||
  (shadow!==null&&shadow.schema!=='JENIOS_ULTRA_V2_SHADOW_REPLAY_V1'))
  fail('ULTRA_V2_DASHBOARD_INVALID');
 const top=ranking.slice(0,10).map(row=>({symbol:row.symbol,venue:row.venue,
  eligible:row.eligible,score:row.score,reasons:row.reasons}));
 const metrics=shadow?summarizeUltraShadowPerformance(shadow):null;
 return Object.freeze({schema:'JENIOS_ULTRA_V2_RESEARCH_DASHBOARD_V1',
  checkedAtMs,topOpportunities:Object.freeze(top),feedHealthy:feed?.allow??null,
  portfolioRiskCleared:risk?.allow??null,
  externalBrokerVerified:exchange?.brokerReadyOnEvidence??false,
  performance:metrics,activityLabel:'SHADOW_RESEARCH_NOT_REAL_TRADING',
  actualBrokerPnl:null,liveExecutionEnabled:false,ordersSent:0});
}

export function describeUltraExchangeIntegration(venue,capabilities={}) {
 if(!/^[a-z0-9_-]{2,30}$/i.test(venue||'') ||
  typeof capabilities.publicOrderBook!=='boolean'||
  typeof capabilities.publicTrades!=='boolean'||
  typeof capabilities.publicTicker!=='boolean') fail('ULTRA_V2_INTEGRATION_INVALID');
 return Object.freeze({venue,sourceMode:'READ_ONLY_PUBLIC_DATA',
  requiredFeeds:Object.freeze(['publicOrderBook','publicTrades','publicTicker']),
  missingFeeds:Object.freeze(['publicOrderBook','publicTrades','publicTicker']
    .filter(x=>!capabilities[x])),
  nextMilestones:Object.freeze(['PROSPECTIVE_SHADOW',
    'AUTHENTICATED_EXTERNAL_PAPER_WITH_OWNER_CONSENT',
    'BROKER_EVENT_RECONCILIATION', 'SEPARATE_LIVE_AUTHORIZATION']),
  anyCredentialsStored:false,liveExecutionEnabled:false,ordersSent:0});
}