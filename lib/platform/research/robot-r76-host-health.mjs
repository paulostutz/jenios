/** R76: Read-only evidence of the existing R74 synthetic host. No orders. */
import {getJeniosPlatformAdmin} from '../admin-db.mjs';
import {requirePlatformAdmin} from '../admin-permissions.mjs';
import {isR73AdministrationEnabled} from './robot-r73-definitive-status.mjs';

const TABLE='jenios_robot_private_hosts_r74';
const FIELDS='status,last_heartbeat_at,last_cycle_at,last_error_code,real_orders_sent,external_paper_orders_sent,customer_monitoring_active,live_execution_enabled';
const HEADERS={'Cache-Control':'private, no-store','Vary':'Authorization','X-Content-Type-Options':'nosniff'};
const reply=(data,status=200)=>Response.json(data,{status,headers:HEADERS});
const fail=status=>{throw Object.assign(Error('R76_UNAVAILABLE'),{status});};
const errorResponse=e=>reply({ok:false,error:e?.status===401?'Entre com sua conta da Platform.':e?.status===403?'Acesso administrativo não autorizado.':e?.status===404?'Consulta indisponível.':e?.status===405?'Método não permitido.':'Não foi possível verificar o host.'},[401,403,404,405].includes(e?.status)?e.status:503);
const stamp=value=>{
 if(typeof value!=='string'||!value)return null;
 const ms=Date.parse(value);
 return Number.isFinite(ms)?{ms,iso:new Date(ms).toISOString()}:null;
};
const number=value=>Number.isSafeInteger(value)&&value>=0;
export function projectR76HostHealth(row,{now=Date.now()}={}){
 if(!row)return Object.freeze({state:'NOT_CONFIGURED',heartbeatAt:null,cycleAt:null,heartbeatAgeSeconds:null,
  realOrdersSent:null,paperOrdersSent:null,configurationAlert:false,errorReported:false});
 const heartbeat=stamp(row.last_heartbeat_at),cycle=stamp(row.last_cycle_at);
 const real=number(row.real_orders_sent)?row.real_orders_sent:null;
 const paper=number(row.external_paper_orders_sent)?row.external_paper_orders_sent:null;
 const booleans=typeof row.live_execution_enabled==='boolean'&&typeof row.customer_monitoring_active==='boolean';
 const errorReported=typeof row.last_error_code==='string'&&row.last_error_code.length>0;
 const configurationAlert=Boolean(row.live_execution_enabled===true||row.customer_monitoring_active===true||(real!==null&&real>0)||(paper!==null&&paper>0));
 const valid=Number.isFinite(now)&&heartbeat&&cycle&&heartbeat.ms<=now+5000&&cycle.ms<=now+5000&&
  ['READY','DEGRADED','STOPPING'].includes(row.status)&&real!==null&&paper!==null&&booleans;
 let state='UNVERIFIED';
 if(valid&&!configurationAlert){
  if(row.status!=='READY'||errorReported)state='DEGRADED';
  else if(now-heartbeat.ms>600000||now-cycle.ms>600000)state='STALE';
  else state='SYNTHETIC_ACTIVE';
 }
 return Object.freeze({state,heartbeatAt:heartbeat?.iso??null,cycleAt:cycle?.iso??null,
  heartbeatAgeSeconds:valid?Math.max(0,Math.floor((now-heartbeat.ms)/1000)):null,
  realOrdersSent:real,paperOrdersSent:paper,configurationAlert,errorReported});
}
export function createR76HostHealthHandler({env=process.env,getDb=()=>getJeniosPlatformAdmin(env),now=Date.now}={}){
 return async function GET(request){
  try{
   if(!isR73AdministrationEnabled(env))fail(404);
   if(request.method!=='GET')fail(405);
   if(new URL(request.url).search)return reply({ok:false,error:'Esta consulta não aceita parâmetros.'},400);
   if(!/^Bearer [^\s]+$/i.test(request.headers.get('authorization')||''))fail(401);
   const db=getDb();
   await requirePlatformAdmin(request,db,'platform.admin');
   if(!isR73AdministrationEnabled(env))fail(404);
   const result=await db.from(TABLE).select(FIELDS).order('last_heartbeat_at',{ascending:false}).limit(1);
   if(result.error||!Array.isArray(result.data))fail(503);
   if(!isR73AdministrationEnabled(env))fail(404);
   const checked=now();
   if(!Number.isFinite(checked))fail(503);
   return reply({ok:true,schema:'JENIOS_R76_PRIVATE_HOST_HEALTH_V1',checkedAt:new Date(checked).toISOString(),
    host:projectR76HostHealth(result.data[0]||null,{now:checked}),
    evidence:'R74_HOST_DATABASE_READ_ONLY',executionCertified:false,brokerAccountVerified:false,
    ownerFundsCustodied:false,canPlaceOrders:false});
  }catch(e){return errorResponse(e);}
 };
}
