/** Runtime boundaries: signed intake, authenticated scheduler and admin read. */
import { readBoundedJson } from '../bounded-response.mjs';
import { requirePlatformAdmin } from '../admin-permissions.mjs';
import { verifyR64TelemetryEnvelope } from './robot-r64-telemetry.mjs';
import { isRobotR64QaEnabled,isR64SchedulerAuthorized } from './robot-r64-access.mjs';
import { isR64OperationalReport } from './robot-r64-admin-view.mjs';

const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const response=(data,status=200)=>Response.json(data,{status,headers});
const disabled=()=>response({error:'Recurso indisponível.'},404);
const method=name=>response({error:'Método não permitido.',allow:name},405);
const unavailable=()=>response({error:'Integração indisponível; nenhum resultado foi presumido.'},503);
async function emptyBody(request){
  if(!request.body)return true;
  const reader=request.body.getReader();let timer;
  try{
    const result=await Promise.race([reader.read(),new Promise(resolve=>{
      timer=setTimeout(()=>{resolve({done:false,value:new Uint8Array([1])});void reader.cancel().catch(()=>{});},1000);
    })]);
    if(!result.done){void reader.cancel().catch(()=>{});return false;}
    return true;
  }finally{clearTimeout(timer);reader.releaseLock();}
}

export function createR64IntakeHandler({getStore,getTrustedSource,env=process.env,now=Date.now}={}){
  return async request=>{
    if(!isRobotR64QaEnabled(env))return disabled();
    if(request.method!=='POST')return method('POST');
    if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type')||''))
      return response({error:'Envie um envelope JSON.'},415);
    let source;
    try{source=getTrustedSource();}catch{return unavailable();}
    let receipt;
    try{
      const envelope=await readBoundedJson(request,16384);
      receipt=verifyR64TelemetryEnvelope(envelope,{trustedSource:source,nowMs:now()});
    }catch{return response({error:'Envelope ou assinatura de origem recusado.'},400);}
    try{
      const stored=await getStore().ingestReceipt({receipt});
      return response({schema:'JENIOS_R64_INTAKE_RESULT_V1',evidenceKind:'SIGNED_QA_REPLAY',
        status:stored.status,eventId:receipt.eventId,scopeId:receipt.scopeId,
        automaticPromotionAllowed:false,customerMonitoringActive:false},stored.status==='ALREADY_STORED'?200:202);
    }catch(error){
      return /CONFLICT|SEQUENCE|REPLAY/.test(error?.code||'')?
        response({error:'Evento em conflito com o registro existente.'},409):unavailable();
    }
  };
}

export function createR64SchedulerHandler({runCycle,env=process.env}={}){
  return async request=>{
    if(!isRobotR64QaEnabled(env))return disabled();
    if(request.method!=='POST')return method('POST');
    if(!isR64SchedulerAuthorized(request,env))return response({error:'Agendador não autorizado.'},401);
    // The HTTP caller cannot select tenant, provider, model, time or budget.
    if(request.headers.get('content-length')&&!/^0$/.test(request.headers.get('content-length')))
      return response({error:'Esta rotina não aceita parâmetros no corpo.'},400);
    try{
      if(!await emptyBody(request))return response({error:'Esta rotina não aceita parâmetros no corpo.'},400);
      const result=await runCycle();
      return response({schema:'JENIOS_R64_SCHEDULE_RESULT_V1',status:result.status,
        periodKey:result.periodKey||null,productionSchedulerStarted:false,
        realOrdersSent:0,externalPaperOrdersSent:0});
    }catch{return unavailable();}
  };
}

export function createR64AdminHandler({getDb,getStore,getScopeId,env=process.env,now=Date.now}={}){
  return async request=>{
    if(!isRobotR64QaEnabled(env))return disabled();
    if(request.method!=='GET')return method('GET');
    if(!/^Bearer [^\s]+$/i.test(request.headers.get('authorization')||''))
      return response({error:'Entre com sua conta administrativa da Platform.'},401);
    try{
      const db=getDb();await requirePlatformAdmin(request,db,'platform.admin');
      const scopeId=getScopeId();
      const rows=await getStore(db).readReports({scopeId,limit:30});
      if(!Array.isArray(rows)||rows.length>30||rows.some(row=>row.scopeId!==scopeId))throw new Error('R64_SCOPE_MISMATCH');
      const reports=rows.filter(row=>row.report!==null&&row.report!==undefined).map(row=>row.report);
      if(!reports.every(report=>isR64OperationalReport(report)&&report.scopeId===scopeId))throw new Error('R64_INVALID_REPORT');
      return response({schema:'JENIOS_R64_ADMIN_FEED_V1',adminOnly:true,evidenceKind:'SIGNED_QA_REPLAY',scopeId,reports,
        pendingCycles:rows.filter(row=>row.status!=='COMPLETED').length,
        updatedAt:new Date(now()).toISOString(),productionIntegrationVerified:false,
        operationalDataDisclosureRequired:true});
    }catch(error){
      return [401,403].includes(error?.status)?response({error:error.status===401?'Sessão inválida da Platform.':'Conta sem permissão administrativa.'},error.status):unavailable();
    }
  };
}
