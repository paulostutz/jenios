import test from 'node:test';
import assert from 'node:assert/strict';
import {
 normalizeAdminAccountEmail,loadOwnAccountEmail,requestOwnAccountEmailChange,createBoundEmailAuth
} from '../lib/admin-account.mjs';
import {isMasterAdmin,requireAdminPermission} from '../lib/admin-access.mjs';

// Every identity, token and transport below is synthetic and local to this suite.
const A='11111111-1111-4111-8111-111111111111';
const B='22222222-2222-4222-8222-222222222222';
const PROJECT='https://abcdefghijklmnopqrst.supabase.co';
const KEY='sb_publishable_synthetic_r41';
const ORIGIN='https://jenios-r41.example.com';
const user=(id=A,email='master@example.com',extra={})=>({
 id,email,is_anonymous:false,email_confirmed_at:'2026-10-24T12:00:00Z',
 app_metadata:{role:'master',retained:'server-owned'},user_metadata:{},...extra
});
const TOKEN_EXP=Math.floor(Date.now()/1000)+3600;
const jwtPart=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
const tokenFor=(id,exp=TOKEN_EXP)=>jwtPart({alg:'HS256',typ:'JWT'})+'.'+jwtPart({sub:id,exp})+'.c3ludGhldGljLXNpZ25hdHVyZQ';
const sessionFor=value=>({access_token:tokenFor(value.id),refresh_token:'synthetic-refresh-'+value.id,
 expires_at:TOKEN_EXP,expires_in:3600,token_type:'bearer',user:structuredClone(value)});
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const errorCode=code=>value=>value?.code===code;

function liveAuth(initial=user()){
 const state={session:initial?sessionFor(initial):null,identity:initial,sessionError:null,userError:null,
  getUserHook:null,getSessionHook:null};
 const listeners=new Set(),calls=[];
 const auth={
  async getSession(){
   calls.push({method:'getSession'});
   if(state.getSessionHook)return state.getSessionHook();
   return {data:{session:structuredClone(state.session)},error:state.sessionError};
  },
  async getUser(token){
   calls.push({method:'getUser',token});
   if(state.getUserHook)return state.getUserHook(token);
   return {data:{user:structuredClone(state.identity)},error:state.userError};
  },
  onAuthStateChange(callback){
   listeners.add(callback);
   return {data:{subscription:{unsubscribe(){listeners.delete(callback);}}}};
  },
  async updateUser(){throw Error('The shared Auth client must never mutate an email');},
  async setSession(){throw Error('The shared Auth session must never be replaced');},
  async signOut(){throw Error('This account operation must never sign out remotely');}
 };
 return {auth,state,calls,listeners,change(next,event=next?'SIGNED_IN':'SIGNED_OUT'){
  state.identity=next;state.session=next?sessionFor(next):null;
  for(const callback of [...listeners])callback(event,structuredClone(state.session));
 }};
}

function requestOptions(extra={}){
 return {ownerId:A,email:'new@example.com',confirmation:'new@example.com',origin:ORIGIN,
  projectUrl:PROJECT,publishableKey:KEY,
  createClient(){throw Error('Unexpected disposable Auth construction');},
  fetchImpl(){throw Error('Unexpected transport');},...extra};
}

test('R41 own-account email normalization accepts surrounding whitespace and canonicalizes case',()=>{
 assert.equal(normalizeAdminAccountEmail('  Pessoa+Conta@EXAMPLE.COM  '),'pessoa+conta@example.com');
});

test('R41 malformed emails are rejected without string coercion or control characters',()=>{
 for(const value of [undefined,null,{},[],42,'','  ','missing-at.example.com','a@@example.com',
  'a@localhost','a b@example.com','a\nb@example.com','a\u0000@example.com','a\u0001@example.com','a\u007f@example.com',
  'a'.repeat(250)+'@example.com']){
  assert.throws(()=>normalizeAdminAccountEmail(value),errorCode('ACCOUNT_EMAIL_INVALID'),String(value));
 }
});

