/**
 * ROBOT R18 — UltraFast foundation.
 * Public/offline planning and risk model only. No broker transport, no market
 * network, no real order submission and no profitability claims.
 */
const fail=code=>{throw Object.assign(new Error(code),{code});};
const finite=x=>typeof x==='number'&&Number.isFinite(x);

export const R18_ULTRAFAST_SPEC=Object.freeze({
 schema:'JENIOS_ROBOT_R18_ULTRAFAST_SPEC_V1',
 modes:Object.freeze(['single','timed_session']),
 allowedAssetClasses:Object.freeze(['crypto','equity','index']),
 liveExecutionEnabled:false,
 externalPaperEnabled:false,
 realPnlCertified:false,
 maxSessionRiskPct:2,
 maxTradeRiskPct:0.25,
 maxLeverage:10,
 requireRealtimeBook:true,
 requireCostEdge:true,
 requireMarketOpenCheck:true,
 requireKillSwitch:true
});

export function scoreUltrafastAsset(x){
 if(!x||!['crypto','equity','index'].includes(x.assetClass)||
   !finite(x.spreadBps)||x.spreadBps<0||
   !finite(x.volatilityBps)||x.volatilityBps<0||
   !finite(x.depthUsd)||x.depthUsd<0||
   !finite(x.tradesPerMinute)||x.tradesPerMinute<0||
   !finite(x.expectedRoundTripCostBps)||x.expectedRoundTripCostBps<0||
   !finite(x.maxStaleMs)||x.maxStaleMs<1||
   typeof x.marketOpen!=='boolean') fail('R18_INVALID_ASSET_METRICS');
 const liquidity=Math.min(1,x.depthUsd/1_000_000);
 const activity=Math.min(1,x.tradesPerMinute/120);
 const movement=Math.min(1,x.volatilityBps/40);
 const spreadPenalty=Math.min(1,x.spreadBps/20);
 const costPenalty=Math.min(1,x.expectedRoundTripCostBps/30);
 const raw=0.30*liquidity+0.25*activity+0.30*movement-0.10*spreadPenalty-0.05*costPenalty;
 const issues=[];
 if(!x.marketOpen)issues.push('MARKET_CLOSED');
 if(x.maxStaleMs>1000)issues.push('MARKET_DATA_TOO_STALE');
 if(x.depthUsd<100_000)issues.push('INSUFFICIENT_DEPTH');
 if(x.tradesPerMinute<10)issues.push('INSUFFICIENT_ACTIVITY');
 if(x.volatilityBps<=x.expectedRoundTripCostBps*1.5)issues.push('NO_COST_ADJUSTED_EDGE');
 return Object.freeze({
  schema:'JENIOS_R18_ASSET_SCORE_V1',
  score:Number(Math.max(0,Math.min(1,raw)).toFixed(6)),
  eligible:issues.length===0,
  issues:Object.freeze(issues),
  liveExecution:false
 });
}

export function planUltrafastSession(cfg){
 if(!cfg||!['single','timed_session'].includes(cfg.sessionMode)||
  !finite(cfg.accountEquity)||cfg.accountEquity<=0||
  !finite(cfg.tradeValue)||cfg.tradeValue<=0||
  !finite(cfg.leverage)||cfg.leverage<1||cfg.leverage>R18_ULTRAFAST_SPEC.maxLeverage||
  !finite(cfg.stopLossBps)||cfg.stopLossBps<=0||
  !finite(cfg.takeProfitBps)||cfg.takeProfitBps<=0||
  !finite(cfg.roundTripCostBps)||cfg.roundTripCostBps<0||
  !finite(cfg.slippageBufferBps)||cfg.slippageBufferBps<0||
  !Number.isSafeInteger(cfg.maxTrades)||cfg.maxTrades<1||cfg.maxTrades>100000||
  !Number.isSafeInteger(cfg.durationMinutes)||cfg.durationMinutes<0||cfg.durationMinutes>1440||
  typeof cfg.marketOpen!=='boolean') fail('R18_INVALID_SESSION_CONFIG');
 if(cfg.sessionMode==='timed_session'&&cfg.durationMinutes<1)fail('R18_DURATION_REQUIRED');
 const notional=cfg.tradeValue*cfg.leverage;
 const stopLossMoney=notional*cfg.stopLossBps/10000;
 const takeProfitMoney=notional*cfg.takeProfitBps/10000;
 const frictionMoney=notional*(cfg.roundTripCostBps+cfg.slippageBufferBps)/10000;
 const tradeRiskPct=stopLossMoney/cfg.accountEquity*100;
 const sessionWorstCase=stopLossMoney*Math.min(cfg.maxTrades,20);
 const sessionRiskPct=sessionWorstCase/cfg.accountEquity*100;
 const issues=[];
 if(!cfg.marketOpen)issues.push('MARKET_CLOSED');
 if(tradeRiskPct>R18_ULTRAFAST_SPEC.maxTradeRiskPct)issues.push('TRADE_RISK_TOO_HIGH');
 if(sessionRiskPct>R18_ULTRAFAST_SPEC.maxSessionRiskPct)issues.push('SESSION_RISK_TOO_HIGH');
 if(takeProfitMoney<=frictionMoney*1.5)issues.push('TARGET_TOO_SMALL_AFTER_COSTS');
 if(cfg.takeProfitBps<=cfg.stopLossBps*0.5)issues.push('POOR_REWARD_RISK');
 return Object.freeze({
  schema:'JENIOS_R18_SESSION_PLAN_V1',
  notional,stopLossMoney,takeProfitMoney,frictionMoney,tradeRiskPct,sessionRiskPct,
  allowed:issues.length===0,issues:Object.freeze(issues),
  directionChoice:'OPERATOR_FOR_SINGLE_OR_ROBOT_AFTER_PLAY_FOR_TIMED_SESSION',
  liveExecution:false,ordersSent:0,paperOrdersSent:0
 });
}

