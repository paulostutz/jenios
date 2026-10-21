import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initialState,projectState,projectLesson,transition,reserveTutor} from '../lib/learning/engine.mjs';
import {TRACKS} from '../lib/learning/catalog.mjs';
import {handleLearning} from '../lib/learning/service.mjs';
import {USER_VIDEO_RESOURCES} from '../lib/learning/trade-video-resources.mjs';
import {STUDY_GUIDES} from '../lib/learning/trade-study-guides.mjs';
const when=Date.parse('2026-10-21T14:00:00Z');
const user='4d238a7a-8c7b-4d8e-9a10-1c5c82db59a7';
const authorized=async()=>({user:{id:user},access:{kind:'subscription',productCode:'platform-global-crypto'}});
function fixture(){let row={state:initialState(),revision:0};return {repo:()=>({read:async()=>structuredClone(row),write:async(revision,state)=>{assert.equal(revision,row.revision);row={state:structuredClone(state),revision:revision+1};return structuredClone(row);}}),read:()=>row};}
const req=(body=null,q='')=>new Request('https://preview.invalid/api/platform/learning'+q,{method:body?'POST':'GET',headers:{authorization:'Bearer mock',...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
test('a newly subscribed student opens any of five tracks without onboarding or placement',()=>{
 const state=initialState(),projection=projectState(state,0,when);
 assert.equal(projection.placement,null);assert.equal(projection.onboarding,null);
 assert.equal(projection.placementRequired,false);assert.equal(projection.assessmentsRequired,false);
 assert.equal(projection.route.length,5);assert.ok(projection.route.every(t=>t.unlocked));
 assert.equal(projection.executionEnabled,false);
 for(const track of TRACKS){
  assert.ok(projection.route.find(t=>t.id===track.id)?.lessons.length>=1);
  const id=projection.route.find(t=>t.id===track.id).lessons[0].id;
  assert.equal(projectLesson(state,id,when).id,id);
 }
});
test('new student can complete an advanced lesson first without artificial mastery or grades',()=>{
 const state=initialState(),choice='backtest';
 const out=transition(state,{action:'complete_lesson',lessonId:choice},when).state;
 assert.ok(out.completedLessons.includes(choice));assert.equal(out.placement,null);
 assert.deepEqual(out.mastery,{});assert.equal(out.assessments.length,0);
 assert.equal(reserveTutor(out,when).usage.count,1);
});
test('a historical pending quiz never blocks free classes, and older achievement remains saved',()=>{
 const state=initialState();state.pending={kind:'placement',expiresAt:new Date(when+3600000).toISOString()};
 state.placement={level:'Iniciante'};state.mastery={fundamentos:{passed:true}};
 assert.equal(projectLesson(state,'backtest',when).id,'backtest');
 const after=transition(state,{action:'complete_lesson',lessonId:'backtest'},when).state;
 assert.deepEqual(after.placement,state.placement);assert.deepEqual(after.mastery,state.mastery);
 assert.ok(after.completedLessons.includes('backtest'));
});
test('API needs a verified learner but no placement; advanced lesson available with direct query',async()=>{
 const {repo,read}=fixture();
 const response=await handleLearning(req(null,'?lesson=backtest'),{authorize:authorized,repository:repo,db:{},now:when});
 assert.equal(response.status,200);assert.equal((await response.json()).lesson.id,'backtest');
 const saved=await handleLearning(req({action:'complete_lesson',lessonId:'backtest',revision:0}),{authorize:authorized,repository:repo,db:{},now:when});
 assert.equal(saved.status,200);assert.equal((await saved.json()).learning.route[4].lessons.find(x=>x.id==='backtest').completed,true);
 assert.deepEqual(read().state.mastery,{});
 const denied=await handleLearning(req(null,'?lesson=backtest'),{authorize:async()=>{throw Object.assign(Error('deny'),{status:402});},repository:repo,db:{},now:when});
 assert.equal(denied.status,402);
});
test('student page has simple track cards, no placement, no blocked lesson, and no paid trading access',()=>{
 const ui=readFileSync(new URL('../app/components/learning/LearningRoom.js',import.meta.url),'utf8');
 assert.match(ui,/Escolha qualquer trilha/);assert.match(ui,/role="group" aria-label="Escolher trilha de estudos"/);
 assert.match(ui,/aria-pressed/);assert.match(ui,/Marcar aula como lida/);
 assert.doesNotMatch(ui,/start_quiz|submit_quiz|Avaliação inicial|Criar meu perfil de estudo|disabled={!t.unlocked/);
 assert.match(ui,/STUDY_GUIDES/);assert.match(ui,/USER_VIDEO_RESOURCES/);
 assert.doesNotMatch(ui,/localStorage|QUESTION_BANK|\.answer\b/);
});
test('all 56 supplied YouTube resources are distinct, safe links and honestly labeled',()=>{
 assert.equal(USER_VIDEO_RESOURCES.length,56);
 const ids=new Set(USER_VIDEO_RESOURCES.map(x=>x.id));assert.equal(ids.size,56);
 assert.equal(USER_VIDEO_RESOURCES.filter(x=>x.kind==='playlist').length,3);
 assert.equal(USER_VIDEO_RESOURCES.filter(x=>x.verification==='transcript_reviewed').length,13);
 assert.equal(USER_VIDEO_RESOURCES.filter(x=>x.verification==='metadata_verified_no_captions').length,3);
 assert.equal(USER_VIDEO_RESOURCES.filter(x=>x.verification==='metadata_verified_music_only').length,1);
 assert.equal(USER_VIDEO_RESOURCES.filter(x=>x.verification==='needs_video_review').length,36);
 assert.ok(USER_VIDEO_RESOURCES.filter(x=>x.verification==='needs_video_review').every(x=>x.channel===null&&x.trackId==='biblioteca'&&x.title.startsWith('Vídeo enviado para estudo')));
 assert.ok(USER_VIDEO_RESOURCES.every(x=>/^https:\/\/www\.youtube\.com\/(?:watch\?v=|shorts\/|playlist\?list=)/.test(x.url)));
 assert.ok(USER_VIDEO_RESOURCES.every(x=>['transcript_reviewed','metadata_verified_no_captions','metadata_verified_music_only','needs_playlist_review','needs_video_review'].includes(x.verification)));
 assert.ok(USER_VIDEO_RESOURCES.every(x=>x.note&&!x.note.includes('assistido por completo')));
});
test('educational notes are original, one per track, with no quiz gate or calls to trading APIs',()=>{
 assert.equal(STUDY_GUIDES.length,5);assert.deepEqual(new Set(STUDY_GUIDES.map(x=>x.trackId)),new Set(TRACKS.map(x=>x.id)));
 assert.ok(STUDY_GUIDES.every(x=>x.concept.length>80&&x.activity.length>35));
 const resources=readFileSync(new URL('../lib/learning/trade-video-resources.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(resources,/https:\/\/api\.alpaca\.markets|withdraw|signal_generator/);
});
