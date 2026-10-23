/**
 * JENIOS ROBOT R3 — descriptive daily-block audit of B287/B288 offline fixtures.
 * No signal generation, strategy fitting, broker, independent market witness,
 * private engine, financial action or operational release in this module.
 */
import {createHash} from 'node:crypto';
import {evaluatePairedFrozenSignals,B288_FIXED_PROTOCOL} from './b288-paired-filter-audit.mjs';
import {B280_RESEARCH_ACCEPTANCE_GATES} from './b280-statistical-gate.mjs';

const fail=code=>{throw Object.assign(new Error(code),{code});};
const H=3600000, DAY=86400000;
const MODES=Object.freeze(['manual','hybrid','reverse']);
const DIFFERENCES=Object.freeze([
 Object.freeze({label:'hybrid_minus_manual',candidate:'hybrid',reference:'manual'}),
 Object.freeze({label:'reverse_minus_manual',candidate:'reverse',reference:'manual'}),
 Object.freeze({label:'reverse_minus_hybrid',candidate:'reverse',reference:'hybrid'})
]);
export const ROBOT_R3_FROZEN_AUDIT=Object.freeze({
 schema:'JENIOS_ROBOT_R3_FIXED_BLOCK_RESEARCH_V1',
 fixedCostBps:30,fixedStopSlipBps:30,riskStopPct:0.01,
 dayBlockBootstrapReplicates:1024,dayBlockBootstrapSeed:0x726f626f,
 familyWiseErrorRate:0.05,pairwiseComparisons:DIFFERENCES,
 calendarDaysForDescriptiveCoverage:B280_RESEARCH_ACCEPTANCE_GATES.minimumCalendarDays,
 uniqueHoursForDescriptiveCoverage:B280_RESEARCH_ACCEPTANCE_GATES.minimumUniqueTargetHours,
 eventsPerAssetHypothesisModeRequired:B280_RESEARCH_ACCEPTANCE_GATES.minimumOutcomesPerAssetHypothesisMode,
 independentSourceRequired:true,independentPrecommitWitnessRequired:true,
 shortFundingModelRequired:true,brokerFillProofRequired:true,
 engineResultsNotDirectlyObserved:true,
 bootstrapSignificanceNotAnAuthorization:true
});
const round=x=>Number(x.toFixed(6));
const mean=xs=>xs.reduce((s,v)=>s+v,0)/xs.length;
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const percentile=(sorted,q)=>{
 const idx=(sorted.length-1)*q,lo=Math.floor(idx),hi=Math.ceil(idx);
 return sorted[lo]+(sorted[hi]-sorted[lo])*(idx-lo);
};
// Fixed, public, sample-independent bootstrap seed; no optimization against outcomes.
function generator(seed){
 let state=seed>>>0;
 return ()=>{state=(state+0x6D2B79F5)>>>0;let t=state;
  t=Math.imul(t^(t>>>15),t|1);
  t^=t+Math.imul(t^(t>>>7),t|61);
  return ((t^(t>>>14))>>>0)/4294967296;
 };
}
function hypotheticalNetR(s,o){
 if(s.direction==='ABSTAIN')return 0;
 const side=s.direction==='UP'?1:-1;
 const entry=o.open,stop=entry*(1-side*ROBOT_R3_FROZEN_AUDIT.riskStopPct);
 const stopTouched=side===1?o.low<=stop:o.high>=stop;
 const exit=stopTouched?
  stop-side*entry*ROBOT_R3_FROZEN_AUDIT.fixedStopSlipBps/10000:o.close;
 return round(side*(exit-entry)/(entry*ROBOT_R3_FROZEN_AUDIT.riskStopPct)-
  ROBOT_R3_FROZEN_AUDIT.fixedCostBps/10000/
  ROBOT_R3_FROZEN_AUDIT.riskStopPct);
}
function descriptiveBootstraps(days){
 const random=generator(ROBOT_R3_FROZEN_AUDIT.dayBlockBootstrapSeed);
 const reps=ROBOT_R3_FROZEN_AUDIT.dayBlockBootstrapReplicates;
 const family=DIFFERENCES.length, alpha=ROBOT_R3_FROZEN_AUDIT.familyWiseErrorRate/family;
 const resamples=Array.from({length:reps},()=>Array.from(
  {length:days.length},()=>Math.floor(random()*days.length)));
 return DIFFERENCES.map(({label,candidate,reference})=>{
  const values=days.map(d=>d.meanByMode[candidate]-d.meanByMode[reference]);
  const m=mean(values),scores=resamples.map(indices=>
   mean(indices.map(i=>values[i]))).sort((a,b)=>a-b);
  const lower=percentile(scores,alpha/2),upper=percentile(scores,1-alpha/2);
  const leaveOneOut=values.length>1?values.map((_,i)=>
   mean(values.filter((v,j)=>j!==i))):[];
  const sign=x=>x>1e-12?1:x< -1e-12?-1:0;
  return Object.freeze({label,reference,candidate,
   meanEqualUtcDayDeltaR:round(m),
   bonferroniDescriptiveLowerR:round(lower),
   bonferroniDescriptiveUpperR:round(upper),
   adjustedIntervalCoveragePct:round(100*(1-alpha)),
   daysWithPositiveDelta:values.filter(v=>v>0).length,
   daysWithNegativeDelta:values.filter(v=>v<0).length,
   worstDayDeltaR:round(Math.min(...values)),
   bestDayDeltaR:round(Math.max(...values)),
   leaveOneDayOutSignInstability:leaveOneOut.some(v=>sign(v)!==sign(m)),
   pValue:null,bootstrapBlockType:'UTC_CALENDAR_DAY_UNSIGNED',
   boundsDoNotEstablishIndependentDays:true,
   adjustedIntervalNotBrokerProof:true,
   externalPerformanceVerified:false
  });
 });
}
/** Uses the ORIGINAL strict B288 batch/outcome verifier before descriptive scoring.
 * The result does not acquire source authenticity even if it passes coverage.
 */
