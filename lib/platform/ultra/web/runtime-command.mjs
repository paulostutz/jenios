import {randomUUID,createHash,timingSafeEqual} from 'node:crypto';
import {validateCommand,commandResult,validateCommandResult,validatePolicy,readCommandJson} from './command-contract.mjs';
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
const validKey=k=>typeof k==='string'&&/^[A-Za-z0-9_-]{32,256}$/.test(k);
export function createRuntimeCommandSource({env={},fetchImpl=fetch,now=Date.now,timeoutMs=8000}={}){
 return async({platform,subject,command})=>{
  validateCommand(command);let origin;
  try{const u=new URL(env.ULTRA_RUNTIME_ORIGIN);if(env.ULTRA_RUNTIME_ENABLED!=='true'||u.protocol!=='https:'||u.username||u.password||u.port||u.pathname!=='/'||u.search||u.hash||!validKey(env.ULTRA_RUNTIME_SERVICE_KEY))throw Error();origin=u.origin}catch{return commandResult(command,'blocked','configuration_required')}
  const nonce=randomUUID(),controller=new AbortController();let timer;
  const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('timeout'))},timeoutMs)});
  try{
   const result=await Promise.race([timeout,(async()=>{
    const response=await fetchImpl(origin+'/v1/ultra/commands',{method:'POST',cache:'no-store',redirect:'error',signal:controller.signal,headers:{Authorization:'Bearer '+env.ULTRA_RUNTIME_SERVICE_KEY,'Content-Type':'application/json'},body:JSON.stringify({schema:'ULTRA_COMMAND_REQUEST_V1',platform,subject,nonce,issuedAt:now(),command})});
    if(!response.ok)throw Error('runtime_unavailable');
    const body=await readCommandJson(response);
    if(body.nonce!==nonce||body.subject!==subject||body.platform!==platform)throw Error('context_mismatch');
    return validateCommandResult(body.result,command);
   })()]);return result;
  }catch{return commandResult(command,'unknown','reconcile_without_resend')}finally{clearTimeout(timer)}
 };
}
// commandStore MUST durably claim before effects, compare fingerprints, and retain
// unknown/pending claims across restart. No in-memory production fallback exists.
export function createRuntimeCommandService({serviceKey,resolve,commandStore,now=Date.now}={}){
 if(!validKey(serviceKey)||typeof resolve!=='function'||!['claim','read','finish','reconcile'].every(k=>typeof commandStore?.[k]==='function'))throw Error('command_service_dependencies_required');
 return async request=>{
  const reply=(body,status=200)=>Response.json(body,{status,headers});let body,command,key,claimed=false;
  try{
   if(request.method!=='POST'||new URL(request.url).pathname!=='/v1/ultra/commands'||new URL(request.url).search)return reply({error:'not_found'},404);
   const a=Buffer.from((request.headers.get('authorization')??'').replace(/^Bearer /,'')),b=Buffer.from(serviceKey);
   if(a.length!==b.length||!timingSafeEqual(a,b))return reply({error:'unauthorized'},401);
   body=await readCommandJson(request);
   if(Object.keys(body).sort().join()!=='command,issuedAt,nonce,platform,schema,subject'||body.schema!=='ULTRA_COMMAND_REQUEST_V1'||!['jenios','flow'].includes(body.platform)||typeof body.subject!=='string'||!body.subject||body.subject.length>160||typeof body.nonce!=='string'||!/^[a-f0-9-]{36}$/i.test(body.nonce)||!Number.isSafeInteger(body.issuedAt)||Math.abs(now()-body.issuedAt)>30000)return reply({error:'invalid_request'},400);
   command=validateCommand(body.command);
   const wrap=result=>reply({platform:body.platform,subject:body.subject,nonce:body.nonce,result});
   const context={platform:body.platform,subject:body.subject};
   const consumer=await resolve(context);
   if(!consumer)return wrap(commandResult(command,'blocked','identity_source_required'));
   key=JSON.stringify([body.platform,body.subject,command.commandId]);
   if(command.action==='status'){
    const entry=await commandStore.read(key);
    if(entry&&entry.result?.status!=='blocked'&&(entry.result||entry.command)&&typeof consumer.reconcile==='function'){
     const previous=entry.result??commandResult(entry.command,'unknown','reconcile_without_resend');
     const updated=await consumer.reconcile(previous);
     if(updated){const result=validateCommandResult(updated,{...command,action:previous.action});await commandStore.reconcile({key,previous:entry.result,result});entry.result=result;}
    }
    return wrap(entry?.result?{...validateCommandResult(entry.result,{...command,action:entry.result.action}),action:'status'}:commandResult(command,entry?'unknown':'pending',entry?'reconcile_without_resend':'not_found'));
   }
   const fingerprint=createHash('sha256').update(JSON.stringify([command.action,command.consentVersion??null,command.expectedScope??null])).digest('hex');
   if(command.action!=='policy'){
    const existing=await commandStore.read(key);
    if(existing){
     if(existing.fingerprint!==fingerprint)return wrap(commandResult(command,'blocked','idempotency_conflict'));
     return wrap(existing.result?validateCommandResult(existing.result,command):commandResult(command,'unknown','reconcile_without_resend'));
    }
   }
   const rejectBeforeEffect=async phase=>{
    const rejection=commandResult(command,'blocked',phase);
    const claim=await commandStore.claim({key,fingerprint,command,scope:JSON.stringify([body.platform,body.subject])});
    if(claim.state==='conflict')return wrap(commandResult(command,'blocked','idempotency_conflict'));
    if(claim.state!=='claimed')return wrap(claim.result?validateCommandResult(claim.result,command):commandResult(command,'unknown','reconcile_without_resend'));
    claimed=true;await commandStore.finish({key,fingerprint,result:rejection});return wrap(rejection);
   };
   let policy=null;
   if(command.action!=='pause'){
    try{policy=validatePolicy(await consumer.readPolicy());}catch(error){
     if(command.action!=='policy')throw error;
     policy={consentVersion:'unavailable',revision:'operational:'+consumer.bindingId,scopes:{start:'unavailable',pause:'operational',billing:'unavailable'},canStart:false,canBill:false,canPause:await consumer.authorize({...command,action:'pause'},null)===true,reason:'commercial_authority_unavailable'};
    }
   }
   if(command.action==='policy')return wrap({...commandResult(command,'accepted','policy'),policy});
   if(command.action!=='pause'&&command.expectedScope!==policy.scopes[command.action])return rejectBeforeEffect('stale_scope');
   if(command.action!=='pause'&&(!policy[{start:'canStart',billing:'canBill'}[command.action]]||command.consentVersion!==policy.consentVersion||command.expectedScope!==policy.scopes[command.action])||await consumer.authorize(command,policy)!==true)return rejectBeforeEffect('authority_or_consent_required');
   const current=await resolve(context);
   if(!current||typeof consumer.bindingId!=='string'||!consumer.bindingId||current.bindingId!==consumer.bindingId||await current.authorize(command,policy)!==true)return rejectBeforeEffect('identity_changed');

   const claim=await commandStore.claim({key,fingerprint,command,scope:JSON.stringify([body.platform,body.subject])});
   if(claim.state==='conflict')return wrap(commandResult(command,'blocked','idempotency_conflict'));
   if(claim.state!=='claimed')return wrap(claim.result?validateCommandResult(claim.result,command):commandResult(command,'unknown','reconcile_without_resend'));
   claimed=true;
   const outcome=await current.execute(command,policy);
   const result=validateCommandResult(commandResult(command,outcome.status,outcome.phase),command);
   await commandStore.finish({key,fingerprint,result});
   return wrap(result);
  }catch{
   // A failed write of the result leaves a durable claim, never a retryable action.
   if(claimed)return reply({platform:body.platform,subject:body.subject,nonce:body.nonce,result:commandResult(command,'unknown','reconcile_without_resend')});
   return reply({error:'command_unavailable'},503);
  }
 };
}
