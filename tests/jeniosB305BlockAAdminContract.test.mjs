import test from 'node:test';
import assert from 'node:assert/strict';
import {readEmailAdminHealth,emailReleaseReadiness} from '../lib/email/admin-health.mjs';
import {EMAIL_DATABASE_OBJECTS,sanitizeEmailDatabasePreflight,readEmailDatabasePreflight} from '../lib/email/database-preflight.mjs';

const completePreflight=()=>({...Object.fromEntries(EMAIL_DATABASE_OBJECTS.map(key=>[key,true])),allRequired:true});
const ENV={
 RESEND_API_KEY:'re_contract_test_only',SUPABASE_SECRET_KEY:'sb_secret_contract_test_only',
 CRON_SECRET:'contract-test-only-not-a-real-secret',
 JENIOS_PAYMENT_EMAIL_FROM:'Financeiro JENIOS <financeiro@jenios.com.br>',
 JENIOS_RESEND_EXPECTED_DOMAIN:'jenios.com.br',JENIOS_RESEND_DOMAIN_VERIFIED:'true',
 RESEND_WEBHOOK_SECRET:'whsec_contract_test_only_not_real',
 JENIOS_AUTH_TEMPLATES_APPLIED:'true',JENIOS_RESEND_WEBHOOK_ENDPOINT_CERTIFIED:'true',
 JENIOS_MARKETING_DELIVERY_WORKER_CERTIFIED:'true',JENIOS_UNIVERSITY_MILESTONE_DELIVERY_CERTIFIED:'true'
};
// Columns verified against information_schema on Social QA. This fake intentionally
// rejects nonexistent columns, unlike permissive mocks that hid the R24 defect.
function contractDb({preflight=completePreflight(),rpcError=null,countError=false}={}){
 const calls=[];
 const schemas={
  jenios_pay_email_outbox_b305:['id','status'],
  jenios_transactional_email_outbox_b305:['id','status'],
  jenios_subscription_dunning_outbox_b305:['id','status'],
  jenios_marketing_email_ledger_b305:['id','status'],
  jenios_email_preferences_b305:['user_id','marketing_opt_in','opted_out_at','complaint_at','hard_bounce_at','updated_at','created_at'],
  jenios_newsletter_editions_b305:['id','status'],
  jenios_resend_webhook_events_b305:['event_id','disposition']
 };
 const rows={jenios_email_preferences_b305:[
  {user_id:'fixture-a',marketing_opt_in:true,opted_out_at:null,complaint_at:null,hard_bounce_at:null},
  {user_id:'fixture-b',marketing_opt_in:false,opted_out_at:'2026-10-24T00:00:00Z',complaint_at:null,hard_bounce_at:null}
 ]};
 const db={calls,
  async rpc(name){calls.push({rpc:name});assert.equal(name,'jenios_email_preflight_b305');return {data:preflight,error:rpcError};},
  from(table){
   assert.ok(schemas[table],table);
   return {select(column,options){
    calls.push({table,column,options});
    assert.deepEqual(options,{count:'exact',head:true});
    const filters=[];
    const q={
     eq(key,value){assert.ok(schemas[table].includes(key));filters.push(row=>row[key]===value);return q;},
     not(key,operator,value){assert.equal(operator,'is');assert.equal(value,null);assert.ok(schemas[table].includes(key));filters.push(row=>row[key]!=null);return q;},
     then(resolve,reject){
      const invalid=!schemas[table].includes(column)||countError;
      return Promise.resolve({data:null,count:invalid?null:(rows[table]||[]).filter(row=>filters.every(f=>f(row))).length,
       error:invalid?{code:'42703',message:'invalid column'}:null}).then(resolve,reject);
     }
    };return q;
   }};
  }
 };return db;
}

test('Block A: actual preference column contract is user_id, not id',async()=>{
 const db=contractDb();const health=await readEmailAdminHealth(db,ENV);
 assert.equal(health.preferences.total,2);
 assert.equal(health.preferences.optedIn,1);
 assert.equal(health.preferences.optedOut,1);
 assert.ok(db.calls.filter(c=>c.table==='jenios_email_preferences_b305').every(c=>c.column==='user_id'));
 assert.equal(health.databasePreflight.allRequired,true);
 assert.equal(health.readiness.activationEligible,true);
 assert.equal(db.calls.filter(c=>c.rpc).length,1);
 const serialized=JSON.stringify(health);
 for(const value of ['fixture-a','fixture-b',ENV.RESEND_API_KEY,ENV.SUPABASE_SECRET_KEY,ENV.CRON_SECRET])assert.ok(!serialized.includes(value));
});

test('Block A: malformed or optimistic preflight cannot report readiness',()=>{
 for(const bad of [null,[],{},'true',{allRequired:true},{...completePreflight(),transactionalClaim:false},
  {...completePreflight(),marketingLedger:'true'}]){
  assert.equal(sanitizeEmailDatabasePreflight(bad).allRequired,false);
  const ready=emailReleaseReadiness({databasePreflight:bad});
  assert.equal(ready.activationEligible,false);
  assert.ok(ready.checks.some(x=>x.id==='database_preflight'&&x.state==='blocker'));
 }
 const output=sanitizeEmailDatabasePreflight({...completePreflight(),secret:'must-not-leak'});
 assert.equal(output.allRequired,true);assert.equal('secret' in output,false);
 assert.ok(Object.values(output).every(v=>typeof v==='boolean'));
});

test('Block A: RPC failure keeps counts visible but blocks readiness',async()=>{
 const health=await readEmailAdminHealth(contractDb({rpcError:{message:'private error'}}),ENV);
 assert.equal(health.preferences.total,2);
 assert.equal(health.databasePreflight.allRequired,false);
 assert.equal(health.readiness.activationEligible,false);
 assert.ok(!JSON.stringify(health).includes('private error'));
});

test('Block A: unavailable RPC and thrown transport fail closed',async()=>{
 for(const db of [{},{rpc:async()=>{throw Error('private failure');}}]){
  assert.equal((await readEmailDatabasePreflight(db)).allRequired,false);
 }
});

test('Block A: count errors are not converted into healthy empty queues',async()=>{
 await assert.rejects(readEmailAdminHealth(contractDb({countError:true}),ENV),/EMAIL_ADMIN_HEALTH_UNAVAILABLE/);
});

test('Block A: missing object stays a blocker even with certification flags true',async()=>{
 const health=await readEmailAdminHealth(contractDb({preflight:{...completePreflight(),universityMilestoneTrigger:false}}),ENV);
 assert.equal(health.readiness.state,'blocked');assert.equal(health.readiness.activationEligible,false);
 assert.equal(health.databasePreflight.universityMilestoneTrigger,false);
});
