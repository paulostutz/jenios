import {createBoundEmailAuth,loadOwnAccountEmail,normalizeAdminAccountEmail} from './admin-account.mjs';

const messages={
 PASSWORD_INVALID:'Use uma senha de 12 a 128 caracteres, com maiúsculas, minúsculas, números e símbolos.',
 PASSWORD_CONFIRMATION_MISMATCH:'As senhas precisam ser iguais.',
 RECOVERY_CONTEXT_INVALID:'Não foi possível identificar o acesso solicitado.',
 RECOVERY_REDIRECT_INVALID:'Não foi possível validar o endereço de retorno.',
 RECOVERY_AUTH_UNAVAILABLE:'Serviço de acesso indisponível. Tente novamente mais tarde.',
 RECOVERY_SESSION_REQUIRED:'O link é inválido ou expirou. Solicite um novo link.',
 RECOVERY_IDENTITY_MISMATCH:'A conta da sessão mudou. Abra novamente o link de recuperação da conta desejada.',
 RECOVERY_REQUEST_FAILED:'Não foi possível solicitar a recuperação agora. Tente novamente mais tarde.',
 RECOVERY_PASSWORD_UPDATE_FAILED:'Não foi possível confirmar a alteração da senha. Solicite um novo link e tente novamente.',
 RECOVERY_RATE_LIMITED:'Aguarde alguns minutos antes de tentar novamente.',
 SESSION_CHANGED:'Sua sessão mudou. Abra novamente o link de recuperação da conta desejada.',
 OPERATION_ABORTED:'A operação foi interrompida.'
};
const failure=code=>Object.assign(new Error(messages[code]),{code,
 ...(['SESSION_CHANGED','OPERATION_ABORTED'].includes(code)?{name:'AbortError'}:{})});
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
const publicMessage='Se houver uma conta para este e-mail, você receberá um link para redefinir sua senha. Confira também a pasta de spam.';
const checkSignal=signal=>{if(signal?.aborted)throw failure('OPERATION_ABORTED');};

export function recoveryPaths(admin=false){
 if(typeof admin!=='boolean')throw failure('RECOVERY_CONTEXT_INVALID');
 return Object.freeze(admin
  ?{request:'/admin/recuperar-senha',reset:'/admin/redefinir-senha',login:'/admin/login'}
  :{request:'/recuperar-senha',reset:'/redefinir-senha',login:'/login'});
}
function recoveryRedirect(origin,path){
 let base;try{base=new URL(origin);}catch{throw failure('RECOVERY_REDIRECT_INVALID');}
 if(base.username||base.password||base.pathname!=='/'||base.search||base.hash||
  !(base.protocol==='https:'||(base.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(base.hostname))))
  throw failure('RECOVERY_REDIRECT_INVALID');
 return base.origin+path;
}
export function validateRecoveryPassword(password,confirmation){
 if(typeof password!=='string'||password.length<12||password.length>128||
  !/[A-Z]/.test(password)||!/[a-z]/.test(password)||!/[0-9]/.test(password)||!/[^A-Za-z0-9]/.test(password))
  throw failure('PASSWORD_INVALID');
 if(password!==confirmation)throw failure('PASSWORD_CONFIRMATION_MISMATCH');
 return true;
}

/** Public first access: a visitor may request a link without an existing session. */
export async function requestPasswordRecovery(auth,{email,origin,admin=false,signal}={}){
 const paths=recoveryPaths(admin),normalized=normalizeAdminAccountEmail(email);
 const redirectTo=recoveryRedirect(origin,paths.reset);checkSignal(signal);
 if(typeof auth?.resetPasswordForEmail!=='function')throw failure('RECOVERY_AUTH_UNAVAILABLE');
 try{
  const result=await auth.resetPasswordForEmail(normalized,{redirectTo});checkSignal(signal);
  if(!result||typeof result!=='object'||result.error){
   if(result?.error?.status===429)throw failure('RECOVERY_RATE_LIMITED');
   throw failure('RECOVERY_REQUEST_FAILED');
  }
  return {requested:true,message:publicMessage,loginPath:paths.login};
 }catch(error){
  checkSignal(signal);
  if(error?.code==='RECOVERY_RATE_LIMITED'||error?.code==='RECOVERY_REQUEST_FAILED')throw error;
  throw failure(error?.status===429?'RECOVERY_RATE_LIMITED':'RECOVERY_REQUEST_FAILED');
 }
}
export async function loadPasswordRecoveryIdentity(auth,{signal}={}){
 const account=await loadOwnAccountEmail(auth,{signal});
 return {id:account.id,email:account.email};
}

