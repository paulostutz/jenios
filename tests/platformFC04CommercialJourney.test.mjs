import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import https from 'node:https';
import {registerPlatformAccount,requestPlatformPasswordReset,signOutPlatform} from '../lib/platform/account-access.mjs';
import {saveVerifiedDiagnostic,readVerifiedDiagnostic} from '../lib/platform/diagnostic-server.mjs';
import {requirePayUser,isFinanceAdmin} from '../lib/pay/auth.mjs';
import {verifiedPlatformPlan,proPlanAccess} from '../lib/assistant/pro-access.mjs';
import {requireLearner} from '../lib/learning/access.mjs';
import {runTransactionalEmailBatch} from '../lib/email/transactional-delivery-worker.mjs';
import {journalKey} from '../lib/platform/simulation-journal.mjs';
import {commercialFixture,emailEnv,NOW,OWNER,OTHER,END} from './fixtures/fc04-commercial.mjs';

const savedFetch=globalThis.fetch,savedHttps=https.request;
before(()=>{globalThis.fetch=()=>assert.fail('FC04 real network prohibited');https.request=()=>assert.fail('FC04 real HTTPS prohibited');});
after(()=>{globalThis.fetch=savedFetch;https.request=savedHttps;});
const request=()=>new Request('https://jenios.example.invalid/fixture',{headers:{authorization:'Bearer fixture-session'}});
const transport=(messages,fail=false)=>async(url,options)=>{
 assert.equal(url,'https://api.resend.com/emails');assert.equal(options.method,'POST');
 const message=JSON.parse(options.body);assert.deepEqual(message.to,['customer@example.invalid']);
 assert.match(options.headers['Idempotency-Key'],/^[a-f0-9]{64}$/);messages.push(message);
 if(fail)throw Error('Fixture timeout after possible acceptance');
 return Response.json({id:'fc04-local-provider-receipt'});
};

test('FC04 local account and durable onboarding replay preserve account separation',async()=>{
 const f=commercialFixture(),calls=[];
 const auth={signUp:async(input)=>{calls.push(input);return {data:{session:null},error:null};},resetPasswordForEmail:async()=>({error:null})};
 const password='Fixture#OnlyPassword2026';
 await assert.rejects(registerPlatformAccount(auth,'customer@example.invalid',password,password,'https://jenios.example.invalid','false'));
 assert.equal(calls.length,0);
 const registered=await registerPlatformAccount(auth,' CUSTOMER@EXAMPLE.INVALID ',password,password,'https://jenios.example.invalid','true');
 assert.equal(registered.session,false);assert.equal(calls[0].email,'customer@example.invalid');
 const platformUser={id:'platform-fixture-owner'}; // Never inferred from the Social identity/email.
 const original=await saveVerifiedDiagnostic(f.db,platformUser,{answers:[4,4,4,4,4],timeframe:'SWING'});
 assert.equal(original.verified,true);
 assert.deepEqual(await saveVerifiedDiagnostic(f.db,platformUser,{answers:[0,0,0,0,0],timeframe:'RAPIDO'}),original);
 assert.equal(f.db.writes.length,1);
 assert.deepEqual(await readVerifiedDiagnostic(f.db,{id:OWNER}),{completed:false,verified:false});
 const reset=await requestPlatformPasswordReset(auth,'customer@example.invalid','https://jenios.example.invalid');
 assert.equal(await requestPlatformPasswordReset(auth,'absent@example.invalid','https://jenios.example.invalid'),reset);
});

test('FC04 fixture plan activation reaches access and notification through existing modules',async()=>{
 const f=commercialFixture(),messages=[];
 const identity=await requirePayUser(request(),f.db);
 const plan=await verifiedPlatformPlan(f.db,identity.id,NOW);
 assert.equal(proPlanAccess(plan,identity,{}).universityIncluded,true);
 const learner=await requireLearner(request(),f.db,NOW,{});
 assert.equal(learner.access.productCode,'platform-global-crypto');
 const first=await runTransactionalEmailBatch({db:f.db,env:emailEnv,fetcher:transport(messages)});
 assert.equal(first.sent,1);assert.equal(f.queue.status,'sent');
 assert.match(messages[0].html,/Global Crypto/);
 assert.equal((await runTransactionalEmailBatch({db:f.db,env:emailEnv,fetcher:transport(messages)})).claimed,0);
 console.log('FC04_FIXTURE_TRACE '+JSON.stringify({source:'LOCAL_FIXTURE_ONLY',steps:['pay_identity_verified','subscription_access_resolved','university_access_resolved','activation_message_composed','fake_delivery_acknowledged'],externalRequests:0,realEmails:0,chargesCreated:0,databaseLifecycleExecuted:false}));
});

