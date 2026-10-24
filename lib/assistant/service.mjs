import {requirePayUser,requirePayToken} from '../pay/auth.mjs';
import {createHash} from 'node:crypto';
import {boundedJson} from '../learning/service.mjs';
import {ASSISTANT_HEADERS,assistantError,reserveAssistant,projectAssistant} from './contracts.mjs';
import {assistantRepository} from './repository.mjs';
import {validateAssistantBody} from './validation.mjs';
import {answerSupport} from './reply.mjs';
import {reserveGenerativeBudget} from './generative-budget.mjs';
import {invokeExistingTool,projectToolResult} from './tools.mjs';
import {conversationRepository} from './conversation-repository.mjs';
import {conversationMemoryEnabled} from './conversation-contract.mjs';
import {replyWithContext} from './conversational-reply.mjs';
import {prepareConversationContext,updateConversationSummary} from './context-resolution.mjs';
import {loadAccountContext,toolContextFromResult} from './context-authority.mjs';
import {salesModelReady} from './sales-provider.mjs';
const toolQuestions=Object.freeze({trends:'Consultar o Hub de Tendências',bankscore_search:'Pesquisar instituições no BankScore',
 bankscore_basic:'Consultar o BankScore básico',bankscore_full:'Consultar o relatório completo do BankScore',
 crypto_basic:'Consultar o Validador de criptoativos',crypto_full:'Consultar o relatório completo de criptoativos'});
