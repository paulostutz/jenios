import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {TRACKS,LESSONS,CURRICULUM_VERSION} from '../lib/learning/catalog.mjs';
import {initialState,transition,projectState,projectLesson} from '../lib/learning/engine.mjs';
import {handleLearning} from '../lib/learning/service.mjs';
import {PRACTICAL_STUDY_WORKSHOPS,workshopsForTrack} from '../lib/learning/trade-study-workshops-b271.mjs';
import {USER_VIDEO_RESOURCES} from '../lib/learning/trade-video-resources.mjs';
const A='b2760000-0000-4000-8000-000000000001';
const B='b2760000-0000-4000-8000-000000000002';
const NOW=Date.parse('2026-10-21T12:00:00Z');
function harness(){
 const states=new Map(),events=[];
 const authorize=async request=>{
  const token=request.headers.get('authorization');
  if(token==='Bearer deny')throw Object.assign(Error('Entre na sua conta'),{status:401,code:'AUTH_REQUIRED'});
  if(token==='Bearer unpaid')throw Object.assign(Error('Assinatura necessária'),{status:402,code:'SUBSCRIPTION_REQUIRED'});
  const id=token==='Bearer A'?A:token==='Bearer B'?B:null;
  if(!id)throw Object.assign(Error('Não autorizado'),{status:401,code:'AUTH_REQUIRED'});
  events.push(['authorize',id]);
  return {user:{id},access:{kind:'subscription',productCode:'platform-global-crypto'}};
 };
 const repository=(_db,userId)=>({
  async read(){
   if(!states.has(userId))states.set(userId,{state:initialState(),revision:0});
   const row=structuredClone(states.get(userId));
   events.push(['read',userId,row.revision]);
   return row;
  },
  async write(revision,state){
   const current=states.get(userId);
   if(current.revision!==revision)throw Object.assign(Error('Alterado em outra aba'),{status:409,code:'REVISION_CONFLICT'});
   const next={state:structuredClone(state),revision:revision+1};
   states.set(userId,next);
   events.push(['write',userId,next.revision]);
   return structuredClone(next);
  }
 });
 const call=async(token,body=null,query='',method=body?'POST':'GET')=>{
  const req=new Request('https://localhost.invalid/api/platform/learning'+query,{
   method,headers:{authorization:'Bearer '+token,...(body?{'content-type':'application/json'}:{})},
   ...(body?{body:JSON.stringify(body)}:{})
  });
  const response=await handleLearning(req,{authorize,repository,db:{},now:NOW});
  return {status:response.status,body:await response.json(),headers:response.headers};
 };
 return {states,events,call};
}
test('B276 audits the untouched curriculum: 5 tracks x 3 lessons, 10 optional workshops, 56 references',()=>{
 assert.equal(CURRICULUM_VERSION,'r26.1');
 assert.equal(TRACKS.length,5);assert.equal(LESSONS.length,15);
 assert.equal(new Set(LESSONS.map(x=>x.id)).size,15);
 assert.equal(PRACTICAL_STUDY_WORKSHOPS.length,10);
 for(const track of TRACKS){
  assert.equal(LESSONS.filter(x=>x.trackId===track.id).length,3);
  assert.equal(workshopsForTrack(track.id).length,2);
  const ids=new Set(workshopsForTrack(track.id).map(x=>x.id));
  assert.equal(ids.size,2);
 }
 assert.equal(USER_VIDEO_RESOURCES.length,56);
 assert.equal(USER_VIDEO_RESOURCES.filter(x=>x.verification==='needs_video_review').length,36);
});
test('B276 no placement, quiz or grade can lock one of the 15 lessons',()=>{
 const state=initialState();
 state.pending={kind:'placement',id:'legacy',expiresAt:'2026-10-23T12:00:00Z',questions:[]};
 state.placement={level:'Iniciante',safetyReviewRequired:true};
 state.mastery={fundamentos:{passed:false,score:12,lastPassed:false}};
 const before=structuredClone(state);
 const projection=projectState(state,0,NOW);
 assert.equal(projection.placementRequired,false);
 assert.equal(projection.assessmentsRequired,false);
 assert.equal(projection.executionEnabled,false);
 assert.equal(projection.route.length,5);
 for(const track of projection.route){
  assert.equal(track.unlocked,true);
  assert.equal(track.lessons.length,3);
  for(const lesson of track.lessons){
   const view=projectLesson(state,lesson.id,NOW);
   assert.equal(view.id,lesson.id);
   assert.ok(view.paragraphs.length>=3&&view.exercise);
  }
 }
 const advanced=LESSONS.find(x=>x.trackId==='laboratorio').id;
 const after=transition(state,{action:'complete_lesson',lessonId:advanced},NOW).state;
 assert.ok(after.completedLessons.includes(advanced));
 assert.deepEqual(after.pending,before.pending);
 assert.deepEqual(after.mastery,before.mastery);
 assert.deepEqual(after.placement,before.placement);
 assert.deepEqual(after.assessments,before.assessments);
});
test('B276 15/15 lessons available in arbitrary order and server-saved progress survives reload',async()=>{
 const h=harness(),first=await h.call('A');
 assert.equal(first.status,200);assert.equal(first.body.learning.revision,0);
 assert.equal(first.headers.get('cache-control'),'private, no-store');
 let revision=0;
 const ids=LESSONS.map(x=>x.id).reverse();
 for(const id of ids){
  const opened=await h.call('A',null,'?lesson='+id);
  assert.equal(opened.status,200);
  assert.equal(opened.body.lesson.id,id);
  const done=await h.call('A',{action:'complete_lesson',lessonId:id,revision});
  assert.equal(done.status,200);
  revision=done.body.learning.revision;
  assert.equal(done.body.learning.route.flatMap(x=>x.lessons).filter(x=>x.completed).length,revision);
 }
 assert.equal(revision,15);
 const reloaded=await h.call('A');
 assert.equal(reloaded.status,200);
 assert.equal(reloaded.body.learning.currentLessonId,null);
 assert.equal(reloaded.body.learning.route.flatMap(x=>x.lessons).filter(x=>x.completed).length,15);
 assert.equal(reloaded.body.learning.revision,15);
 assert.equal(reloaded.body.learning.executionEnabled,false);
 assert.equal(h.states.get(A).state.completedLessons.length,15);
});
test('B276 preserve historical quiz records and daily review when opening advanced lesson first',async()=>{
 const h=harness();let state=initialState();
 state.placement={level:'Básico',byTrack:{laboratorio:{correct:1,total:3}}};
 state.pending={kind:'placement',id:'legacy-pending',expiresAt:'2026-10-22T12:00:00Z',questions:[]};
 state.assessments=[{id:'historic',kind:'placement',score:40}];
 state.mastery={fundamentos:{passed:true,score:80,reviewAt:'2026-10-20T00:00:00Z'}};
 state.completedLessons=['mercado'];
 h.states.set(A,{state,revision:7});
 const advance=LESSONS.find(x=>x.trackId==='laboratorio').id;
 let saved=await h.call('A',{action:'complete_lesson',lessonId:advance,revision:7});
 assert.equal(saved.status,200);assert.equal(saved.body.learning.revision,8);
 saved=await h.call('A',{action:'review_lesson',lessonId:advance,revision:8});
 assert.equal(saved.status,200);assert.equal(saved.body.learning.revision,9);
 assert.ok(saved.body.learning.dailyStudy.reviewedToday.includes(advance));
 assert.equal(saved.body.learning.executionEnabled,false);
 const actual=h.states.get(A).state;
 assert.equal(actual.placement.level,'Básico');
 assert.equal(actual.pending.id,'legacy-pending');
 assert.deepEqual(actual.assessments,state.assessments);
 assert.deepEqual(actual.mastery,state.mastery);
 assert.deepEqual(actual.completedLessons,['mercado',advance]);
 assert.equal(actual.reviewDiary.length,1);
 assert.equal(actual.reviewDiary[0].lessonId,advance);
});
test('B276 authorization and two concurrent accounts are isolated with no payment or trading effect',async()=>{
 const h=harness();
 for(const token of ['deny','unpaid']){
  const result=await h.call(token);
  assert.equal(result.status,token==='deny'?401:402);
  assert.equal(result.body.ok,false);
  assert.equal(result.body.executionEnabled,false);
 }
 assert.equal(h.events.length,0);
 const a=await h.call('A');
 const done=await h.call('A',{action:'complete_lesson',lessonId:'mercado',revision:a.body.learning.revision});
 assert.equal(done.status,200);
 const b=await h.call('B');
 assert.equal(b.status,200);
 assert.equal(b.body.learning.route.flatMap(x=>x.lessons).filter(x=>x.completed).length,0);
 assert.equal(h.states.get(B).state.completedLessons.length,0);
 assert.equal(h.states.get(A).state.completedLessons.length,1);
 const unauthorizedPost=await h.call('unpaid',{action:'complete_lesson',lessonId:'backtest',revision:1});
 assert.equal(unauthorizedPost.status,402);
 assert.equal(h.states.get(A).state.completedLessons.length,1);
 assert.equal(h.states.get(B).state.completedLessons.length,0);
});
test('B276 409 concurrent browser writes cannot overwrite progress or claim success',async()=>{
 const h=harness();await h.call('A');
 const first=await h.call('A',{action:'complete_lesson',lessonId:'mercado',revision:0});
 assert.equal(first.status,200);assert.equal(first.body.learning.revision,1);
 const stale=await h.call('A',{action:'complete_lesson',lessonId:'backtest',revision:0});
 assert.equal(stale.status,409);
 assert.equal(stale.body.code,'REVISION_CONFLICT');
 assert.deepEqual(h.states.get(A).state.completedLessons,['mercado']);
 const retry=await h.call('A',{action:'complete_lesson',lessonId:'backtest',revision:1});
 assert.equal(retry.status,200);
 assert.deepEqual(h.states.get(A).state.completedLessons,['mercado','backtest']);
 assert.equal(h.states.get(A).revision,2);
});
test('B276 UI cancels in-flight lessons when switching tracks, clearing auth or failing old requests',()=>{
 const ui=readFileSync(new URL('../app/components/learning/LearningRoom.js',import.meta.url),'utf8');
 const css=readFileSync(new URL('../app/components/learning/LearningRoom.module.css',import.meta.url),'utf8');
 assert.match(ui,/function chooseTrack\(id\)\{lessonEpoch\.current\+\+;/);
 assert.match(ui,/function clear\(\)\{lessonEpoch\.current\+\+;/);
 assert.match(ui,/if\(v===lessonEpoch\.current\)showError\(e\)/);
 assert.match(ui,/Oficinas práticas opcionais/);
 assert.match(ui,/role="group" aria-label="Escolher trilha de estudos"/);
 assert.match(css,/\.lessonButton\{min-height:44px/);
 assert.match(css,/@media\(max-width:380px\)/);
 assert.doesNotMatch(ui,/start_quiz|submit_quiz|QUESTION_BANK|\\.answer\\b/);
});

import {LESSON_VISUAL_SCENES,WORKSHOP_TO_LESSON_SCENE,visualForLesson,visualForWorkshop} from '../lib/learning/lesson-visual-scenes-b276.mjs';
test('B276-R2 all 15 lessons have one original labeled, accessible and non-operational SVG scene',()=>{
 const ids=LESSONS.map(x=>x.id);
 assert.deepEqual(Object.keys(LESSON_VISUAL_SCENES).sort(),[...ids].sort());
 const accepted=new Set(['flow','timeline','risk','candles','trend','costs','indicators','expectancy']);
 for(const id of ids){
  const v=visualForLesson(id);
  assert.ok(v&&accepted.has(v.kind)&&v.title.length>=12&&v.alt.length>=55&&v.caption.length>=50);
  assert.doesNotMatch(v.caption,/lucro garantido|recomendação de compra|sinal em tempo real/i);
 }
 assert.equal(visualForLesson('unknown'),null);
});
test('B276-R2 all 10 optional workshops reuse relevant source-free didactic scenes',()=>{
 assert.deepEqual(Object.keys(WORKSHOP_TO_LESSON_SCENE).sort(),PRACTICAL_STUDY_WORKSHOPS.map(x=>x.id).sort());
 for(const workshop of PRACTICAL_STUDY_WORKSHOPS){
  const v=visualForWorkshop(workshop.id);
  assert.ok(v?.alt&&v?.caption,workshop.id);
  assert.ok(LESSONS.some(x=>x.id===WORKSHOP_TO_LESSON_SCENE[workshop.id]));
 }
 assert.equal(visualForWorkshop('unknown'),null);
});
test('B276-R2 visual components are embedded in the selected lesson and workshop panels, responsive and self-contained',()=>{
 const room=readFileSync(new URL('../app/components/learning/LearningRoom.js',import.meta.url),'utf8');
 const visual=readFileSync(new URL('../app/components/learning/LessonVisual.js',import.meta.url),'utf8');
 const css=readFileSync(new URL('../app/components/learning/LearningRoom.module.css',import.meta.url),'utf8');
 assert.match(room,/import LessonVisual from '\.\/LessonVisual'/);
 assert.match(room,/<LessonVisual lessonId=\{lesson\.id\}\/>/);
 assert.match(room,/<LessonVisual workshopId=\{w\.id\}\/>/);
 assert.match(visual,/data-study-illustration/);
 assert.match(visual,/role="img"/);
 assert.match(visual,/aria-label=\{scene\.alt\}/);
 assert.match(visual,/<desc>\{scene\.alt\}<\/desc>/);
 assert.match(visual,/Não representa cotação/);
 assert.doesNotMatch(visual,/\bfetch\s*\(|\bXMLHttpRequest\b|process\.env|orderIntent|\.push\(\s*['"]checkout/i);
 assert.match(css,/\.studyIllustrationSvg\{width:100%;height:auto;max-width:100%/);
 assert.match(css,/@media\(max-width:600px\)/);
});
