/** R42: one bounded, authenticated entrypoint for the existing queues. */
import {timingSafeEqual} from 'node:crypto';
import {productionEmailDeliveryPolicy} from './production-delivery-policy.mjs';
import {emailDispatchLimits} from './dispatch-budget.mjs';
import {financeEmailDispatchReadiness} from './finance-payment-confirmation.mjs';
import {runFinanceOutboxBatch} from './finance-outbox-worker.mjs';
import {transactionalDeliveryReadiness,runTransactionalEmailBatch,runDunningEmailBatch} from './transactional-delivery-worker.mjs';
import {marketingDeliveryReadiness,runMarketingEmailBatch} from './marketing-delivery-worker.mjs';

const HEADERS=Object.freeze({'Cache-Control':'no-store'});
const fail=()=>Error('EMAIL_DISPATCH_UNCONFIRMED');

export function internalEmailAuthorized(request,env={}){
 const match=/^Bearer ([^\s]+)$/i.exec(request?.headers?.get('authorization')||'');
 if(!match)return false;
 const b=Buffer.from(match[1]);
 return ['JENIOS_EMAIL_DISPATCH_SECRET','CRON_SECRET'].some(key=>{
  const expected=env[key];
  if(typeof expected!=='string'||expected.length<24)return false;
  const a=Buffer.from(expected);
  return a.length===b.length&&timingSafeEqual(a,b);
 });
}

export function emailDispatcherReadiness(env={},now=Date.now()){
 const scope=productionEmailDeliveryPolicy(env);
 const limits=emailDispatchLimits(env,now);
 const enabled=env.JENIOS_EMAIL_DISPATCHER_ENABLED==='true';
 return Object.freeze({ready:scope.ready&&limits.ready&&enabled,enabled,scope,limits});
}

function counts(result,names){
 if(Array.isArray(result)){
  if(result.length!==1)throw fail();
  result=result[0];
 }
 if(!result||typeof result!=='object')throw fail();
 return Object.fromEntries(names.map(name=>{
  const value=result[name];
  if(!Number.isSafeInteger(value)||value<0)throw fail();
  return [name,value];
 }));
}

function delivery(result,limit,marketing=false){
 if(result?.status==='DISABLED')return {status:'DISABLED',claimed:0,sent:0,...(marketing?{suppressed:0,failed:0}:{blocked:0})};
 if(result?.status!=='PRODUCTION')throw fail();
 const fields=marketing?['claimed','sent','suppressed','failed']:['claimed','sent','blocked'];
 const out=counts(result,fields);
 const deferred=result.deferred??0;
 if(!Number.isSafeInteger(deferred)||deferred<0||deferred>out.claimed)throw fail();
 if(out.claimed>limit||fields.slice(1).reduce((sum,key)=>sum+out[key],0)+(marketing?deferred:0)!==out.claimed||
  (!marketing&&deferred>out.blocked))throw fail();
 if(deferred)out.deferred=deferred;
 return {status:'PRODUCTION',...out};
}

export async function runEmailDispatcher({db,env=process.env,fetcher,now=Date.now()}={}){
 const gate=emailDispatcherReadiness(env,now);
 if(!gate.ready)return Object.freeze({status:'DISABLED'});
 if(!db?.rpc)throw fail();
 const limit=gate.limits.batchLimit;
 const options={db,env,fetcher,limit,now};
 const result={status:'PRODUCTION',scope:'application_delivery_only'};

 // Payment confirmations and account events consume capacity before campaigns.
 result.finance=delivery(await runFinanceOutboxBatch(options),limit);
 result.transactional=delivery(await runTransactionalEmailBatch(options),limit);

 result.dunningPlan={status:'DISABLED',queued:0,marked_past_due:0,cancelled:0,revoked:0};
 const planningArgs={p_now:new Date(now).toISOString(),p_start_at:gate.limits.startAt,p_max_age_hours:gate.limits.maxAgeHours};
 if(env.JENIOS_SUBSCRIPTION_DUNNING_ENABLED==='true'&&transactionalDeliveryReadiness(env,now).ready){
  const planned=await db.rpc('jenios_process_subscription_dunning_r42',planningArgs);
  if(planned.error)throw fail();
  result.dunningPlan={status:'PRODUCTION',...counts(planned.data,['queued','marked_past_due','cancelled','revoked'])};
 }
 result.dunning=delivery(await runDunningEmailBatch(options),limit);

 result.marketingPlan={status:'DISABLED',planned:0,suppressed:0};
 if(env.JENIOS_MARKETING_PLANNER_ENABLED==='true'&&marketingDeliveryReadiness(env,now).ready){
  const planned=await db.rpc('jenios_plan_marketing_emails_r42',planningArgs);
  if(planned.error)throw fail();
  result.marketingPlan={status:'PRODUCTION',...counts(planned.data,['planned','suppressed'])};
 }
 result.marketing=delivery(await runMarketingEmailBatch(options),limit,true);
 return Object.freeze(result);
}

export async function handleEmailDispatcher(request,{env=process.env,getDb,fetcher,now=Date.now()}={}){
 if(!internalEmailAuthorized(request,env))
  return Response.json({error:'Não autorizado'},{status:401,headers:HEADERS});
 if(request.method!=='GET')
  return Response.json({error:'Método não permitido'},{status:405,headers:{...HEADERS,Allow:'GET'}});
 if(!emailDispatcherReadiness(env,now).ready)
  return Response.json({status:'DISABLED'},{headers:HEADERS});
 // Do not construct a privileged client if every delivery channel is disabled.
 if(![financeEmailDispatchReadiness(env,now),transactionalDeliveryReadiness(env,now),marketingDeliveryReadiness(env,now)]
  .some(gate=>gate.ready))return Response.json({status:'DISABLED'},{headers:HEADERS});
 try{
  const result=await runEmailDispatcher({db:getDb(),env,fetcher,now});
  return Response.json(result,{headers:HEADERS});
 }catch{
  return Response.json({status:'ERROR',error:'Não foi possível processar as filas de comunicação.'},
   {status:503,headers:HEADERS});
 }
}
