import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {checkS05DeploymentScope} from '../../lib/release/environment-scope.mjs';
const release='release/jenios-s05-integrada-homologacao-20261018';
const preview={VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:release,
 NEXT_PUBLIC_SUPABASE_URL:'https://rebzztxlzofxpfwjvbee.supabase.co',
 SOCIAL_SUPABASE_URL:'https://rebzztxlzofxpfwjvbee.supabase.co',
 NEXT_PUBLIC_SUP_PUBLISHABLE_KEY:'fake-publishable-test-only'};
const prod={VERCEL_ENV:'production',VERCEL_GIT_COMMIT_REF:release,
 NEXT_PUBLIC_SUPABASE_URL:'https://igayfjorjmucthlfoasf.supabase.co',
 SOCIAL_SUPABASE_URL:'https://igayfjorjmucthlfoasf.supabase.co',
 JENIOS_S05_SCHEMA_CERTIFIED:'true',JENIOS_S05_E2E_CERTIFIED:'true',
 SUPABASE_SECRET_KEY:'synthetic-test-secret-not-valid-for-api',
 NEXT_PUBLIC_SUP_PUBLISHABLE_KEY:'synthetic-test-publishable'};
test('S05-B40 stage preview with isolated Supabase is permitted',()=>{
 assert.deepEqual(checkS05DeploymentScope(preview),{ok:true,mode:'preview-isolated'});
});
test('S05-B40 preview cannot point to production Supabase or unknown tenant',()=>{
 for(const bad of ['https://igayfjorjmucthlfoasf.supabase.co','https://thirdparty.invalid'])
 assert.equal(checkS05DeploymentScope({...preview,NEXT_PUBLIC_SUPABASE_URL:bad}).ok,false);
});
test('S05-B40 production cannot point to staging Supabase',()=>{
 assert.equal(checkS05DeploymentScope({...prod,NEXT_PUBLIC_SUPABASE_URL:preview.NEXT_PUBLIC_SUPABASE_URL}).ok,false);
 assert.equal(checkS05DeploymentScope({...prod,SOCIAL_SUPABASE_URL:preview.SOCIAL_SUPABASE_URL}).ok,false);
});
test('S05-B40 production refuses missing E2E or schema certification',()=>{
 for(const key of ['JENIOS_S05_SCHEMA_CERTIFIED','JENIOS_S05_E2E_CERTIFIED'])
 assert.equal(checkS05DeploymentScope({...prod,[key]:'false'}).ok,false);
});
test('S05-B40 production requires expected release branch',()=>{
 assert.equal(checkS05DeploymentScope({...prod,VERCEL_GIT_COMMIT_REF:'jenios-s05-homologacao-20261018'}).ok,false);
});
test('S05-B40 trial and unverified transcoding remain blocked in all environments',()=>{
 for(const key of ['JENIOS_TRIAL_ENABLED','JENIOS_TRIAL_ACTIVATION_APPROVED','NEXT_PUBLIC_SOCIAL_OPTIMIZED_VIDEO'])
  for(const env of [preview,prod])
   assert.equal(checkS05DeploymentScope({...env,[key]:'true'}).ok,false);
});
test('S05-B40 build invokes environment scope validation before other work',()=>{
 const source=JSON.parse(readFileSync('package.json','utf8')).scripts.build;
 assert.match(source,/^node scripts\/check-s05-env-scope\.mjs && npm test/);
});

