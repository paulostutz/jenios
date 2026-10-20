/** B200 — freeze the certified B195 and permit only declared private-QA additions.
 * Enforces a strict additive allowlist across the entire repository, not just named modules.
 */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,existsSync} from 'node:fs';
const BASE='5d62ac2ac965ea585e4423bdacf8c212ec703892';
const ADD=[
 'lib/platform/connections/b196-private-account-preflight.mjs',
 'lib/platform/connections/b197-independent-order-observations.mjs',
 'lib/platform/connections/b198-protection-watchdog.mjs',
 'lib/platform/b199-release-readiness-matrix.mjs',
 'tests/platformB196PrivateAccountPreflight.test.mjs',
 'tests/platformB197PairedPaperReads.test.mjs',
 'tests/platformB198ProtectionWatchdog.test.mjs',
 'tests/platformB199ReleaseMatrix.test.mjs',
 'docs/platform/B196-B200-PILOT-RELEASE-PREPARATION.md',
 'scripts/platform/connections/b200-integrity.mjs',
 '.github/workflows/jenios-b200-release-pilot.yml'
];
const diff=execFileSync('git',['diff','--no-renames','--name-status',BASE,'HEAD'],{encoding:'utf8'});
const rows=diff.trim().split('\n').filter(Boolean).map(v=>v.split('\t'));
assert.equal(rows.length,ADD.length,'B200_UNEXPECTED_CHANGE_COUNT');
assert.deepEqual(rows.map(x=>x[1]).sort(),[...ADD].sort(),'B200_UNEXPECTED_PATHS');
for(const [kind,file] of rows)assert.equal(kind,'A','B200_NON_ADDITIVE '+file);
for(const file of [
 'package.json','package-lock.json','lib/platform/pilot-prep/paper-ledger.mjs',
 'lib/platform/pilot-prep/risk.mjs','lib/platform/connections/alpaca-paper-private-executor.mjs',
 'lib/platform/connections/demo-service.mjs','lib/platform/connections/demo-vault.mjs',
 'lib/platform/connections/b190-customer-activation.mjs',
 'lib/platform/connections/b191-private-recovery-runbook.mjs',
 'lib/platform/connections/b192-adversarial-paper-replay.mjs',
 'lib/platform/connections/b193-paper-protection-gate.mjs',
 'lib/platform/connections/b194-performance-acceptance.mjs',
 'app/components/platform/DemoBrokerConnector.js','app/integracoes/page.js',
 'app/api/platform/checkout/route.js',
 '.github/workflows/jenios-b195-customer-paper.yml']){
 const baseFile=execFileSync('git',['show',BASE+':'+file]);
 assert.ok(readFileSync(file).equals(baseFile),'B195_PROTECTED_DRIFT '+file);
}
const marks=[
 ['lib/platform/connections/b196-private-account-preflight.mjs',
  ['PRIVATE_READ_ONLY_PREFLIGHT_DISABLED','brokerPermissionsVerified:false','paperOrderPermission:false','ordersSent:0']],
 ['lib/platform/connections/b197-independent-order-observations.mjs',
  ['independentExternalWitnessCertified:false','orderStateCommitted:false','automaticOrderRetryAllowed:false']],
 ['lib/platform/connections/b198-protection-watchdog.mjs',
  ['stopExecutionGuaranteed:false','locallyPausedByThisCheck:false','ordersSent:0']],
 ['lib/platform/b199-release-readiness-matrix.mjs',
  ['productionPromotionAuthorized:false','liveExecutionAuthorized:false','paymentsCharged:0']]
];
for(const [path,requirements] of marks){const source=readFileSync(path,'utf8');
 for(const mark of requirements)assert.ok(source.includes(mark),'B200_MISSING_SAFETY '+path+' '+mark);
 assert.doesNotMatch(source,/https:\/\/api\.alpaca\.markets\/|https:\/\/api\.binance\.com|\bwithdraw\s*\(/i);
}
assert.equal(existsSync('nucleo-privado/engine.mjs'),false,'PRIVATE_ENGINE_EXPOSED');
assert.equal(existsSync('app/api/platform/broker-execution/route.js'),false,'PUBLIC_ORDER_SENDER_ADDED');
console.log('B200_CERTIFIED_B195_FROZEN='+BASE+'; B196-B200 '+ADD.length+' additive paths; no execution, payments or production changes');
