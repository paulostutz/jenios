import test from 'node:test';
import assert from 'node:assert/strict';
import {productionEmailDeliveryPolicy} from '../lib/email/production-delivery-policy.mjs';
import {financeEmailDispatchReadiness} from '../lib/email/finance-payment-confirmation.mjs';
import {runFinanceOutboxBatch as actualFinanceOutboxBatch} from '../lib/email/finance-outbox-worker.mjs';
import {runPrivateFinanceEmailQa} from '../lib/email/finance-private-runner.mjs';
import {runTransactionalEmailBatch as actualTransactionalEmailBatch,runDunningEmailBatch as actualDunningEmailBatch} from '../lib/email/transactional-delivery-worker.mjs';
import {runMarketingEmailBatch as actualMarketingEmailBatch} from '../lib/email/marketing-delivery-worker.mjs';
import {marketNewsletterEmail} from '../lib/email/lifecycle-campaigns.mjs';

// Synthetic scope and credentials: every enabled test injects a fake database
// and fake transport. This suite performs no network or provider operations.
const env=Object.freeze({
 VERCEL_ENV:'production',VERCEL_PROJECT_ID:'prj_syntheticProd123456',
 VERCEL_GIT_COMMIT_REF:'release/email-tests',
 NEXT_PUBLIC_SUPABASE_URL:'https://abcdefghijklmnopqrst.supabase.co',
 JENIOS_EMAIL_PRODUCTION_ENABLED:'true',
 JENIOS_EMAIL_DELIVERY_START_AT:'2026-10-22T00:00:00Z',JENIOS_EMAIL_MAX_EVENT_AGE_HOURS:'168',
 JENIOS_EMAIL_DISPATCH_BATCH_LIMIT:'2',
 JENIOS_RESEND_WEBHOOK_ENABLED:'true',JENIOS_RESEND_WEBHOOK_ENDPOINT_CERTIFIED:'true',
 RESEND_WEBHOOK_SECRET:'whsec_'+Buffer.from('r42-local-only-fixture-signing-key').toString('base64'),
 JENIOS_EMAIL_PRODUCTION_PROJECT_ID:'prj_syntheticProd123456',
 JENIOS_EMAIL_PRODUCTION_BRANCH:'release/email-tests',
 JENIOS_EMAIL_PRODUCTION_SUPABASE_URL:'https://abcdefghijklmnopqrst.supabase.co',
 JENIOS_B305_TEST_SEND_APPROVED:'false',JENIOS_B305_PRIVATE_EMAIL_RUNNER_ENABLED:'false',
 JENIOS_B305_QA_TEST_ROUTE_ARMED:'false',CRON_SECRET:'synthetic-test-only-internal-auth-secret',
 JENIOS_PAYMENT_EMAILS_ENABLED:'true',JENIOS_TRANSACTIONAL_EMAILS_ENABLED:'true',
 JENIOS_MARKETING_EMAILS_ENABLED:'true',
 JENIOS_PAYMENT_EMAIL_FROM:'Financeiro JENIOS <financeiro@jenios.com.br>',
 RESEND_API_KEY:'re_testnotreal123456789',SUPABASE_SECRET_KEY:'sb_secret_synthetic_test_only',
 JENIOS_RESEND_EXPECTED_DOMAIN:'jenios.com.br',JENIOS_RESEND_DOMAIN_VERIFIED:'true'
});
const now=Date.parse('2026-10-24T12:00:00Z');
const runFinanceOutboxBatch=options=>actualFinanceOutboxBatch({now,...options});
const runTransactionalEmailBatch=options=>actualTransactionalEmailBatch({now,...options});
const runDunningEmailBatch=options=>actualDunningEmailBatch({now,...options});
const runMarketingEmailBatch=options=>actualMarketingEmailBatch({now,...options});
const identity=(id,email=id+'@example.com')=>({id,email,is_anonymous:false,
 email_confirmed_at:'2026-10-22T10:00:00Z',user_metadata:{registration_source:'social'}});
async function withoutTransport(run,options){
 let calls=0;
 const result=await run({...options,fetcher:async()=>{calls++;throw Error('unexpected synthetic transport');}});
 // Workers intentionally catch adapter errors, so the assertion belongs here.
 assert.equal(calls,0,'Transport must not be reached');
 return result;
}

