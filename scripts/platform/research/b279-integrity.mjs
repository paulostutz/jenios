/** B279 freeze B278 codebase: authorize offline retrospective replay only.
 * Fail any added payment, broker, production, learning or proprietary change.
 */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {existsSync,readFileSync} from 'node:fs';
import {
 B279_FROZEN_B278_REFERENCE,B279_FROZEN_PROTOCOL,B279_HYPOTHESES,B279_MODES
} from '../../../lib/platform/research/b279-retrospective-replay.mjs';
const BASE='e96a98486cd07b8ee8b264f32c2c8f97c77e9958';
const files=[
 '.github/workflows/jenios-b279-historical-replay.yml',
 'docs/platform/B279-RETROSPECTIVE-OFFLINE-REPLAY.md',
 'lib/platform/research/b279-retrospective-replay.mjs',
 'scripts/platform/research/b279-run-real-replay.mjs',
 'scripts/platform/research/b279-integrity.mjs',
 'tests/platformB279RetrospectiveReplay.test.mjs'
].sort();
const rows=execFileSync('git',['diff','--name-status','--no-renames',BASE,'HEAD'],{encoding:'utf8'})
 .trim().split('\n').filter(Boolean).map(x=>x.split('\t'));
assert.deepEqual(rows.map(x=>x[1]).sort(),files,'B279_UNEXPECTED_SCOPE');
for(const [type,path] of rows)assert.equal(type,'A','B279_ONLY_NEW_RESEARCH_FILES '+path);
for(const path of [
 'package.json','package-lock.json',
 'lib/platform/research/b272-walkforward-lab.mjs',
 'lib/platform/research/b278-historical-ingest.mjs',
 'scripts/platform/research/b278-public-capture.mjs',
 'app/platform/aprender/page.js','app/universidade/page.js','app/social/page.js',
 'app/components/learning/LearningRoom.js',
 'lib/learning/catalog.mjs','lib/learning/engine.mjs',
 'lib/pay/checkout.mjs','lib/pay/inter-pix.mjs',
 'lib/platform/pilot-prep/paper-ledger.mjs',
 'lib/platform/connections/alpaca-paper-private-executor.mjs',
 'lib/platform/connections/demo-vault.mjs',
 'app/api/platform/learning/route.js',
 'app/api/platform/market-observation/route.js',
 'app/api/platform/broker-connections/route.js',
 'app/api/jenios-pay/checkout/route.js'
]){
 assert.ok(readFileSync(path).equals(execFileSync('git',['show',BASE+':'+path])),
  'B279_PREEXISTING_CODE_CHANGED '+path);
}
for(const path of [
 'app/api/platform/live-trading/route.js',
 'app/api/platform/broker-execution/route.js',
 'app/api/platform/paper-execution/route.js',
 'nucleo-privado/engine.mjs'
])assert.equal(existsSync(path),false,'B279_ORDER_SURFACE_FORBIDDEN '+path);
assert.equal(B279_FROZEN_B278_REFERENCE.b278Commit,BASE);
assert.equal(B279_FROZEN_B278_REFERENCE.b278RunId,39617307059);
assert.equal(B279_FROZEN_B278_REFERENCE.frozenSha256Rows.length,3);
assert.deepEqual(B279_HYPOTHESES,['EMA_CONTEXT_V1','CLOSED_BREAKOUT_V1']);
assert.deepEqual(B279_MODES,['direct','reverse','hybrid']);
assert.equal(B279_FROZEN_PROTOCOL.quoteCurrency,'USD');
assert.equal(B279_FROZEN_PROTOCOL.originalRobotCodeUsed,false);
assert.equal(B279_FROZEN_PROTOCOL.preRegisteredBeforeHistoricalHoldout,false);
assert.equal(B279_FROZEN_PROTOCOL.trainingBars+B279_FROZEN_PROTOCOL.embargoBars+B279_FROZEN_PROTOCOL.holdoutBars,960);
for(const path of ['lib/platform/research/b279-retrospective-replay.mjs','scripts/platform/research/b279-run-real-replay.mjs']){
 const content=readFileSync(path,'utf8');
 assert.doesNotMatch(content,/api\.alpaca|api\.binance|createOrder|submitOrder|withdraw|checkout|paymentIntent/);
 if(path.startsWith('lib/'))assert.doesNotMatch(content,/\bfetch\s*\(|\bXMLHttpRequest\b|\bprocess\.env\b/);
}
console.log('B279_SOURCE_SCOPE_PASS exactly 6 additive research files, B278 and University/social/robot/PAY preserved');
