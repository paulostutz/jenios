import test from 'node:test';import assert from 'node:assert/strict';
import {reviewWorkerHostEvidence} from '../lib/platform/launch/b216-host-evidence.mjs';
const nowMs=1792530000000;
const host={schema:'JENIOS_B213_PRIVATE_HOST_PREFLIGHT',isolatedSqliteStoresVerified:3,sqliteIntegrityVerified:true,
 observerSigningKeySeparate:true,adapterAttested:true,ordersSent:0,paymentsCreated:0};
const health={schema:'JENIOS_B212_PRIVATE_AUDIT_HEALTH',checkedAtMs:nowMs-100,ordersSent:0,
 backgroundMonitorStarted:false,classification:'PENDING_OPERATOR_APPROVAL'};
test('B216 inherited local host evidence still requires independent installation',()=>{
 const r=reviewWorkerHostEvidence({host,health,nowMs});assert.equal(r.classification,'CONFIGURATION_REVIEW_ONLY');
 assert.equal(r.deploymentProven,false);assert.equal(r.ordersSent,0);assert.equal(r.liveExecutionAuthorized,false);
});
test('B216 critical audit health halts preflight',()=>assert.equal(reviewWorkerHostEvidence({host,health:{...health,classification:'HALT_MANUAL_OPERATIONAL_REVIEW'},nowMs}).classification,'HALT_OPERATOR_REVIEW'));
for(const patch of [{host:{...host,sqliteIntegrityVerified:false}},{health:{...health,checkedAtMs:nowMs-400000}},
 {health:{...health,ordersSent:1}},{host:{...host,isolatedSqliteStoresVerified:2}}])
 test('B216 forged/stale host evidence rejects',()=>assert.throws(()=>reviewWorkerHostEvidence({host,health,nowMs,...patch}),/B216_HOST_EVIDENCE_INVALID/));
