/**
 * R54 — larger-horizon multiwindow stability validation.
 */
const fail=c=>{throw Object.assign(new Error(c),{code:c});};
export function evaluateR54Series({symbol,scores,eligibleFlags}={}){
 if(typeof symbol!=='string'||!Array.isArray(scores)||!Array.isArray(eligibleFlags)||
   scores.length!==eligibleFlags.length||scores.length<12)fail('R54_INVALID_SERIES');
 const avg=scores.reduce((a,b)=>a+b,0)/scores.length;
 const variance=scores.reduce((a,b)=>a+(b-avg)**2,0)/scores.length;
 const std=Math.sqrt(variance);
 const eligibleRatio=eligibleFlags.filter(Boolean).length/eligibleFlags.length;
 const stability=Math.max(0,1-std/Math.max(1,Math.abs(avg)));
 const aggregate=avg*stability*eligibleRatio;
 return Object.freeze({symbol,windows:scores.length,avgScore:Number(avg.toFixed(6)),std:Number(std.toFixed(6)),eligibleRatio:Number(eligibleRatio.toFixed(6)),stability:Number(stability.toFixed(6)),aggregate:Number(aggregate.toFixed(6)),eligible:eligibleRatio>=.7&&stability>=.5});
}
export function runR54Battery(){
 const stable=evaluateR54Series({symbol:'STABLE',scores:Array.from({length:24},(_,i)=>60+(i%3)-1),eligibleFlags:Array(24).fill(true)});
 const unstable=evaluateR54Series({symbol:'UNSTABLE',scores:Array.from({length:24},(_,i)=>i%2?100:10),eligibleFlags:Array.from({length:24},(_,i)=>i%3!==0)});
 return Object.freeze({
   stableEligible:stable.eligible,
   unstablePenalized:unstable.aggregate<stable.aggregate,
   largerHorizonWindows:stable.windows===24,
   pass:stable.eligible&&unstable.aggregate<stable.aggregate,
   actualBrokerPnl:null,ordersSent:0,paperOrdersSent:0
 });
}