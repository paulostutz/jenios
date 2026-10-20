import {requireLearner} from './access.mjs';
import {learnerRepository} from './repository.mjs';
import {transition,projectState,projectLesson,reserveTutor,learningError,replayedSubmission} from './engine.mjs';
import {tutorInput,replyAsTutor,teacherReady} from './tutor.mjs';
import {reserveGenerativeBudget} from '../assistant/generative-budget.mjs';
export const LEARNING_HEADERS={'Cache-Control':'private, no-store','Vary':'Authorization','X-Content-Type-Options':'nosniff'};
export async function boundedJson(request){
 if(!/^application\/json(?:;|$)/i.test(request.headers.get('content-type')||''))throw learningError('Use JSON nesta requisição.',415);
 const reader=request.body?.getReader();if(!reader)throw learningError('Requisição vazia.');
 let bytes=0,chunks=[];try{while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>16000){await reader.cancel();throw learningError('Requisição muito grande.',413);}chunks.push(value);}}finally{reader.releaseLock();}
 const all=new Uint8Array(bytes);let offset=0;for(const chunk of chunks){all.set(chunk,offset);offset+=chunk.length;}
 let body;try{body=JSON.parse(new TextDecoder().decode(all));}catch{throw learningError('JSON inválido.');}
 if(!body||typeof body!=='object'||Array.isArray(body))throw learningError('Requisição inválida.');return body;
}
export async function handleLearning(request,{db,authorize=requireLearner,repository=learnerRepository,teacher=replyAsTutor,now=Date.now(),env=process.env}={}){
 let changedRevision=null;
 try{
  const {user,access}=await authorize(request,db,now,env),repo=repository(db,user.id),row=await repo.read();
  const response=(state,revision,result=null)=>Response.json({ok:true,access,learning:projectState(state,revision,now),result,tutor:{configured:teacherReady(env)}},{headers:LEARNING_HEADERS});
  if(request.method==='GET'){
   const url=new URL(request.url),id=url.searchParams.get('lesson');
   if(id)return Response.json({ok:true,lesson:projectLesson(row.state,id,now)},{headers:LEARNING_HEADERS});
   return response(row.state,row.revision);
  }
  if(request.method!=='POST')throw learningError('Método não permitido.',405);
  const body=await boundedJson(request),{revision,...input}=body;
  // Retried successful quiz submission is idempotent even after the revision advanced.
  const prior=replayedSubmission(row.state,input);if(prior)return response(row.state,row.revision,prior);
  if(!Number.isSafeInteger(revision)||revision!==row.revision)throw learningError('Progresso alterado em outra aba. Atualize e tente novamente.',409,'REVISION_CONFLICT');
  if(input.action==='tutor'){
   if(Object.keys(input).some(k=>!['action','lessonId','message','style'].includes(k)))throw learningError('Parâmetro não permitido.');
   const prepared=tutorInput(row.state,input),reserved=reserveTutor(row.state,now);
   const saved=await repo.write(row.revision,reserved);changedRevision=saved.revision;
   const reply=await teacher(prepared,reserved,{env,spend:()=>reserveGenerativeBudget(db,env,'tutor',now)});
   return response(saved.state,saved.revision,reply);
  }
  const result=transition(row.state,input,now);
  const saved=await repo.write(row.revision,result.state);
  return response(saved.state,saved.revision,result.result);
 }catch(error){
  return Response.json({ok:false,error:error.status?error.message:'O módulo não conseguiu concluir a operação. Tente novamente.',code:error.code||'LEARNING_UNAVAILABLE',...(changedRevision!==null?{revision:changedRevision}:{}),executionEnabled:false},{status:error.status||503,headers:LEARNING_HEADERS});
 }
}
