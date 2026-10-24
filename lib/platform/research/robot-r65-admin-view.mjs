/** Browser-safe, closed projection. Private journals and provider bodies stay server-side. */
const integer=v=>Number.isSafeInteger(v)&&v>=0;
const hex=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v);
const version=v=>v===null||/^research:r65-v[12]$/.test(v||'');
function exact(v,keys){
  if(!v||typeof v!=='object'||Array.isArray(v)||![Object.prototype,null].includes(Object.getPrototypeOf(v)))return false;
  const own=Reflect.ownKeys(v);return own.length===keys.length&&own.every(k=>typeof k==='string'&&keys.includes(k)&&
    Object.hasOwn(Object.getOwnPropertyDescriptor(v,k),'value')&&Object.getOwnPropertyDescriptor(v,k).enumerable);
}
function list(v,max,check){
  if(!Array.isArray(v)||v.length>max||Reflect.ownKeys(v).length!==v.length+1)return false;
  for(let i=0;i<v.length;i++){const d=Object.getOwnPropertyDescriptor(v,String(i));if(!d||!Object.hasOwn(d,'value')||!check(d.value))return false;}
  return true;
}
const active=v=>exact(v,['versionId','maxAgeMs','activatedAtMs','activationGeneration'])&&typeof v.versionId==='string'&&version(v.versionId)&&
  [750,500].includes(v.maxAgeMs)&&integer(v.activatedAtMs)&&integer(v.activationGeneration)&&v.activationGeneration<=2;
const plan=v=>v===null||(exact(v,['planId','startsAtMs','endsAtMs','caseCount','capturedCases'])&&
  /^plan:[a-f0-9]{16}$/.test(v.planId||'')&&integer(v.startsAtMs)&&integer(v.endsAtMs)&&v.endsAtMs>v.startsAtMs&&
  integer(v.caseCount)&&v.caseCount>=6&&v.caseCount<=200&&integer(v.capturedCases)&&v.capturedCases<=v.caseCount);
const history=v=>exact(v,['action','atMs','fromVersionId','toVersionId','reason'])&&
  ['EVALUATION_REGISTERED','AUTO_APPLIED','REJECTED','ROLLED_BACK'].includes(v.action)&&integer(v.atMs)&&
  version(v.fromVersionId)&&version(v.toVersionId)&&/^[A-Z_]{1,90}$/.test(v.reason||'');
const evaluation=v=>v===null||(exact(v,['status','reason','validationCases','baselineFalseAllows','candidateFalseAllows','baselineFalseBlocks','candidateFalseBlocks'])&&
  ['AUTO_APPLIED','REJECTED'].includes(v.status)&&/^[A-Z_]{1,90}$/.test(v.reason||'')&&integer(v.validationCases)&&
  ['baselineFalseAllows','candidateFalseAllows','baselineFalseBlocks','candidateFalseBlocks'].every(k=>v[k]===null||integer(v[k])));
const archive=v=>exact(v,['archiveId','status','manifestDigest','eventCount','cycleCount','createdAtMs'])&&uuid(v.archiveId)&&
  ['PREVIEW','COMMITTED'].includes(v.status)&&hex(v.manifestDigest)&&integer(v.eventCount)&&integer(v.cycleCount)&&integer(v.createdAtMs);
const reconciliation=v=>exact(v,['cycleId','resolutionKind','costNanoUsd','resolvedAtMs','overReservation'])&&uuid(v.cycleId)&&
  ['CONFIRMED_USAGE','CONFIRMED_NO_CHARGE'].includes(v.resolutionKind)&&integer(v.costNanoUsd)&&integer(v.resolvedAtMs)&&typeof v.overReservation==='boolean';
const pending=v=>exact(v,['cycleId','requestFingerprint','reservationNanoUsd'])&&uuid(v.cycleId)&&hex(v.requestFingerprint)&&integer(v.reservationNanoUsd);
const state=v=>v===null||(exact(v,['revision','stateDigest','activeVersion','pendingEvaluation','history','lastEvaluation','maturity'])&&
  integer(v.revision)&&hex(v.stateDigest)&&active(v.activeVersion)&&plan(v.pendingEvaluation)&&list(v.history,32,history)&&
  evaluation(v.lastEvaluation)&&['BASELINE','EVALUATING','QA_APPLIED','QA_ROLLED_BACK'].includes(v.maturity));

