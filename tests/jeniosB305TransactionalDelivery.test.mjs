import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 transactionalDeliveryReadiness,validatePlanActivationEvidence,validateDunningEvidence,
 runTransactionalEmailBatch,runDunningEmailBatch
} from '../lib/email/transactional-delivery-worker.mjs';

const base={
 VERCEL_ENV:'preview',
 VERCEL_GIT_COMMIT_REF:'fix/jenios-b305-finance-email-20261022',
 VERCEL_PROJECT_ID:'prj_9cRnjWFRsLkfTToF4U4xZQBa7Gq9',
 JENIOS_B305_QA_PROJECT_ID:'prj_9cRnjWFRsLkfTToF4U4xZQBa7Gq9',
 NEXT_PUBLIC_SUPABASE_URL:'https://rebzztxlzofxpfwjvbee.supabase.co',
 JENIOS_PAY_PAYMENTS_ENABLED:'false',JENIOS_INTER_CHARGES_ENABLED:'false',
 JENIOS_REAL_EXECUTION_ENABLED:'false',JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED:'false',
 JENIOS_PRIVATE_PAPER_EXECUTOR:'false',JENIOS_PAYMENT_EMAILS_ENABLED:'false',
 JENIOS_B305_TEST_SEND_APPROVED:'false',JENIOS_B305_PRIVATE_EMAIL_RUNNER_ENABLED:'false',
 JENIOS_SUBSCRIPTION_DUNNING_ENABLED:'false',JENIOS_TRANSACTIONAL_EMAILS_ENABLED:'true',
 RESEND_API_KEY:'re_12345678901',SUPABASE_SECRET_KEY:'sb_secret_example_123456789',
 JENIOS_PAYMENT_EMAIL_FROM:'Financeiro JENIOS <financeiro@jenios.com.br>',
 JENIOS_RESEND_EXPECTED_DOMAIN:'jenios.com.br',JENIOS_RESEND_DOMAIN_VERIFIED:'true'
};

test('B305-R16 delivery needs explicit transactional opt-in and locked financial gates',()=>{
 assert.equal(transactionalDeliveryReadiness(base).ready,true);
 assert.equal(transactionalDeliveryReadiness({...base,JENIOS_TRANSACTIONAL_EMAILS_ENABLED:'false'}).ready,false);
 for(const key of ['JENIOS_PAY_PAYMENTS_ENABLED','JENIOS_INTER_CHARGES_ENABLED','JENIOS_REAL_EXECUTION_ENABLED',
  'JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED','JENIOS_PRIVATE_PAPER_EXECUTOR','JENIOS_PAYMENT_EMAILS_ENABLED',
  'JENIOS_B305_TEST_SEND_APPROVED','JENIOS_B305_PRIVATE_EMAIL_RUNNER_ENABLED','JENIOS_SUBSCRIPTION_DUNNING_ENABLED'])
  assert.equal(transactionalDeliveryReadiness({...base,[key]:'true'}).ready,false,key);
});

test('B305-R16 plan activation requires paid order and matching active entitlement',()=>{
 const row={event_kind:'plan_activated',subscription_id:'s1',product_id:'p1',user_id:'u1'};
 const sub={id:'s1',user_id:'u1',product_id:'p1',latest_order_id:'o1',status:'active'};
 const product={id:'p1',category:'platform',billing_type:'monthly',active:true};
 const order={id:'o1',user_id:'u1',product_id:'p1',status:'paid',currency:'BRL'};
 const ent={order_id:'o1',user_id:'u1',product_id:'p1',status:'active'};
 assert.equal(validatePlanActivationEvidence(row,sub,product,order,ent),true);
 assert.equal(validatePlanActivationEvidence(row,sub,product,{...order,status:'awaiting_payment'},ent),false);
 assert.equal(validatePlanActivationEvidence(row,sub,product,order,{...ent,status:'pending'}),false);
});

test('B305-R16 dunning evidence follows D-3, D0, D+1 and D+7 states',()=>{
 const due='2026-10-23T12:00:00.000Z';
 const row={subscription_id:'s1',product_id:'p1',user_id:'u1',due_at:due};
 const product={id:'p1',category:'platform',billing_type:'monthly'};
 const sub={id:'s1',user_id:'u1',product_id:'p1',current_period_end:due,status:'active'};
 const d=Date.parse(due);
 assert.equal(validateDunningEvidence({...row,event_kind:'due_soon_3d'},sub,product,{now:d-2*86400000}),true);
 assert.equal(validateDunningEvidence({...row,event_kind:'due_today'},sub,product,{now:d+1000}),true);
 assert.equal(validateDunningEvidence({...row,event_kind:'past_due_1d'},{...sub,status:'past_due'},product,{now:d+2*86400000}),true);
 assert.equal(validateDunningEvidence({...row,event_kind:'cancelled_7d'},{...sub,status:'cancelled'},product,{now:d+8*86400000}),true);
 assert.equal(validateDunningEvidence({...row,event_kind:'cancelled_7d'},sub,product,{now:d+8*86400000}),false);
});

test('B305-R16 disabled workers never claim or send',async()=>{
 let touched=false;
 const db={rpc:async()=>{touched=true;return {data:[],error:null}}};
 const env={...base,JENIOS_TRANSACTIONAL_EMAILS_ENABLED:'false'};
 assert.deepEqual(await runTransactionalEmailBatch({db,env}),{status:'DISABLED',claimed:0,sent:0,blocked:0});
 assert.deepEqual(await runDunningEmailBatch({db,env}),{status:'DISABLED',claimed:0,sent:0,blocked:0});
 assert.equal(touched,false);
});

test('B305-R16 migration queues only confirmed Social users and verified active plans',()=>{
 const sql=readFileSync('supabase/migrations/20261023002614_jenios_b305_transactional_delivery.sql','utf8');
 assert.match(sql,/email_confirmed_at IS NULL/);
 assert.match(sql,/registration_source/);
 assert.match(sql,/category='platform'/);
 assert.match(sql,/billing_type='monthly'/);
 assert.match(sql,/e\.status='active'/);
 assert.match(sql,/FOR UPDATE SKIP LOCKED/);
 assert.doesNotMatch(sql,/https:\/\/api\.resend\.com/);
});
