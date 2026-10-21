/** B280 immutable B279 protection: only future research contracts and CI.
 * Any change in proprietary kernels, operations, payments or University fails.
 */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,existsSync} from 'node:fs';
import {B280_FROZEN_PROTOCOL,B280_EXPECTED_SCENE_COUNT} from '../../../lib/platform/research/b280-forward-protocol.mjs';
import {B280_RESEARCH_ACCEPTANCE_GATES} from '../../../lib/platform/research/b280-statistical-gate.mjs';
const BASE='fb9441d3485d0c825cd3e7705c3de33fb1e74515';
const authorized=[
 '.github/workflows/jenios-b280-forward-research.yml',
 'docs/platform/B280-PROSPECTIVE-PROTOCOL.md',
 'lib/platform/research/b280-forward-protocol.mjs',
 'lib/platform/research/b280-statistical-gate.mjs',
 'scripts/platform/research/b280-capture-future-hour.mjs',
 'scripts/platform/research/b280-integrity.mjs',
 'tests/platformB280ForwardProtocol.test.mjs'
].sort();
const changed=execFileSync('git',['diff','--name-status','--no-renames',BASE,'HEAD'],{encoding:'utf8'})
 .trim().split('\n').filter(Boolean).map(x=>x.split('\t'));
assert.deepEqual(changed.map(([,p])=>p).sort(),authorized,'B280_SCOPE_VIOLATION');
for(const [status,path] of changed)assert.equal(status,'A','B280_RESEARCH_MUST_ONLY_ADD '+path);
for(const path of [
 'package.json','package-lock.json',
 'lib/platform/research/b278-historical-ingest.mjs',
 'lib/platform/research/b279-retrospective-replay.mjs',
 'lib/platform/research/b272-walkforward-lab.mjs',
 'lib/platform/research/trading-video-hypotheses.mjs',
 'scripts/platform/research/b279-run-real-replay.mjs',
 'scripts/platform/research/b278-public-capture.mjs',
 'lib/platform/public-market-candles.mjs','lib/platform/historical-quality.mjs',
 'lib/platform/pilot-prep/paper-ledger.mjs',
 'lib/platform/connections/alpaca-paper-private-executor.mjs',
 'lib/platform/connections/demo-vault.mjs',
 'lib/platform/prospective-cohort.mjs',
 'lib/platform/prospective-observation.mjs',
 'lib/platform/launch/b226-prospective-witness-review.mjs',
 'lib/pay/checkout.mjs','lib/pay/inter-pix.mjs',
 'lib/learning/catalog.mjs','lib/learning/engine.mjs',
 'lib/learning/service.mjs','lib/learning/access.mjs',
 'app/platform/aprender/page.js','app/universidade/page.js',
 'app/components/learning/LearningRoom.js','app/components/learning/LessonVisual.js',
 'app/social/page.js',
 'app/api/platform/learning/route.js','app/api/platform/market-observation/route.js',
 'app/api/platform/broker-connections/route.js','app/api/jenios-pay/checkout/route.js'
])assert.ok(readFileSync(path).equals(execFileSync('git',['show',BASE+':'+path])),
 'B280_PROTECTED_FILE_CHANGED '+path);
for(const path of [
 'app/api/platform/live-trading/route.js',
 'app/api/platform/broker-execution/route.js',
 'app/api/platform/paper-execution/route.js',
 'nucleo-privado/engine.mjs'
])assert.equal(existsSync(path),false,'B280_NEW_ORDER_ENDPOINT_FORBIDDEN '+path);
assert.equal(B280_FROZEN_PROTOCOL.parentCommit,BASE);
assert.equal(B280_FROZEN_PROTOCOL.quoteCurrency,'USD');
assert.equal(B280_FROZEN_PROTOCOL.source,'coinbase_exchange_public_spot_candles');
assert.equal(B280_FROZEN_PROTOCOL.minimumLeadMs,600000);
assert.equal(B280_EXPECTED_SCENE_COUNT,18);
assert.equal(B280_RESEARCH_ACCEPTANCE_GATES.minimumCalendarDays,30);
assert.equal(B280_RESEARCH_ACCEPTANCE_GATES.signedIndependentMarketDataRequired,true);
const source=readFileSync('lib/platform/research/b280-forward-protocol.mjs','utf8');
const gate=readFileSync('lib/platform/research/b280-statistical-gate.mjs','utf8');
const runner=readFileSync('scripts/platform/research/b280-capture-future-hour.mjs','utf8');
for(const text of [source,gate,runner])assert.doesNotMatch(text,
 /api\.binance|api\.alpaca|submitOrder|createOrder|withdraw|paymentIntent|checkout|orders\/create/i);
for(const text of [source,gate])assert.doesNotMatch(text,
 /\bfetch\s*\(|\bXMLHttpRequest\b|\bprocess\.env\b/i);
assert.match(runner,/GITHUB_SHA/);assert.match(runner,/GITHUB_RUN_ID/);
assert.match(runner,/FAIL_CLOSED_NO_PROSPECTIVE_PREDICTIONS/);
assert.match(runner,/statisticalSampleSize:0/);
console.log('B280_SCOPE_PASS 7 research-only additions, B279/B278/Platform/University/robots/PAY unchanged, no real orders');
