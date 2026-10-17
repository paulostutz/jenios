import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const STAGING_URL='https://rebzztxlzofxpfwjvbee.supabase.co';
const DISABLED='S04_ISOLATED_PREVIEW_DISABLED_NO_REAL_CREDENTIALS';

export function assertS04IsolatedPreviewEnvironment(env) {
  if(env.VERCEL_ENV!=='preview')throw new Error('S04: deployment must be preview, never production');
  if(env.NEXT_PUBLIC_SUPABASE_URL!==STAGING_URL||env.SOCIAL_SUPABASE_URL!==STAGING_URL)
    throw new Error('S04: Supabase URLs must point exclusively to staging');
  for(const name of ['NEXT_PUBLIC_SUP_PUBLISHABLE_KEY','NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY','SOCIAL_SUPABASE_ANON_KEY']) {
    if(typeof env[name]!=='string'||!env[name].startsWith('sb_publishable_'))
      throw new Error('S04: staging publishable key missing: '+name);
  }
  for(const name of ['SUPABASE_SECRET_KEY','SUPABASE_SERVICE_ROLE_KEY','SOCIAL_SUPABASE_SERVICE_ROLE_KEY','JENIOS_PAY_ADMIN_TOKEN','INTER_PRIVATE_KEY','INTER_CERTIFICATE','INTER_CLIENT_SECRET','INTER_CLIENT_ID','JENIOS_PAY_ADMIN_USER_IDS']) {
    if(env[name]!==DISABLED)throw new Error('S04: privileged production credential not explicitly disabled: '+name);
  }
  for(const name of ['JENIOS_TRIAL_ENABLED','JENIOS_TRIAL_ACTIVATION_APPROVED','NEXT_PUBLIC_SOCIAL_OPTIMIZED_VIDEO']) {
    if(env[name]!=='false')throw new Error('S04: unsafe feature not explicitly disabled: '+name);
  }
  return true;
}

if(process.argv[1] && fileURLToPath(import.meta.url)===resolve(process.argv[1])) {
  try {assertS04IsolatedPreviewEnvironment(process.env);process.stdout.write('S04 isolated preview environment validated (no values logged).\n');}
  catch(err){process.stderr.write(err.message+'\n');process.exitCode=1;}
}
