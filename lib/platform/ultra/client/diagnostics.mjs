import {createHmac} from 'node:crypto';
export const BINANCE_ORIGINS=Object.freeze({demo:'https://demo-fapi.binance.com',live:'https://fapi.binance.com'});
/** Local read-only diagnostics. No key, signature, account balance or raw upstream error is returned. */
export async function inspectBinance({environment,apiKey,apiSecret,fetchImpl=fetch,now=Date.now}){
 const origin=BINANCE_ORIGINS[environment];
 if(!origin||typeof apiKey!=='string'||!apiKey||typeof apiSecret!=='string'||!apiSecret)throw Error('LOCAL_BINANCE_CREDENTIALS_REQUIRED');
 async function get(path,query='',signed=false){
  const response=await fetchImpl(origin+path+(query?'?'+query:''),{method:'GET',redirect:'error',signal:AbortSignal.timeout(10000),headers:signed?{'X-MBX-APIKEY':apiKey}:{}});
  if(!response.ok)throw Error(response.status===401||response.status===403?'BINANCE_PERMISSION_OR_REGION':'BINANCE_UNAVAILABLE');
  return response.json();
 }
 try{
  const clock=await get('/fapi/v1/time');
  if(!Number.isSafeInteger(clock.serverTime)||Math.abs(clock.serverTime-now())>60000)throw Error('LOCAL_CLOCK_REVIEW_REQUIRED');
  const params=new URLSearchParams({timestamp:String(clock.serverTime),recvWindow:'5000'});
  const signature=createHmac('sha256',apiSecret).update(params.toString()).digest('hex');
  const query=params+'&signature='+signature;
  const [account,configuration]=await Promise.all([get('/fapi/v3/account',query,true),get('/fapi/v1/accountConfig',query,true)]);
  if(typeof configuration.canTrade!=='boolean'||!Array.isArray(account.assets)||!Array.isArray(account.positions))throw Error('BINANCE_ACCOUNT_RESPONSE_INVALID');
  return {provider:'binance',environment,connected:true,readOnlyDiagnostic:true,tradingPermission:configuration.canTrade,
   currencies:[...new Set(account.assets.map(x=>x.asset).filter(x=>/^[A-Z0-9]{2,12}$/.test(x)))],
   executionAvailable:false,reason:'FUTURES_EXECUTOR_AND_RECONCILIATION_PENDING'};
 }catch(e){
  const safe=['LOCAL_CLOCK_REVIEW_REQUIRED','BINANCE_ACCOUNT_RESPONSE_INVALID','BINANCE_PERMISSION_OR_REGION','BINANCE_UNAVAILABLE'];
  throw Error(safe.includes(e?.message)?e.message:'BINANCE_DIAGNOSTIC_FAILED');
 }
}
