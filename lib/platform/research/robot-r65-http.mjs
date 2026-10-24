/** Authenticated lifecycle operations. The request never selects tenant or actor. */
import { readBoundedJson } from '../bounded-response.mjs';
import { requirePlatformAdmin } from '../admin-permissions.mjs';
import { isRobotR65CycleEnabled,isR65SchedulerAuthorized,isR65AdminOriginAllowed } from './robot-r65-cycle-access.mjs';
import { requireR65AdminFeed } from './robot-r65-admin-view.mjs';
import { verifyR65ObservationRecord } from './robot-r65-observation-source.mjs';

const respond=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const unavailable=()=>respond({error:'Ciclo indisponível; nenhum resultado foi presumido.'},503);
const fail=()=>{throw Object.assign(new Error('R65_ACTION_INVALID'),{code:'R65_ACTION_INVALID'});};
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value);
const shapes={TICK:['action'],ROLLBACK:['action','operationId','expectedRevision','previousDigest','reason'],
  ARCHIVE_PREVIEW:['action','cutoffMs','limit'],ARCHIVE_COMMIT:['action','operationId','archiveId','manifestDigest'],
  RECONCILE_COST:['action','operationId','cycleId','expectedFingerprint','resolution','evidenceDigest']};
function parseAction(body){
  const keys=shapes[body?.action];
  if(!body||typeof body!=='object'||Array.isArray(body)||!keys||Object.keys(body).length!==keys.length||Object.keys(body).some(k=>!keys.includes(k)))fail();
  if(keys.includes('operationId')&&(typeof body.operationId!=='string'||!/^op:[a-f0-9]{32}$/.test(body.operationId)))fail();
  if(body.action==='ROLLBACK'&&(!Number.isSafeInteger(body.expectedRevision)||body.expectedRevision<0||
    !/^[a-f0-9]{64}$/.test(body.previousDigest||'')||!['REGRESSION_DETECTED','TECHNICAL_FAILURE','OWNER_REQUEST'].includes(body.reason)))fail();
  if(body.action==='ARCHIVE_PREVIEW'&&(!Number.isSafeInteger(body.cutoffMs)||body.cutoffMs<0||!Number.isSafeInteger(body.limit)||body.limit<1||body.limit>10))fail();
  if(body.action==='ARCHIVE_COMMIT'&&(!uuid(body.archiveId)||!/^[a-f0-9]{64}$/.test(body.manifestDigest||'')))fail();
  if(body.action==='RECONCILE_COST'){
    const r=body.resolution;
    if(!uuid(body.cycleId)||!/^[a-f0-9]{64}$/.test(body.expectedFingerprint||'')||
      !/^[a-f0-9]{64}$/.test(body.evidenceDigest||'')||!r||typeof r!=='object'||Array.isArray(r)||
      Object.keys(r).sort().join(',')!=='costNanoUsd,kind,providerResponseId'||
      !['CONFIRMED_USAGE','CONFIRMED_NO_CHARGE'].includes(r.kind)||!Number.isSafeInteger(r.costNanoUsd)||r.costNanoUsd<0||
      (r.kind==='CONFIRMED_NO_CHARGE'&&(r.costNanoUsd!==0||r.providerResponseId!==null))||
      (r.kind==='CONFIRMED_USAGE'&&(typeof r.providerResponseId!=='string'||!/^resp_[A-Za-z0-9_-]{1,160}$/.test(r.providerResponseId))))fail();
  }
  return body;
}
function errorResponse(error){
  if([401,403].includes(error?.status))return respond({error:error.status===401?'Sessão inválida da Platform.':'Conta sem permissão administrativa.'},error.status);
  if(error?.code==='R65_ACTION_INVALID')return respond({error:'Solicitação inválida.'},400);
  if(/CONFLICT|MISMATCH|EXPIRED|PENDING|CHANGED|STALE|NOT_OPEN|NO_PREVIOUS/.test(error?.code||''))
    return respond({error:'O estado mudou ou a ação não está disponível. Atualize o relatório.'},409);
  return unavailable();
}
async function emptyBody(request){
  if(!request.body)return true;
  const reader=request.body.getReader();let timer;
  try{
    const value=await Promise.race([reader.read(),new Promise(resolve=>{
      timer=setTimeout(()=>{resolve({done:false});void reader.cancel().catch(()=>{});},1000);
    })]);
    if(!value.done){void reader.cancel().catch(()=>{});return false;}
    return true;
  }finally{clearTimeout(timer);reader.releaseLock();}
}

