/** Execute the actual route body with local dependencies, as in the R37 handler
 * suites. The Next build verifies import wiring. No service or provider I/O. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {timingSafeEqual} from 'node:crypto';
import {financeEmailDispatchReadiness} from '../lib/email/finance-payment-confirmation.mjs';
import {runFinanceOutboxBatch as actualFinanceOutboxBatch} from '../lib/email/finance-outbox-worker.mjs';
import {emailDispatchLimits} from '../lib/email/dispatch-budget.mjs';

const runFinanceOutboxBatch=options=>actualFinanceOutboxBatch({now:Date.parse('2026-10-24T12:00:00Z'),...options});
const env=Object.freeze({
 VERCEL_ENV:'production',VERCEL_PROJECT_ID:'prj_syntheticProd123456',
 VERCEL_GIT_COMMIT_REF:'release/email-tests',
 NEXT_PUBLIC_SUPABASE_URL:'https://abcdefghijklmnopqrst.supabase.co',
 JENIOS_EMAIL_DELIVERY_START_AT:'2026-10-22T00:00:00Z',JENIOS_EMAIL_MAX_EVENT_AGE_HOURS:'168',
 JENIOS_EMAIL_DISPATCH_BATCH_LIMIT:'2',
 JENIOS_EMAIL_PRODUCTION_ENABLED:'true',JENIOS_EMAIL_PRODUCTION_PROJECT_ID:'prj_syntheticProd123456',
 JENIOS_EMAIL_PRODUCTION_BRANCH:'release/email-tests',
 JENIOS_EMAIL_PRODUCTION_SUPABASE_URL:'https://abcdefghijklmnopqrst.supabase.co',
 JENIOS_B305_TEST_SEND_APPROVED:'false',JENIOS_B305_PRIVATE_EMAIL_RUNNER_ENABLED:'false',
 JENIOS_B305_QA_TEST_ROUTE_ARMED:'false',CRON_SECRET:'synthetic-test-only-internal-auth-secret',
 JENIOS_PAYMENT_EMAILS_ENABLED:'true',JENIOS_PAYMENT_EMAIL_FROM:'Financeiro JENIOS <financeiro@jenios.com.br>',
 RESEND_API_KEY:'re_testnotreal123456789',JENIOS_RESEND_EXPECTED_DOMAIN:'jenios.com.br',
 JENIOS_RESEND_DOMAIN_VERIFIED:'true'
});
const request=({authorization='Bearer '+env.CRON_SECRET,method='GET',query=''}={})=>
 new Request('https://fixture.invalid/api/internal/email/finance'+query,{method,headers:{authorization}});

function handler({settings=env,db={},worker=async()=>({status:'PRODUCTION',claimed:0,sent:0,blocked:0}),dbError=false}={}){
 const calls={database:0,worker:0,args:null};
 const source=readFileSync(new URL('../app/api/internal/email/finance/route.js',import.meta.url),'utf8')
  .replace(/^import[^\n]+\n/gm,'')
  .replace(/^export const /gm,'const ')
  .replace(/^export async function /gm,'async function ');
 const deps={process:{env:settings},Response,Buffer,timingSafeEqual,financeEmailDispatchReadiness,emailDispatchLimits,
  getJeniosPayAdmin(){calls.database++;if(dbError)throw Error('private database credential detail');return db;},
  async runFinanceOutboxBatch(args){calls.worker++;calls.args=args;return worker(args);}};
 return {calls,run:new Function(...Object.keys(deps),source+'\nreturn GET;')(...Object.values(deps))};
}

test('R40 finance endpoint denies missing or invalid internal credentials before database access',async()=>{
 const cases=[{authorization:''},{authorization:env.CRON_SECRET},
  {authorization:'Basic '+env.CRON_SECRET},{authorization:'Bearer wrong-secret'},
  {authorization:'Bearer '+env.CRON_SECRET.slice(0,-1)+'x'},
  {authorization:'Bearer '+env.CRON_SECRET,settings:{...env,CRON_SECRET:undefined}},
  {authorization:'Bearer local-dedicated-dispatch-secret-r42',settings:{...env,CRON_SECRET:undefined,
   JENIOS_EMAIL_DISPATCH_SECRET:'local-dedicated-dispatch-secret-r42'}},
  {authorization:'Bearer short',settings:{...env,CRON_SECRET:'short'}}];
 for(const {authorization,settings=env} of cases){
  const fixture=handler({settings});const response=await fixture.run(request({authorization}));
  assert.equal(response.status,401);assert.equal(response.headers.get('cache-control'),'no-store');
  assert.deepEqual(await response.json(),{error:'Não autorizado'});
  assert.equal(fixture.calls.database,0);assert.equal(fixture.calls.worker,0);
 }
});

test('R40 finance endpoint remains disabled with partial production configuration or inactive channel',async()=>{
 for(const patch of [{JENIOS_EMAIL_PRODUCTION_ENABLED:undefined},{JENIOS_EMAIL_PRODUCTION_ENABLED:'false'},
  {JENIOS_PAYMENT_EMAILS_ENABLED:'false'},{JENIOS_PAYMENT_EMAILS_ENABLED:undefined},
  {VERCEL_ENV:'preview'},{VERCEL_PROJECT_ID:'prj_wrong123456789'},
  {VERCEL_GIT_COMMIT_REF:'unexpected'},{NEXT_PUBLIC_SUPABASE_URL:'https://rebzztxlzofxpfwjvbee.supabase.co'},
  {JENIOS_B305_TEST_SEND_APPROVED:'true'},{RESEND_API_KEY:undefined},{JENIOS_RESEND_DOMAIN_VERIFIED:'false'}]){
  const fixture=handler({settings:{...env,...patch}}),response=await fixture.run(request());
  assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{status:'DISABLED',claimed:0,sent:0,blocked:0});
  assert.equal(fixture.calls.database,0);assert.equal(fixture.calls.worker,0);
 }
});

test('R40 finance endpoint rejects a fully armed QA scope without consuming its one-send allowance',async()=>{
 const qa={...env,JENIOS_EMAIL_PRODUCTION_ENABLED:'false',VERCEL_ENV:'preview',
  VERCEL_PROJECT_ID:'prj_9cRnjWFRsLkfTToF4U4xZQBa7Gq9',JENIOS_B305_QA_PROJECT_ID:'prj_9cRnjWFRsLkfTToF4U4xZQBa7Gq9',
  VERCEL_GIT_COMMIT_REF:'fix/jenios-b305-finance-email-20261022',NEXT_PUBLIC_SUPABASE_URL:'https://rebzztxlzofxpfwjvbee.supabase.co',
  JENIOS_PAY_PAYMENTS_ENABLED:'false',JENIOS_INTER_CHARGES_ENABLED:'false',JENIOS_REAL_EXECUTION_ENABLED:'false',
  JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED:'false',JENIOS_PRIVATE_PAPER_EXECUTOR:'false',
  JENIOS_B305_TEST_SEND_APPROVED:'true',JENIOS_EMAIL_TEST_RECIPIENT:'qa@example.com'};
 assert.equal(financeEmailDispatchReadiness(qa).ready,true);
 const fixture=handler({settings:qa}),response=await fixture.run(request());
 assert.equal((await response.json()).status,'DISABLED');
 assert.equal(fixture.calls.database,0);assert.equal(fixture.calls.worker,0);
});

test('R40 finance endpoint does not execute for HEAD or other non-GET invocations',async()=>{
 for(const method of ['HEAD','POST','PUT','DELETE']){
  const fixture=handler(),response=await fixture.run(request({method}));
  assert.equal(response.status,405);assert.equal(response.headers.get('allow'),'GET');
  assert.equal(fixture.calls.database,0);assert.equal(fixture.calls.worker,0);
 }
});

test('R40 finance endpoint preserves bounded aggregates with the R42 maximum batch of two',async()=>{
 const fixture=handler({worker:async()=>({status:'PRODUCTION',claimed:2,sent:1,blocked:1,
  recipient:'private@example.com',providerId:'private-receipt',error:'private debug detail',secret:env.CRON_SECRET})});
 const response=await fixture.run(request({query:'?limit=1000&recipient=attacker@example.com&mode=qa'}));
 assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
 assert.equal(fixture.calls.database,1);assert.equal(fixture.calls.worker,1);
 assert.deepEqual(Object.keys(fixture.calls.args).sort(),['db','env','limit']);
 assert.equal(fixture.calls.args.limit,2);
 assert.deepEqual(await response.json(),{status:'PRODUCTION',claimed:2,sent:1,blocked:1});
});

test('R40 finance endpoint returns generic errors for database, worker and unconfirmed result failures',async()=>{
 const fixtures=[handler({dbError:true}),handler({worker:async()=>{throw Error('private provider token recipient@example.com');}}),
  ...[{status:'PRODUCTION',claimed:4,sent:4,blocked:0},
   {status:'PRODUCTION',claimed:3,sent:1,blocked:1},
   {status:'PRODUCTION',claimed:1,sent:'1',blocked:0},
   {status:'QA_ONLY',claimed:1,sent:1,blocked:0},null]
   .map(result=>handler({worker:async()=>result}))];
 for(const fixture of fixtures){
  const response=await fixture.run(request());
  assert.equal(response.status,503);assert.equal(response.headers.get('cache-control'),'no-store');
  assert.deepEqual(await response.json(),{status:'ERROR',error:'Não foi possível processar a fila de comunicação financeira.'});
 }
 assert.equal(fixtures[0].calls.worker,0);
});

function database({pending=false}={}){
 const calls=[];
 const rows=[1,2,3,4].map(n=>{
  const orderId=String(n).padStart(8,'0')+'-2222-4333-8444-555555555555';
  return {id:orderId,order_id:orderId,payment_id:'payment-'+n,recipient_user_id:'user-'+n,
   lease_token:'lease-'+n,amount_cents:14990,currency:'BRL',paid_at:'2026-10-22T12:00:00Z',
   bank_receipt_id:'E'+String(n).repeat(31)};
 });
 return {calls,rows,
  auth:{admin:{getUserById:async id=>({data:{user:{id,email:id+'@example.com',
   email_confirmed_at:'2026-10-22T10:00:00Z',is_anonymous:false}},error:null})}},
  rpc:async(name,args)=>{calls.push({name,args});
   if(name==='jenios_reserve_email_budget_r42')return {data:[{allowed:true,reason:'RESERVED',reused:false,reservation_id:'00000099-2222-4333-8444-555555555555'}],error:null};
   return {data:name==='jenios_claim_pay_email_r42'
   ?rows.slice(0,args.p_limit):true,error:null};},
  from(table){
   let id;
   const chain={select:()=>chain,eq:(key,value)=>{id=value;return chain;},maybeSingle:async()=>{
    const row=rows.find(r=>table==='jenios_pay_orders'?r.order_id===id:r.payment_id===id);
    const data=table==='jenios_pay_orders'?{id:row.order_id,user_id:row.recipient_user_id,
     status:pending?'pending':'paid',currency:'BRL',provider:'inter_pix',amount_cents:row.amount_cents}
     :{id:row.payment_id,order_id:row.order_id,provider:'inter_pix',payment_method:'pix',
      provider_payment_id:row.order_id.replace(/-/g,''),status:'confirmed',amount_cents:row.amount_cents,
      bank_end_to_end_id:row.bank_receipt_id,confirmed_at:row.paid_at};
    return {data,error:null};
   }};return chain;
  }
 };
}

test('R40 finance endpoint runs its existing worker with verified bank evidence and per-row ledger',async()=>{
 const db=database(),sent=[];
 const fixture=handler({db,worker:args=>runFinanceOutboxBatch({...args,fetcher:async(url,options)=>{
  assert.equal(url,'https://api.resend.com/emails');
  assert.match(options.headers['Idempotency-Key'],/^[a-f0-9]{64}$/);
  sent.push(JSON.parse(options.body));
  return {ok:true,json:async()=>({id:'synthetic-provider-id-'+sent.length})};
 }})});
 const response=await fixture.run(request({query:'?limit=10'}));
 assert.deepEqual(await response.json(),{status:'PRODUCTION',claimed:2,sent:2,blocked:0});
 assert.deepEqual(sent.map(message=>message.to),[['user-1@example.com'],['user-2@example.com']]);
 assert.equal(db.calls[0].args.p_limit,2);
 assert.equal(db.calls.filter(call=>call.name==='jenios_complete_pay_email_b305').length,2);
});

test('R40 finance endpoint cannot turn pending orders into delivery or expose their recipients',async()=>{
 const db=database({pending:true});let transports=0;
 const fixture=handler({db,worker:args=>runFinanceOutboxBatch({...args,fetcher:async()=>{
  transports++;throw Error('synthetic transport must not be reached');
 }})});
 const response=await fixture.run(request());
 assert.deepEqual(await response.json(),{status:'PRODUCTION',claimed:2,sent:0,blocked:2});
 assert.equal(transports,0);
 assert.equal(db.calls.filter(call=>call.name==='jenios_complete_pay_email_b305').length,0);
 assert.equal(db.calls.filter(call=>call.name==='jenios_release_pay_email_b305').length,2);
});
