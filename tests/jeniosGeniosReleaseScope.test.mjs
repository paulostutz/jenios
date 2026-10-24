import test from 'node:test';
import assert from 'node:assert/strict';
import {checkS05DeploymentScope} from '../lib/release/environment-scope.mjs';
const branch='feat/jenios-genios-contexto-20261024';
const fixture={VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:branch,NEXT_PUBLIC_SUPABASE_URL:'https://rebzztxlzofxpfwjvbee.supabase.co',
 SOCIAL_SUPABASE_URL:'https://rebzztxlzofxpfwjvbee.supabase.co',NEXT_PUBLIC_SUPABASE_ANON_KEY:'fixture-public',
 NEXT_PUBLIC_PLATFORM_SUPABASE_URL:'https://xaicvhagftzjkqphnbgx.supabase.co',NEXT_PUBLIC_PLATFORM_SUPABASE_PUBLISHABLE_KEY:'fixture-public'};
test('G43 isolated preview is explicitly bound to the reviewed branch and QA databases',()=>{
 assert.equal(checkS05DeploymentScope(fixture).mode,'preview-isolated-assistant-context');
 assert.equal(checkS05DeploymentScope({...fixture,NEXT_PUBLIC_SUPABASE_URL:'https://igayfjorjmucthlfoasf.supabase.co'}).ok,false);
 assert.equal(checkS05DeploymentScope({...fixture,VERCEL_GIT_COMMIT_REF:'feat/unreviewed'}).ok,false);
});
test('G43 preview cannot activate paid provider calls or silently promote to production',()=>{
 for(const gate of ['JENIOS_PRO_GENERATION_ENABLED','JENIOS_SALES_GENERATIVE_ENABLED'])assert.equal(checkS05DeploymentScope({...fixture,[gate]:'true'}).reason,'ASSISTANT_CONTEXT_PREVIEW_GENERATION_NOT_APPROVED');
 const production={...fixture,VERCEL_ENV:'production',NEXT_PUBLIC_SUPABASE_URL:'https://igayfjorjmucthlfoasf.supabase.co',SOCIAL_SUPABASE_URL:'https://igayfjorjmucthlfoasf.supabase.co',
  SUPABASE_SECRET_KEY:'fixture-server',JENIOS_S05_SCHEMA_CERTIFIED:'true',JENIOS_S05_PRIOR_MANUAL_SOCIAL_TESTS_ACCEPTED:'true'};
 assert.equal(checkS05DeploymentScope(production).reason,'S05_PRODUCTION_RELEASE_BRANCH_NOT_CONFIRMED');
});
