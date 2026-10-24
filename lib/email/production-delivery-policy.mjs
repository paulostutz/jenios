/** R40: explicit production scope for the existing email workers.
 * Configuration is an activation decision, never a delivery certification.
 * This pure guard performs no I/O and never changes another feature gate.
 */
const QA_PROJECT='prj_9cRnjWFRsLkfTToF4U4xZQBa7Gq9';
const QA_BRANCH='fix/jenios-b305-finance-email-20261022';
const QA_URLS=new Set([
 'https://rebzztxlzofxpfwjvbee.supabase.co',
 'https://xaicvhagftzjkqphnbgx.supabase.co'
]);
const PROJECT=/^prj_[A-Za-z0-9]{8,80}$/;
const SOURCE=/^https:\/\/[a-z0-9]{20}\.supabase\.co$/;

export function productionEmailDeliveryPolicy(env={}){
 const production=env.VERCEL_ENV==='production';
 const enabled=env.JENIOS_EMAIL_PRODUCTION_ENABLED==='true';
 const expectedProject=env.JENIOS_EMAIL_PRODUCTION_PROJECT_ID;
 const projectVerified=typeof expectedProject==='string'&&PROJECT.test(expectedProject)&&
  expectedProject!==QA_PROJECT&&env.VERCEL_PROJECT_ID===expectedProject;
 const expectedBranch=env.JENIOS_EMAIL_PRODUCTION_BRANCH;
 const branchVerified=typeof expectedBranch==='string'&&expectedBranch.length>0&&
  expectedBranch.length<=255&&expectedBranch.trim()===expectedBranch&&
  expectedBranch!==QA_BRANCH&&env.VERCEL_GIT_COMMIT_REF===expectedBranch;
 const expectedSource=env.JENIOS_EMAIL_PRODUCTION_SUPABASE_URL;
 // getJeniosPayAdmin uses NEXT_PUBLIC_SUPABASE_URL; bind that exact source.
 const sourceVerified=typeof expectedSource==='string'&&SOURCE.test(expectedSource)&&
  !QA_URLS.has(expectedSource)&&env.NEXT_PUBLIC_SUPABASE_URL===expectedSource;
 const qaDisabled=['JENIOS_B305_TEST_SEND_APPROVED','JENIOS_B305_PRIVATE_EMAIL_RUNNER_ENABLED',
  'JENIOS_B305_QA_TEST_ROUTE_ARMED'].every(key=>env[key]==='false');
 const internalAuthConfigured=typeof env.CRON_SECRET==='string'&&env.CRON_SECRET.length>=24;
 return Object.freeze({
  ready:production&&enabled&&projectVerified&&branchVerified&&sourceVerified&&qaDisabled&&internalAuthConfigured,
  production,enabled,projectVerified,branchVerified,sourceVerified,qaDisabled,internalAuthConfigured
 });
}
