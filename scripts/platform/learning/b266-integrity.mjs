/** B266: additive research/curriculum enrichment only, preserving certified B265-R5 code. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {existsSync,readFileSync} from 'node:fs';
const BASE='33ffa8d5eb28a1e8daaacc1c402bed0f0ba98a70';
const changed=[
 'app/components/learning/LearningRoom.js',
 'lib/learning/trade-video-resources.mjs',
 'lib/learning/trade-study-guides.mjs',
 'lib/platform/research/trading-video-hypotheses.mjs',
 'tests/jeniosUniversityFreeTracksVideoB261.test.mjs',
 'tests/platformTradingVideoStudy.test.mjs',
 'docs/learning/B261-UNIVERSIDADE-SEM-NIVELAMENTO.md',
 'docs/platform/B262-VIDEO-RESEARCH-ROBOT-LAB.md',
 'docs/platform/B265-CERTIFICACAO-VIDEO-UNIVERSIDADE.md'
];
const added=['docs/platform/B266-VERIFIED-VIDEOS-ANALYSIS.md',
 'scripts/platform/learning/b266-integrity.mjs',
 '.github/workflows/jenios-b266-verified-video-research.yml'];
const rows=execFileSync('git',['diff','--no-renames','--name-status',BASE,'HEAD'],{encoding:'utf8'}).trim().split('\n').filter(Boolean).map(x=>x.split('\t'));
assert.equal(rows.length,changed.length+added.length,'B266_UNEXPECTED_SCOPE_SIZE');
assert.deepEqual(rows.map(([,p])=>p).sort(),[...changed,...added].sort(),'B266_UNEXPECTED_SCOPE_PATH');
for(const [status,path] of rows)assert.equal(status,changed.includes(path)?'M':'A','B266_UNAUTHORIZED_MODIFICATION '+path);
for(const file of ['package.json','package-lock.json','lib/learning/engine.mjs','lib/learning/tutor.mjs',
 'lib/learning/access.mjs','lib/learning/repository.mjs','lib/learning/service.mjs',
 'app/api/platform/learning/route.js',
 'app/components/learning/LearningRoom.module.css','app/universidade/page.js',
 'lib/platform/pilot-prep/paper-ledger.mjs','lib/platform/connections/alpaca-paper-private-executor.mjs',
 'lib/platform/connections/demo-vault.mjs','lib/platform/connections/demo-service.mjs',
 'lib/pay/checkout.mjs','lib/pay/inter-pix.mjs','app/api/jenios-pay/checkout/route.js']){
 assert.ok(readFileSync(file).equals(execFileSync('git',['show',BASE+':'+file])), 'B265_CERTIFIED_CODE_DRIFT '+file);
}
for(const forbidden of ['app/api/platform/broker-execution/route.js','app/api/platform/live-trading/route.js','app/api/platform/paper-execution/route.js','nucleo-privado/engine.mjs'])
 assert.equal(existsSync(forbidden),false,'B266_PROHIBITED_FILE '+forbidden);
const res=readFileSync('lib/learning/trade-video-resources.mjs','utf8');
assert.match(res,/transcript_reviewed/);assert.match(res,/metadata_only/);
const lab=readFileSync('lib/platform/research/trading-video-hypotheses.mjs','utf8');
for(const marker of ['NO_GO_MISSING_HARD_STOP','ordersSent:0','operationalDeploymentAllowed:false','profitabilityDemonstrated:false'])assert.ok(lab.includes(marker),'B266_MISSING_SAFETY '+marker);
assert.doesNotMatch(lab,/\bfetch\s*\(|\bwithdraw\s*\(|https:\/\/api\.alpaca\.markets|https:\/\/api\.binance\.com/i);
console.log('B266_SOURCE_FROZEN_PASS: verified captions and original education, no payment or order permission changes');
