/** One-time synthetic S04 staging Auth + RLS smoke. Credentials are encrypted, branch-scoped and never logged. */
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {assertS04IsolatedPreviewEnvironment} from './check-s04-staging-build.mjs';

const EXPECTED_ID='11111111-1111-4111-8111-111111110941';

export async function checkSyntheticAuth({db,email,password,expectedId=EXPECTED_ID}) {
  if(typeof email!=='string'||!/^s04-lab-positive-941@invalid\.example$/.test(email))throw Error('S04_SYNTHETIC_ACCOUNT_REQUIRED');
  if(typeof password!=='string'||password.length<30)throw Error('S04_SYNTHETIC_PASSWORD_REQUIRED');
  const signin=await db.auth.signInWithPassword({email,password});
  const token=signin?.data?.session?.access_token;
  if(signin?.error||!token||signin?.data?.user?.id!==expectedId)throw Error('S04_STAGING_SIGNIN_FAILED');
  try {
    const verified=await db.auth.getUser(token);
    if(verified?.error||verified?.data?.user?.id!==expectedId)throw Error('S04_AUTH_TOKEN_USER_MISMATCH');
    const profile=await db.from('profiles').select('id,handle').eq('id',expectedId).maybeSingle();
    if(profile.error||profile.data?.id!==expectedId||profile.data?.handle!=='s04_lab_941')
      throw Error('S04_AUTH_PROFILE_RLS_READ_FAILED');
    const trial=await db.from('jenios_platform_trial_ledger_v1').select('subject_digest').limit(1);
    if(!trial.error && trial.data?.length)throw Error('S04_AUTH_TRIAL_LEDGER_EXPOSED');
    const guard=await db.from('jenios_s04_staging_guard_20261017').select('marker').limit(1);
    if(!guard.error && guard.data?.length)throw Error('S04_AUTH_STAGING_GUARD_EXPOSED');
    return {passwordSignIn:'ok',getUser:'ok',profile:'own-profile',trialLedger:'not-readable',stagingGuard:'not-readable'};
  }finally{
    await db.auth.signOut().catch(()=>{});
  }
}

if(process.argv[1] && fileURLToPath(import.meta.url)===resolve(process.argv[1])) {
  try {
    assertS04IsolatedPreviewEnvironment(process.env);
    const {createClient}=await import('@supabase/supabase-js');
    const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUP_PUBLISHABLE_KEY;
    const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
    const result=await checkSyntheticAuth({db,email:process.env.JENIOS_S04_SMOKE_EMAIL,password:process.env.JENIOS_S04_SMOKE_PASSWORD});
    process.stdout.write('S04 staging synthetic Auth E2E: '+JSON.stringify(result)+'\n');
  }catch(err){
    process.stderr.write('S04 staging synthetic Auth smoke failed: '+(err?.message?.startsWith('S04_')?err.message:'S04_UNEXPECTED_AUTH_FAILURE')+'\n');
    process.exitCode=1;
  }
}
