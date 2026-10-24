import test from 'node:test';
import assert from 'node:assert/strict';
import {checkS05DeploymentScope} from '../lib/release/environment-scope.mjs';

const branch='release/jenios-robot-r73-definitive-app-20261024';
const production={
 VERCEL_ENV:'production',VERCEL_GIT_COMMIT_REF:branch,
 VERCEL_PROJECT_ID:'prj_44ipBY3R9sHlQDAXY7NUn1zDguw4',
 NEXT_PUBLIC_SUPABASE_URL:'https://igayfjorjmucthlfoasf.supabase.co',
 SOCIAL_SUPABASE_URL:'https://igayfjorjmucthlfoasf.supabase.co',
 NEXT_PUBLIC_SUPABASE_ANON_KEY:'synthetic-public-key',SUPABASE_SECRET_KEY:'synthetic-social-server-key',
 PLATFORM_SUPABASE_URL:'https://xaicvhagftzjkqphnbgx.supabase.co',
 NEXT_PUBLIC_PLATFORM_SUPABASE_URL:'https://xaicvhagftzjkqphnbgx.supabase.co',
 NEXT_PUBLIC_PLATFORM_SUPABASE_PUBLISHABLE_KEY:'synthetic-platform-public-key',
 PLATFORM_SUPABASE_SERVICE_ROLE_KEY:'synthetic-platform-server-key',
 JENIOS_S05_SCHEMA_CERTIFIED:'true',JENIOS_S05_PRIOR_MANUAL_SOCIAL_TESTS_ACCEPTED:'true',
 JENIOS_ROBOT_R73_ADMIN_ENABLED:'true',JENIOS_REAL_EXECUTION_ENABLED:'false',
 JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED:'false',JENIOS_PRIVATE_PAPER_EXECUTOR:'false',
 JENIOS_ROBOT_ANALYST_PAID_ENABLED:'false',
};
const refused=(patch,reason)=>assert.deepEqual(checkS05DeploymentScope({...production,...patch}),{ok:false,reason});

test('R73 accepts only its explicit production release with the dedicated Platform database',()=>{
 assert.deepEqual(checkS05DeploymentScope(production),{ok:true,mode:'production-robots-r73-integrated'});
 for(const value of [undefined,'main','release/jenios-robot-r73-definitive-app-20261025','release/jenios-robot-r73-definitive-app-20261024-extra'])
  refused({VERCEL_GIT_COMMIT_REF:value},'S05_PRODUCTION_RELEASE_BRANCH_NOT_CONFIRMED');
 for(const value of [undefined,'prj_different'])refused({VERCEL_PROJECT_ID:value},'G44_PROJECT_NOT_CONFIRMED');
});

test('R73 requires explicit administration activation and every financial execution flag disabled',()=>{
 for(const value of [undefined,'false','TRUE',true])refused({JENIOS_ROBOT_R73_ADMIN_ENABLED:value},'R73_ADMIN_NOT_ENABLED');
 for(const key of ['JENIOS_REAL_EXECUTION_ENABLED','JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED','JENIOS_PRIVATE_PAPER_EXECUTOR','JENIOS_ROBOT_ANALYST_PAID_ENABLED'])
  for(const value of [undefined,'true','FALSE',false])refused({[key]:value},'R73_EXECUTION_OR_PAID_GENERATION_NOT_DISABLED');
});

test('R73 rejects mismatched server/client Platform databases and absent server/client keys',()=>{
 for(const key of ['PLATFORM_SUPABASE_URL','NEXT_PUBLIC_PLATFORM_SUPABASE_URL'])
  for(const value of [undefined,'https://igayfjorjmucthlfoasf.supabase.co','https://other.invalid','https://xaicvhagftzjkqphnbgx.supabase.co/'])
   refused({[key]:value},'PLATFORM_PRODUCTION_DEDICATED_SUPABASE_URL_MISSING');
 for(const value of [undefined,'','  ',true])refused({NEXT_PUBLIC_PLATFORM_SUPABASE_PUBLISHABLE_KEY:value},'PLATFORM_PRODUCTION_PUBLIC_KEY_MISSING');
 for(const value of [undefined,'','too-short',true])refused({PLATFORM_SUPABASE_SERVICE_ROLE_KEY:value},'PLATFORM_PRODUCTION_SERVER_SECRET_MISSING');
});

test('R73 does not open preview or an unreviewed branch through its production flag',()=>{
 const preview={...production,VERCEL_ENV:'preview',
  NEXT_PUBLIC_SUPABASE_URL:'https://rebzztxlzofxpfwjvbee.supabase.co',SOCIAL_SUPABASE_URL:'https://rebzztxlzofxpfwjvbee.supabase.co'};
 assert.deepEqual(checkS05DeploymentScope(preview),{ok:false,reason:'S05_UNVERIFIED_PREVIEW_BRANCH'});
 assert.deepEqual(checkS05DeploymentScope({...preview,VERCEL_GIT_COMMIT_REF:'research/jenios-robot-r71-private-evolution-20261024'}),
  {ok:false,reason:'S05_UNVERIFIED_PREVIEW_BRANCH'});
});

