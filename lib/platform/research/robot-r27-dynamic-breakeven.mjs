/**
 * R27 — Dynamic break-even gate for UltraFast.
 * Synthetic/offline economics only. No broker transport or real execution.
 */
const fail=c=>{throw Object.assign(new Error(c),{code:c});};
const finite=x=>typeof x==='number'&&Number.isFinite(x);

export function breakevenWinRate({grossWinBps,grossLossBps,totalCostBps,fillProbability,safetyMarginBps=0}={}){
 for(const x of [grossWinBps,grossLossBps,totalCostBps,fillProbability,safetyMarginBps])
  if(!finite(x))fail('R27_INVALID_BREAK_EVEN_INPUT');
 if(grossWinBps<=0||grossLossBps<=0||totalCostBps<0||fillProbability<=0||fillProbability>1||safetyMarginBps<0)
  fail('R27_INVALID_BREAK_EVEN_INPUT');
 const winNet=(grossWinBps-totalCostBps-safetyMarginBps)*fillProbability;
 const lossNet=(grossLossBps+totalCostBps+safetyMarginBps)*fillProbability;
 if(winNet<=0)return Object.freeze({requiredWinRate:1,viable:false,winNetBps:winNet,lossNetBps:lossNet});
 const req=lossNet/(winNet+lossNet);
 return Object.freeze({
  requiredWinRate:Number(req.toFixed(8)),
  viable:req<1,
  winNetBps:Number(winNet.toFixed(6)),
  lossNetBps:Number(lossNet.toFixed(6))
 });
}

export function expectedEdgeAfterCosts({estimatedWinRate,grossWinBps,grossLossBps,totalCostBps,fillProbability,safetyMarginBps=0}={}){
 if(!finite(estimatedWinRate)||estimatedWinRate<0||estimatedWinRate>1)fail('R27_INVALID_EXPECTATION_INPUT');
 const b=breakevenWinRate({grossWinBps,grossLossBps,totalCostBps,fillProbability,safetyMarginBps});
 const expected=estimatedWinRate*b.winNetBps-(1-estimatedWinRate)*b.lossNetBps;
 return Object.freeze({
  ...b,
  estimatedWinRate,
  expectedNetBps:Number(expected.toFixed(6)),
  edgeMarginBps:Number((expected-safetyMarginBps).toFixed(6)),
  allow:b.viable&&estimatedWinRate>b.requiredWinRate&&expected>safetyMarginBps
 });
}

export function dynamicBreakevenGate(x){
 const e=expectedEdgeAfterCosts(x);
 const reasons=[];
 if(!e.viable)reasons.push('WIN_TOO_SMALL_AFTER_COSTS');
 if(e.estimatedWinRate<=e.requiredWinRate)reasons.push('BELOW_BREAK_EVEN_WIN_RATE');
 if(e.expectedNetBps<=x.safetyMarginBps)reasons.push('INSUFFICIENT_EXPECTED_MARGIN');
 return Object.freeze({
  schema:'JENIOS_R27_DYNAMIC_BREAKEVEN_GATE_V1',
  allow:reasons.length===0,
  reasons:Object.freeze(reasons),
  requiredWinRate:e.requiredWinRate,
  estimatedWinRate:e.estimatedWinRate,
  expectedNetBps:e.expectedNetBps,
  winNetBps:e.winNetBps,
  lossNetBps:e.lossNetBps,
  actualBrokerPnl:null,ordersSent:0,paperOrdersSent:0
 });
}

function pseudoWin(i,rate){return (((i*1103515245+12345)>>>0)%100000)<Math.round(rate*100000);}

export function compareGatePolicy(cfg){
 if(!cfg||!Number.isSafeInteger(cfg.attempts)||cfg.attempts<1000||cfg.attempts>20000)fail('R27_INVALID_POLICY');
 const gate=dynamicBreakevenGate(cfg);
 let ungatedR=0,gatedR=0,ungatedTrades=0,gatedTrades=0;
 for(let i=0;i<cfg.attempts;i++){
  const win=pseudoWin(i,cfg.estimatedWinRate);
  const gross=win?cfg.grossWinBps:-cfg.grossLossBps;
  const net=(gross-cfg.totalCostBps)*cfg.fillProbability/100;
  ungatedR+=net;ungatedTrades++;
  if(gate.allow){gatedR+=net;gatedTrades++;}
 }
 return Object.freeze({
  schema:'JENIOS_R27_POLICY_COMPARISON_V1',
  gate,
  ungated:Object.freeze({trades:ungatedTrades,syntheticR:Number(ungatedR.toFixed(6))}),
  gated:Object.freeze({trades:gatedTrades,syntheticR:Number(gatedR.toFixed(6))}),
  blockedAttempts:ungatedTrades-gatedTrades,
  actualBrokerPnl:null,ordersSent:0,paperOrdersSent:0
 });
}

export function runR27Grid(){
 let total=0,allowed=0,blocked=0,positiveUngated=0,positiveGated=0,gateAvoidedNegative=0;
 const results=[];
 for(const totalCostBps of [.5,1,2,3.5,5,8,12])
 for(const fillProbability of [.25,.5,.75,.95])
 for(const estimatedWinRate of [.48,.52,.54,.56,.58,.60,.65,.70,.75])
 for(const grossWinBps of [4,8,12,20])
 for(const lossRatio of [.5,.75,1,1.25]){
  const grossLossBps=grossWinBps*lossRatio;
  const x=compareGatePolicy({attempts:5000,totalCostBps,fillProbability,estimatedWinRate,
    grossWinBps,grossLossBps,safetyMarginBps:1});
  total++;
  if(x.gate.allow)allowed++;else blocked++;
  if(x.ungated.syntheticR>0)positiveUngated++;
  if(x.gated.syntheticR>0)positiveGated++;
  if(x.ungated.syntheticR<0&&x.gated.trades===0)gateAvoidedNegative++;
  results.push(x);
 }
 return Object.freeze({
  schema:'JENIOS_R27_GRID_SUMMARY_V1',
  total,allowed,blocked,positiveUngated,positiveGated,gateAvoidedNegative,
  actualBrokerPnl:null,ordersSent:0,paperOrdersSent:0
 });
}