test('R41 load reads the verified own identity and returns only the account email projection',async()=>{
 const fixture=liveAuth(user(A,'MASTER@EXAMPLE.COM',{new_email:'Next@EXAMPLE.COM'}));
 const result=await loadOwnAccountEmail(fixture.auth);
 assert.deepEqual(result,{id:A,email:'master@example.com',pendingEmail:'next@example.com'});
 assert.equal(fixture.calls.find(x=>x.method==='getUser').token,tokenFor(A));
 assert.equal(JSON.stringify(result).includes('synthetic-access'),false);
 assert.equal(JSON.stringify(result).includes('synthetic-refresh'),false);
 assert.equal(fixture.listeners.size,0,'Operation subscriptions must be released');
});

test('R41 load rejects unavailable Auth, missing or anonymous sessions and unverified server identity',async()=>{
 await assert.rejects(loadOwnAccountEmail(null),errorCode('ACCOUNT_AUTH_UNAVAILABLE'));
 for(const fixture of [liveAuth(null),liveAuth(user(A,'master@example.com',{is_anonymous:true}))]){
  await assert.rejects(loadOwnAccountEmail(fixture.auth));
  assert.equal(fixture.calls.some(x=>x.method==='getUser'),false);
 }
 const fixture=liveAuth();fixture.state.userError={message:'synthetic private upstream details'};
 await assert.rejects(loadOwnAccountEmail(fixture.auth),error=>{
  assert.equal(String(error.message).includes('private upstream'),false);return true;
 });
});

test('R41 load rejects a server response for another UUID instead of showing the next account',async()=>{
 const fixture=liveAuth();fixture.state.identity=user(B,'other@example.com');
 await assert.rejects(loadOwnAccountEmail(fixture.auth),errorCode('ACCOUNT_IDENTITY_MISMATCH'));
 assert.equal(fixture.listeners.size,0);
});

test('R41 logout or account change while identity lookup is pending discards the response',async()=>{
 for(const next of [null,user(B,'other@example.com')]){
  const fixture=liveAuth(),entered=deferred(),reply=deferred();
  fixture.state.getUserHook=async()=>{entered.resolve();return reply.promise;};
  const operation=loadOwnAccountEmail(fixture.auth);
  await entered.promise;fixture.change(next);
  reply.resolve({data:{user:user()},error:null});
  await assert.rejects(operation,error=>error?.name==='AbortError'||error?.code==='ACCOUNT_IDENTITY_MISMATCH');
  assert.equal(fixture.listeners.size,0);
 }
});

test('R41 email confirmation mismatch is rejected before any disposable client or mutation',async()=>{
 const fixture=liveAuth();
 await assert.rejects(requestOwnAccountEmailChange(fixture.auth,requestOptions({confirmation:'different@example.com'})),
  errorCode('ACCOUNT_EMAIL_CONFIRMATION_MISMATCH'));
});

test('R41 email redirect accepts only a valid application origin and a fixed account path',async()=>{
 for(const origin of ['javascript:alert(1)','data:text/html,test','http://remote.example.com',
  'https://name:password@example.com','//example.com','not a url']){
  const fixture=liveAuth();
  await assert.rejects(requestOwnAccountEmailChange(fixture.auth,requestOptions({origin})),
   errorCode('ACCOUNT_REDIRECT_INVALID'),origin);
 }
});

test('R41 current or already pending email does not issue a second update or resend',async()=>{
 for(const [email,newEmail,status] of [
  ['MASTER@EXAMPLE.COM',undefined,'unchanged'],['Next@EXAMPLE.COM','next@example.com','pending']]){
  const fixture=liveAuth(user(A,'master@example.com',{new_email:newEmail}));
  const result=await requestOwnAccountEmailChange(fixture.auth,requestOptions({email,confirmation:email}));
  assert.equal(result.id,A);assert.equal(result.status,status);assert.equal(result.requested,false);
  assert.equal(fixture.listeners.size,0);
 }
});

test('R41 supplied owner must match the authenticated UUID before any update',async()=>{
 const fixture=liveAuth(user(B,'other@example.com'));
 await assert.rejects(requestOwnAccountEmailChange(fixture.auth,requestOptions()),
  errorCode('ACCOUNT_IDENTITY_MISMATCH'));
});

