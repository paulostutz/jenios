/** B251: deterministic projection of a *retrieved* CI record for human review.
 * This function has NO connector access: a caller-provided record is not a signed
 * issuer attestation or authority for production promotion. */
const SHA=/^[a-f0-9]{40}$/;
const fail=c=>{throw Object.assign(new Error(c),{code:c});};
export function inspectReleaseCiReceipt({expectedSha,workflow,baseSha}={}){
 if(!SHA.test(expectedSha||'')||!SHA.test(baseSha||'')||expectedSha===baseSha||
   !workflow||typeof workflow!=='object'||Array.isArray(workflow)||
   typeof workflow.id!=='number'||!Number.isSafeInteger(workflow.id)||workflow.id<=0||
   !SHA.test(workflow.head_sha||'')||typeof workflow.status!=='string'||
   typeof workflow.conclusion!=='string'||typeof workflow.event!=='string')fail('INVALID_CI_RECORD');
 const matching=workflow.head_sha===expectedSha;
 const passed=matching&&workflow.status==='completed'&&workflow.conclusion==='success'&&
   ['push','workflow_dispatch'].includes(workflow.event);
 return Object.freeze({schema:'JENIOS_B251_CI_RECEIPT_REVIEW',expectedSha,baseSha,runId:workflow.id,
   exactCommitMatched:matching,checksReportedPassing:passed,
   state:passed?'MANUAL_CI_REVIEW_REQUIRED':'CI_UNVERIFIED_OR_FAILED',
   independentlyIssuerAuthenticated:false,immutableArtifactVerified:false,
   productionPromotionAuthorized:false,externalOrderAuthorization:false,
   paymentsAuthorized:false});
}
