/** R112 / Block 2 — deterministic *hypothetical* order execution lab.
 * Models queue ahead and liquidity, not actual fills. Events provided by caller.
 */
const fail=c=>{throw Object.assign(Error(c),{code:c});};
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const pos=x=>finite(x)&&x>=0;
const r=x=>Number(x.toFixed(8));

/** Simplified L2 order book taker sweep. Crosses quoted visible depth, not exchange.
 * Stops at insufficient book or max allowed slippage; never infers guaranteed fill.
 */
export function simulateUltraDepthSweep({side,quantity,levels,referencePrice,
  takerFeeBps=5,latencySlippageBps=0,maxAdverseSlippageBps=50}={}){
 if(!['BUY','SELL'].includes(side)||!finite(quantity)||quantity<=0||
   !Array.isArray(levels)||levels.length<1||levels.length>1000||
   !finite(referencePrice)||referencePrice<=0||!pos(takerFeeBps)||
   !pos(latencySlippageBps)||!pos(maxAdverseSlippageBps)||
   levels.some(x=>!x||!finite(x.price)||x.price<=0||!finite(x.qty)||x.qty<=0))
   fail('R112_SWEEP_INVALID_INPUT');
 let remain=quantity,gross=0,filled=0;
 const book=[...levels].sort((a,b)=>side==='BUY'?a.price-b.price:b.price-a.price);
 for(const l of book){
   const adverse=(side==='BUY'?l.price/referencePrice-1:1-l.price/referencePrice)*10000+latencySlippageBps;
   if(adverse>maxAdverseSlippageBps)break;
   const qty=Math.min(remain,l.qty);filled+=qty;gross+=qty*l.price;remain-=qty;
   if(remain<=1e-12)break;
 }
 const vwap=filled>0?gross/filled:null;
 const adverseExecPrice=vwap===null?null:vwap*(1+(side==='BUY'?1:-1)*latencySlippageBps/10000);
 const priceDeltaBps=adverseExecPrice===null?null:
   (side==='BUY'?adverseExecPrice/referencePrice-1:1-adverseExecPrice/referencePrice)*10000;
 const feesUsd=gross*takerFeeBps/10000;
 return Object.freeze({schema:'JENIOS_R112_SWEEP_LAB_V1',requestedQuantity:quantity,
   simulatedFilledQuantity:r(filled),unfilledQuantity:r(Math.max(0,remain)),
   simulatedVwap:vwap===null?null:r(vwap),
   adversePriceBps:priceDeltaBps===null?null:r(priceDeltaBps),
   estimatedFeesUsd:r(feesUsd),partialFillOnly:remain>1e-12,
   fillIsHypothetical:true,marketImpactNotMeasured:true,ordersSent:0});
}
/** Maker queue model: only aggressive trades at eligible price deplete queue.
 * Trade events at or before latency boundary cannot be consumed retroactively.
 */
export function simulateUltraMakerQueue({side,limitPrice,quantity,queueAheadQty,
  submittedAtMs,latencyMs=0,expiresAtMs,events,makerFeeBps=0}={}){
 if(!['BUY','SELL'].includes(side)||!finite(limitPrice)||limitPrice<=0||
   !finite(quantity)||quantity<=0||!pos(queueAheadQty)||
   !Number.isSafeInteger(submittedAtMs)||!Number.isSafeInteger(latencyMs)||latencyMs<0||
   !Number.isSafeInteger(expiresAtMs)||expiresAtMs<submittedAtMs+latencyMs||
   !Array.isArray(events)||events.length>10000||!finite(makerFeeBps)||makerFeeBps< -5)
   fail('R112_MAKER_INVALID_INPUT');
 let qAhead=queueAheadQty,filled=0,eventsConsumed=0,lastTime=-1;
 for(const e of events){
   if(!e||!Number.isSafeInteger(e.timestampMs)||e.timestampMs<lastTime||
      !['BUY','SELL'].includes(e.aggressorSide)||!finite(e.price)||e.price<=0||
      !finite(e.quantity)||e.quantity<=0)fail('R112_MAKER_INVALID_EVENT');
   lastTime=e.timestampMs;
   if(e.timestampMs<=submittedAtMs+latencyMs||e.timestampMs>expiresAtMs)continue;
   if(side===e.aggressorSide)continue;
   if(side==='BUY'&&e.price>limitPrice)continue;
   if(side==='SELL'&&e.price<limitPrice)continue;
   const usedForAhead=Math.min(e.quantity,qAhead);qAhead-=usedForAhead;
   const consumed=Math.min(quantity-filled,e.quantity-usedForAhead);
   filled+=consumed;eventsConsumed++;
   if(filled>=quantity-1e-12)break;
 }
 return Object.freeze({schema:'JENIOS_R112_MAKER_QUEUE_LAB_V1',
  filledHypotheticalQty:r(filled),remainingHypotheticalQty:r(Math.max(0,quantity-filled)),
  queueAheadRemainingQty:r(qAhead),eventsConsumed,
  estimatedFeeUsd:r(filled*limitPrice*makerFeeBps/10000),
  optimisticQueueAssumption:true,cancellationsAheadUnknown:true,
  notBrokerFillEvidence:true,ordersSent:0});
}
export function assessUltraExecutionSlippage({expectedPrice,observedPrice,side,
 expectedFeeUsd,observedFeeUsd,quantity,source}={}){
 if(!['BUY','SELL'].includes(side)||!finite(expectedPrice)||expectedPrice<=0||
   !finite(observedPrice)||observedPrice<=0||!pos(expectedFeeUsd)||!pos(observedFeeUsd)||
   !finite(quantity)||quantity<=0||source!=='SIMULATED'&&source!=='BROKER_READONLY')
   fail('R112_QUALITY_INVALID');
 const adverseBps=(side==='BUY'?observedPrice/expectedPrice-1:
   expectedPrice/observedPrice-1)*10000;
 return Object.freeze({schema:'JENIOS_R112_EXECUTION_QUALITY_V1',
   priceSlippageBps:r(adverseBps),feeDifferenceUsd:r(observedFeeUsd-expectedFeeUsd),
   effectiveCostUsd:r(quantity*(observedPrice-expectedPrice)*(side==='BUY'?1:-1)+observedFeeUsd),
   evidenceSource:source,providerConfirmationRequired:source==='SIMULATED',
   noProfitGuarantee:true,ordersSent:0});
}