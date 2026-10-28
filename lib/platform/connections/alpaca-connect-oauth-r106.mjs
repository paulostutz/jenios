/** Alpaca Connect for customer-owned accounts. Private server component only.
 * Exchanges one authorization code, seals the token in R83, verifies GETs.
 * No account creation, deposits, withdrawals or order execution.
 */
import {createHash,randomBytes} from 'node:crypto';
import {R106OAuthState} from './alpaca-connect-state-r106.mjs';
import {requireR83PrivateVaultGate} from './alpaca-live-vault-r83.mjs';
import {requireR82LiveReadOnlyGate} from './alpaca-live-readonly-r82.mjs';
import {stageR83PrivateLiveConnection,verifyR83PrivateLiveConnection,revokeR83PrivateLiveConnection} from './alpaca-live-private-worker-r83.mjs';
import {paperExecutionClock} from './paper-execution-freshness-r105.mjs';
const fail=code=>{throw Object.assign(new Error(code),{code});};
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const NONCE=/^[A-Za-z0-9_-]{43}$/;
const TOKEN=/^[\x21-\x7e]{20,4096}$/;
const hash=s=>createHash('sha256').update(s).digest('hex');
const exact=(v,fields)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join('|')===fields.slice().sort().join('|');
const CONFIRM='CONNECT_MY_ALPACA_LIVE_ACCOUNT_WITHOUT_CUSTODY';
export function requireR106AlpacaConnectConfiguration(env){
 if(env.JENIOS_R106_ALPACA_CONNECT_ENABLED!=='true'||env.VERCEL!==undefined||
    env.VERCEL_ENV!==undefined||env.NEXT_RUNTIME!==undefined||env.AWS_LAMBDA_FUNCTION_NAME!==undefined||
    env.JENIOS_R100_INERT_WORKER_ENABLED!=='false'||env.JENIOS_R104_PRIVATE_OPERATOR_ENABLED!=='false'||
    env.JENIOS_PRIVATE_PAPER_EXECUTOR!=='false'||env.JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED!=='false'||
    env.JENIOS_PAY_PAYMENTS_ENABLED!=='false'||env.JENIOS_INTER_CHARGES_ENABLED!=='false'||
    env.JENIOS_R83_ALPACA_THIRD_PARTY_APP_APPROVED!=='true')fail('R106_PRIVATE_CONNECT_DISABLED');
 requireR83PrivateVaultGate(env);requireR82LiveReadOnlyGate(env);
 const clientId=env.JENIOS_R106_ALPACA_CLIENT_ID,clientSecret=env.JENIOS_R106_ALPACA_CLIENT_SECRET;
 if(typeof clientId!=='string'||!/^[A-Za-z0-9_-]{16,128}$/.test(clientId)||
    typeof clientSecret!=='string'||!/^[\x21-\x7e]{16,256}$/.test(clientSecret))fail('R106_APP_CONFIG_REQUIRED');
 let redirect;
 try{redirect=new URL(env.JENIOS_R106_ALPACA_REDIRECT_URI);}catch{fail('R106_REDIRECT_CONFIG_REQUIRED');}
 // Server-owned exact redirect, explicitly registered with Alpaca; no caller URL.
 if(redirect.protocol!=='https:'||redirect.username||redirect.password||redirect.port||redirect.search||redirect.hash||
    !['jenios.com.br','www.jenios.com.br','connect.jenios.com.br'].includes(redirect.hostname)||
    redirect.pathname!=='/platform/integracoes/alpaca/retorno'||redirect.href!==env.JENIOS_R106_ALPACA_REDIRECT_URI)
  fail('R106_REDIRECT_CONFIG_REQUIRED');
 return {clientId,clientSecret,redirectUri:redirect.href,
  configHash:hash(JSON.stringify([clientId,redirect.href,'live','trading']))};
}
async function owner(db,accessToken){
 if(typeof accessToken!=='string'||!/^[A-Za-z0-9_.-]{20,4096}$/.test(accessToken)||!db?.auth?.getUser)
  fail('R106_PLATFORM_AUTH_REQUIRED');
 let result;try{result=await db.auth.getUser(accessToken);}catch{fail('R106_PLATFORM_AUTH_REQUIRED');}
 const u=result?.data?.user;
 if(result?.error||!UUID.test(u?.id||'')||u.is_anonymous===true||!u.email_confirmed_at)fail('R106_PLATFORM_AUTH_REQUIRED');
 return u.id;
}
function current(clock){const n=clock();if(!Number.isSafeInteger(n)||n<=0)fail('R106_CLOCK_INVALID');return n;}
export async function startR106AlpacaConnect(request,{db,env=process.env,clock=Date.now}={}){
 const config=requireR106AlpacaConnectConfiguration(env);
 if(!exact(request,['accessToken','consent'])||request.consent!==CONFIRM)fail('R106_CONNECT_CONSENT_REQUIRED');
 const user=await owner(db,request.accessToken),now=current(clock);
 const state=randomBytes(32).toString('base64url'),browserBinding=randomBytes(32).toString('base64url');
 const journal=new R106OAuthState(env.JENIOS_R106_PRIVATE_VOLUME);
 try{journal.create({stateHash:hash(state),owner:user,browserHash:hash(browserBinding),configHash:config.configHash,now});}
 finally{journal.close();}
 const url=new URL('https://app.alpaca.markets/oauth/authorize');
 url.search=new URLSearchParams({response_type:'code',client_id:config.clientId,redirect_uri:config.redirectUri,state,scope:'trading',env:'live'}).toString();
 // Host adapter MUST set this as an HttpOnly cookie, never expose its value in JSON.
 return Object.freeze({authorizationUrl:url.href,callbackCookie:Object.freeze({
  name:'__Host-jenios-alpaca-connect',value:browserBinding,httpOnly:true,secure:true,sameSite:'Lax',path:'/',maxAge:600}),
  expiresAtMs:now+600000,ordersEnabled:false,custody:false,withdrawals:false});
}
async function exchange(config,code,fetcher){
 let response;
 try{response=await fetcher('https://api.alpaca.markets/oauth/token',{
  method:'POST',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(10000),
  headers:{accept:'application/json','content-type':'application/x-www-form-urlencoded'},
  body:new URLSearchParams({grant_type:'authorization_code',code,client_id:config.clientId,
   client_secret:config.clientSecret,redirect_uri:config.redirectUri}).toString()});}
 catch{fail('R106_TOKEN_EXCHANGE_UNCONFIRMED');}
 if(!response?.ok||response.redirected)fail('R106_TOKEN_EXCHANGE_UNCONFIRMED');
 const reader=response.body?.getReader?.();if(!reader)fail('R106_TOKEN_RESPONSE_INVALID');
 let size=0;const chunks=[];
 try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;
  if(size>16384){await reader.cancel();fail('R106_TOKEN_RESPONSE_INVALID');}chunks.push(part.value);}}
 catch{fail('R106_TOKEN_RESPONSE_INVALID');}finally{reader.releaseLock();}
 let data;try{data=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{fail('R106_TOKEN_RESPONSE_INVALID');}
 if(!TOKEN.test(data?.access_token||'')||data?.token_type?.toLowerCase()!=='bearer'||data?.scope!=='trading')
  fail('R106_TOKEN_SCOPE_NOT_CONFIRMED');
 return data.access_token;
}
export async function finishR106AlpacaConnect(request,{db,env=process.env,clock=Date.now,fetcher=fetch}={}){
 const config=requireR106AlpacaConnectConfiguration(env);
 const denial=Object.hasOwn(request||{},'error');
 if(!exact(request,denial?['accessToken','state','browserBinding','error']:['accessToken','state','browserBinding','code'])||
    !NONCE.test(request.state||'')||!NONCE.test(request.browserBinding||'')||
    (denial?request.error!=='access_denied':typeof request.code!=='string'||!/^[A-Za-z0-9._~-]{8,2048}$/.test(request.code)))
  fail('R106_CALLBACK_INVALID');
 const user=await owner(db,request.accessToken),now=current(clock),tick=paperExecutionClock(now);
 const stateHash=hash(request.state),journal=new R106OAuthState(env.JENIOS_R106_PRIVATE_VOLUME);
 let connectionId=null,claimed=false;
 try{
  journal.claim({stateHash,owner:user,browserHash:hash(request.browserBinding),configHash:config.configHash,now});claimed=true;
  if(denial){journal.finish(stateHash,'DENIED');return Object.freeze({connected:false,denied:true,clearCookie:true,ordersEnabled:false});}
  const accessToken=await exchange(config,request.code,fetcher);
  const staged=await stageR83PrivateLiveConnection({accessToken:request.accessToken,
   consent:'I_AUTHORIZE_JENIOS_ALPACA_LIVE_READ_ONLY',credentials:{kind:'ALPACA_OAUTH_ACCESS_TOKEN',accessToken}},{db,env});
  connectionId=staged.id;
  const verified=await verifyR83PrivateLiveConnection({accessToken:request.accessToken,connectionId},{db,env,fetcher,clock:tick});
  journal.finish(stateHash,'COMPLETED',connectionId);
  return Object.freeze({connectionId,connected:true,accountReadConfirmed:verified.accountReadConfirmed,
   grantedScope:'trading',clearCookie:true,ordersEnabled:false,requiresSeparateRiskApproval:true,
   custody:false,withdrawals:false,ordersSent:0});
 }catch(error){
  if(connectionId)try{await revokeR83PrivateLiveConnection({accessToken:request.accessToken,connectionId},{db,env});}catch{}
  if(claimed)try{journal.finish(stateHash,'FAILED');}catch{}
  const allowed=['R106_STATE_INVALID_OR_CONSUMED','R106_TOKEN_EXCHANGE_UNCONFIRMED','R106_TOKEN_RESPONSE_INVALID','R106_TOKEN_SCOPE_NOT_CONFIRMED'];
  fail(allowed.includes(error?.code)?error.code:'R106_CONNECT_UNCONFIRMED');
 }finally{journal.close();}
}
