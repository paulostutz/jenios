/** B204 — privacy-preserving evidence summary for human Paper pilot review.
 * Content SHA256 is an integrity checksum, NOT a signature, issuer attestation,
 * external broker certification, release authorization or performance proof.
 * Only explicit safe fields are projected into the output.
 */
import {createHash} from 'node:crypto';
const fail=code=>{throw Object.assign(new Error(code),{code});};
const pairedSchema='JENIOS_B201_PRIVATE_PAIRED_PAPER_READ';
const riskSchema='JENIOS_B202_LEDGER_OUTBOX_READONLY_AUDIT';
const restartSchema='JENIOS_B203_PRIVATE_RESTART_INVENTORY';
const observedKinds=new Set(['ACK','PARTIAL','FILLED','CANCELLED','REJECTED','UNKNOWN',undefined]);
const assessments=new Set(['STABLE_TERMINAL_OBSERVATIONS','STABLE_NONTERMINAL_OBSERVATIONS',
 'EVOLVING_OR_AMBIGUOUS','ORDER_NOT_FOUND_IS_UNKNOWN']);
const riskClass=new Set(['INCONSISTENT_EVIDENCE_NO_GO','UNKNOWN_BROKER_STATE_NO_GO',
 'OPEN_EXPOSURE_MANUAL_PROTECTION_REVIEW','REVIEW_REQUIRED_NO_AUTO_ACTION']);
const restartClass=new Set(['HALT_AND_REVIEW','MANUAL_REVIEW_BEFORE_RESUME']);
const outboxClass=new Set(['PREPARED','IN_FLIGHT','ACKED','REJECTED','AMBIGUOUS',
 'RECONCILED','NOT_PREPARED']);
function integer(x){return Number.isSafeInteger(x)&&x>=0;}
const code=x=>typeof x==='string'&&/^[A-Z0-9_]{1,80}$/.test(x);
function assertSafe(pair,risk,restart){
 if(!pair||pair.schema!==pairedSchema||!assessments.has(pair.assessment)||
  !integer(pair.observationCount)||pair.observationCount>2||
  pair.independentlyAttested!==false||pair.ordersSent!==0||
  pair.automaticResubmissionAllowed!==false||pair.liveExecutionAuthorized!==false||
  !observedKinds.has(pair.lastObservedKind))fail('UNVERIFIED_PAIRED_READ_CONTRACT');
 if(!risk||risk.schema!==riskSchema||!riskClass.has(risk.classification)||
    !['critical','high','review'].includes(risk.severity)||
    !outboxClass.has(risk.outboxState)||
    !Array.isArray(risk.conflictCodes)||risk.conflictCodes.length>25||
    !risk.conflictCodes.every(code)||risk.ledgerChanged!==false||
    risk.automaticOrderRetryAllowed!==false||risk.liveExecutionAuthorized!==false||
    risk.ordersSent!==0)fail('UNVERIFIED_LEDGER_AUDIT_CONTRACT');
 if(!restart||restart.schema!==restartSchema||!restartClass.has(restart.disposition)||
    !integer(restart.orderCount)||restart.orderCount>1000||!integer(restart.ambiguousCount)||
    !integer(restart.unverifiedDispatchCount)||!integer(restart.openExposureCount)||
    restart.noAutomaticSubmissionAfterRestart!==true||
    restart.ledgerChanged!==false||restart.ordersSent!==0||
    restart.liveExecutionAuthorized!==false)fail('UNVERIFIED_RESTART_AUDIT_CONTRACT');
 // This reporting boundary refuses input fields which could be credentials, personal
 // identifiers or opaque provider payloads. The operators must keep raw artifacts private.
 const banned=['apiKey','secret','credentials','credential_box','snapshot_box','userId',
  'accountId','accountDigest','connectionId','clientOrderId','token','authorization','rawOrder'];
 for(const data of [pair,risk,restart])for(const key of banned)if(Object.hasOwn(data,key))
  fail('PRIVATE_DATA_CANNOT_ENTER_RELEASE_REPORT');
}
export function compileRedactedPaperReview({pairedRead,ledgerAudit,restartInventory,
 nowMs,operatorAcknowledged=false}={}){
 if(!Number.isSafeInteger(nowMs)||nowMs<=0||typeof operatorAcknowledged!=='boolean')
  fail('INVALID_REVIEW_CLOCK_OR_SCOPE');
 assertSafe(pairedRead,ledgerAudit,restartInventory);
 const critical=ledgerAudit.severity==='critical'||restartInventory.disposition==='HALT_AND_REVIEW'||
  pairedRead.assessment==='ORDER_NOT_FOUND_IS_UNKNOWN'||
  pairedRead.assessment==='EVOLVING_OR_AMBIGUOUS';
 const risk=ledgerAudit.severity==='high'||restartInventory.openExposureCount>0;
 const severity=critical?'CRITICAL':risk?'HIGH':'REVIEW';
 const safe=Object.freeze({schema:'JENIOS_B204_REDACTED_PAPER_REVIEW',
  asOfMs:nowMs,provider:'alpaca',environment:'paper',
  evidenceType:'UNATTESTED_PRIVATE_QA_PROJECTIONS',
  pairedAssessment:pairedRead.assessment,
  brokerStateReported:pairedRead.lastObservedKind||'NOT_OBSERVED',
  ledgerClassification:ledgerAudit.classification,
  outboxState:ledgerAudit.outboxState,
  issueCodes:[...ledgerAudit.conflictCodes].sort(),
  restartDisposition:restartInventory.disposition,
  restartOrderCount:restartInventory.orderCount,
  ambiguousAfterRestart:restartInventory.ambiguousCount,
  unverifiedDispatchCount:restartInventory.unverifiedDispatchCount,
  openExposureCount:restartInventory.openExposureCount,
  severity,operatorAcknowledgmentClaimed:operatorAcknowledged});
 const checksum=createHash('sha256').update(JSON.stringify(safe),'utf8').digest('hex');
 return Object.freeze({...safe,evidenceChecksumSha256:checksum,
  checksumIsDigitalSignature:false,independentExternalWitnessCertified:false,
  humanAuthorizationGranted:false,privateWorkerDeployedByReport:false,
  brokerPermissionCertified:false,ordersSent:0,chargesCreated:0,
  automaticResubmissionAllowed:false,realExecutionAuthorized:false,
  readyForBrokerPaperPilot:false,productionReleaseAllowed:false,
  requiredActions:Object.freeze([
   ...(critical?['PAUSE_NEW_ENTRIES_AND_REVIEW_BROKER_ORDER']:[]),
   ...(risk?['VERIFY_BROKER_POSITION_AND_PROTECTIVE_LEGS']:[]),
   'OBTAIN_INDEPENDENT_BROKER_AUTHENTICATION_AND_PERMISSIONS',
   'OBTAIN_SEPARATE_OPERATOR_APPROVAL_FOR_PAPER_PILOT',
   'PROVE_PROSPECTIVE_ORIGINAL_ROBOT_PERFORMANCE_INDEPENDENTLY'
  ])});
}
