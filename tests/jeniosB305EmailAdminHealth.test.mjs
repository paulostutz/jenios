import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {emailGateSummary} from '../lib/email/admin-health.mjs';

test('B305-R24 gate projection exposes booleans only',()=>{
 const gates=emailGateSummary({
  JENIOS_PAYMENT_EMAILS_ENABLED:'false',
  JENIOS_TRANSACTIONAL_EMAILS_ENABLED:'true',
  RESEND_API_KEY:'re_secret_should_not_appear',
  SUPABASE_SECRET_KEY:'sb_secret_should_not_appear'
 });
 assert.equal(gates.JENIOS_PAYMENT_EMAILS_ENABLED,false);
 assert.equal(gates.JENIOS_TRANSACTIONAL_EMAILS_ENABLED,true);
 assert.equal('RESEND_API_KEY' in gates,false);
 assert.equal('SUPABASE_SECRET_KEY' in gates,false);
});

test('B305-R24 admin endpoint is GET-only, Master protected and no-store',()=>{
 const src=readFileSync('app/api/admin/email-health/route.js','utf8');
 assert.match(src,/requireAdminPermission\(request,db,'reports\.run'\)/);
 assert.match(src,/requirePayToken/);
 assert.match(src,/Cache-Control':'no-store/);
 assert.doesNotMatch(src,/export async function (POST|PATCH|PUT|DELETE)/);
});

test('B305-R24 admin page has no dispatch or secret controls',()=>{
 const src=readFileSync('app/admin/emails/page.js','utf8');
 assert.match(src,/Saúde dos e-mails/);
 assert.match(src,/Somente leitura/);
 assert.doesNotMatch(src,/RESEND_API_KEY|SUPABASE_SECRET_KEY|recipient_email|Enviar agora|Disparar/);
});
