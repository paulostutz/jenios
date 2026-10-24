import test from 'node:test';
import assert from 'node:assert/strict';
import {emailDispatchLimits,emailEventIsCurrent,reserveEmailDelivery} from '../lib/email/dispatch-budget.mjs';
import {handleEmailDispatcher,runEmailDispatcher} from '../lib/email/email-dispatcher.mjs';
import {runFinanceOutboxBatch} from '../lib/email/finance-outbox-worker.mjs';
import {runTransactionalEmailBatch,runDunningEmailBatch} from '../lib/email/transactional-delivery-worker.mjs';
import {runMarketingEmailBatch} from '../lib/email/marketing-delivery-worker.mjs';
import {emailReleaseReadiness,emailCredentialSummary} from '../lib/email/admin-health.mjs';
import {EMAIL_DATABASE_OBJECTS} from '../lib/email/database-preflight.mjs';

const now=Date.parse('2026-10-24T18:00:00Z');
const stamp='2026-10-24T17:00:00Z';
const uuid=n=>String(n).padStart(8,'0')+'-2222-4333-8444-555555555555';
const userId=uuid(1),orderId=uuid(2),paymentId=uuid(3),productId=uuid(4),subscriptionId=uuid(5);
const env=Object.freeze({
 VERCEL_ENV:'production',VERCEL_PROJECT_ID:'prj_fixtureProduction42',VERCEL_GIT_COMMIT_REF:'release/fixture-email-r42',
 NEXT_PUBLIC_SUPABASE_URL:'https://abcdefghijklmnopqrst.supabase.co',
 JENIOS_EMAIL_PRODUCTION_PROJECT_ID:'prj_fixtureProduction42',JENIOS_EMAIL_PRODUCTION_BRANCH:'release/fixture-email-r42',
 JENIOS_EMAIL_PRODUCTION_SUPABASE_URL:'https://abcdefghijklmnopqrst.supabase.co',
 JENIOS_B305_TEST_SEND_APPROVED:'false',JENIOS_B305_PRIVATE_EMAIL_RUNNER_ENABLED:'false',JENIOS_B305_QA_TEST_ROUTE_ARMED:'false',
 CRON_SECRET:'local-only-fixture-internal-secret-r42',JENIOS_EMAIL_PRODUCTION_ENABLED:'true',
 JENIOS_EMAIL_DISPATCHER_ENABLED:'true',JENIOS_EMAIL_DELIVERY_START_AT:'2026-10-24T16:00:00Z',
 JENIOS_PAYMENT_EMAILS_ENABLED:'true',JENIOS_TRANSACTIONAL_EMAILS_ENABLED:'true',JENIOS_SUBSCRIPTION_DUNNING_ENABLED:'true',
 JENIOS_MARKETING_PLANNER_ENABLED:'true',JENIOS_MARKETING_EMAILS_ENABLED:'true',
 JENIOS_RESEND_WEBHOOK_ENABLED:'true',JENIOS_RESEND_WEBHOOK_ENDPOINT_CERTIFIED:'true',
 RESEND_WEBHOOK_SECRET:'whsec_'+Buffer.from('r42-local-only-fixture-signing-key').toString('base64'),
 RESEND_API_KEY:'re_local_only_fixture123',SUPABASE_SECRET_KEY:'sb_secret_local_only_fixture',
 JENIOS_PAYMENT_EMAIL_FROM:'Financeiro JENIOS <financeiro@jenios.com.br>',
 JENIOS_RESEND_EXPECTED_DOMAIN:'jenios.com.br',JENIOS_RESEND_DOMAIN_VERIFIED:'true'
});

function fixtures(){
 return {
  finance:{id:uuid(10),lease_token:uuid(20),order_id:orderId,payment_id:paymentId,recipient_user_id:userId,
   amount_cents:14990,currency:'BRL',paid_at:stamp,bank_receipt_id:'E'+'1'.repeat(31)},
  transactional:{id:uuid(11),lease_token:uuid(21),user_id:userId,event_kind:'social_welcome',created_at:stamp},
  dunning:{id:uuid(12),lease_token:uuid(22),user_id:userId,subscription_id:subscriptionId,product_id:productId,
   event_kind:'due_today',due_at:stamp,created_at:stamp},
  marketing:{id:uuid(13),lease_token:uuid(23),user_id:userId,campaign_kind:'newsletter',campaign_key:'edition-r42',
   newsletter_edition_id:uuid(6),step:0,due_at:stamp,created_at:stamp}
 };
}

