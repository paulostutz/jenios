import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {checkS05DeploymentScope,REVERSO_WEB_RELEASE_BRANCH,ULTRA_COMMANDS_RELEASE_BRANCH} from '../../lib/release/environment-scope.mjs';
import {verifyReversoWebDeploymentSource} from '../../lib/release/reverso-production-source.mjs';

const production={VERCEL_ENV:'production',VERCEL_GIT_COMMIT_REF:REVERSO_WEB_RELEASE_BRANCH,
 VERCEL_GIT_COMMIT_SHA:'a'.repeat(40),VERCEL_GIT_PROVIDER:'github',VERCEL_PROJECT_ID:'prj_44ipBY3R9sHlQDAXY7NUn1zDguw4',
 NEXT_PUBLIC_SUPABASE_URL:'https://igayfjorjmucthlfoasf.supabase.co',SOCIAL_SUPABASE_URL:'https://igayfjorjmucthlfoasf.supabase.co',
 SUPABASE_SECRET_KEY:'fixture-only-secret',NEXT_PUBLIC_SUP_PUBLISHABLE_KEY:'fixture-only-public',
 PLATFORM_SUPABASE_URL:'https://xaicvhagftzjkqphnbgx.supabase.co',NEXT_PUBLIC_PLATFORM_SUPABASE_URL:'https://xaicvhagftzjkqphnbgx.supabase.co',
 NEXT_PUBLIC_PLATFORM_SUPABASE_PUBLISHABLE_KEY:'fixture-only-platform-public',PLATFORM_SUPABASE_SERVICE_ROLE_KEY:'fixture-only-server-key-over-twenty',
 JENIOS_S05_SCHEMA_CERTIFIED:'true',JENIOS_S05_E2E_CERTIFIED:'true'};
const external=['JENIOS_REAL_EXECUTION_ENABLED','JENIOS_PRIVATE_PAPER_EXECUTOR','JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED',
 'JENIOS_ROBOT_ANALYST_PAID_ENABLED','JENIOS_ROBOT_R73_ADMIN_ENABLED','JENIOS_PAY_PAYMENTS_ENABLED','JENIOS_PRO_PAYMENTS_ENABLED','JENIOS_INTER_CHARGES_ENABLED',
 'JENIOS_EMAIL_PRODUCTION_ENABLED','JENIOS_EMAIL_DISPATCHER_ENABLED','JENIOS_PAYMENT_EMAILS_ENABLED','JENIOS_TRANSACTIONAL_EMAILS_ENABLED',
 'JENIOS_MARKETING_EMAILS_ENABLED','JENIOS_MARKETING_PLANNER_ENABLED','JENIOS_SUBSCRIPTION_DUNNING_ENABLED','JENIOS_RESEND_WEBHOOK_ENABLED',
 'JENIOS_PRO_GENERATION_ENABLED','JENIOS_SALES_GENERATIVE_ENABLED','JENIOS_ASSISTANT_MEMORY_ENABLED','NEXT_PUBLIC_PLATFORM_SIGNUP_ENABLED',
 'JENIOS_LETTER_BILLING_ENABLED','JENIOS_LETTER_INTEGRATION_ENABLED'];
const preview={...production,VERCEL_ENV:'preview',NEXT_PUBLIC_SUPABASE_URL:'https://rebzztxlzofxpfwjvbee.supabase.co',
 SOCIAL_SUPABASE_URL:'https://rebzztxlzofxpfwjvbee.supabase.co',...Object.fromEntries(external.map(key=>[key,'false']))};
const flags=['REVERSO_RUNTIME_READ_ENABLED','REVERSO_SUBSCRIPTION_DEMO_ENABLED','JENIOS_REVERSO_PLAN_ISOLATION_V1'];
const capabilities=['publicationApproved','actualExecutionAuthorized','realDebitAuthorized','liveExecutionAllowed','realBillingAllowed','paymentIssuanceAllowed','brokerPermissionsGranted'];
const approval={reversoWebPublicationRelease:true,webPublicationApproved:true,exactSource:true,...Object.fromEntries(capabilities.map(key=>[key,false]))};
const good={git:(...args)=>args[0]==='rev-parse'?production.VERCEL_GIT_COMMIT_SHA:'',verifyContent:()=>({...approval})};

