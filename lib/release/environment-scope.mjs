/** S05 — Reject promotion when an isolated preview is mistaken for production. */
const STAGE_URL='https://rebzztxlzofxpfwjvbee.supabase.co';
const PROD_URL='https://igayfjorjmucthlfoasf.supabase.co';
const RELEASE_BRANCH='release/jenios-s05-integrada-homologacao-20261018';
const PLATFORM_INTEGRATION_PREVIEW_BRANCH='release/jenios-s05-platform-cp70-integracao-20261019';
const PLATFORM_QA_URL='https://xaicvhagftzjkqphnbgx.supabase.co';
const EMAIL_RELEASE_BRANCH='release/jenios-email-r42-20261024';
const EMAIL_PRODUCTION_PROJECT='prj_44ipBY3R9sHlQDAXY7NUn1zDguw4';
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
   if(env.VERCEL_GIT_COMMIT_REF!==RELEASE_BRANCH&&!integration)
     return fail('S05_UNVERIFIED_PREVIEW_BRANCH');
   if(env.NEXT_PUBLIC_SUPABASE_URL!==STAGE_URL||env.SOCIAL_SUPABASE_URL!==STAGE_URL)
     return fail('S05_PREVIEW_MUST_USE_ISOLATED_SUPABASE');
   if(!env.NEXT_PUBLIC_SUP_PUBLISHABLE_KEY&&!env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY&&!env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
     return fail('S05_PREVIEW_PUBLISHABLE_KEY_MISSING');
   if(integration && (env.NEXT_PUBLIC_PLATFORM_SUPABASE_URL!==PLATFORM_QA_URL||
      !env.NEXT_PUBLIC_PLATFORM_SUPABASE_PUBLISHABLE_KEY))
     return fail('PLATFORM_PREVIEW_MUST_USE_DEDICATED_QA_SUPABASE');
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
 const emailRelease=env.VERCEL_GIT_COMMIT_REF===EMAIL_RELEASE_BRANCH;
 if(emailRelease&&env.VERCEL_PROJECT_ID!==EMAIL_PRODUCTION_PROJECT)
   return fail('EMAIL_PRODUCTION_PROJECT_NOT_CONFIRMED');
 const platformIntegration=env.VERCEL_GIT_COMMIT_REF===PLATFORM_INTEGRATION_PREVIEW_BRANCH||emailRelease;
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
 return {ok:true,mode:emailRelease?'production-email-r42-prior-manual-acceptance':platformIntegration?'production-s05-platform-dedicated-auth-ready':e2eCertified?'production-validated':'production-prior-manual-acceptance'};
}
