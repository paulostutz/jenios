/** B249: deterministic public QA artifact. Never accepts customer fields or writes a bank order. */
import {createHash} from 'node:crypto';
import {compileIndependentLaunchDecision} from './b248-independent-release-tracks.mjs';
export function composeOfflineReleaseManifest({commit,nowMs,ciClaimed=false}={}){
 if(typeof commit!=='string'||!/^[a-f0-9]{40}$/.test(commit)||
   !Number.isSafeInteger(nowMs)||nowMs<=0||typeof ciClaimed!=='boolean')
  throw Error('B249_INVALID_OFFLINE_RELEASE_SCOPE');
 const report=compileIndependentLaunchDecision({technicalChecks:{ciPassed:ciClaimed,
  buildPassed:ciClaimed,browserRegressionPassed:ciClaimed,criticalModulesPreserved:ciClaimed}},{nowMs});
 const summary={schema:'JENIOS_B249_RELEASE_REVIEW_BUNDLE',commit,
  source:'LOCAL_CI_CLAIMS_NOT_INDEPENDENTLY_WITNESSED',
  tracks:report,approvals:{owner:false,compliance:false,externalBroker:false,billing:false},
  runtimeProvisioned:false,productionDeployed:false,paymentCalls:0,
  externalOrderCalls:0,liveTrading:false};
 const sha256=createHash('sha256').update(JSON.stringify(summary)).digest('hex');
 return Object.freeze({...summary,contentSha256:sha256,hashIsDigitalSignature:false});
}
