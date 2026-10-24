import test from 'node:test';
import assert from 'node:assert/strict';
import {checkS05DeploymentScope} from '../lib/release/environment-scope.mjs';

// Only synthetic credentials are used. The checker is pure; no provider or database is contacted.
const QA_SOCIAL='https://rebzztxlzofxpfwjvbee.supabase.co';
const PRODUCTION_SOCIAL='https://igayfjorjmucthlfoasf.supabase.co';
const PLATFORM='https://xaicvhagftzjkqphnbgx.supabase.co';
const BRANCH='release/jenios-genios-g44-20261024';
const G43='feat/jenios-genios-contexto-20261024';
const PROJECT='prj_44ipBY3R9sHlQDAXY7NUn1zDguw4';
const preview=Object.freeze({
 VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:BRANCH,VERCEL_PROJECT_ID:PROJECT,
 NEXT_PUBLIC_SUPABASE_URL:QA_SOCIAL,SOCIAL_SUPABASE_URL:QA_SOCIAL,
 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'synthetic-social-public',
 SUPABASE_SECRET_KEY:'synthetic-social-server-key-not-real',
 NEXT_PUBLIC_PLATFORM_SUPABASE_URL:PLATFORM,PLATFORM_SUPABASE_URL:PLATFORM,
 NEXT_PUBLIC_PLATFORM_SUPABASE_PUBLISHABLE_KEY:'synthetic-platform-public',
 PLATFORM_SUPABASE_SERVICE_ROLE_KEY:'synthetic-platform-server-key-not-real'
});
const production=Object.freeze({...preview,VERCEL_ENV:'production',
 NEXT_PUBLIC_SUPABASE_URL:PRODUCTION_SOCIAL,SOCIAL_SUPABASE_URL:PRODUCTION_SOCIAL,
 JENIOS_S05_SCHEMA_CERTIFIED:'true',JENIOS_S05_E2E_CERTIFIED:'true'
});
const memory={JENIOS_ASSISTANT_MEMORY_ENABLED:'true',JENIOS_G44_SCHEMA_CERTIFIED:'true',
 JENIOS_ASSISTANT_SESSION_SECRET:'synthetic-session-secret-never-used-outside-tests'};
const provider={OPENAI_API_KEY:'synthetic-provider-key-never-sent-over-network',
 JENIOS_SALES_MODEL:'gpt-6-luna',JENIOS_SALES_VISITOR_SALT:'synthetic-visitor-salt-never-used-outside-tests',
 JENIOS_PRO_QUOTE_SECRET:'synthetic-quote-secret-never-used-outside-tests'};
const inter={INTER_CLIENT_ID:'synthetic-id',INTER_CLIENT_SECRET:'synthetic-secret',
 INTER_CERTIFICATE:'synthetic-certificate',INTER_PRIVATE_KEY:'synthetic-private-key'};
const assertRefused=(env,reason)=>assert.deepEqual(checkS05DeploymentScope(env),{ok:false,reason});
const assertAccepted=(env,mode)=>assert.deepEqual(checkS05DeploymentScope(env),{ok:true,mode});

test('G44 preview accepts the reviewed project and separate Social/Platform QA bindings',()=>{
 assertAccepted(preview,'preview-isolated-assistant-activation');
 assertAccepted({...preview,...memory,...provider,JENIOS_SALES_GENERATIVE_ENABLED:'true',JENIOS_PRO_GENERATION_ENABLED:'true'},'preview-isolated-assistant-activation');
});

test('G44 requires the exact Vercel project in preview and production',()=>{
 for(const env of [preview,production])for(const project of [undefined,'','prj_other'])
  assertRefused({...env,VERCEL_PROJECT_ID:project},'G44_PROJECT_NOT_CONFIRMED');
});

