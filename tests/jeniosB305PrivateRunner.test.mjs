import test from 'node:test';
import assert from 'node:assert/strict';
import {privateFinanceRunnerReadiness,runPrivateFinanceEmailQa,B305_PRIVATE_EMAIL_APPROVAL} from '../lib/email/finance-private-runner.mjs';

const base={
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
  JENIOS_PAYMENT_EMAILS_ENABLED:'true',
  JENIOS_B305_TEST_SEND_APPROVED:'true',
  JENIOS_PAYMENT_EMAIL_FROM:'Financeiro JENIOS <financeiro@jenios.com.br>',
  JENIOS_EMAIL_TEST_RECIPIENT:'teste@example.com',
  RESEND_API_KEY:'re_testnotreal123456789'
};
const armed={...base,
  JENIOS_B305_PRIVATE_EMAIL_RUNNER_ENABLED:'true',
  JENIOS_B305_PRIVATE_EMAIL_APPROVAL:B305_PRIVATE_EMAIL_APPROVAL,
  JENIOS_B305_PRIVATE_EMAIL_MAX:'1'
};

test('private B305 runner is disabled by default',()=>{
  assert.equal(privateFinanceRunnerReadiness(base).ready,false);
});

test('private B305 runner requires all four independent gates',()=>{
  assert.equal(privateFinanceRunnerReadiness(armed).ready,true);
  for(const key of ['JENIOS_B305_PRIVATE_EMAIL_RUNNER_ENABLED','JENIOS_B305_PRIVATE_EMAIL_APPROVAL','JENIOS_B305_PRIVATE_EMAIL_MAX','JENIOS_B305_TEST_SEND_APPROVED']){
    const env={...armed,[key]:'false'};
    assert.equal(privateFinanceRunnerReadiness(env).ready,false,key);
  }
});

test('private B305 runner can never arm in production',()=>{
  assert.equal(privateFinanceRunnerReadiness({...armed,VERCEL_ENV:'production'}).ready,false);
});

test('disabled private runner performs zero database IO',async()=>{
  let called=0;
  const r=await runPrivateFinanceEmailQa({env:base,db:{rpc(){called++}}});
  assert.equal(r.status,'DISABLED');
  assert.equal(called,0);
});
