/**
 * R63 — immutable admin reports and daily report scheduling contract.
 * This pure module does not start a worker or deliver a notification. A host
 * must persist the period key atomically after storing the report.
 */
import {inspectR63AnalystStudy} from './robot-r63-generative-analyst.mjs';
import {inspectR63EvolutionState} from './robot-r63-continuous-evolution.mjs';

const fail=code=>{throw Object.assign(new Error(code),{name:'ValidationError',code});};
const integer=x=>Number.isSafeInteger(x)&&x>=0&&x<=Date.UTC(2100,0,1);
const DAY=86400000;
const TIME_ZONE='America/Sao_Paulo';
const freeze=value=>{
  if(value&&typeof value==='object'&&!Object.isFrozen(value)){
    for(const child of Object.values(value))freeze(child);
    Object.freeze(value);
  }
  return value;
};
function exact(value,keys,code){
  if(!value||typeof value!=='object'||Array.isArray(value)||
      ![Object.prototype,null].includes(Object.getPrototypeOf(value)))fail(code);
  const descriptors=Object.getOwnPropertyDescriptors(value),actual=Reflect.ownKeys(descriptors);
  if(actual.length!==keys.length||actual.some(key=>typeof key!=='string'||!keys.includes(key)||
      !Object.hasOwn(descriptors[key],'value')||!descriptors[key].enumerable))fail(code);
}
const partsAt=ms=>Object.fromEntries(new Intl.DateTimeFormat('en-CA',{
  timeZone:TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',
  second:'2-digit',hourCycle:'h23',
}).formatToParts(ms).filter(p=>p.type!=='literal').map(p=>[p.type,Number(p.value)]));
const calendarMs=p=>Date.UTC(p.year,p.month-1,p.day,p.hour??0,p.minute??0,p.second??0);
const calendarShift=(parts,days)=>{
  const date=new Date(Date.UTC(parts.year,parts.month-1,parts.day)+days*DAY);
  return {year:date.getUTCFullYear(),month:date.getUTCMonth()+1,day:date.getUTCDate()};
};
function zonedInstant(parts){
  const target=calendarMs(parts);
  let actual=target;
  for(let i=0;i<4;i++){
    const difference=target-calendarMs(partsAt(actual));
    if(difference===0)return actual;
    actual+=difference;
  }
  fail('R63_REPORT_UNREPRESENTABLE_LOCAL_TIME');
}
const dateKey=p=>`${p.year.toString().padStart(4,'0')}-${p.month.toString().padStart(2,'0')}-${p.day.toString().padStart(2,'0')}`;

/** No catch-up backfill: the current run can emit only the latest closed day. */
export function scheduleR63AdminReport({nowMs,lastPeriodKey=null}={}){
  if(!integer(nowMs)||nowMs<Date.UTC(2020,0,2)||
      (lastPeriodKey!==null&&(typeof lastPeriodKey!=='string'||!/^r63:daily:\d{4}-\d{2}-\d{2}$/.test(lastPeriodKey))))
    fail('R63_INVALID_REPORT_SCHEDULE');
  const today=partsAt(nowMs),previous=calendarShift(today,-1);
  const periodKey='r63:daily:'+dateKey(previous);
  if(lastPeriodKey!==null&&lastPeriodKey>periodKey)fail('R63_REPORT_FUTURE_PERIOD_KEY');
  const scheduledAtMs=zonedInstant({...today,hour:9,minute:0,second:0});
  const period={startMs:zonedInstant({...previous,hour:0}),endMs:zonedInstant({...today,hour:0,minute:0,second:0})};
  const before=nowMs<scheduledAtMs,already=lastPeriodKey===periodKey;
  return freeze({
    schema:'JENIOS_R63_REPORT_SCHEDULE_V1',timeZone:TIME_ZONE,cadence:'DAILY_09',
    periodKey,period,scheduledAtMs,due:!before&&!already,
    reason:before?'BEFORE_DAILY_WINDOW':already?'PERIOD_ALREADY_STORED':'PERIOD_DUE',
    nextScheduledAtMs:before?scheduledAtMs:zonedInstant({...calendarShift(today,1),hour:9}),
    delivery:'NOT_DISPATCHED',schedulerStarted:false,backfillEnabled:false,
  });
}