function fakeDb({rows=fixtures(),budget=null,failRpc=null,identityPatch={}}={}){
 const calls=[],reservations=new Map();
 const tables={
  jenios_pay_orders:{id:orderId,user_id:userId,status:'paid',amount_cents:14990,currency:'BRL',provider:'inter_pix'},
  jenios_pay_payments:{id:paymentId,order_id:orderId,provider:'inter_pix',payment_method:'pix',status:'confirmed',
   provider_payment_id:orderId.replace(/-/g,''),amount_cents:14990,bank_end_to_end_id:'E'+'1'.repeat(31),confirmed_at:stamp},
  jenios_pay_subscriptions:{id:subscriptionId,user_id:userId,product_id:productId,status:'active',current_period_end:stamp},
  jenios_pay_products:{id:productId,name:'Plano',category:'platform',billing_type:'monthly',active:true},
  jenios_email_preferences_b305:{user_id:userId,marketing_opt_in:true,opted_out_at:null,complaint_at:null,hard_bounce_at:null},
  jenios_marketing_email_ledger_b305:null,
  jenios_newsletter_editions_b305:{id:uuid(6),edition_key:'edition-r42',status:'approved',scheduled_at:stamp,
   items:[{title:'Fonte local',summary:'Fixture sem envio externo',sourceName:'Exemplo',sourceUrl:'https://example.com/source'}]}
 };
 const channels={pay:'finance',transactional:'transactional',dunning:'dunning',marketing:'marketing'};
 return {calls,tables,reservations,
  auth:{admin:{getUserById:async id=>{
   calls.push({name:'auth',id});return {data:{user:{id,email:'fixture@example.com',email_confirmed_at:stamp,
    is_anonymous:false,user_metadata:{registration_source:'social'},...identityPatch}},error:null};
  }}},
  async rpc(name,args){
   calls.push({name,args});
   if(name===failRpc)throw Error('private provider and database detail');
   const claim=/^jenios_claim_(pay|transactional|dunning|marketing)_email_r42$/.exec(name);
   if(claim){const row=rows[channels[claim[1]]];return {data:row?[row].slice(0,args.p_limit):[],error:null};}
   if(name==='jenios_reserve_email_budget_r42'){
    if(budget)return {data:[await budget(args)],error:null};
    const key=args.p_channel+':'+args.p_id+':'+args.p_idempotency_key;
    const reused=reservations.has(key);reservations.set(key,true);
    return {data:[{allowed:true,reason:reused?'REUSED':'RESERVED',retry_at:null,reservation_id:uuid(30),reused}],error:null};
   }
   if(name==='jenios_process_subscription_dunning_r42')return {data:[{queued:0,marked_past_due:0,cancelled:0,revoked:0}],error:null};
   if(name==='jenios_plan_marketing_emails_r42')return {data:[{planned:0,suppressed:0}],error:null};
   if(/^jenios_(complete|release|defer|suppress)_/.test(name))return {data:true,error:null};
   throw Error('Unexpected local RPC: '+name);
  },
  from(table){
   const query={select:()=>query,eq:()=>query,in:()=>query,not:()=>query,order:()=>query,limit:()=>query,
    maybeSingle:async()=>({data:tables[table]??null,error:null})};return query;
  }
 };
}

function transport(){
 const calls=[];
 return {calls,fetcher:async(url,options)=>{
  assert.equal(url,'https://api.resend.com/emails');
  assert.ok(options.signal instanceof AbortSignal);
  calls.push({key:options.headers['Idempotency-Key'],body:JSON.parse(options.body)});
  return {ok:true,json:async()=>({id:'local-provider-id-'+calls.length})};
 }};
}

