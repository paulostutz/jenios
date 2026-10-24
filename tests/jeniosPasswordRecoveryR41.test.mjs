import test from 'node:test';
import assert from 'node:assert/strict';
import {
 recoveryPaths,requestPasswordRecovery,loadPasswordRecoveryIdentity,changeRecoveredPassword
} from '../lib/password-recovery.mjs';

// No real identity, password, transport or email provider is used by this suite.
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
const PROJECT='https://abcdefghijklmnopqrst.supabase.co',KEY='sb_publishable_synthetic_recovery_r41';
const ORIGIN='https://jenios-recovery-r41.example.com';
const PASSWORD='Synthetic-Recovery-Only42!';
const EXP=Math.floor(Date.now()/1000)+3600;
const part=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
const token=(id=A,exp=EXP)=>part({alg:'HS256',typ:'JWT'})+'.'+part({sub:id,exp})+'.c3ludGhldGlj';
const user=(id=A)=>({id,email:id===A?'master@example.com':'other@example.com',is_anonymous:false,
 email_confirmed_at:'2026-10-24T12:00:00Z',app_metadata:{role:'master'},user_metadata:{}});
const session=value=>({user:structuredClone(value),access_token:token(value.id),refresh_token:'synthetic-refresh-'+value.id,
 expires_at:EXP,expires_in:3600,token_type:'bearer'});
const deferred=()=>{let resolve;const promise=new Promise(yes=>{resolve=yes;});return {promise,resolve};};
const code=value=>error=>error?.code===value;
const cancelled=error=>error?.name==='AbortError'||['RECOVERY_IDENTITY_MISMATCH','ACCOUNT_IDENTITY_MISMATCH'].includes(error?.code);

function liveAuth(initial=user()){
 const state={session:initial?session(initial):null,user:initial,getUserHook:null},listeners=new Set(),calls=[];
 const auth={
  async getSession(){calls.push({method:'getSession'});return {data:{session:structuredClone(state.session)},error:null};},
  async getUser(jwt){
   calls.push({method:'getUser',jwt});
   if(state.getUserHook)return state.getUserHook(jwt);
   return {data:{user:structuredClone(state.user)},error:null};
  },
  onAuthStateChange(callback){listeners.add(callback);return {data:{subscription:{unsubscribe(){listeners.delete(callback);}}}};},
  async updateUser(){throw Error('Password mutation must not use the shared Auth client');},
  async setSession(){throw Error('Password recovery must not replace the shared session');},
  async signOut(){throw Error('Password recovery must never sign out a later account');}
 };
 return {auth,state,listeners,calls,change(value,event=value?'SIGNED_IN':'SIGNED_OUT'){
  state.user=value;state.session=value?session(value):null;
  for(const callback of [...listeners])callback(event,structuredClone(state.session));
 }};
}

function sdkDouble({updatedUser=user(),beforeUpdate=null,setSessionUser=null}={}){
 const clients=[],outbound=[];let transportHook=null;
 const fetchImpl=async(url,options={})=>{
  const entry={url:String(url),method:options.method||'GET',headers:new Headers(options.headers),body:options.body,
   signal:options.signal,redirect:options.redirect,credentials:options.credentials};
  outbound.push(entry);
  if(transportHook)return transportHook(entry);
  return Response.json(entry.method==='PUT'?updatedUser:user());
 };
 function createClient(projectUrl,publishableKey,options){
  const record={projectUrl,publishableKey,options,session:null,sets:[],updates:[],disposed:0};clients.push(record);
  const guardedFetch=options.global?.fetch;assert.equal(typeof guardedFetch,'function');
  async function perform(method,body){
   const response=await guardedFetch(projectUrl+'/auth/v1/user',{method,
    headers:{apikey:publishableKey,authorization:'Bearer '+record.session.access_token,'content-type':'application/json'},
    ...(body===undefined?{}:{body:JSON.stringify(body)})});
   const data=await response.json();
   return response.ok?{data:{user:data},error:null}
    :{data:{user:null},error:{message:data.message,status:response.status,code:data.code}};
  }
  return {auth:{
   async setSession(tokens){
    record.sets.push(structuredClone(tokens));record.session={...session(user()),...tokens};
    const response=await perform('GET');
    if(response.error)return {data:{session:null,user:null},error:response.error};
    const identity=setSessionUser||response.data.user;
    return {data:{user:identity,session:{...record.session,user:identity}},error:null};
   },
   async getUser(){return perform('GET');},
   async getSession(){return {data:{session:structuredClone(record.session)},error:null};},
   async updateUser(attributes,settings){
    record.updates.push({attributes:structuredClone(attributes),settings});
    if(beforeUpdate)await beforeUpdate(record);
    return perform('PUT',attributes);
   },
   async dispose(){record.disposed++;},
   async signOut(){throw Error('A disposable password client must be disposed locally');},
   admin:new Proxy({}, {get(){throw Error('Password recovery must not use Auth Admin');}})
  }};
 }
 return {clients,outbound,createClient,fetchImpl,setTransportHook(value){transportHook=value;}};
}
function changeOptions(extra={}){
 return {ownerId:A,password:PASSWORD,confirmation:PASSWORD,projectUrl:PROJECT,publishableKey:KEY,
  createClient(){throw Error('Unexpected disposable Auth construction');},fetchImpl(){throw Error('Unexpected transport');},...extra};
}

