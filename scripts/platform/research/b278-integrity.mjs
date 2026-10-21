/** B278 immutable B277 boundary: research intake + tests + documentation ONLY. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,existsSync} from 'node:fs';
import {B278_PRODUCTS,B278_TARGET_HOURLY_CANDLES} from '../../../lib/platform/research/b278-historical-ingest.mjs';
const BASE='485d7f78ba10b5a4b7a17f400c58cb0eac79c6d2';
const allow=new Map([
 ['lib/platform/research/b278-historical-ingest.mjs','A'],
 ['scripts/platform/research/b278-public-capture.mjs','A'],
 ['scripts/platform/research/b278-integrity.mjs','A'],
 ['tests/platformB278HistoricalIngest.test.mjs','A'],
 ['docs/platform/B278-HISTORICAL-DATA-QUALITY.md','A'],
 ['.github/workflows/jenios-b278-historical-data.yml','A']
]);
const diff=execFileSync('git',['diff','--name-status','--no-renames',BASE,'HEAD'],{encoding:'utf8'})
 .trim().split('\n').filter(Boolean).map(row=>row.split('\t'));
assert.equal(diff.length,allow.size,'B278_WRONG_SCOPE_SIZE');
assert.deepEqual(diff.map(x=>x[1]).sort(),[...allow.keys()].sort(),'B278_UNEXPECTED_FILE');
for(const [status,path] of diff)assert.equal(status,allow.get(path),'B278_UNEXPECTED_ACTION '+path);
for(const path of [
 'app/components/learning/LearningRoom.js','app/components/learning/LearningRoom.module.css',
 'app/components/learning/LessonVisual.js',
 'app/universidade/page.js','app/platform/aprender/page.js','app/social/page.js',
 'lib/learning/catalog.mjs','lib/learning/engine.mjs','lib/learning/service.mjs',
 'lib/learning/repository.mjs','lib/learning/access.mjs',
 'lib/learning/b277-video-evidence.mjs','lib/learning/b277-guided-trade-studies.mjs',
 'lib/learning/trade-video-resources.mjs','lib/learning/trade-video-supplement-20261021.mjs',
 'lib/learning/lesson-visual-scenes-b276.mjs','lib/learning/trade-study-workshops-b271.mjs',
 'lib/platform/public-market-candles.mjs','lib/platform/market-study.mjs',
 'lib/platform/historical-quality.mjs',
 'lib/platform/research/b272-walkforward-lab.mjs',
 'lib/platform/research/trading-video-hypotheses.mjs',
 'lib/platform/pilot-prep/paper-ledger.mjs',
 'lib/platform/connections/alpaca-paper-private-executor.mjs',
 'lib/platform/connections/demo-vault.mjs',
 'lib/pay/checkout.mjs','lib/pay/inter-pix.mjs',
 'app/api/platform/learning/route.js',
 'app/api/platform/market-observation/route.js',
 'app/api/platform/broker-connections/route.js',
 'app/api/jenios-pay/checkout/route.js','package.json','package-lock.json'
])assert.ok(readFileSync(path).equals(execFileSync('git',['show',BASE+':'+path])), 'B278_PROTECTED_SOURCE_CHANGED '+path);
for(const route of [
 'app/api/platform/live-trading/route.js',
 'app/api/platform/broker-execution/route.js',
 'app/api/platform/paper-execution/route.js','nucleo-privado/engine.mjs'
])assert.equal(existsSync(route),false,'B278_PUBLIC_ORDER_ROUTE_FORBIDDEN '+route);
assert.deepEqual(B278_PRODUCTS.map(x=>x.id),['BTC-USD','ETH-USD','SOL-USD']);
assert.ok(B278_PRODUCTS.every(x=>x.quoteCurrency==='USD'&&x.unmappedRobotSymbol.endsWith('USDT')));
assert.equal(B278_TARGET_HOURLY_CANDLES,960);
const intake=readFileSync('lib/platform/research/b278-historical-ingest.mjs','utf8');
const collector=readFileSync('scripts/platform/research/b278-public-capture.mjs','utf8');
assert.match(intake,/https:\/\/api\.exchange\.coinbase\.com/);
assert.match(intake,/method:'GET'/);
assert.match(intake,/B278_PROVIDER_MISSING_CANDLE/);
assert.match(intake,/canMapToUsdtRobot:false/);
assert.match(collector,/rawMarketCandlesArchived:false/);
assert.match(collector,/FAILED_CLOSED_NO_THREE_ASSET_ATTESTATION/);
for(const content of [intake,collector])assert.doesNotMatch(content,
 /api\.alpaca\.markets|api\.binance\.com|orders\/create|withdraw|secretKey|checkout|paymentIntent|\bPOST\b/i);
console.log('B278_SCOPE_PASS 6 new files, B277 and B276 UI/robot/PAY preserved, BTC-USD ETH-USD SOL-USD research only');
