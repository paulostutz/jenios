import {assistantSameOrigin} from '../platform/connections/request-origin.mjs';
import {readBoundedJson} from '../platform/bounded-response.mjs';
import {conversationError,conversationMemoryEnabled,conversationKeys,conversationText,conversationPersona,
 conversationRevision,validConversationId,CONVERSATION_HEADERS} from './conversation-contract.mjs';
import {resolveConversationActor} from './conversation-actor.mjs';
import {conversationRepository} from './conversation-repository.mjs';
import {loadAccountContext} from './context-authority.mjs';
import {replyWithContext} from './conversational-reply.mjs';
import {salesModelReady} from './sales-provider.mjs';

const inputFields=['persona','message','conversationId','revision','turnId','screen'];
export function normalizeFreeInput(body){
 conversationKeys(body,inputFields);
 const input={persona:conversationPersona(body.persona),message:conversationText(body.message,1800)};
 if(body.screen!=null){
  if(typeof body.screen!=='string'||body.screen.length>160||!/^\/(?:lp|social|platform|genios-pro|universidade|tendencias|bankscore|sala-de-controle)(?:\/[a-z0-9-]+)*\/?$/i.test(body.screen))throw conversationError('Tela de origem inválida.');
  input.screen=body.screen;
 }
 if(['conversationId','revision','turnId'].some(k=>body[k]!=null)){
  if(!validConversationId(body.conversationId)||!validConversationId(body.turnId))throw conversationError('Conversa ou pergunta inválida.');
  input.conversationId=body.conversationId;input.turnId=body.turnId;input.revision=conversationRevision(body.revision);
 }
 return input;
}
/** Same reply engine for visitors and members; durable history is strictly server owned. */
export async function handleFreeAssistant(request,{db,getDb,env=process.env,now=Date.now(),actorResolver=resolveConversationActor,
 repository=conversationRepository,accountLoader=loadAccountContext,reply=replyWithContext,fetcher=fetch}={}){
 let actor,input,repo,claim;
 const respond=(body,status=200)=>Response.json(body,{status,headers:{...CONVERSATION_HEADERS,...(actor?.setCookie?{'Set-Cookie':actor.setCookie}:{})}});
 try{
  if(request.method!=='POST')throw conversationError('Método não permitido.',405);
  if(!assistantSameOrigin(request))throw conversationError('Origem não autorizada.',403);
  if(!/^application\/json(?:;|$)/i.test(request.headers.get('content-type')||''))throw conversationError('Informe JSON.',415);
  let body;try{body=await readBoundedJson(request,10000);}catch{throw conversationError('Pergunta inválida ou acima do limite.',413);}
  input=normalizeFreeInput(body);
  const memoryEnabled=conversationMemoryEnabled(env);
  if(input.conversationId&&!memoryEnabled)throw conversationError('O histórico está temporariamente indisponível. Tente novamente mais tarde.',503,'CONVERSATION_DISABLED');
  if(memoryEnabled||request.headers.has('authorization'))db||=getDb?.();
  else if(!db&&salesModelReady(env))try{db=getDb?.();}catch{db=null;}
  if(memoryEnabled||request.headers.has('authorization'))actor=await actorResolver(request,{db,env,now});
  let conversation=null;
  if(input.conversationId){
   repo=repository(db,actor);
   // Read enforces channel/ownership before an idempotent turn can be claimed.
   conversation=await repo.read(input.conversationId,'support');
   claim=await repo.claimTurn({id:input.conversationId,turnId:input.turnId,revision:input.revision,question:input.message});
   if(claim.state==='completed')return respond({ok:true,free:true,paidAi:false,persona:input.persona,name:input.persona==='genia'?'Gênia':'Gênio',mode:'replayed',
    explanation:claim.turn.answer,articles:claim.turn.articles||[],conversation:claim.conversation,replayed:true,modelCalls:0,executionEnabled:false});
   if(claim.state!=='claimed')return respond({ok:false,code:'CONVERSATION_TURN_'+String(claim.state).toUpperCase(),
    error:claim.state==='pending'?'A resposta já está em processamento. Atualize esta conversa.':'Esta pergunta já foi registrada. Confira o histórico antes de iniciar uma nova pergunta.',
    conversation:claim.conversation,executionEnabled:false},claim.state==='pending'?202:409);
  }
  const accountContext=actor?.kind==='user'?await accountLoader(db,actor.user,{env,now}):null;
  const result=await reply({message:input.message,persona:input.persona,turns:conversation?.turns||[],summary:conversation?.summary||null,
   toolContext:conversation?.toolContext||null,screen:input.screen,accountContext},{env,db,request,fetcher,now});
  let sync={};
  if(claim?.leaseToken){
   try{
    const completed=await repo.completeTurn({id:input.conversationId,turnId:input.turnId,leaseToken:claim.leaseToken,
     answer:result.explanation,articles:result.articles||[],summary:result.summary});
    sync={conversation:completed.conversation};
   }catch{sync={conversationSyncPending:true};}
  }
  return respond({...result,...sync,executionEnabled:false,subscriptionGranted:false,monitoringEnabled:false});
 }catch(error){
  if(claim?.leaseToken)try{await repo.failTurn({id:input.conversationId,turnId:input.turnId,leaseToken:claim.leaseToken,code:'SUPPORT_FAILED'});}catch{}
  return respond({ok:false,error:error.status?error.message:'Atendimento temporariamente indisponível.',code:error.code||'SUPPORT_UNAVAILABLE',executionEnabled:false},
   [400,401,403,404,405,409,413,415,429,503].includes(error.status)?error.status:503);
 }
}