function fakeDb({rows=[],users={},tables={},completeOk=true}={}){
 const calls=[];
 return {calls,
  auth:{admin:{getUserById:async id=>({data:{user:users[id]??null},error:null})}},
  rpc:async(name,args)=>{
   calls.push({name,args});
   if(name==='jenios_reserve_email_budget_r42')return {data:[{allowed:true,reason:'RESERVED',reused:false,reservation_id:'00000099-2222-4333-8444-555555555555'}],error:null};
   if(name.startsWith('jenios_claim_'))return {data:rows.slice(0,args.p_limit).map(row=>({created_at:new Date(now).toISOString(),due_at:new Date(now).toISOString(),...row})),error:null};
   return {data:name.startsWith('jenios_complete_')?completeOk:true,error:null};
  },
  from(table){
   const filters=[];
   const chain={select:()=>chain,eq:(key,value)=>{filters.push([key,value]);return chain;},
    in:()=>chain,not:()=>chain,order:()=>chain,limit:()=>chain,
    maybeSingle:async()=>{
     const source=tables[table];
     const data=Array.isArray(source)?source.find(row=>filters.every(([k,v])=>row[k]===v)):source;
     return {data:data??null,error:null};
    }};
   return chain;
  }
 };
}
function transportSpy(){
 const calls=[];
 return {calls,fetcher:async(url,options)=>{
  assert.equal(url,'https://api.resend.com/emails');
  assert.match(options.headers['Idempotency-Key'],/^[a-f0-9]{64}$/);
  calls.push({message:JSON.parse(options.body),key:options.headers['Idempotency-Key']});
  return {ok:true,status:200,json:async()=>({id:'synthetic_email_'+calls.length})};
 }};
}
function paymentFixture(n=1){
 const orderId=String(n).padStart(8,'0')+'-2222-4333-8444-555555555555';
 const paymentId=String(n+10).padStart(8,'0')+'-2222-4333-8444-555555555555';
 const userId=String(n+20).padStart(8,'0')+'-2222-4333-8444-555555555555';
 const receipt='E'+String(n).repeat(31);
 const row={id:orderId,order_id:orderId,payment_id:paymentId,recipient_user_id:userId,
  lease_token:'lease-'+n,recipient_email:null,recipient_name:'Cliente',product_name:'Plano',
  amount_cents:14990,currency:'BRL',paid_at:'2026-10-22T12:00:00Z',bank_receipt_id:receipt};
 return {row,user:identity(userId,'cliente'+n+'@example.com'),
  order:{id:orderId,user_id:userId,status:'paid',currency:'BRL',provider:'inter_pix',amount_cents:14990},
  payment:{id:paymentId,order_id:orderId,provider:'inter_pix',payment_method:'pix',
   provider_payment_id:orderId.replace(/-/g,''),status:'confirmed',amount_cents:14990,
   bank_end_to_end_id:receipt,confirmed_at:row.paid_at}};
}
function financeDb(fixtures){
 return fakeDb({rows:fixtures.map(x=>x.row),users:Object.fromEntries(fixtures.map(x=>[x.user.id,x.user])),
  tables:{jenios_pay_orders:fixtures.map(x=>x.order),jenios_pay_payments:fixtures.map(x=>x.payment)}});
}

test('R40 all delivery workers reject incomplete or cross-environment production scopes before I/O',async()=>{
 const invalid=[{}, {...env,JENIOS_EMAIL_PRODUCTION_ENABLED:'false'},
  {...env,JENIOS_EMAIL_PRODUCTION_ENABLED:undefined},{...env,VERCEL_ENV:'preview'},
  {...env,VERCEL_PROJECT_ID:'prj_unexpected123456'},
  {...env,JENIOS_EMAIL_PRODUCTION_PROJECT_ID:'prj_9cRnjWFRsLkfTToF4U4xZQBa7Gq9',VERCEL_PROJECT_ID:'prj_9cRnjWFRsLkfTToF4U4xZQBa7Gq9'},
  {...env,VERCEL_GIT_COMMIT_REF:'unexpected'},
  {...env,JENIOS_EMAIL_PRODUCTION_BRANCH:'fix/jenios-b305-finance-email-20261022',VERCEL_GIT_COMMIT_REF:'fix/jenios-b305-finance-email-20261022'},
  {...env,NEXT_PUBLIC_SUPABASE_URL:'https://otherotherotherother.supabase.co'},
  ...['https://rebzztxlzofxpfwjvbee.supabase.co','https://xaicvhagftzjkqphnbgx.supabase.co'].map(url=>
   ({...env,NEXT_PUBLIC_SUPABASE_URL:url,JENIOS_EMAIL_PRODUCTION_SUPABASE_URL:url})),
  {...env,CRON_SECRET:undefined},{...env,CRON_SECRET:'short'},
  ...['JENIOS_B305_TEST_SEND_APPROVED','JENIOS_B305_PRIVATE_EMAIL_RUNNER_ENABLED','JENIOS_B305_QA_TEST_ROUTE_ARMED']
   .flatMap(key=>[{...env,[key]:'true'},{...env,[key]:undefined}])];
 for(const settings of invalid){
  assert.equal(productionEmailDeliveryPolicy(settings).ready,false);
  for(const run of [runFinanceOutboxBatch,runTransactionalEmailBatch,runDunningEmailBatch,runMarketingEmailBatch]){
   const db=fakeDb();
   const result=await withoutTransport(run,{db,env:settings});
   assert.equal(result.status,'DISABLED');assert.equal(db.calls.length,0);
  }
 }
});

