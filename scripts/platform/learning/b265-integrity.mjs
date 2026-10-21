/** B265: freeze B260; authorize only JENIOS University UX and research-only studies.
 * CI forbids trading, payment or tenant access bypass in this research release. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {existsSync,readFileSync} from 'node:fs';
const BASE='8e64d16bd050962cb7b2a13088dc3f17193f4bfa';
const modified=[
 'lib/learning/engine.mjs','lib/learning/tutor.mjs',
 'app/components/learning/LearningRoom.js','app/components/learning/LearningRoom.module.css',
 'app/universidade/page.js','app/platform/aprender/page.js',
 'tests/learningR26.test.mjs','tests/jeniosUniversityDailyB130.test.mjs'
];
const added=[
 'lib/learning/trade-video-resources.mjs',
 'lib/learning/trade-study-guides.mjs',
 'tests/jeniosUniversityFreeTracksVideoB261.test.mjs',
 'lib/platform/research/trading-video-hypotheses.mjs',
 'tests/platformTradingVideoStudy.test.mjs',
 'docs/learning/B261-UNIVERSIDADE-SEM-NIVELAMENTO.md',
 'docs/platform/B262-VIDEO-RESEARCH-ROBOT-LAB.md',
 'docs/learning/B263-CHECKLIST-ACESSO-LIVRE.md',
 'docs/platform/B265-CERTIFICACAO-VIDEO-UNIVERSIDADE.md',
 'scripts/platform/learning/b265-integrity.mjs',
 '.github/workflows/jenios-b265-video-university.yml'
];
const rows=execFileSync('git',['diff','--no-renames','--name-status',BASE,'HEAD'],{encoding:'utf8'}).trim().split('\n').filter(Boolean).map(x=>x.split('\t'));
assert.equal(rows.length,modified.length+added.length,'B265_UNEXPECTED_SCOPE_SIZE');
assert.deepEqual(rows.map(([,path])=>path).sort(),[...modified,...added].sort(),'B265_UNEXPECTED_SCOPE_FILE');
for(const [kind,path] of rows){assert.equal(kind,modified.includes(path)?'M':'A','B265_SCOPE_STATUS_DRIFT '+path);}
for(const file of [
 'package.json','package-lock.json','lib/learning/access.mjs','lib/learning/catalog.mjs',
 'lib/learning/question-bank.mjs','lib/learning/repository.mjs','lib/learning/service.mjs',
 'lib/assistant/university-subscription.mjs','lib/assistant/university-monthly-access.mjs',
 'lib/platform/pilot-prep/paper-ledger.mjs','lib/platform/connections/alpaca-paper-private-executor.mjs',
 'lib/platform/connections/demo-vault.mjs','lib/platform/connections/demo-service.mjs',
 'lib/pay/checkout.mjs','lib/pay/inter-pix.mjs','lib/pay/pix-status.mjs',
 'app/api/platform/learning/route.js','app/api/platform/checkout/route.js',
 'app/api/assistant/university/checkout/route.js','app/api/jenios-pay/checkout/route.js',
 'app/api/platform/broker-connections/route.js','app/social/page.js',
 '.github/workflows/jenios-b260-private-launch-acceptance.yml']){
 assert.ok(readFileSync(file).equals(execFileSync('git',['show',BASE+':'+file])), 'B260_PROTECTED_SOURCE_DRIFT '+file);
}
for(const file of [
 'app/api/platform/broker-execution/route.js',
 'app/api/platform/paper-execution/route.js',
 'app/api/platform/live-trading/route.js',
 'nucleo-privado/engine.mjs'
]) assert.equal(existsSync(file),false,'B265_PROHIBITED_PUBLIC_ORDER_ROUTE '+file);
const ui=readFileSync('app/components/learning/LearningRoom.js','utf8');
assert.match(ui,/Escolha qualquer trilha/);
assert.match(ui,/Escolher trilha de estudos/);
assert.doesNotMatch(ui,/start_quiz|submit_quiz|QUESTION_BANK|localStorage/);
const eng=readFileSync('lib/learning/engine.mjs','utf8');
assert.match(eng,/placementRequired:false,assessmentsRequired:false,allTracksAvailable:true/);
assert.match(eng,/trackUnlocked\(_state,id\)/);
const resources=readFileSync('lib/learning/trade-video-resources.mjs','utf8');
for(const status of ['transcript_reviewed','metadata_verified_no_captions','metadata_verified_music_only','needs_playlist_review']) assert.ok(resources.includes(status),'CURATION_PROVENANCE_STATUS_MISSING '+status);
const research=readFileSync('lib/platform/research/trading-video-hypotheses.mjs','utf8');
assert.doesNotMatch(research,/\bfetch\s*\(|\bwithdraw\s*\(|https:\/\/api\.alpaca\.markets|https:\/\/api\.binance\.com/i);
for(const tag of ['ordersSent:0','coreChanged:false','profitabilityDemonstrated:false'])assert.ok(research.includes(tag));
console.log('B265_SCOPE_PASS '+rows.length+' approved paths; University free navigation and isolated research only; no trading or payment drift');
