/**
 * R22 — public read-only crypto ranking parser.
 * Accepts only caller-supplied public snapshots. No secrets, auth or order transport.
 */
const fail=c=>{throw Object.assign(new Error(c),{code:c});};
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const pair=/^[A-Z0-9]{2,12}[-/][A-Z0-9]{2,12}$/;

export function inspectPublicCryptoSnapshot(x){
 if(!x||!pair.test(x.symbol)||!['kraken','coinbase'].includes(x.provider)||
  !finite(x.bid)||!finite(x.ask)||x.bid<=0||x.ask<x.bid||
  !finite(x.depthUsd)||x.depthUsd<0||!finite(x.tradesPerMinute)||x.tradesPerMinute<0||
  !finite(x.shortVolatilityBps)||x.shortVolatilityBps<0||
  !Number.isSafeInteger(x.observedAtMs)||!Number.isSafeInteger(x.sourceAtMs)||
  x.sourceAtMs>x.observedAtMs||x.observedAtMs-x.sourceAtMs>5000)
  fail('R22_INVALID_PUBLIC_SNAPSHOT');
 const mid=(x.bid+x.ask)/2;
 const spreadBps=(x.ask-x.bid)/mid*10000;
 const score=Math.max(0,
   Math.min(100,
     x.shortVolatilityBps*.9+
     Math.min(30,x.depthUsd/100000)+
     Math.min(25,x.tradesPerMinute/5)-
     Math.min(30,spreadBps*2)
   )
 );
 const issues=[];
 if(x.depthUsd<100000)issues.push('LOW_DEPTH');
 if(x.tradesPerMinute<10)issues.push('LOW_ACTIVITY');
 if(x.shortVolatilityBps<8)issues.push('LOW_SHORT_VOLATILITY');
 if(spreadBps>10)issues.push('WIDE_SPREAD');
 return Object.freeze({
   schema:'JENIOS_R22_PUBLIC_CRYPTO_SCORE_V1',
   symbol:x.symbol,provider:x.provider,
   spreadBps:Number(spreadBps.toFixed(6)),
   score:Number(score.toFixed(6)),
   eligible:issues.length===0,
   issues:Object.freeze(issues),
   readOnly:true,authenticated:false,ordersSent:0
 });
}

export function rankPublicCryptoSnapshots(rows=[]){
 if(!Array.isArray(rows)||rows.length<1||rows.length>2000)fail('R22_INVALID_PUBLIC_ROWS');
 const scored=rows.map(inspectPublicCryptoSnapshot);
 const unique=new Set();
 for(const x of scored){
  const k=x.provider+'|'+x.symbol;
  if(unique.has(k))fail('R22_DUPLICATE_PUBLIC_SNAPSHOT');
  unique.add(k);
 }
 return Object.freeze([...scored].sort((a,b)=>b.score-a.score||a.symbol.localeCompare(b.symbol)));
}

export function compareMakerTakerEconomics({spreadBps,makerFeeBps,takerFeeBps,slippageBps,fillProbability}={}){
 for(const x of [spreadBps,makerFeeBps,takerFeeBps,slippageBps,fillProbability])
  if(!finite(x)||x<0)fail('R22_INVALID_ECONOMICS');
 if(fillProbability>1)fail('R22_INVALID_ECONOMICS');
 const makerExpectedCost=makerFeeBps+(1-fillProbability)*(spreadBps/2+slippageBps+takerFeeBps);
 const takerCost=takerFeeBps+spreadBps/2+slippageBps;
 return Object.freeze({
  makerExpectedCostBps:Number(makerExpectedCost.toFixed(6)),
  takerCostBps:Number(takerCost.toFixed(6)),
  preferred:makerExpectedCost<takerCost?'maker':'taker',
  actualBrokerPnl:null,ordersSent:0
 });
}