test('R41 recovery uses explicit fixed Social and Admin destinations',()=>{
 assert.deepEqual(recoveryPaths(),{request:'/recuperar-senha',reset:'/redefinir-senha',login:'/login'});
 assert.deepEqual(recoveryPaths(true),{request:'/admin/recuperar-senha',reset:'/admin/redefinir-senha',login:'/admin/login'});
 for(const invalid of [null,1,'true','admin','https://other.example.com',{},[]])
  assert.throws(()=>recoveryPaths(invalid),code('RECOVERY_CONTEXT_INVALID'));
});

test('R41 a visitor can request first access without an existing Master session',async()=>{
 for(const admin of [false,true]){
  const calls=[];
  const auth={async resetPasswordForEmail(email,options){calls.push({email,options});return {data:{},error:null};}};
  const result=await requestPasswordRecovery(auth,{email:'  MASTER@EXAMPLE.COM  ',origin:ORIGIN,admin});
  assert.deepEqual(calls,[{email:'master@example.com',options:{redirectTo:ORIGIN+recoveryPaths(admin).reset}}]);
  assert.equal(result.requested,true);assert.equal(result.loginPath,recoveryPaths(admin).login);
  assert.match(result.message,/Se houver uma conta/);
  assert.equal(result.message.includes('master@example.com'),false);
 }
});

test('R41 invalid recovery emails, contexts and redirect origins never request an email',async()=>{
 let requests=0;const auth={async resetPasswordForEmail(){requests++;throw Error('Unexpected request');}};
 for(const input of [
  {email:'bad'}, {email:'a\u0000@example.com'}, {email:'a\nb@example.com'}, {admin:'true'},
  {origin:'javascript:alert(1)'},{origin:'data:text/plain,test'},{origin:'http://remote.example.com'},
  {origin:'https://name:password@example.com'},{origin:'https://example.com/path'},
  {origin:'https://example.com?next=https://other.example.com'},{origin:'https://example.com#target'}
 ])await assert.rejects(requestPasswordRecovery(auth,{email:'master@example.com',origin:ORIGIN,...input}));
 assert.equal(requests,0);
});

test('R41 recovery provider failures and limits expose no raw provider or address details',async()=>{
 for(const status of [400,429,500]){
  const auth={async resetPasswordForEmail(){return {error:{status,message:'private-provider-detail master@example.com'}};}};
  await assert.rejects(requestPasswordRecovery(auth,{email:'master@example.com',origin:ORIGIN,admin:true}),error=>{
   assert.equal(error.message.includes('private-provider-detail'),false);
   assert.equal(error.message.includes('master@example.com'),false);
   assert.equal(error.code,status===429?'RECOVERY_RATE_LIMITED':'RECOVERY_REQUEST_FAILED');return true;
  });
 }
});

test('R41 an already aborted recovery request does not send and a late result cannot update disposed UI',async()=>{
 const stopped=new AbortController();stopped.abort();let requests=0;
 await assert.rejects(requestPasswordRecovery({resetPasswordForEmail:async()=>{requests++;}},
  {email:'master@example.com',origin:ORIGIN,signal:stopped.signal}),cancelled);
 assert.equal(requests,0);
 const controller=new AbortController(),entered=deferred(),reply=deferred();
 const operation=requestPasswordRecovery({resetPasswordForEmail:async()=>{entered.resolve();return reply.promise;}},
  {email:'master@example.com',origin:ORIGIN,admin:true,signal:controller.signal});
 await entered.promise;controller.abort();reply.resolve({error:null});
 await assert.rejects(operation,cancelled);
});

test('R41 recovery identity is verified with the captured token and contains no session material',async()=>{
 const fixture=liveAuth();
 assert.deepEqual(await loadPasswordRecoveryIdentity(fixture.auth),{id:A,email:'master@example.com'});
 assert.equal(fixture.calls.find(call=>call.method==='getUser').jwt,token(A));
 assert.equal(fixture.listeners.size,0);
});

