/**
 * Host-side synthetic research worker. It persists reports locally and never
 * connects to customers, brokers, a model or a deployment by itself. The owner
 * preapproval is enforced by the deterministic evolution engine. A host may
 * explicitly inject a budgeted analyst; its output cannot widen that policy.
 */
import {createHash} from 'node:crypto';
import {isRobotR63EvolutionEnabled} from './robot-r63-admin-access.mjs';
import {studyR63Observations,R63_DEFAULT_FIXTURE_SCOPE} from './robot-r63-observation-study.mjs';
import {createR63EvolutionState,registerR63Evaluation,runR63EvolutionCycle} from './robot-r63-continuous-evolution.mjs';
import {runR63Analyst} from './robot-r63-generative-analyst.mjs';
import {buildR63AdminReport,scheduleR63AdminReport} from './robot-r63-admin-report.mjs';
import {readR63Journal,appendR63Journal,withR63WorkerLease} from './robot-r63-durable-journal.mjs';
import {createR63FixtureInput} from './robot-r63-fixture-cycle.mjs';

const fail=code=>{throw Object.assign(new Error(code),{code});};
const requireEnabled=env=>{if(!isRobotR63EvolutionEnabled(env))fail('R63_RESEARCH_WORKER_DISABLED');};
const latestFor=(snapshot,scopeId)=>[...snapshot.entries].reverse().find(entry=>entry.study.scopeId===scopeId);
const inputKeys=['schema','scenario','scopeId','events','studyAtMs','createdAtMs','registeredAtMs','plan',
  'validationCases','evaluatedAtMs','reportAtMs','period'];
function canonicalInput(value){
  let nodes=0;
  const visit=(item,depth)=>{
    if(++nodes>100000||depth>20)fail('R63_INVALID_WORKER_INPUT');
    if(item===null||typeof item==='boolean')return JSON.stringify(item);
    if(typeof item==='string'){if(item.length>16000)fail('R63_INVALID_WORKER_INPUT');return JSON.stringify(item);}
    if(typeof item==='number'&&Number.isFinite(item))return JSON.stringify(item);
    if(!item||typeof item!=='object')fail('R63_INVALID_WORKER_INPUT');
    const descriptors=Object.getOwnPropertyDescriptors(item),keys=Reflect.ownKeys(descriptors);
    if(Array.isArray(item)){
      if(item.length>10000||keys.length!==item.length+1)fail('R63_INVALID_WORKER_INPUT');
      const parts=[];
      for(let i=0;i<item.length;i++){
        const property=descriptors[String(i)];
        if(!property||!Object.hasOwn(property,'value')||!property.enumerable)fail('R63_INVALID_WORKER_INPUT');
        parts.push(visit(property.value,depth+1));
      }
      return '['+parts.join(',')+']';
    }
    if(![Object.prototype,null].includes(Object.getPrototypeOf(item))||keys.some(key=>typeof key!=='string'||
      ['__proto__','prototype','constructor'].includes(key)||!Object.hasOwn(descriptors[key],'value')||!descriptors[key].enumerable))
      fail('R63_INVALID_WORKER_INPUT');
    return '{'+keys.sort().map(key=>JSON.stringify(key)+':'+visit(descriptors[key].value,depth+1)).join(',')+'}';
  };
  return visit(value,0);
}
function checkInput(input){
  const text=canonicalInput(input);
  if(!input||typeof input!=='object'||Array.isArray(input)||input.schema!=='JENIOS_R63_SYNTHETIC_CYCLE_INPUT_V1'||
    Object.keys(input).length!==inputKeys.length||Object.keys(input).some(key=>!inputKeys.includes(key)))fail('R63_INVALID_WORKER_INPUT');
  if(text.length>2000000)fail('R63_WORKER_INPUT_LIMIT');
  return {cycleId:'cycle:'+createHash('sha256').update(text).digest('hex').slice(0,16),input:JSON.parse(text)};
}

