import {randomUUID} from 'node:crypto';
import {validateReversoSubscriptionInputV2,validateReversoSubscriptionViewV2} from './view-v2.mjs';
const keyValid=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{32,256}$/.test(v);
export async function readReversoSubscriptionJsonV2(response,limit=24000){
 if(!response.ok||!response.headers.get('content-type')?.includes('application/json')||!response.body)throw Error('REVERSO_SUBSCRIPTION_SOURCE_UNAVAILABLE');
 const reader=response.body.getReader(),chunks=[];let size=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();throw Error('REVERSO_SUBSCRIPTION_SOURCE_TOO_LARGE');}chunks.push(value);}}
 finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let at=0;for(const part of chunks){bytes.set(part,at);at+=part.length;}
 return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
}
/** No retry: uncertain mutations recover by original request key or order.
 * The original host/credential are reused; flags cannot enable real payments. */
export function createReversoSubscriptionRuntimeSourceV2({env={},fetchImpl=fetch,now=Date.now,timeoutMs=8000}={}){
 if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>30000)throw Error('REVERSO_SUBSCRIPTION_SOURCE_CONFIGURATION');
 return async({subject,input},{guard=async()=>{}}={})=>{
  if(env.REVERSO_SUBSCRIPTION_DEMO_ENABLED!=='true')return null;
  if(!keyValid(env.ULTRA_RUNTIME_SERVICE_KEY))throw Error('REVERSO_SUBSCRIPTION_SOURCE_CONFIGURATION');
  const origin=new URL(env.ULTRA_RUNTIME_ORIGIN);
  if(origin.protocol!=='https:'||origin.username||origin.password||origin.port||origin.pathname!=='/'||origin.search||origin.hash)throw Error('REVERSO_SUBSCRIPTION_SOURCE_CONFIGURATION');
  input=validateReversoSubscriptionInputV2(input);await guard();
  const nonce=randomUUID(),issuedAt=now();let timer;
  const task=(async()=>{
   const response=await fetchImpl(origin.origin+'/v1/reverso/subscription',{method:'POST',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(timeoutMs),
    headers:{Authorization:'Bearer '+env.ULTRA_RUNTIME_SERVICE_KEY,'Content-Type':'application/json'},
    body:JSON.stringify({schema:'REVERSO_SUBSCRIPTION_REQUEST_V2',platform:'jenios',robotId:'reverso',subject,nonce,issuedAt,input})});
   const value=await readReversoSubscriptionJsonV2(response);await guard();
   if(value.nonce!==nonce)throw Error('REVERSO_SUBSCRIPTION_SOURCE_CONTEXT_CHANGED');
   return validateReversoSubscriptionViewV2(value.view,{subject,now:now()});
  })();
  try{return await Promise.race([task,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('REVERSO_SUBSCRIPTION_SOURCE_UNCERTAIN')),timeoutMs);})]);}
  finally{clearTimeout(timer);}
 };
}
