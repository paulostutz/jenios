/** B239: cross-check existing worker host diagnostics with audit state; no daemon startup. */
export function inspectOperatorHostApproval({hostInspection,healthInspection}){
 const host=hostInspection?.schema==='JENIOS_B213_PRIVATE_HOST_PREFLIGHT'&&
  hostInspection.sqliteIntegrityVerified===true&&hostInspection.isolatedSqliteStoresVerified===3&&
  hostInspection.observerSigningKeySeparate===true&&hostInspection.workerServiceInstalledByThisCheck===false;
 const health=healthInspection?.schema==='JENIOS_B212_PRIVATE_AUDIT_HEALTH'&&
  healthInspection?.ordersSent===0;
 const review=!!host&&!!health;
 return Object.freeze({schema:'JENIOS_B239_HOST_COMBINED_REVIEW',
  verifiedHostConfigurationClaimed:!!host,
  auditHealthContractClaimed:!!health,
  packageReadyForIndependentOperatorInspection:review,
  // These reports cannot demonstrate daemon installation or actual broker access.
  persistentWorkerInstalled:false,externalAccountAuthenticated:false,
  unattendedRestartAuthorized:false,liveExecutionAuthorized:false,
  ordersSent:0,costsAuthorized:false});
}