test('G44 preview refuses production or an unrelated URL in either Social alias',()=>{
 for(const key of ['NEXT_PUBLIC_SUPABASE_URL','SOCIAL_SUPABASE_URL'])
  for(const url of [undefined,'',PRODUCTION_SOCIAL,PLATFORM,'https://other.invalid'])
   assertRefused({...preview,[key]:url},'S05_PREVIEW_MUST_USE_ISOLATED_SUPABASE');
});

test('G44 preview refuses a public Platform URL outside the dedicated backend',()=>{
 for(const url of [undefined,'',QA_SOCIAL,PRODUCTION_SOCIAL,'https://other.invalid'])
  assertRefused({...preview,NEXT_PUBLIC_PLATFORM_SUPABASE_URL:url},'PLATFORM_PREVIEW_MUST_USE_DEDICATED_QA_SUPABASE');
 assertRefused({...preview,NEXT_PUBLIC_PLATFORM_SUPABASE_PUBLISHABLE_KEY:undefined},'PLATFORM_PREVIEW_MUST_USE_DEDICATED_QA_SUPABASE');
});

test('G44 preview also binds the privileged Platform server URL, independently of its public URL',()=>{
 for(const url of [undefined,'',QA_SOCIAL,PRODUCTION_SOCIAL,'https://other.invalid'])
  assertRefused({...preview,PLATFORM_SUPABASE_URL:url},'PLATFORM_PREVIEW_MUST_USE_DEDICATED_QA_SUPABASE');
});

test('G44 keeps public-key aliases without treating them as financial server credentials',()=>{
 const noPublic={NEXT_PUBLIC_SUP_PUBLISHABLE_KEY:undefined,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:undefined,NEXT_PUBLIC_SUPABASE_ANON_KEY:undefined};
 for(const env of [preview,production]){
  assertRefused({...env,...noPublic},env===preview?'S05_PREVIEW_PUBLISHABLE_KEY_MISSING':'S05_PRODUCTION_PUBLISHABLE_KEY_MISSING');
  for(const key of Object.keys(noPublic))assert.equal(checkS05DeploymentScope({...env,...noPublic,[key]:'synthetic-public'}).ok,true,key);
 }
 assertRefused({...production,SUPABASE_SECRET_KEY:undefined,SUPABASE_SERVICE_ROLE_KEY:undefined},'S05_PRODUCTION_FINANCIAL_SUPABASE_SECRET_MISSING');
 assertAccepted({...production,SUPABASE_SECRET_KEY:undefined,SUPABASE_SERVICE_ROLE_KEY:'synthetic-service-role-key'},'production-assistant-g44-integrated');
 // Modern Supabase keys are opaque. Offline scope validation must not demand JWT syntax.
 for(const env of [preview,production])assert.equal(checkS05DeploymentScope({...env,
  SUPABASE_SECRET_KEY:'sb_secret_synthetic_fixture_not_a_real_key',
  PLATFORM_SUPABASE_SERVICE_ROLE_KEY:'sb_secret_synthetic_platform_fixture_not_real'}).ok,true);
});

test('G44 production retains both the S05 certification and accepted prior manual alternative',()=>{
 assertAccepted(production,'production-assistant-g44-integrated');
 assertAccepted({...production,JENIOS_S05_E2E_CERTIFIED:'false',JENIOS_S05_PRIOR_MANUAL_SOCIAL_TESTS_ACCEPTED:'true'},'production-assistant-g44-integrated');
 for(const schema of [undefined,'false'])
  assertRefused({...production,JENIOS_S05_SCHEMA_CERTIFIED:schema,JENIOS_S05_PRIOR_MANUAL_SOCIAL_TESTS_ACCEPTED:'true'},'S05_PRODUCTION_GATES_NOT_CERTIFIED');
 for(const e2e of [undefined,'false'])
  assertRefused({...production,JENIOS_S05_E2E_CERTIFIED:e2e,JENIOS_S05_PRIOR_MANUAL_SOCIAL_TESTS_ACCEPTED:'false'},'S05_PRODUCTION_GATES_NOT_CERTIFIED');
});

