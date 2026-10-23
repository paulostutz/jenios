/**
 * ROBOT R13 -- OFFLINE hardening of the R9->R12 evidence chain.
 * Adds immutable Git object identity checks for the real public preregistration file.
 * No network, broker, paid AI, deploy, or proprietary engine access.
 */
import {auditR12LinkedEvidence} from './robot-r12-evidence-reconciliation.mjs';

const die=code=>{throw Object.assign(new Error(code),{code});};
const exact=(obj,keys)=>obj&&typeof obj==='object'&&!Array.isArray(obj)&&
 Object.keys(obj).length===keys.length&&Object.keys(obj).every(k=>keys.includes(k));

export const R13_GIT_EVIDENCE_PROTOCOL=Object.freeze({
 schema:'JENIOS_R13_GIT_OBJECT_CHAIN_V1',
 publicCommitSha:'8ada1a2a4166f02a88b645e3473543a44197b9ab',
 publicFilePath:'docs/platform/evidence/ROBOT_R9_20261022_1300UTC_PUBLIC_HASH_ONLY_PRECOMMIT.json',
 publicFileBlobSha:'a79156e31e328771481a63f92e9f210716bc9c21',
 publicCommitAtUtc:'2026-10-22T12:20:55.000Z',
 expectedR12DecisionWithoutIndependentPrices:'NO_GO_MISSING_INDEPENDENT_MARKET_EVIDENCE',
 runtimeAttestationStillIndependent:false,
 marketEvidenceStillIndependent:false,
 brokerOrdersAllowed:false,
 paperOrdersAllowed:false
});

function validateGitObjectEvidence(gitObjectEvidence){
 const keys=['commitSha','filePath','blobSha','committedAtUtc','source'];
 if(!exact(gitObjectEvidence,keys)||
  gitObjectEvidence.commitSha!==R13_GIT_EVIDENCE_PROTOCOL.publicCommitSha||
  gitObjectEvidence.filePath!==R13_GIT_EVIDENCE_PROTOCOL.publicFilePath||
  gitObjectEvidence.blobSha!==R13_GIT_EVIDENCE_PROTOCOL.publicFileBlobSha||
  gitObjectEvidence.committedAtUtc!==R13_GIT_EVIDENCE_PROTOCOL.publicCommitAtUtc||
  gitObjectEvidence.source!=='GITHUB_COMMIT_AND_BLOB_METADATA')
  die('R13_GIT_OBJECT_IDENTITY_MISMATCH');
}

/**
 * Caller must supply the exact R9/R12 records and Git object metadata already
 * independently read from GitHub. R13 verifies consistency only; it does not
 * elevate GitHub metadata into proof of private runtime identity or exchange-signed prices.
 */
export function auditR13GitEvidenceChain({
 privateRecord,publicRecord,gitMetadata,gitObjectEvidence,observation=null,reviewedAtMs
}={}){
 validateGitObjectEvidence(gitObjectEvidence);
 const r12=auditR12LinkedEvidence({privateRecord,publicRecord,gitMetadata,observation,reviewedAtMs});
 if(r12.originalGitCommitSha!==R13_GIT_EVIDENCE_PROTOCOL.publicCommitSha||
  r12.originalGitCommitAtUtc!==R13_GIT_EVIDENCE_PROTOCOL.publicCommitAtUtc||
  r12.originalHashConsistent!==true||
  r12.validSixUniqueAbstentions!==true||
  r12.brokerOrdersSent!==0||r12.paperOrdersSent!==0)
  die('R13_R12_CHAIN_RECONCILIATION_FAILURE');

 const hasIndependentMarketProof=r12.independentMarketCollectionAuthenticated===true;
 const hasIndependentRuntimeProof=r12.privateRuntimeIdentityIndependentlyVerified===true;
 if(hasIndependentMarketProof||hasIndependentRuntimeProof)
  die('R13_UNEXPECTED_ATTESTATION_ESCALATION');

 return Object.freeze({
  schema:'JENIOS_R13_OFFLINE_GIT_EVIDENCE_CHAIN_V1',
  publicCommitSha:gitObjectEvidence.commitSha,
  publicFilePath:gitObjectEvidence.filePath,
  publicFileBlobSha:gitObjectEvidence.blobSha,
  publicCommitTimestampMatched:true,
  r9PrivatePublicDigestMatched:r12.originalHashConsistent,
  sixUniqueOriginalAbstentions:r12.validSixUniqueAbstentions,
  gitPublicArtifactIdentityPinned:true,
  independentRuntimeAttestationVerified:false,
  independentMarketEvidenceVerified:false,
  exchangeSignedPricesVerified:false,
  brokerOrdersSent:0,
  paperOrdersSent:0,
  actualBrokerRealizedPnl:null,
  actualLossesAvoided:null,
  tradeAccuracy:null,
  commercialPerformanceCertified:false,
  decision:r12.localObservedOutcomeProvided?
   'R13_GIT_CHAIN_VERIFIED_BUT_MARKET_EVIDENCE_UNATTESTED':
   'R13_GIT_CHAIN_VERIFIED_NO_INDEPENDENT_MARKET_EVIDENCE'
 });
}
