import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {emailCredentialSummary,emailGateSummary} from '../lib/email/admin-health.mjs';

test('B305-R26 credential readiness exposes booleans and never secret values',()=>{
 const env={
  RESEND_API_KEY:'re_12345678901',
  SUPABASE_SECRET_KEY:'sb_secret_example_123456789',
  CRON_SECRET:'01234567890123456789012345678901',
  JENIOS_PAYMENT_EMAIL_FROM:'Financeiro JENIOS <financeiro@jenios.com.br>',
  JENIOS_RESEND_EXPECTED_DOMAIN:'jenios.com.br',
  JENIOS_RESEND_DOMAIN_VERIFIED:'true',
  RESEND_WEBHOOK_SECRET:'whsec_123456789012345678901234'
 };
 const readiness=emailCredentialSummary(env);
 assert.deepEqual(readiness,{
  resendApiKeyConfigured:true,supabaseServerKeyConfigured:true,cronSecretConfigured:true,
  financeSenderConfigured:true,resendDomainVerified:true,webhookSecretConfigured:true
 });
 assert.doesNotMatch(JSON.stringify(readiness),/re_123|sb_secret|whsec_|0123456789/);
});

test('B305-R26 gate summary includes webhook gate only as boolean',()=>{
 const gates=emailGateSummary({JENIOS_RESEND_WEBHOOK_ENABLED:'false'});
 assert.equal(gates.JENIOS_RESEND_WEBHOOK_ENABLED,false);
});

test('B305-R26 Master panel displays aggregate webhook telemetry without identifiers',()=>{
 const helper=readFileSync('lib/email/admin-health.mjs','utf8');
 const page=readFileSync('app/admin/emails/page.js','utf8');
 assert.match(helper,/jenios_resend_webhook_events_b305/);
 assert.match(helper,/hard_bounce/);
 assert.match(helper,/ignored_transient/);
 assert.match(page,/Bounce e complaint/);
 assert.match(page,/Prontidão de configuração/);
 assert.doesNotMatch(page,/recipient_user_id|event_id|recipient_email|provider_email_id/);
});
