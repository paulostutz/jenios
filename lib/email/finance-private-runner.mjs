/** B305-R8: private QA runner wrapper.
 * No scheduler, route or import side effect. Disabled unless every existing B305
 * dispatch gate passes AND a second private-runner gate is explicitly armed.
 */
import {runFinanceOutboxBatch} from './finance-outbox-worker.mjs';
import {financeEmailDispatchReadiness} from './finance-payment-confirmation.mjs';

const APPROVAL='B305_ONE_QA_EMAIL_ONLY';

export function privateFinanceRunnerReadiness(env={}){
  const dispatch=financeEmailDispatchReadiness(env);
  const privateEnabled=env.JENIOS_B305_PRIVATE_EMAIL_RUNNER_ENABLED==='true';
  const approval=env.JENIOS_B305_PRIVATE_EMAIL_APPROVAL===APPROVAL;
  const oneOnly=env.JENIOS_B305_PRIVATE_EMAIL_MAX==='1';
  return Object.freeze({
    ready:dispatch.ready&&dispatch.mode==='qa'&&privateEnabled&&approval&&oneOnly,
    dispatchReady:dispatch.ready,
    privateEnabled,approval,oneOnly,
    maxEmails:oneOnly?1:0
  });
}

export async function runPrivateFinanceEmailQa({db,env=process.env,fetcher}={}){
  const gate=privateFinanceRunnerReadiness(env);
  if(!gate.ready)
    return Object.freeze({status:'DISABLED',claimed:0,sent:0,blocked:0});
  return runFinanceOutboxBatch({db,env,fetcher,limit:1});
}

export const B305_PRIVATE_EMAIL_APPROVAL=APPROVAL;
