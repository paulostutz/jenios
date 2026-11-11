import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {checkS05DeploymentScope,ULTRA_COMMANDS_RELEASE_BRANCH} from '../../lib/release/environment-scope.mjs';
import {verifyUltraProductionSource} from '../../lib/release/ultra-production-source.mjs';
const env={VERCEL_ENV:'production',VERCEL_GIT_COMMIT_REF:ULTRA_COMMANDS_RELEASE_BRANCH,VERCEL_GIT_COMMIT_SHA:'a'.repeat(40),VERCEL_GIT_PROVIDER:'github',VERCEL_PROJECT_ID:'prj_44ipBY3R9sHlQDAXY7NUn1zDguw4',NEXT_PUBLIC_SUPABASE_URL:'https://igayfjorjmucthlfoasf.supabase.co',SOCIAL_SUPABASE_URL:'https://igayfjorjmucthlfoasf.supabase.co',SUPABASE_SECRET_KEY:'fixture-secret',NEXT_PUBLIC_SUP_PUBLISHABLE_KEY:'fixture-public',PLATFORM_SUPABASE_URL:'https://xaicvhagftzjkqphnbgx.supabase.co',NEXT_PUBLIC_PLATFORM_SUPABASE_URL:'https://xaicvhagftzjkqphnbgx.supabase.co',NEXT_PUBLIC_PLATFORM_SUPABASE_PUBLISHABLE_KEY:'fixture-platform-public',PLATFORM_SUPABASE_SERVICE_ROLE_KEY:'fixture-server-key-more-than-twenty',JENIOS_S05_SCHEMA_CERTIFIED:'true',JENIOS_S05_E2E_CERTIFIED:'true'};
const good={git:(...args)=>args[0]==='rev-parse'?env.VERCEL_GIT_COMMIT_SHA:'',verifyContent:()=>({ultraProductionScopeRelease:true,exactSource:true})};
test('exact Ultra production branch preserves full dedicated scope and certified approval',()=>{
 assert.deepEqual(checkS05DeploymentScope(env),{ok:true,mode:'production-ultra-commands-exact-source'});
 assert.equal(checkS05DeploymentScope({...env,JENIOS_S05_E2E_CERTIFIED:'false',JENIOS_S05_PRIOR_MANUAL_SOCIAL_TESTS_ACCEPTED:'true'}).ok,true);
 assert.equal(verifyUltraProductionSource(env,good).commit,env.VERCEL_GIT_COMMIT_SHA);
});
test('Ultra preview stays unapproved and wrong refs/projects/providers/SHAs are refused',()=>{
 for(const change of [{VERCEL_ENV:'preview'},{VERCEL_GIT_COMMIT_REF:ULTRA_COMMANDS_RELEASE_BRANCH+'-other'},{VERCEL_PROJECT_ID:'wrong'},{VERCEL_GIT_PROVIDER:'gitlab'},{VERCEL_GIT_COMMIT_SHA:undefined},{VERCEL_GIT_COMMIT_SHA:'a'.repeat(39)},{VERCEL_GIT_COMMIT_SHA:'a'.repeat(40)+';echo fake'}]){
  assert.equal(checkS05DeploymentScope({...env,...change}).ok,false);assert.throws(()=>verifyUltraProductionSource({...env,...change},good));
 }
});
test('platform identity must match real checkout; exact content is checked without fallback',()=>{
 assert.throws(()=>verifyUltraProductionSource(env,{...good,git:()=> 'b'.repeat(40)}),/CHECKOUT_SHA_MISMATCH/);
 assert.throws(()=>verifyUltraProductionSource(env,{...good,git:()=>{throw Error('no checkout')}}));
 for(const operation of ['diff','ls-files'])assert.throws(()=>verifyUltraProductionSource(env,{...good,git:(...args)=>args[0]===operation?'changed-file':good.git(...args)}),/CHECKOUT_NOT_CLEAN/);
 assert.throws(()=>verifyUltraProductionSource(env,{...good,verifyContent:()=>{throw Error('modified source')}}));
 assert.throws(()=>verifyUltraProductionSource(env,{...good,verifyContent:()=>({exactSource:true})}),/CONTENT_NOT_CONFIRMED/);
});
test('new authorization cannot weaken DB, keys, schema, approval, trial, video or active provider gates',()=>{
 for(const change of [{NEXT_PUBLIC_SUPABASE_URL:'https://wrong.invalid'},{SOCIAL_SUPABASE_URL:'https://wrong.invalid'},{SUPABASE_SECRET_KEY:undefined},{NEXT_PUBLIC_SUP_PUBLISHABLE_KEY:undefined},{PLATFORM_SUPABASE_URL:'https://wrong.invalid'},{NEXT_PUBLIC_PLATFORM_SUPABASE_URL:'https://wrong.invalid'},{NEXT_PUBLIC_PLATFORM_SUPABASE_PUBLISHABLE_KEY:undefined},{PLATFORM_SUPABASE_SERVICE_ROLE_KEY:'short'},{JENIOS_S05_SCHEMA_CERTIFIED:'false'},{JENIOS_S05_E2E_CERTIFIED:'false'},{JENIOS_TRIAL_ENABLED:'true'},{JENIOS_TRIAL_ACTIVATION_APPROVED:'true'},{NEXT_PUBLIC_SOCIAL_OPTIMIZED_VIDEO:'true'},{JENIOS_PAY_PAYMENTS_ENABLED:'true'},{JENIOS_ASSISTANT_MEMORY_ENABLED:'true'},{JENIOS_SALES_GENERATIVE_ENABLED:'true'},{JENIOS_PRO_GENERATION_ENABLED:'true'}])assert.equal(checkS05DeploymentScope({...env,...change}).ok,false,JSON.stringify(change));
});
test('build retains original command and validates source before production environment gate',()=>{
 const command=JSON.parse(readFileSync('package.json','utf8')).scripts.build;
 assert.equal(command,'node scripts/check-s05-env-scope.mjs && npm test && npm run test:release-s05 && next build');
 const code=readFileSync('scripts/check-s05-env-scope.mjs','utf8');assert.ok(code.indexOf('verifyUltraProductionSource(process.env)')<code.indexOf('checkS05DeploymentScope(process.env)'));
 assert.doesNotMatch(code,/process\.env\.[A-Z_]+\s*=(?!=)/);
});

test('production extension pins source verifier, gate, tests and exact predecessor',async()=>{
 const {verifyOwnerWebRelease}=await import('../../scripts/check-ultra-owner-web.mjs');
 assert.equal(verifyOwnerWebRelease().ultraProductionScopeRelease,true);
 for(const target of ['lib/release/environment-scope.mjs','lib/release/ultra-production-source.mjs','scripts/check-s05-env-scope.mjs','scripts/check-ultra-commands-web-baseline.mjs','tests/release-s05/environment-ultra-production.test.mjs','docs/release/ULTRA-PRODUCTION-SCOPE-RELEASE.json'])assert.throws(()=>verifyOwnerWebRelease({read:name=>name===target?Buffer.from('changed'):readFileSync(name)}));
});
