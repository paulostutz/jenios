/** B289: research-only deterministic "losing operator" behavior proxies.
 * No proprietary engine, no broker, no orders, no learned profitability claim.
 * Decisions see CLOSED bars only. Mega-trend overrides automatic inversion.
 */
import {createHash} from 'node:crypto';
const fail=c=>{throw Object.assign(new Error(c),{code:c});};
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const H=3600000,finite=x=>typeof x==='number'&&Number.isFinite(x);
const round=x=>Number(x.toFixed(6));
export const B289_PROFILES=Object.freeze([
 'CHASE_LATE_BREAKOUT','REVENGE_AFTER_LOSS','COUNTERTREND_TOP_PICKER',
 'OVERTRADE_NOISE','EARLY_WINNER_EXIT'
]);
export const B289_PROTOCOL=Object.freeze({
 schema:'JENIOS_B289_REVERSE_OPERATOR_STRESS_V1',intervalMs:H,
 megaTrendMinEmaGapRatio:0.012,megaTrendMinAlignedBars:8,
 megaTrendMinDirectionalMovePct:0.035,stopPct:0.01,
 costBps:[0,10,30],adverseStopSlipBps:[0,10,30],
 minimumClosedBars:100,operatorProfiles:B289_PROFILES,
 futureDataAllowed:false,liveTrading:false
});
function ema(bars,n){let x=bars[0].close,a=2/(n+1);return bars.map(b=>(x=a*b.close+(1-a)*x));}
function valid(bars,asOfMs){
 if(!Array.isArray(bars)||bars.length<100||bars.length>5000||
 !Number.isSafeInteger(asOfMs))fail('B289_INVALID_CLOSED_HISTORY');
 for(let i=0;i<bars.length;i++){
  const b=bars[i];
  if(!b||!Number.isSafeInteger(b.t)||b.t%H!==0||
  ![b.open,b.high,b.low,b.close,b.volume].every(finite)||
  b.open<=0||b.close<=0||b.low<=0||b.volume<0||
  b.high<Math.max(b.open,b.close,b.low)||b.low>Math.min(b.open,b.close)||
  (i&&b.t!==bars[i-1].t+H))fail('B289_INVALID_OR_GAPPED_CANDLE');
 }
 if(bars.at(-1).t+H>asOfMs)fail('B289_UNCLOSED_CANDLE');
}
function context(bars,fast,slow,i){
 const prev=bars[i-1],d=Math.sign(fast[i-1]-slow[i-1]);
 const recent=bars.slice(i-8,i),move=(prev.close/recent[0].open)-1;
 const aligned=recent.filter((b,j)=>j===0?false:Math.sign(b.close-recent[j-1].close)===d).length;
 const mega=d!==0&&Math.abs(fast[i-1]-slow[i-1])/prev.close>=B289_PROTOCOL.megaTrendMinEmaGapRatio&&
 aligned>=6&&Math.sign(move)===d&&Math.abs(move)>=B289_PROTOCOL.megaTrendMinDirectionalMovePct;
 const prevHigh=Math.max(...bars.slice(i-21,i-1).map(b=>b.high));
 const prevLow=Math.min(...bars.slice(i-21,i-1).map(b=>b.low));
 return {d,mega,prevHigh,prevLow,prev,move};
}
function novice(profile,c,history,i,previousOutcome){
 const {prev,d,prevHigh,prevLow}=c;
 const barMove=(prev.close/prev.open)-1;
 if(profile==='CHASE_LATE_BREAKOUT')return prev.close>prevHigh?1:prev.close<prevLow?-1:0;
 if(profile==='REVENGE_AFTER_LOSS')return previousOutcome<0?
  (Math.sign(barMove)||-d):0;
 if(profile==='COUNTERTREND_TOP_PICKER')return d? -d:0;
 if(profile==='OVERTRADE_NOISE')return Math.sign(barMove)||0;
 if(profile==='EARLY_WINNER_EXIT')return d;
 return 0;
}
function score(side,bar,cost,slip){
 const entry=bar.open,stop=entry*(1-side*B289_PROTOCOL.stopPct);
 const touched=side>0?bar.low<=stop:bar.high>=stop;
 const exit=touched?stop-side*entry*slip/10000:bar.close;
 return {netR:round(side*(exit-entry)/(entry*B289_PROTOCOL.stopPct)-cost/10000/B289_PROTOCOL.stopPct),
 stopTouched:touched};
}
export function evaluateB289OperatorLab(bars,{asOfMs,holdoutStartIndex=100}={}){
 valid(bars,asOfMs);
 if(!Number.isSafeInteger(holdoutStartIndex)||holdoutStartIndex<100||
 holdoutStartIndex>=bars.length)fail('B289_INVALID_HOLDOUT');
 const fast=ema(bars,12),slow=ema(bars,26),events=[];
 for(const profile of B289_PROFILES){
  let priorNoviceR=0;
  for(let i=holdoutStartIndex;i<bars.length;i++){
   const c=context(bars,fast,slow,i),n=novice(profile,c,bars,i,priorNoviceR);
   if(!n)continue;
   const naive=score(n,bars[i],30,30);
   // "losing operator" is a hypothesis, not a guarantee that this trader loses.
   const reverse=c.mega?(n===c.d?n:0):-n;
   const oppositeMegaBlocked=c.mega&&n!==c.d;
   const reversed=reverse?score(reverse,bars[i],30,30):null;
   events.push(Object.freeze({profile,asset:'UNSPECIFIED_TEST_SERIES',
    signalClosedAtMs:bars[i-1].t+H,targetBarOpenMs:bars[i].t,
    operatorDirection:n,megaTrendDetected:c.mega,megaTrendDirection:c.mega?c.d:0,
    reverseDirection:reverse,megaTrendInversionBlocked:oppositeMegaBlocked,
    operatorHypotheticalNetR:naive.netR,reverseHypotheticalNetR:reversed?.netR??null,
    reverseStopTouched:reversed?.stopTouched??false,
    realOrder:false,paperOrder:false}));
   priorNoviceR=naive.netR;
  }
 }
 const summary=B289_PROFILES.map(profile=>{
  const x=events.filter(e=>e.profile===profile),active=x.filter(e=>e.reverseHypotheticalNetR!==null);
  const net=active.reduce((a,e)=>a+e.reverseHypotheticalNetR,0);
  const wins=active.filter(e=>e.reverseHypotheticalNetR>0).length;
  return Object.freeze({profile,operatorEvents:x.length,reverseDecisions:active.length,
   megaTrendBlocked:x.filter(e=>e.megaTrendInversionBlocked).length,
   hypotheticalWins:wins,hypotheticalLosses:active.filter(e=>e.reverseHypotheticalNetR<0).length,
   hypotheticalWinRatePct:active.length?round(100*wins/active.length):null,
   hypotheticalNetR:active.length?round(net):null});
 });
 return Object.freeze({schema:'JENIOS_B289_BEHAVIORAL_REVERSE_LAB_V1',
  protocolSha256:sha(B289_PROTOCOL),sourceSha256:sha(bars),asOfMs,
  holdoutStartIndex,events:Object.freeze(events),summary:Object.freeze(summary),
  syntheticOrCallerSuppliedHistory:true,originalRobotEvaluated:false,
  actualLosingOperatorsObserved:false,megaTrendPredictivePowerCertified:false,
  shortBorrowFundingModeled:false,brokerOrdersSent:0,paperOrdersSent:0,
  statisticalAdvantageCertified:false,commercialClaimsAllowed:false,
  noParameterPromotion:true});
}
