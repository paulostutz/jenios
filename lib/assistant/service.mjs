import {requirePayUser,requirePayToken} from '../pay/auth.mjs';
import {boundedJson} from '../learning/service.mjs';
import {ASSISTANT_HEADERS,assistantError,reserveAssistant,projectAssistant} from './contracts.mjs';
import {assistantRepository} from './repository.mjs';
import {validateAssistantBody} from './validation.mjs';
import {answerSupport} from './reply.mjs';
import {invokeExistingTool,projectToolResult} from './tools.mjs';
async function readBounded(response,max){
 const r=response.body?.getReader();if(!r)throw assistantError('Resposta vazia.',502);
 const chunks=[];let size=0;try{while(true){const x=await r.read();if(x.done)break;size+=x.value.length;if(size>max){await r.cancel();throw assistantError('Resposta excede o limite deste atendimento. Use o módulo original.',502);}chunks.push(x.value);}}finally{r.releaseLock();}
 const bytes=new Uint8Array(size);let p=0;for(const b of chunks){bytes.set(b,p);p+=b.length;}return bytes;
}
export async function handleAssistant(request,{db,authorize=requirePayUser,repository=assistantRepository,reply=answerSupport,handlers={},env=process.env,now=Date.now()}={}){
 let revision=null;
 try{
  requirePayToken(request);const user=await authorize(request,db);if(!user?.id||user.is_anonymous)throw assistantError('Entre na sua conta.',401);
  if(!['GET','POST'].includes(request.method))throw assistantError('Método não permitido.',405);
  const input=request.method==='POST'?validateAssistantBody(await boundedJson(request)):null;
  const repo=repository(db,user.id);let row=await repo.read();
  const respond=result=>Response.json({ok:true,assistant:projectAssistant(row,env),result},{headers:ASSISTANT_HEADERS});
  if(!input)return respond(null);
  if(input.revision!==row.revision)throw assistantError('O atendimento mudou em outra aba. Atualize antes de continuar.',409,'REVISION_CONFLICT');
  if(input.action==='preferences'){
   row=await repo.write(row.revision,{...row.state,persona:input.persona,aiConsent:input.aiConsent});return respond(null);
  }
  // Compare-and-swap reservation is persisted BEFORE provider/AI calls; retries cannot reset quota.
  row=await repo.write(row.revision,reserveAssistant(row.state,now));revision=row.revision;
  if(input.action==='ask')return respond(await reply(input.message,row.state,{env}));
  const response=await invokeExistingTool(input,request.headers.get('authorization'),handlers);
  if(!response.ok){await response.body?.cancel();throw assistantError([401,402,403].includes(response.status)?'A consulta original não autorizou este acesso. Confira sua conta e a regra vigente do relatório.':response.status===429?'O serviço atingiu o limite de consultas. Tente novamente mais tarde.':'A fonte não confirmou esta consulta. Use o módulo original ou tente novamente.',[401,402,403,429].includes(response.status)?response.status:503,'SOURCE_UNAVAILABLE');}
  if(input.format==='pdf'){
   if(!(response.headers.get('content-type')||'').toLowerCase().includes('application/pdf'))throw assistantError('O serviço não retornou um PDF.',502);
   const bytes=await readBounded(response,5*1024*1024);
   if(new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')throw assistantError('PDF inválido.',502);
   return new Response(bytes,{headers:{...ASSISTANT_HEADERS,'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="jenios-${input.tool.startsWith('bankscore')?'bankscore':'cripto'}-completo.pdf"`,'X-Jenios-Revision':String(row.revision)}});
  }
  const bytes=await readBounded(response,2*1024*1024);let data;try{data=JSON.parse(new TextDecoder().decode(bytes));}catch{throw assistantError('A fonte retornou formato inválido.',502);}
  if(!data||typeof data!=='object'||Array.isArray(data)||data.ok===false||data.error||data.erro)throw assistantError('Consulta não confirmada pela fonte.',503);
  return respond(projectToolResult(input,data,now));
 }catch(error){return Response.json({ok:false,error:error.status?error.message:'Atendimento temporariamente indisponível.',code:error.code||'ASSISTANT_UNAVAILABLE',...(revision!==null?{revision}:{}),executionEnabled:false},{status:error.status||503,headers:ASSISTANT_HEADERS});}
}