test('R40 production scope preserves each channel gate and does not certify or mutate configuration',async()=>{
 assert.equal(productionEmailDeliveryPolicy(env).ready,true);
 const before=JSON.stringify(env);
 const policy=productionEmailDeliveryPolicy(env);
 assert.ok(Object.values(policy).every(value=>typeof value==='boolean'));
 assert.equal(Object.keys(policy).some(key=>/certified/i.test(key)),false);
 for(const [run,key] of [[runFinanceOutboxBatch,'JENIOS_PAYMENT_EMAILS_ENABLED'],
  [runTransactionalEmailBatch,'JENIOS_TRANSACTIONAL_EMAILS_ENABLED'],
  [runDunningEmailBatch,'JENIOS_TRANSACTIONAL_EMAILS_ENABLED'],
  [runMarketingEmailBatch,'JENIOS_MARKETING_EMAILS_ENABLED']]){
  for(const value of ['false',undefined]){
   const db=fakeDb();
   const result=await withoutTransport(run,{db,env:{...env,[key]:value}});
   assert.equal(result.status,'DISABLED');assert.equal(db.calls.length,0);
  }
 }
 assert.equal(JSON.stringify(env),before);
});

test('R40 production finance uses each verified customer, distinct idempotency and completion ledger',async()=>{
 const fixtures=[paymentFixture(1),paymentFixture(2)],db=financeDb(fixtures),transport=transportSpy();
 const result=await runFinanceOutboxBatch({db,env,fetcher:transport.fetcher,limit:2});
 assert.deepEqual(result,{status:'PRODUCTION',claimed:2,sent:2,blocked:0});
 assert.deepEqual(transport.calls.map(x=>x.message.to),[['cliente1@example.com'],['cliente2@example.com']]);
 assert.notEqual(transport.calls[0].key,transport.calls[1].key);
 assert.equal(db.calls.filter(x=>x.name==='jenios_complete_pay_email_b305').length,2);
 assert.equal(db.calls[0].args.p_limit,2);
});

test('R40 production finance rejects stale bank evidence, wrong ownership and unverified identities',async()=>{
 const changes=[x=>{x.order.status='pending'},x=>{x.order.user_id='other'},
  x=>{x.payment.amount_cents++},x=>{x.payment.provider_payment_id='different'},
  x=>{x.payment.bank_end_to_end_id='E'+'9'.repeat(31)},
  x=>{x.user.email_confirmed_at=null},x=>{x.user.is_anonymous=true},
  x=>{x.row.recipient_email='changed@example.com'}];
 for(const change of changes){
  const fixture=paymentFixture();change(fixture);const db=financeDb([fixture]);
  const result=await withoutTransport(runFinanceOutboxBatch,{db,env});
  assert.equal(result.sent,0);assert.equal(result.blocked,1);
  assert.equal(db.calls.some(x=>x.name==='jenios_complete_pay_email_b305'),false);
  assert.equal(db.calls.find(x=>x.name==='jenios_release_pay_email_b305').args.p_retryable,false);
 }
});

