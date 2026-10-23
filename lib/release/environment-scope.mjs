/** S05 — Reject promotion when an isolated preview is mistaken for production. */
const STAGE_URL='https://rebzztxlzofxpfwjvbee.supabase.co';
const PROD_URL='https://igayfjorjmucthlfoasf.supabase.co';
const RELEASE_BRANCH='release/jenios-s05-integrada-homologacao-20261018';
const PLATFORM_INTEGRATION_PREVIEW_BRANCH='release/jenios-s05-platform-cp70-integracao-20261019';
const PLATFORM_QA_URL='https://xaicvhagftzjkqphnbgx.supabase.co';
const FINANCE_B305_BRANCH='fix/jenios-b305-finance-email-20261022';
const FINANCE_B305_PROJECT='prj_9cRnjWFRsLkfTToF4U4xZQBa7Gq9';
const fail=reason=>({ok:false,reason});
export function checkS05DeploymentScope(env={}){
 const kind=env.VERCEL_ENV||'local';
 if(env.JENIOS_TRIAL_ENABLED==='true'||env.JENIOS_TRIAL_ACTIVATION_APPROVED==='true')
   return fail('S05_TRIAL_NOT_CERTIFIED');
 if(env.NEXT_PUBLIC_SOCIAL_OPTIMIZED_VIDEO==='true')
   return fail('S05_FFMPEG_OPTIMIZATION_NOT_CERTIFIED');
 if(kind==='local')return {ok:true,mode:'local'};
 if(!['preview','production'].includes(kind))return fail('S05_UNKNOWN_ENVIRONMENT');
 if(kind==='preview'){
   const integration=env.VERCEL_GIT_COMMIT_REF===PLATFORM_INTEGRATION_PREVIEW_BRANCH;
   // B303: exactly one isolated Platform QA branch can build a protected GET-only Preview.
   const privateB303=env.VERCEL_GIT_COMMIT_REF===
     'fix/jenios-b303-protected-readonly-preview-20261021';
   const financeB305=env.VERCEL_GIT_COMMIT_REF===FINANCE_B305_BRANCH;
   if(env.VERCEL_GIT_COMMIT_REF!==RELEASE_BRANCH&&!integration&&!privateB303&&!financeB305)
     return fail('S05_UNVERIFIED_PREVIEW_BRANCH');
   if(env.NEXT_PUBLIC_SUPABASE_URL!==STAGE_URL||env.SOCIAL_SUPABASE_URL!==STAGE_URL)
     return fail('S05_PREVIEW_MUST_USE_ISOLATED_SUPABASE');
   if(!env.NEXT_PUBLIC_SUP_PUBLISHABLE_KEY&&!env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY&&!env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
     return fail('S05_PREVIEW_PUBLISHABLE_KEY_MISSING');
   if((integration||privateB303) &&
     (env.NEXT_PUBLIC_PLATFORM_SUPABASE_URL!==PLATFORM_QA_URL||
      !env.NEXT_PUBLIC_PLATFORM_SUPABASE_PUBLISHABLE_KEY))
     return fail('PLATFORM_PREVIEW_MUST_USE_DEDICATED_QA_SUPABASE');
   if(financeB305){
     const forbidden=['JENIOS_PAY_PAYMENTS_ENABLED','JENIOS_INTER_CHARGES_ENABLED',
       'JENIOS_REAL_EXECUTION_ENABLED','JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED',
       'JENIOS_PRIVATE_PAPER_EXECUTOR','JENIOS_PAYMENT_EMAILS_ENABLED',
       'JENIOS_B305_TEST_SEND_APPROVED','JENIOS_B305_PRIVATE_EMAIL_RUNNER_ENABLED',
       'JENIOS_TRANSACTIONAL_EMAILS_ENABLED','JENIOS_SUBSCRIPTION_DUNNING_ENABLED'];
     if(forbidden.some(k=>env[k]!=='false'))
       return fail('B305_FINANCE_AND_EMAIL_GATES_MUST_REMAIN_DISABLED');
     if(env.JENIOS_B305_QA_PROJECT_ID!==FINANCE_B305_PROJECT ||
        (env.VERCEL_PROJECT_ID&&env.VERCEL_PROJECT_ID!==FINANCE_B305_PROJECT))
       return fail('B305_NOT_DEDICATED_QA_PREVIEW');
     return {ok:true,mode:'preview-b305-finance-locked'};
   }
   if(privateB303){
     const forbidden=['JENIOS_REAL_EXECUTION_ENABLED','JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED',
       'JENIOS_PRIVATE_PAPER_EXECUTOR','JENIOS_PAY_PAYMENTS_ENABLED',
       'JENIOS_DEMO_CONNECTORS_ENABLED','NEXT_PUBLIC_JENIOS_DEMO_CONNECTORS_UI',
       'NEXT_PUBLIC_PLATFORM_SIGNUP_ENABLED'];
     if(forbidden.some(k=>env[k]==='true'))
       return fail('B303_BROKER_TRANSPORT_AND_COMMERCE_MUST_REMAIN_DISABLED');
     if(env.PLATFORM_SUPABASE_URL!==PLATFORM_QA_URL||
        env.JENIOS_B303_READONLY_ENABLED!=='true'||
        env.JENIOS_QA_CANDIDATE_ENABLED!=='true'||
        env.JENIOS_QA_ADMIN_READONLY_ENABLED!=='true'||
        (env.VERCEL_PROJECT_ID&&
         env.VERCEL_PROJECT_ID!=='prj_9cRnjWFRsLkfTToF4U4xZQBa7Gq9'))
       return fail('B303_NOT_DEDICATED_PROTECTED_QA_PREVIEW');
     return {ok:true,mode:'preview-b303-protected-readonly'};
   }
   return {ok:true,mode:integration?'preview-isolated-platform-integration':'preview-isolated'};
 }
 // No deployment can silently promote the Preview's staging Supabase URL.
 if(env.NEXT_PUBLIC_SUPABASE_URL!==PROD_URL ||
   (env.SOCIAL_SUPABASE_URL&&env.SOCIAL_SUPABASE_URL!==PROD_URL))
   return fail('S05_PRODUCTION_SUPABASE_SCOPE_NOT_CONFIRMED');
 // Existing S02 BankScore/Validator/PAY require a server-only Supabase secret.
 // Public publishable keys cannot replace the service role on report/financial routes.
 if(!env.SUPABASE_SECRET_KEY&&!env.SUPABASE_SERVICE_ROLE_KEY)
   return fail('S05_PRODUCTION_FINANCIAL_SUPABASE_SECRET_MISSING');
 if(!env.NEXT_PUBLIC_SUP_PUBLISHABLE_KEY&&!env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY&&!env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
   return fail('S05_PRODUCTION_PUBLISHABLE_KEY_MISSING');
 if(env.JENIOS_PAY_PAYMENTS_ENABLED==='true'&&
    (!env.INTER_CLIENT_ID||!env.INTER_CLIENT_SECRET||!env.INTER_CERTIFICATE||!env.INTER_PRIVATE_KEY))
   return fail('S05_PRODUCTION_ACTIVE_INTER_CREDENTIALS_MISSING');
 // The first integrated release can only use its exact reviewed branch.
 // Platform backend must be configured before promoting this source to jenios.com.br.
 const platformIntegration=env.VERCEL_GIT_COMMIT_REF===PLATFORM_INTEGRATION_PREVIEW_BRANCH;
 if(env.VERCEL_GIT_COMMIT_REF!==RELEASE_BRANCH && !platformIntegration)
   return fail('S05_PRODUCTION_RELEASE_BRANCH_NOT_CONFIRMED');
 if(platformIntegration){
   if(env.PLATFORM_SUPABASE_URL!==PLATFORM_QA_URL ||
      env.NEXT_PUBLIC_PLATFORM_SUPABASE_URL!==PLATFORM_QA_URL)
     return fail('PLATFORM_PRODUCTION_DEDICATED_SUPABASE_URL_MISSING');
   if(!env.NEXT_PUBLIC_PLATFORM_SUPABASE_PUBLISHABLE_KEY)
     return fail('PLATFORM_PRODUCTION_PUBLIC_KEY_MISSING');
   if(!env.PLATFORM_SUPABASE_SERVICE_ROLE_KEY ||
      env.PLATFORM_SUPABASE_SERVICE_ROLE_KEY.length<20)
     return fail('PLATFORM_PRODUCTION_SERVER_SECRET_MISSING');
 }

 // These release-specific approvals must follow documented schema + E2E checks.
 // Historical manual Social acceptance was explicitly confirmed by the operator.
 // It is NOT a claim that this integrated S05 release passed a fresh Auth E2E.
 const e2eCertified=env.JENIOS_S05_E2E_CERTIFIED==='true';
 const priorManualAcceptance=env.JENIOS_S05_PRIOR_MANUAL_SOCIAL_TESTS_ACCEPTED==='true';
 if(env.JENIOS_S05_SCHEMA_CERTIFIED!=='true'||(!e2eCertified&&!priorManualAcceptance))
   return fail('S05_PRODUCTION_GATES_NOT_CERTIFIED');
 return {ok:true,mode:platformIntegration?'production-s05-platform-dedicated-auth-ready':e2eCertified?'production-validated':'production-prior-manual-acceptance'};
}
