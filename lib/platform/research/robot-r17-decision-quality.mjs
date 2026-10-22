/**
 * ROBOT R17 — public/offline decision-quality evaluator.
 * Consumes sanitized synthetic metrics only. No market fetch, broker transport,
 * private engine import, external Paper, real PnL or commercial claims.
 */
const fail=code=>{throw Object.assign(new Error(code),{code});};
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const MODES=['manual','hybrid','reverse_unvalidated','reverse_hypothetically_calibrated'];

export const R17_QUALITY_SPEC=Object.freeze({
 schema:'JENIOS_ROBOT_R17_QUALITY_SPEC_V1',
 syntheticOnly:true,
 minRunsPerMode:1,
 maxHarmRateForAdvisory:0.30,
 maxNewNegativePerDecisionR:0.06,
 maxAbstentionRate:0.60,
 requireZeroExecution:true,
 releaseGate:'NO_GO'
});

export function reviewR17ModeQuality(row){
 if(!row||!MODES.includes(row.mode)||!Number.isSafeInteger(row.runs)||row.runs<1||
  !Number.isSafeInteger(row.decisions)||row.decisions<1||
  !Number.isSafeInteger(row.abstentions)||row.abstentions<0||row.abstentions>row.decisions||
  !Number.isSafeInteger(row.helped)||!Number.isSafeInteger(row.harmed)||!Number.isSafeInteger(row.unchanged)||
  row.helped<0||row.harmed<0||row.unchanged<0||
  row.helped+row.harmed+row.unchanged!==row.decisions||
  !['netUpliftR','degradationR','missedWinnersR','newNegativeR'].every(k=>finite(row[k]))||
  row.degradationR<0||row.missedWinnersR<0||row.newNegativeR<0)
  fail('R17_INVALID_MODE_METRICS');

 const rates=Object.freeze({
  abstentionRate:row.abstentions/row.decisions,
  helpedRate:row.helped/row.decisions,
  harmedRate:row.harmed/row.decisions,
  unchangedRate:row.unchanged/row.decisions,
  netUpliftPerDecisionR:row.netUpliftR/row.decisions,
  degradationPerDecisionR:row.degradationR/row.decisions,
  missedWinnersPerDecisionR:row.missedWinnersR/row.decisions,
  newNegativePerDecisionR:row.newNegativeR/row.decisions
 });
 const issues=[];
 if(rates.harmedRate>R17_QUALITY_SPEC.maxHarmRateForAdvisory)issues.push('HARM_RATE_TOO_HIGH');
 if(rates.newNegativePerDecisionR>R17_QUALITY_SPEC.maxNewNegativePerDecisionR)issues.push('NEW_NEGATIVE_COST_TOO_HIGH');
 if(rates.abstentionRate>R17_QUALITY_SPEC.maxAbstentionRate)issues.push('TOO_CONSERVATIVE');
 if(row.mode!=='manual'&&rates.netUpliftPerDecisionR<=0)issues.push('NO_SYNTHETIC_UPLIFT');
 return Object.freeze({
  schema:'JENIOS_ROBOT_R17_MODE_QUALITY_V1',mode:row.mode,rates,
  issues:Object.freeze(issues),
  classification:issues.length?'REFINE_BEFORE_NEXT_CYCLE':'LAB_QUALITY_ACCEPTABLE',
  actualBrokerPnl:null,actualLossesAvoided:null,tradeAccuracy:null,
  realMarketAdvantageCertified:false,commercialPerformanceCertified:false,
  ordersSent:0,paperOrdersSent:0
 });
}

export function reviewR17IntentSensitivity(rows){
 if(!Array.isArray(rows)||rows.length<2)fail('R17_INVALID_INTENT_SENSITIVITY');
 const sorted=[...rows].sort((a,b)=>a.intentErrorRate-b.intentErrorRate);
 for(const x of sorted){
  if(!x||!finite(x.intentErrorRate)||x.intentErrorRate<0||x.intentErrorRate>1||
   !finite(x.netUpliftR))fail('R17_INVALID_INTENT_SENSITIVITY');
 }
 const zero=sorted.find(x=>x.intentErrorRate===0);
 const full=sorted.find(x=>x.intentErrorRate===1);
 const issues=[];
 if(zero&&zero.netUpliftR<0)issues.push('HARMS_ALREADY_ALIGNED_OPERATOR_IN_LAB');
 if(full&&full.netUpliftR<=0)issues.push('FAILS_TO_HELP_MAXIMALLY_WRONG_OPERATOR_IN_LAB');
 let monotonic=true;
 for(let i=1;i<sorted.length;i++)if(sorted[i].netUpliftR<sorted[i-1].netUpliftR)monotonic=false;
 if(!monotonic)issues.push('NON_MONOTONIC_INTENT_ERROR_RESPONSE');
 return Object.freeze({
  schema:'JENIOS_ROBOT_R17_INTENT_SENSITIVITY_V1',
  observations:sorted.length,issues:Object.freeze(issues),
  classification:issues.includes('HARMS_ALREADY_ALIGNED_OPERATOR_IN_LAB')?
   'NEEDS_OPERATOR_ALIGNMENT_GUARD':'LAB_PATTERN_ACCEPTABLE',
  realMarketAdvantageCertified:false,ordersSent:0,paperOrdersSent:0
 });
}

export function summarizeR17({modes,intentSensitivityByMode}={}){
 if(!Array.isArray(modes)||modes.length!==4||!intentSensitivityByMode||
   typeof intentSensitivityByMode!=='object')fail('R17_INVALID_SUMMARY_INPUT');
 const reviews=modes.map(reviewR17ModeQuality);
 const sensitivity=Object.fromEntries(Object.entries(intentSensitivityByMode)
  .map(([mode,rows])=>[mode,reviewR17IntentSensitivity(rows)]));
 const issues=[...new Set([
  ...reviews.flatMap(x=>x.issues),
  ...Object.values(sensitivity).flatMap(x=>x.issues)
 ])];
 return Object.freeze({
  schema:'JENIOS_ROBOT_R17_SUMMARY_V1',
  modeReviews:Object.freeze(reviews),
  intentSensitivity:Object.freeze(sensitivity),
  issues:Object.freeze(issues),
  primaryRecommendation:issues.includes('HARMS_ALREADY_ALIGNED_OPERATOR_IN_LAB')?
   'ADD_OPERATOR_ALIGNMENT_GUARD_BEFORE_ASSIST_OR_REVERSE':
   issues.length?'REFINE_IDENTIFIED_LAB_FAILURES':'KEEP_CURRENT_LAB_RULES',
  actualBrokerPnl:null,actualLossesAvoided:null,tradeAccuracy:null,
  adaptiveProfitabilityProven:false,releaseGate:'NO_GO',
  ordersSent:0,paperOrdersSent:0
 });
}
