import test from 'node:test';
import assert from 'node:assert/strict';
import {JENIOS_EMAIL_ADDRESSES,jeniosEmailSignature,jeniosEmailShell,JENIOS_EMAIL_PALETTE} from '../lib/email/jenios-identity.mjs';
import {paymentConfirmationEmail,financeEmailDispatchReadiness} from '../lib/email/finance-payment-confirmation.mjs';
const valid=()=>({orderId:'11111111-2222-4333-8444-555555555555',status:'paid',bankVerified:true,receiptId:'E'+'1'.repeat(31),amountCents:14990,currency:'BRL',paidAt:'2026-10-22T10:00:00.000Z',customerName:'Cliente Exemplo',productName:'Plano Nacional',to:'cliente@example.com'});
test('B305: approved domain and branded finance signature',()=>{
 assert.equal(JENIOS_EMAIL_ADDRESSES.finance,'financeiro@jenios.com.br');
 assert.match(jeniosEmailSignature({department:'Financeiro'}),/jenios-logo-horizontal\.webp/);
 assert.match(jeniosEmailSignature({department:'<script>'}),/&lt;script&gt;/);
});
test('B305: confirmed payment email uses official sender, logo and stable idempotency',()=>{
 const a=paymentConfirmationEmail(valid()),b=paymentConfirmationEmail(valid());
 assert.equal(a.from,'Financeiro JENIOS <financeiro@jenios.com.br>');
 assert.match(a.html,/Pagamento confirmado/);assert.match(a.html,/jenios-logo-horizontal\.webp/);
 assert.match(a.text,/R\$\s*149,90/);
 assert.equal(a.idempotencyKey,b.idempotencyKey);
 assert.ok(!a.html.includes('service_role'));
});
test('B305: reject unverified, pending, malformed, insufficient receipts and email addresses',()=>{
 const input=valid();
 for(const change of [
 {status:'pending'},{status:'awaiting_payment'},{bankVerified:false},
 {receiptId:''},{amountCents:0},{currency:'USD'}, {to:'bad-email'},
 {customerName:''},{orderId:'bad'}, {paidAt:'invalid'},
 {productName:''}
 ]) assert.throws(()=>paymentConfirmationEmail({...input,...change}),/PAYMENT_EMAIL_UNVERIFIED_OR_INCOMPLETE/);
});
test('B305: hostile user text is safely escaped and plain text retained',()=>{
 const a=paymentConfirmationEmail({...valid(),customerName:'<img src=x onerror=alert(1)>',productName:'<script>alert(1)</script>'});
 assert.ok(!a.html.includes('<script>'));
 assert.ok(!a.html.includes('<img src=x onerror'));
 assert.match(a.html,/&lt;script&gt;/);
});
test('B305: dispatch is disabled by default and never active in production',()=>{
 const base={RESEND_API_KEY:'re_test_not_real_1234567890',JENIOS_PAYMENT_EMAIL_FROM:'Financeiro JENIOS <financeiro@jenios.com.br>',JENIOS_PAYMENT_EMAILS_ENABLED:'true',JENIOS_RESEND_EXPECTED_DOMAIN:'jenios.com.br',JENIOS_RESEND_DOMAIN_VERIFIED:'true'};
 assert.equal(financeEmailDispatchReadiness({}).ready,false);
 assert.equal(financeEmailDispatchReadiness({...base,VERCEL_ENV:'production'}).ready,false);
 assert.equal(financeEmailDispatchReadiness({...base,VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'fix/jenios-b305-finance-email-20261022',JENIOS_B305_QA_PROJECT_ID:'prj_9cRnjWFRsLkfTToF4U4xZQBa7Gq9',VERCEL_PROJECT_ID:'prj_9cRnjWFRsLkfTToF4U4xZQBa7Gq9',NEXT_PUBLIC_SUPABASE_URL:'https://rebzztxlzofxpfwjvbee.supabase.co',JENIOS_PAY_PAYMENTS_ENABLED:'false',JENIOS_INTER_CHARGES_ENABLED:'false',JENIOS_REAL_EXECUTION_ENABLED:'false',JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED:'false',JENIOS_PRIVATE_PAPER_EXECUTOR:'false',JENIOS_B305_TEST_SEND_APPROVED:'true'}).ready,true);
 assert.equal(financeEmailDispatchReadiness({...base,VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'fix/jenios-b305-finance-email-20261022',JENIOS_B305_QA_PROJECT_ID:'prj_9cRnjWFRsLkfTToF4U4xZQBa7Gq9',VERCEL_PROJECT_ID:'prj_9cRnjWFRsLkfTToF4U4xZQBa7Gq9',NEXT_PUBLIC_SUPABASE_URL:'https://rebzztxlzofxpfwjvbee.supabase.co',JENIOS_PAY_PAYMENTS_ENABLED:'false',JENIOS_INTER_CHARGES_ENABLED:'false',JENIOS_REAL_EXECUTION_ENABLED:'false',JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED:'false',JENIOS_PRIVATE_PAPER_EXECUTOR:'false',JENIOS_B305_TEST_SEND_APPROVED:'true',VERCEL_GIT_COMMIT_REF:'main'}).ready,false);
 assert.equal(financeEmailDispatchReadiness({...base,VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'fix/jenios-b305-finance-email-20261022',JENIOS_B305_QA_PROJECT_ID:'prj_9cRnjWFRsLkfTToF4U4xZQBa7Gq9',VERCEL_PROJECT_ID:'prj_9cRnjWFRsLkfTToF4U4xZQBa7Gq9',NEXT_PUBLIC_SUPABASE_URL:'https://rebzztxlzofxpfwjvbee.supabase.co',JENIOS_PAY_PAYMENTS_ENABLED:'false',JENIOS_INTER_CHARGES_ENABLED:'false',JENIOS_REAL_EXECUTION_ENABLED:'false',JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED:'false',JENIOS_PRIVATE_PAPER_EXECUTOR:'false',JENIOS_B305_TEST_SEND_APPROVED:'true',JENIOS_B305_TEST_SEND_APPROVED:'false'}).ready,false);
 assert.equal(financeEmailDispatchReadiness({...base,VERCEL_ENV:'preview',JENIOS_PAYMENT_EMAILS_ENABLED:'false'}).ready,false);
});

test('B305-R13: institutional shell uses official palette and logo in header and footer',()=>{
 const html=jeniosEmailShell({eyebrow:'Conta JENIOS',title:'Confirme sua conta',lead:'Bem-vindo.',body:'<p>Conteúdo</p>',department:'Relacionamento'});
 assert.match(html,/jenios-logo-horizontal\.webp/g);
 assert.ok((html.match(/jenios-logo-horizontal\.webp/g)||[]).length>=2);
 assert.match(html,/#7c3aed/);
 assert.match(html,/#10b981/);
 assert.equal(JENIOS_EMAIL_PALETTE.purple,'#7c3aed');
});
test('B305-R13: finance email uses institutional light shell instead of legacy dark styling',()=>{
 const a=paymentConfirmationEmail(valid());
 assert.match(a.html,/Financeiro JENIOS/);
 assert.match(a.html,/background:#f8fafc/);
 assert.match(a.html,/border-left:4px solid #7c3aed/);
 assert.ok((a.html.match(/jenios-logo-horizontal\.webp/g)||[]).length>=2);
});
