import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=p=>readFileSync(p,'utf8');

test('R42 preserves production onboarding without adding client-triggered email events',()=>{
 const onboarding=read('app/onboarding/page.js');
 assert.doesNotMatch(onboarding,/jenios_transactional_email_outbox_b305|RESEND_API_KEY|onboarding_completed/);
 const diagnostic=read('app/diagnostico/page.js');
 assert.match(diagnostic,/submitAccountDiagnostic\(supabase, respostas, timelineSelecionada\)/);
 assert.match(diagnostic,/observePlatformDiagnostic/);
});

test('B305-R18 durable diagnostic remains stored only by Platform backend',()=>{
 const route=read('app/api/platform/diagnostico/route.js');
 const server=read('lib/platform/diagnostic-server.mjs');
 assert.match(route,/getJeniosPlatformAdmin/);
 assert.match(route,/saveVerifiedDiagnostic/);
 assert.match(server,/DIAGNOSTIC_TABLE = 'jenios_platform_diagnostics'/);
 assert.match(server,/\.eq\('user_id',user\.id\)/);
 assert.doesNotMatch(server,/NEXT_PUBLIC_SUPABASE_URL|jenios_transactional_email_outbox_b305/);
});

test('B305-R18 onboarding email templates exist but are not falsely triggered by browser state',()=>{
 const lifecycle=read('lib/email/lifecycle-campaigns.mjs');
 assert.match(lifecycle,/onboardingStartedEmail/);
 assert.match(lifecycle,/onboardingCompletedEmail/);
 const diagnostic=read('app/diagnostico/page.js');
 assert.doesNotMatch(diagnostic,/onboardingStartedEmail|onboardingCompletedEmail|RESEND_API_KEY/);
});
