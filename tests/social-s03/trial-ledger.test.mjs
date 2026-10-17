import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validCpf,normalizeCpf,personDigest,trialAccessWindow,grantVerifiedPersonTrial,TRIAL_DURATION_MS} from '../../lib/platform/trial/person-ledger.mjs';
const uid='11111111-1111-4111-8111-111111111111',now=Date.parse('2026-10-17T20:00:00Z');
const secret='temporary-fixture-secret-ONLY-tests-NEVER-for-real-0123456789';
const cpf='529.982.247-25',user={id:uid,is_anonymous:false};
const evidence={userId:uid,verified:true,documentType:'CPF',document:cpf,verifiedAt:new Date(now-30000).toISOString(),expiresAt:new Date(now+120000).toISOString()};
const trusted=async()=>({...evidence});
function db(outcome='granted'){
 const calls=[];return {calls,async rpc(name,params){calls.push({name,params});return {data:{outcome,started_at:new Date(now).toISOString(),expires_at:new Date(now+TRIAL_DURATION_MS).toISOString()},error:null};}};
}
test('CPF validator normalizes verified CPF and rejects checksum/repeated digits',()=>{
 assert.equal(normalizeCpf(cpf),'52998224725');assert.equal(validCpf(cpf),true);
 for(const bad of ['11111111111','00000000000','52998224726','52998224724','529982247','ABC','123.456.789-00',null])assert.equal(validCpf(bad),false,String(bad));
});
test('HMAC key protects pseudonymous identity; neither email nor raw CPF is persisted',()=>{
 const h=personDigest(cpf,secret);assert.match(h,/^[a-f0-9]{64}$/);assert.equal(h,personDigest('52998224725',secret));assert.notEqual(h,personDigest(cpf,secret+'other'));
 assert(!h.includes('52998224725'));
});
test('missing HMAC pepper or invalid CPF fails closed',()=>{
 assert.throws(()=>personDigest(cpf,'short'),{status:503});assert.throws(()=>personDigest('11111111111',secret),{status:403});
});
test('grant emits no charge and calls only the atomic ledger RPC with subject digest',async()=>{
 const store=db();const r=await grantVerifiedPersonTrial({user,verifyIdentity:trusted,verificationToken:'signed-test-proof',db:store,secret,now:()=>now});
 assert.equal(r.status,'granted');assert.equal(r.chargeCreated,false);assert.equal(r.eligible,true);
 assert.equal(Date.parse(r.expiresAt)-Date.parse(r.startedAt),TRIAL_DURATION_MS);
 assert.equal(store.calls.length,1);assert.equal(store.calls[0].name,'platform_grant_person_trial_v1');
 assert.equal(store.calls[0].params.p_user_id,uid);assert.match(store.calls[0].params.p_subject_digest,/^[a-f0-9]{64}$/);
 assert(!JSON.stringify(store.calls).includes('52998224725'));
});
test('already claimed identity never yields a second trial, even with new email/device',async()=>{
 const store=db('already_claimed');const r=await grantVerifiedPersonTrial({user,verifyIdentity:trusted,db:store,secret,now:()=>now});assert.equal(r.eligible,false);assert.equal(r.chargeCreated,false);
});
for(const invalid of [{...evidence,userId:'someone-else'},{...evidence,verified:false},{...evidence,documentType:'RG'}, {...evidence,verifiedAt:new Date(now-11*60*1000).toISOString()},{...evidence,expiresAt:new Date(now).toISOString()}])
 test('unverified/mismatched/expired identity cannot reach ledger '+JSON.stringify(invalid).slice(0,45),async()=>{
  const store=db();await assert.rejects(grantVerifiedPersonTrial({user,verifyIdentity:async()=>invalid,db:store,secret,now:()=>now}),{status:403});assert.equal(store.calls.length,0);
 });
test('no identity provider, DB or secret fails closed',async()=>{
 for(const p of [{verifyIdentity:null,db:db(),secret},{verifyIdentity:trusted,db:null,secret},{verifyIdentity:trusted,db:db(),secret:null}])await assert.rejects(grantVerifiedPersonTrial({user,now:()=>now,...p}),{status:503});
});
test('anonymous user cannot trigger identity verification',async()=>{
 let contacted=false;await assert.rejects(grantVerifiedPersonTrial({user:{...user,is_anonymous:true},verifyIdentity:async()=>{contacted=true;return evidence},db:db(),secret}),{status:401});assert.equal(contacted,false);
});
test('ledger errors, missing rows and inconsistent durations never confirm access',async()=>{
 for(const store of [{async rpc(){throw Error('offline')}},{async rpc(){return {data:null,error:{message:'bad'}}}},{async rpc(){return {data:{outcome:'granted',started_at:new Date(now).toISOString(),expires_at:new Date(now+3600000).toISOString()},error:null}}}])
 await assert.rejects(grantVerifiedPersonTrial({user,verifyIdentity:trusted,db:store,secret,now:()=>now}),{status:503});
});
test('access expires after exactly 168 hours and never extends by new login',()=>{
 const start=new Date(now).toISOString();assert.equal(trialAccessWindow(start,now).remainingMs,TRIAL_DURATION_MS);
 assert.equal(trialAccessWindow(start,now+TRIAL_DURATION_MS-1).active,true);
 assert.equal(trialAccessWindow(start,now+TRIAL_DURATION_MS).active,false);
 assert.equal(trialAccessWindow(start,now-1).active,false);
});
test('SQL is staging only, unique per identity and account, server role only',()=>{
 const s=readFileSync('supabase/review-only/20261017_s03_platform_trial_STAGING_ONLY.sql','utf8');
 assert.match(s,/PROPOSAL ONLY/);assert.match(s,/subject_digest text PRIMARY KEY/);assert.match(s,/user_id uuid UNIQUE/);assert.match(s,/ON CONFLICT DO NOTHING/);
 assert.match(s,/GRANT EXECUTE.*service_role/);assert.match(s,/REVOKE ALL.*anon,authenticated/);
 assert.doesNotMatch(s,/CREATE POLICY.*authenticated/);
});
