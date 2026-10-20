/** B195: freeze certified B189 and permit only declared additive QA modules plus UI disclosure.
 * The baseline includes B184 source and all earlier protected functionality.
 */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,existsSync} from 'node:fs';
const BASE='bd33fdec24098f560ba786789d2ff495b96e2745';
const ADD=[
 'lib/platform/connections/b190-customer-activation.mjs',
 'lib/platform/connections/b191-private-recovery-runbook.mjs',
 'lib/platform/connections/b192-adversarial-paper-replay.mjs',
 'lib/platform/connections/b193-paper-protection-gate.mjs',
 'lib/platform/connections/b194-performance-acceptance.mjs',
 'tests/platformB190CustomerActivation.test.mjs',
 'tests/platformB191B193Recovery.test.mjs',
 'tests/platformB194PerformanceGate.test.mjs',
 'docs/platform/B190-B195-CUSTOMER-PAPER-READINESS.md',
 'scripts/platform/connections/b195-integrity.mjs',
 '.github/workflows/jenios-b195-customer-paper.yml'
];
const UPDATE=['app/components/platform/DemoBrokerConnector.js'];
const source=execFileSync('git',['diff','--no-renames','--name-status',BASE,'HEAD'],{encoding:'utf8'});
const changes=source.trim().split('\n').filter(Boolean).map(row=>{
 const [kind,path]=row.split('\t');assert.ok(kind&&path,'INVALID_GIT_STATUS');return {kind,path};
});
assert.equal(changes.length,ADD.length+UPDATE.length,'UNEXPECTED_PUBLIC_SCOPE_SIZE');
assert.deepEqual(changes.map(x=>x.path).sort(),[...ADD,...UPDATE].sort(),'UNEXPECTED_PUBLIC_PATH');
for(const x of changes){
 assert.equal(x.kind,ADD.includes(x.path)?'A':'M','NON_ADDITIVE_OR_UNEXPECTED_CHANGE '+x.path);
}
const ui=readFileSync(UPDATE[0],'utf8');
const original=execFileSync('git',['show',BASE+':'+UPDATE[0]],{encoding:'utf8'});
assert.match(ui,/data-b190-activation-status/);
assert.match(ui,/customerBrokerActivation/);
assert.ok(ui.includes('READ_ONLY_DEMO_NO_ORDERS'));
assert.doesNotMatch(ui,/console\.log|localStorage|sessionStorage|\bfetch\(['"]https:\/\//);
for(const marker of ['platformSupabase','credentials:\'omit\'','type="password"'])assert.ok(ui.includes(marker),'UI_SAFETY_DRIFT '+marker);
assert.ok(ui.length>=original.length,'ORIGINAL_QA_FORM_REMOVED');
const checks=[
 ['lib/platform/connections/b190-customer-activation.mjs',['realExecutionAuthorized:false','paperOrdersCertified:false']],
 ['lib/platform/connections/b191-private-recovery-runbook.mjs',['PRIVATE_PAPER_REHEARSAL_REQUIRED','ordersSent:0']],
 ['lib/platform/connections/b192-adversarial-paper-replay.mjs',['DURABLE_LEDGER_REQUIRED','automaticResubmissionAllowed:false']],
 ['lib/platform/connections/b193-paper-protection-gate.mjs',['stopExecutionGuaranteed:false','actualStopsCertified:false']],
 ['lib/platform/connections/b194-performance-acceptance.mjs',['robotPerformanceCertified:false','liveExecutionAuthorized:false']]
];
for(const [path,marks] of checks){const text=readFileSync(path,'utf8');
 for(const marker of marks)assert.ok(text.includes(marker),'MISSING_SAFETY_MARKER '+path+' '+marker);
 assert.doesNotMatch(text,/https:\/\/api\.alpaca\.markets\/|https:\/\/api\.binance\.com|\bwithdraw\s*\(/i);
}
for(const originalFile of [
 'package.json','package-lock.json','lib/platform/pilot-prep/paper-ledger.mjs',
 'lib/platform/connections/b185-paper-simulator.mjs',
 'lib/platform/connections/b186-ledger-replay.mjs',
 'lib/platform/connections/alpaca-paper-private-executor.mjs',
 'lib/platform/connections/demo-service.mjs',
 'lib/platform/connections/demo-vault.mjs',
 'lib/platform/connections/catalog.mjs',
 'app/integracoes/page.js','app/api/platform/broker-connections/route.js',
 '.github/workflows/jenios-b186-simulator.yml'
]){
 assert.ok(readFileSync(originalFile).equals(execFileSync('git',['show',BASE+':'+originalFile])),
  'CERTIFIED_B189_FILE_CHANGED '+originalFile);
}
assert.equal(existsSync('nucleo-privado/engine.mjs'),false,'PROPRIETARY_CORE_EXPOSED');
assert.equal(existsSync('app/api/platform/broker-execution/route.js'),false,'ORDER_SENDER_ROUTE_EXPOSED');
console.log('B195_B189_IMMUTABLE_PASS '+ADD.length+' additions; 1 QA-only UI disclosure; no order route.');