export function decideUltrafastDirection(x){
 if(!x||!finite(x.microMomentumBps)||!finite(x.orderBookImbalance)||
   x.orderBookImbalance<-1||x.orderBookImbalance>1||
   !finite(x.shortVolatilityBps)||x.shortVolatilityBps<0||
   !finite(x.roundTripCostBps)||x.roundTripCostBps<0||
   !finite(x.spreadBps)||x.spreadBps<0||
   !Number.isSafeInteger(x.quoteAgeMs)||x.quoteAgeMs<0)
  fail('R18_INVALID_DIRECTION_INPUT');
 const issues=[];
 if(x.quoteAgeMs>750)issues.push('QUOTE_STALE');
 if(x.spreadBps>x.shortVolatilityBps*0.5)issues.push('SPREAD_TOO_LARGE');
 const edge=Math.abs(x.microMomentumBps)+Math.abs(x.orderBookImbalance)*x.shortVolatilityBps;
 if(edge<=x.roundTripCostBps*1.75)issues.push('EDGE_DOES_NOT_CLEAR_COSTS');
 let side=null;
 if(!issues.length){
  const directional=x.microMomentumBps + x.orderBookImbalance*x.shortVolatilityBps*0.5;
  side=directional>0?'buy':directional<0?'sell':null;
  if(side===null)issues.push('NO_DIRECTION');
 }
 return Object.freeze({
  schema:'JENIOS_R18_DIRECTION_V1',side,
  classification:issues.length?'WAIT':'ULTRAFAST_PREVIEW',
  issues:Object.freeze(issues),
  confidence:issues.length?0:Math.min(1,edge/Math.max(1,x.roundTripCostBps*6)),
  actualBrokerPnl:null,ordersSent:0,paperOrdersSent:0
 });
}

export function sessionKillSwitch(s){
 if(!s||!finite(s.sessionRealizedR)||!finite(s.sessionDrawdownPct)||
   !Number.isSafeInteger(s.consecutiveLosses)||s.consecutiveLosses<0||
   !Number.isSafeInteger(s.quoteAgeMs)||s.quoteAgeMs<0||
   !Number.isSafeInteger(s.rejectionsLastMinute)||s.rejectionsLastMinute<0||
   typeof s.marketOpen!=='boolean'||typeof s.userStopped!=='boolean')
  fail('R18_INVALID_KILL_SWITCH_INPUT');
 const reasons=[];
 if(s.userStopped)reasons.push('USER_STOPPED');
 if(!s.marketOpen)reasons.push('MARKET_CLOSED');
 if(s.sessionDrawdownPct>=2)reasons.push('SESSION_DRAWDOWN_LIMIT');
 if(s.consecutiveLosses>=5)reasons.push('LOSS_STREAK_LIMIT');
 if(s.quoteAgeMs>1000)reasons.push('MARKET_DATA_STALE');
 if(s.rejectionsLastMinute>=5)reasons.push('BROKER_REJECTIONS');
 return Object.freeze({
  schema:'JENIOS_R18_KILL_SWITCH_V1',
  halt:reasons.length>0,reasons:Object.freeze(reasons),
  closeNewEntries:reasons.length>0,ordersSent:0,liveExecution:false
 });
}
