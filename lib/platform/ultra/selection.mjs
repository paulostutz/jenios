/** Normalized observation adapter. Reuses R53; no invented order book for Forex. */
import {scoreR53Asset} from '../research/robot-r53-dynamic-asset-selection.mjs';
import {normalizeUltraConfig} from './policy.mjs';
export function rankUltraCandidates(input,observations,nowMs){
 const config=normalizeUltraConfig(input);
 if(!Array.isArray(observations)||observations.length>1000||!Number.isSafeInteger(nowMs))throw Error('ULTRA_INVALID_OBSERVATIONS');
 if(observations.some(row=>!row||typeof row!=='object'))throw Error('ULTRA_INVALID_OBSERVATIONS');
 const allowed=new Set(config.markets.map(m=>m.id));const counts=new Map();
 for(const row of observations){const key=row.market+':'+String(row.symbol).toUpperCase();counts.set(key,(counts.get(key)||0)+1);}
 return observations.map(row=>{
  const blockers=[];const key=row.market+':'+String(row.symbol).toUpperCase();
  if(counts.get(key)>1)blockers.push('DUPLICATE_INSTRUMENT');
  if(typeof row.symbol!=='string'||!row.symbol.trim())blockers.push('INSTRUMENT_INVALID');
  if(!allowed.has(row.market))blockers.push('MARKET_NOT_SELECTED');
  if(config.excludedSymbols.includes(String(row.symbol).toUpperCase()))blockers.push('ASSET_EXCLUDED');
  if(row.marketOpen!==true)blockers.push('MARKET_CLOSED');
  if(!Number.isSafeInteger(row.observedAtMs)||row.observedAtMs>nowMs||nowMs-row.observedAtMs>1000)blockers.push('QUOTE_STALE');
  // A vendor-provided executable-liquidity measure is required; never manufacture L2.
  if(row.liquidityVerified!==true)blockers.push('LIQUIDITY_UNVERIFIED');
  let scored=null;
  const positive=['volatilityBps','spreadBps','depthUsd','roundTripCostBps','adverseSelectionBps'];
  if(positive.some(k=>typeof row[k]!=='number'||!Number.isFinite(row[k])||row[k]<0)||['fillProbability','stabilityRatio'].some(k=>typeof row[k]!=='number'||!Number.isFinite(row[k])||row[k]<0||row[k]>1))blockers.push('METRICS_INVALID');
  if(!blockers.length){try{scored=scoreR53Asset(row);if(!scored.eligible)blockers.push('R53_NOT_ELIGIBLE');}catch{blockers.push('METRICS_INVALID');}}
  return {market:row.market,symbol:row.symbol,eligible:blockers.length===0,score:scored?.score??null,blockers};
 }).sort((a,b)=>Number(b.eligible)-Number(a.eligible)||(b.score??-Infinity)-(a.score??-Infinity)||String(a.symbol).localeCompare(String(b.symbol)));
}
export function sizeUltraPosition({capital,leverage,entryPrice,stopDistance,contractMultiplier,quoteToAccount,lotStep,minLot,freeMargin,marginPerLot,costPerLot,tradeRiskPct,maxAssetPct}){
 const vals=[capital,leverage,entryPrice,stopDistance,contractMultiplier,quoteToAccount,lotStep,minLot,freeMargin,marginPerLot,costPerLot,tradeRiskPct,maxAssetPct];
 if(vals.some(v=>typeof v!=='number'||!Number.isFinite(v)||v<0)||[capital,leverage,entryPrice,stopDistance,contractMultiplier,quoteToAccount,lotStep,minLot,marginPerLot,tradeRiskPct,maxAssetPct].some(v=>v<=0)||leverage<1||tradeRiskPct>100||maxAssetPct>100)throw Error('ULTRA_INVALID_SIZING');
 const riskPerLot=stopDistance*contractMultiplier*quoteToAccount+costPerLot;
 const notionalPerLot=entryPrice*contractMultiplier*quoteToAccount;
 const cap=Math.min(capital*tradeRiskPct/100/riskPerLot,capital*maxAssetPct/100*leverage/notionalPerLot,freeMargin/marginPerLot);
 const lots=Math.floor(cap/lotStep)*lotStep;
 return {lots:lots+1e-12>=minLot?Number(lots.toPrecision(12)):0,estimatedLoss:lots+1e-12>=minLot?lots*riskPerLot:0,notional:lots+1e-12>=minLot?lots*notionalPerLot:0,stopExecutionGuaranteed:false};
}