export async function runR63ResearchWorker({input:rawInput,directory,key,env={},provider,budget,generativeEnabled=false}={}){
  requireEnabled(env);
  const {cycleId,input}=checkInput(rawInput);
  return withR63WorkerLease({directory,operation:async()=>{
  const snapshot=readR63Journal({directory,key});
  const existing=snapshot.entries.find(entry=>entry.cycleId===cycleId);
  if(existing)return {status:'ALREADY_STORED',cycleId,revision:snapshot.revision,record:existing,providerCalls:0};
  const previous=latestFor(snapshot,input.scopeId);
  const study=studyR63Observations(input.events,{scopeId:input.scopeId,nowMs:input.studyAtMs});
  if(snapshot.entries.some(entry=>entry.study.scopeId===input.scopeId&&
    entry.report.period.startMs===input.period?.startMs&&entry.report.period.endMs===input.period?.endMs))
    fail('R63_WORKER_PERIOD_ALREADY_STORED');
  let evolution=previous?.evolution??createR63EvolutionState({scopeId:input.scopeId,nowMs:input.createdAtMs});
  if(previous&&(study.asOfMs<=evolution.updatedAtMs||study.asOfMs<=previous.study.asOfMs))fail('R63_WORKER_CLOCK_REGRESSION');
  if(study.events.some(event=>event.policyVersion!==evolution.activeVersion.versionId))fail('R63_WORKER_POLICY_VERSION_MISMATCH');
  const analyst=await runR63Analyst({study,provider,budget,enabled:generativeEnabled});
  const modelSupports=generativeEnabled!==true||(analyst.status==='ANALYZED'&&
    analyst.analysis.proposals.some(proposal=>proposal.kind==='TIGHTEN_MARKET_FRESHNESS'&&proposal.maxAgeMs===500));
  let evaluation={status:'NO_CHANGE',reason:modelSupports?'NO_NEW_AUTHORIZED_CANDIDATE':'ANALYST_HYPOTHESIS_UNAVAILABLE'};
  if(modelSupports&&study.proposals.length&&evolution.activeVersion.maxAgeMs===750&&!evolution.retiredCandidateMaxAgeMs.includes(500)){
    const registered=registerR63Evaluation({state:evolution,study,plan:input.plan,nowMs:input.registeredAtMs});
    const result=runR63EvolutionCycle({state:registered,validationCases:input.validationCases,nowMs:input.evaluatedAtMs});
    evolution=result.state;evaluation=result.evaluation;
  }
  const report=buildR63AdminReport({study,evolution,period:input.period,generatedAtMs:input.reportAtMs});
  const record={cycleId,study,evolution,report};
  const stored=appendR63Journal({directory,key,record,expectedRevision:snapshot.revision});
  return {status:'STORED_LOCAL_RESEARCH_REPORT',cycleId,revision:stored.revision,record,evaluation,
    analystStatus:analyst.status,providerCalls:analyst.providerCalls,analysis:analyst.analysis,
    source:'SYNTHETIC_FIXTURE',notificationDispatched:false,productionMonitoringStarted:false};
  }});
}

/** Daily driver for an explicitly started local fixture worker, never customers. */
export async function runR63ScheduledFixtureWorker({directory,key,env={},nowMs=Date.now(),scenario='improve'}={}){
  requireEnabled(env);
  const snapshot=readR63Journal({directory,key});
  const scheduled=scheduleR63AdminReport({nowMs});
  if(!scheduled.due)return {status:'NOT_DUE',scheduled,providerCalls:0};
  const previous=latestFor(snapshot,R63_DEFAULT_FIXTURE_SCOPE);
  if(snapshot.entries.some(entry=>entry.study.scopeId===R63_DEFAULT_FIXTURE_SCOPE&&
    entry.report.period.startMs===scheduled.period.startMs&&entry.report.period.endMs===scheduled.period.endMs))
    return {status:'PERIOD_ALREADY_STORED',scheduled,providerCalls:0};
  const input=createR63FixtureInput({scenario,reportAtMs:nowMs,policyVersion:previous?.evolution.activeVersion.versionId??'research:r63-v1'});
  return runR63ResearchWorker({input,directory,key,env});
}
