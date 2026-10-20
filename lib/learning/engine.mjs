import {randomUUID, randomInt, createHash} from 'node:crypto';
import {CURRICULUM_VERSION, TRACKS, LESSONS, SOURCES, lessonById} from './catalog.mjs';
import {QUESTION_BANK} from './question-bank.mjs';
export const LEARNING_POLICY=Object.freeze({passRate:.8,quizMinutes:30,attemptsPerTrackPerDay:5,tutorPerDay:40,tutorCooldownMs:2500,reviewDays:[1,3,7,14,30,60,90]});
export const learningError=(message,status=400,code='INVALID_REQUEST')=>Object.assign(Error(message),{status,code});
const day=now=>new Date(now).toISOString().slice(0,10);
const clone=value=>JSON.parse(JSON.stringify(value));
export function initialState(){return {version:CURRICULUM_VERSION,onboarding:null,persona:'genio',aiConsent:false,placement:null,completedLessons:[],mastery:{},pending:null,attempts:{},assessments:[],usage:{day:'',count:0,lastAt:0},lastSubmission:null,reviewDiary:[]};}
export function checkState(state){if(!state||state.version!==CURRICULUM_VERSION)throw learningError('O conteúdo foi atualizado. A evolução precisa ser migrada sem perder seu histórico.',409,'CURRICULUM_CHANGED');}
const shuffled=(items,rand=randomInt)=>{const out=[...items];for(let i=out.length-1;i>0;i--){const j=rand(i+1);[out[i],out[j]]=[out[j],out[i]];}return out;};
export function trackUnlocked(state,id){const t=TRACKS.find(x=>x.id===id);return Boolean(state.placement&&t&&t.requires.every(x=>state.mastery[x]?.passed));}
export function availableLessons(state){return LESSONS.filter(l=>trackUnlocked(state,l.trackId)).map(l=>l.id);}
export function assessPlacement(results){
 const total=results.length,correct=results.filter(x=>x.correct).length;
 const safe=results.filter(x=>x.critical).every(x=>x.correct);
 const rate=total?correct/total:0;
 const level=!safe||rate<.4?'Iniciante':rate<.65?'Básico':rate<.85?'Intermediário':'Avançado';
 const byTrack=Object.fromEntries(TRACKS.map(t=>{const a=results.filter(x=>x.trackId===t.id);return [t.id,{correct:a.filter(x=>x.correct).length,total:a.length}];}));
 return {level,correct,total,rate,safetyReviewRequired:!safe,byTrack};
}
export function buildLearningRoute(state,now=Date.now()){
 return TRACKS.map(t=>{const score=state.placement?.byTrack?.[t.id],known=score?.total>0&&score.correct/score.total>=.8;
  const mastery=state.mastery[t.id],due=mastery?.passed&&Date.parse(mastery.reviewAt)<=now;
  const lessons=LESSONS.filter(l=>l.trackId===t.id);
  if(t.id==='fundamentos'&&state.placement?.safetyReviewRequired)lessons.sort((a,b)=>(a.id==='risco'?-1:b.id==='risco'?1:0));
  return {...t,pace:known?'Revisão + avaliação':'Aula completa + prática',unlocked:trackUnlocked(state,t.id),passed:mastery?.passed===true,score:mastery?.score??null,sessionsSuggested:Math.ceil(lessons.reduce((n,l)=>n+(known?Math.max(5,Math.round(l.minutes*.6)):l.minutes),0)/(state.onboarding?.minutes||20)),reviewAt:mastery?.reviewAt||null,reviewDue:Boolean(due),lessons:lessons.map(l=>({id:l.id,title:l.title,minutes:l.minutes,completed:state.completedLessons.includes(l.id)}))};
 });
}
export function newQuiz(state,kind,now=Date.now(),rand=randomInt){
 if(!state.onboarding)throw learningError('Conclua o perfil de estudo primeiro.',409,'ONBOARDING_REQUIRED');
 if(state.pending&&Date.parse(state.pending.expiresAt)>now){if(state.pending.kind!==kind)throw learningError('Conclua a avaliação em andamento.',409,'ASSESSMENT_ACTIVE');return state.pending;}
 if(kind==='placement'&&state.placement)throw learningError('Sua avaliação inicial já foi registrada.',409,'PLACEMENT_COMPLETE');
 if(kind!=='placement'){
  if(!trackUnlocked(state,kind))throw learningError('Conclua os pré-requisitos desta trilha.',403,'TRACK_LOCKED');
  const lessons=LESSONS.filter(l=>l.trackId===kind);
  if(!lessons.every(l=>state.completedLessons.includes(l.id)))throw learningError('Estude e marque as aulas desta trilha antes da avaliação.',409,'LESSONS_REQUIRED');
 }
 const key=day(now)+':'+kind;
 if((state.attempts[key]||0)>=LEARNING_POLICY.attemptsPerTrackPerDay)throw learningError('Limite de avaliações do dia atingido. Revise o conteúdo e retome amanhã.',429,'ASSESSMENT_LIMIT');
 const pool=QUESTION_BANK.filter(q=>kind==='placement'?q.placement:q.trackId===kind);
 if(!pool.length)throw learningError('Avaliação desconhecida.');
 const mandatory=kind==='placement'?pool:pool.filter(q=>q.critical);
 const extra=kind==='placement'?[]:shuffled(pool.filter(q=>!q.critical),rand).slice(0,6-mandatory.length);
 const questions=shuffled([...mandatory,...extra],rand).map(q=>({id:q.id,order:shuffled(q.options.map((_,i)=>i),rand)}));
 state.attempts=Object.fromEntries(Object.entries(state.attempts).filter(([k])=>k.startsWith(day(now)+':')));
 state.attempts[key]=(state.attempts[key]||0)+1;
 return {id:randomUUID(),kind,version:CURRICULUM_VERSION,createdAt:new Date(now).toISOString(),expiresAt:new Date(now+LEARNING_POLICY.quizMinutes*60000).toISOString(),questions};
}
export function projectQuiz(quiz){if(!quiz)return null;return {id:quiz.id,kind:quiz.kind,expiresAt:quiz.expiresAt,questions:quiz.questions.map(item=>{const q=QUESTION_BANK.find(x=>x.id===item.id);return {id:q.id,prompt:q.prompt,options:item.order.map(i=>q.options[i])};})};}
export function gradeQuiz(quiz,answers,now=Date.now()){
 if(!quiz||quiz.version!==CURRICULUM_VERSION||Date.parse(quiz.expiresAt)<=now)throw learningError('A avaliação expirou. Inicie outra tentativa.',409,'ASSESSMENT_EXPIRED');
 if(!answers||typeof answers!=='object'||Array.isArray(answers))throw learningError('Respostas inválidas.');
 const ids=quiz.questions.map(q=>q.id);
 if(Object.keys(answers).length!==ids.length||Object.keys(answers).some(id=>!ids.includes(id)))throw learningError('Responda todas as perguntas desta avaliação.');
 const details=quiz.questions.map(item=>{const q=QUESTION_BANK.find(x=>x.id===item.id),a=answers[item.id];
  if(!Number.isInteger(a)||a<0||a>=item.order.length)throw learningError('Alternativa inválida.');
  return {id:q.id,trackId:q.trackId,correct:item.order[a]===q.answer,critical:q.critical,explanation:q.explanation};
 });
 const correct=details.filter(x=>x.correct).length,total=details.length,criticalPassed=details.filter(x=>x.critical).every(x=>x.correct);
 return {correct,total,score:Math.round(correct/total*100),passed:correct/total>=LEARNING_POLICY.passRate&&criticalPassed,criticalPassed,details};
}
function onlyKeys(obj,allowed){if(Object.keys(obj).some(k=>!allowed.includes(k)))throw learningError('Parâmetro não permitido.');}
export function replayedSubmission(state,input){
 if(input.action!=='submit_quiz')return null;
 onlyKeys(input,['action','attemptId','answers']);
 if(state.lastSubmission?.attemptId!==input.attemptId)return null;
 const hash=submissionHash(input);
 if(!state.lastSubmissionRequestHash||hash!==state.lastSubmissionRequestHash)throw learningError('O identificador desta avaliação já foi utilizado. Atualize para consultar o resultado salvo; não reenvie respostas diferentes.',409,'IDEMPOTENCY_CONFLICT');
 return state.lastSubmission;
}
function submissionHash(input){
 const a=input.answers;
 if(!a||typeof a!=='object'||Array.isArray(a)||!Object.keys(a).length||Object.values(a).some(x=>!Number.isInteger(x)||x<0||x>3))throw learningError('Respostas inválidas.');
 const canonical=JSON.stringify([input.attemptId,Object.keys(a).sort().map(k=>[k,a[k]])]);
 return createHash('sha256').update(canonical).digest('hex');
}
export function transition(old,input,now=Date.now()){
 checkState(old);if(!input||typeof input!=='object'||Array.isArray(input))throw learningError('Requisição inválida.');
 const s=clone(old);let result=null;
 switch(input.action){
 case 'onboard':{
  onlyKeys(input,['action','experience','goal','minutes','persona','aiConsent']);
  if(s.placement||s.pending)throw learningError('A pesquisa inicial já foi concluída. Ajuste as preferências.',409);
  if(!['new','some','regular'].includes(input.experience)||!['fundamentals','day','swing','research'].includes(input.goal)||![10,20,40].includes(input.minutes)||!['genio','genia'].includes(input.persona)||typeof input.aiConsent!=='boolean')throw learningError('Confira as escolhas do perfil de estudo.');
  s.onboarding={experience:input.experience,goal:input.goal,minutes:input.minutes,at:new Date(now).toISOString()};s.persona=input.persona;s.aiConsent=input.aiConsent;break;}
 case 'preferences':{
  onlyKeys(input,['action','persona','aiConsent']);
  if(!['genio','genia'].includes(input.persona)||typeof input.aiConsent!=='boolean')throw learningError('Preferência inválida.');
  s.persona=input.persona;s.aiConsent=input.aiConsent;break;}
 case 'start_quiz':{
  onlyKeys(input,['action','kind']);s.pending=newQuiz(s,input.kind,now);break;}
 case 'submit_quiz':{
  onlyKeys(input,['action','attemptId','answers']);
  const prior=replayedSubmission(s,input);if(prior)return {state:s,result:prior,idempotent:true};
  if(!s.pending||s.pending.id!==input.attemptId)throw learningError('Avaliação não pertence à tentativa atual.',409,'ATTEMPT_MISMATCH');
  const graded=gradeQuiz(s.pending,input.answers,now),kind=s.pending.kind;
  if(kind==='placement')s.placement={...assessPlacement(graded.details),at:new Date(now).toISOString()};
  else {
   const previous=s.mastery[kind]||{},pass=graded.passed,reviewCount=(previous.reviewCount||0)+(previous.passed&&pass?1:0);
   // A failed review does not erase a previous pass, but marks immediate remediation.
   s.mastery[kind]={...previous,passed:previous.passed||pass,score:graded.score,lastPassed:pass,reviewCount,reviewAt:new Date(now+(pass?LEARNING_POLICY.reviewDays[Math.min(reviewCount,LEARNING_POLICY.reviewDays.length-1)]:0)*86400000).toISOString(),at:new Date(now).toISOString()};
  }
  s.assessments=[...(s.assessments||[]),{id:input.attemptId,kind,at:new Date(now).toISOString(),correct:graded.correct,total:graded.total,score:graded.score,passed:graded.passed,version:CURRICULUM_VERSION}].slice(-120);
  result={attemptId:input.attemptId,kind,...graded,placement:kind==='placement'?s.placement:null};s.lastSubmission=result;s.lastSubmissionRequestHash=submissionHash(input);s.pending=null;break;}
 case 'review_lesson':{
   onlyKeys(input,['action','lessonId']);
   if(s.pending&&Date.parse(s.pending.expiresAt)>now)throw learningError('Conclua a avaliação em andamento.',409,'ASSESSMENT_ACTIVE');
   const lesson=lessonById(input.lessonId);
   if(!lesson||!trackUnlocked(s,lesson.trackId)||!s.completedLessons.includes(input.lessonId))
    throw learningError('Conclua a aula antes de registrar uma revisão.',403,'LESSON_NOT_COMPLETED');
   const today=day(now),log=Array.isArray(s.reviewDiary)?s.reviewDiary:[];
   if(!log.some(r=>r.day===today&&r.lessonId===lesson.id)){
    if(log.filter(r=>r.day===today).length>=15)throw learningError('As quinze revisões diárias já foram registradas.',429,'REVIEW_DAILY_LIMIT');
    s.reviewDiary=[...log.slice(-179),{lessonId:lesson.id,day:today,at:new Date(now).toISOString()}];
    result={reviewed:true,day:today,lessonId:lesson.id};
   }else result={reviewed:true,alreadyRegistered:true,day:today,lessonId:lesson.id};
   break;
  }
  case 'complete_lesson':{
  onlyKeys(input,['action','lessonId']);
  if(s.pending&&Date.parse(s.pending.expiresAt)>now)throw learningError('Conclua a avaliação em andamento.',409,'ASSESSMENT_ACTIVE');
  const l=lessonById(input.lessonId);if(!l||!trackUnlocked(s,l.trackId))throw learningError('Aula ainda não liberada.',403,'LESSON_LOCKED');
  if(!s.completedLessons.includes(l.id))s.completedLessons.push(l.id);break;}
 default:throw learningError('Ação de aprendizagem desconhecida.');
 }
 return {state:s,result};
}
export function reserveTutor(state,now=Date.now()){
 checkState(state);if(!state.onboarding||!state.placement)throw learningError('Faça a avaliação inicial antes de conversar com o professor.',409);
 if(state.pending&&Date.parse(state.pending.expiresAt)>now)throw learningError('O professor fica em pausa durante avaliações. Envie suas respostas primeiro.',409,'ASSESSMENT_ACTIVE');
 const s=clone(state),usage=s.usage||{};
 if(now-usage.lastAt<LEARNING_POLICY.tutorCooldownMs)throw learningError('Aguarde um instante entre as perguntas.',429,'TUTOR_RATE_LIMIT');
 const count=usage.day===day(now)?usage.count:0;
 if(count>=LEARNING_POLICY.tutorPerDay)throw learningError('Você atingiu o limite diário de conversas. As aulas e revisões continuam disponíveis.',429,'TUTOR_DAILY_LIMIT');
 s.usage={day:day(now),count:count+1,lastAt:now};return s;
}
/** The daily plan is derived solely from existing confirmed progress and reviews. */
export function dailyStudyPlan(state,now=Date.now()){
 checkState(state);
 const today=day(now),log=Array.isArray(state.reviewDiary)?state.reviewDiary:[];
 const route=buildLearningRoute(state,now);
 const due=route.filter(t=>t.reviewDue&&t.unlocked).map(t=>({id:t.id,title:t.title,reviewAt:t.reviewAt}));
 const unlocked=route.filter(t=>t.unlocked).flatMap(t=>t.lessons.map(l=>({...l,trackId:t.id})));
 const unfinished=unlocked.find(l=>!l.completed),available=unlocked.filter(l=>l.completed);
 const candidate=unfinished||available.find(l=>due.some(t=>t.id===l.trackId)&&!log.some(r=>r.day===today&&r.lessonId===l.id))
  ||(available.length?available[Math.floor(now/86400000)%available.length]:null);
 const dates=new Set(log.map(x=>x.day));
 let start=Date.parse(today+'T00:00:00Z'),streakDays=0;
 if(!dates.has(today))start-=86400000;
 for(let cursor=start;streakDays<365&&dates.has(day(cursor));cursor-=86400000)streakDays++;
 const nextReviewAt=route.filter(t=>t.reviewAt&&t.unlocked).map(t=>t.reviewAt).sort()[0]||null;
 return {date:today,minutes:state.onboarding?.minutes||20,studiedToday:log.filter(x=>x.day===today).length,streakDays,
  due,reviewedToday:log.filter(x=>x.day===today).map(x=>x.lessonId),
  suggestedLesson:candidate?{id:candidate.id,title:candidate.title,trackId:candidate.trackId,completed:candidate.completed}:null,
  nextReviewAt,totalReviewSessions:log.length};
}
export function projectState(state,revision,now=Date.now()){
 checkState(state);
 return {version:state.version,revision,onboarding:state.onboarding,persona:state.persona,aiConsent:state.aiConsent,placement:state.placement,route:buildLearningRoute(state,now),quiz:projectQuiz(state.pending),lastSubmission:state.lastSubmission,
  currentLessonId:buildLearningRoute(state,now).filter(t=>t.unlocked).flatMap(t=>t.lessons).find(l=>!l.completed)?.id||null,assessmentHistory:state.assessments||[],dailyStudy:dailyStudyPlan(state,now),
  tutorBudget:{limit:LEARNING_POLICY.tutorPerDay,used:state.usage.day===day(now)?state.usage.count:0},executionEnabled:false,
  notice:'Avaliação educativa, não teste de inteligência, certificação profissional ou liberação para conta real.'};
}
export function projectLesson(state,id,now=Date.now()){
 checkState(state);
 const lesson=lessonById(id);if(!lesson||!trackUnlocked(state,lesson.trackId))throw learningError('Aula não liberada.',403,'LESSON_LOCKED');
 if(state.pending&&Date.parse(state.pending.expiresAt)>now)throw learningError('Aulas e tutor ficam em pausa durante avaliações.',409,'ASSESSMENT_ACTIVE');
 return {...lesson,sources:SOURCES.filter(x=>lesson.sourceIds.includes(x.id))};
}