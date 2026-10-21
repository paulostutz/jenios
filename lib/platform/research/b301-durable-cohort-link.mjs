/**
 * JENIOS B301 — private/offline receipt-to-audit link.
 * Uses the EXISTING B299 durable anti-replay journal and B300 static correlation.
 * This module does not reach any broker, mutate the B152 risk ledger, transmit a
 * real/Paper order, or certify any external claim. Local journal writes only.
 */
import {createHash} from 'node:crypto';
import {canonical} from '../pilot-prep/contracts.mjs';
import {B299PrivateEvidenceJournal,verifyB299OfflineConsent} from './b299-private-consent-replay-journal.mjs';
import {auditB300ReadOnlyCohort} from './b300-evidence-reconciliation-gate.mjs';

const deny=code=>{throw Object.assign(new Error(code),{code});};
const sha=x=>createHash('sha256').update(canonical(x)).digest('hex');
const pureArray=(a,max)=>Array.isArray(a)&&a.length<=max;
/** Returns references without the underlying credentials/payload bodies. */
function flattenCohort(input){
 if(!pureArray(input?.orderPairs,20)||!pureArray(input?.positionPairs,20)||
  !pureArray(input?.deliveryReceipts,50)||!pureArray(input?.operatorIntents,100))
  deny('B301_INVALID_COHORT_SHAPE');
 const out=[];
 for(const pairs of [input.orderPairs,input.positionPairs])for(const pair of pairs){
  if(!Array.isArray(pair)||pair.length!==2)deny('B301_INVALID_PAIR');
  out.push(pair[0],pair[1]);
 }
 out.push(...input.deliveryReceipts,...input.operatorIntents);
 if(out.length<1||out.length>290)deny('B301_EMPTY_OR_OVERSIZED_COHORT');
 return out;
}

/**
 * Strict one-shot gate. Step 1 is a PURE B300 audit validating ALL signatures,
 * timestamps, IDs and contracts before any private journal write. Step 2 records
 * each event with B299's durable UNIQUE nonce and digest constraints.
 * This is NOT a multi-record atomic transaction: a later failure leaves any
 * previous receipts permanently consumed. Do not automatically retry on error.
 */
export function linkB301PrivateCohortOnce({cohort,journal,nowMs=Date.now()}={}){
 if(!(journal instanceof B299PrivateEvidenceJournal)||
   !Number.isSafeInteger(nowMs)||nowMs<=0||!cohort||
   typeof cohort!=='object'||Array.isArray(cohort)||
   cohort.nowMs!==nowMs)
  deny('B301_ISOLATED_JOURNAL_AND_CLOCK_REQUIRED');
 const envelopes=flattenCohort(cohort);
 // B299 signer identity here means key configuration, not civil ID or broker rights.
 const consent=verifyB299OfflineConsent({signedConsent:cohort.signedConsent,
  trustedConsentKeys:cohort.trustedConsentKeys,
  trustedCollectorKeys:cohort.trustedCollectorKeys,
  scope:cohort.scope,nowMs});
 const before=journal.inspect(cohort.scope,consent.consentId);
 if(before?.locallyRevoked===true)deny('B301_CONSENT_REVOKED_LOCALLY');
 if(!before||before.recordedEvidenceCount!==0)
  deny('B301_COHORT_ALREADY_STARTED_OR_PARTIAL');
 // Perform all side-effect-free checks FIRST. The result remains NO-GO externally.
 const correlated=auditB300ReadOnlyCohort(cohort);
 if(correlated.evidenceCount!==envelopes.length||
   correlated.ordersSent!==0||correlated.paperOrdersSent!==0||
   correlated.releaseStatus!=='NO_GO_EXTERNAL_VERIFICATION_REQUIRED'||
   correlated.realPnlVerified!==null||
   correlated.hypothesis.actualLossesAvoided!==null||
   correlated.hypothesis.actualBrokerRealizedPnl!==null)
  deny('B301_NON_READONLY_OR_UNMATCHED_COHORT');
 const receipts=[];
 for(const signedEvidence of envelopes){
  // B299 handles signed read consent, revocation and UNIQUE constraints in its
  // own SQLite transaction. Errors require human review, never automatic retry.
  const recorded=journal.record({signedConsent:cohort.signedConsent,
   signedEvidence,trustedConsentKeys:cohort.trustedConsentKeys,
   trustedCollectorKeys:cohort.trustedCollectorKeys,scope:cohort.scope,nowMs});
  if(recorded.durableReplayJournalRecorded!==true||recorded.ordersSent!==0||
   recorded.paperOrdersSent!==0)deny('B301_INVALID_DURABLE_RECEIPT');
  receipts.push(recorded.journalReceiptDigestSha256);
 }
 const after=journal.inspect(cohort.scope,consent.consentId);
 if(!after||after.locallyRevoked!==false||
   after.recordedEvidenceCount!==envelopes.length)
  deny('B301_POST_RECORD_COUNT_MISMATCH');
 return Object.freeze({schema:'JENIOS_B301_PRIVATE_DURABLE_COHORT_V1',
  cohortEvidenceCount:correlated.evidenceCount,
  durableReceiptCount:receipts.length,
  localJournalCount:after.recordedEvidenceCount,
  receiptBatchSha256:sha(receipts),
  originalCorrelationSha256:correlated.reportSha256,
  configuredSignaturesChecked:true,
  durableLocalReplayGateUsed:true,
  localRevocationChecked:true,
  source:'OFFLINE_OPERATOR_SUPPLIED_EVIDENCE',
  externallyAttestedBroker:false,customerCivilIdentityVerified:false,
  brokerApiAuthorizationVerified:false,independentDeliveryVerified:false,
  b152DurableTradingLedgerReconciled:false,
  positionsAndFillsExternallyProven:false,
  actualLossesAvoided:null,actualBrokerRealizedPnl:null,
  hypotheticalLossesAvoided:correlated.hypothesis.hypotheticalLossesAvoided,
  hypotheticalProfitsForegone:correlated.hypothesis.hypotheticalProfitsForegone,
  ordersSent:0,paperOrdersSent:0,paymentsCreated:0,deploymentsCreated:0,
  realExecutionEnabled:false,paperExecutionEnabled:false,
  commercialPerformanceClaimsAllowed:false,
  releaseStatus:'NO_GO_EXTERNAL_VERIFICATION_REQUIRED',
  warnings:Object.freeze([
   'LOCAL_HMAC_AND_SIGNATURE_NOT_INDEPENDENT_PROVIDER_ATTESTATION',
   'LOCAL_JOURNAL_NOT_TRANSACTIONAL_ACROSS_ENTIRE_COHORT',
   'PARTIAL_FAILURE_REQUIRES_HUMAN_REVIEW_NO_AUTOMATIC_RETRY',
   ...correlated.issues
  ])});
}