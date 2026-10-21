/** B281 immutable B280 check: exactly seven additive source/evidence files.
 * No change to University, engines, authentication, social, payments or brokers.
 */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,existsSync} from 'node:fs';
import {auditB281OriginalSeal,B281_B280_ANCHOR}
 from '../../../lib/platform/research/b281-first-hour-observation.mjs';
const BASE='e5c9671c3e926b380cef91ba5f21c22d59ac22de';
const eligible=[
 'docs/platform/evidence/B280_FORWARD_HOUR_SEALED_SNAPSHOT.json',
 'lib/platform/research/b281-first-hour-observation.mjs',
 'scripts/platform/research/b281-observe-original-hour.mjs',
 'tests/platformB281FirstHourObservation.test.mjs',
 'scripts/platform/research/b281-integrity.mjs',
 'docs/platform/B281-FIRST-FORWARD-HOUR-ACCEPTANCE.md',
 '.github/workflows/jenios-b281-first-hour.yml'
].sort();
const changes=execFileSync('git',['diff','--name-status','--no-renames',BASE,'HEAD'],{encoding:'utf8'})
 .trim().split('\n').filter(Boolean).map(row=>row.split('\t'));
assert.deepEqual(changes.map(([,path])=>path).sort(),eligible,'B281_OUT_OF_SCOPE_CHANGE');
for(const [kind,path] of changes)assert.equal(kind,'A','B281_MUTATION_NOT_ALLOWED '+path);
const protectedSources=[
 'package.json','package-lock.json',
 'lib/platform/research/b280-forward-protocol.mjs',
 'lib/platform/research/b280-statistical-gate.mjs',
 'lib/platform/research/b279-retrospective-replay.mjs',
 'lib/platform/research/b278-historical-ingest.mjs',
 'lib/platform/research/b272-walkforward-lab.mjs',
 'lib/platform/research/trading-video-hypotheses.mjs',
 'scripts/platform/research/b280-capture-future-hour.mjs',
 'scripts/platform/research/b279-run-real-replay.mjs',
 'lib/platform/prospective-cohort.mjs','lib/platform/prospective-observation.mjs',
 'lib/platform/launch/b226-prospective-witness-review.mjs',
 'lib/platform/pilot-prep/paper-ledger.mjs',
 'lib/platform/connections/alpaca-paper-private-executor.mjs',
 'lib/platform/connections/demo-vault.mjs',
 'lib/pay/checkout.mjs','lib/pay/inter-pix.mjs',
 'lib/learning/catalog.mjs','lib/learning/engine.mjs',
 'lib/learning/service.mjs','lib/learning/access.mjs',
 'app/platform/aprender/page.js','app/universidade/page.js','app/social/page.js',
 'app/components/learning/LearningRoom.js','app/components/learning/LessonVisual.js',
 'app/api/platform/learning/route.js',
 'app/api/platform/market-observation/route.js',
 'app/api/platform/broker-connections/route.js',
 'app/api/jenios-pay/checkout/route.js'
];
for(const path of protectedSources)
 assert.ok(readFileSync(path).equals(execFileSync('git',['show',BASE+':'+path])),
  'B281_PROTECTED_BASELINE_DRIFT '+path);
for(const p of [
 'app/api/platform/live-trading/route.js',
 'app/api/platform/broker-execution/route.js',
 'app/api/platform/paper-execution/route.js',
 'nucleo-privado/engine.mjs'
])assert.equal(existsSync(p),false,'B281_PROHIBITED_ORDER_ENDPOINT '+p);
const snapshot=JSON.parse(readFileSync('docs/platform/evidence/B280_FORWARD_HOUR_SEALED_SNAPSHOT.json','utf8'));
assert.equal(auditB281OriginalSeal(snapshot).valid,true);
assert.equal(snapshot.sealedResearch.githubCommit,BASE);
assert.equal(snapshot.sealedResearch.sealSha256,B281_B280_ANCHOR.sealSha256);
assert.equal(snapshot.sealedResearch.targetCandleOpenMs,B281_B280_ANCHOR.targetOpenMs);
assert.equal(snapshot.sealedResearch.targetCandleEndMs,B281_B280_ANCHOR.targetCloseMs);
const source=readFileSync('lib/platform/research/b281-first-hour-observation.mjs','utf8');
const runner=readFileSync('scripts/platform/research/b281-observe-original-hour.mjs','utf8');
assert.match(source,/minimumObservationAtMs/);
assert.match(source,/B281_TOO_EARLY_TO_READ_TARGET/);
assert.match(source,/ONE_HOUR_DESCRIPTIVE_STUDY_ONLY/);
assert.match(source,/statisticalAdvantageCertified:false/);
assert.match(source,/PENDING_TARGET_CANDLE_CLOSE/);
assert.match(runner,/networkRequestsMade:0/);
assert.match(runner,/realOutcomeRetrieved:false/);
for(const f of [source,runner])assert.doesNotMatch(f,
 /api\.binance|api\.alpaca|submitOrder|createOrder|withdraw|checkout|paymentIntent/);
assert.doesNotMatch(source,/\bprocess\.env\b/);
console.log('B281_PRESERVATION_PASS 7 additive files, B280 archive intact and all production/trading/payment modules unchanged');
