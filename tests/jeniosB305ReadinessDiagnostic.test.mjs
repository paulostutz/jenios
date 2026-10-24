import test from 'node:test';
import assert from 'node:assert/strict';
import {financeReadinessDiagnostic} from '../lib/email/finance-readiness-diagnostic.mjs';
import {B305_PRIVATE_EMAIL_APPROVAL} from '../lib/email/finance-private-runner.mjs';

const locked={
  VERCEL_ENV:'preview',
  VERCEL_GIT_COMMIT_REF:'fix/jenios-b305-finance-email-20261022',
  JENIOS_B305_QA_PROJECT_ID:'prj_9cRnjWFRsLkfTToF4U4xZQBa7Gq9',
  VERCEL_PROJECT_ID:'prj_9cRnjWFRsLkfTToF4U4xZQBa7Gq9',
  NEXT_PUBLIC_SUPABASE_URL:'https://rebzztxlzofxpfwjvbee.supabase.co',
  JENIOS_PAY_PAYMENTS_ENABLED:'false',
  JENIOS_INTER_CHARGES_ENABLED:'false',
  JENIOS_REAL_EXECUTION_ENABLED:'false',
  JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED:'false',
  JENIOS_PRIVATE_PAPER_EXECUTOR:'false',
  JENIOS_PAYMENT_EMAIL_FROM:'Financeiro JENIOS <financeiro@jenios.com.br>',
  JENIOS_RESEND_EXPECTED_DOMAIN:'jenios.com.br',
  JENIOS_RESEND_DOMAIN_VERIFIED:'false',
  JENIOS_PAYMENT_EMAILS_ENABLED:'false',
  JENIOS_B305_TEST_SEND_APPROVED:'false',
  JENIOS_B305_PRIVATE_EMAIL_RUNNER_ENABLED:'false'
};

test('diagnostic reports locked R9 environment without exposing secrets',()=>{
  const r=financeReadinessDiagnostic(locked);
  assert.equal(r.status,'NOT_READY');
  assert.equal(r.environment.preview,true);
  assert.equal(r.environment.financialOperationsDisabled,true);
  assert.equal(r.delivery.emailFeatureEnabled,false);
  assert.equal(r.delivery.resendCredentialConfigured,false);
  assert.equal(r.delivery.testRecipientConfigured,false);
  assert.equal(r.secretsExposed,false);
  assert.ok(r.blockers.includes('RESEND_DOMAIN_NOT_VERIFIED'));
  assert.ok(r.blockers.includes('RESEND_KEY_MISSING'));
  assert.ok(r.blockers.includes('TEST_RECIPIENT_MISSING'));
  assert.ok(!JSON.stringify(r).includes('re_'));
  assert.ok(!JSON.stringify(r).includes('@example.com'));
});

test('diagnostic becomes ready only with all single-send gates',()=>{
  const armed={...locked,
    JENIOS_PAYMENT_EMAILS_ENABLED:'true',
    JENIOS_B305_TEST_SEND_APPROVED:'true',
    JENIOS_B305_PRIVATE_EMAIL_RUNNER_ENABLED:'true',
    JENIOS_B305_PRIVATE_EMAIL_APPROVAL:B305_PRIVATE_EMAIL_APPROVAL,
    JENIOS_B305_PRIVATE_EMAIL_MAX:'1',
    JENIOS_EMAIL_TEST_RECIPIENT:'teste@example.com',
    RESEND_API_KEY:'re_testnotreal123456789',
    JENIOS_RESEND_DOMAIN_VERIFIED:'true'
  };
  const r=financeReadinessDiagnostic(armed);
  assert.equal(r.status,'READY_FOR_SINGLE_QA_SEND');
  assert.deepEqual(r.blockers,[]);
  assert.equal(r.privateRunner.ready,true);
});

test('diagnostic fails closed if any finance flag is enabled',()=>{
  const r=financeReadinessDiagnostic({...locked,JENIOS_INTER_CHARGES_ENABLED:'true'});
  assert.equal(r.status,'NOT_READY');
  assert.ok(r.blockers.includes('FINANCIAL_FLAGS_NOT_OFF'));
});
