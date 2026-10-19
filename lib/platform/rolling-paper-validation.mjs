/** B94 — pre-declared rolling evaluation windows for educational B83 replay.
 * No calibrating a strategy on the validation rows; no automatic winner or claims.
 * This is NOT validation of the proprietary JENIOS private robot cores.
 */
import {replayHistoricalScenario} from './paper-replay.mjs';
import {inspectHistoricalBars} from './historical-quality.mjs';
const MODES=Object.freeze(['direto','reverso','hibrido']);
export const FROZEN_STRESS_GRID=Object.freeze([
 Object.freeze({feeBps:5,slippageBps:5,stopPct:.02,name:'baseline_ilustrativa'}),
 Object.freeze({feeBps:25,slippageBps:30,stopPct:.02,name:'custos_e_spread_ampliados'}),
 Object.freeze({feeBps:60,slippageBps:80,stopPct:.01,name:'estresse_de_liquidez_e_stop'})
]);
const invalid=why=>({valid:false,reason:why,realExecutionAllowed:false,
 performanceCertified:false,originalRobotsEvaluated:false});
const round=x=>Number(x.toFixed(4));
export function evaluateRollingPaperWindows(raw,{now=Date.now(),windowSize=100,initialBalance=100000,
 allocationPct=.1,minWindows=3}={}){
 if(!Number.isInteger(windowSize)||windowSize<90||windowSize>300||
  !Number.isInteger(minWindows)||minWindows<3||minWindows>10||
  typeof initialBalance!=='number'||!Number.isFinite(initialBalance)||
  initialBalance<100||initialBalance>100000000||typeof allocationPct!=='number'||
  !Number.isFinite(allocationPct)||allocationPct<=0||allocationPct>.25)
  return invalid('INVALID_FROZEN_PROTOCOL');
 let audited;
 try{audited=inspectHistoricalBars(raw,{now});}
 catch{return invalid('INVALID_HISTORICAL_SERIES');}
 if(!audited.replayEligible)return invalid('HISTORICAL_QUALITY_NOT_CONFIRMED');
 const evaluationStart=Math.max(60,Math.floor(windowSize*.7));
 const stride=windowSize-evaluationStart;
 const totalWindows=Math.floor((raw.length-windowSize)/stride)+1;
 if(totalWindows<minWindows)return invalid('INSUFFICIENT_INDEPENDENT_HOLDOUT_WINDOWS');
 const windows=[],rows=[];
 for(let i=0;i<totalWindows;i++){
  const start=i*stride,end=start+windowSize;
  if(end>raw.length)break;
  const subset=raw.slice(start,end);
  const startOfEvaluation=start+evaluationStart;
  const endOfEvaluation=end-1;
  const w={
   windowId:i+1,trainStart:start,trainEnd:startOfEvaluation-1,
   evaluationStart:startOfEvaluation,evaluationEnd:endOfEvaluation,
   validationStartAt:subset[evaluationStart].time,
   validationEndAt:subset.at(-1).time,
   modesTested:MODES.length,scenarioCount:MODES.length*FROZEN_STRESS_GRID.length
  };
  // Explicit holdout embargo: no two validation intervals may overlap.
  if(windows.length&&w.evaluationStart<=windows.at(-1).evaluationEnd)
   return invalid('OVERLAPPING_HOLDOUT_EVIDENCE');
  windows.push(w);
  for(const mode of MODES){
   for(const cost of FROZEN_STRESS_GRID){
    const result=replayHistoricalScenario(subset,{
     now,mode,initialBalance,allocationPct,...cost
    });
    if(result.ok!==true)return invalid('PAPER_SCENARIO_FAILED_CLOSED');
    if(result.evaluationBars!==stride||result.evaluationStart!==evaluationStart||
       result.orderAuthorized!==false||result.providerVerified!==false||
       result.strategy!=='illustrative_sma_hypothesis_not_protected_robot')
     return invalid('NONCOMPARABLE_SCENARIOS');
    rows.push({
     windowId:w.windowId,mode,scenario:cost.name,
     feeBps:cost.feeBps,slippageBps:cost.slippageBps,stopPct:cost.stopPct,
     returnPct:result.hypotheticalReturnPct,
     maxDrawdownPct:result.hypotheticalMaxDrawdownPct,
     entries:result.entries,closedTrades:result.closedTrades,stops:result.paperStops,
     evaluationStart:w.evaluationStart,evaluationEnd:w.evaluationEnd,
     realExecutionAllowed:false
    });
   }
  }
 }
 if(windows.length<minWindows)return invalid('INSUFFICIENT_NONOVERLAPPING_WINDOWS');
 const modeSummary=MODES.map(mode=>{
  const samples=rows.filter(r=>r.mode===mode),min=Math.min(...samples.map(r=>r.returnPct));
  const sorted=samples.map(r=>r.returnPct).sort((a,b)=>a-b);
  const mid=sorted.length>>1;
  const median=sorted.length%2?sorted[mid]:(sorted[mid-1]+sorted[mid])/2;
  return {mode,hypotheticalMedianReturnPct:round(median),
   hypotheticalWorstReturnPct:min,
   hypotheticalWorstDrawdownPct:Math.max(...samples.map(r=>r.maxDrawdownPct)),
   scenarios:samples.length};
 });
 return Object.freeze({
  valid:true,source:'historical_user_supplied_rolling_paper_lab',
  protocolFrozen:true,windowSize,stride,windows,scenarioRows:rows,modeSummary,
  evaluatedFills:false,brokerConnected:false,providerVerified:false,
  originalRobotsEvaluated:false,prospectiveEvidence:false,
  confidenceIntervalCertified:false,recommendedMode:null,
  performanceCertified:false,realExecutionAllowed:false,
  caution:'Métricas hipotéticas de um roteiro ilustrativo. Janelas sequenciais podem ser dependentes; não há prova estatística, garantia de execução ou avaliação do núcleo privado.'
 });
}
