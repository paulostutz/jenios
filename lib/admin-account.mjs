/** Own-account email changes. Master authorization remains in AdminAccess.
 * The disposable Auth client can use only the captured account's user endpoint;
 * it never persists, refreshes, signs out or changes the shared browser session.
 */
const messages={
 ACCOUNT_EMAIL_INVALID:'Informe um e-mail válido.',
 ACCOUNT_EMAIL_CONFIRMATION_MISMATCH:'A confirmação do novo e-mail não corresponde.',
 ACCOUNT_REDIRECT_INVALID:'Não foi possível validar o endereço de retorno.',
 ACCOUNT_AUTH_UNAVAILABLE:'O acesso à conta está indisponível. Tente novamente mais tarde.',
 ACCOUNT_SESSION_REQUIRED:'Atualize seu acesso ou entre novamente antes de continuar.',
 ACCOUNT_IDENTITY_MISMATCH:'A conta da sessão mudou. Atualize seu acesso antes de continuar.',
 ACCOUNT_RESPONSE_INVALID:'Não foi possível confirmar os dados da conta. Atualize seu acesso.',
 ACCOUNT_EMAIL_UPDATE_FAILED:'Não foi possível confirmar a solicitação. Atualize seu acesso antes de tentar novamente.',
 ACCOUNT_REQUEST_NOT_ALLOWED:'Não foi possível validar esta solicitação de alteração de e-mail.',
 SESSION_CHANGED:'Sua sessão mudou. Atualize seu acesso antes de continuar.',
 OPERATION_ABORTED:'A consulta foi interrompida.'
};
const failure=code=>Object.assign(new Error(messages[code]),{code,
 ...(['SESSION_CHANGED','OPERATION_ABORTED'].includes(code)?{name:'AbortError'}:{})});
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
let clientSequence=0;

