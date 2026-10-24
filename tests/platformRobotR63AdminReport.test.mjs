import test from 'node:test';
import assert from 'node:assert/strict';
import {studyR63Observations} from '../lib/platform/research/robot-r63-observation-study.mjs';
import {
  createR63EvolutionState,registerR63Evaluation,runR63EvolutionCycle,rollbackR63Evolution,
} from '../lib/platform/research/robot-r63-continuous-evolution.mjs';
import {buildR63AdminReport,scheduleR63AdminReport} from '../lib/platform/research/robot-r63-admin-report.mjs';

const BASE=Date.UTC(2026,9,23,12),SCOPE='fixture:00000001';
const PERIOD={startMs:Date.UTC(2026,9,23,3),endMs:Date.UTC(2026,9,24,3)};
const GENERATED=Date.UTC(2026,9,24,12);
const clone=value=>JSON.parse(JSON.stringify(value));
const event=(index,changes={})=>({
  evidenceKind:'SYNTHETIC_FIXTURE',scopeId:SCOPE,eventId:`evt:${index.toString(16).padStart(8,'0')}`,
  policyVersion:'research:r63-v1',robot:'ultrafast',kind:'incident',decision:'ALLOW',
  issue:'STALE_CONTEXT',marketAgeMs:600,occurredAtMs:BASE+index*1000,observedAtMs:BASE+index*1000+1,
  ...changes,
});
const study=(events=[event(1),event(2),event(3)])=>studyR63Observations(events,{
  scopeId:SCOPE,nowMs:BASE+10000,windowStartMs:BASE,
});
function registered({regression=false}={}){
  const s=study(),initial=createR63EvolutionState({scopeId:SCOPE,nowMs:BASE});
  const definitions=[[100,true],[200,true],[600,regression],[650,false],[900,false],[1000,false]]
    .map(([age,expectedAllow],index)=>({caseId:`case:${(index+1).toString(16).padStart(8,'0')}`,
      snapshotAgesMs:[age,age],expectedAllow}));
  const plan={planId:'plan:00000001',scopeId:SCOPE,evidenceKind:'SYNTHETIC_FIXTURE',
    startsAtMs:BASE+20000,endsAtMs:BASE+40000,caseDefinitions:definitions};
  const state=registerR63Evaluation({state:initial,study:s,plan,nowMs:BASE+15000});
  const cases=definitions.map((definition,index)=>({...definition,scopeId:SCOPE,
    evidenceKind:'SYNTHETIC_FIXTURE',occurredAtMs:plan.startsAtMs+index*1000}));
  return {study:s,state,cases};
}
function evaluated(options){
  const data=registered(options);
  return {study:data.study,evolution:runR63EvolutionCycle({state:data.state,
    validationCases:data.cases,nowMs:BASE+40000}).state};
}
const report=(data=evaluated())=>buildR63AdminReport({...data,period:PERIOD,generatedAtMs:GENERATED});

test('R63 daily report waits for 09:00 in Sao Paulo and then selects the previous closed day',()=>{
  const before=scheduleR63AdminReport({nowMs:Date.UTC(2026,9,24,11,59,59)});
  assert.equal(before.due,false);assert.equal(before.reason,'BEFORE_DAILY_WINDOW');
  const due=scheduleR63AdminReport({nowMs:Date.UTC(2026,9,24,12)});
  assert.equal(due.due,true);assert.equal(due.periodKey,'r63:daily:2026-10-23');
  assert.deepEqual(due.period,PERIOD);assert.equal(due.timeZone,'America/Sao_Paulo');
  assert.equal(due.scheduledAtMs,GENERATED);assert.equal(due.delivery,'NOT_DISPATCHED');
  assert.equal(due.schedulerStarted,false);assert.equal(due.backfillEnabled,false);
});

test('R63 daily period keys suppress repeat emission and advance the next day',()=>{
  const current=scheduleR63AdminReport({nowMs:GENERATED,lastPeriodKey:'r63:daily:2026-10-23'});
  assert.equal(current.due,false);assert.equal(current.reason,'PERIOD_ALREADY_STORED');
  assert.equal(current.nextScheduledAtMs,Date.UTC(2026,9,25,12));
  const next=scheduleR63AdminReport({nowMs:Date.UTC(2026,9,25,12),lastPeriodKey:current.periodKey});
  assert.equal(next.due,true);assert.equal(next.periodKey,'r63:daily:2026-10-24');
});

test('R63 daily calendar handles year and leap-month boundaries',()=>{
  const year=scheduleR63AdminReport({nowMs:Date.UTC(2026,0,1,12)});
  assert.equal(year.periodKey,'r63:daily:2025-12-31');
  assert.equal(year.period.startMs,Date.UTC(2025,11,31,3));
  const leap=scheduleR63AdminReport({nowMs:Date.UTC(2028,2,1,12)});
  assert.equal(leap.periodKey,'r63:daily:2028-02-29');
});

test('R63 schedule rejects invalid clocks, malformed keys and future completion claims',()=>{
  for(const nowMs of [undefined,NaN,Infinity,-1,'2026-10-24'])
    assert.throws(()=>scheduleR63AdminReport({nowMs}));
  assert.throws(()=>scheduleR63AdminReport({nowMs:GENERATED,lastPeriodKey:'customer-email@example.invalid'}));
  assert.throws(()=>scheduleR63AdminReport({nowMs:GENERATED,lastPeriodKey:'r63:daily:2026-10-24'}),
    {code:'R63_REPORT_FUTURE_PERIOD_KEY'});
});

