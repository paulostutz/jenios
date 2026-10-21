import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {PrivatePaperReadAuditStore} from '../lib/platform/connections/b207-durable-read-audit.mjs';
import {assessPrivateObserverAuditHealth} from '../lib/platform/connections/b212-worker-audit-health.mjs';
const env={JENIOS_DEMO_VAULT_KEY_B64:Buffer.alloc(32,4).toString('base64'),
 JENIOS_PAPER_OBSERVER_KEY_B64:Buffer.alloc(32,7).toString('base64'),
 JENIOS_PRIVATE_PAPER_REHEARSAL:'true',JENIOS_PRIVATE_PAPER_ACCOUNT_PREFLIGHT:'true',
 JENIOS_PRIVATE_PAPER_READ_OBSERVER:'true',JENIOS_PRIVATE_PAPER_OBSERVER_WORKER:'true'};
const now=1792526000000;
const scope={userId:'4d238a7a-8c7b-4d8e-9a10-1c5c82db59a7',
 connectionId:'50b85e9d-339c-4d32-b2bf-82c467673832',
 clientOrderId:'private-paper-1',auditId:'manual-cycle-1'};
const report={schema:'JENIOS_B204_REDACTED_PAPER_REVIEW',
 evidenceChecksumSha256:'a'.repeat(64),severity:'CRITICAL',ordersSent:0,
 readyForBrokerPaperPilot:false,realExecutionAuthorized:false,
 productionReleaseAllowed:false,chargesCreated:0,humanAuthorizationGranted:false,
 brokerPermissionCertified:false,privateWorkerDeployedByReport:false,
 independentExternalWitnessCertified:false,automaticResubmissionAllowed:false};
const fixture=fn=>{const dir=mkdtempSync(join(tmpdir(),'jenios-b212-')),
 store=new PrivatePaperReadAuditStore(join(dir,'audit.sqlite'),{env});
 try{return fn(store);}finally{store.close();rmSync(dir,{force:true,recursive:true});}};
const inspect=(store,clock=now,rows=[scope])=>assessPrivateObserverAuditHealth({auditStore:store,scopes:rows,nowMs:clock},{env});
test('B212 missing audit never becomes approval, no network or alerts',()=>fixture(store=>{
 const r=inspect(store);assert.equal(r.classification,'HALT_MANUAL_OPERATIONAL_REVIEW');
 assert.equal(r.counts.missing,1);assert.equal(r.ordersSent,0);
 assert.equal(r.backgroundMonitorStarted,false);assert.equal(r.notificationsDispatched,0);
 assert.equal(JSON.stringify(r).includes(scope.userId),false);
}));
test('B212 in-flight audit is pending; expiry blocks manual operational release',()=>fixture(store=>{
 store.claim(scope,{nowMs:now,leaseMs:2000});
 const pending=inspect(store,now+1000);assert.equal(pending.classification,'PENDING_OPERATOR_APPROVAL');
 assert.equal(pending.counts.inProgress,1);
 const expired=inspect(store,now+2000);assert.equal(expired.counts.expired,1);
 assert.equal(expired.classification,'HALT_MANUAL_OPERATIONAL_REVIEW');
 assert.equal(store.inspect(scope).state,'IN_PROGRESS'); // read-only; no automatic mutation
}));
test('B212 failed or critical saved audit stays blocked after restart',()=>fixture(store=>{
 store.claim(scope,{nowMs:now});store.record(scope,{nowMs:now+100,report});
 const bad=inspect(store,now+200);assert.equal(bad.counts.criticalReview,1);
 assert.equal(bad.classification,'HALT_MANUAL_OPERATIONAL_REVIEW');
}));
test('B212 review-only evidence is pending operator, never external pilot GO',()=>fixture(store=>{
 store.claim(scope,{nowMs:now});store.record(scope,{nowMs:now+100,report:{...report,severity:'REVIEW'}});
 const r=inspect(store,now+150);assert.equal(r.counts.reviewRecorded,1);
 assert.equal(r.externalBrokerPilotApproved,false);assert.equal(r.liveExecutionAuthorized,false);
 assert.equal(r.classification,'PENDING_OPERATOR_APPROVAL');
}));
test('B212 cannot accept duplicated or forged journal results',()=>fixture(store=>{
 assert.throws(()=>inspect(store,now,[scope,scope]),/DUPLICATE_AUDIT_HEALTH_SCOPE/);
 assert.throws(()=>assessPrivateObserverAuditHealth({auditStore:{inspect:()=>({state:'REVIEW_RECORDED',
   auditDigest:'a'.repeat(64),ordersSent:1,automaticRestartAllowed:false,liveExecution:false,
   expiresAtMs:now+100,startedAtMs:now})},scopes:[scope],nowMs:now},{env}),
   /PRIVATE_HEALTH_JOURNAL_UNTRUSTED/);
}));
test('B212 cannot run in Vercel or with read-only worker gates disabled',()=>fixture(store=>{
 assert.throws(()=>assessPrivateObserverAuditHealth({auditStore:store,scopes:[scope],nowMs:now},
  {env:{...env,VERCEL_ENV:'preview'}}),/PRIVATE_GET_ONLY_WORKER_DISABLED/);
}));