function recoveryFence(auth,signal){
 if(!auth||typeof auth.getSession!=='function'||typeof auth.getUser!=='function'||typeof auth.onAuthStateChange!=='function')
  throw failure('RECOVERY_AUTH_UNAVAILABLE');
 const controller=new AbortController();let subscription=null,reason=null,closed=false;
 const externalAbort=()=>invalidate('OPERATION_ABORTED');
 const cleanup=()=>{signal?.removeEventListener('abort',externalAbort);subscription?.data?.subscription?.unsubscribe?.();subscription=null;};
 function invalidate(code){if(!reason){reason=failure(code);controller.abort();cleanup();}}
 subscription=auth.onAuthStateChange(event=>{if(event!=='INITIAL_SESSION')invalidate('SESSION_CHANGED');});
 signal?.addEventListener('abort',externalAbort,{once:true});
 if(signal?.aborted)externalAbort();if(reason)cleanup();
 return {signal:controller.signal,
  assert(){if(reason)throw reason;if(closed)throw failure('OPERATION_ABORTED');},
  invalidate,
  close(){if(closed)return;closed=true;controller.abort();cleanup();}
 };
}
async function snapshot(auth,fence){
 fence.assert();let result;
 try{result=await auth.getSession();}catch{fence.assert();throw failure('RECOVERY_SESSION_REQUIRED');}
 fence.assert();const session=result?.data?.session;
 if(result?.error||!uuid(session?.user?.id)||session.user.is_anonymous||typeof session.access_token!=='string'||!session.access_token)
  throw failure('RECOVERY_SESSION_REQUIRED');
 return {...session,user:{id:session.user.id}};
}
async function verifySameSession(auth,session,fence){
 const current=await snapshot(auth,fence);
 if(current.user.id!==session.user.id||current.access_token!==session.access_token)fence.invalidate('SESSION_CHANGED');
 fence.assert();
}

export async function changeRecoveredPassword(auth,{ownerId,password,confirmation,admin=false,signal,
 createClient,projectUrl,publishableKey,fetchImpl,now}={}){
 validateRecoveryPassword(password,confirmation);
 const paths=recoveryPaths(admin),fence=recoveryFence(auth,signal);let bound=null;
 try{
  const session=await snapshot(auth,fence);
  if(!uuid(ownerId)||session.user.id!==ownerId)throw failure('RECOVERY_IDENTITY_MISMATCH');
  let verified;
  try{verified=await auth.getUser(session.access_token);}catch{fence.assert();throw failure('RECOVERY_SESSION_REQUIRED');}
  fence.assert();if(verified?.error)throw failure('RECOVERY_SESSION_REQUIRED');
  if(verified?.data?.user?.id!==ownerId||verified.data.user.is_anonymous)throw failure('RECOVERY_IDENTITY_MISMATCH');
  await verifySameSession(auth,session,fence);
  bound=await createBoundEmailAuth({auth,session,signal:fence.signal,createClient,projectUrl,publishableKey,fetchImpl,now});
  await verifySameSession(auth,session,fence);
  const result=await bound.auth.updateUser({password});
  fence.assert();
  if(result?.error)throw failure(result.error.status===429?'RECOVERY_RATE_LIMITED':'RECOVERY_PASSWORD_UPDATE_FAILED');
  if(result?.data?.user?.id!==ownerId||result.data.user.is_anonymous)throw failure('RECOVERY_IDENTITY_MISMATCH');
  await verifySameSession(auth,session,fence);
  return {id:ownerId,status:'changed',loginPath:paths.login};
 }catch(error){
  fence.assert();
  if(error?.code&&(Object.hasOwn(messages,error.code)||error.code.startsWith('ACCOUNT_')))throw error;
  throw failure('RECOVERY_PASSWORD_UPDATE_FAILED');
 }finally{try{await bound?.dispose();}finally{fence.close();}}
}
