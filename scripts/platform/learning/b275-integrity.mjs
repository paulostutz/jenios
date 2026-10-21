/** B275: enforce additive B271-B275 scope after the B270 frozen checkpoint. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,existsSync} from 'node:fs';
const BASE='db51ea187b04aae1f90e1251f836ceed75cc7937';
const allowed=new Map([
 ['app/components/learning/LearningRoom.js','M'],
 ['lib/learning/trade-study-workshops-b271.mjs','A'],
 ['lib/platform/research/b272-walkforward-lab.mjs','A'],
 ['tests/jeniosB271B275LearningResearch.test.mjs','A'],
 ['docs/learning/B271-B275-UNIVERSIDADE-LAB.md','A'],
 ['scripts/platform/learning/b275-integrity.mjs','A'],
 ['.github/workflows/jenios-b275-university-research.yml','A']
]);
const rows=execFileSync('git',['diff','--name-status','--no-renames',BASE,'HEAD'],{encoding:'utf8'}).trim().split('\n').filter(Boolean).map(x=>x.split('\t'));
assert.equal(rows.length,allowed.size,'B275_SCOPE_SIZE_CHANGED');
assert.deepEqual(rows.map(x=>x[1]).sort(),[...allowed.keys()].sort(),'B275_UNEXPECTED_FILES');
for(const [status,path] of rows)assert.equal(status,allowed.get(path),'B275_INVALID_FILE_STATUS '+path);
for(const path of [
 'lib/learning/catalog.mjs','lib/learning/engine.mjs','lib/learning/service.mjs',
 'lib/learning/access.mjs','lib/learning/trade-video-resources.mjs',
 'lib/learning/trade-video-supplement-20261021.mjs',
 'lib/platform/research/trading-video-hypotheses.mjs',
 'lib/platform/pilot-prep/paper-ledger.mjs',
 'lib/platform/connections/alpaca-paper-private-executor.mjs',
 'lib/platform/connections/demo-vault.mjs',
 'lib/pay/checkout.mjs','lib/pay/inter-pix.mjs','app/universidade/page.js',
 'app/api/platform/learning/route.js','app/api/platform/broker-connections/route.js',
 'app/api/jenios-pay/checkout/route.js','app/social/page.js',
 'package.json','package-lock.json']){
 assert.ok(readFileSync(path).equals(execFileSync('git',['show',BASE+':'+path])), 'B275_PROTECTED_CHANGED '+path);
}
for(const path of ['app/api/platform/broker-execution/route.js','app/api/platform/live-trading/route.js',
 'app/api/platform/paper-execution/route.js','nucleo-privado/engine.mjs'])
 assert.equal(existsSync(path),false,'B275_LIVE_ORDER_ROUTE_NOT_ALLOWED '+path);
for(const path of ['lib/learning/trade-study-workshops-b271.mjs','lib/platform/research/b272-walkforward-lab.mjs']){
 const content=readFileSync(path,'utf8');
 assert.doesNotMatch(content,/\bfetch\s*\(|\bwithdraw\s*\(|https:\/\/api\.(binance|alpaca)|\bprocess\.env\b/);
}
const ui=readFileSync('app/components/learning/LearningRoom.js','utf8');
assert.match(ui,/PRACTICAL_STUDY_WORKSHOPS/);
assert.match(ui,/Oficinas práticas opcionais/);
assert.doesNotMatch(ui,/start_quiz|submit_quiz|QUESTION_BANK|localStorage/);
console.log('B275_SCOPE_PASS 7 files, 15 existing lessons intact, no trading or payment changes');