test('S05 production refuses missing financial Supabase service credentials even when other gates claim true',()=>{
 for(const key of ['SUPABASE_SECRET_KEY','SUPABASE_SERVICE_ROLE_KEY']){
  const noSecret={...prod,SUPABASE_SECRET_KEY:undefined,SUPABASE_SERVICE_ROLE_KEY:undefined};
  assert.equal(checkS05DeploymentScope(noSecret).reason,'S05_PRODUCTION_FINANCIAL_SUPABASE_SECRET_MISSING');
 }
});
test('S05 production refuses missing public publishable key',()=>{
 const result=checkS05DeploymentScope({...prod,NEXT_PUBLIC_SUP_PUBLISHABLE_KEY:undefined});
 assert.equal(result.reason,'S05_PRODUCTION_PUBLISHABLE_KEY_MISSING');
});
test('S05 production refuses to enable Inter charges without all current credentials',()=>{
 const active={...prod,JENIOS_PAY_PAYMENTS_ENABLED:'true'};
 assert.equal(checkS05DeploymentScope(active).reason,'S05_PRODUCTION_ACTIVE_INTER_CREDENTIALS_MISSING');
 assert.deepEqual(checkS05DeploymentScope({...active,
  INTER_CLIENT_ID:'fixture-id',INTER_CLIENT_SECRET:'fixture-secret',
  INTER_CERTIFICATE:'fixture-certificate',INTER_PRIVATE_KEY:'fixture-key'}),
  {ok:true,mode:'production-validated'});
});

test('S05-B49 explicitly accepts prior user-confirmed manual Social tests without claiming fresh E2E',()=>{
 const approved={...prod,JENIOS_S05_E2E_CERTIFIED:'false',JENIOS_S05_PRIOR_MANUAL_SOCIAL_TESTS_ACCEPTED:'true'};
 assert.deepEqual(checkS05DeploymentScope(approved),{ok:true,mode:'production-prior-manual-acceptance'});
 assert.equal(checkS05DeploymentScope({...approved,JENIOS_S05_PRIOR_MANUAL_SOCIAL_TESTS_ACCEPTED:'false'}).ok,false);
 assert.equal(checkS05DeploymentScope({...approved,JENIOS_S05_SCHEMA_CERTIFIED:'false'}).ok,false);
 assert.equal(checkS05DeploymentScope({...approved,SUPABASE_SECRET_KEY:undefined}).ok,false);
 assert.equal(checkS05DeploymentScope({...approved,NEXT_PUBLIC_SUP_PUBLISHABLE_KEY:undefined}).ok,false);
});
test('S05-B49 prior manual acceptance may not activate trial or optimized video',()=>{
 const manual={...prod,JENIOS_S05_E2E_CERTIFIED:'false',JENIOS_S05_PRIOR_MANUAL_SOCIAL_TESTS_ACCEPTED:'true'};
 for(const key of ['JENIOS_TRIAL_ENABLED','JENIOS_TRIAL_ACTIVATION_APPROVED','NEXT_PUBLIC_SOCIAL_OPTIMIZED_VIDEO'])
  assert.equal(checkS05DeploymentScope({...manual,[key]:'true'}).ok,false);
});

test('S05 plus Platform preview accepts only exact integration branch and two isolated QA databases',()=>{
 const integrated={...preview,VERCEL_GIT_COMMIT_REF:'release/jenios-s05-platform-cp70-integracao-20261019',
   NEXT_PUBLIC_PLATFORM_SUPABASE_URL:'https://xaicvhagftzjkqphnbgx.supabase.co',
   NEXT_PUBLIC_PLATFORM_SUPABASE_PUBLISHABLE_KEY:'only-public-publishable-fixture'};
 assert.deepEqual(checkS05DeploymentScope(integrated),{ok:true,mode:'preview-isolated-platform-integration'});
 assert.equal(checkS05DeploymentScope({...integrated,NEXT_PUBLIC_SUPABASE_URL:prod.NEXT_PUBLIC_SUPABASE_URL}).ok,false);
 assert.equal(checkS05DeploymentScope({...integrated,NEXT_PUBLIC_PLATFORM_SUPABASE_URL:prod.NEXT_PUBLIC_SUPABASE_URL}).ok,false);
 assert.equal(checkS05DeploymentScope({...integrated,NEXT_PUBLIC_PLATFORM_SUPABASE_PUBLISHABLE_KEY:undefined}).ok,false);
 assert.equal(checkS05DeploymentScope({...integrated,VERCEL_GIT_COMMIT_REF:'unapproved-branch'}).ok,false);
 assert.equal(checkS05DeploymentScope({...integrated,VERCEL_ENV:'production',
   NEXT_PUBLIC_SUPABASE_URL:prod.NEXT_PUBLIC_SUPABASE_URL,SOCIAL_SUPABASE_URL:prod.SOCIAL_SUPABASE_URL,
   ...Object.fromEntries(['SUPABASE_SECRET_KEY','JENIOS_S05_SCHEMA_CERTIFIED','JENIOS_S05_E2E_CERTIFIED'].map(k=>[k,prod[k]]))}).ok,false);
});