export function normalizeAdminAccountEmail(value){
 if(typeof value!=='string'||/[\u0000-\u001f\u007f]/.test(value))throw failure('ACCOUNT_EMAIL_INVALID');
 const email=value.trim().toLowerCase();
 if(email.length<5||email.length>254||!(/^[^\s@<>(),;:"\\]+@[^\s@<>(),;:"\\]+\.[^\s@<>(),;:"\\]+$/.test(email)))
  throw failure('ACCOUNT_EMAIL_INVALID');
 return email;
}
function accountView(user,owner){
 if(!user||!uuid(user.id)||user.id!==owner||user.is_anonymous)throw failure('ACCOUNT_IDENTITY_MISMATCH');
 try{
  const email=normalizeAdminAccountEmail(user.email);
  const next=user.new_email==null||user.new_email===''?null:normalizeAdminAccountEmail(user.new_email);
  return {id:user.id,email,pendingEmail:next&&next!==email?next:null};
 }catch(error){if(error?.code==='ACCOUNT_EMAIL_INVALID')throw failure('ACCOUNT_RESPONSE_INVALID');throw error;}
}
function secureOrigin(value,code){
 let parsed;try{parsed=new URL(value);}catch{throw failure(code);}
 if(parsed.username||parsed.password||parsed.search||parsed.hash||parsed.pathname!=='/'||
  !(parsed.protocol==='https:'||(parsed.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(parsed.hostname))))
  throw failure(code);
 return parsed.origin;
}
function emailRedirect(origin){return secureOrigin(origin,'ACCOUNT_REDIRECT_INVALID')+'/admin/meu-acesso';}
async function sessionSnapshot(auth){
 let result;try{result=await auth.getSession();}catch{throw failure('ACCOUNT_SESSION_REQUIRED');}
 const session=result?.data?.session;
 if(result?.error||!uuid(session?.user?.id)||session.user.is_anonymous||typeof session.access_token!=='string'||!session.access_token)
  throw failure('ACCOUNT_SESSION_REQUIRED');
 return {...session,user:{id:session.user.id}};
}
function requireLifetime(session,now){
 // auth-js 2.117.3 refreshes within 90s. Keep a larger margin, including the
 // signed token's exp, and reject refresh requests at the transport boundary.
 let payload;try{
  const parts=session.access_token.split('.');
  if(parts.length!==3||!parts[1])throw Error();
  payload=JSON.parse(atob(parts[1].replaceAll('-','+').replaceAll('_','/')));
 }catch{throw failure('ACCOUNT_SESSION_REQUIRED');}
 if(payload.sub!==session.user.id||!Number.isFinite(payload.exp)||!Number.isFinite(session.expires_at)||
  Math.min(payload.exp,session.expires_at)*1000-now<=120000||
  typeof session.refresh_token!=='string'||!session.refresh_token)throw failure('ACCOUNT_SESSION_REQUIRED');
}
function sessionFence(auth,signal){
 if(!auth||typeof auth.getSession!=='function'||typeof auth.getUser!=='function'||typeof auth.onAuthStateChange!=='function')
  throw failure('ACCOUNT_AUTH_UNAVAILABLE');
 const controller=new AbortController();let reason=null,closed=false,subscription=null;
 const cleanup=()=>{signal?.removeEventListener('abort',externalAbort);subscription?.data?.subscription?.unsubscribe?.();subscription=null;};
 const abort=code=>{if(!reason){reason=failure(code);controller.abort();cleanup();}};
 const externalAbort=()=>abort('OPERATION_ABORTED');
 subscription=auth.onAuthStateChange(event=>{if(event!=='INITIAL_SESSION')abort('SESSION_CHANGED');});
 signal?.addEventListener('abort',externalAbort,{once:true});
 if(signal?.aborted)externalAbort();
 if(reason)cleanup();
 const assert=()=>{if(reason)throw reason;if(closed)throw failure('OPERATION_ABORTED');};
 return {signal:controller.signal,assert,
  async verify(snapshot){
   assert();let current;try{current=await sessionSnapshot(auth);}catch(error){assert();throw error;}
   assert();if(current.user.id!==snapshot.user.id||current.access_token!==snapshot.access_token){abort('SESSION_CHANGED');assert();}
  },
  close(){if(closed)return;closed=true;controller.abort();cleanup();}
 };
}
async function verifiedAccount(auth,session,fence){
 await fence.verify(session);
 let response;try{response=await auth.getUser(session.access_token);}catch{fence.assert();throw failure('ACCOUNT_SESSION_REQUIRED');}
 fence.assert();if(response?.error)throw failure('ACCOUNT_SESSION_REQUIRED');
 const account=accountView(response?.data?.user,session.user.id);
 await fence.verify(session);return account;
}

export async function loadOwnAccountEmail(auth,{signal}={}){
 const fence=sessionFence(auth,signal);
 try{fence.assert();const session=await sessionSnapshot(auth);fence.assert();return await verifiedAccount(auth,session,fence);}
 finally{fence.close();}
}

/** Public SDK injection keeps local tests independent of Supabase/network. */
export async function createBoundEmailAuth({auth,session,signal,createClient,projectUrl,publishableKey,
 fetchImpl=(...args)=>globalThis.fetch(...args),now=()=>Date.now()}={}){
 const fence=sessionFence(auth,signal);let client=null,disposed=false;
 async function dispose(){
  if(disposed)return;disposed=true;fence.close();
  // dispose() is public in the pinned auth-js 2.117.3. Never signOut(): that
  // would revoke the real account's session instead of cleaning this client.
  if(client?.auth?.dispose)await client.auth.dispose();
 }
 try{
  fence.assert();requireLifetime(session,now());await fence.verify(session);fence.assert();
  const base=secureOrigin(projectUrl,'ACCOUNT_AUTH_UNAVAILABLE');
  if(typeof createClient!=='function'||typeof publishableKey!=='string'||!publishableKey||typeof fetchImpl!=='function')
   throw failure('ACCOUNT_AUTH_UNAVAILABLE');
  async function guardedFetch(input,options={}){
   fence.assert();requireLifetime(session,now());
   let target;try{target=new URL(typeof input==='string'||input instanceof URL?input:input?.url);}catch{throw failure('ACCOUNT_REQUEST_NOT_ALLOWED');}
   const method=String(options.method||input?.method||'GET').toUpperCase();
   const headers=new Headers(options.headers||input?.headers);
   if(target.origin!==base||target.pathname!=='/auth/v1/user'||target.username||target.password||target.hash||
    !['GET','PUT'].includes(method)||headers.get('authorization')!=='Bearer '+session.access_token)
    throw failure('ACCOUNT_REQUEST_NOT_ALLOWED');
   await fence.verify(session);requireLifetime(session,now());fence.assert();
   const response=await fetchImpl(target.toString(),{...options,method,headers,signal:fence.signal,
    cache:'no-store',credentials:'omit',redirect:'error'});
   // Include delayed bodies in the session fence without consuming the SDK's response.
   await response.clone().arrayBuffer();await fence.verify(session);return response;
  }
  client=createClient(base,publishableKey,{global:{fetch:guardedFetch},auth:{
   persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,flowType:'implicit',
   storageKey:'jenios-admin-email-'+(++clientSequence)
  }});
  if(!client?.auth||typeof client.auth.setSession!=='function'||typeof client.auth.updateUser!=='function'||typeof client.auth.dispose!=='function')
   throw failure('ACCOUNT_AUTH_UNAVAILABLE');
  fence.assert();requireLifetime(session,now());
  const restored=await client.auth.setSession({access_token:session.access_token,refresh_token:session.refresh_token});
  fence.assert();if(restored?.error)throw failure('ACCOUNT_SESSION_REQUIRED');
  accountView(restored?.data?.user,session.user.id);
  if(restored?.data?.session?.access_token!==session.access_token||restored?.data?.session?.user?.id!==session.user.id)
   throw failure('ACCOUNT_IDENTITY_MISMATCH');
  await fence.verify(session);return {auth:client.auth,dispose};
 }catch(error){await dispose();throw error;}
}

export async function requestOwnAccountEmailChange(auth,{ownerId,email,confirmation,origin,signal,
 createClient,projectUrl,publishableKey,fetchImpl,now}={}){
 const normalized=normalizeAdminAccountEmail(email);
 if(normalized!==normalizeAdminAccountEmail(confirmation))throw failure('ACCOUNT_EMAIL_CONFIRMATION_MISMATCH');
 const redirect=emailRedirect(origin),fence=sessionFence(auth,signal);let bound=null;
 try{
  fence.assert();const session=await sessionSnapshot(auth);fence.assert();
  if(!uuid(ownerId)||ownerId!==session.user.id)throw failure('ACCOUNT_IDENTITY_MISMATCH');
  const account=await verifiedAccount(auth,session,fence);
  if(normalized===account.email)return {...account,status:'unchanged',requested:false};
  if(normalized===account.pendingEmail)return {...account,status:'pending',requested:false};
  requireLifetime(session,(now||Date.now)());
  bound=await createBoundEmailAuth({auth,session,signal:fence.signal,createClient,projectUrl,publishableKey,fetchImpl,now});
  await fence.verify(session);
  const result=await bound.auth.updateUser({email:normalized},{emailRedirectTo:redirect});
  fence.assert();if(result?.error)throw failure('ACCOUNT_EMAIL_UPDATE_FAILED');
  const updated=accountView(result?.data?.user,session.user.id);
  await fence.verify(session);
  if(updated.email===normalized&&!updated.pendingEmail)return {...updated,status:'changed',requested:true};
  if(updated.email===account.email&&updated.pendingEmail===normalized)return {...updated,status:'pending',requested:true};
  throw failure('ACCOUNT_RESPONSE_INVALID');
 }catch(error){
  fence.assert();if(error?.code&&Object.hasOwn(messages,error.code))throw error;
  throw failure('ACCOUNT_EMAIL_UPDATE_FAILED');
 }finally{try{await bound?.dispose();}finally{fence.close();}}
}