test('FC04 cancellation schedule retains access only until the exact period boundary',async()=>{
 const f=commercialFixture(),messages=[];
 f.subscription.cancel_at_period_end=true;f.queue.event_kind='plan_cancel_scheduled';
 assert.equal(proPlanAccess(await verifiedPlatformPlan(f.db,OWNER,Date.parse(END)-1),f.user,{}).proIncluded,true);
 assert.equal((await runTransactionalEmailBatch({db:f.db,env:emailEnv,fetcher:transport(messages)})).sent,1);
 assert.match(messages[0].html,/cancelamento/i);
 assert.equal(await verifiedPlatformPlan(f.db,OWNER,Date.parse(END)),null);
 f.subscription.status='cancelled';f.queue.event_kind='plan_cancelled';f.queue.status='pending';
 assert.equal(await verifiedPlatformPlan(f.db,OWNER,NOW),null);
 assert.equal((await runTransactionalEmailBatch({db:f.db,env:emailEnv,fetcher:transport(messages)})).sent,1);
 for(const status of ['past_due','expired','suspended','cancelled']){
  f.subscription.status=status;assert.equal(await verifiedPlatformPlan(f.db,OWNER,NOW),null);
 }
});

test('FC04 foreign or unpaid subscription evidence cannot notify or grant another account access',async()=>{
 for(const change of ['foreign','unpaid','revoked']){
  const f=commercialFixture(),messages=[];
  if(change==='foreign')f.order.user_id=OTHER;
  if(change==='unpaid')f.order.status='pending';
  if(change==='revoked')f.entitlement.status='revoked';
  assert.equal(await verifiedPlatformPlan(f.db,OTHER,NOW),null);
  const result=await runTransactionalEmailBatch({db:f.db,env:emailEnv,fetcher:transport(messages)});
  assert.equal(result.sent,0);assert.equal(result.blocked,1);assert.equal(messages.length,0);
 }
 const f=commercialFixture();f.db.viewer={...f.user,user_metadata:{role:'master'}};
 assert.equal(isFinanceAdmin(f.db.viewer,{}),false);
 await assert.rejects(requirePayUser(request(),f.db,true),{status:403});
 f.db.viewer={...f.user,is_anonymous:true};await assert.rejects(requirePayUser(request(),f.db),{status:401});
});

test('FC04 uncertain email transport is quarantined without a success claim or automatic resend',async()=>{
 const f=commercialFixture(),messages=[];
 const result=await runTransactionalEmailBatch({db:f.db,env:emailEnv,fetcher:transport(messages,true)});
 assert.equal(result.sent,0);assert.equal(result.blocked,1);assert.equal(f.queue.status,'uncertain');
 const release=f.db.rpcCalls.find(x=>x.name==='jenios_release_transactional_email_b305');
 assert.equal(release.args.p_retryable,false);assert.equal(release.args.p_error_code,'RESEND_DELIVERY_UNCERTAIN');
 assert.equal((await runTransactionalEmailBatch({db:f.db,env:emailEnv,fetcher:transport(messages)})).claimed,0);
 assert.equal(messages.length,1);
});

test('FC04 closed email gate, unavailable subscription DB and logout preserve access boundaries',async()=>{
 const f=commercialFixture();
 const disabled=await runTransactionalEmailBatch({db:f.db,env:{...emailEnv,JENIOS_TRANSACTIONAL_EMAILS_ENABLED:'false'},fetcher:()=>assert.fail('Transport called')});
 assert.equal(disabled.status,'DISABLED');assert.equal(f.db.rpcCalls.length,0);
 f.db.failTable='jenios_pay_subscriptions';await assert.rejects(verifiedPlatformPlan(f.db,OWNER,NOW),{status:503});
 const values=new Map([[journalKey(OWNER),'local simulation'],[journalKey(OTHER),'other owner'],['social-session','social']]);
 await signOutPlatform({signOut:async()=>({error:null})},{removeItem:k=>values.delete(k)},OWNER);
 assert.equal(values.has(journalKey(OWNER)),false);assert.equal(values.get(journalKey(OTHER)),'other owner');assert.equal(values.get('social-session'),'social');
});
