/** B259: independent launch tracks; no application endpoint calls this to deploy.
 * Developer CI, key signatures and synthetic payments are NOT external approvals.
 */
import {composeOfflineReleaseManifest} from '../release250/b249-review-manifest.mjs';
import {B182_RESEARCH_EVIDENCE} from '../connections/b194-performance-acceptance.mjs';
const fail=code=>{throw Object.assign(new Error(code),{code});};
export function finalizeInternalReleaseReview({commit,nowMs,ciEvidence,previewEvidence,
 commercialEvidence,brokerEvidence,prospectiveEvidence}={}){
 if(typeof commit!=='string'||!/^[a-f0-9]{40}$/.test(commit)||
   !Number.isSafeInteger(nowMs)||nowMs<=0)fail('INVALID_RELEASE_COMMIT');
 const original=composeOfflineReleaseManifest({commit,nowMs,ciClaimed:ciEvidence?.checksReportedPassing===true});
 const technical=ciEvidence?.expectedSha===commit&&ciEvidence?.checksReportedPassing===true&&
   previewEvidence?.expectedRoutesVerifiedLocally===true&&
   previewEvidence?.adminReadOnlyRouteFailClosed===true;
 const checkoutClaims=!!commercialEvidence?.ownerAndPlanConsistent&&commercialEvidence?.chargesCreated===0;
 const brokerClaims=!!brokerEvidence?.recentReadConfirmed&&brokerEvidence?.permittedToTrade===false;
 const signed=prospectiveEvidence?.signatureCryptographicallyValid===true;
 return Object.freeze({schema:'JENIOS_B259_INTERNAL_RELEASE_COMMITTEE',commit,
  sourceManifestSha256:original.contentSha256,
  publicInformation:Object.freeze({status:technical?'PRODUCT_OWNER_REVIEW_REQUIRED':'TECHNICAL_NO_GO',
    ownerAccepted:false,authenticatedRemoteUserQACompleted:false}),
  commercialSubscriptions:Object.freeze({status:'EXTERNAL_GATEWAY_QA_REQUIRED',
    syntheticLifecycleChecked:checkoutClaims,bankProviderCertified:false,
    subscriptionEntitlementsReleased:false,realChargesCreated:0}),
  paperBrokerConnections:Object.freeze({status:'EXTERNAL_ACCOUNT_AND_WORKER_REQUIRED',
    locallyScopedReadClaim:brokerClaims,serverProvisioned:false,paperOrdersSent:0}),
  automatedRobots:Object.freeze({status:'NO_GO_LIVE_TRADING',
    syntheticSignatureChainChecked:signed,
    originalHistoricalResearchRobust:B182_RESEARCH_EVIDENCE.robustNetPerformanceDemonstrated,
    independentProspectiveReturnsCertified:false,liveExecutionAuthorized:false}),
  releasePromotionApproved:false,publicDeploymentPerformed:false,
  ordersSubmitted:0,chargesCreated:0,custody:false});
}