export function createR65AdminHandler({getDb,getRuntime,env=process.env}={}){
  return async request=>{
    if(!isRobotR65CycleEnabled(env))return respond({error:'Recurso indisponível.'},404);
    if(!['GET','POST'].includes(request.method))return respond({error:'Método não permitido.'},405);
    if(!/^Bearer [^\s]+$/i.test(request.headers.get('authorization')||''))return respond({error:'Entre com sua conta administrativa da Platform.'},401);
    try{
      const {user}=await requirePlatformAdmin(request,getDb(),'platform.admin');
      if(!uuid(user.id))throw Object.assign(new Error('R65_INVALID_ADMIN'),{status:403});
      if(request.method==='GET')return respond(requireR65AdminFeed(await getRuntime().readFeed()));
      if(!isR65AdminOriginAllowed(request,env))return respond({error:'Origem inválida.'},403);
      if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type')||''))return respond({error:'Envie JSON.'},415);
      let action;try{action=parseAction(await readBoundedJson(request,16384));}catch{return respond({error:'Solicitação inválida.'},400);}
      const runtime=getRuntime(),store=runtime.lifecycleStore,scopeId=runtime.scopeId,actorId='user:'+user.id;
      let result;
      if(action.action==='TICK'){
        const r=await runtime.runTick();result={status:r.status,revision:r.revision,activeVersion:r.activeVersion};
      }else if(action.action==='ROLLBACK'){
        const {action:_,...input}=action;
        const r=await runtime.rollback({...input,actorId});result={status:r.status,revision:r.revision,activeVersion:r.activeVersion};
      }else if(action.action==='ARCHIVE_PREVIEW'){
        const r=await store.previewArchive({scopeId,cutoffMs:action.cutoffMs,limit:action.limit});
        result={archiveId:r.archiveId,status:r.status,manifestDigest:r.manifestDigest,eventCount:r.eventCount,
          cycleCount:r.cycleCount,expiresAtMs:r.expiresAtMs,archiveMode:'LOGICAL_COPY_ONLY'};
      }else if(action.action==='ARCHIVE_COMMIT'){
        const r=await store.commitArchive({scopeId,operationId:action.operationId,archiveId:action.archiveId,manifestDigest:action.manifestDigest,actorId});
        result={archiveId:r.archiveId,status:r.status,manifestDigest:r.manifestDigest,replayed:r.replayed,
          physicalDeletionPerformed:false,spaceReclaimedBytes:0};
      }else{
        const {action:_,...input}=action;
        const r=await store.reconcileCost({...input,scopeId,actorId});
        result={cycleId:action.cycleId,status:r.status,replayed:r.replayed,paidGenerationEnabled:false};
      }
      return respond({schema:'JENIOS_R65_ADMIN_ACTION_V1',action:action.action,result,
        realOrdersSent:0,externalPaperOrdersSent:0,productionChanged:false});
    }catch(error){return errorResponse(error);}
  };
}

export function createR65SchedulerHandler({getRuntime,env=process.env}={}){
  return async request=>{
    if(!isRobotR65CycleEnabled(env))return respond({error:'Recurso indisponível.'},404);
    if(request.method!=='POST')return respond({error:'Método não permitido.'},405);
    if(!isR65SchedulerAuthorized(request,env))return respond({error:'Agendador não autorizado.'},401);
    try{
      if(!await emptyBody(request))return respond({error:'Esta rotina não aceita parâmetros no corpo.'},400);
      const result=await getRuntime().runTick();
      return respond({schema:'JENIOS_R65_SCHEDULE_RESULT_V1',status:result.status,revision:result.revision,
        nextAtMs:result.nextAtMs??null,productionSchedulerStarted:false,realOrdersSent:0,externalPaperOrdersSent:0});
    }catch(error){return errorResponse(error);}
  };
}

export function createR65ObservationHandler({getStore,getSource,env=process.env,now=Date.now}={}){
  return async request=>{
    if(!isRobotR65CycleEnabled(env))return respond({error:'Recurso indisponível.'},404);
    if(request.method!=='POST')return respond({error:'Método não permitido.'},405);
    if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type')||''))return respond({error:'Envie JSON.'},415);
    let source;try{source=getSource();}catch{return unavailable();}
    let verified;
    try{verified=verifyR65ObservationRecord(await readBoundedJson(request,32768),{trustedSource:source,nowMs:now()});}
    catch{return respond({error:'Observação ou assinatura de origem recusada.'},400);}
    try{
      const {receipt,provenance}=verified;
      const result=await getStore().ingestObservation({receipt,provenance});
      if(!['STORED','ALREADY_STORED'].includes(result.status))throw new Error('R65_INTAKE_UNCONFIRMED');
      return respond({schema:'JENIOS_R65_INTAKE_RESULT_V1',status:result.status,
        eventId:receipt.eventId,scopeId:receipt.scopeId,observationEvidenceKind:'SIGNED_QA_REPLAY',
        runtimeOrigin:'R61_SYNTHETIC_RUNTIME',validationEvidenceKind:'SYNTHETIC_FIXTURE',
        customerMonitoringActive:false,privateEngineConnected:false,realOrdersSent:0,externalPaperOrdersSent:0},
        result.status==='ALREADY_STORED'?200:202);
    }catch(error){
      return /CONFLICT|SEQUENCE|REPLAY|MISMATCH/.test(error?.code||'')?
        respond({error:'Observação em conflito com o registro existente.'},409):unavailable();
    }
  };
}
