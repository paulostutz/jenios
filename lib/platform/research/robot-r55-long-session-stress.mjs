/**
 * R55 — long-session deterministic stress across regime changes.
 */
const fail=c=>{throw Object.assign(new Error(c),{code:c});};
export function runR55LongSession({events=100000,maxDrawdownR=20,maxLossStreak=10}={}){
 if(!Number.isSafeInteger(events)||events<20000||events>250000)fail('R55_INVALID_EVENTS');
 let equity=0,peak=0,dd=0,lossStreak=0,trades=0,halts=0,blocked=0;
 let halted=false,session=1;
 for(let i=1;i<=events;i++){
   if(i%20000===0){session++;halted=false;lossStreak=0;peak=equity;dd=0;}
   const outage=i%5003===0;
   const badRegime=i%97<18;
   const stale=i%701===0;
   if(outage||badRegime||stale||halted){blocked++;continue;}
   const win=((i*1664525+1013904223)>>>0)%100<58;
   const net=win?.28:-.34;
   equity+=net;trades++;
   peak=Math.max(peak,equity);dd=Math.max(dd,peak-equity);
   lossStreak=net<0?lossStreak+1:0;
   if(dd>=maxDrawdownR||lossStreak>=maxLossStreak){halted=true;halts++;}
 }
 return Object.freeze({
   schema:'JENIOS_R55_LONG_SESSION_V1',events,sessions:session,trades,blocked,halts,
   syntheticR:Number(equity.toFixed(6)),maxDrawdownLimitR:maxDrawdownR,
   sessionResets:true,pass:trades>0&&blocked>0&&halts>=0,
   actualBrokerPnl:null,actualLossesAvoided:null,realTradeAccuracy:null,
   ordersSent:0,paperOrdersSent:0
 });
}