test('Integrated CP70 release cannot reach jenios.com.br without dedicated Platform server configuration',()=>{
 const integration={
  ...prod,
  VERCEL_GIT_COMMIT_REF:'release/jenios-s05-platform-cp70-integracao-20261019',
  PLATFORM_SUPABASE_URL:'https://xaicvhagftzjkqphnbgx.supabase.co',
  NEXT_PUBLIC_PLATFORM_SUPABASE_URL:'https://xaicvhagftzjkqphnbgx.supabase.co',
  NEXT_PUBLIC_PLATFORM_SUPABASE_PUBLISHABLE_KEY:'pub-key-only-fixture',
  PLATFORM_SUPABASE_SERVICE_ROLE_KEY:'server-fixture-not-a-real-key-1234567890'
 };
 assert.deepEqual(checkS05DeploymentScope(integration),{
  ok:true,mode:'production-s05-platform-dedicated-auth-ready'
 });
 assert.equal(checkS05DeploymentScope({...integration,PLATFORM_SUPABASE_SERVICE_ROLE_KEY:undefined}).reason,
  'PLATFORM_PRODUCTION_SERVER_SECRET_MISSING');
 assert.equal(checkS05DeploymentScope({...integration,PLATFORM_SUPABASE_SERVICE_ROLE_KEY:'x'}).reason,
  'PLATFORM_PRODUCTION_SERVER_SECRET_MISSING');
 assert.equal(checkS05DeploymentScope({...integration,PLATFORM_SUPABASE_URL:prod.NEXT_PUBLIC_SUPABASE_URL}).reason,
  'PLATFORM_PRODUCTION_DEDICATED_SUPABASE_URL_MISSING');
 assert.equal(checkS05DeploymentScope({...integration,NEXT_PUBLIC_PLATFORM_SUPABASE_URL:preview.NEXT_PUBLIC_SUPABASE_URL}).reason,
  'PLATFORM_PRODUCTION_DEDICATED_SUPABASE_URL_MISSING');
 assert.equal(checkS05DeploymentScope({...integration,NEXT_PUBLIC_PLATFORM_SUPABASE_PUBLISHABLE_KEY:undefined}).reason,
  'PLATFORM_PRODUCTION_PUBLIC_KEY_MISSING');
 assert.equal(checkS05DeploymentScope({...integration,NEXT_PUBLIC_SUPABASE_URL:preview.NEXT_PUBLIC_SUPABASE_URL}).reason,
  'S05_PRODUCTION_SUPABASE_SCOPE_NOT_CONFIRMED');
 assert.equal(checkS05DeploymentScope({...integration,JENIOS_S05_SCHEMA_CERTIFIED:'false'}).reason,
  'S05_PRODUCTION_GATES_NOT_CERTIFIED');
 assert.equal(checkS05DeploymentScope({...integration,JENIOS_TRIAL_ENABLED:'true'}).reason,
  'S05_TRIAL_NOT_CERTIFIED');
 assert.equal(checkS05DeploymentScope({...integration,NEXT_PUBLIC_SOCIAL_OPTIMIZED_VIDEO:'true'}).reason,
  'S05_FFMPEG_OPTIMIZATION_NOT_CERTIFIED');
});
