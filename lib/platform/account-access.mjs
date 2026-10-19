/**
 * JENIOS Platform — identidade totalmente separada da Social.
 * Fluxos públicos só usam a chave publicável da instância Platform.
 * Nenhum segredo de servidor pode chegar ao navegador.
 */
import {sessionModeKey} from './diagnostic-client.mjs';
import {journalKey} from './simulation-journal.mjs';
import {simulationBalanceKey,simulationPauseKey} from './simulation-account.mjs';

export const isPlatformSignupEnabled=flag=>flag==='true';
export function validPlatformPassword(value){
 return typeof value==='string'&&value.length>=12&&value.length<=128
  &&/[a-z]/.test(value)&&/[A-Z]/.test(value)&&/[0-9]/.test(value)&&/[^A-Za-z0-9]/.test(value);
}
export function normalizedPlatformEmail(input){
 if(typeof input!=='string')throw Error('Informe um e-mail válido.');
 const email=input.trim().toLowerCase();
 if(email.length<5||email.length>254||!(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))
  throw Error('Informe um e-mail válido.');
 return email;
}
function platformAuth(auth){
 if(!auth)throw Error('Autenticação da Platform ainda não configurada.');
 return auth;
}
function redirectUrl(origin,path){
 const base=new URL(origin);
 if(!['https:','http:'].includes(base.protocol) ||
   (base.protocol==='http:'&&!['localhost','127.0.0.1'].includes(base.hostname)))
  throw Error('Origem de autenticação inválida.');
 return new URL(path,base.origin).toString();
}
export async function registerPlatformAccount(auth,email,password,confirmation,origin,allowed){
 platformAuth(auth);
 if(!isPlatformSignupEnabled(allowed))throw Error('Cadastros ainda não estão disponíveis.');
 const normalized=normalizedPlatformEmail(email);
 if(!validPlatformPassword(password))throw Error('Use 12–128 caracteres, com letras maiúsculas e minúsculas, número e símbolo.');
 if(password!==confirmation)throw Error('A confirmação da senha não corresponde.');
 const {data,error}=await auth.signUp({email:normalized,password,
   options:{emailRedirectTo:redirectUrl(origin,'/platform/entrar')}});
 if(error)throw Error('Não foi possível registrar o cadastro. Tente novamente ou entre em contato com o suporte.');
 return {session:!!data?.session,
   message:data?.session?'Cadastro confirmado. Você já pode entrar na Platform.'
   :'Se o cadastro estiver disponível, consulte seu e-mail para confirmar o acesso.'};
}
export async function requestPlatformPasswordReset(auth,email,origin){
 platformAuth(auth);
 const normalized=normalizedPlatformEmail(email);
 const {error}=await auth.resetPasswordForEmail(normalized,
   {redirectTo:redirectUrl(origin,'/platform/redefinir')});
 // Mensagem não permite deduzir quais endereços existem no Auth.
 if(error)throw Error('Não foi possível solicitar a redefinição. Aguarde e tente novamente.');
 return 'Se este endereço estiver cadastrado, você receberá as instruções de redefinição.';
}
export async function changePlatformPassword(auth,password,confirmation){
 platformAuth(auth);
 if(!validPlatformPassword(password))throw Error('Use 12–128 caracteres, com letras maiúsculas e minúsculas, número e símbolo.');
 if(password!==confirmation)throw Error('A confirmação da senha não corresponde.');
 const {data:identity,error:identityError}=await auth.getUser();
 if(identityError||!identity?.user?.id||identity.user.is_anonymous)
  throw Error('O link expirou ou sua sessão é inválida. Solicite uma nova redefinição.');
 const {error}=await auth.updateUser({password});
 if(error)throw Error('Não foi possível atualizar a senha. Solicite outro link.');
 return true;
}
export function clearPlatformLocalState(storage,userId){
 if(!userId||typeof userId!=='string'||!(/^[a-zA-Z0-9_-]{1,128}$/.test(userId)))return false;
 try{
  if(!storage?.removeItem)return false;
  for(const key of [sessionModeKey(userId),journalKey(userId),
    simulationBalanceKey(userId),simulationPauseKey(userId)])storage.removeItem(key);
  return true;
 }catch{return false;}
}
export async function signOutPlatform(auth,storage,userId){
 platformAuth(auth);
 const {error}=await auth.signOut();
 if(error)throw Error('Não foi possível encerrar a sessão da Platform.');
 clearPlatformLocalState(storage,userId);
 return true;
}
