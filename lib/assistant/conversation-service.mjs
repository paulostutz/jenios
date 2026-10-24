import {assistantSameOrigin} from '../platform/connections/request-origin.mjs';
import {CONVERSATION_HEADERS,conversationMemoryEnabled,conversationError,conversationKeys,conversationChannel,validConversationId,
 normalizeConversationArticles,normalizeConversationSummary,conversationText} from './conversation-contract.mjs';
import {resolveConversationActor} from './conversation-actor.mjs';
import {conversationRepository} from './conversation-repository.mjs';
import {prepareConversationContext,updateConversationSummary} from './context-resolution.mjs';
import {interpretSupport,supportArticleById} from './knowledge.mjs';
import {commercialPlans} from './sales-policy.mjs';

/** The candidate comes exclusively from the owner/ledger-checked G44 RPC.
 * Rebuild conversational references, never account rights or a fresh market fact.
 * The paid answer is immutable. User corrections keep their original timestamp
 * and remain unverified; URLs/article objects in user text are never imported. */
export function reconstructSettledProContext(candidate,{now=Date.now()}={}){
 if(candidate?.eligible!==true||candidate.conversation?.channel!=='pro'||!validConversationId(candidate.turn?.turnId))
  throw conversationError('O turno liquidado não foi confirmado.',409,'CONVERSATION_REPAIR_CONFLICT');
 const {turn,conversation}=candidate;
 const at=Date.parse(turn.createdAt);
 if(!Number.isFinite(at)||at>now+60000)throw conversationError('A data do turno não foi confirmada.',409,'CONVERSATION_REPAIR_CONFLICT');
 const answer=conversationText(turn.answer,16000),question=conversationText(turn.question,2500);
 const prepared=prepareConversationContext({message:question,persona:turn.persona||conversation.persona,
  turns:candidate.previousTurns||[],summary:candidate.priorSummary||null},{now:at});
 const answerIntent=interpretSupport(answer),answerPlans=commercialPlans(answer);
 // Agreement with the settled answer is required before attaching a source.
 // Reference metadata always comes from today's approved catalog, not from the
 // ledger's free text, a user claim, or an arbitrary stored title/href.
 const supportedIds=new Set(answerIntent.articles.map(article=>article.id));
 if(prepared.intent.topic==='plans'&&answerPlans.length)supportedIds.add('plans');
 const articles=normalizeConversationArticles(prepared.articles.filter(article=>supportedIds.has(article.id))
  .map(article=>supportArticleById(article.id)).filter(Boolean).map(({id,title,href,version,reviewedAt})=>
   ({id,title,href,...(version?{version}:{}),...(reviewedAt?{reviewedAt}:{})})));
 const summary=updateConversationSummary({...prepared,
  ...(prepared.intent.topic==='plans'&&answerPlans.length?{planCodes:answerPlans.map(plan=>plan.code)}:{})},
  {articleIds:articles.map(article=>article.id),now:at});
 return {id:conversation.id,turnId:turn.turnId,revision:conversation.revision,answer,articles,summary:normalizeConversationSummary(summary)};
}

/** No financial/provider method is available here. Inspect is read-only; apply
 * repeats the ledger checks and atomically commits answer plus context with CAS.
 * A failed apply leaves an unfinished turn available for a later safe repair. */
export async function repairProConversationTurn(repo,{id,turnId,now=Date.now()}={}){
 if(typeof repo.inspectProTurnRepair!=='function'||typeof repo.applyProTurnRepair!=='function')
  return repo.repairProTurn({id,turnId}); // Compatibility with legacy test adapters.
 const candidate=await repo.inspectProTurnRepair({id,turnId});
 if(candidate.eligible!==true)return candidate;
 const rebuilt=reconstructSettledProContext(candidate,{now});
 try{return await repo.applyProTurnRepair(rebuilt);}
 catch(error){
  if(error.code!=='CONVERSATION_REVISION_CONFLICT')throw error;
  // Another tab advanced the conversation after inspection. Never overwrite it.
  return {ok:true,repaired:false,repairDeferred:true,conversation:await repo.read(id,'pro')};
 }
}