export function isR65AdminFeed(feed){
  return exact(feed,['schema','scopeId','adminOnly','observationEvidenceKind','runtimeOrigin','validationEvidenceKind',
    'state','archives','reconciliations','pendingReconciliations','archiveMode','physicalDeletionPerformed','spaceReclaimedBytes',
    'privateEngineConnected','customerMonitoringActive','operationalDataDisclosureRequired','realOrdersSent','externalPaperOrdersSent',
    'actualBrokerPnl','actualLossesAvoided','realTradeAccuracy','commercialPerformanceCertified','generatedAtMs'])&&
    feed.schema==='JENIOS_R65_ADMIN_FEED_V1'&&/^scope:[a-f0-9]{16}$/.test(feed.scopeId||'')&&feed.adminOnly===true&&
    feed.observationEvidenceKind==='SIGNED_QA_REPLAY'&&feed.runtimeOrigin==='R61_SYNTHETIC_RUNTIME'&&
    feed.validationEvidenceKind==='SYNTHETIC_FIXTURE'&&state(feed.state)&&list(feed.archives,30,archive)&&
    list(feed.reconciliations,30,reconciliation)&&list(feed.pendingReconciliations,30,pending)&&
    feed.archiveMode==='LOGICAL_COPY_ONLY'&&feed.physicalDeletionPerformed===false&&feed.spaceReclaimedBytes===0&&
    feed.privateEngineConnected===false&&feed.customerMonitoringActive===false&&feed.operationalDataDisclosureRequired===true&&
    feed.realOrdersSent===0&&feed.externalPaperOrdersSent===0&&feed.actualBrokerPnl===null&&feed.actualLossesAvoided===null&&
    feed.realTradeAccuracy===null&&feed.commercialPerformanceCertified===false&&integer(feed.generatedAtMs);
}
export function requireR65AdminFeed(feed){if(!isR65AdminFeed(feed))throw new Error('R65_ADMIN_FEED_INVALID');return feed;}

export function projectR65AdminFeed({scopeId,overview,evolution,validationCases=[],generatedAtMs}){
  if(overview.scopeId!==scopeId||overview.archiveMode!=='LOGICAL_COPY_ONLY'||overview.physicalDeletionPerformed!==false||
    overview.spaceReclaimedBytes!==0)throw new Error('R65_OVERVIEW_INVALID');
  let projected=null;
  if(evolution){
    if(evolution.scopeId!==scopeId||evolution.state.scopeId!==scopeId)throw new Error('R65_SCOPE_MISMATCH');
    const source=evolution.state,last=source.evaluations.at(-1),p=source.pendingEvaluation?.plan;
    projected={revision:evolution.revision,stateDigest:evolution.stateDigest,
      activeVersion:{...source.activeVersion},pendingEvaluation:p?{planId:p.planId,startsAtMs:p.startsAtMs,
        endsAtMs:p.endsAtMs,caseCount:p.caseDefinitions.length,capturedCases:validationCases.length}:null,
      history:source.history.map(h=>({action:h.action,atMs:h.atMs,fromVersionId:h.fromVersionId,toVersionId:h.toVersionId,reason:h.reason})),
      lastEvaluation:last?{status:last.status,reason:last.reason,validationCases:source.journal.filter(command=>command.action==='EVALUATE').at(-1)?.validationCases?.length??0,
        baselineFalseAllows:last.baseline?.falseAllows??null,candidateFalseAllows:last.candidate?.falseAllows??null,
        baselineFalseBlocks:last.baseline?.falseBlocks??null,candidateFalseBlocks:last.candidate?.falseBlocks??null}:null,
      maturity:p?'EVALUATING':source.activeVersion.activationGeneration===2?'QA_ROLLED_BACK':
        source.activeVersion.maxAgeMs===500?'QA_APPLIED':'BASELINE'};
  }
  return requireR65AdminFeed({schema:'JENIOS_R65_ADMIN_FEED_V1',scopeId,adminOnly:true,
    observationEvidenceKind:'SIGNED_QA_REPLAY',runtimeOrigin:'R61_SYNTHETIC_RUNTIME',validationEvidenceKind:'SYNTHETIC_FIXTURE',
    state:projected,archives:overview.archives,reconciliations:overview.reconciliations,pendingReconciliations:overview.pendingReconciliations,
    archiveMode:'LOGICAL_COPY_ONLY',physicalDeletionPerformed:false,spaceReclaimedBytes:0,
    privateEngineConnected:false,customerMonitoringActive:false,operationalDataDisclosureRequired:true,
    realOrdersSent:0,externalPaperOrdersSent:0,actualBrokerPnl:null,actualLossesAvoided:null,realTradeAccuracy:null,
    commercialPerformanceCertified:false,generatedAtMs});
}
