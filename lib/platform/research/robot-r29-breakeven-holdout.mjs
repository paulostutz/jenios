/**
 * R29 — independent holdout for R27 baseline vs R28 adaptive break-even gate.
 * Policy is frozen; this block does not tune thresholds or margins.
 */
import {dynamicBreakevenGate} from './robot-r27-dynamic-breakeven.mjs';
import {adaptiveBreakevenGate} from './robot-r28-breakeven-recall.mjs';

const fail=c=>{throw Object.assign(new Error(c),{code:c});};

function pseudoWin(i,rate){return (((i*1103515245+12345)>>>0)%100000)<Math.round(rate*100000);}

export function evaluateFrozenHoldout(cfg){
 if(!cfg||!Number.isSafeInteger(cfg.attempts)||cfg.attempts!==7000)fail('R29_INVALID_HOLDOUT_CONFIG');
 const baseline=dynamicBreakevenGate({...cfg,safetyMarginBps:1});
 const adaptive=adaptiveBreakevenGate(cfg);
 let syntheticR=0;
 for(let i=0;i<cfg.attempts;i++){
  const win=pseudoWin(i,cfg.estimatedWinRate);
  const gross=win?cfg.grossWinBps:-cfg.grossLossBps;
  syntheticR+=(gross-cfg.totalCostBps)*cfg.fillProbability/100;
 }
 syntheticR=Number(syntheticR.toFixed(6));
 const positive=syntheticR>0;
 return Object.freeze({
  baselineAllow:baseline.allow,
  adaptiveAllow:adaptive.allow,
  syntheticR,
  positive,
  baselineFalsePositive:baseline.allow&&!positive,
  adaptiveFalsePositive:adaptive.allow&&!positive,
  recoveredPositive:!baseline.allow&&adaptive.allow&&positive,
  actualBrokerPnl:null,ordersSent:0,paperOrdersSent:0
 });
}

export function runR29IndependentHoldout(){
 const costs=[.7,1.4,2.7,4.5,7,10];
 const fills=[.35,.60,.82,.98];
 const winRates=[.49,.515,.545,.575,.61,.67,.73];
 const grossWins=[5,9,15,24];
 const lossRatios=[.6,.9,1.1,1.4];

 let total=0,positive=0,baselineAllowed=0,adaptiveAllowed=0;
 let baselinePositiveCaptured=0,adaptivePositiveCaptured=0;
 let baselineFalsePositive=0,adaptiveFalsePositive=0,recoveredPositive=0;

 for(const totalCostBps of costs)
 for(const fillProbability of fills)
 for(const estimatedWinRate of winRates)
 for(const grossWinBps of grossWins)
 for(const lossRatio of lossRatios){
  const x=evaluateFrozenHoldout({
   attempts:7000,totalCostBps,fillProbability,estimatedWinRate,
   grossWinBps,grossLossBps:grossWinBps*lossRatio
  });
  total++;
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
  schema:'JENIOS_R29_INDEPENDENT_HOLDOUT_V1',
  frozenPolicy:true,
  total,positive,baselineAllowed,adaptiveAllowed,
  baselinePositiveCaptured,adaptivePositiveCaptured,
  baselineFalsePositive,adaptiveFalsePositive,recoveredPositive,
  recallBaseline:Number((baselinePositiveCaptured/positive).toFixed(6)),
  recallAdaptive:Number((adaptivePositiveCaptured/positive).toFixed(6)),
  adaptiveBeatsBaseline:adaptivePositiveCaptured>baselinePositiveCaptured &&
    adaptiveFalsePositive<=baselineFalsePositive,
  actualBrokerPnl:null,ordersSent:0,paperOrdersSent:0
 });
}
