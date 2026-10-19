/** B82: local historical-market data quality gate, not a licensed live feed. */
import {normalizeHistoricalCandles} from './market-study.mjs';
const median=xs=>{const s=[...xs].sort((a,b)=>a-b);return s.length%2?s[(s.length-1)/2]:(s[s.length/2-1]+s[s.length/2])/2;};
export function inspectHistoricalBars(input,{now=Date.now(),gapMultiplier=3}={}){
 if(typeof gapMultiplier!=='number'||!Number.isFinite(gapMultiplier)||gapMultiplier<1.5||gapMultiplier>10)
  throw Error('INVALID_GAP_MULTIPLIER');
 const bars=normalizeHistoricalCandles(input,now);
 const stamps=bars.map(b=>Date.parse(b.time));
 const durations=stamps.slice(1).map((v,i)=>v-stamps[i]);
 const typicalIntervalMs=median(durations);
 const gaps=durations.flatMap((ms,index)=>ms>typicalIntervalMs*gapMultiplier?
  [{afterIndex:index,observedMs:ms,expectedMs:typicalIntervalMs}]:[]);
 const zeroVolume=bars.filter(b=>b.volume===0).length;
 const unusualRange=bars.filter(b=>(b.high-b.low)/b.open>0.5).length;
 const nearlyFlat=bars.filter(b=>b.high===b.low).length;
 const warnings=[];
 if(gaps.length)warnings.push('Há lacunas de datas ou horários: não presumir candles intermediários.');
 if(zeroVolume)warnings.push('Alguns candles não apresentam volume; a cobertura pode ser incompleta.');
 if(unusualRange)warnings.push('Foram encontrados intervalos de preço excepcionalmente amplos.');
 if(nearlyFlat>bars.length/2)warnings.push('Série excessivamente plana: verificar origem e granularidade.');
 const replayEligible=bars.length>=80&&gaps.length===0&&
  zeroVolume<=bars.length*0.1&&unusualRange===0&&typicalIntervalMs>=1000;
 return Object.freeze({
  source:'user_supplied_unverified',providerVerified:false,live:false,
  first:bars[0].time,last:bars.at(-1).time,count:bars.length,
  typicalIntervalMs,gaps,zeroVolume,unusualRange,nearlyFlat,warnings,
  replayEligible,realExecutionAllowed:false,fillConfirmed:false,
  bars
 });
}