test('R40 production finance quarantines ambiguous transport and unconfirmed ledger completion',async()=>{
 for(const ambiguous of ['transport','ledger']){
  const db=financeDb([paymentFixture()]),transport=transportSpy();
  if(ambiguous==='ledger'){
   const rpc=db.rpc;db.rpc=async(name,args)=>name==='jenios_complete_pay_email_b305'
    ?{data:false,error:null}:rpc(name,args);
  }
  const result=await runFinanceOutboxBatch({db,env,fetcher:ambiguous==='transport'
   ?async()=>{throw Error('synthetic disconnect')}:transport.fetcher});
  assert.equal(result.sent,0);assert.equal(result.blocked,1);
  const release=db.calls.find(x=>x.name==='jenios_release_pay_email_b305');
  assert.equal(release.args.p_retryable,false);
  assert.equal(release.args.p_error_code,ambiguous==='transport'?'RESEND_DELIVERY_UNCERTAIN':'FINANCE_DELIVERY_LEDGER_UNCONFIRMED');
 }
});

test('R40 QA finance remains allowlisted to one send and its private runner rejects production',async()=>{
 const qa={...env,JENIOS_EMAIL_PRODUCTION_ENABLED:'false',VERCEL_ENV:'preview',
  VERCEL_PROJECT_ID:'prj_9cRnjWFRsLkfTToF4U4xZQBa7Gq9',JENIOS_B305_QA_PROJECT_ID:'prj_9cRnjWFRsLkfTToF4U4xZQBa7Gq9',
  VERCEL_GIT_COMMIT_REF:'fix/jenios-b305-finance-email-20261022',NEXT_PUBLIC_SUPABASE_URL:'https://rebzztxlzofxpfwjvbee.supabase.co',
  JENIOS_PAY_PAYMENTS_ENABLED:'false',JENIOS_INTER_CHARGES_ENABLED:'false',JENIOS_REAL_EXECUTION_ENABLED:'false',
  JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED:'false',JENIOS_PRIVATE_PAPER_EXECUTOR:'false',
  JENIOS_B305_TEST_SEND_APPROVED:'true',JENIOS_EMAIL_TEST_RECIPIENT:'cliente1@example.com'};
 const db=financeDb([paymentFixture(1),paymentFixture(2)]),transport=transportSpy();
 assert.equal(financeEmailDispatchReadiness(qa).mode,'qa');
 const result=await runFinanceOutboxBatch({db,env:qa,fetcher:transport.fetcher,limit:10});
 assert.equal(result.status,'QA_ONLY');assert.equal(result.sent,1);assert.equal(db.calls[0].args.p_limit,1);
 const blocked=await withoutTransport(runFinanceOutboxBatch,{db:financeDb([paymentFixture(2)]),env:qa});
 assert.equal(blocked.sent,0);assert.equal(blocked.blocked,1);
 const prodDb=fakeDb();
 assert.equal((await withoutTransport(runPrivateFinanceEmailQa,{db:prodDb,env})).status,'DISABLED');
 assert.equal(prodDb.calls.length,0);
});

test('R40 production welcome keeps identity and event checks with the transactional ledger',async()=>{
 const row={id:'welcome1',lease_token:'lease1',event_kind:'social_welcome',user_id:'u1'};
 const user=identity('u1');
 const db=fakeDb({rows:[row],users:{u1:user}}),transport=transportSpy();
 const result=await runTransactionalEmailBatch({db,env,fetcher:transport.fetcher});
 assert.equal(result.status,'PRODUCTION');assert.equal(result.sent,1);
 assert.ok(db.calls.some(x=>x.name==='jenios_complete_transactional_email_b305'));
 for(const invalidUser of [{...user,email_confirmed_at:null},{...user,user_metadata:{}},{...user,id:'other'}]){
  const blocked=await withoutTransport(runTransactionalEmailBatch,{env,db:fakeDb({rows:[row],users:{u1:invalidUser}})});
  assert.equal(blocked.sent,0);assert.equal(blocked.blocked,1);
 }
});