async function readBody(request){
 if(!/^application\/json(?:;|$)/i.test(request.headers.get('content-type')||''))throw conversationError('Use JSON nesta requisição.',415);
 const limit=8192,length=Number(request.headers.get('content-length')||0);
 if(Number.isFinite(length)&&length>limit)throw conversationError('Solicitação acima do limite.',413);
 const reader=request.body?.getReader();if(!reader)throw conversationError('Solicitação vazia.');
 const chunks=[];let bytes=0;
 try{while(true){const part=await reader.read();if(part.done)break;bytes+=part.value.byteLength;
  if(bytes>limit){await reader.cancel();throw conversationError('Solicitação acima do limite.',413);}chunks.push(part.value);
 }}finally{reader.releaseLock();}
 let body;try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw conversationError('Solicitação inválida.');}
 return body;
}
export async function handleConversations(request,{db,getDb,env=process.env,actorResolver=resolveConversationActor,repository=conversationRepository,now=Date.now()}={}){
 let actor=null;
 const respond=(data,status=200)=>Response.json(data,{status,headers:{...CONVERSATION_HEADERS,...(actor?.setCookie?{'Set-Cookie':actor.setCookie}:{})}});
 try{
  if(!['GET','POST'].includes(request.method))throw conversationError('Método não permitido.',405);
  if(!conversationMemoryEnabled(env))return request.method==='GET'?respond({ok:true,available:false}):respond({ok:false,available:false,code:'CONVERSATION_MEMORY_DISABLED',error:'O histórico está em preparação.'},503);
  if(request.method==='POST'&&!assistantSameOrigin(request))throw conversationError('Origem não autorizada.',403);
  const url=new URL(request.url);
  if([...url.searchParams.keys()].some(k=>!['channel','id'].includes(k))||url.searchParams.getAll('channel').length>1||url.searchParams.getAll('id').length>1)
   throw conversationError('Filtro de conversa inválido.');
  const body=request.method==='POST'?await readBody(request):null;
  const channel=conversationChannel(body?.action==='create'?(body.channel||'support'):(url.searchParams.get('channel')||'support'));
  db=db||(getDb?getDb():null);
  actor=await actorResolver(request,{db,env,now,allowVisitor:channel!=='pro'});
  const repo=repository(db,actor);
  if(request.method==='GET'){
   const id=url.searchParams.get('id');
   if(id){
    if(!validConversationId(id))throw conversationError('Conversa inválida.');
    let conversation=await repo.read(id,channel);
    let repairDeferred=false;
    if(channel==='pro'&&actor.kind==='user'&&typeof repo.repairProTurn==='function'){
     const unfinished=(conversation.turns||[]).filter(t=>['pending','uncertain'].includes(t.status));
     const legacy=typeof repo.inspectProTurnRepair==='function'?(conversation.turns||[]).filter(t=>t.status==='completed'&&!t.articles?.length):[];
     const candidates=[...legacy.slice(-2),...unfinished].slice(-2);
     for(const turn of candidates){
      try{
       const repair=await repairProConversationTurn(repo,{id,turnId:turn.turnId,now});
       if(repair.conversation)conversation=repair.conversation;
       repairDeferred||=repair.repairDeferred===true;
      }catch(error){
       if(error.code==='CONVERSATION_NOT_FOUND')throw error;
       repairDeferred=true;
      }
     }
    }
    return respond({ok:true,available:true,conversation,...(repairDeferred?{conversationSyncPending:true}:{})});
   }
   return respond({ok:true,available:true,conversations:await repo.list(channel)});
  }
  if(body?.action==='create'){
   conversationKeys(body,['action','channel','persona','remember']);
   return respond({ok:true,available:true,conversation:await repo.create({channel,persona:body.persona||'genio',remember:body.remember??false})});
  }
  if(body?.action==='delete'){
   conversationKeys(body,['action','conversationId','revision']);
   const result=await repo.remove({id:body.conversationId,revision:body.revision});return respond({ok:true,available:true,deleted:result.deleted,id:body.conversationId});
  }
  if(body?.action==='persona'){
   conversationKeys(body,['action','conversationId','revision','persona']);
   return respond({ok:true,available:true,conversation:await repo.setPersona({id:body.conversationId,revision:body.revision,persona:body.persona})});
  }
  if(body?.action==='feedback'){
   conversationKeys(body,['action','conversationId','turnId','rating','note','allowReview']);
   const result=await repo.feedback({id:body.conversationId,turnId:body.turnId,rating:body.rating,note:body.note,allowReview:body.allowReview});return respond({ok:true,available:true,feedback:result.feedback});
  }
  throw conversationError('Ação de conversa inválida.');
 }catch(error){
  const status=[400,401,403,404,405,409,413,415,429,503].includes(error?.status)?error.status:503;
  return respond({ok:false,available:false,code:error?.code||'CONVERSATION_UNAVAILABLE',error:error?.status?error.message:'O histórico está temporariamente indisponível.'},status);
 }
}
