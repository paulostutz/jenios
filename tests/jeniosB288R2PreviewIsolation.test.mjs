import test from 'node:test';
import assert from 'node:assert/strict';
import {checkS05DeploymentScope} from '../lib/release/environment-scope.mjs';
const stage='https://rebzztxlzofxpfwjvbee.supabase.co';
const qa='https://xaicvhagftzjkqphnbgx.supabase.co';
const env={VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'fix/jenios-b288-r2-preview-isolation-20261021',
 NEXT_PUBLIC_SUPABASE_URL:stage,SOCIAL_SUPABASE_URL:stage,
 NEXT_PUBLIC_SUPABASE_ANON_KEY:'test-only',
 NEXT_PUBLIC_PLATFORM_SUPABASE_URL:qa,NEXT_PUBLIC_PLATFORM_SUPABASE_PUBLISHABLE_KEY:'test-only',
 JENIOS_SALES_GENERATIVE_ENABLED:'false',JENIOS_INTER_CHARGES_ENABLED:'false',
 JENIOS_PAY_PAYMENTS_ENABLED:'false',JENIOS_REAL_EXECUTION_ENABLED:'false',
 JENIOS_PRIVATE_PAPER_EXECUTOR:'false'};
test('B288 isolated branch can build only with stage Social and dedicated Platform QA',()=>{
 assert.deepEqual(checkS05DeploymentScope(env),{ok:true,mode:'preview-isolated-b288-qa'});
 for(const patch of [{NEXT_PUBLIC_SUPABASE_URL:'https://igayfjorjmucthlfoasf.supabase.co'},
 {SOCIAL_SUPABASE_URL:'https://igayfjorjmucthlfoasf.supabase.co'},
 {NEXT_PUBLIC_PLATFORM_SUPABASE_URL:stage},
 {NEXT_PUBLIC_PLATFORM_SUPABASE_PUBLISHABLE_KEY:''},
 {JENIOS_SALES_GENERATIVE_ENABLED:'true'},
 {JENIOS_INTER_CHARGES_ENABLED:'true'},
 {JENIOS_PAY_PAYMENTS_ENABLED:'true'},
 {JENIOS_REAL_EXECUTION_ENABLED:'true'},
 {JENIOS_PRIVATE_PAPER_EXECUTOR:'true'}]){
  assert.equal(checkS05DeploymentScope({...env,...patch}).ok,false);
 }
});
test('B288 unknown preview branches and production cannot inherit preview permission',()=>{
 assert.equal(checkS05DeploymentScope({...env,VERCEL_GIT_COMMIT_REF:'fix/unknown'}).ok,false);
 assert.equal(checkS05DeploymentScope({...env,VERCEL_ENV:'production'}).ok,false);
 assert.equal(checkS05DeploymentScope({...env,VERCEL_ENV:'production',VERCEL_GIT_COMMIT_REF:env.VERCEL_GIT_COMMIT_REF}).ok,false);
});
