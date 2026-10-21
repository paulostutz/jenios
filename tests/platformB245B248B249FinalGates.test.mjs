import test from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
import {auditSimulatedReceiptResult} from '../lib/platform/release250/b245-reconciliation-gate.mjs';
import {compileIndependentLaunchDecision} from '../lib/platform/release250/b248-independent-release-tracks.mjs';
import {composeOfflineReleaseManifest} from '../lib/platform/release250/b249-review-manifest.mjs';
const now=1792540000000,checks={ciPassed:true,buildPassed:true,browserRegressionPassed:true,criticalModulesPreserved:true};
test('B245 unknown partial receipt must keep local risk and request independent broker review',()=>{
 const r=auditSimulatedReceiptResult({schema:'JENIOS_B192_FAULT_REPLAY',scenario:'partial_then_timeout',state:'UNKNOWN',
 heldRiskUnits:'400000000',needsIndependentReconciliation:true,automaticResubmissionAllowed:false,
 networkCalls:0,ordersSent:0});
 assert.equal(r.riskStillHeld,true);assert.equal(r.requiresIndependentBrokerReview,true);
 assert.equal(r.externalAccountAuthenticated,false);assert.equal(r.paperOrdersSent,0);
});
test('B245 forgery claiming network calls or auto-retry is rejected',()=>{
 const base={schema:'JENIOS_B192_FAULT_REPLAY',scenario:'ack_then_timeout',state:'UNKNOWN',heldRiskUnits:'400000000',networkCalls:0,ordersSent:0,automaticResubmissionAllowed:false};
 assert.throws(()=>auditSimulatedReceiptResult({...base,networkCalls:1}),/B245_UNTRUSTED_SIMULATED_RECEIPT/);
 assert.throws(()=>auditSimulatedReceiptResult({...base,automaticResubmissionAllowed:true}),/B245_UNTRUSTED_SIMULATED_RECEIPT/);
});
test('B248 CI pass creates candidate review only; all other lanes remain NO_GO',()=>{
 const report=compileIndependentLaunchDecision({technicalChecks:checks},{nowMs:now});
 assert.equal(report.publicInformation.requiresOwnerAcceptance,true);
 assert.equal(report.commercialSubscriptions.status,'NO_GO_EXTERNAL_PROVIDER_ACCEPTANCE');
 assert.equal(report.customerBrokerPaper.offlineReadersAvailable,2);
 assert.equal(report.customerBrokerPaper.externalAuthenticatedAccountCount,0);
 assert.equal(report.liveAutomatedTrading.status,'NO_GO_LIVE_EXECUTION');
 assert.equal(report.productionPromotionAuthorized,false);
});
test('B248 missing Social/browser evidence holds even public candidate',()=>{
 const report=compileIndependentLaunchDecision({technicalChecks:{...checks,browserRegressionPassed:false}},{nowMs:now});
 assert.equal(report.publicInformation.status,'TECHNICAL_HOLD');
});
test('B249 offline manifest is deterministic and explicitly not externally signed',()=>{
 const data={commit:'a'.repeat(40),nowMs:now,ciClaimed:true};
 const a=composeOfflineReleaseManifest(data),b=composeOfflineReleaseManifest(data);
 assert.equal(a.contentSha256,b.contentSha256);assert.equal(a.hashIsDigitalSignature,false);
 assert.equal(a.approvals.externalBroker,false);assert.equal(a.externalOrderCalls,0);
});
test('B249 CLI refuses arguments containing tokens or invalid hashes',()=>{
 const script=new URL('../scripts/platform/release250/b249-offline-release-report.mjs',import.meta.url).pathname;
 const ok=spawnSync(process.execPath,[script,'a'.repeat(40),String(now)],{encoding:'utf8'});
 assert.equal(ok.status,0);assert.equal(JSON.parse(ok.stdout).productionDeployed,false);
 const bad=spawnSync(process.execPath,[script,'secret=ABC',String(now)],{encoding:'utf8'});
 assert.equal(bad.status,1);assert.equal(bad.stdout.includes('ABC'),false);
});