test('R41 externally aborted operations perform no mutation and release their listeners',async()=>{
 const fixture=liveAuth(),controller=new AbortController();controller.abort();
 await assert.rejects(requestOwnAccountEmailChange(fixture.auth,requestOptions({signal:controller.signal})),
  error=>error?.name==='AbortError');
 assert.equal(fixture.listeners.size,0);
});

test('R41 Master authority survives an email change through the same UUID and trusted metadata',async()=>{
 const previous=user(),updated={...previous,email:'new@example.com'};
 assert.equal(isMasterAdmin(previous,{}),true);
 assert.equal(isMasterAdmin(updated,{}),true);
 assert.equal(isMasterAdmin({...updated,app_metadata:{},user_metadata:{role:'master'}},{}),false);
 assert.equal(isMasterAdmin({...updated,app_metadata:{}},{JENIOS_ADMIN_MASTER_USER_IDS:A}),true);
 const request=new Request(ORIGIN+'/api/admin/inter/setup',{headers:{authorization:'Bearer '+tokenFor(A)}});
 const db={auth:{getUser:async token=>{
  assert.equal(token,tokenFor(A));return {data:{user:updated},error:null};
 }},from(){throw Error('A trusted Master does not need an email lookup');}};
 assert.equal((await requireAdminPermission(request,db,'finance.manage')).id,A);
 assert.equal(previous.email,'master@example.com');
});

function disposableSdk({responseUser=user(),beforeUpdate=null,setSessionUser=null}={}){
 const clients=[],outbound=[];
 let response=structuredClone(responseUser),transportHook=null;
 const fetchImpl=async(url,options={})=>{
  const entry={url:String(url),method:options.method||'GET',headers:new Headers(options.headers),body:options.body,
   redirect:options.redirect,credentials:options.credentials,signal:options.signal};
  outbound.push(entry);
  if(transportHook)return transportHook(entry);
  const output=entry.method==='PUT'?response:user();
  return Response.json(output);
 };
 function createClient(projectUrl,publishableKey,options){
  const record={projectUrl,publishableKey,options,session:null,disposed:0,updates:[],sets:[],calls:[]};
  clients.push(record);
  const sdkFetch=options.global?.fetch;
  assert.equal(typeof sdkFetch,'function','Disposable Auth must install its guarded transport');
  async function perform(method,path='/auth/v1/user',body){
   record.calls.push({method,path});
   const reply=await sdkFetch(projectUrl+path,{method,headers:{apikey:publishableKey,
    authorization:'Bearer '+record.session.access_token,'content-type':'application/json'},
    ...(body===undefined?{}:{body:JSON.stringify(body)})});
   const data=await reply.json();
   return reply.ok?{data:{user:data},error:null}:{data:{user:null},error:{code:data.code,status:reply.status,message:data.message}};
  }
  record.rawRequest=(path,method='GET',extra={})=>sdkFetch(projectUrl+path,{method,
   headers:{apikey:publishableKey,authorization:'Bearer '+record.session.access_token},...extra});
  const auth={
   async setSession(tokens){
    record.sets.push(structuredClone(tokens));record.session={...sessionFor(user()),...tokens};
    const result=await perform('GET');
    if(result.error)return {data:{session:null,user:null},error:result.error};
    const identity=setSessionUser||result.data.user;
    return {data:{session:{...record.session,user:identity},user:identity},error:null};
   },
   async getUser(){return perform('GET');},
   async getSession(){return {data:{session:structuredClone(record.session)},error:null};},
   async updateUser(attributes,settings){
    record.updates.push({attributes:structuredClone(attributes),settings:structuredClone(settings)});
    if(beforeUpdate)await beforeUpdate(record);
    const redirect=settings?.emailRedirectTo;
    return perform('PUT','/auth/v1/user'+(redirect?'?redirect_to='+encodeURIComponent(redirect):''),attributes);
   },
   async dispose(){record.disposed++;},
   async stopAutoRefresh(){},
   async signOut(){throw Error('Disposable Auth must never sign out the real account');},
   admin:new Proxy({}, {get(){throw Error('Disposable email changes must not use Auth Admin');}})
  };
  return {auth};
 }
 return {createClient,fetchImpl,clients,outbound,setResponse(value){response=structuredClone(value);},
  setTransportHook(value){transportHook=value;}};
}

