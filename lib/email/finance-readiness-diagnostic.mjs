/** B305-R10: read-only readiness diagnostic.
 * Pure function: no network, database, filesystem, secret disclosure or side effects.
 */
import {financeEmailDispatchReadiness,B305_FINANCE_QA_BRANCH,B305_FINANCE_QA_PROJECT,B305_FINANCE_SOCIAL_QA_URL} from './finance-payment-confirmation.mjs';
import {privateFinanceRunnerReadiness,B305_PRIVATE_EMAIL_APPROVAL} from './finance-private-runner.mjs';

const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function financeReadinessDiagnostic(env={}){
  const dispatch=financeEmailDispatchReadiness(env);
  const privateRunner=privateFinanceRunnerReadiness(env);
  const recipient=String(env.JENIOS_EMAIL_TEST_RECIPIENT??'').trim().toLowerCase();
  const recipientConfigured=EMAIL.test(recipient);
  const resendKeyPresent=typeof env.RESEND_API_KEY==='string' && /^re_[A-Za-z0-9_-]{11,}$/.test(env.RESEND_API_KEY);
  const approvalTokenCorrect=env.JENIOS_B305_PRIVATE_EMAIL_APPROVAL===B305_PRIVATE_EMAIL_APPROVAL;
  const maxOne=env.JENIOS_B305_PRIVATE_EMAIL_MAX==='1';
  const blockers=[];
  if(env.VERCEL_ENV!=='preview') blockers.push('NOT_PREVIEW');
  if(env.VERCEL_GIT_COMMIT_REF!==B305_FINANCE_QA_BRANCH) blockers.push('WRONG_BRANCH');
  if(env.JENIOS_B305_QA_PROJECT_ID!==B305_FINANCE_QA_PROJECT || (env.VERCEL_PROJECT_ID&&env.VERCEL_PROJECT_ID!==B305_FINANCE_QA_PROJECT)) blockers.push('WRONG_QA_PROJECT');
  if(env.NEXT_PUBLIC_SUPABASE_URL!==B305_FINANCE_SOCIAL_QA_URL) blockers.push('WRONG_SOCIAL_QA');
  if(!dispatch.financialOperationsDisabled) blockers.push('FINANCIAL_FLAGS_NOT_OFF');
  if(!dispatch.senderVerified) blockers.push('SENDER_NOT_CONFIRMED');
  if(!resendKeyPresent) blockers.push('RESEND_KEY_MISSING');
  if(!recipientConfigured) blockers.push('TEST_RECIPIENT_MISSING');
  if(!dispatch.enabled) blockers.push('EMAILS_DISABLED');
  if(!dispatch.testSendApproved) blockers.push('TEST_SEND_NOT_APPROVED');
  if(!privateRunner.privateEnabled) blockers.push('PRIVATE_RUNNER_DISABLED');
  if(!approvalTokenCorrect) blockers.push('PRIVATE_APPROVAL_MISSING');
  if(!maxOne) blockers.push('ONE_EMAIL_LIMIT_MISSING');
  return Object.freeze({
    status:blockers.length===0?'READY_FOR_SINGLE_QA_SEND':'NOT_READY',
    blockers:Object.freeze(blockers),
    environment:Object.freeze({
      preview:dispatch.preview,
      branch:dispatch.branch,
      project:dispatch.project,
      socialQa:dispatch.sourceVerified,
      financialOperationsDisabled:dispatch.financialOperationsDisabled
    }),
    delivery:Object.freeze({
      senderVerified:dispatch.senderVerified,
      resendCredentialConfigured:resendKeyPresent,
      testRecipientConfigured:recipientConfigured,
      emailFeatureEnabled:dispatch.enabled,
      testSendApproved:dispatch.testSendApproved
    }),
    privateRunner:Object.freeze({
      enabled:privateRunner.privateEnabled,
      approvalTokenCorrect,
      oneEmailLimit:maxOne,
      ready:privateRunner.ready
    }),
    secretsExposed:false
  });
}
