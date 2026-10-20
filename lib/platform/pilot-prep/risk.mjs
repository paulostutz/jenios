/** B152 arithmetic uses eight decimal fixed-point settlement units, rounded UP for risk. */
import {SCALE,insist,record,units,decimal,ceilDiv,instrument,uint} from './contracts.mjs';
export function orderRisk(order,meta,{now=Date.now(),roundTripFeeBps,slippageBps,fundingCost='0'}={}){
 record(order,['clientOrderId','mode','side','quantity','entry','stop','target']);
 insist(['direct','reverse','hybrid'].includes(order.mode)&&['buy','sell'].includes(order.side),'INVALID_MODE_OR_SIDE');
 const m=instrument(meta,now);insist(m.marketType!=='spot'||order.side==='buy','SPOT_SHORT_UNSUPPORTED');const q=units(order.quantity),e=units(order.entry),s=units(order.stop),t=units(order.target);
 insist(q>=units(m.minQty)&&q<=units(m.maxQty)&&q%units(m.qtyStep)===0n,'QUANTITY_OFF_STEP_OR_BOUNDS');
 insist([e,s,t].every(v=>v>0n&&v%units(m.tickSize)===0n),'PRICE_OFF_TICK');
 insist(order.side==='buy'?s<e&&t>e:s>e&&t<e,'INVALID_PROTECTIVE_PRICES');
 uint(roundTripFeeBps,1000);uint(slippageBps,1000);const extra=units(fundingCost);
 const distance=e>s?e-s:s-e,mult=units(m.contractSize);
 let stopRisk,notional;
 if(m.marketType==='inverse'){
  // quantity * face value * abs(1/stop - 1/entry), settled in the base asset.
  stopRisk=ceilDiv(q*mult*distance,e*s);
  notional=ceilDiv(q*mult,e);
 }else{
  stopRisk=ceilDiv(q*mult*distance,SCALE*SCALE);
  notional=ceilDiv(q*mult*e,SCALE*SCALE);
 }
 const fees=ceilDiv(notional*BigInt(roundTripFeeBps),10000n),slippage=ceilDiv(notional*BigInt(slippageBps),10000n);
 const risk=stopRisk+fees+slippage+extra;
 insist(risk>0n,'ZERO_RISK');
 return {settlement:m.settlement,riskUnits:risk.toString(),notionalUnits:notional.toString(),stopRiskUnits:stopRisk.toString(),feesUnits:fees.toString(),slippageUnits:slippage.toString(),fundingUnits:extra.toString(),risk:decimal(risk),unitScale:8,simulation:true,stopExecutionGuaranteed:false};
}