test('R73 preserves G44 memory, sales and pro activation checks without enabling them',()=>{
 refused({JENIOS_ASSISTANT_MEMORY_ENABLED:'true'},'G44_MEMORY_SCHEMA_OR_SESSION_NOT_CONFIRMED');
 refused({JENIOS_ASSISTANT_MEMORY_ENABLED:'true',JENIOS_G44_SCHEMA_CERTIFIED:'true',JENIOS_ASSISTANT_SESSION_SECRET:'short'},
  'G44_MEMORY_SCHEMA_OR_SESSION_NOT_CONFIRMED');
 refused({JENIOS_SALES_GENERATIVE_ENABLED:'true'},'G44_SALES_PROVIDER_NOT_CONFIGURED');
 refused({JENIOS_PRO_GENERATION_ENABLED:'true'},'G44_PRO_PROVIDER_NOT_CONFIGURED');
 const inherited={...production,JENIOS_ASSISTANT_MEMORY_ENABLED:'true',JENIOS_G44_SCHEMA_CERTIFIED:'true',
  JENIOS_ASSISTANT_SESSION_SECRET:'synthetic-session-secret-only-1234567890',JENIOS_SALES_GENERATIVE_ENABLED:'true',
  OPENAI_API_KEY:'synthetic-provider-key-never-used',JENIOS_SALES_MODEL:'gpt-6-luna',
  JENIOS_SALES_VISITOR_SALT:'synthetic-visitor-salt-only-1234567890',JENIOS_PRO_GENERATION_ENABLED:'true',
  JENIOS_PRO_QUOTE_SECRET:'synthetic-pro-quote-secret-only-1234567890'};
 assert.deepEqual(checkS05DeploymentScope(inherited),{ok:true,mode:'production-robots-r73-integrated'});
 assert.equal(inherited.JENIOS_ROBOT_ANALYST_PAID_ENABLED,'false');
 for(const patch of [{JENIOS_G44_SCHEMA_CERTIFIED:'false'},{JENIOS_SALES_MODEL:'unapproved-model'},
  {JENIOS_AI_MONTHLY_BUDGET_MODE:'other'},{JENIOS_PRO_QUOTE_SECRET:''}])
  assert.equal(checkS05DeploymentScope({...inherited,...patch}).ok,false);
});

test('R73 retains prior production isolation and certification gates',()=>{
 refused({NEXT_PUBLIC_SUPABASE_URL:'https://rebzztxlzofxpfwjvbee.supabase.co'},'S05_PRODUCTION_SUPABASE_SCOPE_NOT_CONFIRMED');
 refused({SUPABASE_SECRET_KEY:undefined},'S05_PRODUCTION_FINANCIAL_SUPABASE_SECRET_MISSING');
 refused({NEXT_PUBLIC_SUPABASE_ANON_KEY:undefined},'S05_PRODUCTION_PUBLISHABLE_KEY_MISSING');
 refused({JENIOS_S05_SCHEMA_CERTIFIED:'false'},'S05_PRODUCTION_GATES_NOT_CERTIFIED');
 refused({JENIOS_S05_PRIOR_MANUAL_SOCIAL_TESTS_ACCEPTED:'false'},'S05_PRODUCTION_GATES_NOT_CERTIFIED');
 refused({JENIOS_PAY_PAYMENTS_ENABLED:'true'},'S05_PRODUCTION_ACTIVE_INTER_CREDENTIALS_MISSING');
 refused({JENIOS_TRIAL_ENABLED:'true'},'S05_TRIAL_NOT_CERTIFIED');
 refused({NEXT_PUBLIC_SOCIAL_OPTIMIZED_VIDEO:'true'},'S05_FFMPEG_OPTIMIZATION_NOT_CERTIFIED');
});

test('R73 flags do not redefine the existing G44 production branch or its mode',()=>{
 const g44={...production,VERCEL_GIT_COMMIT_REF:'release/jenios-genios-g44-20261024',JENIOS_ROBOT_R73_ADMIN_ENABLED:undefined};
 assert.deepEqual(checkS05DeploymentScope(g44),{ok:true,mode:'production-assistant-g44-integrated'});
 assert.equal(checkS05DeploymentScope({...g44,JENIOS_ASSISTANT_MEMORY_ENABLED:'true'}).reason,'G44_MEMORY_SCHEMA_OR_SESSION_NOT_CONFIRMED');
});
