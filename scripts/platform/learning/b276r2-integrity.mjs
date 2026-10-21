/** B276-R2: additive authenticated-browser coverage above B276's certified baseline. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,existsSync} from 'node:fs';
import {TRACKS,LESSONS} from '../../../lib/learning/catalog.mjs';
import {PRACTICAL_STUDY_WORKSHOPS} from '../../../lib/learning/trade-study-workshops-b271.mjs';
import {USER_VIDEO_RESOURCES} from '../../../lib/learning/trade-video-resources.mjs';
const BASE='d90c9309b3ea9f72c27e4355cf92b01a2eca6cc9';
const allowed=new Map([
 ['app/components/learning/LearningRoom.js','M'],
 ['app/components/learning/LearningRoom.module.css','M'],
 ['app/components/learning/LessonVisual.js','A'],
 ['lib/learning/lesson-visual-scenes-b276.mjs','A'],
 ['tests/jeniosUniversityHomologationB276R2.test.mjs','A'],
 ['scripts/platform/learning/b276r2-browser-acceptance.mjs','A'],
 ['scripts/platform/learning/b276r2-integrity.mjs','A'],
 ['docs/learning/B276-R2-AUTHENTICATED-QA.md','A'],
 ['.github/workflows/jenios-b276-r2-university.yml','A']
]);
const changed=execFileSync('git',['diff','--no-renames','--name-status',BASE,'HEAD'],{encoding:'utf8'})
 .trim().split('\n').filter(Boolean).map(x=>x.split('\t'));
assert.equal(changed.length,allowed.size,'B276R2_UNEXPECTED_SCOPE_SIZE');
assert.deepEqual(changed.map(([,path])=>path).sort(),[...allowed.keys()].sort(),'B276R2_SCOPE_FILE_MISMATCH');
for(const [status,path] of changed)assert.equal(status,allowed.get(path),'B276R2_BAD_SCOPE_STATUS '+path);
for(const path of [
 'lib/learning/catalog.mjs','lib/learning/engine.mjs','lib/learning/access.mjs',
 'lib/learning/repository.mjs','lib/learning/service.mjs','lib/learning/tutor.mjs',
 'lib/learning/trade-video-resources.mjs','lib/learning/trade-video-supplement-20261021.mjs',
 'lib/learning/trade-study-guides.mjs','lib/learning/trade-study-workshops-b271.mjs',
 'lib/platform/research/b272-walkforward-lab.mjs',
 'lib/platform/research/trading-video-hypotheses.mjs',
 'lib/platform/pilot-prep/paper-ledger.mjs',
 'lib/platform/connections/alpaca-paper-private-executor.mjs',
 'lib/platform/connections/demo-vault.mjs',
 'lib/pay/checkout.mjs','lib/pay/inter-pix.mjs',
 'lib/assistant/university-subscription.mjs',
 'app/universidade/page.js','app/api/platform/learning/route.js',
 'app/api/platform/broker-connections/route.js',
 'app/api/jenios-pay/checkout/route.js','app/social/page.js',
 'tests/jeniosB276UniversityAcceptance.test.mjs',
 'scripts/platform/learning/b276-browser-smoke.mjs',
 'package.json','package-lock.json'
])assert.ok(readFileSync(path).equals(execFileSync('git',['show',BASE+':'+path])), 'B276R2_PROTECTED_FILE_DRIFT '+path);
for(const route of [
 'app/api/platform/live-trading/route.js',
 'app/api/platform/broker-execution/route.js',
 'app/api/platform/paper-execution/route.js','nucleo-privado/engine.mjs'
])assert.equal(existsSync(route),false,'B276R2_ORDER_ROUTE_FORBIDDEN '+route);
assert.equal(TRACKS.length,5);assert.equal(LESSONS.length,15);assert.equal(PRACTICAL_STUDY_WORKSHOPS.length,10);
assert.equal(USER_VIDEO_RESOURCES.length,56);
const {LESSON_VISUAL_SCENES,WORKSHOP_TO_LESSON_SCENE}=await import('../../../lib/learning/lesson-visual-scenes-b276.mjs');
assert.equal(Object.keys(LESSON_VISUAL_SCENES).length,15);
assert.equal(Object.keys(WORKSHOP_TO_LESSON_SCENE).length,10);
assert.equal(USER_VIDEO_RESOURCES.filter(v=>v.verification==='needs_video_review').length,36);
const ui=readFileSync('app/components/learning/LearningRoom.js','utf8'),
 css=readFileSync('app/components/learning/LearningRoom.module.css','utf8');
assert.match(ui,/function clear\(\)\{lessonEpoch\.current\+\+;/);
assert.match(ui,/function chooseTrack\(id\)\{lessonEpoch\.current\+\+;/);
assert.match(ui,/if\(v===lessonEpoch\.current\)showError\(e\)/);
assert.match(ui,/Oficinas práticas opcionais/);
assert.match(ui,/<LessonVisual lessonId=\{lesson\.id\}\/\>/);
assert.match(ui,/<LessonVisual workshopId=\{w\.id\}\/\>/);
assert.doesNotMatch(ui,/start_quiz|submit_quiz|QUESTION_BANK|localStorage/);
assert.match(css,/\.lessonButton\{min-height:44px/);
assert.match(css,/@media\(max-width:380px\)/);
const illustration=readFileSync('app/components/learning/LessonVisual.js','utf8');
const sources=readFileSync('lib/learning/lesson-visual-scenes-b276.mjs','utf8');
for(const content of [illustration,sources]) assert.doesNotMatch(content,/\bfetch\s*\(|api\.alpaca|api\.binance|\bprocess\.env\b/i);
const browser=readFileSync('scripts/platform/learning/b276r2-browser-acceptance.mjs','utf8');
assert.match(browser,/B276_LOCAL_BROWSER_ONLY/);
assert.doesNotMatch(browser,/api\.alpaca\.markets|api\.binance\.com|api\.openai\.com/);
console.log('B276_R2_SCOPE_PASS: existing B276 preserved; optional 10 workshops, 15 lessons, 56 links, browser safety only');
