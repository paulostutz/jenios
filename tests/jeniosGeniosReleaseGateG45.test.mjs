import test from 'node:test';
import assert from 'node:assert/strict';
import {checkS05DeploymentScope} from '../lib/release/environment-scope.mjs';

const G45='fix/jenios-g45-integrated-pr5-pr6-20261024';
const env=Object.freeze({
  VERCEL_ENV:'production',
  VERCEL_GIT_COMMIT_REF:G45,
  VERCEL_PROJECT_ID:'prj_44ipBY3R9sHlQDAXY7NUn1zDguw4',
  NEXT_PUBLIC_SUPABASE_URL:'https://igayfjorjmucthlfoasf.supabase.co',
  SOCIAL_SUPABASE_URL:'https://igayfjorjmucthlfoasf.supabase.co',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'synthetic-public-key',
  SUPABASE_SECRET_KEY:'synthetic-server-secret-key-not-real',
  NEXT_PUBLIC_PLATFORM_SUPABASE_URL:'https://xaicvhagftzjkqphnbgx.supabase.co',
  PLATFORM_SUPABASE_URL:'https://xaicvhagftzjkqphnbgx.supabase.co',
  NEXT_PUBLIC_PLATFORM_SUPABASE_PUBLISHABLE_KEY:'synthetic-platform-public-key',
  PLATFORM_SUPABASE_SERVICE_ROLE_KEY:'synthetic-platform-server-key-not-real',
  JENIOS_S05_SCHEMA_CERTIFIED:'true',
  JENIOS_S05_E2E_CERTIFIED:'true'
});

test('G45 exact integrated branch inherits the reviewed production release gate',()=>{
  assert.deepEqual(checkS05DeploymentScope(env),{
    ok:true,
    mode:'production-assistant-g44-integrated'
  });
  assert.deepEqual(checkS05DeploymentScope({...env,VERCEL_PROJECT_ID:'prj_other'}),{
    ok:false,
    reason:'G44_PROJECT_NOT_CONFIRMED'
  });
});

test('G45 production gate rejects neighboring and unreviewed branch names',()=>{
  for(const branch of [
    'fix/jenios-g45-integrated-pr5-pr6-20261025',
    'fix/jenios-g45-unreviewed',
    'main'
  ]){
    assert.deepEqual(checkS05DeploymentScope({...env,VERCEL_GIT_COMMIT_REF:branch}),{
      ok:false,
      reason:'S05_PRODUCTION_RELEASE_BRANCH_NOT_CONFIRMED'
    });
  }
});
