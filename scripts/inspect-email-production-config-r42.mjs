/** Release diagnostics: booleans only, never values/hashes of credentials. */
const env=process.env;
if(env.VERCEL_ENV!=='production'||env.VERCEL_PROJECT_ID!=='prj_44ipBY3R9sHlQDAXY7NUn1zDguw4'||
 env.VERCEL_GIT_COMMIT_REF!=='release/jenios-email-r42-20261024')throw new Error('R42_CONFIG_INSPECTION_SCOPE_REJECTED');
const configured=key=>typeof env[key]==='string'&&env[key].trim().length>0;
const gates=['JENIOS_EMAIL_PRODUCTION_ENABLED','JENIOS_PAYMENT_EMAILS_ENABLED',
 'JENIOS_TRANSACTIONAL_EMAILS_ENABLED','JENIOS_SUBSCRIPTION_DUNNING_ENABLED',
 'JENIOS_MARKETING_PLANNER_ENABLED','JENIOS_MARKETING_EMAILS_ENABLED','JENIOS_RESEND_WEBHOOK_ENABLED',
 'JENIOS_RESEND_DOMAIN_VERIFIED','JENIOS_S05_SCHEMA_CERTIFIED','JENIOS_S05_PRIOR_MANUAL_SOCIAL_TESTS_ACCEPTED'];
console.log('R42_EMAIL_CONFIG '+JSON.stringify({
 credentials:Object.fromEntries(['RESEND_API_KEY','RESEND_WEBHOOK_SECRET','CRON_SECRET','JENIOS_EMAIL_DISPATCH_SECRET','SUPABASE_SECRET_KEY',
  'SUPABASE_SERVICE_ROLE_KEY'].map(key=>[key,configured(key)])),
 gates:Object.fromEntries(gates.map(key=>[key,env[key]==='true'])),
 sourceIsProduction:env.NEXT_PUBLIC_SUPABASE_URL==='https://igayfjorjmucthlfoasf.supabase.co'
}));