test('R41 missing, anonymous and mismatched recovery identities cannot enable password mutation',async()=>{
 for(const fixture of [liveAuth(null),liveAuth({...user(),is_anonymous:true})]){
  await assert.rejects(loadPasswordRecoveryIdentity(fixture.auth));
  assert.equal(fixture.calls.some(call=>call.method==='getUser'),false);
 }
 const fixture=liveAuth();fixture.state.user=user(B);
 await assert.rejects(loadPasswordRecoveryIdentity(fixture.auth));
 assert.equal(fixture.listeners.size,0);
});

test('R41 switching accounts while the recovery identity loads discards the previous lookup',async()=>{
 const fixture=liveAuth(),entered=deferred(),reply=deferred();
 fixture.state.getUserHook=async()=>{entered.resolve();return reply.promise;};
 const operation=loadPasswordRecoveryIdentity(fixture.auth);
 await entered.promise;fixture.change(user(B));reply.resolve({data:{user:user()},error:null});
 await assert.rejects(operation,cancelled);assert.equal(fixture.listeners.size,0);
});

test('R41 invalid passwords or mismatch never construct Auth or dispatch a password update',async()=>{
 for(const password of [null,12,'short','alllowercase12345!','ALLUPPERCASE12345!',
  'WithoutDigitsOnly!','NoSymbolPassword12','A1!'+ 'x'.repeat(126)]){
  await assert.rejects(changeRecoveredPassword(liveAuth().auth,changeOptions({password,confirmation:password})),
   code('PASSWORD_INVALID'));
 }
 await assert.rejects(changeRecoveredPassword(liveAuth().auth,changeOptions({confirmation:'Different-Synthetic42!'})),
  code('PASSWORD_CONFIRMATION_MISMATCH'));
});

test('R41 password update is bound to the same UUID/token and sends only the exact password',async()=>{
 for(const admin of [false,true]){
  const fixture=liveAuth(),sdk=sdkDouble(),before=structuredClone(fixture.state.session);
  const password='  Synthetic-Recovery-Only42!  ';
  const result=await changeRecoveredPassword(fixture.auth,changeOptions({...sdk,admin,password,confirmation:password}));
  assert.deepEqual(result,{id:A,status:'changed',loginPath:recoveryPaths(admin).login});
  const client=sdk.clients[0];
  assert.equal(client.options.auth.persistSession,false);
  assert.equal(client.options.auth.autoRefreshToken,false);
  assert.equal(client.options.auth.detectSessionInUrl,false);
  assert.deepEqual(client.updates.map(item=>item.attributes),[{password}]);
  assert.equal(sdk.outbound.filter(call=>call.method==='PUT').length,1);
  assert.deepEqual(JSON.parse(sdk.outbound.find(call=>call.method==='PUT').body),{password});
  assert.ok(sdk.outbound.every(call=>call.headers.get('authorization')==='Bearer '+token(A)));
  assert.ok(sdk.outbound.every(call=>call.redirect==='error'&&call.credentials==='omit'));
  assert.deepEqual(fixture.state.session,before,'A successful password update must not change the shared session');
  assert.equal(client.disposed,1);assert.equal(fixture.listeners.size,0);
  assert.equal(JSON.stringify(result).includes(password),false);
 }
});

test('R41 wrong owner or unexpected setSession user cannot send a password PUT',async()=>{
 const wrongOwner=liveAuth(user(B)),first=sdkDouble();
 await assert.rejects(changeRecoveredPassword(wrongOwner.auth,changeOptions({...first})),code('RECOVERY_IDENTITY_MISMATCH'));
 assert.equal(first.clients.length,0);assert.equal(first.outbound.length,0);
 const fixture=liveAuth(),second=sdkDouble({setSessionUser:user(B)});
 await assert.rejects(changeRecoveredPassword(fixture.auth,changeOptions({...second})));
 assert.equal(second.outbound.filter(call=>call.method==='PUT').length,0);
 assert.equal(second.clients[0].disposed,1);assert.equal(fixture.listeners.size,0);
});

test('R41 wrong or missing response UUID cannot claim that the password was changed',async()=>{
 for(const updatedUser of [user(B),null,{}]){
  const fixture=liveAuth(),sdk=sdkDouble({updatedUser});
  await assert.rejects(changeRecoveredPassword(fixture.auth,changeOptions({...sdk})));
  assert.equal(sdk.clients[0].disposed,1);assert.equal(fixture.listeners.size,0);
  assert.equal(fixture.state.session.user.id,A);
 }
});

