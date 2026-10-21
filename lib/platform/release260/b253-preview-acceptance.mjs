/** B253: no-network evaluator of responses gathered in isolated localhost QA.
 * Statuses alone do not prove browser access control or external-provider behavior. */
const fail=c=>{throw Object.assign(new Error(c),{code:c});};
const allowedPaths=['/integracoes','/api/platform/broker-readiness','/api/platform/broker-providers'];
export function reviewPreviewHttpEvidence({responses,previewAdminStatus,nowMs}={}){
 if(!Array.isArray(responses)||responses.length!==allowedPaths.length||
  !Number.isSafeInteger(nowMs)||nowMs<=0||
  !Number.isSafeInteger(previewAdminStatus))fail('INVALID_PREVIEW_EVIDENCE');
 const unique=new Map();
 for(const r of responses){if(!r||!allowedPaths.includes(r.path)||unique.has(r.path)||
  !Number.isInteger(r.status)||typeof r.cacheControl!=='string'||
  typeof r.bodyRedacted!=='boolean')fail('INVALID_PREVIEW_HTTP_ROW');unique.set(r.path,r);}
 const pass=allowedPaths.every(path=>unique.get(path)?.status===200&&
  unique.get(path)?.cacheControl.includes('no-store')&&unique.get(path)?.bodyRedacted===true);
 return Object.freeze({schema:'JENIOS_B253_PREVIEW_HTTP_AUDIT',asOfMs:nowMs,
  expectedRoutesVerifiedLocally:pass,previewAdminRouteStatusObserved:previewAdminStatus,
  adminReadOnlyRouteFailClosed:previewAdminStatus===401||previewAdminStatus===403||previewAdminStatus===404,
  actualUserSessionTested:false,remotePreviewDeploymentTested:false,
  externalAccountsAuthenticated:false,productionReleaseApproved:false,
  chargesCreated:0,ordersSent:0});
}
