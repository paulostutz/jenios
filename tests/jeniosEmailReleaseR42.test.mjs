import test from 'node:test';
import assert from 'node:assert/strict';
import {checkS05DeploymentScope} from '../lib/release/environment-scope.mjs';
const production={
 VERCEL_ENV:'production',VERCEL_GIT_COMMIT_REF:'release/jenios-email-r42-20261024',
 VERCEL_PROJECT_ID:'prj_44ipBY3R9sHlQDAXY7NUn1zDguw4',
 NEXT_PUBLIC_SUPABASE_URL:'https://igayfjorjmucthlfoasf.supabase.co',
 SOCIAL_SUPABASE_URL:'https://igayfjorjmucthlfoasf.supabase.co',
 NEXT_PUBLIC_SUP_PUBLISHABLE_KEY:'synthetic-test-publishable',SUPABASE_SECRET_KEY:'synthetic-test-server-key',
 PLATFORM_SUPABASE_URL:'https://xaicvhagftzjkqphnbgx.supabase.co',
 NEXT_PUBLIC_PLATFORM_SUPABASE_URL:'https://xaicvhagftzjkqphnbgx.supabase.co',
 NEXT_PUBLIC_PLATFORM_SUPABASE_PUBLISHABLE_KEY:'synthetic-platform-public',
 PLATFORM_SUPABASE_SERVICE_ROLE_KEY:'synthetic-platform-server-key',
 JENIOS_S05_SCHEMA_CERTIFIED:'true',JENIOS_S05_E2E_CERTIFIED:'false',
 JENIOS_S05_PRIOR_MANUAL_SOCIAL_TESTS_ACCEPTED:'true'
};
test('R42 email release preserves accepted production Auth and the existing Platform binding',()=>{
 assert.deepEqual(checkS05DeploymentScope(production),{ok:true,mode:'production-email-r42-prior-manual-acceptance'});
 for(const key of ['VERCEL_PROJECT_ID','PLATFORM_SUPABASE_URL','PLATFORM_SUPABASE_SERVICE_ROLE_KEY','NEXT_PUBLIC_SUPABASE_URL','JENIOS_S05_PRIOR_MANUAL_SOCIAL_TESTS_ACCEPTED'])
  assert.equal(checkS05DeploymentScope({...production,[key]:''}).ok,false,key);
});
test('R42 exact email branch does not permit trials, unverified video or a different project',()=>{
 for(const key of ['JENIOS_TRIAL_ENABLED','JENIOS_TRIAL_ACTIVATION_APPROVED','NEXT_PUBLIC_SOCIAL_OPTIMIZED_VIDEO'])
  assert.equal(checkS05DeploymentScope({...production,[key]:'true'}).ok,false,key);
 assert.equal(checkS05DeploymentScope({...production,VERCEL_GIT_COMMIT_REF:'release/other-email'}).ok,false);
 assert.equal(checkS05DeploymentScope({...production,VERCEL_ENV:'preview'}).ok,false);
});
