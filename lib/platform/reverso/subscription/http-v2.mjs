import {validateReversoSubscriptionInputV2,validateReversoSubscriptionViewV2} from './view-v2.mjs';
const headers={'Cache-Control':'private, no-store','Vary':'Authorization, Cookie','X-Content-Type-Options':'nosniff'};
const reply=(body,status=200)=>Response.json(body,{status,headers});
const fail=(status,code)=>{throw Object.assign(Error(code),{status,code});};
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v);
async function body(request){
 if(!request.body)fail(400,'REVERSO_SUBSCRIPTION_REQUEST_INVALID');
 const reader=request.body.getReader(),parts=[];let size=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>16000){await reader.cancel();fail(413,'REVERSO_SUBSCRIPTION_REQUEST_TOO_LARGE');}parts.push(value);}}
 finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let at=0;for(const p of parts){bytes.set(p,at);at+=p.length;}
 try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{fail(400,'REVERSO_SUBSCRIPTION_REQUEST_INVALID');}
}
/** Dedicated Platform auth is injected by the existing Next route. No admin
 * write endpoint, payer supplied by browser, payment confirmation or retry. */
export function createReversoSubscriptionHandlerV2({getUser,source,now=Date.now}={}){
 if(typeof getUser!=='function')throw Error('REVERSO_IDENTITY_REQUIRED');
 return async request=>{
  let mutating=false;
  try{
   const url=new URL(request.url);
   if(!['GET','POST'].includes(request.method))fail(405,'REVERSO_SUBSCRIPTION_METHOD_NOT_ALLOWED');
   const origin=request.headers.get('origin'),site=request.headers.get('sec-fetch-site');
   if(origin&&origin!==url.origin||site&&!['same-origin','none'].includes(site))fail(403,'REVERSO_SUBSCRIPTION_ORIGIN_REQUIRED');
   if(request.method==='POST'&&(origin!==url.origin||request.headers.get('x-jenios-reverso-intent')!=='subscription'||!/^application\/json(?:;|$)/i.test(request.headers.get('content-type')??'')))fail(403,'REVERSO_SUBSCRIPTION_ORIGIN_REQUIRED');
   const user=await getUser(request);
   if(!uuid(user?.id)||user.is_anonymous)fail(401,'REVERSO_DEDICATED_SESSION_REQUIRED');
   let input;
   if(request.method==='GET'){
    const keys=[...url.searchParams.keys()];
    if(!keys.length)input={action:'status'};
    else{
     if(keys.length!==1||!['interval','orderId','requestKey'].includes(keys[0]))fail(400,'REVERSO_SUBSCRIPTION_REQUEST_INVALID');
     input=keys[0]==='interval'?{action:'quote',interval:url.searchParams.get('interval')}:keys[0]==='requestKey'?{action:'lookup',requestKey:url.searchParams.get('requestKey')}:{action:'read',orderId:url.searchParams.get('orderId')};
    }
   }else{
    if(url.search)fail(400,'REVERSO_SUBSCRIPTION_REQUEST_INVALID');input=await body(request);
    if(['status','quote','read','lookup'].includes(input?.action))fail(400,'REVERSO_SUBSCRIPTION_REQUEST_INVALID');
   }
   try{input=validateReversoSubscriptionInputV2(input);}catch{fail(400,'REVERSO_SUBSCRIPTION_REQUEST_INVALID');}
   const guard=async()=>{const current=await getUser(request);if(current?.id!==user.id||current.is_anonymous)fail(409,'REVERSO_SESSION_CHANGED');};
   await guard();if(typeof source!=='function')fail(503,'REVERSO_SUBSCRIPTION_UNAVAILABLE');
   mutating=request.method==='POST';const raw=await source({subject:user.id,input},{guard});await guard();
   if(!raw)fail(503,'REVERSO_SUBSCRIPTION_UNAVAILABLE');
   return reply(validateReversoSubscriptionViewV2(raw,{subject:user.id,now:now()}));
  }catch(error){
   const safe=[400,401,403,405,409,413,503].includes(error.status);
   return reply({error:safe?error.code:'REVERSO_SUBSCRIPTION_UNAVAILABLE',uncertain:mutating},safe?error.status:503);
  }
 };
}
