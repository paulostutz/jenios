import {scoreUltrafastAsset,decideUltrafastDirection} from './robot-r18-ultrafast-foundation.mjs';
export function runR19MicrostructureLab(){
 let total=0,eligible=0,preview=0,wait=0,costBlocked=0,staleBlocked=0;
 for(const spreadBps of [1,2,4,8,12,20])
 for(const vol of [4,8,12,20,35,60])
 for(const depth of [50000,100000,500000,2000000])
 for(const tpm of [5,20,60,150])
 for(const fee of [1,3,5,8,12])
 for(const slippage of [1,2,4])
 for(const quoteAgeMs of [50,250,750,1200])
 for(const imbalance of [-.8,-.4,0,.4,.8])
 for(const momentum of [-12,-6,-2,2,6,12]){
   total++;
   const a=scoreUltrafastAsset({assetClass:'crypto',spreadBps,volatilityBps:vol,depthUsd:depth,tradesPerMinute:tpm,
     expectedRoundTripCostBps:fee+slippage,maxStaleMs:quoteAgeMs,marketOpen:true});
   if(!a.eligible){if(a.issues.includes('NO_COST_ADJUSTED_EDGE'))costBlocked++; if(a.issues.includes('MARKET_DATA_TOO_STALE'))staleBlocked++; continue;}
   eligible++;
   const d=decideUltrafastDirection({microMomentumBps:momentum,orderBookImbalance:imbalance,shortVolatilityBps:vol,
     roundTripCostBps:fee+slippage,spreadBps,quoteAgeMs});
   if(d.classification==='ULTRAFAST_PREVIEW')preview++;else wait++;
 }
 return Object.freeze({total,eligible,preview,wait,costBlocked,staleBlocked,ordersSent:0,paperOrdersSent:0,actualBrokerPnl:null});
}
