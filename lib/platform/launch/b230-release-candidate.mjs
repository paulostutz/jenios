/** B230 — independently gated release candidate; safe build != permission to trade. */
import {buildLaunchQaPacket} from './b229-release-package.mjs';
const bool=v=>v===true;
export function evaluateJeniosReleaseCandidate(evidence={},{nowMs=Date.now()}={}){
 const packet=buildLaunchQaPacket({nowMs});
 // These are test claims for review, not an issuer-signed release attestation.
 const technical=bool(evidence.ciPassed)&&bool(evidence.buildPassed)&&
  bool(evidence.browserRegressionPassed)&&bool(evidence.criticalModulesPreserved);
 const publicDraft=technical?'TECHNICAL_CANDIDATE_REQUIRES_PRODUCT_OWNER_ACCEPTANCE':
  'NO_GO_TECHNICAL_RELEASE';
 const openTracks=[...packet.incompleteTracks];
 return Object.freeze({schema:'JENIOS_B230_RELEASE_CANDIDATE',
  candidateBase:'B215-R2',latestResearch:'B182_RESEARCH_ONLY_NO_GO_LIVE',
  checklistTotal:openTracks.length,technicalEvidenceClaimed:technical,
  publicInformationTrack:publicDraft,
  commercialTrack:'NO_GO_PROVIDER_PAYMENT_LIFECYCLE_NOT_VERIFIED',
  paperTradingTrack:'NO_GO_EXTERNAL_BROKER_PILOT_NOT_AUTHORIZED',
  realMoneyTrack:'NO_GO_LIVE_EXECUTION',
  unresolved:Object.freeze(openTracks),
  externalProviderCertified:false,robotPerformanceCertified:false,
  externalBillingCertified:false,regulatoryReviewCertified:false,
  productionReleaseAuthorizedByThisAudit:false,
  independentReleaseApprovalRequired:true,
  backendDeploymentPerformed:false,customerMoneyCustodied:false,
  realOrdersSent:0,externalPaperOrdersSent:0,chargesCreated:0});
}
