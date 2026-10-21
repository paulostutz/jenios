/** B299-QA dry-run diagnostic only. Never read, print or persist secret values.
 * 'fixture' simulates QA config; 'audit' inspects process.env names without network.
 */
import assert from 'node:assert/strict';
import {
 B299_QA_DISABLED_FLAGS,B299_QA_SOCIAL_URL,B299_QA_PLATFORM_URL,
 inspectB299QaPreflight,inspectB299QaBrokerGuides
} from '../../lib/platform/qa/b299-stage2-readiness.mjs';
const mode=process.argv[2];
if(!['--fixture','--audit'].includes(mode))throw Error('B299_QA_MODE_REQUIRED');
if(process.env.VERCEL||process.env.VERCEL_ENV)throw Error('B299_QA_CANNOT_RUN_INSIDE_VERCEL');
let env=process.env;
if(mode==='--fixture'){
 env={
  NEXT_PUBLIC_SUPABASE_URL:B299_QA_SOCIAL_URL,SOCIAL_SUPABASE_URL:B299_QA_SOCIAL_URL,
  NEXT_PUBLIC_PLATFORM_SUPABASE_URL:B299_QA_PLATFORM_URL,
  PLATFORM_SUPABASE_URL:B299_QA_PLATFORM_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_qa_fixture_offline',
  NEXT_PUBLIC_PLATFORM_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_platform_fixture',
  SUPABASE_SECRET_KEY:'offline_synthetic_secret_never_used',
  PLATFORM_SUPABASE_SERVICE_ROLE_KEY:'offline_synthetic_platform_secret',
  JENIOS_QA_STRICT_SUBSCRIPTION_PROOF:'true',JENIOS_PAY_PROVIDER:'disabled'
 };
 for(const key of B299_QA_DISABLED_FLAGS)env[key]='false';
}
const report=inspectB299QaPreflight(env);
const broker=inspectB299QaBrokerGuides();
if(mode==='--fixture'){
 assert.equal(report.safeQaConfiguration,true);
 assert.equal(report.canRunExistingCp69AuthenticatedQa,false);
 assert.equal(broker.totalGuides,12);
}
process.stdout.write(JSON.stringify({
 schema:report.schema,mode,safeQaConfiguration:report.safeQaConfiguration,
 qaServerKeysPresent:report.qaServerKeysPresent,blockers:report.blockers,
 missingCredentials:report.missingCredentials,
 canRunExistingCp69AuthenticatedQa:report.canRunExistingCp69AuthenticatedQa,
 releaseAuthorized:false,brokerGuideCount:broker.totalGuides,
 authenticatedBrokerCount:broker.officialAuthenticatedAccounts
})+'\n');