test('R41 request uses a disposable same-owner session and submits only email with a fixed redirect',async()=>{
 const fixture=liveAuth(),sdk=disposableSdk({responseUser:user(A,'master@example.com',{new_email:'new@example.com'})});
 const original=structuredClone(fixture.state.session);
 const result=await requestOwnAccountEmailChange(fixture.auth,requestOptions({...sdk}));
 assert.deepEqual(result,{id:A,email:'master@example.com',pendingEmail:'new@example.com',status:'pending',requested:true});
 assert.equal(sdk.clients.length,1);
 const client=sdk.clients[0];
 assert.equal(client.projectUrl,PROJECT);assert.equal(client.publishableKey,KEY);
 assert.equal(client.options.auth.persistSession,false);
 assert.equal(client.options.auth.autoRefreshToken,false);
 assert.equal(client.options.auth.detectSessionInUrl,false);
 assert.deepEqual(client.updates,[{attributes:{email:'new@example.com'},
  settings:{emailRedirectTo:ORIGIN+'/admin/meu-acesso'}}]);
 assert.ok(client.sets.length>0);
 assert.equal(client.sets[0].access_token,tokenFor(A));
 assert.equal(client.sets[0].refresh_token,original.refresh_token);
 assert.ok(sdk.outbound.every(call=>call.headers.get('authorization')==='Bearer '+tokenFor(A)));
 assert.ok(sdk.outbound.every(call=>call.redirect==='error'&&call.credentials==='omit'),
  'The captured bearer must not follow redirects or acquire browser credentials');
 assert.equal(sdk.outbound.filter(call=>call.method==='PUT').length,1);
 assert.deepEqual(fixture.state.session,original,'Shared Auth storage must not be replaced or edited');
 assert.equal(client.disposed,1);assert.equal(fixture.listeners.size,0);
});

test('R41 confirmed update keeps the same user and reports changed only from the verified Auth response',async()=>{
 const fixture=liveAuth(),sdk=disposableSdk({responseUser:user(A,'new@example.com')});
 const result=await requestOwnAccountEmailChange(fixture.auth,requestOptions({...sdk}));
 assert.equal(result.id,A);assert.equal(result.email,'new@example.com');assert.equal(result.pendingEmail,null);
 assert.equal(result.status,'changed');assert.equal(result.requested,true);
 assert.deepEqual(sdk.clients[0].updates[0].attributes,{email:'new@example.com'});
 assert.equal(isMasterAdmin(user(A,result.email),{}),true);
 assert.equal(sdk.clients[0].disposed,1);
});

test('R41 a response for another UUID cannot replace or disclose the signed-in account',async()=>{
 const fixture=liveAuth(),sdk=disposableSdk({responseUser:user(B,'other@example.com')});
 await assert.rejects(requestOwnAccountEmailChange(fixture.auth,requestOptions({...sdk})),
  errorCode('ACCOUNT_IDENTITY_MISMATCH'));
 assert.equal(fixture.state.identity.id,A);
 assert.equal(sdk.clients[0].disposed,1);assert.equal(fixture.listeners.size,0);
});

test('R41 a disposable setSession response for a different UUID is rejected before update',async()=>{
 const fixture=liveAuth(),sdk=disposableSdk({setSessionUser:user(B,'other@example.com')});
 await assert.rejects(requestOwnAccountEmailChange(fixture.auth,requestOptions({...sdk})),
  errorCode('ACCOUNT_IDENTITY_MISMATCH'));
 assert.equal(sdk.clients[0].updates.length,0);
 assert.equal(sdk.outbound.filter(call=>call.method==='PUT').length,0);
 assert.equal(sdk.clients[0].disposed,1);assert.equal(fixture.listeners.size,0);
});

