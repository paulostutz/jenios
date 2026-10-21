/** B277 isolated research and optional education — protects certified B276-R2. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,existsSync} from 'node:fs';
import {USER_VIDEO_RESOURCES} from '../../../lib/learning/trade-video-resources.mjs';
import {B277_EVIDENCE_INVENTORY,B277_SOURCE_COUNTS} from '../../../lib/learning/b277-video-evidence.mjs';
import {B277_GUIDED_STUDIES} from '../../../lib/learning/b277-guided-trade-studies.mjs';
const BASE='aed1477ff58c4c6156c067629683ad8509b0ca9d';
const files=new Map([
 ['app/components/learning/LearningRoom.js','M'],
 ['app/components/learning/LearningRoom.module.css','M'],
 ['lib/learning/b277-video-evidence.mjs','A'],
 ['lib/learning/b277-guided-trade-studies.mjs','A'],
 ['tests/jeniosB277SourceEvidenceUniversity.test.mjs','A'],
 ['docs/learning/B277-VIDEOS-STUDIES-TRIAGE.md','A'],
 ['scripts/platform/learning/b277-integrity.mjs','A'],
 ['.github/workflows/jenios-b277-education-evidence.yml','A']
]);
const changed=execFileSync('git',['diff','--no-renames','--name-status',BASE,'HEAD'],{encoding:'utf8'})
 .trim().split('\n').filter(Boolean).map(row=>row.split('\t'));
assert.deepEqual(changed.map(x=>x[1]).sort(),[...files.keys()].sort(),'B277_OUT_OF_SCOPE_FILES');
for(const [kind,path] of changed)assert.equal(kind,files.get(path),'B277_FILE_ACTION_INVALID '+path);
for(const path of [
 'lib/learning/catalog.mjs','lib/learning/engine.mjs','lib/learning/access.mjs',
 'lib/learning/repository.mjs','lib/learning/service.mjs','lib/learning/tutor.mjs',
 'lib/learning/trade-video-resources.mjs','lib/learning/trade-video-supplement-20261021.mjs',
 'lib/learning/trade-study-guides.mjs','lib/learning/trade-study-workshops-b271.mjs',
 'lib/learning/lesson-visual-scenes-b276.mjs','lib/platform/research/b272-walkforward-lab.mjs',
 'lib/platform/research/trading-video-hypotheses.mjs',
 'lib/platform/pilot-prep/paper-ledger.mjs','lib/platform/connections/alpaca-paper-private-executor.mjs',
 'lib/platform/connections/demo-vault.mjs',
 'lib/pay/checkout.mjs','lib/pay/inter-pix.mjs',
 'lib/assistant/university-subscription.mjs','app/components/learning/LessonVisual.js',
 'app/universidade/page.js','app/api/platform/learning/route.js','app/api/platform/broker-connections/route.js',
 'app/api/jenios-pay/checkout/route.js','app/social/page.js','package.json','package-lock.json'
]){
 assert.ok(readFileSync(path).equals(execFileSync('git',['show',BASE+':'+path])), 'B277_PROTECTED_SOURCE_CHANGED '+path);
}
for(const path of ['app/api/platform/live-trading/route.js','app/api/platform/paper-execution/route.js',
 'app/api/platform/broker-execution/route.js','nucleo-privado/engine.mjs'])
 assert.equal(existsSync(path),false,'B277_PROHIBITED_ORDER_ROUTE '+path);
assert.equal(USER_VIDEO_RESOURCES.length,56);
assert.equal(B277_EVIDENCE_INVENTORY.length,56);
assert.equal(B277_SOURCE_COUNTS.newPending,36);
assert.equal(B277_SOURCE_COUNTS.priorCaptionNotes,13);
assert.equal(B277_SOURCE_COUNTS.newlyVerifiedTranscripts,0);
assert.equal(B277_SOURCE_COUNTS.approvedTradingRules,0);
assert.equal(B277_GUIDED_STUDIES.length,13);
const ui=readFileSync('app/components/learning/LearningRoom.js','utf8');
assert.match(ui,/aria-label="Estudos de fontes revisadas"/);
assert.match(ui,/Da referência ao método: estude com evidências/);
assert.match(ui,/<LessonVisual lessonId=\{lesson\.id\}\/>/);
assert.match(ui,/<LessonVisual workshopId=\{w\.id\}\/>/);
assert.doesNotMatch(ui,/start_quiz|submit_quiz|QUESTION_BANK|localStorage/);
for(const file of ['lib/learning/b277-video-evidence.mjs','lib/learning/b277-guided-trade-studies.mjs']){
 const content=readFileSync(file,'utf8');
 assert.doesNotMatch(content,/\bfetch\s*\(|\bXMLHttpRequest\b|\bprocess\.env\b|api\.alpaca\.markets|api\.binance\.com/);
}
console.log('B277_SCOPE_PASS 8 files, 13 prior-caption case studies, 36 videos pending; robot, PAY, auth, Social preserved');
