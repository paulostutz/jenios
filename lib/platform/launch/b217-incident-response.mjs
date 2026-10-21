/** B217 — pure operator incident dispositions, NEVER a job scheduler or state transition. */
const deny=code=>{throw Object.assign(new Error(code),{code});};
const allowed=new Set(['MISSING','IN_PROGRESS','EXPIRED_NEEDS_REVIEW','FAILED_CLOSED','REVIEW_RECORDED']);
export function decidePaperAuditIncident({auditState,severity=null,ledgerState,dispatchState,atMs}={}){
 if(!allowed.has(auditState)||!['RESERVED','SUBMITTING','ACK','PARTIAL','FILLED','CANCELLED','REJECTED','UNKNOWN','CLOSED'].includes(ledgerState)||
  !['PREPARED','IN_FLIGHT','ACKED','AMBIGUOUS','REJECTED','RECONCILED','NOT_PREPARED'].includes(dispatchState)||
  ![null,'REVIEW','HIGH','CRITICAL'].includes(severity)||!Number.isSafeInteger(atMs)||atMs<=0)
  deny('B217_INVALID_INCIDENT_SCOPE');
 const unknown=['SUBMITTING','UNKNOWN'].includes(ledgerState)||['IN_FLIGHT','AMBIGUOUS'].includes(dispatchState);
 const exposed=['PARTIAL','FILLED'].includes(ledgerState)||(ledgerState==='CANCELLED'&&dispatchState!=='NOT_PREPARED');
 const failed=auditState!=='REVIEW_RECORDED'||severity==='HIGH'||severity==='CRITICAL';
 const blocked=unknown||exposed||failed;
 return Object.freeze({schema:'JENIOS_B217_INCIDENT_DISPOSITION',atMs,
  classification:blocked?'HALT_ENTRIES_AND_REVIEW':'OPERATOR_ACCEPTANCE_PENDING',
  actionCodes:Object.freeze([
   ...(blocked?['PAUSE_NEW_ENTRIES_USING_B152_OPERATOR_ACTION']:[]),
   ...(unknown?['READ_ORIGINAL_ORDER_BY_CLIENT_ID_NO_RESUBMISSION']:[]),
   ...(exposed?['VERIFY_BROKER_POSITION_AND_BOTH_PROTECTIVE_LEGS']:[]),
   'REQUIRE_FRESH_HUMAN_APPROVAL_FOR_NEW_AUDIT',
   'PRESERVE_RISK_AND_DISPATCH_JOURNALS'
  ]),pausedByThisReview:false,retryStarted:false,positionsClosed:false,
  providerOrderCancelSent:false,brokerAuthenticated:false,realExecutionAuthorized:false,ordersSent:0});
}