test('R41 absent or contradictory update responses never claim success',async()=>{
 for(const responseUser of [null,{},user(A,'unrelated@example.com'),user(A,'master@example.com',{new_email:'unrelated@example.com'})]){
  const fixture=liveAuth(),sdk=disposableSdk({responseUser});
  await assert.rejects(requestOwnAccountEmailChange(fixture.auth,requestOptions({...sdk})));
  assert.equal(sdk.clients[0].disposed,1);assert.equal(fixture.listeners.size,0);
 }
});

test('R41 account switch while the SDK update awaits cannot send the next user token',async()=>{
 const fixture=liveAuth(),entered=deferred(),continueUpdate=deferred();
 const sdk=disposableSdk({beforeUpdate:async()=>{entered.resolve();await continueUpdate.promise;}});
 const operation=requestOwnAccountEmailChange(fixture.auth,requestOptions({...sdk}));
 await entered.promise;fixture.change(user(B,'other@example.com'));continueUpdate.resolve();
 await assert.rejects(operation,error=>error?.name==='AbortError'||error?.code==='ACCOUNT_IDENTITY_MISMATCH');
 assert.equal(sdk.outbound.filter(call=>call.method==='PUT').length,0);
 assert.ok(sdk.outbound.every(call=>call.headers.get('authorization')==='Bearer '+tokenFor(A)));
 assert.equal(sdk.clients[0].disposed,1);assert.equal(fixture.listeners.size,0);
});

test('R41 owner change after transport started discards the late update response',async()=>{
 const fixture=liveAuth(),entered=deferred(),reply=deferred(),sdk=disposableSdk();
 sdk.setTransportHook(async entry=>{
  if(entry.method==='PUT'){entered.resolve();return reply.promise;}
  return Response.json(user());
 });
 const operation=requestOwnAccountEmailChange(fixture.auth,requestOptions({...sdk}));
 await entered.promise;fixture.change(user(B,'other@example.com'));
 reply.resolve(Response.json(user(A,'new@example.com')));
 await assert.rejects(operation,error=>error?.name==='AbortError'||error?.code==='ACCOUNT_IDENTITY_MISMATCH');
 assert.equal(sdk.outbound.find(call=>call.method==='PUT').headers.get('authorization'),'Bearer '+tokenFor(A));
 assert.equal(sdk.clients[0].disposed,1);assert.equal(fixture.listeners.size,0);
});

test('R41 session changes while the response body is delayed discard the result and abort transport',async()=>{
 const fixture=liveAuth(),headersReceived=deferred(),sdk=disposableSdk();let streamController;
 sdk.setTransportHook(async entry=>{
  if(entry.method!=='PUT')return Response.json(user());
  const response=new Response(new ReadableStream({start(controller){streamController=controller;}}),
   {headers:{'content-type':'application/json'}});
  headersReceived.resolve();return response;
 });
 const operation=requestOwnAccountEmailChange(fixture.auth,requestOptions({...sdk}));
 await headersReceived.promise;await Promise.resolve();fixture.change(user(B,'other@example.com'));
 streamController.enqueue(new TextEncoder().encode(JSON.stringify(user(A,'new@example.com'))));streamController.close();
 await assert.rejects(operation,error=>error?.name==='AbortError'||error?.code==='ACCOUNT_IDENTITY_MISMATCH');
 assert.equal(sdk.outbound.find(call=>call.method==='PUT').signal.aborted,true);
 assert.equal(sdk.clients[0].disposed,1);assert.equal(fixture.listeners.size,0);
});

test('R41 an upstream update failure is sanitized and always disposes temporary Auth',async()=>{
 const fixture=liveAuth(),sdk=disposableSdk();
 sdk.setTransportHook(async entry=>entry.method==='PUT'
  ?Response.json({code:'provider_detail',message:'synthetic secret and private upstream context'},{status:400})
  :Response.json(user()));
 await assert.rejects(requestOwnAccountEmailChange(fixture.auth,requestOptions({...sdk})),error=>{
  assert.equal(error.code,'ACCOUNT_EMAIL_UPDATE_FAILED');
  assert.equal(error.message.includes('private upstream'),false);return true;
 });
 assert.equal(sdk.clients[0].disposed,1);assert.equal(fixture.listeners.size,0);
});

