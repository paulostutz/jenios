/** B158 private, test-account-only reader. Not imported by a web route.
 * The only outbound operations are Binance Testnet time/account GETs and Alpaca Paper account GET.
 * No URL input, live host, orders, transfers, persistence, retry or credential logging.
 */
import {createHmac} from 'node:crypto';
const fail=code=>{throw Object.assign(new Error(code),{code});};
function fields(x,keys){if(!x||typeof x!=='object'||Array.isArray(x)||Object.keys(x).some(k=>!keys.includes(k)))fail('INVALID_FIELDS');}
const decimal=s=>typeof s==='string'&&/^-?(?:0|[1-9]\d{0,20})(?:\.\d{1,18})?$/.test(s);
async function json(response){
 if(response.redirected||!response.ok){await response.body?.cancel();fail([401,403,429,451].includes(response.status)?'PROVIDER_'+response.status:'PROVIDER_REJECTED');}
 const reader=response.body?.getReader();if(!reader)fail('EMPTY_RESPONSE');
 const parts=[];let length=0;
 try{while(true){const part=await reader.read();if(part.done)break;length+=part.value.length;if(length>131072){await reader.cancel();fail('RESPONSE_TOO_LARGE');}parts.push(part.value);}}finally{reader.releaseLock();}
 try{return JSON.parse(Buffer.concat(parts).toString('utf8'));}catch{fail('INVALID_RESPONSE');}
}
export async function checkTestAccount(input,{fetcher=fetch,now=Date.now}={}){
 let provider=null;
 try{
  fields(input,['provider','environment','apiKey','secret','confirmation']);
  if(!['binance','alpaca'].includes(input.provider))fail('UNSUPPORTED_READER');provider=input.provider;
  if(input.confirmation!=='READ_TEST_ACCOUNT_ONLY')fail('EXPLICIT_READ_CONSENT_REQUIRED');
  if(input.environment!==(provider==='binance'?'testnet':'paper'))fail('LIVE_ACCOUNT_DISABLED');
  for(const k of ['apiKey','secret'])if(typeof input[k]!=='string'||!new RegExp('^[A-Za-z0-9_+/=-]{16,256}$').test(input[k]))fail('INVALID_CREDENTIAL_FORMAT');
  const signal=AbortSignal.timeout(10000);
  const get=async(url,headers={})=>json(await fetcher(url,{method:'GET',redirect:'error',cache:'no-store',signal,headers:{accept:'application/json',...headers}}));
  let summary;
  if(provider==='binance'){
   const clock=await get('https://testnet.binance.vision/api/v3/time');
   if(!Number.isSafeInteger(clock?.serverTime)||Math.abs(clock.serverTime-now())>30000)fail('CLOCK_NOT_VERIFIED');
   const query=new URLSearchParams({timestamp:String(clock.serverTime),recvWindow:'5000',omitZeroBalances:'true'}).toString();
   const signature=createHmac('sha256',input.secret).update(query).digest('hex');
   const account=await get('https://testnet.binance.vision/api/v3/account?'+query+'&signature='+signature,{'X-MBX-APIKEY':input.apiKey});
   if(account?.accountType!=='SPOT'||!Array.isArray(account.balances)||account.balances.length>1000||account.balances.some(b=>!b||typeof b.asset!=='string'||!/^[A-Z0-9]{1,24}$/.test(b.asset)||!decimal(b.free)||!decimal(b.locked)||b.free.startsWith('-')||b.locked.startsWith('-')))fail('INVALID_ACCOUNT_RESPONSE');
   // canWithdraw/canTrade describe the account, NOT a verified API-key permission audit.
   summary={accountType:'SPOT',assetsReported:account.balances.length,permissionsVerified:false};
  }else{
   const account=await get('https://paper-api.alpaca.markets/v2/account',{'APCA-API-KEY-ID':input.apiKey,'APCA-API-SECRET-KEY':input.secret});
   if(typeof account?.id!=='string'||!/^[a-zA-Z0-9-]{1,80}$/.test(account.id)||!['ACTIVE','ONBOARDING','SUBMITTED','ACTION_REQUIRED','APPROVAL_PENDING','APPROVED','REJECTED','DISABLED','ACCOUNT_CLOSED'].includes(account.status)||!decimal(account.cash)||!decimal(account.equity)||typeof account.trading_blocked!=='boolean')fail('INVALID_ACCOUNT_RESPONSE');
   summary={status:account.status,accountTradingBlocked:account.trading_blocked,permissionsVerified:false};
  }
  return {ok:true,provider,environment:input.environment,accountReadConfirmed:true,summary,linkedToJenios:false,liveExecution:false,ordersSent:0,credentialsStored:false};
 }catch(e){
  const allowed=['INVALID_FIELDS','UNSUPPORTED_READER','EXPLICIT_READ_CONSENT_REQUIRED','LIVE_ACCOUNT_DISABLED','INVALID_CREDENTIAL_FORMAT','EMPTY_RESPONSE','RESPONSE_TOO_LARGE','INVALID_RESPONSE','PROVIDER_401','PROVIDER_403','PROVIDER_429','PROVIDER_451','PROVIDER_REJECTED','CLOCK_NOT_VERIFIED','INVALID_ACCOUNT_RESPONSE'];
  return {ok:false,provider,code:allowed.includes(e.code)?e.code:'READ_UNCONFIRMED',accountReadConfirmed:false,linkedToJenios:false,liveExecution:false,ordersSent:0,credentialsStored:false};
 }
}
