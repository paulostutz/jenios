/** B216 — compose earlier host checks without converting them into a deployment certificate. */
const deny=code=>{throw Object.assign(new Error(code),{code});};
export function reviewWorkerHostEvidence({host,health,nowMs}={}){
 if(!Number.isSafeInteger(nowMs)||nowMs<=0||
  host?.schema!=='JENIOS_B213_PRIVATE_HOST_PREFLIGHT'||
  health?.schema!=='JENIOS_B212_PRIVATE_AUDIT_HEALTH'||
  !Number.isSafeInteger(health.checkedAtMs)||health.checkedAtMs>nowMs||
  nowMs-health.checkedAtMs>300000||
  host.isolatedSqliteStoresVerified!==3||host.sqliteIntegrityVerified!==true||
  host.observerSigningKeySeparate!==true||host.adapterAttested!==true||
  health.ordersSent!==0||health.backgroundMonitorStarted!==false||
  host.ordersSent!==0||host.paymentsCreated!==0)
  deny('B216_HOST_EVIDENCE_INVALID');
 const blocked=health.classification!=='PENDING_OPERATOR_APPROVAL';
 return Object.freeze({schema:'JENIOS_B216_HOST_EVIDENCE',asOfMs:nowMs,
  classification:blocked?'HALT_OPERATOR_REVIEW':'CONFIGURATION_REVIEW_ONLY',
  passedLocalFileChecks:true,needsOperatorHostAttestation:true,
  pending:Object.freeze(['PROVISION_APPROVED_HOST','PROTECT_SECRET_STORE','INSTALL_REVIEWED_SERVICE',
   'VERIFY_BACKUP_RESTORE_IN_ISOLATION','VERIFY_EXTERNAL_PAPER_ACCOUNT_READ']),
  deploymentProven:false,externalBrokerAuthenticated:false,externalOrdersCertified:false,
  unattendedOperationsAllowed:false,liveExecutionAuthorized:false,ordersSent:0,chargesCreated:0});
}
