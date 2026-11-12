/** R82 — isolated official Alpaca LIVE account preflight. GET ONLY.
 * No HTTP route, credential intake, order POST/CANCEL, balance changes or trade permission.
 * Called only by a separately authenticated PRIVATE Node worker.
 * Paper credentials, R77/R78/R79 approvals and R80 PAPER safety never authorize LIVE.
 */
import {createHmac} from 'node:crypto';

const BASE='https://api.alpaca.markets';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const SHA=/^[a-f0-9]{64}$/;
const KEY=/^[A-Za-z0-9_+/=-]{16,256}$/;
const OAUTH=/^[\x21-\x7e]{20,4096}$/;
const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&
 Object.keys(value).sort().join('|')===keys.slice().sort().join('|');
function authHeaders(credentials){
 if((exact(credentials,['apiKey','secret'])||
     exact(credentials,['kind','apiKey','secret'])&&credentials.kind==='ALPACA_API_KEY_PAIR')&&
    KEY.test(credentials.apiKey||'')&&KEY.test(credentials.secret||''))
  return {'APCA-API-KEY-ID':credentials.apiKey,
    'APCA-API-SECRET-KEY':credentials.secret};
 if(exact(credentials,['kind','accessToken'])&&
    credentials.kind==='ALPACA_OAUTH_ACCESS_TOKEN'&&OAUTH.test(credentials.accessToken||''))
  return {Authorization:'Bearer '+credentials.accessToken};
 deny('R82_LIVE_CREDENTIALS_INVALID');
}
const ACCOUNT=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/;
const deny=code=>{throw Object.assign(new Error(code),{code});};

export function requireR82LiveReadOnlyGate(env={}){
 if(env.JENIOS_R82_PRIVATE_NODE_WORKER!=='true'||
    env.JENIOS_R82_ALPACA_LIVE_READ_ENABLED!=='true'||
    env.JENIOS_REAL_EXECUTION_ENABLED!=='false'||
    env.JENIOS_R82_ALPACA_LIVE_ORDER_EXECUTION_ENABLED!=='false'||
    env.VERCEL_ENV==='production')deny('R82_LIVE_READ_DISABLED');
 return true;
}

function privateDigestKey(env){
 const raw=env.JENIOS_R82_LIVE_ACCOUNT_DIGEST_KEY_B64;
 if(typeof raw!=='string'||!/^[A-Za-z0-9+/]{43}=$/.test(raw))
  deny('R82_LIVE_PRIVATE_KEY_REQUIRED');
 const bytes=Buffer.from(raw,'base64');
 if(bytes.length!==32||bytes.toString('base64')!==raw)
  deny('R82_LIVE_PRIVATE_KEY_REQUIRED');
 return bytes;
}

function accountDigest(owner,accountId,env){
 return createHmac('sha256',privateDigestKey(env))
  .update('jenios-live-readonly-r82-v1\0'+owner+'\0'+accountId).digest('hex');
}

async function boundedGet(path,credentials,fetcher){
 if(!['/v2/account','/v2/clock'].includes(path))deny('R82_UNSUPPORTED_LIVE_READ');
 let response;
 try{
  response=await fetcher(BASE+path,{method:'GET',cache:'no-store',redirect:'error',
   signal:AbortSignal.timeout(10000),headers:{
    accept:'application/json',...authHeaders(credentials)}});
 }catch{deny('R82_LIVE_NETWORK_UNAVAILABLE');}
 if(response?.redirected||response?.ok!==true)
  deny('R82_LIVE_UPSTREAM_UNCONFIRMED');
 const reader=response.body?.getReader?.();
 if(!reader)deny('R82_LIVE_RESPONSE_INVALID');
 const chunks=[];let size=0;
 try{
  while(true){
   let p;try{p=await reader.read();}catch{deny('R82_LIVE_NETWORK_UNAVAILABLE');}
   if(p.done)break;
   size+=p.value.byteLength;
   if(size>65536){await reader.cancel();deny('R82_LIVE_RESPONSE_TOO_LARGE');}
   chunks.push(p.value);
  }
 }finally{reader.releaseLock();}
 try{
  const result=JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if(!result||typeof result!=='object'||Array.isArray(result))
   deny('R82_LIVE_RESPONSE_INVALID');
  return result;
 }catch{deny('R82_LIVE_RESPONSE_INVALID');}
}

/** The connection and credentials MUST come from a trusted LIVE-only vault.
 * This code intentionally does not create a live connection, sign consent or send orders.
 * A verified GET account read does not certify trading permission.
 */