const request=({method='GET',authorization='Bearer '+env.CRON_SECRET}={})=>
 new Request('https://fixture.invalid/api/internal/email/dispatch?limit=999&recipient=unexpected@example.com',
  {method,headers:{authorization}});

test('R42 defaults bound application usage and preserve capacity for essential messages',()=>{
 const limits=emailDispatchLimits(env,now);
 assert.equal(limits.ready,true);assert.equal(limits.dailyLimit,40);assert.equal(limits.monthlyLimit,1000);
 assert.equal(limits.marketingDailyLimit,10);assert.equal(limits.marketingMonthlyLimit,250);
 assert.equal(limits.batchLimit,1);assert.equal(limits.maxAgeHours,24);
 assert.equal(limits.scope,'application_delivery_only');
 for(const patch of [{JENIOS_EMAIL_DELIVERY_START_AT:undefined},{JENIOS_EMAIL_DELIVERY_START_AT:'2026-10-25T00:00:00Z'},
  {JENIOS_EMAIL_APP_DAILY_LIMIT:'NaN'},{JENIOS_EMAIL_APP_DAILY_LIMIT:'91'},
  {JENIOS_EMAIL_APP_DAILY_LIMIT:'10'},{JENIOS_EMAIL_APP_MONTHLY_LIMIT:'250'},
  {JENIOS_EMAIL_MAX_EVENT_AGE_HOURS:'169'},{JENIOS_EMAIL_DISPATCH_BATCH_LIMIT:'3'}])
  assert.equal(emailDispatchLimits({...env,...patch},now).ready,false);
});

test('R42 event cutoff is checked again even if a claim returns an old or future row',()=>{
 const limits=emailDispatchLimits(env,now);
 assert.equal(emailEventIsCurrent('finance',{paid_at:stamp},limits,now),true);
 assert.equal(emailEventIsCurrent('finance',{paid_at:'2026-10-24T15:00:00Z'},limits,now),false);
 assert.equal(emailEventIsCurrent('transactional',{created_at:'2026-10-25T00:00:00Z'},limits,now),false);
 assert.equal(emailEventIsCurrent('marketing',{created_at:stamp,due_at:'2026-10-01T00:00:00Z'},limits,now),false);
 assert.equal(emailEventIsCurrent('dunning',{},limits,now),false);
 const deferredLimits=emailDispatchLimits({...env,JENIOS_EMAIL_DELIVERY_START_AT:'2026-10-22T00:00:00Z'},now);
 const postponed={due_at:'2026-10-22T10:00:00Z',cadence_deferred_until_r42:stamp,first_attempt_at:new Date(now).toISOString()};
 assert.equal(emailEventIsCurrent('marketing',postponed,deferredLimits,now),true);
 assert.equal(emailEventIsCurrent('marketing',{...postponed,due_at:'2026-10-21T10:00:00Z'},deferredLimits,now),false);
 assert.equal(emailEventIsCurrent('marketing',{...postponed,first_attempt_at:'2026-10-22T12:00:00Z'},deferredLimits,now),false);
});

test('R42 dispatcher rejects unauthorized requests and HEAD before database construction',async()=>{
 for(const [input,status] of [[{authorization:''},401],[{authorization:env.CRON_SECRET},401],
  [{authorization:'Bearer wrong'},401],[{method:'HEAD'},405],[{method:'POST'},405]]){
  let calls=0;
  const response=await handleEmailDispatcher(request(input),{env,now,getDb:()=>{calls++;throw Error('unexpected');}});
  assert.equal(response.status,status);assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(calls,0);
 }
});

test('R42 dedicated dispatcher secret works without reading or changing the legacy cron secret',async()=>{
 const settings=Object.freeze({...env,CRON_SECRET:undefined,JENIOS_EMAIL_DISPATCH_SECRET:'local-dedicated-dispatch-secret-r42'});
 const db=fakeDb({rows:{}}),sent=transport();let opens=0;
 const response=await handleEmailDispatcher(request({authorization:'Bearer '+settings.JENIOS_EMAIL_DISPATCH_SECRET}),
  {env:settings,now,getDb:()=>{opens++;return db;},fetcher:sent.fetcher});
 assert.equal(response.status,200);assert.equal((await response.json()).status,'PRODUCTION');
 assert.equal(opens,1);assert.equal(sent.calls.length,0);assert.equal(settings.CRON_SECRET,undefined);
 const credentials=emailCredentialSummary(settings);
 assert.equal(credentials.cronSecretConfigured,true);
 assert.equal(JSON.stringify(credentials).includes(settings.JENIOS_EMAIL_DISPATCH_SECRET),false);
});