test('R41 a token refresh for the same UUID invalidates an outstanding email change',async()=>{
 const fixture=liveAuth(),entered=deferred(),continueUpdate=deferred();
 const sdk=disposableSdk({beforeUpdate:async()=>{entered.resolve();await continueUpdate.promise;}});
 const operation=requestOwnAccountEmailChange(fixture.auth,requestOptions({...sdk}));
 await entered.promise;
 fixture.state.session.access_token=tokenFor(A,TOKEN_EXP+1);
 for(const callback of [...fixture.listeners])callback('TOKEN_REFRESHED',structuredClone(fixture.state.session));
 continueUpdate.resolve();
 await assert.rejects(operation,error=>error?.name==='AbortError'||error?.code==='ACCOUNT_IDENTITY_MISMATCH');
 assert.equal(sdk.outbound.filter(call=>call.method==='PUT').length,0);
 assert.equal(sdk.clients[0].disposed,1);
});

test('R41 expired, near-expiry or mismatched JWT sessions are rejected before disposable Auth',async()=>{
 const now=Math.floor(Date.now()/1000);
 const alterations=[
  value=>{value.expires_at=now-1;},value=>{value.expires_at=now+60;},
  value=>{value.access_token=tokenFor(A,now-1);},value=>{value.access_token=tokenFor(A,now+60);},
  value=>{value.access_token=tokenFor(B);},value=>{value.access_token='invalid-token';}
 ];
 for(const alter of alterations){
  const fixture=liveAuth(),sdk=disposableSdk();alter(fixture.state.session);
  await assert.rejects(requestOwnAccountEmailChange(fixture.auth,requestOptions({...sdk})));
  assert.equal(sdk.clients.length,0);assert.equal(sdk.outbound.length,0);
  assert.equal(fixture.listeners.size,0);
 }
});

test('R41 disposable transport rejects refresh, admin, external host and substituted Bearer requests',async()=>{
 const fixture=liveAuth(),sdk=disposableSdk();
 const bound=await createBoundEmailAuth({auth:fixture.auth,session:structuredClone(fixture.state.session),
  projectUrl:PROJECT,publishableKey:KEY,...sdk});
 try{
  const client=sdk.clients[0],guard=client.options.global.fetch;
  const initial=sdk.outbound.length;
  const requests=[
   [PROJECT+'/auth/v1/token?grant_type=refresh_token',{method:'POST'}],
   [PROJECT+'/auth/v1/admin/users',{method:'GET'}],
   ['https://other.example.com/auth/v1/user',{method:'PUT'}],
   [PROJECT+'/auth/v1/user',{method:'DELETE'}],
   [PROJECT+'/auth/v1/user',{method:'GET',headers:{authorization:'Bearer '+tokenFor(B)}}]
  ];
  for(const [url,options] of requests){
   await assert.rejects(guard(url,{headers:{authorization:'Bearer '+tokenFor(A)},...options}));
  }
  assert.equal(sdk.outbound.length,initial);
 }finally{await bound.dispose();}
 assert.equal(sdk.clients[0].disposed,1);assert.equal(fixture.listeners.size,0);
});

test('R41 disposal closes the temporary client without a remote sign-out and blocks future calls',async()=>{
 const fixture=liveAuth(),sdk=disposableSdk();
 const bound=await createBoundEmailAuth({auth:fixture.auth,session:structuredClone(fixture.state.session),
  projectUrl:PROJECT,publishableKey:KEY,...sdk});
 await bound.dispose();await bound.dispose();
 const calls=sdk.outbound.length;
 await assert.rejects(bound.auth.updateUser({email:'new@example.com'},{emailRedirectTo:ORIGIN+'/admin/meu-acesso'}));
 assert.equal(sdk.outbound.length,calls);assert.equal(sdk.clients[0].disposed,1);
 assert.equal(fixture.state.identity.id,A);assert.equal(fixture.listeners.size,0);
});