test('R40 production cancellation notice requires server cancellation and the seven-day boundary',async()=>{
 const row={id:'dunning1',lease_token:'lease1',user_id:'u1',subscription_id:'s1',product_id:'p1',
  event_kind:'cancelled_7d',due_at:'2026-10-17T12:00:00Z'};
 const subscription={id:'s1',user_id:'u1',product_id:'p1',status:'cancelled',current_period_end:row.due_at};
 const dbFor=sub=>fakeDb({rows:[row],users:{u1:identity('u1')},tables:{jenios_pay_subscriptions:sub,
  jenios_pay_products:{id:'p1',category:'platform',billing_type:'monthly',name:'Plano'}}});
 const db=dbFor(subscription),transport=transportSpy();
 const result=await runDunningEmailBatch({db,env,now,fetcher:transport.fetcher});
 assert.equal(result.status,'PRODUCTION');assert.equal(result.sent,1);
 assert.ok(db.calls.some(x=>x.name==='jenios_complete_dunning_email_b305'));
 for(const [sub,time] of [[{...subscription,status:'active'},now],[subscription,now-1],[{...subscription,user_id:'other'},now]]){
  const blocked=await withoutTransport(runDunningEmailBatch,{db:dbFor(sub),env,now:time});
  assert.equal(blocked.sent,0);assert.equal(blocked.blocked,1);
 }
});

function marketingDb({pref={},history=null,active=null}={}){
 return fakeDb({rows:[{id:'n1',lease_token:'lease1',campaign_kind:'no_plan_nurture',step:1,user_id:'u1',campaign_key:'u1'}],
  users:{u1:identity('u1')},tables:{jenios_email_preferences_b305:pref===null?null:{user_id:'u1',marketing_opt_in:true,
   opted_out_at:null,complaint_at:null,hard_bounce_at:null,...pref},
   jenios_marketing_email_ledger_b305:history,jenios_pay_subscriptions:active}});
}

test('R40 production marketing retains consent, suppression, active-plan and frequency limits',async()=>{
 for(const settings of [{pref:null},{pref:{marketing_opt_in:false}},
  {pref:{opted_out_at:'2026-10-23T00:00:00Z'}},{pref:{complaint_at:'2026-10-23T00:00:00Z'}},
  {pref:{hard_bounce_at:'2026-10-23T00:00:00Z'}},{history:{sent_at:'2026-10-23T12:00:00Z'}},{active:{id:'s1'}}]){
  const db=marketingDb(settings);
  const result=await withoutTransport(runMarketingEmailBatch,{db,env,now});
  assert.equal(result.sent,0);assert.equal(result.suppressed,1);
  assert.ok(db.calls.some(x=>x.name==='jenios_suppress_marketing_email_b305'));
 }
 const db=marketingDb(),transport=transportSpy();
 const result=await runMarketingEmailBatch({db,env,now,fetcher:transport.fetcher});
 assert.equal(result.status,'PRODUCTION');assert.equal(result.sent,1);
 assert.ok(db.calls.some(x=>x.name==='jenios_complete_marketing_email_b305'));
});

test('R40 one newsletter edition has stable retry keys per recipient and distinct keys across recipients',async()=>{
 const edition={id:'edition1',edition_key:'2026-W43',status:'approved',scheduled_at:'2026-10-24T10:00:00Z',
  items:[{title:'Mercado',summary:'Resumo sintético',sourceName:'Exemplo',sourceUrl:'https://example.com/source'}]};
 const rows=['u1','u2'].map(user_id=>({id:'newsletter-'+user_id,lease_token:'lease-'+user_id,
  user_id,campaign_kind:'newsletter',step:0,newsletter_edition_id:edition.id,campaign_key:edition.edition_key}));
 const db=fakeDb({rows,users:{u1:identity('u1'),u2:identity('u2')},tables:{
  jenios_email_preferences_b305:['u1','u2'].map(user_id=>({user_id,marketing_opt_in:true})),
  jenios_newsletter_editions_b305:edition}}),transport=transportSpy();
 const result=await runMarketingEmailBatch({db,env,now,fetcher:transport.fetcher,limit:2});
 assert.equal(result.sent,2);assert.equal(transport.calls.length,2);
 assert.notEqual(transport.calls[0].key,transport.calls[1].key);
 const message=to=>marketNewsletterEmail({editionId:edition.edition_key,to,items:edition.items,unsubscribeUrl:'https://example.com/preferences'});
 assert.equal(message('u1@example.com').idempotencyKey,message('U1@EXAMPLE.COM').idempotencyKey);
 assert.equal(message('U1@EXAMPLE.COM').to,'u1@example.com');
 assert.equal(message('u1@example.com').idempotencyKey,transport.calls[0].key);
 assert.equal(db.calls.filter(x=>x.name==='jenios_complete_marketing_email_b305').length,2);
});
