/** B219 — offline evidence inventory for B152/B178/B207. Never reads or archives DB contents. */
const deny=code=>{throw Object.assign(new Error(code),{code});};
const required=['risk','dispatch','audit'];const HEX=/^[0-9a-f]{64}$/;
export function assessPrivateBackupProof({stores=[],restoreDrill=null,atMs}={}){
 if(!Number.isSafeInteger(atMs)||atMs<=0||!Array.isArray(stores)||stores.length!==3)
  deny('B219_INVALID_BACKUP_INVENTORY');
 const names=new Set(),hashes=new Set(),issues=[];
 for(const s of stores){
  if(!s||!required.includes(s.kind)||names.has(s.kind)||!HEX.test(s.contentSha256||'')||
   !Number.isSafeInteger(s.capturedAtMs)||s.capturedAtMs<=0||s.capturedAtMs>atMs||
   typeof s.encrypted!=='boolean'||s.repositoryExported!==false)
   deny('B219_INVALID_BACKUP_RECORD');
  names.add(s.kind);if(hashes.has(s.contentSha256))issues.push('IDENTICAL_STORE_DIGESTS');
  hashes.add(s.contentSha256);if(!s.encrypted)issues.push('UNENCRYPTED_BACKUP_'+s.kind.toUpperCase());
  if(atMs-s.capturedAtMs>86400000)issues.push('STALE_BACKUP_'+s.kind.toUpperCase());
 }
 if(required.some(k=>!names.has(k)))deny('B219_MISSING_BACKUP_KIND');
 const drill=restoreDrill?.isolatedEnvironment===true&&restoreDrill?.operatorReviewed===true&&
  restoreDrill?.sqliteIntegrityChecked===true&&restoreDrill?.noOrderExecution===true;
 if(!drill)issues.push('INDEPENDENT_RESTORE_DRILL_REQUIRED');
 return Object.freeze({schema:'JENIOS_B219_BACKUP_RESTORE_PREFLIGHT',storeCount:3,
  reportedIntegrityMetadataOnly:true,issues:Object.freeze([...new Set(issues)]),
  classification:issues.length?'NO_GO_BACKUP_RECOVERY':'REQUIRES_INDEPENDENT_RESTORE_ACCEPTANCE',
  // Caller-supplied hashes are not independent backup verification.
  independentBackupVerified:false,restoreActuallyPerformedByThisModule:false,
  dataCopiedByThisModule:false,credentialsCollected:false,brokerOrdersSent:0,
  automaticOrderRetryAllowed:false,liveExecutionAuthorized:false});
}
