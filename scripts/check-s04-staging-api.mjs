/**
 * A network smoke executed ONLY on the S04 isolated Vercel preview build.
 * Anonymous, read-only and synthetic; never creates users, orders or trial rows.
 */
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {assertS04IsolatedPreviewEnvironment} from './check-s04-staging-build.mjs';

export async function checkS04StagingApi({db,fetcher,endpoint,apiKey}) {
  if(endpoint !== 'https://rebzztxlzofxpfwjvbee.supabase.co') throw Error('STAGING_URL_MISMATCH');
  if(typeof apiKey !== 'string' || !apiKey.startsWith('sb_publishable_')) throw Error('STAGING_KEY_NOT_PUBLISHABLE');
  const health = await fetcher(endpoint+'/auth/v1/health',{
    method:'GET',headers:{apikey:apiKey},cache:'no-store',signal:AbortSignal.timeout(12000)
  });
  if(!health.ok)throw Error('STAGING_AUTH_HEALTH_FAILED');
  const handle=await db.rpc('social_handle_availability_v1',{p_handle:'s04_integration_probe_2026'});
  const row=Array.isArray(handle.data)?handle.data[0]:handle.data;
  if(handle.error || !row || row.handle !== 's04_integration_probe_2026' || typeof row.available !== 'boolean' || !Array.isArray(row.suggestions))
    throw Error('STAGING_HANDLE_RPC_FAILED');
  const guard=await db.from('jenios_s04_staging_guard_20261017').select('marker').limit(1);
  if(!guard.error && guard.data?.length)throw Error('STAGING_GUARD_ANON_READ_ALLOWED');
  const ledger=await db.from('jenios_platform_trial_ledger_v1').select('subject_digest').limit(1);
  if(!ledger.error && ledger.data?.length)throw Error('STAGING_TRIAL_LEDGER_ANON_READ_ALLOWED');
  const profiles=await db.from('profiles').select('id').limit(1);
  if(!profiles.error && Array.isArray(profiles.data) && profiles.data.length > 0)
    throw Error('STAGING_ANONYMOUS_PROFILE_READ_FAILED');
  return {authHealth:'ok',handleRpc:'ok',guardAnonymousRead:'blocked',trialLedgerAnonymousRead:'blocked',profileRowsVisibleToAnonymous:0};
}

if(process.argv[1] && fileURLToPath(import.meta.url)===resolve(process.argv[1])) {
  try {
    assertS04IsolatedPreviewEnvironment(process.env);
    const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key=process.env.NEXT_PUBLIC_SUP_PUBLISHABLE_KEY;
    const {createClient}=await import('@supabase/supabase-js');
    const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
    const result=await checkS04StagingApi({db,fetcher:fetch,endpoint:url,apiKey:key});
    process.stdout.write('S04 remote PostgreSQL/PostgREST/Auth connectivity: '+JSON.stringify(result)+'\n');
  }catch(err){
    process.stderr.write('S04 staging remote smoke FAIL: '+(err?.message?.startsWith('STAGING_')?err.message:'STAGING_API_NETWORK_UNAVAILABLE')+'\n');
    process.exitCode=1;
  }
}
