/** B230 — immutable B215-R2 and no unexpected public/billing/robot modifications. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,existsSync} from 'node:fs';
const BASE='d4b7a3f791df08e034be157ae447375bf380f5ca';
const files=[
 ...Array.from({length:15},(_,i)=>'B'+(216+i)),
];
const moduleNames=[
 'b216-host-evidence','b217-incident-response','b218-runtime-fence','b219-backup-recovery-manifest',
 'b220-provider-implementation-matrix','b221-customer-link-check','b222-offline-provider-conformance',
 'b223-provider-gaps','b224-three-mode-ledger-lab','b225-holdout-candidate',
 'b226-prospective-witness-review','b227-commercial-preflight','b228-synthetic-lifecycle',
 'b229-release-package','b230-release-candidate'
];
const tests=[
 'platformB216HostEvidence','platformB217IncidentResponse','platformB218RuntimeFence',
 'platformB219BackupManifest','platformB220ProviderMatrix','platformB221CustomerLink',
 'platformB222OfflineConformance','platformB223ProviderGaps','platformB224ThreeModeLedgerLab',
 'platformB225HoldoutCandidate','platformB226ProspectiveWindow','platformB227CommercialPreflight',
 'platformB228SyntheticLifecycle','platformB229ReleasePackage','platformB230ReleaseCandidate',
 'platformB230IntegratedNoGo'
];
const allowed=[...moduleNames.map(m=>'lib/platform/launch/'+m+'.mjs'),
 ...tests.map(t=>'tests/'+t+'.test.mjs'),
 'scripts/platform/launch/b229-offline-release-report.mjs',
 'scripts/platform/launch/b230-integrity.mjs',
 'docs/platform/B216-B230-CONSOLIDATED-RELEASE.md',
 'docs/platform/B230-LAUNCH-CANDIDATE-DECISION.md',
 '.github/workflows/jenios-b230-release-candidate.yml'];
const rows=execFileSync('git',['diff','--no-renames','--name-status',BASE,'HEAD'],{encoding:'utf8'})
 .trim().split('\n').filter(Boolean).map(v=>v.split('\t'));
assert.deepEqual(rows.map(x=>x[1]).sort(),allowed.slice().sort(),'B230_SCOPE_DRIFT');
assert.equal(rows.length,allowed.length,'B230_SCOPE_SIZE');
for(const [status,path] of rows)assert.equal(status,'A','B230_NON_ADDITIVE '+path);
for(const f of ['package.json','package-lock.json','lib/platform/pilot-prep/paper-ledger.mjs',
 'lib/platform/pilot-prep/risk.mjs','lib/platform/connections/alpaca-paper-private-executor.mjs',
 'lib/platform/connections/demo-service.mjs','lib/platform/connections/demo-vault.mjs',
 'lib/platform/connections/provider-paths.mjs','lib/platform/trial/person-ledger.mjs',
 'lib/platform/checkout-readiness.mjs','lib/pay/inter-pix.mjs','lib/platform/rolling-paper-validation.mjs',
 'app/integracoes/page.js','app/api/platform/checkout/route.js','app/api/jenios-pay/checkout/route.js',
 '.github/workflows/jenios-b215-private-worker-ops.yml']){
 assert.ok(readFileSync(f).equals(execFileSync('git',['show',BASE+':'+f])),'B215_PROTECTED_FILE_CHANGED '+f);
}
for(const path of moduleNames.map(m=>'lib/platform/launch/'+m+'.mjs')){
 const source=readFileSync(path,'utf8');
 assert.doesNotMatch(source,/https:\/\/api\.alpaca\.markets\/|https:\/\/api\.binance\.com\/|\bwithdraw\s*\(|\bsubmitRealOrder\s*\(/i,'B230_PROHIBITED_LIVE_SENDER '+path);
}
const decision=readFileSync('lib/platform/launch/b230-release-candidate.mjs','utf8');
for(const flag of ['productionReleaseAuthorizedByThisAudit:false','externalProviderCertified:false','realOrdersSent:0','chargesCreated:0'])
 assert.ok(decision.includes(flag),'B230_FAIL_CLOSED_FLAG_MISSING '+flag);
for(const path of ['app/api/platform/broker-execution/route.js','app/api/platform/live-trading/route.js',
 'app/api/platform/private-observer/route.js','nucleo-privado/engine.mjs'])
 assert.equal(existsSync(path),false,'B230_PUBLIC_EXECUTION_SURFACE '+path);
console.log('B230_B215_SCOPE_FROZEN='+BASE+'; '+allowed.length+' additive candidate files; no live broker route or payments');
