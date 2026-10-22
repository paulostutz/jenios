import test from 'node:test';
import assert from 'node:assert/strict';
import {runFinanceOutboxBatch} from '../lib/email/finance-outbox-worker.mjs';
const id='11111111-2222-4333-8444-555555555555',receipt='E'+'1'.repeat(31);
const row={id,order_id:id,payment_id:'22222222-2222-4333-8444-555555555555',recipient_user_id:'33333333-2222-4333-8444-555555555555',lease_token:id,recipient_email:null,recipient_name:'Cliente JENIOS',product_name:'Compra JENIOS',amount_cents:14990,currency:'BRL',paid_at:'2026-10-22T12:00:00Z',bank_receipt_id:receipt};
const order={id,user_id:row.recipient_user_id,status:'paid',currency:'BRL',provider:'inter_pix',amount_cents:14990};
const payment={id:row.payment_id,order_id:id,provider:'inter_pix',payment_method:'pix',status:'confirmed',amount_cents:14990,bank_end_to_end_id:receipt,confirmed_at:row.paid_at};
const env={VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'fix/jenios-b305-finance-email-20261022',JENIOS_B305_QA_PROJECT_ID:'prj_9cRnjWFRsLkfTToF4U4xZQBa7Gq9',NEXT_PUBLIC_SUPABASE_URL:'https://rebzztxlzofxpfwjvbee.supabase.co',JENIOS_PAY_PAYMENTS_ENABLED:'false',JENIOS_REAL_EXECUTION_ENABLED:'false',JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED:'false',JENIOS_PRIVATE_PAPER_EXECUTOR:'false',JENIOS_B305_TEST_SEND_APPROVED:'true',JENIOS_PAYMENT_EMAILS_ENABLED:'true',JENIOS_PAYMENT_EMAIL_FROM:'Financeiro JENIOS <financeiro@jenios.com.br>',JENIOS_EMAIL_TEST_RECIPIENT:'teste@example.com',RESEND_API_KEY:'re_testnotreal123456789'};
function db({u={},o={},p={},items=[row]}={}){
 const calls=[];
 const user={id:row.recipient_user_id,email:'teste@example.com',email_confirmed_at:'2026-10-22T10:00:00Z',...u};
 const result={calls,auth:{admin:{getUserById:async()=>({data:{user}})}},from(table){const data=table==='jenios_pay_orders'?{...order,...o}:{...payment,...p};const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({data,error:null})};return q;},rpc:async(name,args)=>{calls.push({name,args});if(name==='jenios_claim_pay_email_b305')return {data:items,error:null};return {data:true,error:null}}};
 return result;
}
test('B305 disabled by default and in production',async()=>{for(const settings of [{},{...env,VERCEL_ENV:'production'}]){let called=false;const r=await runFinanceOutboxBatch({env:settings,db:{rpc(){called=true}}});assert.equal(r.status,'DISABLED');assert.equal(called,false)}});
test('B305 verified QA Pix uses idempotent Resend request',async()=>{const x=db();let sent=0;const r=await runFinanceOutboxBatch({db:x,env,fetcher:async(url,opts)=>{sent++;assert.equal(url,'https://api.resend.com/emails');assert.match(opts.headers['Idempotency-Key'],/^[a-f0-9]{64}$/);return {ok:true,json:async()=>({id:'resend_mock_12345'})}}});assert.equal(r.sent,1);assert.equal(sent,1);assert.ok(x.calls.some(z=>z.name==='jenios_complete_pay_email_b305'))});
test('B305 pending payments, unconfirmed identity and mismatched recipient never send',async()=>{for(const x of [db({o:{status:'pending'}}),db({u:{email_confirmed_at:null}}),db({u:{email:'other@example.com'}})]){let sent=0;const r=await runFinanceOutboxBatch({db:x,env,fetcher:async()=>{sent++}});assert.equal(r.sent,0);assert.equal(r.blocked,1);assert.equal(sent,0)}});
test('B305 network uncertainty quarantines without retry',async()=>{const x=db();const r=await runFinanceOutboxBatch({db:x,env,fetcher:async()=>{throw Error('disconnect')}});assert.equal(r.sent,0);assert.equal(x.calls.find(z=>z.name==='jenios_release_pay_email_b305').args.p_retryable,false)});
