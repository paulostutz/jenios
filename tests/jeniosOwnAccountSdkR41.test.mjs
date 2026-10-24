import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,existsSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {createClient} from '@supabase/supabase-js';
import {requestOwnAccountEmailChange} from '../lib/admin-account.mjs';
import {changeRecoveredPassword} from '../lib/password-recovery.mjs';

// The real pinned SDK runs against this in-process transport only. The reserved
// .invalid domain is never resolved; native fetch is blocked for the entire test.
const PROJECT='https://jenios-r41-sdk.example.invalid';
const PUBLIC_KEY='sb_publishable_synthetic_sdk_r41_only';
const ORIGIN='https://jenios-admin.example.invalid';
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
const require=createRequire(import.meta.url);
function installedVersion(entry,name){
 let current=dirname(entry);
 while(true){
  const file=join(current,'package.json');
  if(existsSync(file)){
   const value=JSON.parse(readFileSync(file,'utf8'));
   if(value.name===name)return value.version;
  }
  const parent=dirname(current);if(parent===current)throw Error('SDK package metadata unavailable');current=parent;
 }
}
const deferred=()=>{let resolve;const promise=new Promise(yes=>{resolve=yes;});return {promise,resolve};};
const part=value=>Buffer.from(JSON.stringify(value)).toString('base64url');

