/** Local Auth/HTTP fixtures only. These tests do not certify a hosted login. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlatformAdminSession} from '../lib/platform/admin-session.mjs';

const ACCESS='/api/platform/admin/access',OVERVIEW='/api/platform/admin/overview';
const session=(id,token=id+'-token')=>({access_token:token,user:{id,is_anonymous:false}});
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function until(condition){for(let i=0;i<100;i++){if(condition())return;await tick();}assert.fail('Expected async state was not reached');}
const changed=error=>error.code==='SESSION_CHANGED'&&error.name==='AbortError';
const bearer=options=>new Headers(options.headers).get('authorization');
function auth(initial){
 let value=initial,insideCallback=false,reads=0,error=null;
 const listeners=new Set();
 return {
  async getSession(){assert.equal(insideCallback,false,'getSession must run outside the Auth callback');reads++;return {data:{session:value},error};},
  onAuthStateChange(callback){
   listeners.add(callback);callback('INITIAL_SESSION',value);
   return {data:{subscription:{unsubscribe(){listeners.delete(callback);}}}};
  },
  emit(event,next=value){
   value=next;insideCallback=true;
   try{for(const callback of [...listeners])assert.equal(callback(event,value),undefined,'Auth callback must be synchronous');}
   finally{insideCallback=false;}
  },
  set(next){value=next;},fail(next){error=next;},count:()=>listeners.size,reads:()=>reads
 };
}
function harness({platform=null,social=session('social-a'),handler}={}){
 const platformAuth=auth(platform),socialAuth=auth(social),calls=[],timers=new Map(),focusListeners=new Set();let next=0;
 const eventTarget={
  addEventListener(name,callback){assert.equal(name,'focus');focusListeners.add(callback);},
  removeEventListener(name,callback){assert.equal(name,'focus');focusListeners.delete(callback);}
 };
 const h={platformAuth,socialAuth,calls,timers,focusListeners,granted:true,
  run(){const first=timers.entries().next().value;if(first){timers.delete(first[0]);first[1]();}},
  focus(){for(const callback of [...focusListeners])callback();},
  clean(){assert.equal(platformAuth.count(),0);assert.equal(socialAuth.count(),0);assert.equal(focusListeners.size,0);assert.equal(timers.size,0);}
 };
 h.api=createPlatformAdminSession({platformAuth,socialAuth,eventTarget,
  schedule:callback=>{const id=++next;timers.set(id,callback);return id;},cancel:id=>timers.delete(id),
  fetchImpl:async(url,options)=>{
   calls.push({url,options});
   if(handler)return handler(url,options,h);
   if(url===ACCESS)return Response.json({permissions:h.granted?['platform.admin']:[]});
   if(url==='/api/admin/access')return Response.json({isMaster:h.granted&&bearer(options).startsWith('Bearer social-a')});
   if(url==='/api/admin/ecosystem')return Response.json({status:'ready',source:'platform_dedicated_database',diagnostics:3,riskEvents:2,adminPermissions:1});
   assert.fail('Unexpected endpoint '+url);
  }
 });
 return h;
}
async function observing(h){
 const seen=[],stop=h.api.observe(state=>seen.push(state));
 assert.deepEqual(seen,[{permissions:null,error:''}]);
 h.run();await until(()=>seen.at(-1).permissions!==null||seen.at(-1).error!=='');
 return {seen,stop};
}

test('R39 dedicated request preserves its Response, options and dedicated token',async()=>{
 const h=harness({platform:session('platform-a'),handler:async(_url,options)=>{
  assert.equal(bearer(options),'Bearer platform-a-token');
  assert.equal(new Headers(options.headers).get('x-request'),'expected');
  assert.equal(options.method,'POST');assert.equal(options.body,'payload');assert.equal(options.cache,'no-store');
  return Response.json({ok:true},{headers:{'x-server':'kept'}});
 }});
 const response=await h.api.fetch('/api/platform/private-action',{method:'POST',body:'payload',headers:new Headers({'x-request':'expected',authorization:'wrong'})});
 assert.equal(response.headers.get('x-server'),'kept');assert.equal(response.bodyUsed,false);assert.deepEqual(await response.json(),{ok:true});
 assert.equal(h.calls.length,1);h.clean();
});

test('R39 Social Master fallback uses only the two server-gated Social reads',async()=>{
 const h=harness();
 assert.deepEqual(await(await h.api.fetch(ACCESS)).json(),{permissions:['platform.admin','platform.reports'],masterSource:'jenios_social_verified'});
 const overview=await(await h.api.fetch(OVERVIEW)).json();assert.equal(overview.verified,true);assert.equal(overview.diagnostics,3);
 assert.deepEqual(h.calls.map(c=>c.url),['/api/admin/access','/api/admin/access','/api/admin/ecosystem']);
 for(const {options} of h.calls){assert.equal(bearer(options),'Bearer social-a-token');assert.equal(options.cache,'no-store');assert.ok(options.signal instanceof AbortSignal);}
 h.clean();
});

test('R39 Social token cannot be sent to another Platform route or a fallback mutation',async()=>{
 const h=harness();
 for(const [url,options] of [['/api/platform/admin/other',{}],[ACCESS+'?extra=1',{}],[ACCESS,{method:'POST'}],[OVERVIEW,{method:'DELETE'}]])
  await assert.rejects(h.api.fetch(url,options),/sessão administrativa exclusiva/);
 assert.equal(h.calls.length,0);h.clean();
});

test('R39 denied dedicated request falls back without forwarding Social token to Platform',async()=>{
 const h=harness({platform:session('platform-a'),handler:async(url,options)=>{
  if(url===ACCESS){assert.equal(bearer(options),'Bearer platform-a-token');return Response.json({}, {status:403});}
  assert.equal(url,'/api/admin/access');assert.equal(bearer(options),'Bearer social-a-token');return Response.json({isMaster:true});
 }});
 assert.equal((await(await h.api.fetch(ACCESS)).json()).masterSource,'jenios_social_verified');
 assert.deepEqual(h.calls.map(c=>c.url),[ACCESS,'/api/admin/access']);h.clean();
});

test('R39 missing, anonymous, errored and incomplete sessions cannot make an admin request',async()=>{
 for(const social of [null,{access_token:'bad',user:{id:'a',is_anonymous:true}},{access_token:'bad',user:{}},{user:{id:'a'}}]){
  const h=harness({social});await assert.rejects(h.api.fetch(ACCESS));assert.equal(h.calls.length,0);h.clean();
 }
 const h=harness();h.socialAuth.fail({message:'private auth error'});await assert.rejects(h.api.fetch(ACCESS),/Entre com sua conta Master/);
 assert.equal(h.calls.length,0);h.clean();
});

test('R39 untrusted metadata and non-Master responses cannot grant access',async()=>{
 const social=session('social-a');social.user.user_metadata={role:'master',permissions:['platform.admin']};
 for(const body of [null,{}, {isMaster:false},{isMaster:'true'}]){
  const h=harness({social,handler:async()=>Response.json(body)});
  await assert.rejects(h.api.fetch(ACCESS),/Apenas Masters/);assert.equal(h.calls.length,1);h.clean();
 }
});

test('R39 failed or unverified admin backends remain closed',async()=>{
 for(const status of [401,403,503]){
  const h=harness({handler:async()=>Response.json({}, {status})});await assert.rejects(h.api.fetch(ACCESS),/verificar o Master/);h.clean();
 }
 for(const body of [null,{status:'ready',source:'social_database'},{status:'unavailable',source:'platform_dedicated_database'}]){
  const h=harness({handler:async url=>Response.json(url==='/api/admin/access'?{isMaster:true}:body)});
  await assert.rejects(h.api.fetch(OVERVIEW),/Banco exclusivo/);h.clean();
 }
 const h=harness({handler:async()=>{throw Error('offline');}});const {seen,stop}=await observing(h);
 assert.equal(seen.at(-1).permissions,null);assert.equal(seen.at(-1).error,'offline');stop();h.clean();
});

for(const source of ['social','platform']){
 test('R39 '+source+' logout aborts a pending response and removes its subscriptions',async()=>{
  const pending=deferred(),h=harness({platform:source==='platform'?session('platform-a'):null,handler:()=>pending.promise});
  const result=h.api.fetch(ACCESS),rejected=assert.rejects(result,changed);await until(()=>h.calls.length===1);
  h[source+'Auth'].emit('SIGNED_OUT',null);
  assert.equal(h.calls[0].options.signal.aborted,true);h.clean();
  pending.resolve(Response.json(source==='platform'?{permissions:['platform.admin']}:{isMaster:true}));await rejected;h.clean();
 });
 test('R39 '+source+' account switch clears authorized state synchronously',async()=>{
  const h=harness({platform:source==='platform'?session('platform-a'):null}),{seen,stop}=await observing(h);
  assert.ok(seen.at(-1).permissions.includes('platform.admin'));const reads=h.platformAuth.reads()+h.socialAuth.reads();
  h.granted=false;h[source+'Auth'].emit('SIGNED_IN',session(source+'-b'));
  assert.deepEqual(seen.at(-1),{permissions:null,error:''});assert.equal(h.platformAuth.reads()+h.socialAuth.reads(),reads);
  h.run();await until(()=>seen.at(-1).permissions!==null||seen.at(-1).error!=='');
  assert.ok(!seen.at(-1).permissions?.includes('platform.admin'));stop();h.clean();
 });
}

test('R39 A to B to A cannot revive an old response even when the original token returns',async()=>{
 const pending=deferred(),h=harness({handler:()=>pending.promise});
 const result=h.api.fetch(ACCESS),rejected=assert.rejects(result,changed);await until(()=>h.calls.length===1);
 h.socialAuth.emit('SIGNED_IN',session('social-b'));h.socialAuth.emit('SIGNED_IN',session('social-a'));
 pending.resolve(Response.json({isMaster:true}));await rejected;h.clean();
});

test('R39 a Platform change invalidates an in-flight Social fallback',async()=>{
 const pending=deferred(),h=harness({handler:()=>pending.promise});
 const result=h.api.fetch(ACCESS),rejected=assert.rejects(result,changed);await until(()=>h.calls.length===1);
 h.platformAuth.emit('SIGNED_IN',session('platform-a'));pending.resolve(Response.json({isMaster:true}));
 await rejected;assert.equal(h.calls.length,1);h.clean();
});

for(const mutation of ['owner','token','source']){
 test('R39 silent '+mutation+' change cannot accept the previous response',async()=>{
  const pending=deferred(),original=session('social-a'),h=harness({social:original,handler:()=>pending.promise});
  const result=h.api.fetch(ACCESS),rejected=assert.rejects(result,changed);await until(()=>h.calls.length===1);
  if(mutation==='owner')h.socialAuth.set(session('social-b'));
  if(mutation==='token')h.socialAuth.set(session('social-a','renewed-token'));
  if(mutation==='source'){h.socialAuth.set(null);h.platformAuth.set(original);}
  pending.resolve(Response.json({isMaster:true}));await rejected;assert.equal(h.calls.length,1);h.clean();
 });
}

test('R39 an old getSession result cannot start HTTP after a session event',async()=>{
 const pending=deferred(),h=harness();h.socialAuth.getSession=()=>pending.promise;
 const result=h.api.fetch(ACCESS),rejected=assert.rejects(result,changed);
 h.socialAuth.emit('SIGNED_OUT',null);pending.resolve({data:{session:session('social-a')},error:null});
 await rejected;assert.equal(h.calls.length,0);h.clean();
});

test('R39 a session change while the response body streams cannot be accepted',async()=>{
 let stream;
 const h=harness({platform:session('platform-a'),handler:async()=>new Response(new ReadableStream({start(controller){stream=controller;}}))});
 const result=h.api.fetch(ACCESS),rejected=assert.rejects(result,changed);await until(()=>stream);
 h.platformAuth.emit('TOKEN_REFRESHED',session('platform-a','new-token'));
 stream.enqueue(new TextEncoder().encode('{"permissions":["platform.admin"]}'));stream.close();await rejected;h.clean();
});

for(const source of ['social','platform']){
 test('R39 '+source+' refresh clears the view and rechecks the renewed token outside Auth callback',async()=>{
  const h=harness({platform:source==='platform'?session('platform-a'):null}),{seen,stop}=await observing(h);
  const count=h.calls.length,reads=h.platformAuth.reads()+h.socialAuth.reads();
  h[source+'Auth'].emit('TOKEN_REFRESHED',session(source+'-a',source+'-a-renewed'));
  assert.deepEqual(seen.at(-1),{permissions:null,error:''});assert.equal(h.platformAuth.reads()+h.socialAuth.reads(),reads);
  h.run();await until(()=>seen.at(-1).permissions!==null);
  assert.equal(bearer(h.calls[count].options),'Bearer '+source+'-a-renewed');stop();h.clean();
 });
}

test('R39 refresh with the same identity and token still rechecks revoked permissions',async()=>{
 const h=harness(),{seen,stop}=await observing(h);h.granted=false;
 h.socialAuth.emit('TOKEN_REFRESHED');assert.equal(seen.at(-1).permissions,null);
 h.run();await until(()=>seen.at(-1).error!=='');assert.equal(seen.at(-1).permissions,null);stop();h.clean();
});

test('R39 focus invalidates access immediately and revalidates with the server',async()=>{
 const h=harness({platform:session('platform-a')}),{seen,stop}=await observing(h);h.granted=false;
 h.focus();assert.deepEqual(seen.at(-1),{permissions:null,error:''});
 h.run();await until(()=>seen.at(-1).permissions!==null||seen.at(-1).error!=='');
 assert.ok(!seen.at(-1).permissions?.includes('platform.admin'));stop();h.clean();
});

test('R39 an older failure cannot replace permissions from the current session',async()=>{
 const first=deferred();let requests=0;
 const h=harness({platform:session('platform-a'),handler:async()=>++requests===1?first.promise:Response.json({permissions:['platform.reports']})});
 const seen=[],stop=h.api.observe(state=>seen.push(state));h.run();await until(()=>h.calls.length===1);
 h.platformAuth.emit('SIGNED_IN',session('platform-b'));h.run();await until(()=>seen.at(-1).permissions?.includes('platform.reports'));
 const count=seen.length;first.reject(Error('old private error'));await tick();await tick();
 assert.equal(seen.length,count);assert.deepEqual(seen.at(-1),{permissions:['platform.reports'],error:''});stop();h.clean();
});

test('R39 cleanup cancels timers, aborts requests and ignores late completion',async()=>{
 const pending=deferred(),h=harness({handler:()=>pending.promise}),seen=[];
 const stop=h.api.observe(state=>seen.push(state));h.run();await until(()=>h.calls.length===1);
 const count=seen.length;stop();stop();assert.equal(h.calls[0].options.signal.aborted,true);h.clean();
 pending.resolve(Response.json({isMaster:true}));await tick();await tick();assert.equal(seen.length,count);
 h.socialAuth.emit('SIGNED_IN',session('social-a'));h.focus();assert.equal(seen.length,count);h.clean();
 const second=h.api.observe(state=>seen.push(state));assert.equal(h.timers.size,1);second();h.clean();
});

test('R39 only the latest scheduled revalidation can run',async()=>{
 const h=harness(),seen=[],stop=h.api.observe(state=>seen.push(state));
 h.socialAuth.emit('SIGNED_OUT',null);h.socialAuth.emit('SIGNED_IN',session('social-a'));h.focus();
 assert.equal(h.timers.size,1);assert.equal(h.calls.length,0);
 h.run();await until(()=>seen.at(-1).permissions!==null);assert.equal(h.calls.length,1);stop();h.clean();
});

test('R39 caller cancellation does not issue HTTP or retain listeners',async()=>{
 const h=harness(),controller=new AbortController();controller.abort();
 await assert.rejects(h.api.fetch(ACCESS,{signal:controller.signal}),changed);assert.equal(h.calls.length,0);h.clean();
});
