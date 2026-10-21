/** B212 — read-only operational diagnosis for existing B207 observation audits.
 * No scheduler, broker HTTP, order retries, alarms or ledger changes occur here.
 */
import {assertIsolatedReadWorker} from './b206-private-read-boundary.mjs';
const deny=code=>{throw Object.assign(new Error(code),{code});};
const STATES=new Set(['IN_PROGRESS','REVIEW_RECORDED','FAILED_CLOSED','EXPIRED_NEEDS_REVIEW']);
export function assessPrivateObserverAuditHealth({auditStore,scopes,nowMs},{env=process.env}={}){
 assertIsolatedReadWorker(env);
 if(!auditStore||typeof auditStore.inspect!=='function'||!Array.isArray(scopes)||
  scopes.length>32||!Number.isSafeInteger(nowMs)||nowMs<=0)
  deny('PRIVATE_HEALTH_INPUT_REQUIRED');
 const summary={missing:0,inProgress:0,expired:0,failed:0,reviewRecorded:0,criticalReview:0};
 let blocked=false,seen=new Set();
 for(const scope of scopes){
  if(!scope||typeof scope!=='object'||typeof scope.userId!=='string'||
    typeof scope.connectionId!=='string'||typeof scope.clientOrderId!=='string'||
    typeof scope.auditId!=='string')deny('PRIVATE_HEALTH_OWNER_SCOPE_REQUIRED');
  // No raw scopes leave the worker. Reject repeated input rather than double-counting.
  const key=JSON.stringify([scope.userId,scope.connectionId,scope.clientOrderId,scope.auditId]);
  if(seen.has(key))deny('DUPLICATE_AUDIT_HEALTH_SCOPE');seen.add(key);
  const row=auditStore.inspect(scope);
  if(row===null){summary.missing++;blocked=true;continue;}
  if(!row||!STATES.has(row.state)||typeof row.auditDigest!=='string'||
      !/^[a-f0-9]{64}$/.test(row.auditDigest)||row.ordersSent!==0||
      row.automaticRestartAllowed!==false||row.liveExecution!==false||
      !Number.isSafeInteger(row.expiresAtMs)||!Number.isSafeInteger(row.startedAtMs)||
      row.startedAtMs>nowMs)deny('PRIVATE_HEALTH_JOURNAL_UNTRUSTED');
  if(row.state==='IN_PROGRESS'){
   summary.inProgress++;
   if(nowMs>=row.expiresAtMs){summary.expired++;blocked=true;}
  }else if(row.state==='EXPIRED_NEEDS_REVIEW'){
   summary.expired++;blocked=true;
  }else if(row.state==='FAILED_CLOSED'){
   summary.failed++;blocked=true;
  }else{
   summary.reviewRecorded++;
   if(!['REVIEW','HIGH','CRITICAL'].includes(row.severity))
    deny('PRIVATE_HEALTH_JOURNAL_UNTRUSTED');
   if(row.severity!=='REVIEW'){summary.criticalReview++;blocked=true;}
  }
 }
 return Object.freeze({schema:'JENIOS_B212_PRIVATE_AUDIT_HEALTH',checkedAtMs:nowMs,
  inspectedAudits:scopes.length,counts:Object.freeze(summary),
  classification:blocked?'HALT_MANUAL_OPERATIONAL_REVIEW':'PENDING_OPERATOR_APPROVAL',
  noAutomaticReplay:true,brokerAccountAuthenticatedByHealth:false,
  privateHostOperationallyCertified:false,
  externalBrokerPilotApproved:false,liveExecutionAuthorized:false,
  ordersSent:0,notificationsDispatched:0,backgroundMonitorStarted:false,
  automaticOrderRetryAllowed:false});
}
