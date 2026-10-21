/** B246: do not convert synthetic B182/Paper outcomes into advertising claims. */
import {B182_RESEARCH_EVIDENCE,auditOriginalHoldoutEvidence} from '../connections/b194-performance-acceptance.mjs';
export function inspectCoreResearchAcceptance(evidence){
 const result=auditOriginalHoldoutEvidence(evidence);
 return Object.freeze({schema:'JENIOS_B246_PRIVATE_CORE_RESEARCH',
  baselineWindow:B182_RESEARCH_EVIDENCE.window,
  baselineOpportunities:B182_RESEARCH_EVIDENCE.totalOpportunities,
  baselinePositiveScenariosAcrossCosts:Object.freeze([2,1,1]),
  assessment:result.classification,
  reportedNegativeCells:result.counts?.negativeOrZeroCells??null,
  originalCoreFrozenByThisAudit:false,
  independentProvenanceVerified:false,
  authorizedMarketingReturnClaims:false,
  robotProfitabilityCertified:false,
  realExecutionAuthorized:false,
  ordersSent:0});
}
