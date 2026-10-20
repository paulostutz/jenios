/** B187: additive scope guard for B185+ while pinning the certified B184 state.
 * This does not relax B184 checks or authorize a trading route.
 */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,existsSync} from 'node:fs';

const b177='caaffece04649a6dc1ca6c8012d7502887771529';
const b184='ba64c9b200af311477c592299cd5e4e61600e75b';
const additionsB184=[
 'lib/platform/connections/alpaca-paper-dispatch-journal.mjs',
 'lib/platform/connections/alpaca-paper-dispatch-grant.mjs',
 'lib/platform/connections/alpaca-paper-native-submit.mjs',
 'lib/platform/connections/alpaca-paper-private-executor.mjs',
 'lib/platform/connections/alpaca-paper-bracket-audit.mjs',
 'tests/platformAlpacaPaperDispatchJournal.test.mjs',
 'tests/platformAlpacaPaperDispatchGrant.test.mjs',
 'tests/platformAlpacaPaperNativeSubmit.test.mjs',
 'tests/platformAlpacaPaperPrivateExecutor.test.mjs',
 'tests/platformAlpacaPaperBracketAudit.test.mjs',
 'docs/platform/B178-B184-PRIVATE-PAPER-NATIVE-EXECUTION.md',
 'scripts/platform/connections/b184-integrity.mjs',
 '.github/workflows/jenios-b184-private-paper.yml'
];
const additionsAfterB184=[
 'lib/platform/connections/b185-paper-simulator.mjs',
 'lib/platform/connections/b186-ledger-replay.mjs',
 'tests/platformB185PaperSimulator.test.mjs',
 'tests/platformB186LedgerReplay.test.mjs',
 'docs/platform/B185-SIMULATOR-ACCEPTANCE.md',
 '.github/workflows/jenios-b186-simulator.yml',
 'scripts/platform/connections/b187-integrity.mjs',
 'tests/platformB187PaperLedgerE2E.test.mjs',
 'docs/platform/B187-B189-VALIDATION.md'
];
function delta(a,b){
 const output=execFileSync('git',['diff','--no-renames','--name-status',a,b],{encoding:'utf8'});
 return output.trim().split('\n').filter(Boolean).map(line=>{
  const [kind,path]=line.split('\t');
  assert.ok(kind&&path,'INVALID_GIT_DIFF');
  return {kind,path};
 });
}
function exactAdditions(actual,allowed,label){
 assert.equal(actual.length,allowed.length,label+' FILE_COUNT_CHANGED');
 assert.deepEqual(actual.map(x=>x.path).sort(),[...allowed].sort(),label+' UNEXPECTED_PATH');
 for(const x of actual)assert.equal(x.kind,'A',label+' NON_ADDITIVE '+x.path);
}
exactAdditions(delta(b177,b184),additionsB184,'B184');
exactAdditions(delta(b184,'HEAD'),additionsAfterB184,'B187');
const protectedB177=[
 'package.json','package-lock.json',
 'lib/platform/pilot-prep/paper-ledger.mjs',
 'lib/platform/pilot-prep/risk.mjs',
 'lib/platform/connections/alpaca-paper-risk-rehearsal.mjs',
 'lib/platform/connections/alpaca-paper-ledger-reconcile.mjs',
 'lib/platform/connections/demo-vault.mjs',
 'lib/platform/connections/demo-http.mjs',
 'scripts/platform/connections/browser-smoke.mjs',
 'app/integracoes/page.js','app/api/platform/broker-connections/route.js'
];
for(const file of protectedB177){
 const original=execFileSync('git',['show',b177+':'+file]);
 assert.ok(readFileSync(file).equals(original),'PROTECTED_B177_DRIFT '+file);
}
for(const file of additionsB184){
 const original=execFileSync('git',['show',b184+':'+file]);
 assert.ok(readFileSync(file).equals(original),'CERTIFIED_B184_DRIFT '+file);
}
assert.equal(existsSync('nucleo-privado/engine.mjs'),false,'PRIVATE_ROBOT_ENGINE_EXPOSED');
assert.equal(existsSync('app/api/platform/broker-execution/route.js'),false,'BROKER_ORDER_ROUTE_EXPOSED');
const worker=readFileSync('lib/platform/connections/alpaca-paper-private-executor.mjs','utf8');
for(const marker of ['ACCOUNT_REVOCATION_FENCE_REQUIRED','verifyPaperGrant','journal.claim',
 'PAPER_DUPLICATE_RESERVATION','automaticResubmissionAllowed:false','REAL_EXECUTION_NOT_AUTHORIZED'])
 assert.ok(worker.includes(marker),'B184_GUARD_MISSING '+marker);
const native=readFileSync('lib/platform/connections/alpaca-paper-native-submit.mjs','utf8');
assert.match(native,/https:\/\/paper-api\.alpaca\.markets\/v2\/orders/);
assert.doesNotMatch(native,/https:\/\/api\.alpaca\.markets\/|https:\/\/api\.binance\.com|\bwithdraw\s*\(/i);
const sim=readFileSync('lib/platform/connections/b185-paper-simulator.mjs','utf8');
assert.ok(sim.includes('ordersSent:0')&&sim.includes('networkCalls:0'),'SIMULATION_TRANSPORT_DRIFT');
const replay=readFileSync('lib/platform/connections/b186-ledger-replay.mjs','utf8');
assert.ok(replay.includes('FRESH_RESERVED_INTENT_REQUIRED')&&replay.includes('ordersSent:0'),'REPLAY_GUARD_DRIFT');
console.log('B187_CUMULATIVE_SCOPE_PASS: B184 fixed at 13 additions, B185-B189 at '+additionsAfterB184.length+' additions; B177 immutable; no real order route.');
