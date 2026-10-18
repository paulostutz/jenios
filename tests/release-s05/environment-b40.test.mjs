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
 JENIOS_S05_SCHEMA_CERTIFIED:'true',JENIOS_S05_E2E_CERTIFIED:'true'};
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
