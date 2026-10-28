/** Dedicated broker authorization service. No order endpoint or financial scheduler.
 * The browser submits its Platform token in a POST body, never in an URL.
 * OAuth return context exists only in an authenticated, encrypted HttpOnly cookie.
 */
import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
import {startR106AlpacaConnect,finishR106AlpacaConnect,requireR106AlpacaConnectConfiguration} from './alpaca-connect-oauth-r106.mjs';
import {revokeR83PrivateLiveConnection} from './alpaca-live-private-worker-r83.mjs';
import {verifyR94PrivateVolume} from './private-host-preflight-r94.mjs';
export const R107_ORIGIN='https://connect.jenios.com.br';
export const R107_CALLBACK='/platform/integracoes/alpaca/retorno';
const RETURN='https://jenios.com.br/integracoes?provider=alpaca';
const ORIGINS=new Set(['https://jenios.com.br','https://www.jenios.com.br','https://jenios-ecossistem-jenios.vercel.app']);
const BROWSER_COOKIE='__Host-jenios-alpaca-connect',SESSION_COOKIE='__Host-jenios-alpaca-session';
const TOKEN=/^[A-Za-z0-9_.-]{20,1800}$/;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const NONCE=/^[A-Za-z0-9_-]{43}$/;
const HEADERS={'Cache-Control':'no-store, max-age=0','Pragma':'no-cache','Referrer-Policy':'no-referrer',
 'X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY',
 'Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
 'Strict-Transport-Security':'max-age=31536000'};