test('R42 dispatcher preserves legacy authorization and rejects absent, short or wrong dedicated secrets',async()=>{
 for(const settings of [env,{...env,JENIOS_EMAIL_DISPATCH_SECRET:'local-dedicated-dispatch-secret-r42'}]){
  const response=await handleEmailDispatcher(request(),{env:settings,now,getDb:()=>fakeDb({rows:{}})});
  assert.equal(response.status,200);assert.equal((await response.json()).status,'PRODUCTION');
 }
 for(const [settings,token] of [[{...env,CRON_SECRET:undefined},'missing'],
  [{...env,CRON_SECRET:undefined,JENIOS_EMAIL_DISPATCH_SECRET:'short'},'short'],
  [{...env,JENIOS_EMAIL_DISPATCH_SECRET:'local-dedicated-dispatch-secret-r42'},'wrong']]){
  let opens=0;
  const response=await handleEmailDispatcher(request({authorization:'Bearer '+token}),
   {env:settings,now,getDb:()=>{opens++;throw Error('must stay closed');}});
  assert.equal(response.status,401);assert.equal(opens,0);
 }
});

test('R42 disabled scope, cutoff or channels perform no privileged reads',async()=>{
 for(const patch of [{JENIOS_EMAIL_DISPATCHER_ENABLED:'false'},{JENIOS_EMAIL_PRODUCTION_ENABLED:'false'},
  {VERCEL_GIT_COMMIT_REF:'other'},{JENIOS_EMAIL_DELIVERY_START_AT:undefined},
  {JENIOS_PAYMENT_EMAILS_ENABLED:'false',JENIOS_TRANSACTIONAL_EMAILS_ENABLED:'false',JENIOS_MARKETING_EMAILS_ENABLED:'false'}]){
  let calls=0;
  const response=await handleEmailDispatcher(request(),{env:{...env,...patch},now,getDb:()=>{calls++;throw Error('unexpected');}});
  assert.deepEqual(await response.json(),{status:'DISABLED'});assert.equal(calls,0);
 }
});

test('R42 dispatcher processes essential queues first and uses the existing workers with durable reservations',async()=>{
 const db=fakeDb(),sent=transport();
 const response=await handleEmailDispatcher(request(),{env,now,getDb:()=>db,fetcher:sent.fetcher});
 assert.equal(response.status,200);
 const result=await response.json();assert.equal(result.status,'PRODUCTION');
 for(const channel of ['finance','transactional','dunning','marketing'])assert.equal(result[channel].sent,1);
 assert.equal(sent.calls.length,4);assert.equal(db.reservations.size,4);
 const claimed=db.calls.filter(call=>call.name.startsWith('jenios_claim_'));
 assert.deepEqual(claimed.map(call=>call.name),['jenios_claim_pay_email_r42','jenios_claim_transactional_email_r42',
  'jenios_claim_dunning_email_r42','jenios_claim_marketing_email_r42']);
 for(const claim of claimed){assert.equal(claim.args.p_limit,1);assert.equal(claim.args.p_start_at,'2026-10-24T16:00:00.000Z');assert.equal(claim.args.p_max_age_hours,24);}
 const names=db.calls.map(call=>call.name);
 assert.ok(names.indexOf('jenios_complete_transactional_email_b305')<names.indexOf('jenios_process_subscription_dunning_r42'));
 assert.ok(names.indexOf('jenios_complete_dunning_email_b305')<names.indexOf('jenios_plan_marketing_emails_r42'));
 assert.equal(JSON.stringify(result).includes('fixture@example.com'),false);
 assert.equal(JSON.stringify(result).includes(env.CRON_SECRET),false);
 assert.ok(sent.calls.every(call=>call.body.reply_to===undefined));
});

