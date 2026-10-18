import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateStagingE2EConfig,certifyStagingFeed} from '../../lib/social/staging-e2e.mjs';
const stage='https://rebzztxlzofxpfwjvbee.supabase.co';
const preview='https://jenios-ecossistem-example-jenios.vercel.app/';
const idA='11111111-1111-4111-8111-111111111111';
const idB='22222222-2222-4222-8222-222222222222';
const postId='33333333-3333-4333-8333-333333333333';
const commentId='44444444-4444-4444-8444-444444444444';
const authA='stage-jwt-mock-a-0123456789';
const authB='stage-jwt-mock-b-0123456789';
const opts={previewUrl:preview,stageUrl:stage,publishableKey:'stage-publishable-key-test-only-123',
 emailA:'a@example.invalid',passwordA:'fake_password_A_123',
 emailB:'b@example.invalid',passwordB:'fake_password_B_123'};
const response=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
function mockServer({failProfile=false,deleteOnFail=false}={}){
 let post=null,comment=null,liked=false,archived=false;
 let logins=0,ownerDeletes=0,crossDeletes=0,calls=[];
 const fetcher=async(uri,options)=>{
  const url=new URL(uri),path=url.pathname,method=options.method,auth=options.headers.authorization||'';
  calls.push({path,method,host:url.hostname});
  if(url.origin===stage&&path==='/auth/v1/token'){
   const {email,password}=JSON.parse(options.body);
   if(email===opts.emailA&&password===opts.passwordA){logins++;return response({user:{id:idA,is_anonymous:false},access_token:authA})}
   if(email===opts.emailB&&password===opts.passwordB){logins++;return response({user:{id:idB,is_anonymous:false},access_token:authB})}
   return response({error:'invalid'},400);
  }
  if(url.origin!==new URL(preview).origin)return response({error:'wrong-origin'},503);
  const id=auth==='Bearer '+authA?idA:auth==='Bearer '+authB?idB:null;
  if(!id)return response({error:'AUTH_REQUIRED'},401);
  if(path==='/api/social/posts'){
   if(method==='POST'){
    if(id!==idA)return response({error:'FORBIDDEN'},403);
    const input=JSON.parse(options.body);
    post={id:postId,author_id:idA,body:input.body,archived_at:null,media:[]};
    return response({post},201);
   }
   if(method==='GET'&&url.searchParams.has('id')){
    return post&&url.searchParams.get('id')===postId&&!archived?response({post}):response({error:'NOT_FOUND'},404);
   }
   if(method==='GET')return response({posts:post&&!archived?[post]:[],nextBefore:null,nextBeforeId:null});
   if(method==='DELETE'){
    if(id!==idA){crossDeletes++;return response({error:'NOT_FOUND'},404)}
    ownerDeletes++;post=null;return response({deleted:true});
   }
  }
  if(path==='/api/social/profiles'&&method==='GET'){
   if(failProfile)return response({error:'DOWN'},503);
   return response({profile:{id:idA,handle:'test_a'},posts:post?[post]:[],postsCount:post?1:0,nextOffset:null});
  }
  if(path==='/api/social/comments'&&method==='POST'){
   const data=JSON.parse(options.body);
   if(!post||data.postId!==postId)return response({error:'NOT_FOUND'},404);
   comment={id:commentId,author_id:idB,post_id:postId,body:data.body};
   return response({comment},201);
  }
  if(path==='/api/social/likes'&&method==='POST'){
   if(!post)return response({error:'NOT_FOUND'},404);
   liked=true;return response({liked:true});
  }
  if(path==='/api/social/archive'&&method==='PATCH'){
   if(id!==idA)return response({error:'FORBIDDEN'},403);
   archived=JSON.parse(options.body).archived;
   return response({post:{...post,archived_at:archived?'2026-10-18T00:00:00.000Z':null}});
  }
  return response({error:'UNRECOGNIZED'},503);
 };
 return {fetcher,calls,get state(){return{post,comment,liked,logins,ownerDeletes,crossDeletes}}};
}
test('B42 accepts only an exact isolated Vercel preview and Supabase project',()=>{
 assert.deepEqual(validateStagingE2EConfig(opts),{previewOrigin:new URL(preview).origin,stageOrigin:stage});
 for(const bad of ['https://jenios.com.br/','http://jenios-ecossistem-example-jenios.vercel.app/','https://rebzztxlzofxpfwjvbee.supabase.co/','https://jenios-ecossistem-example-jenios.vercel.app/unexpected'])
  assert.throws(()=>validateStagingE2EConfig({...opts,previewUrl:bad}),/S05_E2E_REFUSE_NON_PREVIEW_HOST/);
 assert.throws(()=>validateStagingE2EConfig({...opts,stageUrl:'https://igayfjorjmucthlfoasf.supabase.co'}),/REFUSE_NON_ISOLATED_SUPABASE/);
});
test('B42 requires two different independently provisioned test credentials',()=>{
 assert.throws(()=>validateStagingE2EConfig({...opts,emailB:opts.emailA}),/IDENTITIES_MUST_BE_DISTINCT/);
 assert.throws(()=>validateStagingE2EConfig({...opts,passwordA:''}),/TWO_TEST_IDENTITIES_REQUIRED/);
 assert.throws(()=>validateStagingE2EConfig({...opts,publishableKey:''}),/STAGING_PUBLISHABLE_KEY_REQUIRED/);
});
test('B42 full user-scoped client E2E survives relogin and leaves no test post',async()=>{
 const server=mockServer();
 const result=await certifyStagingFeed({...opts,fetcher:server.fetcher,now:()=>new Date('2026-10-18T01:00:00.000Z')});
 assert.equal(result.passed,11);
 assert.equal(result.cleaned,true);
 assert.equal(server.state.post,null);
 assert.ok(server.state.comment);
 assert.equal(server.state.liked,true);
 assert.equal(server.state.ownerDeletes,1);
 assert.equal(server.state.crossDeletes,1);
 assert.equal(server.state.logins,3);
 assert.ok(server.calls.every(c=>[new URL(stage).hostname,new URL(preview).hostname].includes(c.host)));
});
test('B42 a server-side profile failure still triggers owner-bound cleanup in finally',async()=>{
 const server=mockServer({failProfile:true});
 await assert.rejects(certifyStagingFeed({...opts,fetcher:server.fetcher}),/PROFILE_HTTP_503/);
 assert.equal(server.state.post,null);
 assert.equal(server.state.ownerDeletes,1);
});
test('B42 helper never contains public account provisioning, billing or production credentials',()=>{
 const helper=readFileSync('lib/social/staging-e2e.mjs','utf8');
 const cli=readFileSync('scripts/check-s05-authenticated-e2e.mjs','utf8');
 assert.doesNotMatch(helper+cli,/\/auth\/v1\/signup|\/auth\/v1\/admin|SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY|\/api\/jenios-pay|\/api\/platform\/checkout/);
 assert.match(cli,/S05_TEST_A_PASSWORD/);
 assert.match(cli,/S05_TEST_B_PASSWORD/);
 assert.match(helper,/cleanup='deleted-by-owner'/);
});
