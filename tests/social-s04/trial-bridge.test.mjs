import test from 'node:test';
import assert from 'node:assert/strict';
import {trialRequest,trialStatus} from '../../lib/platform/trial/trial-http.mjs';
import {verifyIdentityWithProvider} from '../../lib/platform/trial/verified-person-provider.mjs';
import {readFileSync} from 'node:fs';
const uid='11111111-1111-4111-8111-111111111111';
const now=Date.parse('2026-10-17T12:00:00Z');
const secret='unit-tests-only-pepper-do-not-deploy-1234567890';
const auth=async()=>({userId:uid,db:{},user:{id:uid}});
const token='validly-signed-provider-token-unique-id';
const evidence={userId:uid,verified:true,documentType:'CPF',document:'52998224725',verifiedAt:new Date(now-60000).toISOString(),expiresAt:new Date(now+240000).toISOString()};
const db={async rpc(){return {data:{outcome:'granted',started_at:new Date(now).toISOString(),expires_at:new Date(now+7*86400000).toISOString()}};}};
function request(body={verificationToken:token},headers={}){return new Request('https://jenios.example/api/platform/trial',{method:'POST',headers:{'content-type':'application/json','authorization':'Bearer valid',...headers},body:JSON.stringify(body)});}
test('trial is disabled unless two independent flags are enabled, without calling providers',async()=>{
 let called=0;const response=await trialRequest(request(),{context:()=>{called++;},enabled:false});
 assert.equal(response.status,503);assert.equal(called,0);
 const source=readFileSync('app/api/platform/trial/route.js','utf8');
 assert.match(source,/JENIOS_TRIAL_ENABLED/);assert.match(source,/JENIOS_TRIAL_ACTIVATION_APPROVED/);
 assert.doesNotMatch(source,/JENIOS_PAY|makePayment|chargeCustomer/);
});
test('trial POST refuses cross origin, irrelevant fields, non-json, oversized requests',async()=>{
 let called=0;const services={enabled:true,context:()=>{called++;return auth()},db,secret,verifyIdentity:async()=>evidence,now:()=>now};
 assert.equal((await trialRequest(request(undefined,{origin:'https://evil.example'}),services)).status,403);
 assert.equal((await trialRequest(request({verificationToken:token,userId:'victim'}),services)).status,400);
 assert.equal((await trialRequest(request(undefined,{'content-type':'text/plain'}),services)).status,415);
 assert.equal((await trialRequest(request(undefined,{'content-length':'999999'}),services)).status,413);
 assert.equal(called,0);
});
test('trial POST uses ONLY session owner and returns 168 hours without creating a charge',async()=>{
 let dbCalls=0;const store={async rpc(n,params){dbCalls++;assert.equal(n,'platform_grant_person_trial_v1');assert.equal(params.p_user_id,uid);assert.match(params.p_subject_digest,/^[0-9a-f]{64}$/);return db.rpc(n,params)}};
 const r=await trialRequest(request(),{enabled:true,context:auth,db:store,secret,verifyIdentity:async()=>evidence,now:()=>now});
 const j=await r.json();assert.equal(r.status,201);assert.equal(j.status,'granted');assert.equal(j.chargeCreated,false);assert.equal(dbCalls,1);
 assert.equal(Date.parse(j.expiresAt)-Date.parse(j.startedAt),7*86400000);
});
test('trial duplicate person yields no second grant',async()=>{
 const r=await trialRequest(request(),{enabled:true,context:auth,db:{rpc:async()=>({data:{outcome:'already_claimed'}})},secret,verifyIdentity:async()=>evidence,now:()=>now});
 assert.equal(r.status,409);assert.equal((await r.json()).eligible,false);
});
test('provider adapter validates HTTPS endpoint and response identity, ignores browser assertions',async()=>{
 const p={endpoint:'https://identity-provider.example/verify',apiKey:'a'.repeat(32),fetcher:async(url,opts)=>{
  assert.equal(new URL(url).protocol,'https:');assert.equal(opts.redirect,'error');assert.equal(JSON.parse(opts.body).subject_user_id,uid);
  return new Response(JSON.stringify(evidence),{status:200});
 }};
 const proof=await verifyIdentityWithProvider({userId:uid,verificationToken:token},p);
 assert.deepEqual(proof,evidence);
 for(const endpoint of ['http://identity-provider.example/verify','https://localhost:8443/verify','https://abc.example/?key=raw','https://any@abc.example/verify']){
  await assert.rejects(verifyIdentityWithProvider({userId:uid,verificationToken:token},{...p,endpoint}),{status:503});
 }
 await assert.rejects(verifyIdentityWithProvider({userId:uid,verificationToken:token},{...p,fetcher:async()=>new Response(JSON.stringify({...evidence,userId:'victim'}))}),{status:503});
});
test('trial status is scoped to session owner and expires with ledger timestamps',async()=>{
 const source={from(){return {select(){return this},eq(k,v){assert.equal(k,'user_id');assert.equal(v,uid);return this},async maybeSingle(){return {data:{user_id:uid,started_at:new Date(now).toISOString(),expires_at:new Date(now+7*86400000).toISOString()}}}}}};
 const req=new Request('https://jenios.example/api/platform/trial',{headers:{authorization:'Bearer valid'}});
 const a=await trialStatus(req,{enabled:true,context:auth,db:source,now:()=>now+3600000});
 assert.equal(a.status,200);assert.equal((await a.json()).active,true);
 const b=await trialStatus(req,{enabled:true,context:auth,db:source,now:()=>now+7*86400000});
 assert.equal((await b.json()).active,false);
});
