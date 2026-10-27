import test from 'node:test';
import assert from 'node:assert/strict';
import {checkS05DeploymentScope} from '../lib/release/environment-scope.mjs';
const blocked=[
 'JENIOS_REAL_EXECUTION_ENABLED','JENIOS_PRIVATE_PAPER_EXECUTOR','JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED',
 'JENIOS_ROBOT_ANALYST_PAID_ENABLED','JENIOS_ROBOT_R73_ADMIN_ENABLED',
 'JENIOS_PAY_PAYMENTS_ENABLED','JENIOS_PRO_PAYMENTS_ENABLED','JENIOS_INTER_CHARGES_ENABLED',
 'JENIOS_EMAIL_PRODUCTION_ENABLED','JENIOS_EMAIL_DISPATCHER_ENABLED','JENIOS_PAYMENT_EMAILS_ENABLED',
 'JENIOS_TRANSACTIONAL_EMAILS_ENABLED','JENIOS_MARKETING_EMAILS_ENABLED','JENIOS_MARKETING_PLANNER_ENABLED',
 'JENIOS_SUBSCRIPTION_DUNNING_ENABLED','JENIOS_RESEND_WEBHOOK_ENABLED',
 'JENIOS_PRO_GENERATION_ENABLED','JENIOS_SALES_GENERATIVE_ENABLED','JENIOS_ASSISTANT_MEMORY_ENABLED',
 'NEXT_PUBLIC_PLATFORM_SIGNUP_ENABLED'
];
const safe={
 VERCEL_ENV:'preview',VERCEL_PROJECT_ID:'prj_44ipBY3R9sHlQDAXY7NUn1zDguw4',
 VERCEL_GIT_COMMIT_REF:'audit/jenios-r75-backups-reconciliation-20261026',
 NEXT_PUBLIC_SUPABASE_URL:'https://rebzztxlzofxpfwjvbee.supabase.co',
 SOCIAL_SUPABASE_URL:'https://rebzztxlzofxpfwjvbee.supabase.co',
 NEXT_PUBLIC_SUPABASE_ANON_KEY:'synthetic-public-qa-key',
 PLATFORM_SUPABASE_URL:'https://xaicvhagftzjkqphnbgx.supabase.co',
 NEXT_PUBLIC_PLATFORM_SUPABASE_URL:'https://xaicvhagftzjkqphnbgx.supabase.co',
 NEXT_PUBLIC_PLATFORM_SUPABASE_PUBLISHABLE_KEY:'synthetic-platform-public-qa-key',
 ...Object.fromEntries(blocked.map(k=>[k,'false']))
};
test('R75 preview explicitly whitelists only isolated branch without external actions',()=>{
 assert.deepEqual(checkS05DeploymentScope(safe),{ok:true,mode:'preview-isolated-robot-r75'});
 assert.deepEqual(checkS05DeploymentScope({...safe,VERCEL_GIT_COMMIT_REF:'audit/jenios-r75-other'}),{ok:false,reason:'S05_UNVERIFIED_PREVIEW_BRANCH'});
 assert.deepEqual(checkS05DeploymentScope({...safe,VERCEL_PROJECT_ID:'prj_wrong'}),{ok:false,reason:'R75_PREVIEW_PROJECT_NOT_CONFIRMED'});
 assert.deepEqual(checkS05DeploymentScope({...safe,NEXT_PUBLIC_SUPABASE_URL:'https://igayfjorjmucthlfoasf.supabase.co'}),{ok:false,reason:'S05_PREVIEW_MUST_USE_ISOLATED_SUPABASE'});
 assert.deepEqual(checkS05DeploymentScope({...safe,PLATFORM_SUPABASE_URL:'https://wrong.supabase.co'}),{ok:false,reason:'PLATFORM_PREVIEW_MUST_USE_DEDICATED_QA_SUPABASE'});
});
for(const key of blocked){
 test('R75 preview forbids enabled or unconfigured external capability: '+key,()=>{
  for(const state of ['true',undefined,'TRUE'])
   assert.deepEqual(checkS05DeploymentScope({...safe,[key]:state}),{ok:false,reason:'R75_PREVIEW_EXTERNAL_ACTIONS_MUST_BE_DISABLED'});
 });
}
test('R75 audit branch never accepted as production release',()=>{
 const production={...safe,VERCEL_ENV:'production',
  NEXT_PUBLIC_SUPABASE_URL:'https://igayfjorjmucthlfoasf.supabase.co',
  SOCIAL_SUPABASE_URL:'https://igayfjorjmucthlfoasf.supabase.co',
  SUPABASE_SECRET_KEY:'synthetic-demo-secret-not-real',
  JENIOS_S05_SCHEMA_CERTIFIED:'true',
  JENIOS_S05_PRIOR_MANUAL_SOCIAL_TESTS_ACCEPTED:'true'};
 assert.deepEqual(checkS05DeploymentScope(production),{ok:false,reason:'S05_PRODUCTION_RELEASE_BRANCH_NOT_CONFIRMED'});
});
