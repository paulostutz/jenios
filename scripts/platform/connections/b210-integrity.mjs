/** B210 — only the declared private READ-ONLY worker additions may differ from B205.
 * This checks the entire Git diff, not merely handpicked protected files.
 */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,existsSync} from 'node:fs';
const BASE='d69a0c51258f3f6750dabd7458f549f0792155c8';
const ADD=[
 'lib/platform/connections/b206-private-read-boundary.mjs',
 'tests/platformB206PrivateReadBoundary.test.mjs',
 'lib/platform/connections/b207-durable-read-audit.mjs',
 'tests/platformB207DurableAuditJournal.test.mjs',
 'lib/platform/connections/b208-private-paper-observer.mjs',
 'tests/platformB208PrivateObserverWorker.test.mjs',
 'scripts/platform/connections/b209-private-observer-cli.mjs',
 'tests/platformB209PrivateObserverCLI.test.mjs',
 'docs/platform/B206-B210-ISOLATED-READ-ONLY-WORKER.md',
 'scripts/platform/connections/b210-integrity.mjs',
 '.github/workflows/jenios-b210-private-observer.yml'
];
const REPAIRED_TEST='tests/platformPilotPrep.test.mjs';
const changed=execFileSync('git',['diff','--no-renames','--name-status',BASE,'HEAD'],{encoding:'utf8'})
 .trim().split('\n').filter(Boolean).map(row=>row.split('\t'));
assert.equal(changed.length,ADD.length+1,'B210_UNEXPECTED_PUBLIC_CHANGE_COUNT');
assert.deepEqual(changed.map(x=>x[1]).sort(),[...ADD,REPAIRED_TEST].sort(),'B210_UNEXPECTED_PUBLIC_PATH');
for(const [status,path] of changed)assert.equal(status,path===REPAIRED_TEST?'M':'A',
 'B210_NON_ADDITIVE_CHANGE '+path);
const oldTest=execFileSync('git',['show',BASE+':'+REPAIRED_TEST],{encoding:'utf8'});
const oldRacy="child.once('exit',code=>code===0?resolve(JSON.parse(out))";
assert.ok(oldTest.includes(oldRacy),'B152_EXPECTED_TEST_SOURCE_NOT_FOUND');
assert.equal(readFileSync(REPAIRED_TEST,'utf8'),oldTest.replace(oldRacy,
 "child.once('close',code=>code===0?resolve(JSON.parse(out))"),
 'B152_TEST_MODIFIED_BEYOND_STDIO_DRAIN_FIX');
for(const file of ['package.json','package-lock.json',
 'lib/platform/pilot-prep/paper-ledger.mjs','lib/platform/pilot-prep/risk.mjs',
 'lib/platform/connections/alpaca-paper-private-executor.mjs',
 'lib/platform/connections/alpaca-paper-native-submit.mjs',
 'lib/platform/connections/alpaca-paper-dispatch-journal.mjs',
 'lib/platform/connections/alpaca-paper-dispatch-grant.mjs',
 'lib/platform/connections/demo-vault.mjs',
 'lib/platform/connections/demo-broker-reader.mjs',
 'lib/platform/connections/b201-private-paired-paper-reader.mjs',
 'lib/platform/connections/b202-paper-ledger-outbox-audit.mjs',
 'lib/platform/connections/b203-private-restart-inventory.mjs',
 'lib/platform/connections/b204-redacted-paper-review.mjs',
 'app/integracoes/page.js','app/components/platform/DemoBrokerConnector.js',
 'app/api/platform/checkout/route.js','app/api/jenios-pay/checkout/route.js',
 '.github/workflows/jenios-b205-private-observer.yml']){
 assert.ok(readFileSync(file).equals(execFileSync('git',['show',BASE+':'+file])),
  'B205_CERTIFIED_SOURCE_CHANGED '+file);
}
for(const [file,marks] of [
 ['lib/platform/connections/b206-private-read-boundary.mjs',[
  'READ_GRANT_CROSS_ACCOUNT','PAPER_GET_ONLY_REQUIRED','PAPER_READ_BUDGET_EXCEEDED']],
 ['lib/platform/connections/b207-durable-read-audit.mjs',[
  'EXPIRED_NEEDS_REVIEW','PRIVATE_AUDIT_DIRECTORY_NOT_ISOLATED','automaticRestartAllowed:false']],
 ['lib/platform/connections/b208-private-paper-observer.mjs',[
  'pausePrivatePaperEntries','DUPLICATE_OR_EXPIRED_AUDIT_NO_AUTOMATIC_RETRY',
  'ordersSent:0','productionPromotionAllowed:false']],
 ['scripts/platform/connections/b209-private-observer-cli.mjs',[
  'HALTED_READ_ONLY_REQUIREMENTS_UNMET','--once','--status','ADAPTER_MUST_BE_OUTSIDE_REPOSITORY']]
]){
 const source=readFileSync(file,'utf8');
 for(const mark of marks)assert.ok(source.includes(mark),'B210_MISSING_SECURITY_GUARD '+file+' '+mark);
 assert.doesNotMatch(source,/https:\/\/api\.alpaca\.markets\/|https:\/\/api\.binance\.com|\bwithdraw\s*\(/i);
}
const submissionPaths=['app/api/platform/broker-execution/route.js',
 'app/api/platform/paper-execution/route.js','app/api/platform/live-trading/route.js',
 'nucleo-privado/engine.mjs'];
for(const p of submissionPaths)assert.equal(existsSync(p),false,'B210_PROHIBITED_PUBLIC_ROUTE '+p);
console.log('B210_B205_IMMUTABLE_PASS='+BASE+'; 11 additions and one B152 test stdout-drain race fix; no production runtime modifications');
