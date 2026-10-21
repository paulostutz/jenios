/** B260: source-wide allowlist against certified B250; no existing program may drift. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,existsSync} from 'node:fs';
const BASE='84f111314745bf6d649cdfedf71c796c4e448fed';
const ADD=[
 'lib/platform/release260/b251-ci-receipt.mjs',
 'lib/platform/release260/b252-private-review-http.mjs',
 'app/api/platform/homologacao/readiness/route.js',
 'lib/platform/release260/b253-preview-acceptance.mjs',
 'tests/platformB251B253ReleasePreview.test.mjs',
 'lib/platform/release260/b254-payment-sandbox.mjs',
 'lib/platform/release260/b255-idempotency-sandbox.mjs',
 'tests/platformB254B255BillingSandbox.test.mjs',
 'lib/platform/release260/b256-customer-broker-audit.mjs',
 'lib/platform/release260/b257-risk-incident-triage.mjs',
 'tests/platformB256B257BrokerRisk.test.mjs',
 'lib/platform/release260/b258-signed-prospective-intake.mjs',
 'tests/platformB258SignedProspectiveIntake.test.mjs',
 'lib/platform/release260/b259-final-release-committee.mjs',
 'tests/platformB259FinalLaunchCommittee.test.mjs',
 'docs/platform/B251-B260-PRIVATE-RELEASE-QA.md',
 'scripts/platform/release260/b260-offline-final.mjs',
 'tests/platformB260IntegratedReleaseGuard.test.mjs',
 'scripts/platform/release260/b260-integrity.mjs',
 '.github/workflows/jenios-b260-private-launch-acceptance.yml'
];
const diff=execFileSync('git',['diff','--no-renames','--name-status',BASE,'HEAD'],{encoding:'utf8'}).trim();
const rows=diff.split('\n').filter(Boolean).map(x=>x.split('\t'));
assert.equal(rows.length,ADD.length,'B260_UNEXPECTED_CHANGE_COUNT');
assert.deepEqual(rows.map(r=>r[1]).sort(),[...ADD].sort(),'B260_UNEXPECTED_FILE');
for(const [status,path] of rows)assert.equal(status,'A','B260_NON_ADDITIVE '+path);
for(const path of [
 'package.json','package-lock.json','app/platform/homologacao/page.js',
 'app/api/platform/checkout/route.js','app/api/platform/broker-connections/route.js',
 'lib/pay/checkout.mjs','lib/pay/inter-pix.mjs','lib/platform/trial/person-ledger.mjs',
 'lib/platform/pilot-prep/paper-ledger.mjs',
 'lib/platform/connections/alpaca-paper-private-executor.mjs',
 'lib/platform/connections/demo-vault.mjs',
 'lib/platform/connections/demo-broker-reader.mjs',
 'app/integracoes/page.js','app/components/platform/DemoBrokerConnector.js',
 '.github/workflows/jenios-b250-consolidated-qa.yml']){
 const original=execFileSync('git',['show',BASE+':'+path]);
 assert.ok(readFileSync(path).equals(original),'B250_PROTECTED_DRIFT '+path);
}
for(const path of [
 'app/api/platform/broker-execution/route.js',
 'app/api/platform/live-trading/route.js',
 'app/api/platform/paper-execution/route.js',
 'app/api/platform/private-observer/route.js',
 'nucleo-privado/engine.mjs'])assert.equal(existsSync(path),false,'PROHIBITED_TRADING_ROUTE');
const route=readFileSync('app/api/platform/homologacao/readiness/route.js','utf8');
assert.match(route,/privateReadinessHttp/);assert.match(route,/getJeniosPlatformAdmin/);
assert.match(route,/requirePlatformAdmin/);assert.doesNotMatch(route,/export async function POST/);
const guard=readFileSync('lib/platform/release260/b252-private-review-http.mjs','utf8');
assert.match(guard,/env\?\.VERCEL_ENV!=='preview'/);assert.match(guard,/env\?\.JENIOS_QA_ADMIN_READONLY_ENABLED!=='true'/);
for(const path of ADD.filter(p=>p.startsWith('lib/platform/release260/')||p.startsWith('scripts/platform/release260/'))){
 const code=readFileSync(path,'utf8');assert.doesNotMatch(code,/https:\/\/api\.alpaca\.markets|https:\/\/api\.binance\.com|\bwithdraw\s*\(/i);
}
console.log('B260_B250_SOURCE_FROZEN_PASS: 20 exclusively additive QA paths; no payment/broker/proprietary-core changes');
