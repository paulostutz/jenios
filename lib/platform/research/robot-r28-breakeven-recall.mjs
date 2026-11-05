/**
 * R28 — adaptive break-even gate refinement.
 * Goal: improve recall of positive synthetic configurations without increasing
 * false-positive negative configurations versus R27.
 */
import {dynamicBreakevenGate,compareGatePolicy} from './robot-r27-dynamic-breakeven.mjs';

const fail=c=>{throw Object.assign(new Error(c),{code:c});};
const finite=x=>typeof x==='number'&&Number.isFinite(x);

export function adaptiveSafetyMargin({totalCostBps,fillProbability,grossWinBps,grossLossBps,estimatedWinRate}={}){
 for(const x of [totalCostBps,fillProbability,grossWinBps,grossLossBps,estimatedWinRate])
  if(!finite(x))fail('R28_INVALID_MARGIN_INPUT');
 if(totalCostBps<0||fillProbability<=0||fillProbability>1||grossWinBps<=0||grossLossBps<=0||
   estimatedWinRate<0||estimatedWinRate>1)fail('R28_INVALID_MARGIN_INPUT');

 const rr=grossWinBps/grossLossBps;
 let margin=1;
 if(totalCostBps<=1&&fillProbability>=.9&&rr>=1.25&&estimatedWinRate>=.54)margin=.35;
 else if(totalCostBps<=2&&fillProbability>=.75&&rr>=1.1&&estimatedWinRate>=.56)margin=.55;
 else if(totalCostBps<=3.5&&fillProbability>=.75&&rr>=1&&estimatedWinRate>=.58)margin=.75;
 return Number(margin.toFixed(6));
}

export function adaptiveBreakevenGate(cfg){
 if(!cfg||!finite(cfg.totalCostBps)||!finite(cfg.fillProbability)||!finite(cfg.grossWinBps)||
   !finite(cfg.grossLossBps)||!finite(cfg.estimatedWinRate))fail('R28_INVALID_GATE_INPUT');
 const safetyMarginBps=adaptiveSafetyMargin(cfg);
 const gate=dynamicBreakevenGate({...cfg,safetyMarginBps});
 return Object.freeze({
  schema:'JENIOS_R28_ADAPTIVE_BREAKEVEN_GATE_V1',
  ...gate,
  safetyMarginBps
 });
}

function pseudoWin(i,rate){return (((i*1103515245+12345)>>>0)%100000)<Math.round(rate*100000);}

export function compareAdaptivePolicy(cfg){
 if(!cfg||!Number.isSafeInteger(cfg.attempts)||cfg.attempts<1000||cfg.attempts>20000)
  fail('R28_INVALID_POLICY');
 const baseline=dynamicBreakevenGate({...cfg,safetyMarginBps:1});
 const adaptive=adaptiveBreakevenGate(cfg);
 let actualSyntheticR=0;
 for(let i=0;i<cfg.attempts;i++){
  const win=pseudoWin(i,cfg.estimatedWinRate);
  const gross=win?cfg.grossWinBps:-cfg.grossLossBps;
  actualSyntheticR+=(gross-cfg.totalCostBps)*cfg.fillProbability/100;
 }
 const rounded=Number(actualSyntheticR.toFixed(6));
 return Object.freeze({
  baselineAllow:baseline.allow,
  adaptiveAllow:adaptive.allow,
  syntheticR:rounded,
  positive:rounded>0,
  baselineFalsePositive:baseline.allow&&rounded<=0,
  adaptiveFalsePositive:adaptive.allow&&rounded<=0,
  recoveredPositive:!baseline.allow&&adaptive.allow&&rounded>0,
  ordersSent:0,paperOrdersSent:0,actualBrokerPnl:null
 });
}

export function runR28Grid(){
 let total=0,positive=0;
 let baselineAllowed=0,adaptiveAllowed=0;
 let baselinePositiveCaptured=0,adaptivePositiveCaptured=0;
 let baselineFalsePositive=0,adaptiveFalsePositive=0,recoveredPositive=0;
 for(const totalCostBps of [.5,1,2,3.5,5,8,12])
 for(const fillProbability of [.25,.5,.75,.95])
 for(const estimatedWinRate of [.48,.52,.54,.56,.58,.60,.65,.70,.75])
 for(const grossWinBps of [4,8,12,20])
 for(const lossRatio of [.5,.75,1,1.25]){
  total++;
  const x=compareAdaptivePolicy({attempts:5000,totalCostBps,fillProbability,estimatedWinRate,
    grossWinBps,grossLossBps:grossWinBps*lossRatio});
  if(x.positive)positive++;
  if(x.baselineAllow)baselineAllowed++;
  if(x.adaptiveAllow)adaptiveAllowed++;
  if(x.baselineAllow&&x.positive)baselinePositiveCaptured++;
  if(x.adaptiveAllow&&x.positive)adaptivePositiveCaptured++;
  if(x.baselineFalsePositive)baselineFalsePositive++;
  if(x.adaptiveFalsePositive)adaptiveFalsePositive++;
  if(x.recoveredPositive)recoveredPositive++;
 }
 return Object.freeze({
  schema:'JENIOS_R28_GRID_SUMMARY_V1',
  total,positive,baselineAllowed,adaptiveAllowed,
  baselinePositiveCaptured,adaptivePositiveCaptured,
  baselineFalsePositive,adaptiveFalsePositive,recoveredPositive,
  recallBaseline:Number((baselinePositiveCaptured/positive).toFixed(6)),
  recallAdaptive:Number((adaptivePositiveCaptured/positive).toFixed(6)),
  actualBrokerPnl:null,ordersSent:0,paperOrdersSent:0
 });
}