export function buildR63AdminReport({study:rawStudy,evolution:rawEvolution,period,generatedAtMs}={}){
  exact(period,['startMs','endMs'],'R63_INVALID_REPORT_PERIOD');
  if(!integer(generatedAtMs)||!integer(period.startMs)||!integer(period.endMs)||
      period.startMs>=period.endMs||period.endMs>generatedAtMs||period.endMs-period.startMs>2*DAY)
    fail('R63_INVALID_REPORT_PERIOD');
  const study=inspectR63AnalystStudy(rawStudy);
  const evolution=inspectR63EvolutionState(rawEvolution);
  if(study.scopeId!==evolution.scopeId)fail('R63_REPORT_SCOPE_MISMATCH');
  if(study.asOfMs>generatedAtMs||evolution.updatedAtMs>generatedAtMs)
    fail('R63_REPORT_FUTURE_EVIDENCE');
  if(study.events.some(event=>event.occurredAtMs<period.startMs||event.observedAtMs>=period.endMs))
    fail('R63_REPORT_EVENT_OUTSIDE_PERIOD');
  const inPeriod=entry=>entry.atMs>=period.startMs&&entry.atMs<period.endMs;
  const history=evolution.history.filter(inPeriod);
  const evaluations=evolution.evaluations.filter(inPeriod);
  const actions=history.map(entry=>({
    action:entry.action,atMs:entry.atMs,planId:entry.planId??null,
    fromVersionId:entry.fromVersionId,toVersionId:entry.toVersionId,reason:entry.reason,
  }));
  const count=(rows,action)=>rows.filter(entry=>entry.action===action).length;
  const totals=rows=>({
    registered:count(rows,'EVALUATION_REGISTERED'),automaticallyApplied:count(rows,'AUTO_APPLIED'),
    rejected:count(rows,'REJECTED'),rolledBack:count(rows,'ROLLED_BACK'),
  });
  const names={manual:'Manual',hybrid:'Híbrido',reverse:'Reverso',ultrafast:'UltraFast'};
  const robots=Object.entries(names).map(([robot,label])=>({
    robot,label,observations:study.metrics.byRobot[robot],
    status:study.metrics.byRobot[robot]>0?'SYNTHETIC_OBSERVED':'NO_EVIDENCE_IN_PERIOD',
    findings:study.findings.filter(finding=>finding.robot===robot),
    productionIntegrationVerified:false,realPerformanceMeasured:false,
  }));
  const applied=totals(evolution.history).automaticallyApplied;
  const reverted=applied>0&&evolution.activeVersion.maxAgeMs===750;
  const stage=reverted?'SYNTHETIC_PREVIOUS_VERSION_RESTORED':applied>0?'SYNTHETIC_IMPROVEMENT_APPLIED':study.events.length>0?
    'SYNTHETIC_OBSERVATION_RECORDED':'AWAITING_SYNTHETIC_EVIDENCE';
  const labels={
    SYNTHETIC_PREVIOUS_VERSION_RESTORED:'Versão anterior restaurada em pesquisa; candidata retirada',
    SYNTHETIC_IMPROVEMENT_APPLIED:'Melhoria aplicada e avaliada em pesquisa sintética',
    SYNTHETIC_OBSERVATION_RECORDED:'Observações sintéticas registradas; melhoria ainda não aplicada',
    AWAITING_SYNTHETIC_EVIDENCE:'Aguardando evidências sintéticas',
  };
  return freeze({
    schema:'JENIOS_R63_ADMIN_EVOLUTION_REPORT_V1',
    reportId:`r63-report:${study.scopeId}:${period.startMs}:${period.endMs}`,
    scopeId:study.scopeId,period:{...period},generatedAtMs,timeZone:TIME_ZONE,
    evidenceKind:'SYNTHETIC_FIXTURE',scope:'SYNTHETIC_ONLY',
    adminOnly:true,customerTechnicalNotifications:false,operationalDataDisclosureRequired:true,
    delivery:'NOT_DISPATCHED',scheduledDeliveryActive:false,
    observations:study.metrics,robots,findings:study.findings,proposals:study.proposals,
    evidenceEventIds:study.evidenceEventIds,
    activeVersion:{...evolution.activeVersion},revision:evolution.revision,
    improvements:{period:totals(history),cumulative:totals(evolution.history),actions,evaluations,
      pendingEvaluationPlanId:evolution.pendingEvaluation?.plan?.planId??null},
    maturity:{stage,label:labels[stage],completionCeilingKnown:false,
      productionIntegrationVerified:false,externalExecutionValidated:false,
      commercialPerformanceCertified:false},
    pending:[
      'Integração operacional e evidências externas ainda não validadas.',
      'O serviço agendado e a entrega no admin dependem da ativação do ambiente autorizado.',
      'Dados de clientes exigem finalidade, transparência e controles de acesso definidos.',
    ],
    realOrdersSent:0,externalPaperOrdersSent:0,
    actualBrokerPnl:null,actualLossesAvoided:null,realTradeAccuracy:null,
  });
}
