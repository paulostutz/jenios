import test from 'node:test';
import assert from 'node:assert/strict';
import {checkS05DeploymentScope} from '../lib/release/environment-scope.mjs';

const branch='fix/jenios-r80-private-paper-safety-20261027';
const commonOff=[
 'JENIOS_REAL_EXECUTION_ENABLED','JENIOS_PRIVATE_PAPER_EXECUTOR',
 'JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED','JENIOS_ROBOT_ANALYST_PAID_ENABLED',
 'JENIOS_ROBOT_R73_ADMIN_ENABLED','JENIOS_PAY_PAYMENTS_ENABLED',
 'JENIOS_PRO_PAYMENTS_ENABLED','JENIOS_INTER_CHARGES_ENABLED',
 'JENIOS_EMAIL_PRODUCTION_ENABLED','JENIOS_EMAIL_DISPATCHER_ENABLED',
 'JENIOS_PAYMENT_EMAILS_ENABLED','JENIOS_TRANSACTIONAL_EMAILS_ENABLED',
 'JENIOS_MARKETING_EMAILS_ENABLED','JENIOS_MARKETING_PLANNER_ENABLED',
 'JENIOS_SUBSCRIPTION_DUNNING_ENABLED','JENIOS_RESEND_WEBHOOK_ENABLED',
 'JENIOS_PRO_GENERATION_ENABLED','JENIOS_SALES_GENERATIVE_ENABLED',
 'JENIOS_ASSISTANT_MEMORY_ENABLED','NEXT_PUBLIC_PLATFORM_SIGNUP_ENABLED'
];
const privateOff=[
 'JENIOS_PRIVATE_PAPER_REHEARSAL','JENIOS_R80_PRIVATE_ISSUER_ENABLED',
 'JENIOS_R81_PAPER_RISK_APPROVAL_ENABLED','JENIOS_PRIVATE_PAPER_RECOVERY_ENABLED',
 'JENIOS_R82_PRIVATE_NODE_WORKER','JENIOS_R82_ALPACA_LIVE_READ_ENABLED',
 'JENIOS_R82_ALPACA_LIVE_ORDER_EXECUTION_ENABLED',
 'JENIOS_R83_PRIVATE_NODE_WORKER','JENIOS_R83_LIVE_VAULT_ENABLED',
 'JENIOS_R83_ALPACA_THIRD_PARTY_APP_APPROVED',
 'JENIOS_R93_PRIVATE_NODE_WORKER','JENIOS_R93_READONLY_RECOVERY_ENABLED',
 'JENIOS_R96_PRIVATE_NODE_WORKER','JENIOS_R96_BINANCE_PRIVATE_READ_ENABLED'
];
const safe={
 VERCEL_ENV:'preview',
 VERCEL_PROJECT_ID:'prj_44ipBY3R9sHlQDAXY7NUn1zDguw4',
 VERCEL_GIT_COMMIT_REF:branch,
 NEXT_PUBLIC_SUPABASE_URL:'https://rebzztxlzofxpfwjvbee.supabase.co',
 SOCIAL_SUPABASE_URL:'https://rebzztxlzofxpfwjvbee.supabase.co',
 NEXT_PUBLIC_SUPABASE_ANON_KEY:'synthetic-public-qa-key',
 PLATFORM_SUPABASE_URL:'https://xaicvhagftzjkqphnbgx.supabase.co',
 NEXT_PUBLIC_PLATFORM_SUPABASE_URL:'https://xaicvhagftzjkqphnbgx.supabase.co',
 NEXT_PUBLIC_PLATFORM_SUPABASE_PUBLISHABLE_KEY:'synthetic-platform-public-qa-key',
 ...Object.fromEntries([...commonOff,...privateOff].map(key=>[key,'false']))
};
test('R84 accepts only exact isolated R80-R83 QA branch, zero external dispatch',()=>{
 assert.deepEqual(checkS05DeploymentScope(safe),
  {ok:true,mode:'preview-isolated-robot-r80-r83'});
 for(const mutation of [
  {VERCEL_GIT_COMMIT_REF:'fix/jenios-r80-other-20261027'},
  {NEXT_PUBLIC_SUPABASE_URL:'https://igayfjorjmucthlfoasf.supabase.co'},
  {SOCIAL_SUPABASE_URL:'https://igayfjorjmucthlfoasf.supabase.co'},
  {PLATFORM_SUPABASE_URL:'https://wrong.supabase.co'},
  {NEXT_PUBLIC_PLATFORM_SUPABASE_URL:'https://wrong.supabase.co'},
  {NEXT_PUBLIC_PLATFORM_SUPABASE_PUBLISHABLE_KEY:undefined},
  {VERCEL_PROJECT_ID:'prj_other'}
 ])assert.equal(checkS05DeploymentScope({...safe,...mutation}).ok,false,
   JSON.stringify(mutation));
});
for(const key of [...commonOff,...privateOff]){
 test('R84 preview cannot enable or omit '+key,()=>{
  for(const value of ['true','TRUE',undefined]){
   const result=checkS05DeploymentScope({...safe,[key]:value});
   assert.equal(result.ok,false,key+' = '+String(value));
  }
 });
}
test('R84 QA branch cannot be deployed to the production environment',()=>{
 const production={...safe,VERCEL_ENV:'production',
  NEXT_PUBLIC_SUPABASE_URL:'https://igayfjorjmucthlfoasf.supabase.co',
  SOCIAL_SUPABASE_URL:'https://igayfjorjmucthlfoasf.supabase.co',
  SUPABASE_SECRET_KEY:'synthetic-private-test-only',
  JENIOS_S05_SCHEMA_CERTIFIED:'true',
  JENIOS_S05_PRIOR_MANUAL_SOCIAL_TESTS_ACCEPTED:'true'};
 assert.deepEqual(checkS05DeploymentScope(production),
  {ok:false,reason:'S05_PRODUCTION_RELEASE_BRANCH_NOT_CONFIRMED'});
});