test('REVPUB001 production admits only the explicit Web scope and retains prior Social acceptance separately from new Auth evidence',()=>{
 assert.deepEqual(checkS05DeploymentScope(production),{ok:true,mode:'production-reverso-web-disabled-finance'});
 assert.equal(checkS05DeploymentScope({...production,JENIOS_S05_E2E_CERTIFIED:'false',JENIOS_S05_PRIOR_MANUAL_SOCIAL_TESTS_ACCEPTED:'true'}).ok,true);
 assert.equal(checkS05DeploymentScope({...production,JENIOS_S05_E2E_CERTIFIED:'false',JENIOS_S05_PRIOR_MANUAL_SOCIAL_TESTS_ACCEPTED:'false'}).ok,false);
 // Existing unrelated Letter configuration is preserved. Reverso's own routes
 // have a separate deployment boundary; this gate does not disable other products.
 assert.equal(checkS05DeploymentScope({...production,JENIOS_LETTER_BILLING_ENABLED:'true',JENIOS_LETTER_INTEGRATION_ENABLED:'true'}).ok,true);
});

test('REVPUB001 requires exact project, branch and provider identity in both preview and production',()=>{
 for(const env of [production,preview])for(const change of [{VERCEL_PROJECT_ID:'wrong-project'},{VERCEL_GIT_COMMIT_REF:REVERSO_WEB_RELEASE_BRANCH+'-unreviewed'},
  {VERCEL_GIT_PROVIDER:'gitlab'},{VERCEL_GIT_COMMIT_SHA:undefined},{VERCEL_GIT_COMMIT_SHA:'a'.repeat(39)}]){
  assert.equal(checkS05DeploymentScope({...env,...change}).ok,false);
  let checked=false;assert.throws(()=>verifyReversoWebDeploymentSource({...env,...change},{git:()=>{checked=true;return '';},verifyContent:()=>approval}),/GIT_IDENTITY_NOT_CONFIRMED/);assert.equal(checked,false);
 }
});

test('REVPUB001 refuses each unhomologated runtime switch and ambiguous values without conferring a real capability',()=>{
 for(const env of [production,preview])for(const key of flags){
  for(const value of ['true','1','TRUE',true]){
   assert.deepEqual(checkS05DeploymentScope({...env,[key]:value}),{ok:false,reason:'REVPUB001_UNHOMOLOGATED_RUNTIME_MUST_STAY_DISABLED'});
   assert.throws(()=>verifyReversoWebDeploymentSource({...env,[key]:value},good),/UNHOMOLOGATED_RUNTIME_MUST_STAY_DISABLED/);
  }
  for(const value of [undefined,'','false'])assert.equal(checkS05DeploymentScope({...env,[key]:value}).ok,true);
 }
});

test('REVPUB001 retains production backend, Platform, schema and protected-feature requirements',()=>{
 for(const change of [{NEXT_PUBLIC_SUPABASE_URL:'https://rebzztxlzofxpfwjvbee.supabase.co'},
  {SOCIAL_SUPABASE_URL:'https://other.invalid'},{SUPABASE_SECRET_KEY:undefined},{NEXT_PUBLIC_SUP_PUBLISHABLE_KEY:undefined},
  {PLATFORM_SUPABASE_URL:'https://other.invalid'},{NEXT_PUBLIC_PLATFORM_SUPABASE_URL:'https://other.invalid'},
  {NEXT_PUBLIC_PLATFORM_SUPABASE_PUBLISHABLE_KEY:undefined},{PLATFORM_SUPABASE_SERVICE_ROLE_KEY:'short'},
  {JENIOS_S05_SCHEMA_CERTIFIED:'false'},{JENIOS_TRIAL_ENABLED:'true'},{NEXT_PUBLIC_SOCIAL_OPTIMIZED_VIDEO:'true'},
  {JENIOS_PAY_PAYMENTS_ENABLED:'true'},{JENIOS_ASSISTANT_MEMORY_ENABLED:'true'},{JENIOS_SALES_GENERATIVE_ENABLED:'true'},{JENIOS_PRO_GENERATION_ENABLED:'true'}])
  assert.equal(checkS05DeploymentScope({...production,...change}).ok,false,JSON.stringify(change));
});

