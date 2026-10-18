/** S05 — Reject promotion when an isolated preview is mistaken for production. */
const STAGE_URL='https://rebzztxlzofxpfwjvbee.supabase.co';
const PROD_URL='https://igayfjorjmucthlfoasf.supabase.co';
const RELEASE_BRANCH='release/jenios-s05-integrada-homologacao-20261018';
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
   if(env.VERCEL_GIT_COMMIT_REF!==RELEASE_BRANCH)return fail('S05_UNVERIFIED_PREVIEW_BRANCH');
   if(env.NEXT_PUBLIC_SUPABASE_URL!==STAGE_URL||env.SOCIAL_SUPABASE_URL!==STAGE_URL)
     return fail('S05_PREVIEW_MUST_USE_ISOLATED_SUPABASE');
   if(!env.NEXT_PUBLIC_SUP_PUBLISHABLE_KEY&&!env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY&&!env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
     return fail('S05_PREVIEW_PUBLISHABLE_KEY_MISSING');
   return {ok:true,mode:'preview-isolated'};
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
 if(env.VERCEL_GIT_COMMIT_REF!=='release/jenios-s05-integrada-homologacao-20261018')
   return fail('S05_PRODUCTION_RELEASE_BRANCH_NOT_CONFIRMED');
 // These release-specific approvals must follow documented schema + E2E checks.
 // Historical manual Social acceptance was explicitly confirmed by the operator.
 // It is NOT a claim that this integrated S05 release passed a fresh Auth E2E.
 const e2eCertified=env.JENIOS_S05_E2E_CERTIFIED==='true';
 const priorManualAcceptance=env.JENIOS_S05_PRIOR_MANUAL_SOCIAL_TESTS_ACCEPTED==='true';
 if(env.JENIOS_S05_SCHEMA_CERTIFIED!=='true'||(!e2eCertified&&!priorManualAcceptance))
   return fail('S05_PRODUCTION_GATES_NOT_CERTIFIED');
 return {ok:true,mode:e2eCertified?'production-validated':'production-prior-manual-acceptance'};
}