const fail=(code,status=400)=>{throw Object.assign(Error(code),{code,status});};
const exact=(v,names)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join('|')===names.slice().sort().join('|');
const json=(body,status=200,headers={})=>Response.json(body,{status,headers:{...HEADERS,...headers}});
const cookie=(name,value,maxAge)=>`${name}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
function clear(headers){headers.append('Set-Cookie',cookie(BROWSER_COOKIE,'',0));headers.append('Set-Cookie',cookie(SESSION_COOKIE,'',0));}
function now(clock){const n=clock();if(!Number.isSafeInteger(n)||n<=0)fail('R107_CLOCK_INVALID',503);return n;}
export function requireR107HttpConfiguration(env){
 if(env.JENIOS_R107_CONNECT_HTTP_ENABLED!=='true'||env.JENIOS_R107_PUBLIC_ORIGIN!==R107_ORIGIN||
    env.JENIOS_R103_PRIVATE_PAPER_CANCEL_ENABLED!=='false'||env.JENIOS_R80_PRIVATE_ISSUER_ENABLED!=='false')
  fail('R107_CONNECT_UNAVAILABLE',503);
 const config=requireR106AlpacaConnectConfiguration(env);
 if(config.redirectUri!==R107_ORIGIN+R107_CALLBACK)fail('R107_CALLBACK_CONFIGURATION_REQUIRED',503);
 // Validate every key before the listener or health endpoint reports readiness.
 // Otherwise OAuth could consume a code before discovering an unusable vault.
 const keys=[env.JENIOS_R83_LIVE_VAULT_KEY_B64,env.JENIOS_R82_LIVE_ACCOUNT_DIGEST_KEY_B64,
  env.JENIOS_R107_BROWSER_SESSION_KEY_B64];
 if(keys.some(value=>typeof value!=='string'||!/^[A-Za-z0-9+/]{43}=$/.test(value)||
    Buffer.from(value,'base64').length!==32||Buffer.from(value,'base64').toString('base64')!==value)||
    new Set(keys).size!==3||keys[0]===env.JENIOS_DEMO_VAULT_KEY_B64||
    !/^[a-z][a-z0-9-]{0,31}$/.test(env.JENIOS_R83_LIVE_VAULT_KEY_ID||''))
  fail('R107_CRYPTO_CONFIGURATION_REQUIRED',503);
 const raw=env.JENIOS_R107_BROWSER_SESSION_KEY_B64;
 verifyR94PrivateVolume(env.JENIOS_R106_PRIVATE_VOLUME);
 return {sessionKey:Buffer.from(raw,'base64')};
}
function seal(payload,key){
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);
 cipher.setAAD(Buffer.from('JENIOS_R107_BROWSER_V1|'+R107_ORIGIN+R107_CALLBACK));
 const data=Buffer.concat([cipher.update(JSON.stringify(payload),'utf8'),cipher.final()]);
 return Buffer.concat([iv,cipher.getAuthTag(),data]).toString('base64url');
}
function open(value,key,time){
 if(typeof value!=='string'||!/^[A-Za-z0-9_-]{80,3400}$/.test(value))fail('R107_BROWSER_SESSION_REQUIRED',401);
 try{
  const bytes=Buffer.from(value,'base64url'),decipher=createDecipheriv('aes-256-gcm',key,bytes.subarray(0,12));
  decipher.setAuthTag(bytes.subarray(12,28));decipher.setAAD(Buffer.from('JENIOS_R107_BROWSER_V1|'+R107_ORIGIN+R107_CALLBACK));
  const data=JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)),decipher.final()]).toString('utf8'));
  if(!exact(data,['accessToken','state','binding','createdAt','expiresAt'])||!TOKEN.test(data.accessToken)||
     !NONCE.test(data.state)||!NONCE.test(data.binding)||!Number.isSafeInteger(data.createdAt)||
     !Number.isSafeInteger(data.expiresAt)||data.expiresAt-data.createdAt!==600000||
     time<data.createdAt||time>=data.expiresAt)throw Error();
  return data;
 }catch{fail('R107_BROWSER_SESSION_REQUIRED',401);}
}
function cookies(request){
 const header=request.headers.get('cookie')||'';if(header.length>5000)fail('R107_BROWSER_SESSION_REQUIRED',401);
 const result={};
 for(const entry of header.split(';')){
  const index=entry.indexOf('=');if(index<1)continue;
  const name=entry.slice(0,index).trim(),value=entry.slice(index+1).trim();
  if(![BROWSER_COOKIE,SESSION_COOKIE].includes(name))continue;
  if(Object.hasOwn(result,name))fail('R107_BROWSER_SESSION_REQUIRED',401);result[name]=value;
 }
 return result;
}
async function body(request,type){
 if(!(type==='form'?/^application\/x-www-form-urlencoded(?:;|$)/i:/^application\/json(?:;|$)/i).test(request.headers.get('content-type')||''))fail('R107_CONTENT_TYPE_REQUIRED',415);
 if(Number(request.headers.get('content-length')||0)>6000)fail('R107_REQUEST_TOO_LARGE',413);
 const reader=request.body?.getReader();if(!reader)fail('R107_BODY_REQUIRED');let size=0;const chunks=[];
 try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;
  if(size>6000){await reader.cancel();fail('R107_REQUEST_TOO_LARGE',413);}chunks.push(part.value);}}
 finally{reader.releaseLock();}
 const text=Buffer.concat(chunks).toString('utf8');
 if(type==='form'){
  const params=new URLSearchParams(text);if([...params.keys()].some(k=>params.getAll(k).length!==1))fail('R107_INVALID_REQUEST');
  return Object.fromEntries(params);
 }
 try{return JSON.parse(text);}catch{fail('R107_INVALID_REQUEST');}
}
function allowedOrigin(request){
 const origin=request.headers.get('origin');if(!ORIGINS.has(origin))fail('R107_ORIGIN_DENIED',403);return origin;
}
async function owner(db,token,clock){
 if(!TOKEN.test(token||''))fail('R107_PLATFORM_AUTH_REQUIRED',401);
 let result;try{result=await db.auth.getUser(token);}catch{fail('R107_PLATFORM_AUTH_REQUIRED',401);}
 const u=result?.data?.user;if(result?.error||!UUID.test(u?.id||'')||u.is_anonymous===true||!u.email_confirmed_at)fail('R107_PLATFORM_AUTH_REQUIRED',401);
 // Decode claims only AFTER the Auth server verifies this exact JWT. getUser
 // alone does not establish that a logged-out session still exists.
 let claims;
 try{const parts=token.split('.');if(parts.length!==3)throw Error();claims=JSON.parse(Buffer.from(parts[1],'base64url').toString('utf8'));}
 catch{fail('R107_PLATFORM_AUTH_REQUIRED',401);}
 if(claims.sub!==u.id||!UUID.test(claims.session_id||'')||!Number.isSafeInteger(claims.exp)||claims.exp*1000<=now(clock))fail('R107_PLATFORM_AUTH_REQUIRED',401);
 let active;try{active=await db.rpc('jenios_r107_session_is_active',{p_owner_user_id:u.id,p_session_id:claims.session_id});}
 catch{fail('R107_PLATFORM_AUTH_REQUIRED',401);}
 if(active?.error||active?.data!==true)fail('R107_PLATFORM_AUTH_REQUIRED',401);
 return u.id;
}
function bearer(request){
 const match=/^Bearer ([A-Za-z0-9_.-]{20,1800})$/.exec(request.headers.get('authorization')||'');
 if(!match)fail('R107_PLATFORM_AUTH_REQUIRED',401);return match[1];
}
async function list(db,user,page){
 let result;try{result=await db.from('jenios_robot_live_connections_r83')
  .select('id,owner_user_id,provider,environment,status,identity_verified,last_sync_at,revision')
  .eq('owner_user_id',user).eq('provider','alpaca').eq('environment','live')
  .order('created_at',{ascending:false}).order('id',{ascending:false}).range(page*20,page*20+20);}catch{fail('R107_CONNECTIONS_UNAVAILABLE',503);}
 if(result?.error||!Array.isArray(result?.data))fail('R107_CONNECTIONS_UNAVAILABLE',503);
 if(result.data.length>21)fail('R107_CONNECTIONS_UNAVAILABLE',503);
 const connections=result.data.slice(0,20).map(row=>{
  if(row.owner_user_id!==user||row.provider!=='alpaca'||row.environment!=='live'||!UUID.test(row.id||'')||
     !['STAGED','READ_VERIFIED','REVOKED'].includes(row.status)||!Number.isSafeInteger(row.revision)||row.revision<1||
     typeof row.identity_verified!=='boolean'||row.status==='READ_VERIFIED'&&(!row.identity_verified||!Number.isFinite(Date.parse(row.last_sync_at||''))))
   fail('R107_CONNECTIONS_UNAVAILABLE',503);
  return {id:row.id,status:row.status,provider:'alpaca',environment:'live',
   accountReadConfirmed:row.status==='READ_VERIFIED'&&row.identity_verified,
   lastReadAt:row.status==='READ_VERIFIED'?row.last_sync_at:null,ordersEnabled:false,
   providerRevocationRequired:row.status==='REVOKED'};
 });
 return {connections,nextPage:result.data.length>20?page+1:null};
}
const known=new Set(['R107_CONNECT_UNAVAILABLE','R107_CALLBACK_CONFIGURATION_REQUIRED','R107_CRYPTO_CONFIGURATION_REQUIRED','R107_CLOCK_INVALID',
 'R107_ORIGIN_DENIED','R107_PLATFORM_AUTH_REQUIRED','R107_BROWSER_SESSION_REQUIRED','R107_CONTENT_TYPE_REQUIRED','R107_BODY_REQUIRED',
 'R107_REQUEST_TOO_LARGE','R107_INVALID_REQUEST','R107_CONNECTIONS_UNAVAILABLE','R107_CONNECTION_LIMIT_REQUIRES_SUPPORT',
 'R106_STATE_INVALID_OR_CONSUMED','R106_CONNECT_RATE_LIMIT','R106_TOKEN_EXCHANGE_UNCONFIRMED','R106_TOKEN_SCOPE_NOT_CONFIRMED']);
export async function alpacaConnectHttpR107(request,{env=process.env,db,clock=Date.now,fetcher=fetch}={}){
 let callback=false,cors={};
 try{
  const url=new URL(request.url);callback=url.pathname===R107_CALLBACK;
  if(url.origin!==R107_ORIGIN||url.username||url.password||url.hash||url.href.length>4096)fail('R107_INVALID_REQUEST');
  const {sessionKey}=requireR107HttpConfiguration(env);
  if(url.pathname==='/healthz'&&request.method==='GET'&&!url.search)return json({ok:true,configurationReady:true,externalAccountVerified:false,ordersEnabled:false});
  if(request.method==='OPTIONS'&&['/connections','/disconnect'].includes(url.pathname)&&!url.search){
   const origin=allowedOrigin(request);
   if(request.headers.get('access-control-request-method')!=='POST'||
      (request.headers.get('access-control-request-headers')||'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean).some(s=>!['authorization','content-type'].includes(s)))fail('R107_ORIGIN_DENIED',403);
   return new Response(null,{status:204,headers:{...HEADERS,'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'POST','Access-Control-Allow-Headers':'Authorization, Content-Type','Vary':'Origin'}});
  }
  if(request.method==='POST'&&url.pathname==='/connect/alpaca/start'&&!url.search){
   allowedOrigin(request);const input=await body(request,'form');
   if(!exact(input,['accessToken','consent'])||!TOKEN.test(input.accessToken)||input.consent!=='CONNECT_MY_ALPACA_LIVE_ACCOUNT_WITHOUT_CUSTODY')fail('R107_INVALID_REQUEST');
   await owner(db,input.accessToken,clock);
   const start=await startR106AlpacaConnect(input,{db,env,clock});
   const state=new URL(start.authorizationUrl).searchParams.get('state'),createdAt=start.expiresAtMs-600000;
   const encrypted=seal({accessToken:input.accessToken,state,binding:start.callbackCookie.value,createdAt,expiresAt:start.expiresAtMs},sessionKey);
   const headers=new Headers({...HEADERS,Location:start.authorizationUrl});
   headers.append('Set-Cookie',cookie(BROWSER_COOKIE,start.callbackCookie.value,600));
   headers.append('Set-Cookie',cookie(SESSION_COOKIE,encrypted,600));
   return new Response(null,{status:303,headers});
  }
  if(callback&&request.method==='GET'){
   const params=url.searchParams,denial=params.has('error');
   if([...params.keys()].some(k=>params.getAll(k).length!==1)||
      !exact(Object.fromEntries(params),denial?['state','error']:['state','code']))fail('R107_INVALID_REQUEST');
   const jar=cookies(request),context=open(jar[SESSION_COOKIE],sessionKey,now(clock));
   if(context.state!==params.get('state')||context.binding!==jar[BROWSER_COOKIE])fail('R107_BROWSER_SESSION_REQUIRED',401);
   await owner(db,context.accessToken,clock);
   const result=await finishR106AlpacaConnect({accessToken:context.accessToken,state:context.state,browserBinding:jar[BROWSER_COOKIE],
    ...(denial?{error:params.get('error')}:{code:params.get('code')})},{db,env,clock,fetcher});
   const headers=new Headers({...HEADERS,Location:RETURN+'&connectResult='+(result.denied?'denied':'returned')});clear(headers);
   return new Response(null,{status:303,headers});
  }
  if(request.method==='POST'&&['/connections','/disconnect'].includes(url.pathname)&&!url.search){
   cors={'Access-Control-Allow-Origin':allowedOrigin(request),'Vary':'Origin'};
   const token=bearer(request),user=await owner(db,token,clock),input=await body(request,'json');
   if(url.pathname==='/connections'){
    if(!exact(input,[])&&!exact(input,['page']))fail('R107_INVALID_REQUEST');
    const page=input.page??0;if(!Number.isSafeInteger(page)||page<0||page>10000)fail('R107_INVALID_REQUEST');
    return json({ok:true,...await list(db,user,page),ordersEnabled:false},200,cors);
   }
   if(!exact(input,['connectionId','confirmation'])||!UUID.test(input.connectionId||'')||input.confirmation!=='REVOKE_LOCAL_ALPACA_CONNECTION')fail('R107_INVALID_REQUEST');
   const result=await revokeR83PrivateLiveConnection({accessToken:token,connectionId:input.connectionId},{db,env});
   return json({ok:true,...result,ordersEnabled:false},200,cors);
  }
  return json({ok:false,code:'R107_ROUTE_UNAVAILABLE',ordersEnabled:false},404);
 }catch(error){
  const code=known.has(error?.code)?error.code:'R107_CONNECT_UNAVAILABLE';
  if(callback){const headers=new Headers({...HEADERS,Location:RETURN+'&connectResult=unconfirmed'});clear(headers);return new Response(null,{status:303,headers});}
  return json({ok:false,code,ordersEnabled:false},Number.isInteger(error?.status)?error.status:503,cors);
 }
}
