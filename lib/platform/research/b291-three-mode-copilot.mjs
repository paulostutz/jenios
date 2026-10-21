/** B291 commercial-mode contract. Pure read-only classification, never advice from generative text. */
const fail=c=>{throw Object.assign(new Error(c),{code:c});};
export const B291_MODES=Object.freeze({
 manual:Object.freeze({operatorDecides:true,assistedSignals:false,invertsOrders:false,automaticExecution:false}),
 hybrid:Object.freeze({operatorDecides:true,assistedSignals:true,invertsOrders:false,automaticExecution:false}),
 reverse:Object.freeze({operatorDecides:true,assistedSignals:false,invertsOrders:true,automaticExecution:false})
});
export function classifyB291Mode(mode){
 if(!Object.hasOwn(B291_MODES,mode))fail('B291_UNKNOWN_COMMERCIAL_MODE');
 return B291_MODES[mode];
}
export function reviewB291CopilotContext(input){
 if(!input||input.mode!=='hybrid'||!Number.isSafeInteger(input.closedAtMs)||
 !Number.isSafeInteger(input.observedAtMs)||input.closedAtMs>input.observedAtMs||
 !Number.isFinite(input.atrPct)||input.atrPct<0||input.atrPct>100||
 !Number.isFinite(input.spreadBps)||input.spreadBps<0||input.spreadBps>1000||
 !Number.isFinite(input.maxRiskPct)||input.maxRiskPct<=0||input.maxRiskPct>2||
 !['UP','DOWN','NEUTRAL'].includes(input.marketBias)||
 typeof input.asset!=='string'||!/^[A-Z0-9-]{3,25}$/.test(input.asset)||
 input.providerSigned!==false||input.operatorApproved!==false)
 fail('B291_INVALID_OR_UNVERIFIED_CONTEXT');
 const reasons=[];
 if(input.atrPct>6)reasons.push('VOLATILITY_STRESS');
 if(input.spreadBps>30)reasons.push('WIDE_SPREAD');
 if(input.marketBias==='NEUTRAL')reasons.push('NO_DIRECTIONAL_CONFIRMATION');
 return Object.freeze({schema:'JENIOS_B291_HYBRID_COPILOT_RESEARCH_V1',
  asset:input.asset,marketBias:input.marketBias,
  classification:reasons.length?'WAIT_AND_REVIEW':'CONTEXT_FOR_OPERATOR_REVIEW',
  reasons:Object.freeze(reasons),
  stopSuggestion:null,targetSuggestion:null,entryPriceSuggestion:null,
  positionSizeSuggestion:null,assetRecommendation:null,
  humanDecisionRequired:true,originalEngineSignalVerified:false,
  independentMarketSourceVerified:false,liveMarketData:false,
  ordersSent:0,reverseOrdersSent:0,executionEnabled:false,
  generativeTextCannotAuthorizeTrade:true,
  statisticalAdvantageCertified:false});
}
export function reviewB291ManualLossStreak(events,{threshold=3}={}){
 if(!Array.isArray(events)||events.length>1000||!Number.isInteger(threshold)||
 threshold<2||threshold>10)fail('B291_INVALID_LOSS_STREAK');
 let streak=0,last=-1;
 for(const e of events){
  if(!e||!Number.isSafeInteger(e.closedAtMs)||e.closedAtMs<=last||
  !Number.isFinite(e.netResult)||e.verifiedClosedTrade!==true)
  fail('B291_UNVERIFIED_MANUAL_TRADE');
  streak=e.netResult<0?streak+1:0;last=e.closedAtMs;
 }
 return Object.freeze({lossStreak:streak,threshold,
  pauseSuggested:streak>=threshold,
  reverseModeEducationSuggested:streak>=threshold,
  automaticModeSwitch:false,reversePerformanceClaim:false,
  executionEnabled:false});
}
