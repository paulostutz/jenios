import test from 'node:test';
import assert from 'node:assert/strict';
import {runTransactionalEmailBatch,transactionalDeliveryReadiness} from '../lib/email/transactional-delivery-worker.mjs';
import {LESSONS,CURRICULUM_VERSION} from '../lib/learning/catalog.mjs';

const env={
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

test('B305-R35 worker remains disabled unless transactional gate is explicitly true',async()=>{
 let touched=false;
 const db={rpc:async()=>{touched=true;return {data:[],error:null}}};
 const result=await runTransactionalEmailBatch({db,env:{...env,JENIOS_TRANSACTIONAL_EMAILS_ENABLED:'false'}});
 assert.deepEqual(result,{status:'DISABLED',claimed:0,sent:0,blocked:0});
 assert.equal(touched,false);
 assert.equal(transactionalDeliveryReadiness(env).ready,true);
});

test('B305-R35 University event is revalidated and sent only through fake transport',async()=>{
 const completed=LESSONS.slice(0,10).map(x=>x.id);
 const row={id:'q1',lease_token:'lease1',event_kind:'university_milestone',user_id:'u1',
  reference_key:'u1:university:lessons:10',
  payload:{milestoneKey:'lessons-10',curriculumVersion:CURRICULUM_VERSION,
   completedLessons:10,totalLessons:15,completedTracks:3,totalTracks:5}};
 let fetched=false,completedRpc=false;
 const db={
  rpc:async(name)=>{
   if(name==='jenios_claim_transactional_email_b305')return {data:[row],error:null};
   if(name==='jenios_complete_transactional_email_b305'){completedRpc=true;return {data:true,error:null};}
   if(name==='jenios_release_transactional_email_b305')return {data:true,error:null};
   throw Error('unexpected rpc '+name);
  },
  auth:{admin:{getUserById:async()=>({data:{user:{id:'u1',email:'aluno@example.com',
   email_confirmed_at:'2026-10-23T00:00:00Z',is_anonymous:false,user_metadata:{full_name:'Aluno'}}},error:null})}},
  from(table){
   return {select(){
    const chain={eq(){return chain;},maybeSingle:async()=>{
     if(table==='jenios_learning_state')return {data:{user_id:'u1',revision:11,state:{version:CURRICULUM_VERSION,completedLessons:completed},updated_at:'2026-10-23T00:00:00Z'},error:null};
     return {data:null,error:null};
    }};
    return chain;
   }};
  }
 };
 const fetcher=async(url,options)=>{
  fetched=true;
  assert.equal(url,'https://api.resend.com/emails');
  assert.match(options.body,/Universidade/);
  return {ok:true,status:200,json:async()=>({id:'email_university_123'})};
 };
 const result=await runTransactionalEmailBatch({db,env,fetcher,limit:1});
 assert.equal(result.sent,1);
 assert.equal(result.blocked,0);
 assert.equal(fetched,true);
 assert.equal(completedRpc,true);
});

test('B305-R35 forged University payload is blocked before transport',async()=>{
 const row={id:'q1',lease_token:'lease1',event_kind:'university_milestone',user_id:'u1',
  reference_key:'u1:university:lessons:15',
  payload:{milestoneKey:'lessons-15',curriculumVersion:CURRICULUM_VERSION,
   completedLessons:15,totalLessons:15,completedTracks:5,totalTracks:5}};
 let fetched=false,released=false;
 const db={
  rpc:async(name)=>{
   if(name==='jenios_claim_transactional_email_b305')return {data:[row],error:null};
   if(name==='jenios_release_transactional_email_b305'){released=true;return {data:true,error:null};}
   return {data:true,error:null};
  },
  auth:{admin:{getUserById:async()=>({data:{user:{id:'u1',email:'aluno@example.com',
   email_confirmed_at:'2026-10-23T00:00:00Z',is_anonymous:false,user_metadata:{}}},error:null})}},
  from(table){
   return {select(){
    const chain={eq(){return chain;},maybeSingle:async()=>{
     if(table==='jenios_learning_state')return {data:{user_id:'u1',revision:5,state:{version:CURRICULUM_VERSION,completedLessons:LESSONS.slice(0,5).map(x=>x.id)}},error:null};
     return {data:null,error:null};
    }};
    return chain;
   }};
  }
 };
 const result=await runTransactionalEmailBatch({db,env,fetcher:async()=>{fetched=true;return {ok:true,json:async()=>({id:'x'})}}});
 assert.equal(result.sent,0);
 assert.equal(result.blocked,1);
 assert.equal(fetched,false);
 assert.equal(released,true);
});
