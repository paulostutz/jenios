import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {onboardingStartedEmail,onboardingCompletedEmail} from '../lib/email/lifecycle-campaigns.mjs';

const INTERNAL=/(?:\bB\d{3}\b|\bR\d{1,3}\b|\bQA\b|homologa(?:c|ç)[aã]o)/i;
const read=p=>readFileSync(p,'utf8');
const required=[
 ['supabase/templates/jenios-confirmation.html','{{ .ConfirmationURL }}'],
 ['supabase/templates/jenios-recovery.html','{{ .ConfirmationURL }}'],
 ['supabase/templates/jenios-email-change.html','{{ .ConfirmationURL }}'],
 ['supabase/templates/jenios-email-change.html','{{ .NewEmail }}'],
 ['supabase/templates/jenios-reauthentication.html','{{ .Token }}'],
 ['supabase/templates/jenios-email-changed-notification.html','{{ .OldEmail }}'],
 ['supabase/templates/jenios-email-changed-notification.html','{{ .Email }}'],
 ['supabase/templates/jenios-identity-linked-notification.html','{{ .Provider }}'],
 ['supabase/templates/jenios-identity-unlinked-notification.html','{{ .Provider }}'],
 ['supabase/templates/jenios-mfa-enrolled-notification.html','{{ .FactorType }}'],
 ['supabase/templates/jenios-mfa-unenrolled-notification.html','{{ .FactorType }}']
];

test('B305-R17 Supabase Auth templates preserve required variables and JENIOS identity',()=>{
 for(const [path,variable] of required){
  const html=read(path);
  assert.match(html,/jenios-logo-horizontal\.webp/,path);
  assert.ok(html.includes(variable),path+' missing '+variable);
  assert.doesNotMatch(html,INTERNAL,path);
 }
});

test('B305-R17 security templates use no external tracking or executable content',()=>{
 for(const path of [...new Set(required.map(x=>x[0]))]){
  const html=read(path);
  assert.doesNotMatch(html,/<script\b/i,path);
  assert.doesNotMatch(html,/utm_|pixel|tracking/i,path);
  assert.doesNotMatch(html,/javascript:/i,path);
 }
});

test('B305-R17 recovery screen uses Supabase Auth real reset flow and safe generic response',()=>{
 // R42 preserves the accepted production recovery implementation.
 const src=read('app/components/PasswordRecovery.js');
 assert.match(src,/resetPasswordForEmail/);
 assert.match(src,/\/redefinir-senha/);
 assert.match(src,/Se houver uma conta para este e-mail/);
 assert.doesNotMatch(src,/service_role|SUPABASE_SECRET_KEY/);
});

test('B305-R17 onboarding emails are branded but not wired to fake completion',()=>{
 const start=onboardingStartedEmail({userId:'user_1',to:'cliente@example.com',customerName:'Cliente',planName:'JENIOS Platform'});
 const done=onboardingCompletedEmail({userId:'user_1',to:'cliente@example.com',customerName:'Cliente'});
 for(const msg of [start,done]){
  assert.match(msg.html,/jenios-logo-horizontal\.webp/);
  assert.doesNotMatch(msg.html,INTERNAL);
  assert.equal(msg.from,'JENIOS <noreply@jenios.com.br>');
 }
 const onboarding=read('app/onboarding/page.js');
 assert.doesNotMatch(onboarding,/onboarding_completed|jenios_transactional_email_outbox_b305/);
});