test('REVPUB001 preview uses isolated Social and dedicated Platform with every external action explicitly off',()=>{
 assert.deepEqual(checkS05DeploymentScope(preview),{ok:true,mode:'preview-isolated-reverso-web'});
 for(const key of external)for(const value of ['true',undefined])assert.deepEqual(checkS05DeploymentScope({...preview,[key]:value}),
  {ok:false,reason:'REVPUB001_PREVIEW_EXTERNAL_ACTIONS_MUST_BE_DISABLED'});
 for(const change of [{NEXT_PUBLIC_SUPABASE_URL:production.NEXT_PUBLIC_SUPABASE_URL},{SOCIAL_SUPABASE_URL:production.SOCIAL_SUPABASE_URL},
  {PLATFORM_SUPABASE_URL:undefined},{NEXT_PUBLIC_PLATFORM_SUPABASE_URL:'https://other.invalid'},{NEXT_PUBLIC_PLATFORM_SUPABASE_PUBLISHABLE_KEY:undefined}])
  assert.equal(checkS05DeploymentScope({...preview,...change}).ok,false);
});

test('REVPUB001 source gate compares the actual clean checkout with provider SHA before checking exact Web approval',()=>{
 for(const env of [production,preview]){
  const calls=[];const result=verifyReversoWebDeploymentSource(env,{...good,git:(...args)=>{calls.push(args);return good.git(...args);}});
  assert.deepEqual(result,{ok:true,commit:production.VERCEL_GIT_COMMIT_SHA,branch:REVERSO_WEB_RELEASE_BRANCH,environment:env.VERCEL_ENV,scope:'web-only-disabled-finance'});
  assert.deepEqual(calls,[['rev-parse','HEAD'],['diff','--name-status','--no-renames','-z','HEAD'],['ls-files','--others','--exclude-standard','-z']]);
 }
 assert.throws(()=>verifyReversoWebDeploymentSource(production,{...good,git:()=> 'b'.repeat(40)}),/CHECKOUT_SHA_MISMATCH/);
 assert.throws(()=>verifyReversoWebDeploymentSource(production,{...good,git:()=>{throw Error('missing checkout');}}),/missing checkout/);
});

test('REVPUB001 refuses tracked or untracked checkout changes and uses bounded existing diagnostics',()=>{
 for(const operation of ['diff','ls-files']){
  let reached=false;assert.throws(()=>verifyReversoWebDeploymentSource(production,{...good,
   git:(...args)=>args[0]===operation?(operation==='diff'?'M\0package.json\0':'unexpected-file.mjs\0'):good.git(...args),
   verifyContent:()=>{reached=true;return approval;}}),/REVPUB001_CHECKOUT_NOT_CLEAN/);assert.equal(reached,false);
 }
 let inspected=false;assert.throws(()=>verifyReversoWebDeploymentSource(production,{...good,
  git:(...args)=>args[0]==='diff'?'M\0vercel.json\0':good.git(...args),inspectConfig:()=>{inspected=true;return {source:'synthetic'};}}),/CHECKOUT_NOT_CLEAN/);
 assert.equal(inspected,true);
});

test('REVPUB001 exact approval cannot be substituted by broad publication, real-money, execution or broker permissions',()=>{
 for(const field of ['reversoWebPublicationRelease','webPublicationApproved','exactSource'])
  assert.throws(()=>verifyReversoWebDeploymentSource(production,{...good,verifyContent:()=>({...approval,[field]:false})}),/WEB_ONLY_CONTENT_NOT_CONFIRMED/);
 for(const field of capabilities)for(const value of [true,undefined])
  assert.throws(()=>verifyReversoWebDeploymentSource(production,{...good,verifyContent:()=>({...approval,[field]:value})}),/WEB_ONLY_CONTENT_NOT_CONFIRMED/);
 assert.throws(()=>verifyReversoWebDeploymentSource(production,{...good,verifyContent:()=>{throw Error('changed exact source');}}),/changed exact source/);
});

test('REVPUB001 leaves the original Ultra source verifier byte-exact and its existing scope unchanged',()=>{
 assert.deepEqual(readFileSync('lib/release/ultra-production-source.mjs'),
  execFileSync('git',['show','d71bf6cdc237c7fa1ba082242fa6f09f1cbf895a:lib/release/ultra-production-source.mjs']));
 assert.deepEqual(checkS05DeploymentScope({...production,VERCEL_GIT_COMMIT_REF:ULTRA_COMMANDS_RELEASE_BRANCH}),{ok:true,mode:'production-ultra-commands-exact-source'});
 assert.equal(checkS05DeploymentScope({...production,VERCEL_GIT_COMMIT_REF:ULTRA_COMMANDS_RELEASE_BRANCH,VERCEL_ENV:'preview'}).ok,false);
});
