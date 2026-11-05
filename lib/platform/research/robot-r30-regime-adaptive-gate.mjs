/**
 * R30 — regime-adaptive UltraFast gate.
 * Re-evaluates R28 economics at every regime boundary. No authorization carries
 * forward across a change in cost/fill/signal conditions.
 */
import {adaptiveBreakevenGate} from './robot-r28-breakeven-recall.mjs';

const fail=c=>{throw Object.assign(new Error(c),{code:c});};
const finite=x=>typeof x==='number'&&Number.isFinite(x);

export function evaluateRegimeSnapshot(x){
 if(!x||typeof x.regime!=='string'||x.regime.length<1||
   !finite(x.totalCostBps)||!finite(x.fillProbability)||!finite(x.estimatedWinRate)||
   !finite(x.grossWinBps)||!finite(x.grossLossBps))
   fail('R30_INVALID_REGIME_SNAPSHOT');
 const gate=adaptiveBreakevenGate(x);
 return Object.freeze({
  schema:'JENIOS_R30_REGIME_SNAPSHOT_V1',
  regime:x.regime,
  allow:gate.allow,
  requiredWinRate:gate.requiredWinRate,
  estimatedWinRate:gate.estimatedWinRate,
  expectedNetBps:gate.expectedNetBps,
  safetyMarginBps:gate.safetyMarginBps,
  reasons:gate.reasons,
  authorizationEpoch:x.epoch,
  ordersSent:0
 });
}

export function runRegimeSession({regimes,attemptsPerRegime=2500}={}){
 if(!Array.isArray(regimes)||regimes.length<2||regimes.length>20||
   !Number.isSafeInteger(attemptsPerRegime)||attemptsPerRegime<100||attemptsPerRegime>10000)
   fail('R30_INVALID_SESSION');

 let syntheticR=0,allowedAttempts=0,blockedAttempts=0,transitions=0,revocations=0,reAuthorizations=0;
 let previousAllow=null,previousEpoch=null;
 const trace=[];

 for(const r of regimes){
  if(!Number.isSafeInteger(r.epoch)||r.epoch<0)fail('R30_INVALID_REGIME_EPOCH');
  const gate=evaluateRegimeSnapshot(r);
  if(previousEpoch!==null&&r.epoch===previousEpoch)fail('R30_EPOCH_NOT_ADVANCED');
  if(previousAllow===true&&gate.allow===false)revocations++;
  if(previousAllow===false&&gate.allow===true)reAuthorizations++;
  if(previousAllow!==null&&previousAllow!==gate.allow)transitions++;

  for(let i=0;i<attemptsPerRegime;i++){
   if(!gate.allow){blockedAttempts++;continue;}
   allowedAttempts++;
   const pseudo=(((i+r.epoch*10007)*1664525+1013904223)>>>0)%100000;
   const win=pseudo<Math.round(r.estimatedWinRate*100000);
   const gross=win?r.grossWinBps:-r.grossLossBps;
   syntheticR+=(gross-r.totalCostBps)*r.fillProbability/100;
  }
  trace.push(Object.freeze({
   regime:r.regime,epoch:r.epoch,allow:gate.allow,
   expectedNetBps:gate.expectedNetBps,safetyMarginBps:gate.safetyMarginBps
  }));
  previousAllow=gate.allow;previousEpoch=r.epoch;
 }
 return Object.freeze({
  schema:'JENIOS_R30_REGIME_SESSION_V1',
  regimes:regimes.length,attemptsPerRegime,allowedAttempts,blockedAttempts,
  transitions,revocations,reAuthorizations,
  syntheticR:Number(syntheticR.toFixed(6)),
  trace:Object.freeze(trace),
  staleAuthorizationCarryover:false,
  actualBrokerPnl:null,ordersSent:0,paperOrdersSent:0
 });
}

export function runR30ScenarioBattery(){
 const scenarios=[
  [
   {regime:'FAVORABLE',epoch:1,totalCostBps:.8,fillProbability:.95,estimatedWinRate:.61,grossWinBps:15,grossLossBps:9},
   {regime:'COST_SPIKE',epoch:2,totalCostBps:6,fillProbability:.9,estimatedWinRate:.61,grossWinBps:15,grossLossBps:9},
   {regime:'RECOVERY',epoch:3,totalCostBps:1.2,fillProbability:.93,estimatedWinRate:.60,grossWinBps:15,grossLossBps:9},
   {regime:'LOW_FILL',epoch:4,totalCostBps:1.2,fillProbability:.35,estimatedWinRate:.60,grossWinBps:15,grossLossBps:9}
  ],
  [
   {regime:'MID',epoch:11,totalCostBps:2,fillProbability:.82,estimatedWinRate:.58,grossWinBps:12,grossLossBps:10},
   {regime:'BAD_SIGNAL',epoch:12,totalCostBps:2,fillProbability:.82,estimatedWinRate:.51,grossWinBps:12,grossLossBps:10},
   {regime:'SIGNAL_RECOVERY',epoch:13,totalCostBps:2,fillProbability:.82,estimatedWinRate:.62,grossWinBps:12,grossLossBps:10}
  ],
  [
   {regime:'CHEAP',epoch:21,totalCostBps:.7,fillProbability:.98,estimatedWinRate:.57,grossWinBps:9,grossLossBps:5},
   {regime:'ADVERSE',epoch:22,totalCostBps:3.5,fillProbability:.70,estimatedWinRate:.55,grossWinBps:9,grossLossBps:9},
   {regime:'NORMALIZED',epoch:23,totalCostBps:1.4,fillProbability:.90,estimatedWinRate:.59,grossWinBps:9,grossLossBps:6}
  ]
 ];
 const results=scenarios.map(regimes=>runRegimeSession({regimes,attemptsPerRegime:2500}));
 return Object.freeze({
  schema:'JENIOS_R30_SCENARIO_BATTERY_V1',
  sessions:results.length,
  totalAllowed:results.reduce((s,x)=>s+x.allowedAttempts,0),
  totalBlocked:results.reduce((s,x)=>s+x.blockedAttempts,0),
  revocations:results.reduce((s,x)=>s+x.revocations,0),
  reAuthorizations:results.reduce((s,x)=>s+x.reAuthorizations,0),
  allNoCarryover:results.every(x=>x.staleAuthorizationCarryover===false),
  actualBrokerPnl:null,ordersSent:0,paperOrdersSent:0
 });
}