export async function inspectR82AlpacaLiveReadOnly({
 session,storedLiveConnection,credentials,nowMs
},{env=process.env,fetcher=fetch}={}){
 requireR82LiveReadOnlyGate(env);
 const connection=storedLiveConnection;
 if(!Number.isSafeInteger(nowMs)||nowMs<=0||
    session?.authenticated!==true||!UUID.test(session.userId||'')||
    !UUID.test(connection?.id||'')||connection.user_id!==session.userId||
    connection.provider!=='alpaca'||connection.environment!=='live'||
    connection.status!=='active'||connection.identity_verified!==true||
    connection.source!=='JENIOS_PRIVATE_LIVE_VAULT_VERIFIED'||
    !SHA.test(connection.external_digest||''))
  deny('R82_LIVE_OWNER_ACCOUNT_NOT_VERIFIED');
 // A different, LIVE-specific private key is mandatory. No fallback to Demo/Social.
 privateDigestKey(env);
 authHeaders(credentials);
 const account=await boundedGet('/v2/account',credentials,fetcher);
 if(!ACCOUNT.test(account.id||'')||typeof account.status!=='string'||
    typeof account.trading_blocked!=='boolean')
  deny('R82_LIVE_ACCOUNT_RESPONSE_INVALID');
 if(accountDigest(session.userId,account.id,env)!==connection.external_digest)
  deny('R82_LIVE_ACCOUNT_CHANGED');
 const clock=await boundedGet('/v2/clock',credentials,fetcher);
 const observed=Date.parse(clock.timestamp||'');
 if(typeof clock.is_open!=='boolean'||!Number.isFinite(observed)||
    Math.abs(nowMs-observed)>60000)
  deny('R82_LIVE_MARKET_CLOCK_UNVERIFIED');
 return Object.freeze({
  schema:'JENIOS_R82_ALPACA_LIVE_READ_ONLY_V1',
  provider:'alpaca',environment:'live',officialTradingHost:'api.alpaca.markets',
  privateWorkerOnly:true,customerAccountVerified:true,
  accountActive:account.status==='ACTIVE',tradingBlocked:account.trading_blocked,
  marketOpen:clock.is_open,observedAtMs:nowMs,
  tradingPermissionsCertified:false,riskLimitsApproved:false,
  liveOrdersEnabled:false,ordersSent:0,custody:false,withdrawals:false,
  requiresSeparateLiveApproval:true,requiresIndependentSecurityReview:true
 });
}
/** No dynamic dispatch method is exported. Not even a disabled order POST helper. */

/** R83 — private-stage account binding: never returns the raw broker account ID.
 * Requires Platform identity checked independently by the private worker,
 * sealed credential read from service-only vault and fixed GET host.
 * A matching account GET is not permission to submit an order.
 */
export async function probeR82StagedAlpacaLiveAccount({
 session,stagedConnection,credentials,nowMs
},{env=process.env,fetcher=fetch}={}){
 requireR82LiveReadOnlyGate(env);
 const c=stagedConnection;
 if(!Number.isSafeInteger(nowMs)||nowMs<=0||
    session?.authenticated!==true||!UUID.test(session.userId||'')||
    !UUID.test(c?.id||'')||c.user_id!==session.userId||
    c.provider!=='alpaca'||c.environment!=='live'||
    c.status!=='STAGED'||c.identity_verified!==false||
    c.external_digest!==null||c.source!=='JENIOS_R83_PRIVATE_OWNER_AUTH')
  deny('R82_STAGED_LIVE_SCOPE_DENIED');
 privateDigestKey(env);
 authHeaders(credentials);
 const account=await boundedGet('/v2/account',credentials,fetcher);
 if(!ACCOUNT.test(account.id||'')||typeof account.status!=='string'||
    typeof account.trading_blocked!=='boolean')
  deny('R82_LIVE_ACCOUNT_RESPONSE_INVALID');
 const clock=await boundedGet('/v2/clock',credentials,fetcher);
 const timestamp=Date.parse(clock.timestamp||'');
 if(typeof clock.is_open!=='boolean'||!Number.isFinite(timestamp)||
    Math.abs(timestamp-nowMs)>60000)deny('R82_LIVE_MARKET_CLOCK_UNVERIFIED');
 return Object.freeze({brokerDigest:accountDigest(session.userId,account.id,env),
  accountActive:account.status==='ACTIVE',tradingBlocked:account.trading_blocked,
  marketOpen:clock.is_open,observedAtMs:nowMs,
  readOnly:true,liveExecution:false,ordersSent:0,withdrawals:false});
}