test('R41 real Supabase 2.117.3 isolates email/password setSession, updateUser and dispose from the shared account',
 {timeout:10000},async t=>{
 const sdkEntry=require.resolve('@supabase/supabase-js');
 assert.equal(installedVersion(sdkEntry,'@supabase/supabase-js'),'2.117.3');
 const authEntry=createRequire(sdkEntry).resolve('@supabase/auth-js');
 assert.equal(installedVersion(authEntry,'@supabase/auth-js'),'2.117.3');
 let unexpectedNetwork=0;
 t.mock.method(globalThis,'fetch',async()=>{unexpectedNetwork++;throw Error('External fetch is forbidden in R41 SDK fixtures');});
 const now=Math.floor(Date.now()/1000),expires=now+3600;
 const jwt=id=>part({alg:'HS256',typ:'JWT'})+'.'+part({sub:id,exp:expires,iat:now,aud:'authenticated',
  role:'authenticated',iss:PROJECT+'/auth/v1'})+'.'+Buffer.from('synthetic-local-signature').toString('base64url');
 const tokens={a:jwt(A),b:jwt(B)};
 const makeUser=id=>({id,aud:'authenticated',role:'authenticated',is_anonymous:false,
  email:id===A?'master@example.invalid':'other@example.invalid',email_confirmed_at:'2026-10-24T12:00:00Z',
  created_at:'2026-10-24T12:00:00Z',updated_at:'2026-10-24T12:00:00Z',
  app_metadata:{role:id===A?'master':'user'},user_metadata:{}});
 const users=new Map([[A,makeUser(A)],[B,makeUser(B)]]),requests=[],clients=[];
 let holdPassword=false,pendingPassword=null;
 const passwordEntered=deferred(),releasePassword=deferred();
 const localFetch=async(input,options={})=>{
  const target=new URL(typeof input==='string'||input instanceof URL?input:input.url);
  const method=String(options.method||input?.method||'GET').toUpperCase();
  const headers=new Headers(options.headers||input?.headers);
  assert.equal(target.origin,PROJECT);assert.equal(target.pathname,'/auth/v1/user');
  assert.ok(['GET','PUT'].includes(method),'Refresh, sign-out and Admin endpoints are not part of this fixture');
  assert.equal(headers.get('apikey'),PUBLIC_KEY);
  const bearer=headers.get('authorization');
  const owner=bearer==='Bearer '+tokens.a?A:bearer==='Bearer '+tokens.b?B:null;
  assert.ok(owner,'Only synthetic tokens held by this test are accepted');
  const record={owner,method,url:target.toString(),signal:options.signal};requests.push(record);
  if(method==='PUT'){
   assert.equal(owner,A,'The original operation must never mutate account B');
   assert.equal(options.redirect,'error');assert.equal(options.credentials,'omit');
   const body=typeof options.body==='string'?options.body:await input.clone().text();
   record.body=JSON.parse(body);
   const keys=Object.keys(record.body);
   assert.ok(keys.every(key=>['email','password','code_challenge','code_challenge_method'].includes(key)));
   assert.equal('app_metadata' in record.body,false);assert.equal('data' in record.body,false);
   assert.equal('email' in record.body,'password' in record.body?false:true);
   if('code_challenge' in record.body)assert.equal(record.body.code_challenge,null);
   if('code_challenge_method' in record.body)assert.equal(record.body.code_challenge_method,null);
   if(record.body.email){
    assert.equal(target.searchParams.get('redirect_to'),ORIGIN+'/admin/meu-acesso');
    users.set(A,{...users.get(A),new_email:record.body.email});
   }
   if(record.body.password&&holdPassword){
    pendingPassword=record;passwordEntered.resolve();await releasePassword.promise;
   }
  }
  return Response.json(structuredClone(users.get(owner)));
 };
 const shared=createClient(PROJECT,PUBLIC_KEY,{global:{fetch:localFetch},auth:{persistSession:false,
  autoRefreshToken:false,detectSessionInUrl:false,flowType:'implicit',storageKey:'r41-sdk-shared-local'}});
 let singletonUpdates=0,singletonSignouts=0;
 const actualSharedUpdate=shared.auth.updateUser.bind(shared.auth),actualSharedSignout=shared.auth.signOut.bind(shared.auth);
 t.mock.method(shared.auth,'updateUser',async(...args)=>{singletonUpdates++;return actualSharedUpdate(...args);});
 t.mock.method(shared.auth,'signOut',async(...args)=>{singletonSignouts++;return actualSharedSignout(...args);});
 function observedCreateClient(...args){
  const client=createClient(...args),record={client,sets:0,updates:0,disposed:0};clients.push(record);
  const set=client.auth.setSession.bind(client.auth),update=client.auth.updateUser.bind(client.auth),dispose=client.auth.dispose.bind(client.auth);
  client.auth.setSession=async(...values)=>{record.sets++;return set(...values);};
  client.auth.updateUser=async(...values)=>{record.updates++;return update(...values);};
  client.auth.dispose=async()=>{record.disposed++;return dispose();};
  return client;
 }
 try{
  const established=await shared.auth.setSession({access_token:tokens.a,refresh_token:'synthetic-refresh-a'});
  assert.equal(established.error,null);assert.equal(established.data.user.id,A);
  const baseline=structuredClone((await shared.auth.getSession()).data.session);
  const common={createClient:observedCreateClient,projectUrl:PROJECT,publishableKey:PUBLIC_KEY,fetchImpl:localFetch};
  const email=await requestOwnAccountEmailChange(shared.auth,{...common,ownerId:A,
   email:'new@example.invalid',confirmation:'new@example.invalid',origin:ORIGIN});
  assert.deepEqual(email,{id:A,email:'master@example.invalid',pendingEmail:'new@example.invalid',status:'pending',requested:true});
  assert.deepEqual((await shared.auth.getSession()).data.session,baseline);
  const password='Synthetic-SDK-Only-Password42!';
  const changed=await changeRecoveredPassword(shared.auth,{...common,ownerId:A,password,confirmation:password,admin:true});
  assert.deepEqual(changed,{id:A,status:'changed',loginPath:'/admin/login'});
  assert.deepEqual((await shared.auth.getSession()).data.session,baseline);
  assert.equal(requests.filter(entry=>entry.method==='PUT').length,2);
  assert.ok(clients.every(record=>record.sets===1&&record.updates===1&&record.disposed===1));

  // The real shared SDK switches to B while A's password response is delayed.
  // Cleanup must discard A's result and must not replace or sign out B.
  holdPassword=true;
  const changing=changeRecoveredPassword(shared.auth,{...common,ownerId:A,password,confirmation:password,admin:true});
  const outcome=changing.then(value=>({ok:true,value}),error=>({ok:false,error}));
  const first=await Promise.race([
   passwordEntered.promise.then(()=>({entered:true})),
   outcome.then(result=>({entered:false,result}))
  ]);
  if(!first.entered){
   if(!first.result.ok)throw first.result.error;
   assert.fail('The password operation finished before reaching the held local response');
  }
  const switched=await shared.auth.setSession({access_token:tokens.b,refresh_token:'synthetic-refresh-b'});
  assert.equal(switched.error,null);assert.equal(switched.data.user.id,B);
  releasePassword.resolve();const settled=await outcome;
  assert.equal(settled.ok,false);assert.equal(settled.error.name,'AbortError');
  const current=(await shared.auth.getSession()).data.session;
  assert.equal(current.user.id,B);assert.equal(current.access_token,tokens.b);
  assert.equal(pendingPassword.owner,A);assert.equal(pendingPassword.signal.aborted,true);
  assert.ok(clients.every(record=>record.sets===1&&record.updates===1&&record.disposed===1));
  assert.equal(singletonUpdates,0);assert.equal(singletonSignouts,0);assert.equal(unexpectedNetwork,0);
 }finally{
  releasePassword.resolve();
  for(const record of clients)if(!record.disposed)await record.client.auth.dispose();
  await shared.auth.dispose();
 }
});
