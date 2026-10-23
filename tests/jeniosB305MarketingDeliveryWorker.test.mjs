import test from 'node:test';
import assert from 'node:assert/strict';
import {runMarketingEmailBatch,marketingDeliveryReadiness} from '../lib/email/marketing-delivery-worker.mjs';

const base={
 VERCEL_ENV:'preview',
 VERCEL_GIT_COMMIT_REF:'fix/jenios-b305-finance-email-20261022',
 VERCEL_PROJECT_ID:'prj_9cRnjWFRsLkfTToF4U4xZQBa7Gq9',
 JENIOS_B305_QA_PROJECT_ID:'prj_9cRnjWFRsLkfTToF4U4xZQBa7Gq9',
 NEXT_PUBLIC_SUPABASE_URL:'https://rebzztxlzofxpfwjvbee.supabase.co',
 JENIOS_PAY_PAYMENTS_ENABLED:'false',
 JENIOS_INTER_CHARGES_ENABLED:'false',
 JENIOS_REAL_EXECUTION_ENABLED:'false',
 JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED:'false',
 JENIOS_PRIVATE_PAPER_EXECUTOR:'false',
 JENIOS_PAYMENT_EMAILS_ENABLED:'false',
 JENIOS_B305_TEST_SEND_APPROVED:'false',
 JENIOS_B305_PRIVATE_EMAIL_RUNNER_ENABLED:'false',
 JENIOS_MARKETING_EMAILS_ENABLED:'true',
 RESEND_API_KEY:'re_12345678901',
 SUPABASE_SECRET_KEY:'sb_secret_example_123456789',
 JENIOS_RESEND_EXPECTED_DOMAIN:'jenios.com.br',
 JENIOS_RESEND_DOMAIN_VERIFIED:'true'
};

test('B305-R34 marketing worker is disabled unless explicit Preview gate is true',async()=>{
 let touched=false;
 const db={rpc:async()=>{touched=true;return {data:[],error:null}}};
 const off=await runMarketingEmailBatch({db,env:{...base,JENIOS_MARKETING_EMAILS_ENABLED:'false'}});
 assert.deepEqual(off,{status:'DISABLED',claimed:0,sent:0,suppressed:0,failed:0});
 assert.equal(touched,false);
 assert.equal(marketingDeliveryReadiness(base).ready,true);
 assert.equal(marketingDeliveryReadiness({...base,VERCEL_ENV:'production'}).ready,false);
});

test('B305-R34 worker sends through fake transport and completes ledger',async()=>{
 const calls=[];
 const row={id:'q1',lease_token:'lease1',campaign_kind:'cart_recovery',step:1,user_id:'u1',
  campaign_key:'o1',order_id:'o1',product_id:'p1'};
 const db={
  rpc:async(name,args)=>{
   calls.push({kind:'rpc',name,args});
   if(name==='jenios_claim_marketing_email_b305')return {data:[row],error:null};
   if(name==='jenios_complete_marketing_email_b305')return {data:true,error:null};
   if(name==='jenios_release_marketing_email_b305'||name==='jenios_suppress_marketing_email_b305')
    return {data:true,error:null};
   throw Error('unexpected rpc '+name);
  },
  auth:{admin:{getUserById:async()=>({data:{user:{
   id:'u1',email:'cliente@example.com',email_confirmed_at:'2026-10-23T00:00:00Z',
   is_anonymous:false,user_metadata:{full_name:'Cliente'}
  }},error:null})}},
  from(table){
   return {
    select(){
     const chain={
      eq(){return chain;},in(){return chain;},not(){return chain;},order(){return chain;},
      limit(){return chain;},
      maybeSingle:async()=>{
       if(table==='jenios_email_preferences_b305')
        return {data:{user_id:'u1',marketing_opt_in:true,opted_out_at:null,complaint_at:null,hard_bounce_at:null},error:null};
       if(table==='jenios_pay_orders')
        return {data:{id:'o1',user_id:'u1',product_id:'p1',status:'awaiting_payment',created_at:'2026-10-22T20:00:00Z'},error:null};
       if(table==='jenios_pay_products')
        return {data:{id:'p1',name:'Plano JENIOS',category:'platform',billing_type:'monthly',active:true},error:null};
       if(table==='jenios_marketing_email_ledger_b305')
        return {data:null,error:null};
       return {data:null,error:null};
      }
     };
     return chain;
    }
   };
  }
 };
 const fetcher=async(url,options)=>{
  calls.push({kind:'fetch',url,options});
  return {ok:true,status:200,json:async()=>({id:'email_marketing_123'})};
 };
 const result=await runMarketingEmailBatch({db,env:base,fetcher,limit:1});
 assert.equal(result.sent,1);
 assert.equal(result.failed,0);
 assert.ok(calls.some(x=>x.kind==='fetch'&&x.url==='https://api.resend.com/emails'));
 assert.ok(calls.some(x=>x.kind==='rpc'&&x.name==='jenios_complete_marketing_email_b305'));
});

test('B305-R34 suppressed consent never reaches transport',async()=>{
 let sent=false;
 const row={id:'q1',lease_token:'lease1',campaign_kind:'no_plan_nurture',step:1,user_id:'u1',campaign_key:'u1'};
 const db={
  rpc:async(name)=>{
   if(name==='jenios_claim_marketing_email_b305')return {data:[row],error:null};
   if(name==='jenios_suppress_marketing_email_b305')return {data:true,error:null};
   if(name==='jenios_release_marketing_email_b305')return {data:true,error:null};
   return {data:true,error:null};
  },
  auth:{admin:{getUserById:async()=>({data:{user:{id:'u1',email:'cliente@example.com',
   email_confirmed_at:'2026-10-23T00:00:00Z',is_anonymous:false,user_metadata:{}}},error:null})}},
  from(table){
   return {select(){
    const chain={eq(){return chain;},in(){return chain;},not(){return chain;},order(){return chain;},limit(){return chain;},
     maybeSingle:async()=>{
      if(table==='jenios_email_preferences_b305')
       return {data:{user_id:'u1',marketing_opt_in:false,opted_out_at:'2026-10-23T00:00:00Z',complaint_at:null,hard_bounce_at:null},error:null};
      if(table==='jenios_marketing_email_ledger_b305')return {data:null,error:null};
      if(table==='jenios_pay_subscriptions')return {data:null,error:null};
      return {data:null,error:null};
     }};
    return chain;
   }};
  }
 };
 const result=await runMarketingEmailBatch({db,env:base,fetcher:async()=>{sent=true;return {ok:true,json:async()=>({id:'x'})}}});
 assert.equal(result.suppressed,1);
 assert.equal(sent,false);
});
