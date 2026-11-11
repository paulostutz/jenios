import {emptyOwnerState,available,validateOwnerState} from './state-contract.mjs';
const headers={'Cache-Control':'private, no-store','Vary':'Authorization, Cookie','X-Content-Type-Options':'nosniff'};
const reply=(data,status=200)=>Response.json(data,{status,headers});
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
export async function ownerStateHttp(request,{platform,getUser,readState,now=Date.now}={}){
 try{
  const url=new URL(request.url);
  if(request.method!=='GET')fail(405,'Método não permitido.');
  if(url.search)fail(400,'A conta é determinada pela sessão.');
  const origin=request.headers.get('origin'),site=request.headers.get('sec-fetch-site');
  if(origin&&origin!==url.origin||site&&!['same-origin','none'].includes(site))fail(403,'Origem não autorizada.');
  const user=await getUser(request);if(!user?.id||user.is_anonymous)fail(401,'Entre na sua conta para continuar.');
  let state=emptyOwnerState({platform,subject:user.id,now:now()});
  if(readState){try{state=validateOwnerState(await readState(user),{platform,subject:user.id,now:now()});}catch{/* A missing or invalid source is never a zero balance. */}}
  const current=await getUser(request);if(current?.id!==user.id||current.is_anonymous)fail(409,'Sua sessão mudou. Atualize a página.');
  return reply(state);
 }catch(e){return reply({error:e.status?e.message:'Os dados do Ultra estão indisponíveis.'},e.status||503);}
}
// Read the existing owner-scoped Platform tables only. No cross-product email join.
export async function readJeniosState(db,user,{now=Date.now(),remoteState=null}={}){
 const state=remoteState?validateOwnerState(remoteState,{platform:'jenios',subject:user.id,now}):emptyOwnerState({platform:'jenios',subject:user.id,now});
 const stamp=new Date(now).toISOString();
 const results=await Promise.allSettled([
  db.from('jenios_ultra_plans').select('id,config,created_at').eq('user_id',user.id).order('created_at',{ascending:false}).limit(1),
  db.from('jenios_ultra_devices').select('id,label,provider,environment,runtime_state,last_seen_at').eq('user_id',user.id).order('created_at',{ascending:false}).limit(100)
 ]);
 const plan=results[0].status==='fulfilled'?results[0].value:null;
 if(!plan?.error&&plan?.data?.[0]){const p=plan.data[0];state.sections.configuration=available({id:p.id,createdAt:p.created_at,markets:p.config?.markets??[]},{observedAt:stamp});}
 const devices=results[1].status==='fulfilled'?results[1].value:null;
 if(!devices?.error&&Array.isArray(devices?.data)&&state.sections.connections.status!=='available')state.sections.connections=available(devices.data.map(d=>({id:d.id,label:d.label,provider:d.provider,environment:d.environment,status:d.runtime_state,lastObservedAt:d.last_seen_at})),{observedAt:stamp});
 return validateOwnerState(state,{platform:'jenios',subject:user.id,now});
}
