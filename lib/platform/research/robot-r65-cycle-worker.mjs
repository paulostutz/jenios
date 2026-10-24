/** Closes the QA observation -> registered benchmark -> durable version cycle.
 * Actual broker/customer evidence and a private production engine are absent.
 */
import { createHash } from 'node:crypto';
import { requireR65CycleEnabled } from './robot-r65-cycle-access.mjs';
import { scheduleR64TelemetryPeriod,studyR64AcceptedTelemetry,canonicalR64Json } from './robot-r64-telemetry.mjs';
import { hashR64CycleInput } from './robot-r64-database-store.mjs';
import { createR65EvolutionState,inspectR65EvolutionState,registerR65Evaluation,
  executeR65ValidationCase,runR65EvolutionCycle,rollbackR65Evolution } from './robot-r65-evolution-engine.mjs';

const fail=code=>{throw Object.assign(new Error(code),{code});};
const hash=text=>createHash('sha256').update(text).digest('hex');
export const r65OperationId=(...parts)=>'op:'+hash(JSON.stringify(parts)).slice(0,32);
const scope=value=>{if(!/^scope:[a-f0-9]{16}$/.test(value||''))fail('R65_SCOPE_INVALID');return value;};
const same=(a,b)=>canonicalR64Json(a)===canonicalR64Json(b);
const boundaries={productionMonitoringStarted:false,privateEngineConnected:false,
  realOrdersSent:0,externalPaperOrdersSent:0,actualBrokerPnl:null,actualLossesAvoided:null,realTradeAccuracy:null};
const result=(status,record,extra={})=>({status,scopeId:record?.scopeId??null,
  revision:record?.revision??null,activeVersion:record?.state?.activeVersion??null,...extra,...boundaries});

export function createR65RegisteredBenchmark({scopeId,sourceCycleId,nowMs}) {
  scope(scopeId);
  if(!Number.isSafeInteger(nowMs)||nowMs<0)fail('R65_CLOCK_INVALID');
  const seed=hash(scopeId+':'+sourceCycleId);
  const definitions=[[[50,50],true],[[300,450],true],[[600,650],false],
    [[700,700],false],[[900,1000],false],[[1001,1001],false]];
  return {planId:'plan:'+seed.slice(0,16),scopeId,evidenceKind:'SYNTHETIC_FIXTURE',
    startsAtMs:nowMs+1000,endsAtMs:nowMs+11000,
    caseDefinitions:definitions.map(([snapshotAgesMs,expectedAllow],index)=>({
      caseId:'case:'+hash(seed+':'+index).slice(0,16),snapshotAgesMs,expectedAllow}))};
}

function checkedRecord(record,scopeId) {
  if(!record||record.scopeId!==scopeId||!Number.isSafeInteger(record.revision)||
    typeof record.stateDigest!=='string'||!/^[a-f0-9]{64}$/.test(record.stateDigest))fail('R65_STORED_STATE_INVALID');
  const state=inspectR65EvolutionState(record.state);
  if(state.scopeId!==scopeId||state.revision!==record.revision)fail('R65_STORED_STATE_MISMATCH');
  return {...record,state};
}

async function append(lifecycleStore,current,state,operationId,actorId='system:r65') {
  await lifecycleStore.appendEvolution({scopeId:state.scopeId,operationId,
    expectedRevision:current?.revision??-1,previousDigest:current?.stateDigest??null,state,actorId});
  const saved=checkedRecord(await lifecycleStore.readEvolution({scopeId:state.scopeId}),state.scopeId);
  // A subsequent legitimate command may have won the next generation already.
  // Return success only if our exact journal is a prefix of the durable state.
  if(saved.revision<state.revision||!same(saved.state.journal.slice(0,state.journal.length),state.journal))
    fail('R65_DURABLE_STATE_UNCONFIRMED');
  return saved;
}

export async function ensureR65Evolution({lifecycleStore,scopeId,env={},nowMs=Date.now()}) {
  requireR65CycleEnabled(env);scope(scopeId);
  const existing=await lifecycleStore.readEvolution({scopeId});
  if(existing)return checkedRecord(existing,scopeId);
  const state=createR65EvolutionState({scopeId,nowMs});
  try{return await append(lifecycleStore,null,state,r65OperationId(scopeId,'INITIALIZE'));}
  catch(error){
    // Initialization is safe to resume after an uncertain write or competing initializer.
    const recovered=await lifecycleStore.readEvolution({scopeId});
    if(recovered)return checkedRecord(recovered,scopeId);
    throw error;
  }
}

