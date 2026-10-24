import {createHmac,randomUUID,timingSafeEqual} from 'node:crypto';
import {conversationError,validConversationId} from './conversation-contract.mjs';

export const CONVERSATION_VISITOR_COOKIE='__Host-jenios-assistant-session';
const DAY=86400000;
const signature=(data,key)=>createHmac('sha256',key).update('jenios-assistant-session-v1.'+data).digest('base64url');
function secret(env){
 const key=env?.JENIOS_ASSISTANT_SESSION_SECRET;
 if(typeof key!=='string'||Buffer.byteLength(key)<32||Buffer.byteLength(key)>4096)
  throw conversationError('O histórico de visitantes aguarda configuração.',503,'CONVERSATION_SESSION_UNAVAILABLE');
 return key;
}
export function verifyConversationVisitorCookie(value,env,now=Date.now()){
 const key=secret(env);
 if(typeof value!=='string'||value.length>600||!Number.isSafeInteger(now))return null;
 const [body,sig,...extra]=value.split('.');
 if(extra.length||!body||!sig||!/^[A-Za-z0-9_-]{43}$/.test(sig)||!/^[A-Za-z0-9_-]+$/.test(body))return null;
 const expected=Buffer.from(signature(body,key)),received=Buffer.from(sig);
 if(expected.length!==received.length||!timingSafeEqual(expected,received))return null;
 let payload;try{payload=JSON.parse(Buffer.from(body,'base64url').toString('utf8'));}catch{return null;}
 if(!payload||Object.keys(payload).some(k=>!['v','id','issuedAt','expiresAt'].includes(k))||payload.v!==1||
  !validConversationId(payload.id)||!Number.isSafeInteger(payload.issuedAt)||!Number.isSafeInteger(payload.expiresAt)||
  payload.issuedAt>now+60000||payload.expiresAt!==payload.issuedAt+DAY||payload.expiresAt<=now)return null;
 return Object.freeze({id:payload.id,issuedAt:payload.issuedAt,expiresAt:payload.expiresAt});
}
export function createConversationVisitorCookie(env,now=Date.now(),id=randomUUID()){
 const key=secret(env);
 if(!validConversationId(id)||!Number.isSafeInteger(now))throw conversationError('Sessão de atendimento inválida.');
 const payload={v:1,id,issuedAt:now,expiresAt:now+DAY},encoded=Buffer.from(JSON.stringify(payload)).toString('base64url');
 const value=encoded+'.'+signature(encoded,key);
 return {id,value,expiresAt:payload.expiresAt,setCookie:`${CONVERSATION_VISITOR_COOKIE}=${value}; Path=/; Max-Age=86400; HttpOnly; Secure; SameSite=Lax`};
}
function readCookie(request){
 const header=request.headers.get('cookie')||'';
 if(header.length>16384)return null;
 const matches=header.split(';').map(x=>x.trim()).filter(x=>x.startsWith(CONVERSATION_VISITOR_COOKIE+'='));
 return matches.length===1?matches[0].slice(CONVERSATION_VISITOR_COOKIE.length+1):null;
}
/** A present invalid Bearer token is an auth failure, never a visitor identity. */
export async function resolveConversationActor(request,{db,env=process.env,now=Date.now(),allowVisitor=true}={}){
 const authorization=request.headers.get('authorization');
 if(authorization!==null){
  const token=/^Bearer ([^\s]+)$/i.exec(authorization)?.[1];
  if(!token||token.length>8192)throw conversationError('Sessão inválida. Entre novamente.',401,'CONVERSATION_AUTH_REQUIRED');
  if(!db?.auth?.getUser)throw conversationError('Não foi possível verificar sua sessão.',503,'CONVERSATION_AUTH_UNAVAILABLE');
  let response;try{response=await db.auth.getUser(token);}catch{throw conversationError('Não foi possível verificar sua sessão.',503,'CONVERSATION_AUTH_UNAVAILABLE');}
  const user=response?.data?.user;
  if(response?.error||!validConversationId(user?.id)||user.is_anonymous===true)
   throw conversationError('Sessão inválida. Entre novamente.',401,'CONVERSATION_AUTH_REQUIRED');
  return Object.freeze({kind:'user',ownerId:user.id,userId:user.id,user,setCookie:null});
 }
 if(!allowVisitor)throw conversationError('Entre na sua conta para usar este histórico.',401,'CONVERSATION_AUTH_REQUIRED');
 const found=verifyConversationVisitorCookie(readCookie(request),env,now);
 if(found)return Object.freeze({kind:'visitor',ownerId:found.id,userId:null,user:null,setCookie:null});
 const created=createConversationVisitorCookie(env,now);
 return Object.freeze({kind:'visitor',ownerId:created.id,userId:null,user:null,setCookie:created.setCookie});
}