test('G44 production refuses Social QA aliases and an unreviewed release branch',()=>{
 for(const key of ['NEXT_PUBLIC_SUPABASE_URL','SOCIAL_SUPABASE_URL'])
  for(const url of [QA_SOCIAL,PLATFORM,'https://other.invalid'])
   assertRefused({...production,[key]:url},'S05_PRODUCTION_SUPABASE_SCOPE_NOT_CONFIRMED');
 for(const branch of ['main','release/jenios-genios-g44-20261025','feat/unreviewed'])
  assertRefused({...production,VERCEL_GIT_COMMIT_REF:branch},'S05_PRODUCTION_RELEASE_BRANCH_NOT_CONFIRMED');
});

test('G44 production still requires the dedicated Platform URL, public key and server secret',()=>{
 for(const key of ['PLATFORM_SUPABASE_URL','NEXT_PUBLIC_PLATFORM_SUPABASE_URL'])
  for(const url of [undefined,'',QA_SOCIAL,PRODUCTION_SOCIAL,'https://other.invalid'])
   assertRefused({...production,[key]:url},'PLATFORM_PRODUCTION_DEDICATED_SUPABASE_URL_MISSING');
 assertRefused({...production,NEXT_PUBLIC_PLATFORM_SUPABASE_PUBLISHABLE_KEY:undefined},'PLATFORM_PRODUCTION_PUBLIC_KEY_MISSING');
 for(const key of [undefined,'','short'])
  assertRefused({...production,PLATFORM_SUPABASE_SERVICE_ROLE_KEY:key},'PLATFORM_PRODUCTION_SERVER_SECRET_MISSING');
});

test('G44 does not bypass the S05 trial and unverified video restrictions',()=>{
 for(const env of [preview,production]){
  for(const key of ['JENIOS_TRIAL_ENABLED','JENIOS_TRIAL_ACTIVATION_APPROVED'])
   assertRefused({...env,[key]:'true'},'S05_TRIAL_NOT_CERTIFIED');
  assertRefused({...env,NEXT_PUBLIC_SOCIAL_OPTIMIZED_VIDEO:'true'},'S05_FFMPEG_OPTIMIZATION_NOT_CERTIFIED');
 }
});

test('G44 production does not activate payments without the complete existing Inter credential set',()=>{
 const active={...production,...inter,JENIOS_PAY_PAYMENTS_ENABLED:'true'};
 assertAccepted(active,'production-assistant-g44-integrated');
 for(const key of Object.keys(inter))
  assertRefused({...active,[key]:undefined},'S05_PRODUCTION_ACTIVE_INTER_CREDENTIALS_MISSING');
});

test('G44 memory requires its own schema certification and server session secret in either hosted environment',()=>{
 for(const env of [preview,production]){
  assert.equal(checkS05DeploymentScope({...env,...memory}).ok,true);
  for(const schema of [undefined,'false'])
   assertRefused({...env,...memory,JENIOS_G44_SCHEMA_CERTIFIED:schema},'G44_MEMORY_SCHEMA_OR_SESSION_NOT_CONFIRMED');
  for(const secret of [undefined,'','x'.repeat(31),true])
   assertRefused({...env,...memory,JENIOS_ASSISTANT_SESSION_SECRET:secret},'G44_MEMORY_SCHEMA_OR_SESSION_NOT_CONFIRMED');
  assert.equal(checkS05DeploymentScope({...env,...memory,JENIOS_ASSISTANT_SESSION_SECRET:'x'.repeat(32)}).ok,true);
  assert.equal(checkS05DeploymentScope({...env,JENIOS_ASSISTANT_MEMORY_ENABLED:'false'}).ok,true);
 }
});