test('R42 budget denial defers without a provider call or a failed transport attempt',async()=>{
 const db=fakeDb({budget:()=>({allowed:false,reason:'DAILY_LIMIT',retry_at:'2026-10-25T00:00:00Z'})});
 const sent=transport(),result=await runEmailDispatcher({db,env,now,fetcher:sent.fetcher});
 assert.equal(sent.calls.length,0);
 for(const channel of ['finance','transactional','dunning','marketing'])assert.equal(result[channel].deferred,1);
 assert.equal(result.marketing.failed,0);
 assert.equal(db.calls.filter(call=>call.name==='jenios_defer_email_r42').length,4);
 assert.equal(db.calls.some(call=>call.name.startsWith('jenios_release_')),false);
});

test('R42 missing reservation acknowledgement or key conflict never reaches the provider',async()=>{
 for(const budget of [()=>null,()=>({allowed:true,reason:'RESERVED',reservation_id:'not-a-uuid',reused:false}),
  ()=>({allowed:false,reason:'KEY_CONFLICT'})]){
  const db=fakeDb({budget}),sent=transport();
  const result=await runFinanceOutboxBatch({db,env,now,fetcher:sent.fetcher});
  assert.equal(result.sent,0);assert.equal(result.blocked,1);assert.equal(sent.calls.length,0);
  assert.equal(db.calls.some(call=>call.name.startsWith('jenios_complete_')),false);
 }
});

test('R42 quota reservation reuses an idempotency key without creating a second application reservation',async()=>{
 const db=fakeDb(),row=fixtures().finance,limits=emailDispatchLimits(env,now),message={idempotencyKey:'a'.repeat(64)};
 assert.equal(await reserveEmailDelivery({db,channel:'finance',row,message,limits,now}),true);
 assert.equal(await reserveEmailDelivery({db,channel:'finance',row,message,limits,now}),true);
 assert.equal(db.reservations.size,1);
 const args=db.calls[0].args;
 assert.equal(args.p_daily_limit,40);assert.equal(args.p_marketing_daily_limit,10);
 assert.equal('p_user_id' in args,false);assert.equal('email' in args,false);
});

test('R42 malformed defer acknowledgement fails closed before transport',async()=>{
 const db=fakeDb({budget:()=>({allowed:false,reason:'MONTHLY_LIMIT',retry_at:'2026-11-01T00:00:00Z'})});
 const rpc=db.rpc;db.rpc=async(name,args)=>name==='jenios_defer_email_r42'?{data:false,error:null}:rpc(name,args);
 const sent=transport(),result=await runFinanceOutboxBatch({db,env,now,fetcher:sent.fetcher});
 assert.equal(result.sent,0);assert.equal(sent.calls.length,0);
 assert.equal(db.calls.find(call=>call.name==='jenios_release_pay_email_b305').args.p_retryable,true);
});

test('R42 stale queue rows are blocked before recipient lookup and application reservation',async()=>{
 const rows=fixtures();
 rows.finance.paid_at=rows.transactional.created_at=rows.dunning.created_at=rows.marketing.due_at='2026-10-01T00:00:00Z';
 const runs=[runFinanceOutboxBatch,runTransactionalEmailBatch,runDunningEmailBatch,runMarketingEmailBatch];
 for(const run of runs){
  const db=fakeDb({rows}),sent=transport();const result=await run({db,env,now,fetcher:sent.fetcher});
  assert.equal(result.sent,0);assert.equal(sent.calls.length,0);
  assert.equal(db.calls.some(call=>call.name==='auth'||call.name==='jenios_reserve_email_budget_r42'),false);
 }
});

test('R42 invalid bank ownership or unconfirmed recipient does not spend the application budget',async()=>{
 for(const mode of ['owner','identity']){
  const db=fakeDb({identityPatch:mode==='identity'?{id:uuid(999)}:{}}),sent=transport();
  if(mode==='owner')db.tables.jenios_pay_orders.user_id=uuid(999);
  const result=await runFinanceOutboxBatch({db,env,now,fetcher:sent.fetcher});
  assert.equal(result.sent,0);assert.equal(sent.calls.length,0);assert.equal(db.reservations.size,0);
 }
});

