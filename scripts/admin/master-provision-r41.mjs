/** R41 operator-only bootstrap. No browser route imports this module.
 * Uses the official Auth Admin API inside the selected QA runtime. It never
 * exports a service key, sends mail, generates login links or confirms email.
 * A short-lived authenticated deployment must be replaced by a tombstone.
 */
const SOCIAL_QA_URL='https://rebzztxlzofxpfwjvbee.supabase.co';
const UID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL=/^[^\s@\u0000-\u001f]{1,64}@[^\s@\u0000-\u001f]{1,190}$/;
const failure=(code,status=503)=>Object.assign(new Error(code),{code,status});
const record=value=>value&&typeof value==='object'&&!Array.isArray(value);

export function createMasterProvisionHandler({projectUrl,targetEmail,operationId,tokenSha256,
 expiresAt,now=Date.now,fetcher=globalThis.fetch,getEnv=()=>undefined}={}){
 const email=String(targetEmail||'').trim().toLowerCase();
 if(projectUrl!==SOCIAL_QA_URL||!EMAIL.test(email)||email.length>254||
  !/^[a-z0-9_:-]{8,100}$/.test(operationId||'')||!/^[a-f0-9]{64}$/.test(tokenSha256||'')||
  !Number.isSafeInteger(expiresAt)||expiresAt<=0||expiresAt>now()+900000)
  throw failure('BOOTSTRAP_CONFIGURATION_INVALID',400);
 const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
 const respond=(body,status=200)=>Response.json(body,{status,headers});
 function available(){if(now()>=expiresAt)throw failure('BOOTSTRAP_EXPIRED',410);}
 async function authorized(request){
  const token=/^Bearer ([A-Za-z0-9_-]{43})$/.exec(request.headers.get('authorization')||'')?.[1];
  if(!token)return false;
  const digest=await globalThis.crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));
  const actual=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
  let difference=0;for(let i=0;i<64;i++)difference|=actual.charCodeAt(i)^tokenSha256.charCodeAt(i);
  return difference===0;
 }
 function checkedUser(value,{expectedId,requireTarget=false}={}){
  const user=record(value?.user)?value.user:value;
  if(!record(user)||!UID.test(user.id||'')||user.is_anonymous===true||
   user.app_metadata?.role!=='master'||user.app_metadata?.jenios_master_bootstrap!==operationId||
   expectedId&&user.id!==expectedId||requireTarget&&String(user.email||'').toLowerCase()!==email)
   throw failure('BOOTSTRAP_IDENTITY_NOT_CONFIRMED',409);
  return user;
 }
 return async function handle(request){
  try{
   available();
   if(request.method!=='POST')return respond({ok:false,code:'METHOD_NOT_ALLOWED'},405);
   if(!(await authorized(request)))return respond({ok:false,code:'UNAUTHORIZED'},401);
   if(request.headers.has('origin')||new URL(request.url).search)
    return respond({ok:false,code:'REQUEST_CONTEXT_DENIED'},403);
   if(!/^application\/json(?:;|$)/i.test(request.headers.get('content-type')||''))
    return respond({ok:false,code:'JSON_REQUIRED'},415);
   if(Number(request.headers.get('content-length')||0)>1024)
    return respond({ok:false,code:'BODY_TOO_LARGE'},413);
   const raw=await request.arrayBuffer();if(raw.byteLength>1024)
    return respond({ok:false,code:'BODY_TOO_LARGE'},413);
   let input;try{input=JSON.parse(new TextDecoder().decode(raw));}catch{
    return respond({ok:false,code:'INVALID_REQUEST'},400);
   }
   if(!record(input)||input.action!=='provision'||Object.keys(input).length!==1)
    return respond({ok:false,code:'INVALID_REQUEST'},400);
   available();
   if(getEnv('SUPABASE_URL')!==projectUrl)throw failure('BOOTSTRAP_PROJECT_MISMATCH',403);
   const serviceKey=getEnv('SUPABASE_SERVICE_ROLE_KEY');
   if(typeof serviceKey!=='string'||serviceKey.length<24)throw failure('BOOTSTRAP_ADMIN_UNAVAILABLE');

   async function authRequest(path,method='GET',body){
    available();
    // Every path is built below from constants, page integers or a verified UUID.
    const response=await fetcher(projectUrl+'/auth/v1/admin/users'+path,{
     method,redirect:'error',signal:AbortSignal.timeout(15000),
     headers:{apikey:serviceKey,Authorization:'Bearer '+serviceKey,'Content-Type':'application/json'},
     ...(body?{body:JSON.stringify(body)}:{})
    });
    if(!response?.ok)throw failure('BOOTSTRAP_AUTH_REQUEST_FAILED');
    const payload=await response.arrayBuffer();
    if(payload.byteLength>1048576)throw failure('BOOTSTRAP_AUTH_RESPONSE_INVALID');
    try{return JSON.parse(new TextDecoder().decode(payload));}
    catch{throw failure('BOOTSTRAP_AUTH_RESPONSE_INVALID');}
   }
   async function inspectUsers(){
    let marked=null,target=null;
    for(let page=1;page<=10;page++){
     const data=await authRequest('?page='+page+'&per_page=100');
     if(!record(data)||!Array.isArray(data.users)||data.users.length>100)
      throw failure('BOOTSTRAP_AUTH_RESPONSE_INVALID');
     for(const user of data.users){
      if(!record(user)||!UID.test(user.id||''))throw failure('BOOTSTRAP_AUTH_RESPONSE_INVALID');
      if(user.app_metadata?.jenios_master_bootstrap===operationId){
       if(marked&&marked.id!==user.id)throw failure('BOOTSTRAP_IDENTITY_CONFLICT',409);
       marked=user;
      }
      if(String(user.email||'').toLowerCase()===email){
       if(target&&target.id!==user.id)throw failure('BOOTSTRAP_IDENTITY_CONFLICT',409);
       target=user;
      }
     }
     if(data.users.length<100)return {marked,target};
    }
    throw failure('BOOTSTRAP_DIRECTORY_INCOMPLETE');
   }
   const before=await inspectUsers();
   let user,status='existing';
   if(before.marked){
    user=checkedUser(before.marked);
    if(before.target&&before.target.id!==user.id)throw failure('BOOTSTRAP_IDENTITY_CONFLICT',409);
   }else if(before.target){
    // Do not turn an unexpected pre-existing identity into a Master.
    throw failure('BOOTSTRAP_IDENTITY_CONFLICT',409);
   }else{
    const attributes={email,email_confirm:false,
     app_metadata:{role:'master',jenios_master_bootstrap:operationId},
     user_metadata:{origin:'jenios_admin_bootstrap_r41'}};
    // Omitting password lets Auth generate an unknown random value. The owner
    // defines their password through the normal verified recovery flow.
    try{
     user=checkedUser(await authRequest('','POST',attributes),{requireTarget:true});
     if(user.email_confirmed_at)throw failure('BOOTSTRAP_CONFIRMATION_UNEXPECTED',409);
     status='created';
    }catch(cause){
     if(cause?.code==='BOOTSTRAP_CONFIRMATION_UNEXPECTED'||cause?.code==='BOOTSTRAP_IDENTITY_NOT_CONFIRMED')throw cause;
     // Resolve a lost response or duplicate concurrent create by reading. Never
     // repeat POST, invite, reset, confirm, or delete as automatic compensation.
     const after=await inspectUsers();
     if(!after.marked||after.target&&after.target.id!==after.marked.id)throw cause;
     user=checkedUser(after.marked);
    }
   }
   const confirmed=checkedUser(await authRequest('/'+user.id),{expectedId:user.id,requireTarget:status==='created'});
   if(status==='created'&&confirmed.email_confirmed_at)
    throw failure('BOOTSTRAP_CONFIRMATION_UNEXPECTED',409);
   return respond({ok:true,status,userId:confirmed.id,role:'master',emailConfirmed:Boolean(confirmed.email_confirmed_at)});
  }catch(e){
   const codes=new Set(['BOOTSTRAP_EXPIRED','BOOTSTRAP_PROJECT_MISMATCH','BOOTSTRAP_ADMIN_UNAVAILABLE',
    'BOOTSTRAP_IDENTITY_NOT_CONFIRMED','BOOTSTRAP_IDENTITY_CONFLICT','BOOTSTRAP_CONFIRMATION_UNEXPECTED',
    'BOOTSTRAP_DIRECTORY_INCOMPLETE','BOOTSTRAP_AUTH_REQUEST_FAILED','BOOTSTRAP_AUTH_RESPONSE_INVALID']);
   const code=codes.has(e?.code)?e.code:'BOOTSTRAP_UNAVAILABLE';
   const status=[403,409,410,503].includes(e?.status)?e.status:503;
   return respond({ok:false,code},status);
  }
 };
}