test('G44 sales generation refuses missing provider credentials, visitor salt, model or recognized budget mode',()=>{
 for(const env of [preview,production]){
  const active={...env,...provider,JENIOS_SALES_GENERATIVE_ENABLED:'true'};
  for(const patch of [{OPENAI_API_KEY:undefined},{OPENAI_API_KEY:'x'.repeat(20)},
   {JENIOS_SALES_VISITOR_SALT:undefined},{JENIOS_SALES_VISITOR_SALT:'x'.repeat(31)},
   {JENIOS_SALES_MODEL:undefined},{JENIOS_SALES_MODEL:'other-model'},{JENIOS_AI_MONTHLY_BUDGET_MODE:'unexpected'}])
   assertRefused({...active,...patch},'G44_SALES_PROVIDER_NOT_CONFIGURED');
  for(const mode of [undefined,'capped','uncapped'])assert.equal(checkS05DeploymentScope({...active,JENIOS_AI_MONTHLY_BUDGET_MODE:mode}).ok,true);
 }
});

test('G44 Pro generation independently requires the provider credential and signed-quote secret',()=>{
 for(const env of [preview,production]){
  const active={...env,...provider,JENIOS_PRO_GENERATION_ENABLED:'true'};
  assert.equal(checkS05DeploymentScope(active).ok,true);
  for(const patch of [{OPENAI_API_KEY:undefined},{OPENAI_API_KEY:'x'.repeat(20)},
   {JENIOS_PRO_QUOTE_SECRET:undefined},{JENIOS_PRO_QUOTE_SECRET:'x'.repeat(31)}])
   assertRefused({...active,...patch},'G44_PRO_PROVIDER_NOT_CONFIGURED');
 }
});

const externalActions=[
 'JENIOS_PAY_PAYMENTS_ENABLED','JENIOS_PRO_PAYMENTS_ENABLED','JENIOS_INTER_CHARGES_ENABLED',
 'JENIOS_REAL_EXECUTION_ENABLED','JENIOS_PRIVATE_PAPER_EXECUTOR','JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED',
 'JENIOS_EMAIL_DISPATCHER_ENABLED','JENIOS_PAYMENT_EMAILS_ENABLED','JENIOS_TRANSACTIONAL_EMAILS_ENABLED',
 'JENIOS_MARKETING_EMAILS_ENABLED','JENIOS_RESEND_WEBHOOK_ENABLED'
];
test('G44 preview rejects every external email, payment and trading gate even with synthetic credentials present',()=>{
 const configured={...preview,...memory,...provider,...inter,RESEND_API_KEY:'re_synthetic_not_a_real_credential'};
 assert.equal(checkS05DeploymentScope({...configured,...Object.fromEntries(externalActions.map(key=>[key,'false']))}).ok,true);
 for(const key of externalActions)
  assertRefused({...configured,[key]:'true'},'G44_PREVIEW_EXTERNAL_ACTIONS_NOT_DISABLED');
});

test('G44 approval does not enable provider calls or production promotion for the older G43 branch',()=>{
 const previous={...preview,...memory,...provider,VERCEL_GIT_COMMIT_REF:G43};
 assertAccepted(previous,'preview-isolated-assistant-context');
 for(const key of ['JENIOS_SALES_GENERATIVE_ENABLED','JENIOS_PRO_GENERATION_ENABLED'])
  assertRefused({...previous,[key]:'true'},'ASSISTANT_CONTEXT_PREVIEW_GENERATION_NOT_APPROVED');
 assertRefused({...production,...memory,...provider,VERCEL_GIT_COMMIT_REF:G43},'S05_PRODUCTION_RELEASE_BRANCH_NOT_CONFIRMED');
});

test('G44 scope validation is observational and does not turn on flags in the supplied configuration',()=>{
 const unchanged={...preview};assertAccepted(preview,'preview-isolated-assistant-activation');
 assert.deepEqual(preview,unchanged);
 for(const key of [...externalActions,'JENIOS_SALES_GENERATIVE_ENABLED','JENIOS_PRO_GENERATION_ENABLED','JENIOS_ASSISTANT_MEMORY_ENABLED'])
  assert.equal(Object.hasOwn(preview,key),false);
});
