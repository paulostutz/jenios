/**
 * R25 — exchange-cost, outage and per-asset UltraFast stress.
 * Synthetic configurable profiles only. No authenticated exchange access or order transport.
 */
const fail=c=>{throw Object.assign(new Error(c),{code:c});};
const finite=x=>typeof x==='number'&&Number.isFinite(x);

export function normalizeCostProfile(p){
 if(!p||typeof p.name!=='string'||p.name.length<1||p.name.length>40||
   !finite(p.makerBps)||p.makerBps<0||!finite(p.takerBps)||p.takerBps<0||
   !finite(p.slippageBps)||p.slippageBps<0||!finite(p.spreadBps)||p.spreadBps<0||
   !finite(p.fundingBpsPerSession)||Math.abs(p.fundingBpsPerSession)>1000)
   fail('R25_INVALID_COST_PROFILE');
 return Object.freeze({...p});
}

export function evaluateTradeEconomics({style,grossEdgeBps,fillProbability,profile}={}){
 if(!['maker','taker'].includes(style)||!finite(grossEdgeBps)||
   !finite(fillProbability)||fillProbability<0||fillProbability>1)
   fail('R25_INVALID_ECONOMICS');
 const p=normalizeCostProfile(profile);
 const direct=style==='maker'?p.makerBps:p.takerBps+p.spreadBps/2+p.slippageBps;
 const nonFillPenalty=style==='maker'?(1-fillProbability)*(p.takerBps+p.spreadBps/2+p.slippageBps):0;
 const totalCostBps=direct+nonFillPenalty+Math.max(0,p.fundingBpsPerSession);
 const netEdgeBps=grossEdgeBps-totalCostBps;
 return Object.freeze({
  style,totalCostBps:Number(totalCostBps.toFixed(6)),
  netEdgeBps:Number(netEdgeBps.toFixed(6)),
  viable:netEdgeBps>0,
  actualBrokerPnl:null,ordersSent:0
 });
}

export function exchangeHealthGate(x){
 if(!x||!['online','degraded','offline','maintenance'].includes(x.exchangeStatus)||
   !['online','offline','unknown'].includes(x.symbolStatus)||
   !Number.isSafeInteger(x.marketDataAgeMs)||x.marketDataAgeMs<0||
   !Number.isSafeInteger(x.orderAckLatencyMs)||x.orderAckLatencyMs<0||
   !Number.isSafeInteger(x.rejectionsLastMinute)||x.rejectionsLastMinute<0)
   fail('R25_INVALID_HEALTH');
 const reasons=[];
 if(x.exchangeStatus!=='online')reasons.push('EXCHANGE_'+x.exchangeStatus.toUpperCase());
 if(x.symbolStatus!=='online')reasons.push('SYMBOL_NOT_ONLINE');
 if(x.marketDataAgeMs>1000)reasons.push('MARKET_DATA_STALE');
 if(x.orderAckLatencyMs>2000)reasons.push('ORDER_ACK_SLOW');
 if(x.rejectionsLastMinute>=5)reasons.push('REJECTION_CLUSTER');
 return Object.freeze({allow:reasons.length===0,reasons:Object.freeze(reasons),ordersSent:0});
}

export function stressAssetSession({symbol,attempts,grossEdgeBps,winRate,fillProbability,style,profile,
 maxDrawdownR,maxLossStreak,outageEvery=0,maintenanceAt=null}={}){
 if(typeof symbol!=='string'||!/^[A-Z0-9-]{3,20}$/.test(symbol)||
   !Number.isSafeInteger(attempts)||attempts<10000||attempts>20000||
   !finite(grossEdgeBps)||grossEdgeBps<=0||!finite(winRate)||winRate<0||winRate>1||
   !finite(fillProbability)||fillProbability<0||fillProbability>1||
   !['maker','taker'].includes(style)||!finite(maxDrawdownR)||maxDrawdownR<=0||
   !Number.isSafeInteger(maxLossStreak)||maxLossStreak<1||
   !Number.isSafeInteger(outageEvery)||outageEvery<0||
   !(maintenanceAt===null||Number.isSafeInteger(maintenanceAt)))
   fail('R25_INVALID_ASSET_STRESS');

 const economics=evaluateTradeEconomics({style,grossEdgeBps,fillProbability,profile});
 let realizedR=0,peak=0,drawdown=0,lossStreak=0,trades=0,blocked=0,halts=0,haltReason=null;
 for(let i=0;i<attempts;i++){
   const outage=outageEvery>0&&i>0&&i%outageEvery===0;
   const maintenance=maintenanceAt!==null&&i===maintenanceAt;
   if(outage||maintenance){
     blocked++;halts++;
     if(maintenance){haltReason='MAINTENANCE';break;}
     continue;
   }
   if(!economics.viable){blocked++;continue;}
   const pseudo=((i*1664525+1013904223)>>>0)%100000;
   const win=pseudo<Math.round(winRate*100000);
   const grossR=(win?1:-1)*(grossEdgeBps/100);
   const costR=economics.totalCostBps/100;
   const netR=(grossR-costR)*fillProbability;
   realizedR+=netR;trades++;
   lossStreak=netR<0?lossStreak+1:0;
   peak=Math.max(peak,realizedR);drawdown=Math.max(drawdown,peak-realizedR);
   if(drawdown>=maxDrawdownR){haltReason='DRAWDOWN_LIMIT';break;}
   if(lossStreak>=maxLossStreak){haltReason='LOSS_STREAK_LIMIT';break;}
 }
 return Object.freeze({
   schema:'JENIOS_R25_ASSET_SESSION_STRESS_V1',symbol,attemptsRequested:attempts,
   tradesExecuted:trades,blockedAttempts:blocked,healthInterruptions:halts,
   realizedSyntheticR:Number(realizedR.toFixed(6)),
   maxSyntheticDrawdownR:Number(drawdown.toFixed(6)),haltReason,
   economics,actualBrokerPnl:null,ordersSent:0,paperOrdersSent:0
 });
}

export function runR25Matrix(){
 const profiles=[
  {name:'LOW_COST',makerBps:.5,takerBps:2,slippageBps:1,spreadBps:1,fundingBpsPerSession:0},
  {name:'MID_COST',makerBps:1.5,takerBps:5,slippageBps:2,spreadBps:3,fundingBpsPerSession:0},
  {name:'HIGH_COST',makerBps:3,takerBps:9,slippageBps:5,spreadBps:8,fundingBpsPerSession:1}
 ];
 const assets=['BTC-USD','ETH-USD','SOL-USD'];
 let total=0,viable=0,nonViable=0,halted=0;
 for(const profile of profiles)
 for(const symbol of assets)
 for(const style of ['maker','taker'])
 for(const grossEdgeBps of [4,8,12,20,35])
 for(const fillProbability of [.25,.5,.75,.95])
 for(const winRate of [.48,.52,.56,.60]){
   total++;
   const r=stressAssetSession({symbol,attempts:10000,grossEdgeBps,winRate,fillProbability,style,profile,
     maxDrawdownR:30,maxLossStreak:20,outageEvery:997,maintenanceAt:null});
   if(r.economics.viable)viable++;else nonViable++;
   if(r.haltReason)halted++;
 }
 return Object.freeze({total,viable,nonViable,halted,ordersSent:0,paperOrdersSent:0,actualBrokerPnl:null});
}