test('R42 uncertain provider response retains its reservation and quarantines through the existing ledger',async()=>{
 const db=fakeDb();
 const result=await runFinanceOutboxBatch({db,env,now,fetcher:async()=>{throw Error('local synthetic disconnect');}});
 assert.equal(result.sent,0);assert.equal(db.reservations.size,1);
 const released=db.calls.find(call=>call.name==='jenios_release_pay_email_b305');
 assert.equal(released.args.p_error_code,'RESEND_DELIVERY_UNCERTAIN');assert.equal(released.args.p_retryable,false);
 assert.equal(db.calls.some(call=>/delete|refund.*budget|release.*budget/.test(call.name)),false);
});

test('R42 marketing preserves ambiguity codes and its quota when provider or ledger acknowledgement is incomplete',async()=>{
 for(const [mode,code] of [['missing','RESEND_ACK_MISSING'],['unreadable','RESEND_ACK_UNREADABLE'],
  ['ledger','MARKETING_DELIVERY_LEDGER_UNCONFIRMED'],['conflict','RESEND_IDEMPOTENCY_CONFLICT']]){
  const db=fakeDb();
  if(mode==='ledger'){
   const rpc=db.rpc;db.rpc=async(name,args)=>name==='jenios_complete_marketing_email_b305'?{data:false,error:null}:rpc(name,args);
  }
  const fetcher=async()=>mode==='conflict'?{ok:false,status:409,json:async()=>({name:'invalid_idempotent_request'})}
   :{ok:true,json:async()=>{
    if(mode==='unreadable')throw Error('local synthetic invalid JSON');
    return mode==='missing'?{}:{id:'local-provider-id-r42'};
   }};
  const result=await runMarketingEmailBatch({db,env,now,fetcher});
  assert.equal(result.sent,0);assert.equal(db.reservations.size,1);
  const released=db.calls.find(call=>call.name==='jenios_release_marketing_email_b305');
  assert.equal(released.args.p_error_code,code);assert.equal(released.args.p_retryable,false);
  assert.equal(db.calls.some(call=>/delete|refund.*budget|release.*budget/.test(call.name)),false);
 }
});

test('R42 a failed essential queue stops the dispatcher and returns a generic error',async()=>{
 const db=fakeDb({failRpc:'jenios_claim_pay_email_r42'}),sent=transport();
 const response=await handleEmailDispatcher(request(),{env,now,getDb:()=>db,fetcher:sent.fetcher});
 assert.equal(response.status,503);assert.deepEqual(await response.json(),{status:'ERROR',error:'Não foi possível processar as filas de comunicação.'});
 assert.equal(db.calls.length,1);assert.equal(sent.calls.length,0);
});

test('R42 production readiness replaces the QA lock and requires durable dispatch objects',()=>{
 const input={env:{...env,JENIOS_EMAIL_DELIVERY_START_AT:'2020-01-01T00:00:00Z'},
  queues:{},gates:{JENIOS_EMAIL_DISPATCHER_ENABLED:true,JENIOS_EMAIL_PRODUCTION_ENABLED:true},
  credentials:{resendApiKeyConfigured:true,resendDomainVerified:true,financeSenderConfigured:true,
   supabaseServerKeyConfigured:true,cronSecretConfigured:true,webhookSecretConfigured:true},
  databasePreflight:{...Object.fromEntries(EMAIL_DATABASE_OBJECTS.map(key=>[key,true])),allRequired:true},
  dispatchHealth:{ready:true}};
 const result=emailReleaseReadiness(input);
 assert.equal(result.mode,'production');assert.equal(result.checks.some(check=>check.id==='qa_lock'),false);
 assert.equal(result.checks.find(check=>check.id==='application_budget').state,'ready');
 assert.equal(emailReleaseReadiness({...input,dispatchHealth:{ready:false}}).checks.find(check=>check.id==='application_budget').state,'blocker');
});