test('R63 delayed scheduler emits only the current closed period without fabricating backfill',()=>{
  const schedule=scheduleR63AdminReport({nowMs:GENERATED,lastPeriodKey:'r63:daily:2026-10-01'});
  assert.equal(schedule.due,true);assert.equal(schedule.periodKey,'r63:daily:2026-10-23');
  assert.equal(schedule.backfillEnabled,false);
});

test('R63 report reflects an actual replay-validated application and its independent comparison',()=>{
  const r=report();
  assert.equal(r.activeVersion.versionId,'research:r63-v2');
  assert.equal(r.activeVersion.maxAgeMs,500);
  assert.deepEqual(r.improvements.period,{registered:1,automaticallyApplied:1,rejected:0,rolledBack:0});
  assert.equal(r.improvements.evaluations[0].baseline.falseAllows,2);
  assert.equal(r.improvements.evaluations[0].candidate.falseAllows,0);
  assert.equal(r.maturity.stage,'SYNTHETIC_IMPROVEMENT_APPLIED');
  assert.equal(r.maturity.completionCeilingKnown,false);
  assert.equal(r.maturity.commercialPerformanceCertified,false);
});

test('R63 report describes rejection without labeling it an applied improvement',()=>{
  const r=report(evaluated({regression:true}));
  assert.equal(r.activeVersion.versionId,'research:r63-v1');
  assert.equal(r.improvements.period.rejected,1);assert.equal(r.improvements.period.automaticallyApplied,0);
  assert.equal(r.improvements.evaluations[0].reason,'CANDIDATE_FALSE_BLOCK_REGRESSION');
  assert.equal(r.maturity.stage,'SYNTHETIC_OBSERVATION_RECORDED');
});

test('R63 report exposes restored baseline and retained rollback history',()=>{
  const data=evaluated();
  data.evolution=rollbackR63Evolution({state:data.evolution,reason:'REGRESSION_DETECTED',nowMs:BASE+50000});
  const r=report(data);
  assert.equal(r.activeVersion.versionId,'research:r63-v1');
  assert.equal(r.improvements.period.rolledBack,1);
  assert.equal(r.improvements.cumulative.automaticallyApplied,1);
  assert.equal(r.maturity.stage,'SYNTHETIC_PREVIOUS_VERSION_RESTORED');
});

test('R63 report includes all robots while explicitly distinguishing missing observations',()=>{
  const r=report();
  assert.deepEqual(r.robots.map(row=>row.robot),['manual','hybrid','reverse','ultrafast']);
  assert.equal(r.robots.find(row=>row.robot==='ultrafast').observations,3);
  assert.equal(r.robots.find(row=>row.robot==='manual').status,'NO_EVIDENCE_IN_PERIOD');
  assert.ok(r.robots.every(row=>row.productionIntegrationVerified===false&&row.realPerformanceMeasured===false));
});

test('R63 empty study has an honest waiting stage instead of a perfection score',()=>{
  const r=report({study:study([]),evolution:createR63EvolutionState({scopeId:SCOPE,nowMs:BASE})});
  assert.equal(r.maturity.stage,'AWAITING_SYNTHETIC_EVIDENCE');
  assert.equal(r.observations.eventCount,0);
  assert.equal(r.maturity.completionCeilingKnown,false);
  assert.equal(/percent|perfection|100%/i.test(JSON.stringify(r)),false);
});

test('R63 admin-only technical reporting does not suppress operational transparency',()=>{
  const r=report();
  assert.equal(r.adminOnly,true);assert.equal(r.customerTechnicalNotifications,false);
  assert.equal(r.operationalDataDisclosureRequired,true);
  assert.equal(r.delivery,'NOT_DISPATCHED');assert.equal(r.scheduledDeliveryActive,false);
  assert.equal(r.scope,'SYNTHETIC_ONLY');
  for(const key of ['actualBrokerPnl','actualLossesAvoided','realTradeAccuracy'])assert.equal(r[key],null);
  assert.equal(r.realOrdersSent,0);assert.equal(r.externalPaperOrdersSent,0);
});

test('R63 report refuses forged counters and states rather than repeating their claims',()=>{
  const data=evaluated();
  const forgedStudy=clone(data.study);forgedStudy.metrics.eventCount=999;
  assert.throws(()=>report({...data,study:forgedStudy}));
  const forgedState=clone(data.evolution);forgedState.activeVersion.maxAgeMs=250;
  assert.throws(()=>report({...data,evolution:forgedState}));
});

test('R63 report refuses a different scope, future evidence and observations outside its window',()=>{
  const data=evaluated();
  assert.throws(()=>report({...data,evolution:createR63EvolutionState({scopeId:'fixture:00000002',nowMs:BASE})}),
    {code:'R63_REPORT_SCOPE_MISMATCH'});
  assert.throws(()=>buildR63AdminReport({...data,period:{startMs:BASE-1000,endMs:BASE+1000},generatedAtMs:BASE+1000}),
    {code:'R63_REPORT_FUTURE_EVIDENCE'});
  assert.throws(()=>buildR63AdminReport({...data,period:{startMs:BASE+2000,endMs:PERIOD.endMs},generatedAtMs:GENERATED}),
    {code:'R63_REPORT_EVENT_OUTSIDE_PERIOD'});
});

test('R63 report requires a closed valid period and yields immutable reproducible output',()=>{
  const data=evaluated();
  for(const period of [{startMs:0,endMs:0},{startMs:PERIOD.startMs,endMs:GENERATED+1},
    {...PERIOD,externalDelivery:true}])
    assert.throws(()=>buildR63AdminReport({...data,period,generatedAtMs:GENERATED}));
  const first=report(data),second=report(data);
  assert.deepEqual(first,second);assert.deepEqual(JSON.parse(JSON.stringify(first)),first);
  assert.throws(()=>{first.improvements.period.automaticallyApplied=9;},TypeError);
});
