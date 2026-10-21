/** B250: fail-closed repository-wide additive scope, no secret-bearing or order endpoints. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,existsSync} from 'node:fs';
const base='162b256ecebfb7895aa1ca1e4256c93df938a9a0';
const allowed=[
 'lib/platform/release250/b231-public-release-gate.mjs',
 'app/platform/homologacao/page.js',
 'lib/platform/release250/b233-public-route-guard.mjs',
 'tests/platformB231B234PublicCandidate.test.mjs',
 'lib/platform/release250/b235-commercial-catalog.mjs',
 'lib/platform/release250/b236-sandbox-lifecycle.mjs',
 'lib/platform/release250/b237-trial-sandbox.mjs',
 'lib/platform/release250/b238-payer-binding.mjs',
 'tests/platformB235B238Commerce.test.mjs',
 'lib/platform/release250/b239-worker-host-gate.mjs',
 'tests/platformB239B240Host.test.mjs',
 'lib/platform/release250/b241-broker-status.mjs',
 'tests/platformB241B242OfficialBroker.test.mjs',
 'tests/platformB243Revocation.test.mjs',
 'lib/platform/release250/b243-revocation-observer.mjs',
 'tests/platformB244B245RiskIntegrity.test.mjs',
 'lib/platform/release250/b245-reconciliation-gate.mjs',
 'lib/platform/release250/b246-original-research-review.mjs',
 'lib/platform/release250/b247-prospective-review.mjs',
 'tests/platformB246B247OriginalResearch.test.mjs',
 'lib/platform/release250/b248-independent-release-tracks.mjs',
 'lib/platform/release250/b249-review-manifest.mjs',
 'scripts/platform/release250/b249-offline-release-report.mjs',
 'tests/platformB245B248B249FinalGates.test.mjs',
 'scripts/platform/release250/b250-integrity.mjs',
 '.github/workflows/jenios-b250-consolidated-qa.yml',
 'docs/platform/B231-B250-RELEASE-QA.md',
 'docs/platform/B250-ACCEPTANCE-CHECKLIST.md'
];
const diff=execFileSync('git',['diff','--no-renames','--name-status',base,'HEAD'],{encoding:'utf8'});
const changes=diff.trim().split('\n').filter(Boolean).map(x=>x.split('\t'));
assert.equal(changes.length,allowed.length,'B250_UNEXPECTED_CHANGE_COUNT');
assert.deepEqual(changes.map(([,f])=>f).sort(),[...allowed].sort(),'B250_UNEXPECTED_PATHS');
for(const [status,path] of changes)assert.equal(status,'A','B250_NON_ADDITIVE '+path);
for(const path of [
 'lib/platform/pilot-prep/paper-ledger.mjs','lib/platform/connections/alpaca-paper-private-executor.mjs',
 'lib/platform/connections/demo-broker-reader.mjs','lib/platform/connections/demo-vault.mjs',
 'lib/pay/checkout.mjs','lib/platform/trial/person-ledger.mjs','app/api/platform/checkout/route.js',
 'app/api/platform/broker-connections/route.js','app/integracoes/page.js',
 'app/components/platform/DemoBrokerConnector.js','package.json','package-lock.json',
 '.github/workflows/jenios-b230-release-candidate.yml'
]){
 const expected=execFileSync('git',['show',base+':'+path]);
 assert.ok(readFileSync(path).equals(expected),'B230_PROTECTED_FILE_CHANGED '+path);
}
for(const path of ['app/api/platform/broker-execution/route.js','app/api/platform/live-trading/route.js',
 'app/api/platform/paper-execution/route.js','app/api/platform/private-observer/route.js',
 'nucleo-privado/engine.mjs'])assert.equal(existsSync(path),false,'B250_PROHIBITED_FILE '+path);
const qa=readFileSync('app/platform/homologacao/page.js','utf8');
for(const fragment of ["process.env.VERCEL_ENV!=='preview'","process.env.JENIOS_QA_CANDIDATE_ENABLED!=='true'",'notFound()'])
 assert.ok(qa.includes(fragment),'B250_QA_PAGE_EXPOSED');
for(const path of allowed.filter(x=>x.startsWith('lib/platform/release250/')||x.startsWith('scripts/platform/release250/'))){
 const src=readFileSync(path,'utf8');
 assert.doesNotMatch(src,/\bfetch\s*\(|https:\/\/api\.alpaca\.markets|https:\/\/api\.binance\.com|\bwithdraw\s*\(/i,
  'B250_NEW_RUNTIME_NETWORK_OR_WITHDRAW '+path);
}
console.log('B250_B230_SCOPE_PASS: 27 new paths; original commercial, broker, risk, Social, Gênios, University and PAY protected');
