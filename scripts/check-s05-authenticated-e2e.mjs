/**
 * On-demand S05 staging E2E. Requires two PRE-EXISTING synthetic test accounts.
 * No account provisioning, no production access, no stored credentials.
 *
 * Set S05_PREVIEW_URL, S05_STAGE_PUBLISHABLE_KEY,
 * S05_TEST_A_EMAIL/S05_TEST_A_PASSWORD, S05_TEST_B_EMAIL/S05_TEST_B_PASSWORD.
 * node scripts/check-s05-authenticated-e2e.mjs
 */
import {certifyStagingFeed} from '../lib/social/staging-e2e.mjs';

try {
 const result=await certifyStagingFeed({
  previewUrl:process.env.S05_PREVIEW_URL,
  publishableKey:process.env.S05_STAGE_PUBLISHABLE_KEY,
  emailA:process.env.S05_TEST_A_EMAIL,
  passwordA:process.env.S05_TEST_A_PASSWORD,
  emailB:process.env.S05_TEST_B_EMAIL,
  passwordB:process.env.S05_TEST_B_PASSWORD
 });
 for(const check of result.checks)console.log('PASS '+check);
 console.log('S05_AUTH_E2E '+JSON.stringify({passed:result.passed,cleaned:result.cleaned,staging:result.staging}));
}catch(error){
 // Never print user identifiers, emails, bearer tokens, or request bodies.
 console.error('S05_AUTH_E2E_BLOCKED '+(error?.code||(/^S05_E2E_[A-Z0-9_]+$/.test(error?.message||'')?error.message:'UNVERIFIED')));
 process.exitCode=1;
}