async function readBounded(response,max){
 const r=response.body?.getReader();if(!r)throw assistantError('Resposta vazia.',502);
 const chunks=[];let size=0;try{while(true){const x=await r.read();if(x.done)break;size+=x.value.length;if(size>max){await r.cancel();throw assistantError('Resposta excede o limite deste atendimento. Use o módulo original.',502);}chunks.push(x.value);}}finally{r.releaseLock();}
 const bytes=new Uint8Array(size);let p=0;for(const b of chunks){bytes.set(b,p);p+=b.length;}return bytes;
}
export async function handleAssistant(request,{db,authorize=requirePayUser,repository=assistantRepository,reply=answerSupport,handlers={},env=process.env,now=Date.now(),
 memoryRepository=conversationRepository,contextReply=replyWithContext,accountLoader=loadAccountContext}={}){
 let revision=null,memory,claim,input,conversation,conversationResult={};
 const complete=async(result,prepared,toolContext)=>{
  if(!claim?.leaseToken)return;
  const answer=result.explanation||[result.title,...(result.facts||[]).map(f=>f.label+': '+f.value)].filter(Boolean).join('\n')||'Consulta concluída. Confira os detalhes no módulo original.';
  try{
   const done=await memory.completeTurn({id:input.conversationId,turnId:input.turnId,leaseToken:claim.leaseToken,answer,
    articles:result.articles||[],summary:result.summary||updateConversationSummary(prepared,{answer,now}),...(toolContext!==undefined?{toolContext}:{})});
   conversationResult={conversation:done.conversation};
  }catch{conversationResult={conversationSyncPending:true};}
 };
 try{
  requirePayToken(request);const user=await authorize(request,db);if(!user?.id||user.is_anonymous)throw assistantError('Entre na sua conta.',401);
  if(!['GET','POST'].includes(request.method))throw assistantError('Método não permitido.',405);
  input=request.method==='POST'?validateAssistantBody(await boundedJson(request)):null;
  const repo=repository(db,user.id);let row=await repo.read();
  const respond=result=>Response.json({ok:true,assistant:projectAssistant(row,env,{contextualAiReady:salesModelReady(env)}),result,...conversationResult},{headers:ASSISTANT_HEADERS});
  if(!input)return respond(null);
  if(input.conversationId){
   if(!conversationMemoryEnabled(env))throw assistantError('O histórico está temporariamente indisponível.',503,'CONVERSATION_DISABLED');
   memory=memoryRepository(db,{kind:'user',ownerId:user.id,userId:user.id,user});
   conversation=await memory.read(input.conversationId,'support');
   const exists=conversation.turns?.some(t=>t.turnId===input.turnId);
   if(!exists&&input.revision!==row.revision)throw assistantError('O atendimento mudou em outra aba. Atualize antes de continuar.',409,'REVISION_CONFLICT');
   const question=input.action==='ask'?input.message:toolQuestions[input.tool]+(input.input.network?' na rede '+input.input.network:'')+(input.format==='pdf'?' (PDF)':'')+'.';
   const requestFingerprint=input.action==='tool'?createHash('sha256').update(JSON.stringify({tool:input.tool,input:input.input,format:input.format})).digest('hex'):undefined;
   claim=await memory.claimTurn({id:input.conversationId,turnId:input.turnId,revision:input.conversationRevision,question,...(requestFingerprint?{requestFingerprint}:{})});
   conversationResult={conversation:claim.conversation};
   if(claim.state==='completed')return respond({mode:'guided',explanation:claim.turn.answer,articles:claim.turn.articles,replayed:true,executionEnabled:false});
   if(claim.state!=='claimed')throw assistantError('Esta consulta já foi registrada. Confira o histórico; nenhum serviço será chamado novamente.',409,'CONVERSATION_TURN_PENDING');
  }
  if(input.revision!==row.revision)throw assistantError('O atendimento mudou em outra aba. Atualize antes de continuar.',409,'REVISION_CONFLICT');
  if(input.action==='preferences'){
   row=await repo.write(row.revision,{...row.state,persona:input.persona,aiConsent:input.aiConsent});return respond(null);
  }
  // Compare-and-swap reservation is persisted BEFORE provider/AI calls; retries cannot reset quota.
  row=await repo.write(row.revision,reserveAssistant(row.state,now));revision=row.revision;
  if(input.action==='ask'){
   if(!memory)return respond(await reply(input.message,row.state,{env,spend:()=>reserveGenerativeBudget(db,env,'assistant',now)}));
   const accountContext=await accountLoader(db,user,{env,now});
   const context={message:input.message,persona:row.state.persona,turns:conversation.turns,summary:conversation.summary,
    toolContext:conversation.toolContext,accountContext,screen:'/platform/assistente/consultas'};
   const result=await contextReply(context,{db,request,env:row.state.aiConsent?env:{...env,JENIOS_SALES_GENERATIVE_ENABLED:'false'},now});
   await complete(result,prepareConversationContext(context,{now}));return respond(result);
  }
  const response=await invokeExistingTool(input,request.headers.get('authorization'),handlers);
  if(!response.ok){await response.body?.cancel();throw assistantError([401,402,403].includes(response.status)?'A consulta original não autorizou este acesso. Confira sua conta e a regra vigente do relatório.':response.status===429?'O serviço atingiu o limite de consultas. Tente novamente mais tarde.':'A fonte não confirmou esta consulta. Use o módulo original ou tente novamente.',[401,402,403,429].includes(response.status)?response.status:503,'SOURCE_UNAVAILABLE');}
  if(input.format==='pdf'){
   if(!(response.headers.get('content-type')||'').toLowerCase().includes('application/pdf'))throw assistantError('O serviço não retornou um PDF.',502);
   const bytes=await readBounded(response,5*1024*1024);
   if(new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')throw assistantError('PDF inválido.',502);
   if(memory)await complete({explanation:'O relatório PDF foi preparado pelo serviço autorizado. O arquivo deve ser consultado no módulo original.'},
    prepareConversationContext({message:'Relatório '+input.tool,persona:row.state.persona,turns:conversation.turns,summary:conversation.summary},{now}),null);
   return new Response(bytes,{headers:{...ASSISTANT_HEADERS,'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="jenios-${input.tool.startsWith('bankscore')?'bankscore':'cripto'}-completo.pdf"`,'X-Jenios-Revision':String(row.revision)}});
  }
  const bytes=await readBounded(response,2*1024*1024);let data;try{data=JSON.parse(new TextDecoder().decode(bytes));}catch{throw assistantError('A fonte retornou formato inválido.',502);}
  if(!data||typeof data!=='object'||Array.isArray(data)||data.ok===false||data.error||data.erro)throw assistantError('Consulta não confirmada pela fonte.',503);
  const result=projectToolResult(input,data,now);
  if(memory)await complete(result,prepareConversationContext({message:'Explique a consulta '+input.tool,persona:row.state.persona,turns:conversation.turns,summary:conversation.summary},{now}),toolContextFromResult(result));
  return respond(result);
 }catch(error){
  if(claim?.leaseToken)try{await memory.failTurn({id:input.conversationId,turnId:input.turnId,leaseToken:claim.leaseToken,code:'TOOL_OR_SUPPORT_FAILED'});}catch{}
  return Response.json({ok:false,error:error.status?error.message:'Atendimento temporariamente indisponível.',code:error.code||'ASSISTANT_UNAVAILABLE',...(revision!==null?{revision}:{}),...conversationResult,executionEnabled:false},{status:error.status||503,headers:ASSISTANT_HEADERS});
 }
}
