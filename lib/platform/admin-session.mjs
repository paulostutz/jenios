import {createSessionFence} from '../social/session-fence.mjs';

const SOCIAL_READS=['/api/platform/admin/access','/api/platform/admin/overview'];
const sessionChanged=()=>Object.assign(new Error('Sua sessão administrativa mudou. Consulte novamente.'),{name:'AbortError',code:'SESSION_CHANGED'});
async function readIdentity(auth){
 try{
  const result=await auth?.getSession(),session=result?.data?.session;
  if(result?.error||!session?.access_token||!session.user?.id||session.user.is_anonymous)return null;
  return {owner:session.user.id,token:session.access_token};
 }catch{return null;}
}
const sameIdentity=(left,right)=>left?.owner===right?.owner&&left?.token===right?.token;

/** Browser lifecycle only. Authorization remains in the existing server endpoints. */
export function createPlatformAdminSession({platformAuth,socialAuth,
 fetchImpl=(...args)=>globalThis.fetch(...args),
 eventTarget=typeof window==='undefined'?null:window,
 schedule=callback=>setTimeout(callback,0),cancel=timer=>clearTimeout(timer)
}={}){
 function watch(invalidate){
  let active=true;
  // INITIAL_SESSION is covered by getSession; every later event invalidates, including refresh.
  const changed=event=>{if(active&&event!=='INITIAL_SESSION')invalidate();};
  const subscriptions=[platformAuth,socialAuth].map(auth=>auth?.onAuthStateChange?.(changed));
  const focus=()=>{if(active)invalidate();};
  eventTarget?.addEventListener?.('focus',focus);
  return()=>{
   if(!active)return;active=false;
   for(const sub of subscriptions)sub?.data?.subscription?.unsubscribe?.();
   eventTarget?.removeEventListener?.('focus',focus);
  };
 }
 async function identities(){
  const [platform,social]=await Promise.all([readIdentity(platformAuth),readIdentity(socialAuth)]);
  return {platform,social};
 }
 async function request(url,options={}){
  const fence=createSessionFence(),ticket=fence.capture(),controller=new AbortController();
  let stop=()=>{};
  const invalidate=()=>{
   fence.change();controller.abort();stop();
   options.signal?.removeEventListener('abort',invalidate);
  };
  stop=watch(invalidate);if(controller.signal.aborted)stop();
  const current=()=>{if(controller.signal.aborted||!fence.current(ticket))throw sessionChanged();};
  options.signal?.addEventListener('abort',invalidate,{once:true});
  try{
   if(options.signal?.aborted)invalidate();
   current();const sources=await identities();current();
   async function verify(){
    current();const latest=await identities();current();
    if(!sameIdentity(sources.platform,latest.platform)||!sameIdentity(sources.social,latest.social)){
     invalidate();throw sessionChanged();
    }
   }
   async function checkedFetch(target,init){
    await verify();
    const response=await fetchImpl(target,{...init,signal:controller.signal});
    // Wait for the body too: a session can change after headers arrive. Preserve the Response API.
    await response.clone().arrayBuffer();
    await verify();return response;
   }
   if(sources.platform){
    const headers=new Headers(options.headers);headers.set('authorization','Bearer '+sources.platform.token);
    const response=await checkedFetch(url,{...options,cache:'no-store',headers});
    if(response.ok)return response;
   }
   if(!SOCIAL_READS.includes(url)||String(options.method||'GET').toUpperCase()!=='GET')
    throw Error('Acesso avançado disponível apenas com sessão administrativa exclusiva da Platform.');
   if(!sources.social)throw Error('Entre com sua conta Master da JENIOS Social.');
   const headers={authorization:'Bearer '+sources.social.token};
   const check=await checkedFetch('/api/admin/access',{cache:'no-store',headers});
   if(!check.ok)throw Error('Não foi possível verificar o Master.');
   const grants=await check.json();await verify();
   if(grants?.isMaster!==true)throw Error('Apenas Masters podem acessar a gestão administrativa.');
   if(url==='/api/platform/admin/access')return Response.json({permissions:['platform.admin','platform.reports'],masterSource:'jenios_social_verified'});
   const response=await checkedFetch('/api/admin/ecosystem',{cache:'no-store',headers});
   if(!response.ok)throw Error('Indicadores indisponíveis.');
   const body=await response.json();await verify();
   if(body?.status!=='ready'||body.source!=='platform_dedicated_database')throw Error('Banco exclusivo da Platform indisponível.');
   return Response.json({...body,verified:true,source:'platform_dedicated_database'});
  }finally{
   stop();options.signal?.removeEventListener('abort',invalidate);
  }
 }
 function observe(onState){
  const fence=createSessionFence();let alive=true,timer=null,running=null;
  async function load(ticket){
   if(!alive||!fence.current(ticket))return;
   const controller=new AbortController();running=controller;
   try{
    const data=await(await request('/api/platform/admin/access',{signal:controller.signal})).json();
    if(alive&&fence.current(ticket)&&!controller.signal.aborted)
     onState({permissions:Array.isArray(data?.permissions)?data.permissions:[],error:''});
   }catch(error){
    if(alive&&fence.current(ticket)&&!controller.signal.aborted)
     onState({permissions:null,error:error?.message||'Não foi possível verificar as permissões.'});
   }finally{if(running===controller)running=null;}
  }
  function invalidate(){
   if(!alive)return;
   const ticket=fence.change();running?.abort();running=null;
   if(timer!==null)cancel(timer);
   onState({permissions:null,error:''});
   // Supabase auth callbacks must stay synchronous; getSession runs outside its auth lock.
   timer=schedule(()=>{timer=null;void load(ticket);});
  }
  const stop=watch(invalidate);invalidate();
  return()=>{
   if(!alive)return;alive=false;fence.change();stop();running?.abort();
   if(timer!==null)cancel(timer);
  };
 }
 return {fetch:request,observe};
}