export function reviewR3ProspectiveBlocks({batch,observations,observedAtMs}={}){
 if(!Number.isSafeInteger(observedAtMs)||observedAtMs<=0)
  fail('ROBOT_R3_EXPLICIT_OBSERVATION_CLOCK_REQUIRED');
 const verified=evaluatePairedFrozenSignals({batch,observations,observedAtMs});
 if(verified.noAutomatedParameterSelection!==true||verified.ordersSent!==0||
  verified.paperOrdersSent!==0||verified.proprietarySignalOriginVerified!==false)
  fail('ROBOT_R3_B288_ISOLATION_INVARIANT');
 const byId=new Map(observations.map(o=>[o.id,o]));
 const groups=new Map();
 for(const signal of batch.signals){
  const o=byId.get(signal.id),key=signal.asset+'|'+signal.targetCloseMs;
  let row=groups.get(key);
  if(!row){row={asset:signal.asset,closeMs:signal.targetCloseMs,
   modes:{},active:{}};groups.set(key,row);}
  row.modes[signal.mode]=hypotheticalNetR(signal,o);
  row.active[signal.mode]=signal.direction!=='ABSTAIN';
 }
 if(groups.size!==verified.studiedCohorts)
  fail('ROBOT_R3_GROUP_COUNT_MISMATCH');
 const cohorts=[...groups.values()].sort((a,b)=>
  a.closeMs-b.closeMs||a.asset.localeCompare(b.asset));
 const hourMap=new Map();
 for(const c of cohorts){
  let h=hourMap.get(c.closeMs);
  if(!h){h={closeMs:c.closeMs,assets:0,total:{manual:0,hybrid:0,reverse:0}};
   hourMap.set(c.closeMs,h);}
  h.assets++;
  for(const mode of MODES)h.total[mode]+=c.modes[mode];
 }
 const hours=[...hourMap.values()].sort((a,b)=>a.closeMs-b.closeMs);
 const daysById=new Map();
 for(const h of hours){
  // Candle ending exactly at UTC midnight belongs to the preceding UTC day.
  const utcDay=Math.floor((h.closeMs-1)/DAY);
  let d=daysById.get(utcDay);
  if(!d){d={utcDay,hours:0,total:{manual:0,hybrid:0,reverse:0}};
   daysById.set(utcDay,d);}
  d.hours++;
  for(const mode of MODES)d.total[mode]+=h.total[mode]/h.assets;
 }
 const days=[...daysById.values()].sort((a,b)=>a.utcDay-b.utcDay)
  .map(d=>Object.freeze({utcDay:d.utcDay,uniqueHours:d.hours,
   meanByMode:Object.freeze(Object.fromEntries(MODES.map(m=>
    [m,d.total[m]/d.hours])))}));
 const worst=Object.fromEntries(MODES.map(mode=>{
  const original=verified.scenarios.find(x=>x.mode===mode&&
   x.costBps===ROBOT_R3_FROZEN_AUDIT.fixedCostBps&&
   x.slipBps===ROBOT_R3_FROZEN_AUDIT.fixedStopSlipBps);
  if(!original)fail('ROBOT_R3_MISSING_FIXED_30_30_SCENARIO');
  const active=cohorts.filter(c=>c.active[mode]).length,
   sum=cohorts.reduce((s,c)=>s+c.modes[mode],0);
  if(original.trades!==active||original.abstained!==cohorts.length-active||
   (active>0&&Math.abs(sum-original.totalNetR)>0.0002)||
   (active===0&&original.totalNetR!==null))
   fail('ROBOT_R3_FIXED_SCENARIO_MISMATCH');
  return [mode,Object.freeze({
   hypotheticalActiveSignals:active,hypotheticalAbstentions:cohorts.length-active,
   totalHypotheticalTradeNetR:active?round(sum):null,
   equalAssetHourExposureNormalizedMeanR:round(sum/cohorts.length),
   percentActive:round(100*active/cohorts.length),
   actualTradesObserved:0,verifiedBrokerFills:0,portfolioPnl:null
  })];
 }));
 const proxies={
  minimumUtcDaysMet:days.length>=ROBOT_R3_FROZEN_AUDIT.calendarDaysForDescriptiveCoverage,
  minimumUniqueHoursMet:hours.length>=ROBOT_R3_FROZEN_AUDIT.uniqueHoursForDescriptiveCoverage
 };
 const bucketCounts=Object.fromEntries(MODES.map(mode=>[
  mode,cohorts.filter(c=>c.active[mode]).length]));
 return Object.freeze({
  schema:'JENIOS_ROBOT_R3_DESCRIPTIVE_DAILY_BLOCK_AUDIT_V1',
  fixedProtocolSha256:digest(ROBOT_R3_FROZEN_AUDIT),
  originalFrozenBatchSha256:verified.frozenBatchSha256,
  researchCohorts:cohorts.length,
  uniqueUtcHourlySlots:hours.length,uniqueUtcCalendarDays:days.length,
  distinctAssets:new Set(cohorts.map(c=>c.asset)).size,
  utcDayBlocksUsed:true,sameHourAcrossAssetsCountedOnce:true,
  abstentionsCountedAsZeroExposure:true,
  observedAtMs,
  clockSource:'CALLER_SUPPLIED_NOT_WITNESSED',
  descriptiveCoverage:Object.freeze({...proxies,
   perModeActiveCount:Object.freeze(bucketCounts),
   descriptiveCalendarAndHourCoverageReached:Object.values(proxies).every(Boolean),
   b280PerAssetHypothesisModeCoverageCertified:false,
   independentlyWitnessedProspectiveCoverage:false
  }),
  costSensitivity:Object.freeze(worst),
  comparisons:Object.freeze(days.length>=2?descriptiveBootstraps(days):[]),
  independentDailyReturnsProven:false,
  serialCorrelationBeyondDayAdjusted:false,
  independentPriceProviderVerified:false,
  independentPredictionTimestampVerified:false,
  originalPrivateCoreSignalsVerified:false,
  intrabarFillOrderVerified:false,
  shortBorrowAndFundingModeled:false,
  brokerSlippageAndFeesVerified:false,
  simulatedCandleStopsMayNotFill:true,
  bootstrapDescriptiveOnly:true,
  multiplicityComparisonCount:DIFFERENCES.length,
  statisticalAdvantageCertified:false,
  actualLossesAvoided:null,realizedBrokerPnl:null,
  commercialPerformanceClaimAllowed:false,
  ordersSent:0,paperOrdersSent:0,paidAiInvocations:0,
  status:'NO_GO_PROSPECTIVE_EXTERNAL_EVIDENCE_REQUIRED',
  note:'UTC day block bootstrap over caller-provided UNSIGNED simulated returns; not independent price, broker fills or certifiable P&L.'
 });
}
