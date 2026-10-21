/** B280 — descriptive readiness audit ONLY, never deployment certification.
 * Without independent signed timestamps, external provider attestation and a
 * real broker fill model, untrusted observations cannot authorize trading.
 */
import {B280_FROZEN_PROTOCOL} from './b280-forward-protocol.mjs';
const fail=code=>{throw Object.assign(new Error(code),{code});};
const H=3600000,DAY=86400000;
export const B280_RESEARCH_ACCEPTANCE_GATES=Object.freeze({
 minimumCalendarDays:30,minimumUniqueTargetHours:300,
 minimumOutcomesPerAssetHypothesisMode:100,
 signedIndependentMarketDataRequired:true,
 externallyWitnessedPredictionTimeRequired:true,
 conservativeRealisticCostsRequired:true,
 negativeOutcomesRetained:true,
 bootstrapOrBlockDependenceAnalysisRequired:true,
 multiplicityAdjustmentRequired:true,
 brokerFillAndFundingValidationRequired:true,
 prospectivePublicationWithoutManualApprovalForbidden:true
});
const cohorts=Object.freeze(B280_FROZEN_PROTOCOL.instrumentIds.flatMap(product=>
 B280_FROZEN_PROTOCOL.hypothesisIds.flatMap(hypothesisId=>
 B280_FROZEN_PROTOCOL.modes.map(mode=>product+'|'+hypothesisId+'|'+mode))));
export function reviewB280ForwardCoverage(evaluations=[]){
 if(!Array.isArray(evaluations)||evaluations.length>10000)fail('B280_INVALID_FUTURE_REVIEW_SET');
 const stamps=new Set(),days=new Set(),events=Object.fromEntries(cohorts.map(k=>[k,0]));
 let latest=null,earliest=null;
 for(const row of evaluations){
  if(!row||row.schema!=='JENIOS_B280_FUTURE_HOUR_OFFLINE_EVALUATION_V1'||
   !Number.isSafeInteger(row.targetCandleStartMs)||row.targetCandleStartMs<=0||
   row.targetCandleStartMs%H!==0||row.targetCandleStartMs<B280_FROZEN_PROTOCOL.earliestRegistrationMs||
   !Number.isSafeInteger(row.observedAtMs)||row.observedAtMs<row.targetCandleStartMs+H+300000||
   !/^[a-f0-9]{64}$/.test(row.sealedSha256??'')||
   row.outcomeProviderSigned!==false||row.independentProviderConfirmed!==false||
   row.readyForOperationalChanges!==false||row.ordersSent!==0||
   !Array.isArray(row.rows)||row.rows.length!==162||row.count!==162)
   fail('B280_UNTRUSTED_FORWARD_COHORT_RECORD');
  const t=row.targetCandleStartMs;
  if(stamps.has(t))fail('B280_DUPLICATE_TARGET_CANDLE');
  stamps.add(t);days.add(Math.floor(t/DAY));
  earliest=Math.min(earliest??t,t);latest=Math.max(latest??t,t);
  const perBucket=new Map();
  for(const x of row.rows){
   const k=x?.product+'|'+x?.hypothesisId+'|'+x?.mode;
   if(!cohorts.includes(k)||![0,10,30].includes(x.costBps)||
    ![0,10,30].includes(x.slipBps)||!(x.netR===null||
     (typeof x.netR==='number'&&Number.isFinite(x.netR)))||
    x.observedOrder!==false||x.hypotheticalFillVerified!==false)
    fail('B280_INVALID_COHORT_SCENARIO');
   const key=k+'|'+x.costBps+'|'+x.slipBps;
   if(perBucket.has(key))fail('B280_DUPLICATE_COHORT_SCENARIO');
   perBucket.set(key,x);
  }
  if(perBucket.size!==162)fail('B280_SCENARIO_COVERAGE_INCOMPLETE');
  for(const k of cohorts){
   const stressed=perBucket.get(k+'|30|30');
   if(stressed?.netR!==null)events[k]++;
  }
 }
 const minCount=Math.min(...Object.values(events));
 const coverageDays=days.size,uniqueHours=stamps.size;
 const descriptiveCoverageReached=coverageDays>=B280_RESEARCH_ACCEPTANCE_GATES.minimumCalendarDays&&
  uniqueHours>=B280_RESEARCH_ACCEPTANCE_GATES.minimumUniqueTargetHours&&
  minCount>=B280_RESEARCH_ACCEPTANCE_GATES.minimumOutcomesPerAssetHypothesisMode;
 return Object.freeze({
  schema:'JENIOS_B280_FORWARD_DESCRIPTIVE_COVERAGE_V1',
  evaluatedHourlyCohorts:uniqueHours,distinctUtcDays:coverageDays,
  earliestTargetMs:earliest,latestTargetMs:latest,
  minPerAssetHypothesisModeCount:minCount,descriptiveCoverageReached,
  historicalHoldoutCountedAsProspective:false,
  externallySignedPredictionWitnessAccepted:false,
  independentlySignedMarketSourceAccepted:false,
  providerAndBrokerReconciliationCertified:false,
  serialCorrelationAdjusted:false,multipleTestsCorrected:false,
  confidenceBoundsIndependentlyAudited:false,
  statisticalAdvantageCertified:false,readyForOperationalRollout:false,
  resultInterpretation:'Somente controle descritivo de cobertura; histórico e resultados sintéticos não demonstram performance futura.',
  remainingBeforeDescriptiveCoverage:Object.freeze({
   utcDays:Math.max(0,B280_RESEARCH_ACCEPTANCE_GATES.minimumCalendarDays-coverageDays),
   uniqueHours:Math.max(0,B280_RESEARCH_ACCEPTANCE_GATES.minimumUniqueTargetHours-uniqueHours),
   eventsPerCohort:Math.max(0,B280_RESEARCH_ACCEPTANCE_GATES.minimumOutcomesPerAssetHypothesisMode-minCount)
  })
 });
}
