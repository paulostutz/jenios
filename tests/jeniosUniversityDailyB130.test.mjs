import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,transition,projectState,dailyStudyPlan,LEARNING_POLICY} from '../lib/learning/engine.mjs';
import {LESSONS,TRACKS} from '../lib/learning/catalog.mjs';
import {readFileSync} from 'node:fs';
const NOW=Date.parse('2026-10-20T13:00:00Z');
function state(){const s=initialState();s.onboarding={minutes:20,experience:'new',goal:'fundamentals'};s.placement={level:'Iniciante',safetyReviewRequired:false,byTrack:{}};s.completedLessons=['mercado'];return s;}
test('B130 extends spaced reviews through 90 days without replacing the original five tracks',()=>{
 assert.deepEqual(LEARNING_POLICY.reviewDays,[1,3,7,14,30,60,90]);assert.equal(TRACKS.length,5);assert.equal(LESSONS.length,15);
});
test('B130 only unlocked completed lessons get a review journal entry',()=>{
 const s=state();for(const id of ['backtest','day-swing'])assert.throws(()=>transition(s,{action:'review_lesson',lessonId:id},NOW),{code:'LESSON_NOT_COMPLETED'});
 const a=transition(s,{action:'review_lesson',lessonId:'mercado'},NOW);
 assert.equal(a.state.reviewDiary.length,1);assert.equal(a.result.reviewed,true);
 const b=transition(a.state,{action:'review_lesson',lessonId:'mercado'},NOW);
 assert.equal(b.state.reviewDiary.length,1);assert.equal(b.result.alreadyRegistered,true);
});
test('B130 daily study agenda reflects durable review state and never invents grades',()=>{
 const s=state(),plan=dailyStudyPlan(s,NOW);assert.equal(plan.suggestedLesson.id,'day-swing');assert.equal(plan.studiedToday,0);
 const r=transition(s,{action:'review_lesson',lessonId:'mercado'},NOW).state,shown=projectState(r,1,NOW).dailyStudy;
 assert.equal(shown.studiedToday,1);assert.equal(shown.streakDays,1);assert.equal(shown.totalReviewSessions,1);
 assert.deepEqual(r.mastery,{});assert.equal(r.assessments.length,0);
});
test('B130 university keeps recommending reviews after all 15 lessons are completed',()=>{
 const s=state();s.completedLessons=LESSONS.map(l=>l.id);
 s.mastery=Object.fromEntries(TRACKS.map(t=>[t.id,{passed:true,score:85,reviewAt:new Date(NOW-86400000).toISOString()}]));
 const plan=dailyStudyPlan(s,NOW);assert.ok(plan.suggestedLesson);assert.equal(plan.suggestedLesson.completed,true);assert.equal(plan.due.length,5);
 assert.equal(projectState(s,10,NOW).currentLessonId,null);
});
test('B130 legacy saved states are forward-compatible with optional review diary',()=>{
 const s=state();delete s.reviewDiary;assert.equal(dailyStudyPlan(s,NOW).studiedToday,0);
 assert.equal(transition(s,{action:'review_lesson',lessonId:'mercado'},NOW).state.reviewDiary.length,1);
});

test('B130 University UI offers direct free-track navigation and keeps optional review actions',()=>{
 const code=readFileSync('app/components/learning/LearningRoom.js','utf8');
 assert.match(code,/aria-label="Escolher trilha de estudos"/);
 assert.match(code,/action\(\{action:'review_lesson',lessonId:lesson\.id\}\)/);
 assert.match(code,/dailyStudy\?\.reviewedToday\?\.includes/);
 assert.match(code,/Começar próxima aula sugerida/);
 assert.doesNotMatch(code,/start_quiz|submit_quiz|Avaliação inicial/);
});

test('B133 completing the first lesson counts as study without inventing a review or grade',()=>{
 const s=state();s.completedLessons=[];
 const r=transition(s,{action:'complete_lesson',lessonId:'mercado'},NOW);
 assert.equal(dailyStudyPlan(r.state,NOW).studiedDay,true);
 assert.equal(dailyStudyPlan(r.state,NOW).streakDays,1);
 assert.equal(dailyStudyPlan(r.state,NOW).totalReviewSessions,0);
 assert.deepEqual(r.state.mastery,{});
 const again=transition(r.state,{action:'complete_lesson',lessonId:'mercado'},NOW);
 assert.equal(again.state.studyDays.length,1);
});
test('B133 repeated reviews remain idempotent while total review count survives truncated diary',()=>{
 let s=state();
 for(let i=0;i<185;i++){const when=NOW+(i+1)*86400000;s=transition(s,{action:'review_lesson',lessonId:'mercado'},when).state;}
 assert.equal(s.reviewDiary.length,180);
 assert.equal(s.reviewTotal,185);
 assert.equal(dailyStudyPlan(s,NOW+186*86400000).totalReviewSessions,185);
 const copy=transition(s,{action:'review_lesson',lessonId:'mercado'},NOW+185*86400000);
 assert.equal(copy.state.reviewTotal,185);
});
test('B133 two initial study days count towards a streak even without repeated reviews',()=>{
 let s=state();s.completedLessons=[];
 s=transition(s,{action:'complete_lesson',lessonId:'mercado'},NOW).state;
 s=transition(s,{action:'complete_lesson',lessonId:'day-swing'},NOW+86400000).state;
 const plan=dailyStudyPlan(s,NOW+86400000);
 assert.equal(plan.streakDays,2);assert.equal(plan.studiedToday,0);
});
test('B133 failed prior assessment prioritizes remediation while keeping previous approved lessons',()=>{
 const s=state();s.mastery={fundamentos:{passed:true,lastPassed:false,score:35,reviewAt:new Date(NOW).toISOString()}};
 const plan=dailyStudyPlan(s,NOW);assert.equal(plan.suggestedLesson.id,'mercado');
 assert.equal(plan.suggestedLesson.reason,'Reforçar avaliação anterior');
 assert.ok(plan.reinforcement.some(t=>t.id==='fundamentos'));
});
