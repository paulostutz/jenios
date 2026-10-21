/** B270 freeze B265-R7 certified public/trading/payment code. The only extension
 * is 36 source links, review status and research triage (no order transport).
 */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,existsSync} from 'node:fs';
import {USER_VIDEO_RESOURCES} from '../../../lib/learning/trade-video-resources.mjs';
import {SUPPLEMENTAL_TRADE_VIDEO_RESOURCES} from '../../../lib/learning/trade-video-supplement-20261021.mjs';
const BASE='f47c6db0a124b073006b96b3fa8c2c958101489b';
const modified=[
 'lib/learning/trade-video-resources.mjs',
 'app/components/learning/LearningRoom.js',
 'tests/jeniosUniversityFreeTracksVideoB261.test.mjs'
];
const added=[
 'lib/learning/trade-video-supplement-20261021.mjs',
 'lib/platform/research/b267-video-evidence-triage.mjs',
 'tests/jeniosTradeVideosSupplementB266.test.mjs',
 'docs/learning/B266-B267-TRADE-VIDEO-REFERENCES.md',
 'scripts/platform/learning/b270-integrity.mjs',
 '.github/workflows/jenios-b270-video-library.yml'
];
const changed=execFileSync('git',['diff','--no-renames','--name-status',BASE,'HEAD'],{encoding:'utf8'})
 .trim().split('\n').filter(Boolean).map(v=>v.split('\t'));
assert.equal(changed.length,modified.length+added.length,'B270_UNEXPECTED_SCOPE_COUNT');
assert.deepEqual(changed.map(x=>x[1]).sort(),[...modified,...added].sort(),'B270_UNEXPECTED_CHANGED_FILE');
for(const [status,path] of changed)assert.equal(status,modified.includes(path)?'M':'A','B270_NON_ADDITIVE '+path);
for(const path of [
 'lib/learning/engine.mjs','lib/learning/access.mjs','lib/learning/service.mjs',
 'lib/learning/catalog.mjs','lib/learning/question-bank.mjs','lib/learning/tutor.mjs',
 'lib/platform/research/trading-video-hypotheses.mjs',
 'lib/platform/pilot-prep/paper-ledger.mjs',
 'lib/platform/connections/alpaca-paper-private-executor.mjs',
 'lib/platform/connections/demo-vault.mjs','lib/pay/checkout.mjs',
 'lib/pay/inter-pix.mjs','app/api/platform/learning/route.js',
 'app/api/platform/broker-connections/route.js',
 'app/api/jenios-pay/checkout/route.js','app/universidade/page.js',
 'package.json','package-lock.json','app/social/page.js'
])assert.ok(readFileSync(path).equals(execFileSync('git',['show',BASE+':'+path])),
 'B265_PROTECTED_CODE_DRIFT '+path);
for(const p of ['app/api/platform/broker-execution/route.js','app/api/platform/live-trading/route.js',
 'app/api/platform/paper-execution/route.js','nucleo-privado/engine.mjs'])
 assert.equal(existsSync(p),false,'B270_PUBLIC_ORDER_SURFACE_FORBIDDEN '+p);
assert.equal(USER_VIDEO_RESOURCES.length,56);
assert.equal(new Set(USER_VIDEO_RESOURCES.map(x=>x.id)).size,56);
assert.equal(SUPPLEMENTAL_TRADE_VIDEO_RESOURCES.length,36);
assert.ok(SUPPLEMENTAL_TRADE_VIDEO_RESOURCES.every(x=>x.verification==='needs_video_review'&&
 x.channel===null&&x.trackId==='biblioteca'));
for(const f of [...added.filter(x=>x.endsWith('.mjs')),'lib/learning/trade-video-resources.mjs']){
 const s=readFileSync(f,'utf8');
 assert.doesNotMatch(s,/https:\/\/api\.alpaca\.markets|https:\/\/api\.binance\.com|\bwithdraw\s*\(|\bfetch\s*\(/i);
}
const ui=readFileSync('app/components/learning/LearningRoom.js','utf8');
assert.match(ui,/allResources\.length/);
assert.match(ui,/conteúdo a conferir/);
assert.doesNotMatch(ui,/start_quiz|submit_quiz|localStorage/);
console.log('B270_VIDEO_CATALOG_SCOPE_PASS 36 new unverified links; 56 total, original core, PAY and access unchanged');