test('R41 logout and A-to-B switch while the SDK waits prevent password dispatch',async()=>{
 for(const next of [null,user(B)]){
  const fixture=liveAuth(),entered=deferred(),continueUpdate=deferred();
  const sdk=sdkDouble({beforeUpdate:async()=>{entered.resolve();await continueUpdate.promise;}});
  const operation=changeRecoveredPassword(fixture.auth,changeOptions({...sdk}));
  await entered.promise;fixture.change(next);continueUpdate.resolve();
  await assert.rejects(operation,cancelled);
  assert.equal(sdk.outbound.filter(call=>call.method==='PUT').length,0);
  assert.ok(sdk.outbound.every(call=>call.headers.get('authorization')==='Bearer '+token(A)));
  assert.equal(sdk.clients[0].disposed,1);assert.equal(fixture.listeners.size,0);
 }
});

test('R41 an unmount abort during the pending SDK update prevents password dispatch',async()=>{
 const fixture=liveAuth(),controller=new AbortController(),entered=deferred(),continueUpdate=deferred();
 const sdk=sdkDouble({beforeUpdate:async()=>{entered.resolve();await continueUpdate.promise;}});
 const operation=changeRecoveredPassword(fixture.auth,changeOptions({...sdk,signal:controller.signal}));
 await entered.promise;controller.abort();continueUpdate.resolve();
 await assert.rejects(operation,cancelled);
 assert.equal(sdk.outbound.filter(call=>call.method==='PUT').length,0);
 assert.equal(sdk.clients[0].disposed,1);assert.equal(fixture.listeners.size,0);
});

test('R41 a response body arriving after an account switch cannot report password success',async()=>{
 const fixture=liveAuth(),headersReceived=deferred(),sdk=sdkDouble();let streamController;
 sdk.setTransportHook(async entry=>{
  if(entry.method!=='PUT')return Response.json(user());
  const response=new Response(new ReadableStream({start(controller){streamController=controller;}}),
   {headers:{'content-type':'application/json'}});
  headersReceived.resolve();return response;
 });
 const operation=changeRecoveredPassword(fixture.auth,changeOptions({...sdk,admin:true}));
 await headersReceived.promise;await Promise.resolve();fixture.change(user(B));
 streamController.enqueue(new TextEncoder().encode(JSON.stringify(user())));streamController.close();
 await assert.rejects(operation,cancelled);
 const dispatched=sdk.outbound.find(call=>call.method==='PUT');
 assert.equal(dispatched.headers.get('authorization'),'Bearer '+token(A));assert.equal(dispatched.signal.aborted,true);
 assert.equal(fixture.state.session.user.id,B,'Recovery cleanup must not sign out or replace the later user');
 assert.equal(sdk.clients[0].disposed,1);assert.equal(fixture.listeners.size,0);
});

test('R41 same-user token refresh invalidates the original password operation',async()=>{
 const fixture=liveAuth(),entered=deferred(),continueUpdate=deferred();
 const sdk=sdkDouble({beforeUpdate:async()=>{entered.resolve();await continueUpdate.promise;}});
 const operation=changeRecoveredPassword(fixture.auth,changeOptions({...sdk}));
 await entered.promise;fixture.state.session.access_token=token(A,EXP+1);
 for(const callback of [...fixture.listeners])callback('TOKEN_REFRESHED',structuredClone(fixture.state.session));
 continueUpdate.resolve();await assert.rejects(operation,cancelled);
 assert.equal(sdk.outbound.filter(call=>call.method==='PUT').length,0);
 assert.equal(sdk.clients[0].disposed,1);
});

test('R41 password recovery refuses expired or refresh-near sessions before constructing a client',async()=>{
 const now=Math.floor(Date.now()/1000);
 for(const expiry of [now-1,now+60]){
  const fixture=liveAuth(),sdk=sdkDouble();
  fixture.state.session.access_token=token(A,expiry);fixture.state.session.expires_at=expiry;
  await assert.rejects(changeRecoveredPassword(fixture.auth,changeOptions({...sdk})));
  assert.equal(sdk.clients.length,0);assert.equal(sdk.outbound.length,0);assert.equal(fixture.listeners.size,0);
 }
});

test('R41 password provider errors are sanitized and cleanup never acts on the shared session',async()=>{
 const fixture=liveAuth(),sdk=sdkDouble();
 sdk.setTransportHook(async entry=>entry.method==='PUT'
  ?Response.json({message:'private-provider-detail '+PASSWORD},{status:400})
  :Response.json(user()));
 await assert.rejects(changeRecoveredPassword(fixture.auth,changeOptions({...sdk})),error=>{
  assert.equal(error.code,'RECOVERY_PASSWORD_UPDATE_FAILED');
  assert.equal(error.message.includes('private-provider-detail'),false);
  assert.equal(error.message.includes(PASSWORD),false);return true;
 });
 assert.equal(sdk.clients[0].disposed,1);assert.equal(fixture.listeners.size,0);
 assert.equal(fixture.state.session.user.id,A);
});
