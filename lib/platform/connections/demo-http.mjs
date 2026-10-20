/** B168 — authenticated demo broker HTTP boundary, without Social session fallback. */
import {assistantSameOrigin} from './request-origin.mjs';
import {demoStore} from './demo-store.mjs';
import {connectDemo,listDemoConnections,revokeDemo,syncDemo,ensureDemoEnabled} from './demo-service.mjs';
const HEADERS={'Cache-Control':'no-store, max-age=0','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'no-referrer','Vary':'Authorization, Origin'};
const reply=(body,status=200)=>Response.json(body,{status,headers:HEADERS});
const codeError=(code,status)=>{throw Object.assign(new Error(code),{code,status});};
async function bodyJson(request){
 if(!/^application\/json(?:;|$)/i.test(request.headers.get('content-type')||''))codeError('JSON_REQUIRED',415);
 if(Number(request.headers.get('content-length')||0)>6000)codeError('REQUEST_TOO_LARGE',413);
 const chunks=[];let n=0;const reader=request.body?.getReader();if(!reader)codeError('JSON_REQUIRED',415);
 try{while(true){const part=await reader.read();if(part.done)break;n+=part.value.length;if(n>6000)codeError('REQUEST_TOO_LARGE',413);chunks.push(part.value);}}finally{reader.releaseLock();}
 try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{codeError('INVALID_JSON',400);}
}
function guardMutation(request){
 if(!request.headers.has('origin')||!assistantSameOrigin(request))codeError('ORIGIN_DENIED',403);
 if(request.headers.get('sec-fetch-site')==='cross-site')codeError('ORIGIN_DENIED',403);
}
async function identity(request,db){
 const bearer=request.headers.get('authorization')||'';
 const match=bearer.match(/^Bearer ([A-Za-z0-9_.-]{20,4096})$/i);
 if(!match)codeError('PLATFORM_AUTH_REQUIRED',401);
 let result;try{result=await db.auth.getUser(match[1]);}catch{codeError('PLATFORM_AUTH_REQUIRED',401);}
 const user=result?.data?.user;
 if(result?.error||!user?.id||user?.is_anonymous)codeError('PLATFORM_AUTH_REQUIRED',401);
 return user.id;
}
const known=new Set(['DEMO_CONNECTORS_DISABLED','JSON_REQUIRED','INVALID_JSON','REQUEST_TOO_LARGE','ORIGIN_DENIED','PLATFORM_AUTH_REQUIRED','INVALID_USER','INVALID_CONNECTION_ID','INVALID_REQUEST','UNSUPPORTED_PROVIDER','LIVE_DISABLED','DEMO_CONSENT_REQUIRED','INVALID_CREDENTIAL_FORMAT','EXISTING_DEMO_CONNECTION','CONNECTION_NOT_FOUND','CONNECTION_CHANGED_DURING_SYNC','CONNECTION_RACE','SYNC_INTERVAL_120_SECONDS','CONNECT_COOLDOWN_60_SECONDS','SYNC_IN_PROGRESS','EXTERNAL_ACCOUNT_CHANGED','PROVIDER_401','PROVIDER_403','PROVIDER_429','PROVIDER_451','DEMO_READ_FAILED','PROVIDER_NETWORK_UNAVAILABLE','PROVIDER_UNAVAILABLE','PAGINATION_REQUIRED','INCOMPLETE_PROVIDER_LIST']);
export async function demoHttp(request,verb,{id=null,env=process.env,getAdmin=()=>{throw Object.assign(new Error('PLATFORM_DB_UNAVAILABLE'),{status:503});},getStore=demoStore,reader,now,uuid}={}){
 try{
  ensureDemoEnabled(env);
  if(verb!=='list')guardMutation(request);
  const admin=getAdmin(env),userId=await identity(request,admin),store=getStore(admin);
  const options={store,env,reader,now,uuid};
  if(verb==='list')return reply({ok:true,connections:await listDemoConnections(userId,options),realExecutionEnabled:false});
  if(verb==='create')return reply({ok:true,connection:await connectDemo(userId,await bodyJson(request),options),realExecutionEnabled:false},201);
  if(verb==='sync')return reply({ok:true,...await syncDemo(userId,id,options),realExecutionEnabled:false});
  if(verb==='revoke')return reply({ok:true,...await revokeDemo(userId,id,options),realExecutionEnabled:false});
  return reply({ok:false,code:'METHOD_NOT_ALLOWED'},405);
 }catch(error){
  const code=known.has(error?.code)?error.code:'DEMO_UNAVAILABLE';
  const status=Number.isInteger(error?.status)&&error.status>=400&&error.status<=503?error.status:503;
  // Don't return error.message, provider response body, JWT, keys or exception stack.
  return reply({ok:false,code,realExecutionEnabled:false},status);
 }
}
