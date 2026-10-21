/** B231: independent product acceptance; static CI claims do not grant production promotion. */
import {evaluateJeniosReleaseCandidate} from '../launch/b230-release-candidate.mjs';
const deny=code=>{throw Object.assign(new Error(code),{code});};
const EXACT=['ciPassed','buildPassed','browserRegressionPassed','criticalModulesPreserved'];
export function assessPublicCandidate(evidence,{nowMs=Date.now()}={}){
 if(!evidence||typeof evidence!=='object'||Array.isArray(evidence)||
    Object.keys(evidence).sort().join(',')!==EXACT.slice().sort().join(',')||
    !Number.isSafeInteger(nowMs)||nowMs<=0)deny('B231_INVALID_RELEASE_EVIDENCE');
 const checked=Object.values(evidence).every(x=>typeof x==='boolean');
 if(!checked)deny('B231_UNTRUSTED_RELEASE_EVIDENCE');
 const current=evaluateJeniosReleaseCandidate(evidence,{nowMs});
 const candidate=current.publicInformationTrack==='TECHNICAL_CANDIDATE_REQUIRES_PRODUCT_OWNER_ACCEPTANCE';
 return Object.freeze({schema:'JENIOS_B231_PUBLIC_CANDIDATE',
  technicalChecksClaimedPassed:candidate,
  classification:candidate?'PRODUCT_OWNER_REVIEW_REQUIRED':'TECHNICAL_HOLD',
  gates:Object.freeze(['INDEPENDENT_CI_ARTIFACT_REVIEW','AUTHENTICATED_QA_BROWSER_ACCEPTANCE',
   'RELEASE_BRANCH_DIFF_AND_ROLLBACK_REVIEW','PRODUCT_OWNER_APPROVAL']),
  sourceEvidenceExternallyAttested:false,productOwnerAccepted:false,
  deploymentPromoted:false,brokerOrdersSent:0,chargesCreated:0,liveExecutionEnabled:false});
}
