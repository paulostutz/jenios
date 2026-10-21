/** B215 — strict public diff guard versus the last CI-certified B210-R2 tree. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,existsSync} from 'node:fs';
const BASE='c7dda877a83d8929601c39c1def525d3e4baa532';
const ADD=[
 'lib/platform/connections/b211-private-adapter-attestation.mjs',
 'tests/platformB211AdapterAttestation.test.mjs',
 'lib/platform/connections/b212-worker-audit-health.mjs',
 'tests/platformB212WorkerAuditHealth.test.mjs',
 'lib/platform/connections/b213-private-host-readiness.mjs',
 'tests/platformB213HostReadiness.test.mjs',
 'scripts/platform/connections/b214-private-host-check.mjs',
 'tests/platformB214HostHealthCLI.test.mjs',
 'deploy/private/jenios-paper-observer.service.example',
 'docs/platform/B211-B215-PRIVATE-WORKER-OPERATIONS.md',
 'scripts/platform/connections/b215-integrity.mjs',
 '.github/workflows/jenios-b215-private-worker-ops.yml'
];
const MOD=['scripts/platform/connections/b209-private-observer-cli.mjs'];
const changes=execFileSync('git',['diff','--no-renames','--name-status',BASE,'HEAD'],{encoding:'utf8'}).trim()
 .split('\n').filter(Boolean).map(row=>row.split('\t'));
assert.equal(changes.length,ADD.length+MOD.length,'B215_UNEXPECTED_SOURCE_COUNT');
assert.deepEqual(changes.map(x=>x[1]).sort(),[...ADD,...MOD].sort(),'B215_UNEXPECTED_SOURCE_PATH');
for(const [status,path] of changes)
 assert.equal(status,MOD.includes(path)?'M':'A','B215_NOT_ADD_OR_EXACT_CLI_HARDENING '+path);
const original=execFileSync('git',['show',BASE+':'+MOD[0]],{encoding:'utf8'});
const hardened=readFileSync(MOD[0],'utf8');
assert.ok(original.includes('JENIOS_PRIVATE_OBSERVER_ADAPTER_PATH')&&
 hardened.includes('attestPrivateObserverAdapter(process.env.JENIOS_PRIVATE_OBSERVER_ADAPTER_PATH)'),
 'B209_SECURE_ADAPTER_ATTESTATION_NOT_WIRED');
assert.ok(hardened.includes("'--once'")&&hardened.includes("'--status'"),
 'B209_MANUAL_ONLY_INTERFACE_REMOVED');
assert.ok(!hardened.includes('https://')&&!hardened.includes('brokerExecution'),
 'B209_UNAUTHORIZED_NETWORK_OR_EXECUTION');
for(const f of [
 'package.json','package-lock.json','lib/platform/pilot-prep/paper-ledger.mjs',
 'lib/platform/pilot-prep/risk.mjs',
 'lib/platform/connections/b206-private-read-boundary.mjs',
 'lib/platform/connections/b207-durable-read-audit.mjs',
 'lib/platform/connections/b208-private-paper-observer.mjs',
 'lib/platform/connections/alpaca-paper-private-executor.mjs',
 'lib/platform/connections/alpaca-paper-native-submit.mjs',
 'lib/platform/connections/demo-vault.mjs',
 'app/components/platform/DemoBrokerConnector.js',
 'app/integracoes/page.js',
 'app/api/platform/checkout/route.js',
 'app/api/jenios-pay/checkout/route.js',
 'scripts/platform/connections/b210-integrity.mjs',
 '.github/workflows/jenios-b210-private-observer.yml']){
 assert.ok(readFileSync(f).equals(execFileSync('git',['show',BASE+':'+f])),
 'B210_CERTIFIED_CORE_DRIFT '+f);
}
const safety=[
 ['lib/platform/connections/b211-private-adapter-attestation.mjs',
  ['PRIVATE_ADAPTER_SYMLINK_FORBIDDEN','PRIVATE_ADAPTER_FILE_NOT_PROTECTED']],
 ['lib/platform/connections/b212-worker-audit-health.mjs',
  ['noAutomaticReplay:true','externalBrokerPilotApproved:false']],
 ['lib/platform/connections/b213-private-host-readiness.mjs',
  ['PRIVATE_SQLITE_INTEGRITY_UNVERIFIED','liveExecutionAuthorized:false']],
 ['scripts/platform/connections/b214-private-host-check.mjs',
  ['--check','HOST_PREFLIGHT_NO_GO','ordersSent:0']]
];
for(const [file,markers] of safety){const s=readFileSync(file,'utf8');
 for(const marker of markers)assert.ok(s.includes(marker),'B215_MISSING_SAFETY_MARKER '+file+' '+marker);
 assert.doesNotMatch(s,/https:\/\/api\.alpaca\.markets\/|https:\/\/api\.binance\.com|\bwithdraw\s*\(/i);
}
const unit=readFileSync('deploy/private/jenios-paper-observer.service.example','utf8');
for(const mark of ['Type=oneshot','Restart=no','ExecStartPre=','--check','--once'])
 assert.ok(unit.includes(mark),'B215_UNSAFE_UNIT '+mark);
const activeUnit=unit.split(/\r?\n/).filter(line=>!/^\s*[#;]/.test(line)).join('\n');
assert.doesNotMatch(activeUnit,/^\s*\[Install\]\s*$|^\s*WantedBy\s*=|^\s*ExecStart\s*=.*(?:--prod|--trade)/m);
for(const forbidden of ['app/api/platform/broker-execution/route.js',
 'app/api/platform/paper-execution/route.js',
 'app/api/platform/live-trading/route.js',
 'nucleo-privado/engine.mjs'])
 assert.equal(existsSync(forbidden),false,'B215_FORBIDDEN_PUBLIC_ORDER_ROUTE '+forbidden);
console.log('B215_B210_R2_FROZEN_PASS='+BASE+'; B211-B215 '+ADD.length+' additive paths + 1 hardened private CLI; no public order routes');
