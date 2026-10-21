import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initialState,projectState,projectLesson,transition} from '../lib/learning/engine.mjs';
import {TRACKS,LESSONS} from '../lib/learning/catalog.mjs';
import {PRACTICAL_STUDY_WORKSHOPS,workshopsForTrack} from '../lib/learning/trade-study-workshops-b271.mjs';
import {USER_VIDEO_RESOURCES} from '../lib/learning/trade-video-resources.mjs';
import {handleLearning} from '../lib/learning/service.mjs';
const now=Date.parse('2026-10-21T12:00:00Z');
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
const allowed=async()=>({user:{id:A},access:{kind:'subscription',productCode:'platform-global-crypto'}});
function storage(){const rows=new Map();return {rows,repository:(_db,id)=>({
 async read(){if(!rows.has(id))rows.set(id,{revision:0,state:initialState()});return structuredClone(rows.get(id));},
 async write(revision,state){const old=rows.get(id);if(!old||revision!==old.revision)throw Object.assign(Error('conflict'),{status:409,code:'REVISION_CONFLICT'});const next={revision:revision+1,state:structuredClone(state)};rows.set(id,next);return structuredClone(next);}
})};}
function request(body=null,lesson=null){const url='https://local.invalid/api/platform/learning'+(lesson?'?lesson='+encodeURIComponent(lesson):'');return new Request(url,{method:body?'POST':'GET',headers:{authorization:'Bearer synthetic',...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});}
test('B276 all five routes include fifteen complete existing lessons and ten optional workshops',()=>{
 assert.equal(TRACKS.length,5);assert.equal(LESSONS.length,15);assert.equal(PRACTICAL_STUDY_WORKSHOPS.length,10);
 assert.equal(new Set(LESSONS.map(x=>x.id)).size,15);assert.equal(new Set(PRACTICAL_STUDY_WORKSHOPS.map(x=>x.id)).size,10);
 const projected=projectState(initialState(),0,now);assert.equal(projected.route.length,5);
 assert.equal(projected.route.flatMap(t=>t.lessons).length,15);
 assert.ok(projected.route.every(x=>x.unlocked));
 for(const t of TRACKS){assert.equal(workshopsForTrack(t.id).length,2);
  for(const l of LESSONS.filter(x=>x.trackId===t.id)){const d=projectLesson(initialState(),l.id,now);assert.ok(d.paragraphs.length>=3&&d.example&&d.exercise);}
 }
 assert.ok(PRACTICAL_STUDY_WORKSHOPS.every(w=>w.steps.length===3&&w.example&&w.practice&&w.selfCheck));
});
test('B276 advanced-first reading across all 15 lessons preserves legacy grade/placement history',()=>{
 let s=initialState();s.placement={level:'Iniciante',safetyReviewRequired:true};
 s.mastery={fundamentos:{passed:false,score:20,reviewAt:new Date(now).toISOString()}};
 s.assessments=[{id:'historic',kind:'fundamentos',passed:false,score:20}];
 s.pending=null; // legacy pending quizzes are exercised separately in B261 regression
 for(const l of [...LESSONS].reverse()){assert.equal(projectLesson(s,l.id,now).id,l.id);s=transition(s,{action:'complete_lesson',lessonId:l.id},now).state;}
 const projection=projectState(s,15,now);assert.equal(projection.route.flatMap(t=>t.lessons).filter(l=>l.completed).length,15);
 assert.deepEqual(s.placement,{level:'Iniciante',safetyReviewRequired:true});
 assert.equal(s.assessments[0].id,'historic');assert.equal(s.pending,null);assert.equal(s.mastery.fundamentos.score,20);
 assert.equal(projection.executionEnabled,false);assert.ok(projection.route.every(t=>t.unlocked));
});
test('B276 per-account progress persistence, optimistic revision, and access denial',async()=>{
 const memory=storage(),repository=memory.repository;
 const fetch=async(userId,body=null,lesson=null,grant=true)=>handleLearning(request(body,lesson),{
  db:{},now,repository,authorize:async()=>grant?({user:{id:userId},access:{kind:'subscription'}}):Promise.reject(Object.assign(Error('Not entitled'),{status:402,code:'SUBSCRIPTION_REQUIRED'}))
 });
 const initial=await fetch(A);assert.equal(initial.status,200);
 const first=await (await fetch(A,{action:'complete_lesson',lessonId:'backtest',revision:0})).json();
 assert.equal(first.learning.revision,1);
 assert.equal(first.learning.route.flatMap(t=>t.lessons).find(l=>l.id==='backtest').completed,true);
 const stale=await fetch(A,{action:'complete_lesson',lessonId:'mercado',revision:0});assert.equal(stale.status,409);
 const reloaded=await (await fetch(A)).json();assert.equal(reloaded.learning.revision,1);
 assert.equal(reloaded.learning.route.flatMap(t=>t.lessons).filter(l=>l.completed).length,1);
 const other=await (await fetch(B)).json();assert.equal(other.learning.route.flatMap(t=>t.lessons).filter(l=>l.completed).length,0);
 assert.equal((await fetch(B,null,'backtest',false)).status,402);
 const lesson=await (await fetch(A,null,'backtest')).json();assert.equal(lesson.lesson.id,'backtest');
});
test('B276 review is optional, idempotent for same day and unavailable before reading',()=>{
 const fresh=initialState();assert.throws(()=>transition(fresh,{action:'review_lesson',lessonId:'risco'},now),{code:'LESSON_NOT_COMPLETED'});
 const saved=transition(fresh,{action:'complete_lesson',lessonId:'risco'},now).state;
 const once=transition(saved,{action:'review_lesson',lessonId:'risco'},now).state;
 const twice=transition(once,{action:'review_lesson',lessonId:'risco'},now).state;
 assert.equal(twice.reviewDiary.length,1);assert.equal(twice.reviewTotal,1);
 assert.equal(projectState(twice,2,now).dailyStudy.reviewedToday.includes('risco'),true);
});
test('B276 guest never receives private lesson state and source provenance remains accurate',()=>{
 assert.equal(USER_VIDEO_RESOURCES.length,56);
 assert.equal(USER_VIDEO_RESOURCES.filter(x=>x.verification==='needs_video_review').length,36);
 assert.ok(USER_VIDEO_RESOURCES.filter(x=>x.verification==='needs_video_review').every(x=>x.channel===null));
 const ui=readFileSync(new URL('../app/components/learning/LearningRoom.js',import.meta.url),'utf8');
 assert.match(ui,/Oficinas práticas opcionais/);assert.match(ui,/Escolha qualquer trilha/);
 assert.match(ui,/getSession/);assert.match(ui,/AUTH_REQUIRED/);
 assert.doesNotMatch(ui,/start_quiz|submit_quiz|QUESTION_BANK/);
});
