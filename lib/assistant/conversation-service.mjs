import {assistantSameOrigin} from '../platform/connections/request-origin.mjs';
import {CONVERSATION_HEADERS,conversationMemoryEnabled,conversationError,conversationKeys,conversationChannel,validConversationId} from './conversation-contract.mjs';
import {resolveConversationActor} from './conversation-actor.mjs';
import {conversationRepository} from './conversation-repository.mjs';

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
    if(channel==='pro'&&actor.kind==='user'&&typeof repo.repairProTurn==='function'){
     for(const turn of (conversation.turns||[]).filter(t=>['pending','uncertain'].includes(t.status)).slice(-2)){
      const repair=await repo.repairProTurn({id,turnId:turn.turnId});
      if(repair.repaired===true&&repair.conversation)conversation=repair.conversation;
     }
    }
    return respond({ok:true,available:true,conversation});
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
