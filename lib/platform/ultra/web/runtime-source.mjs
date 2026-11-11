import {randomUUID,timingSafeEqual} from 'node:crypto';
import {Buffer} from 'node:buffer';
import {validateOwnerState} from './state-contract.mjs';
const keyValid=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{32,256}$/.test(v);
function settings(env){
 if(env.ULTRA_RUNTIME_ENABLED!=='true')return null;
 try{const u=new URL(env.ULTRA_RUNTIME_ORIGIN);if(u.protocol!=='https:'||u.username||u.password||u.port||u.pathname!=='/'||u.search||u.hash||!keyValid(env.ULTRA_RUNTIME_SERVICE_KEY))return null;return {origin:u.origin,key:env.ULTRA_RUNTIME_SERVICE_KEY};}catch{return null}
}
async function bounded(response,limit=500000){
 if(!response.ok||!response.headers.get('content-type')?.includes('application/json')||!response.body)throw Error('ULTRA_SOURCE_UNAVAILABLE');
 const reader=response.body.getReader();let size=0;const parts=[];
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();throw Error('ULTRA_SOURCE_TOO_LARGE')}parts.push(value);}return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(parts)));}finally{reader.releaseLock()}
}
export function createRuntimeSource({env={},fetchImpl=fetch,now=Date.now}={}){
 return async({platform,subject})=>{
  const config=settings(env);if(!config)return null;
  const nonce=randomUUID(),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
  try{
   const raw=await bounded(await fetchImpl(config.origin+'/v1/ultra/state',{method:'POST',cache:'no-store',redirect:'error',signal:controller.signal,
    headers:{Authorization:'Bearer '+config.key,'Content-Type':'application/json'},body:JSON.stringify({schema:'ULTRA_OWNER_STATE_REQUEST_V1',platform,subject,nonce,issuedAt:now()})}));
   if(raw.nonce!==nonce)throw Error('ULTRA_SOURCE_CONTEXT_MISMATCH');
   return validateOwnerState(raw.state,{platform,subject,now:now()});
  }finally{clearTimeout(timer)}
 };
}
// Mount only in the trusted runtime service. resolve() supplies the existing
// server-side identity mapping and consumer; no email or browser account alias.
export function createRuntimeStateService({serviceKey,resolve,now=Date.now}={}){
 if(!keyValid(serviceKey)||typeof resolve!=='function')throw Error('ULTRA_SERVICE_CONFIGURATION_REQUIRED');
 return async request=>{
  const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
  try{
   if(request.method!=='POST'||new URL(request.url).pathname!=='/v1/ultra/state')return Response.json({error:'not_found'},{status:404,headers});
   const supplied=(request.headers.get('authorization')??'').replace(/^Bearer /,'');
   const a=Buffer.from(supplied),b=Buffer.from(serviceKey);
   if(a.length!==b.length||!timingSafeEqual(a,b))return Response.json({error:'unauthorized'},{status:401,headers});
   if(!request.headers.get('content-type')?.startsWith('application/json'))throw Error();
   const body=await bounded(new Response(request.body,{headers:{'Content-Type':'application/json'}}),4096);
   if(Object.keys(body).sort().join()!=='issuedAt,nonce,platform,schema,subject'||body.schema!=='ULTRA_OWNER_STATE_REQUEST_V1'||
    !['jenios','flow'].includes(body.platform)||typeof body.subject!=='string'||body.subject.length>160||!body.subject||
    typeof body.nonce!=='string'||!/^[a-f0-9-]{36}$/.test(body.nonce)||!Number.isSafeInteger(body.issuedAt)||Math.abs(now()-body.issuedAt)>30000)throw Error();
   const consumer=await resolve({platform:body.platform,subject:body.subject});
   if(!consumer)return Response.json({error:'source_unavailable'},{status:503,headers});
   const state=validateOwnerState(await consumer.readState(),{platform:body.platform,subject:body.subject,now:now()});
   if(await resolve({platform:body.platform,subject:body.subject})!==consumer)return Response.json({error:'identity_changed'},{status:409,headers});
   return Response.json({nonce:body.nonce,state},{headers});
  }catch{return Response.json({error:'source_unavailable'},{status:503,headers});}
 };
}
