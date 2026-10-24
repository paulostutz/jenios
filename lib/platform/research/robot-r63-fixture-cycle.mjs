/** Explicit synthetic QA fixtures. Never a fallback for absent operational data. */
import {studyR63Observations,R63_DEFAULT_FIXTURE_SCOPE} from './robot-r63-observation-study.mjs';
import {createR63EvolutionState,registerR63Evaluation,runR63EvolutionCycle,
  evaluateR63ActiveFreshness} from './robot-r63-continuous-evolution.mjs';
import {buildR63AdminReport,scheduleR63AdminReport} from './robot-r63-admin-report.mjs';

export const R63_FIXTURE_REPORT_AT=Date.UTC(2026,9,24,12);
export const R63_FIXTURE_SCENARIOS=Object.freeze(['improve','regression','insufficient','control_violation']);
const fail=code=>{throw Object.assign(new Error(code),{code});};

export function createR63FixtureInput({scenario='improve',reportAtMs=R63_FIXTURE_REPORT_AT,policyVersion='research:r63-v1'}={}) {
  if(!R63_FIXTURE_SCENARIOS.includes(scenario))fail('R63_UNKNOWN_FIXTURE_SCENARIO');
  if(!['research:r63-v1','research:r63-v2'].includes(policyVersion))fail('R63_INVALID_FIXTURE_VERSION');
  const scheduled=scheduleR63AdminReport({nowMs:reportAtMs});
  if(!scheduled.due)fail('R63_FIXTURE_REPORT_NOT_DUE');
  const scopeId=R63_DEFAULT_FIXTURE_SCOPE,studyAtMs=scheduled.period.startMs+9*3600000;
  const seed=Math.floor(studyAtMs/86400000)*32;
  const id=value=>(seed+value).toString(16).padStart(8,'0');
  const events=['manual','hybrid','reverse','ultrafast'].map((robot,index)=>({
    evidenceKind:'SYNTHETIC_FIXTURE',scopeId,eventId:`evt:${id(index+1)}`,
    policyVersion,robot,kind:'decision',decision:robot==='ultrafast'?'ALLOW':'KEEP',
    issue:'NONE',marketAgeMs:100,occurredAtMs:studyAtMs-10000+index*100,
    observedAtMs:studyAtMs-9950+index*100,
  }));
  const episodes=scenario==='insufficient'?2:3;
  for(let i=0;i<episodes;i++)events.push({
    evidenceKind:'SYNTHETIC_FIXTURE',scopeId,eventId:`evt:${id(i+10)}`,
    policyVersion,robot:'ultrafast',kind:'incident',decision:'BLOCK',
    issue:'STALE_CONTEXT',marketAgeMs:650+i*25,occurredAtMs:studyAtMs-5000+i*1000,
    observedAtMs:studyAtMs-4950+i*1000,
  });
  if(scenario==='control_violation')events.push({
    evidenceKind:'SYNTHETIC_FIXTURE',scopeId,eventId:`evt:${id(20)}`,policyVersion,
    robot:'manual',kind:'incident',decision:'KEEP',issue:'CONTROL_VIOLATION',marketAgeMs:100,
    occurredAtMs:studyAtMs-1000,observedAtMs:studyAtMs-950,
  });
  const caseDefinitions=[100,150,650,700,900,950].map((age,index)=>({
    caseId:`case:${id(index+1)}`,
    snapshotAgesMs:[age,age],expectedAllow:scenario==='regression'?age<750:age<500,
  }));
  const plan={planId:`plan:${id(1)}`,scopeId,evidenceKind:'SYNTHETIC_FIXTURE',
    startsAtMs:studyAtMs+10000,endsAtMs:studyAtMs+60000,caseDefinitions};
  const validationCases=caseDefinitions.map((item,index)=>({...item,scopeId,evidenceKind:'SYNTHETIC_FIXTURE',
    occurredAtMs:plan.startsAtMs+1000+index*1000}));
  return {schema:'JENIOS_R63_SYNTHETIC_CYCLE_INPUT_V1',scenario,scopeId,events,studyAtMs,
    createdAtMs:studyAtMs-20000,registeredAtMs:studyAtMs+1,plan,validationCases,
    evaluatedAtMs:plan.endsAtMs+1,reportAtMs,period:scheduled.period};
}

export function runR63FixtureCycle(input=createR63FixtureInput()) {
  if(input?.schema!=='JENIOS_R63_SYNTHETIC_CYCLE_INPUT_V1')fail('R63_INVALID_FIXTURE_INPUT');
  const study=studyR63Observations(input.events,{scopeId:input.scopeId,nowMs:input.studyAtMs});
  const initialState=createR63EvolutionState({scopeId:input.scopeId,nowMs:input.createdAtMs});
  let evolution=initialState,evaluation={status:'NO_CHANGE',reason:'NO_ELIGIBLE_HYPOTHESIS'};
  if(study.proposals.length){
    const registered=registerR63Evaluation({state:initialState,study,plan:input.plan,nowMs:input.registeredAtMs});
    const result=runR63EvolutionCycle({state:registered,validationCases:input.validationCases,nowMs:input.evaluatedAtMs});
    evolution=result.state;evaluation=result.evaluation;
  }
  const report=buildR63AdminReport({study,evolution,period:input.period,generatedAtMs:input.reportAtMs});
  return {schema:'JENIOS_R63_SYNTHETIC_CYCLE_V1',study,evolution,evaluation,report,
    before:evaluateR63ActiveFreshness({state:initialState,snapshotAgesMs:[650,650]}),
    after:evaluateR63ActiveFreshness({state:evolution,snapshotAgesMs:[650,650]}),
    provider:'NOT_CALLED',productionIntegrationVerified:false};
}
