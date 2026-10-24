/**
 * R56 — Manual mode final advisory refinement.
 * Operator remains sole decision maker; no automatic mode switch or order transport.
 */
const fail=c=>{throw Object.assign(new Error(c),{code:c});};
export function evaluateR56ManualAdvisory({
  consecutiveLosses,sessionDrawdownR,confidence,operatorRequestedHelp=false
}={}){
 if(!Number.isSafeInteger(consecutiveLosses)||consecutiveLosses<0||
    typeof sessionDrawdownR!=='number'||!Number.isFinite(sessionDrawdownR)||sessionDrawdownR<0||
    typeof confidence!=='number'||!Number.isFinite(confidence)||confidence<0||confidence>1||
    typeof operatorRequestedHelp!=='boolean')fail('R56_INVALID_INPUT');
 const advisories=[];
 if(consecutiveLosses>=3)advisories.push('SUGGEST_PAUSE_AND_REVIEW');
 if(sessionDrawdownR>=5)advisories.push('SESSION_RISK_WARNING');
 if(confidence<.55)advisories.push('LOW_SIGNAL_CONFIDENCE');
 if(operatorRequestedHelp)advisories.push('OFFER_CONTEXTUAL_ANALYSIS');
 return Object.freeze({
   mode:'manual',
   advisories:Object.freeze(advisories),
   automaticModeSwitch:false,
   automaticEntry:false,
   automaticExit:false,
   operatorRetainsControl:true,
   actualBrokerPnl:null,actualLossesAvoided:null,realTradeAccuracy:null,
   ordersSent:0,paperOrdersSent:0
 });
}
export function runR56Battery(){
 const calm=evaluateR56ManualAdvisory({consecutiveLosses:0,sessionDrawdownR:0,confidence:.8});
 const stressed=evaluateR56ManualAdvisory({consecutiveLosses:4,sessionDrawdownR:6,confidence:.5,operatorRequestedHelp:true});
 return Object.freeze({
   calmNoForcedIntervention:calm.automaticModeSwitch===false&&calm.automaticEntry===false,
   stressedWarnsWithoutTakingControl:stressed.advisories.length>=3&&stressed.operatorRetainsControl===true,
   pass:calm.automaticModeSwitch===false&&calm.automaticEntry===false&&stressed.operatorRetainsControl===true,
   actualBrokerPnl:null,actualLossesAvoided:null,realTradeAccuracy:null,ordersSent:0,paperOrdersSent:0
 });
}