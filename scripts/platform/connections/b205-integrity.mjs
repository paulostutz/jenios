/** B205: preserve the certified B200 exactly and admit only explicit QA additions.
 * Never changes the proprietary robot core, Vercel production, PAY or Social.
 */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {existsSync,readFileSync} from 'node:fs';
const BASE='3121ab13c6de8dfc11ddf7d38f496d454ca2caa1';
const ADD=[
 'lib/platform/connections/b201-private-paired-paper-reader.mjs',
 'lib/platform/connections/b202-paper-ledger-outbox-audit.mjs',
 'lib/platform/connections/b203-private-restart-inventory.mjs',
 'lib/platform/connections/b204-redacted-paper-review.mjs',
 'tests/platformB201PrivatePaperReader.test.mjs',
 'tests/platformB202B203PrivateRecoveryAudit.test.mjs',
 'tests/platformB204RedactedPaperReview.test.mjs',
 'tests/platformB205PrivateObserverChain.test.mjs',
 'docs/platform/B201-B205-PRIVATE-PAPER-OBSERVATION.md',
 'scripts/platform/connections/b205-integrity.mjs',
 '.github/workflows/jenios-b205-private-observer.yml'
];
const changes=execFileSync('git',['diff','--no-renames','--name-status',BASE,'HEAD'],{encoding:'utf8'})
 .trim().split('\n').filter(Boolean).map(line=>line.split('\t'));
assert.equal(changes.length,ADD.length,'B205_UNEXPECTED_CHANGED_FILE_COUNT');
assert.deepEqual(changes.map(x=>x[1]).sort(),[...ADD].sort(),'B205_UNEXPECTED_CHANGED_PATHS');
for(const [status,path] of changes)assert.equal(status,'A','B205_NON_ADDITIVE_FILE '+path);
for(const file of [
 'package.json','package-lock.json','lib/platform/pilot-prep/paper-ledger.mjs',
 'lib/platform/pilot-prep/risk.mjs','lib/platform/connections/alpaca-paper-private-executor.mjs',
 'lib/platform/connections/alpaca-paper-native-submit.mjs',
 'lib/platform/connections/alpaca-paper-dispatch-journal.mjs',
 'lib/platform/connections/alpaca-paper-dispatch-grant.mjs',
 'lib/platform/connections/demo-vault.mjs','lib/platform/connections/demo-broker-reader.mjs',
 'lib/platform/connections/b196-private-account-preflight.mjs',
 'lib/platform/connections/b197-independent-order-observations.mjs',
 'lib/platform/connections/b198-protection-watchdog.mjs',
 'lib/platform/b199-release-readiness-matrix.mjs',
 'lib/platform/connections/provider-paths.mjs',
 'app/components/platform/DemoBrokerConnector.js',
 'app/integracoes/page.js','app/api/platform/checkout/route.js',
 'app/api/jenios-pay/checkout/route.js','.github/workflows/jenios-b200-release-pilot.yml']){
 assert.ok(readFileSync(file).equals(execFileSync('git',['show',BASE+':'+file])),
  'B200_CERTIFIED_SOURCE_CHANGED '+file);
}
for(const [path,required] of [
 ['lib/platform/connections/b201-private-paired-paper-reader.mjs',
  ['ISOLATED_PAPER_READ_OBSERVER_DISABLED','method:\'GET\'','automaticResubmissionAllowed:false','independentlyAttested:false']],
 ['lib/platform/connections/b202-paper-ledger-outbox-audit.mjs',
  ['DURABLE_PAPER_STORES_REQUIRED','ledgerChanged:false','automaticOrderRetryAllowed:false']],
 ['lib/platform/connections/b203-private-restart-inventory.mjs',
  ['noAutomaticSubmissionAfterRestart:true','brokerOrdersCancelled:0','ordersSent:0']],
 ['lib/platform/connections/b204-redacted-paper-review.mjs',
  ['checksumIsDigitalSignature:false','productionReleaseAllowed:false','chargesCreated:0']]
]){
 const code=readFileSync(path,'utf8');
 for(const marker of required)assert.ok(code.includes(marker),'MISSING_B205_SAFETY_MARK '+path+' '+marker);
 assert.doesNotMatch(code,/method\s*:\s*['"](?:POST|PUT|PATCH|DELETE)['"]|https:\/\/api\.alpaca\.markets\/|\bwithdraw\s*\(/i,
  'UNAUTHORIZED_EXTERNAL_MUTATION_IN_NEW_CODE '+path);
}
for(const path of [
 'nucleo-privado/engine.mjs','app/api/platform/broker-execution/route.js',
 'app/api/platform/paper-execution/route.js','app/api/platform/live-trading/route.js'
])assert.equal(existsSync(path),false,'PRIVATE_CORE_OR_PUBLIC_SENDER_EXPOSED '+path);
console.log('B205_B200_SCOPE_PASS '+ADD.length+' additive QA files; B200 frozen; private observer GET only; no live money or payments');