export async function runR65EvolutionTick({observationStore,lifecycleStore,scopeId,env={},
  now=Date.now,completeObservationCycle}={}) {
  requireR65CycleEnabled(env);scope(scopeId);
  let nowMs=now();
  let current=await ensureR65Evolution({lifecycleStore,scopeId,env,nowMs});
  const pending=current.state.pendingEvaluation;
  if(pending){
    const {plan}=pending;
    if(nowMs<plan.startsAtMs)return result('WAITING_VALIDATION_WINDOW',current,{planId:plan.planId,nextAtMs:plan.startsAtMs});
    if(nowMs<plan.endsAtMs){
      let recorded=0;
      for(const definition of plan.caseDefinitions){
        nowMs=now();if(nowMs>=plan.endsAtMs)break;
        const measured=executeR65ValidationCase({state:current.state,caseId:definition.caseId,nowMs});
        await lifecycleStore.recordValidationCase({scopeId,planId:plan.planId,caseId:definition.caseId,
          baselineAllow:measured.baselineAllow,candidateAllow:measured.candidateAllow});
        recorded++;
      }
      return result('VALIDATION_CAPTURED',current,{planId:plan.planId,recorded,nextAtMs:plan.endsAtMs});
    }
    // Missing cases stay missing. This path never creates past observations.
    const validationCases=await lifecycleStore.readValidationCases({scopeId,planId:plan.planId});
    const evaluated=runR65EvolutionCycle({state:current.state,validationCases,nowMs});
    current=await append(lifecycleStore,current,evaluated.state,r65OperationId(scopeId,'EVALUATE',plan.planId));
    return result(evaluated.evaluation.status,current,{evaluation:evaluated.evaluation});
  }
  const scheduled=scheduleR64TelemetryPeriod({nowMs});
  if(!scheduled.due)return result('NOT_DUE',current,{nextAtMs:scheduled.scheduledAtMs});
  if(completeObservationCycle)await completeObservationCycle();
  if(current.state.activeVersion.maxAgeMs!==750||current.state.retiredCandidateMaxAgeMs.includes(500))
    return result('NO_NEW_AUTHORIZED_CANDIDATE',current);
  const cycle=await observationStore.readCycle({scopeId,periodKey:scheduled.periodKey});
  if(!cycle||cycle.status!=='COMPLETED')return result(cycle?.status==='NEEDS_RECONCILIATION'?'OBSERVATION_RECONCILIATION_REQUIRED':'WAITING_OBSERVATIONS',current);
  if(cycle.scopeId!==scopeId||hashR64CycleInput(cycle.input)!==cycle.inputDigest)fail('R65_SOURCE_CYCLE_INVALID');
  const frozenStudy=cycle.input.study;
  const receipts=(await observationStore.readReceipts({scopeId,period:frozenStudy.period}))
    .filter(receipt=>receipt.admittedAtMs<=frozenStudy.generatedAtMs);
  const study=studyR64AcceptedTelemetry(receipts,{scopeId,period:frozenStudy.period,generatedAtMs:frozenStudy.generatedAtMs});
  if(!same(study,frozenStudy))fail('R65_FROZEN_OBSERVATION_REPLAY_MISMATCH');
  if(current.state.journal.some(command=>command.sourceCycleId===cycle.cycleId))return result('SOURCE_CYCLE_ALREADY_USED',current);
  if(study.metrics.byIssue.CONTROL_VIOLATION>0||!study.findings.some(f=>f.robot==='ultrafast'&&f.code==='STALE_CONTEXT'&&f.eventCount>=3))
    return result('NO_ELIGIBLE_OBSERVATION',current);
  const hint=await lifecycleStore.readCycleHypothesis({scopeId,cycleId:cycle.cycleId});
  const analystHypothesis=hint?.proposals?.find(p=>p.kind==='TIGHTEN_MARKET_FRESHNESS'&&p.maxAgeMs===500)??null;
  nowMs=now();
  const plan=createR65RegisteredBenchmark({scopeId,sourceCycleId:cycle.cycleId,nowMs});
  const registered=registerR65Evaluation({state:current.state,receipts,period:frozenStudy.period,
    studyAtMs:frozenStudy.generatedAtMs,sourceCycleId:cycle.cycleId,plan,nowMs,analystHypothesis});
  current=await append(lifecycleStore,current,registered,r65OperationId(scopeId,'REGISTER',cycle.cycleId));
  return result('EVALUATION_REGISTERED',current,{planId:plan.planId,nextAtMs:plan.startsAtMs,
    observationEvidenceKind:'SIGNED_QA_REPLAY',validationEvidenceKind:'SYNTHETIC_FIXTURE',
    hypothesisSource:analystHypothesis?'AUDITED_ANALYST_HYPOTHESIS':'BOUNDED_DETERMINISTIC_POLICY'});
}

export async function rollbackR65Durable({lifecycleStore,scopeId,operationId,expectedRevision,
  previousDigest,reason,actorId,env={},nowMs=Date.now()}) {
  requireR65CycleEnabled(env);scope(scopeId);
  if(!/^user:[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(actorId||''))fail('R65_ADMIN_ACTOR_REQUIRED');
  const current=checkedRecord(await lifecycleStore.readEvolution({scopeId}),scopeId);
  let state;
  if(current.revision===expectedRevision&&current.stateDigest===previousDigest)
    state=rollbackR65Evolution({state:current.state,reason,nowMs});
  else if(current.revision===expectedRevision+1&&current.state.journal.at(-1)?.action==='ROLLBACK'&&
    current.state.journal.at(-1)?.reason===reason)state=current.state;
  else fail('R65_EVOLUTION_CONFLICT');
  // The DB operation receipt distinguishes a genuine retry from another rollback.
  const saved=await append(lifecycleStore,{revision:expectedRevision,stateDigest:previousDigest},state,operationId,actorId);
  return result('ROLLED_BACK',saved);
}
