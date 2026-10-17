import test from 'node:test';
import assert from 'node:assert/strict';
import {assertS04IsolatedPreviewEnvironment} from '../../scripts/check-s04-staging-build.mjs';
const url='https://rebzztxlzofxpfwjvbee.supabase.co';
const disabled='S04_ISOLATED_PREVIEW_DISABLED_NO_REAL_CREDENTIALS';
const pub='sb_publishable_dummy_key_used_only_in_test';
const valid={
 VERCEL_ENV:'preview',NEXT_PUBLIC_SUPABASE_URL:url,SOCIAL_SUPABASE_URL:url,
 NEXT_PUBLIC_SUP_PUBLISHABLE_KEY:pub,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:pub,SOCIAL_SUPABASE_ANON_KEY:pub,
 SUPABASE_SECRET_KEY:disabled,SUPABASE_SERVICE_ROLE_KEY:disabled,SOCIAL_SUPABASE_SERVICE_ROLE_KEY:disabled,
 JENIOS_PAY_ADMIN_TOKEN:disabled,INTER_PRIVATE_KEY:disabled,INTER_CERTIFICATE:disabled,
 INTER_CLIENT_SECRET:disabled,INTER_CLIENT_ID:disabled,JENIOS_PAY_ADMIN_USER_IDS:disabled,
 JENIOS_TRIAL_ENABLED:'false',JENIOS_TRIAL_ACTIVATION_APPROVED:'false',NEXT_PUBLIC_SOCIAL_OPTIMIZED_VIDEO:'false'
};
test('valid branch-only staging variables are accepted',()=>assert.equal(assertS04IsolatedPreviewEnvironment(valid),true));
test('production deployment rejected even if staging variables supplied',()=>assert.throws(()=>assertS04IsolatedPreviewEnvironment({...valid,VERCEL_ENV:'production'})));
test('production Supabase URL rejected',()=>assert.throws(()=>assertS04IsolatedPreviewEnvironment({...valid,NEXT_PUBLIC_SUPABASE_URL:'https://igayfjorjmucthlfoasf.supabase.co'})));
test('production social backend URL rejected',()=>assert.throws(()=>assertS04IsolatedPreviewEnvironment({...valid,SOCIAL_SUPABASE_URL:'https://igayfjorjmucthlfoasf.supabase.co'})));
test('live payment keys rejected even when all public values are staging',()=>assert.throws(()=>assertS04IsolatedPreviewEnvironment({...valid,INTER_CLIENT_SECRET:'live_secret'})));
test('a real Supabase service key is rejected in an isolated preview',()=>assert.throws(()=>assertS04IsolatedPreviewEnvironment({...valid,SUPABASE_SECRET_KEY:'real_service_secret'})));
test('enabled free-trial forbidden in staging preview',()=>assert.throws(()=>assertS04IsolatedPreviewEnvironment({...valid,JENIOS_TRIAL_ENABLED:'true'})));
test('missing staged publishable key rejected',()=>assert.throws(()=>assertS04IsolatedPreviewEnvironment({...valid,NEXT_PUBLIC_SUP_PUBLISHABLE_KEY:''})));
test('optimized video disabled for isolated signup lab',()=>assert.throws(()=>assertS04IsolatedPreviewEnvironment({...valid,NEXT_PUBLIC_SOCIAL_OPTIMIZED_VIDEO:'true'})));
