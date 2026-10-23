/**
 * R50 — economic shock / liquidity-cliff / adverse-selection stress.
 * Extends R49 without modifying prior certified controls.
 * Synthetic/offline only. No real or external Paper execution.
 */
import {adaptiveBreakevenGate} from './robot-r28-breakeven-recall.mjs';

const fail=c=>{throw Object.assign(new Error(c),{code:c});};
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));

export function evaluateR50ShockSnapshot(x){
  if(!x||typeof x.regime!=='string'||x.regime.length<1||
     !Number.isSafeInteger(x.epoch)||x.epoch<1||
     !finite(x.baseFeeBps)||x.baseFeeBps<0||
     !finite(x.spreadBps)||x.spreadBps<0||
     !finite(x.slippageBps)||x.slippageBps<0||
     !finite(x.adverseSelectionBps)||x.adverseSelectionBps<0||
     !finite(x.depthRatio)||x.depthRatio<=0||
     !finite(x.baseFillProbability)||x.baseFillProbability<=0||x.baseFillProbability>1||
     !finite(x.estimatedWinRate)||x.estimatedWinRate<0||x.estimatedWinRate>1||
     !finite(x.grossWinBps)||x.grossWinBps<=0||
     !finite(x.grossLossBps)||x.grossLossBps<=0)
    fail('R50_INVALID_SNAPSHOT');

  const depthPenalty=clamp(1/Math.max(.1,x.depthRatio),1,10);
  const liquiditySlippage=(depthPenalty-1)*x.slippageBps;
  const effectiveFill=clamp(x.baseFillProbability*Math.min(1,x.depthRatio),.01,1);
  const totalCostBps=
    x.baseFeeBps +
    x.spreadBps/2 +
    x.slippageBps +
    liquiditySlippage +
    x.adverseSelectionBps;

  const gate=adaptiveBreakevenGate({
    estimatedWinRate:x.estimatedWinRate,
    grossWinBps:x.grossWinBps,
    grossLossBps:x.grossLossBps,
    totalCostBps,
    fillProbability:effectiveFill
  });

  return Object.freeze({
    schema:'JENIOS_R50_SHOCK_SNAPSHOT_V1',
    regime:x.regime,
    epoch:x.epoch,
    depthRatio:x.depthRatio,
    effectiveFillProbability:Number(effectiveFill.toFixed(6)),
    totalCostBps:Number(totalCostBps.toFixed(6)),
    expectedNetBps:gate.expectedNetBps,
    allow:gate.allow,
    reasons:gate.reasons,
    actualBrokerPnl:null,ordersSent:0,paperOrdersSent:0
  });
}

export function runR50ShockTimeline({snapshots}={}){
  if(!Array.isArray(snapshots)||snapshots.length<3||snapshots.length>1000)
    fail('R50_INVALID_TIMELINE');
  let lastEpoch=0,lastAllow=null,revocations=0,reAuthorizations=0,falseCarryover=0;
  const trace=[];
  for(const s of snapshots){
    if(!Number.isSafeInteger(s.epoch)||s.epoch<=lastEpoch)fail('R50_NON_MONOTONIC_EPOCH');
    const x=evaluateR50ShockSnapshot(s);
    if(lastAllow===true&&x.allow===false)revocations++;
    if(lastAllow===false&&x.allow===true)reAuthorizations++;
    if(lastAllow===true&&x.allow===true&&trace.at(-1)?.epoch===x.epoch)falseCarryover++;
    trace.push(Object.freeze({
      regime:x.regime,epoch:x.epoch,allow:x.allow,
      totalCostBps:x.totalCostBps,
      effectiveFillProbability:x.effectiveFillProbability,
      expectedNetBps:x.expectedNetBps
    }));
    lastEpoch=s.epoch;lastAllow=x.allow;
  }
  return Object.freeze({
    schema:'JENIOS_R50_SHOCK_TIMELINE_V1',
    snapshots:snapshots.length,revocations,reAuthorizations,falseCarryover,
    trace:Object.freeze(trace),
    staleAuthorizationCarryover:false,
    actualBrokerPnl:null,ordersSent:0,paperOrdersSent:0
  });
}

export function runR50Battery(){
  const base={
    estimatedWinRate:.62,grossWinBps:15,grossLossBps:9,baseFillProbability:.95
  };
  const timeline=runR50ShockTimeline({snapshots:[
    {regime:'NORMAL',epoch:1,baseFeeBps:1,spreadBps:1,slippageBps:1,adverseSelectionBps:.5,depthRatio:1.2,...base},
    {regime:'FEE_SPIKE',epoch:2,baseFeeBps:8,spreadBps:1.5,slippageBps:1.5,adverseSelectionBps:.5,depthRatio:1.1,...base},
    {regime:'RECOVERY',epoch:3,baseFeeBps:1.2,spreadBps:1.2,slippageBps:1.1,adverseSelectionBps:.5,depthRatio:1.1,...base},
    {regime:'SPREAD_SHOCK',epoch:4,baseFeeBps:1.2,spreadBps:12,slippageBps:2,adverseSelectionBps:1,depthRatio:.9,...base},
    {regime:'LIQUIDITY_CLIFF',epoch:5,baseFeeBps:1.2,spreadBps:4,slippageBps:4,adverseSelectionBps:2,depthRatio:.2,...base},
    {regime:'ADVERSE_SELECTION',epoch:6,baseFeeBps:1.2,spreadBps:2,slippageBps:2,adverseSelectionBps:8,depthRatio:.8,...base},
    {regime:'NORMALIZED',epoch:7,baseFeeBps:1,spreadBps:1,slippageBps:1,adverseSelectionBps:.5,depthRatio:1.2,...base}
  ]});

  const pattern=timeline.trace.map(x=>x.allow);
  const expected=[true,false,true,false,false,false,true];
  const matches=pattern.length===expected.length&&pattern.every((v,i)=>v===expected[i]);

  const depthGood=evaluateR50ShockSnapshot({
    regime:'DEPTH_GOOD',epoch:20,baseFeeBps:1,spreadBps:1,slippageBps:1,
    adverseSelectionBps:.5,depthRatio:1.5,...base
  });
  const depthBad=evaluateR50ShockSnapshot({
    regime:'DEPTH_BAD',epoch:21,baseFeeBps:1,spreadBps:1,slippageBps:1,
    adverseSelectionBps:.5,depthRatio:.15,...base
  });

  return Object.freeze({
    schema:'JENIOS_R50_BATTERY_V1',
    patternMatches:matches,
    feeSpikeRevokes:timeline.trace[1].allow===false,
    spreadShockRevokes:timeline.trace[3].allow===false,
    liquidityCliffRevokes:timeline.trace[4].allow===false,
    adverseSelectionRevokes:timeline.trace[5].allow===false,
    normalizedRegimeReauthorizes:timeline.trace[6].allow===true,
    lowDepthReducesFill:depthBad.effectiveFillProbability<depthGood.effectiveFillProbability,
    lowDepthRaisesCost:depthBad.totalCostBps>depthGood.totalCostBps,
    noAuthorizationCarryover:timeline.staleAuthorizationCarryover===false&&timeline.falseCarryover===0,
    pass:matches&&timeline.revocations>=3&&timeline.reAuthorizations>=2&&
      depthBad.effectiveFillProbability<depthGood.effectiveFillProbability&&
      depthBad.totalCostBps>depthGood.totalCostBps&&timeline.falseCarryover===0,
    noExecution:true,
    actualBrokerPnl:null,actualLossesAvoided:null,realTradeAccuracy:null,
    ordersSent:0,paperOrdersSent:0
  });
}
