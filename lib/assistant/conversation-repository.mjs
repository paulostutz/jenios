import {conversationError,validConversationId,conversationText,conversationRevision,conversationChannel,conversationPersona,
 normalizeConversationArticles,normalizeConversationSummary,normalizeConversationToolContext,redactedReviewNote} from './conversation-contract.mjs';

export const CONVERSATION_RPC='jenios_assistant_conversation_g43';
const sqlErrors={
 CONVERSATION_NOT_FOUND:[404,'Esta conversa não está disponível.'],
 CONVERSATION_REVISION_CONFLICT:[409,'A conversa mudou. Atualize antes de continuar.'],
 CONVERSATION_TURN_CONFLICT:[409,'Esta pergunta já foi registrada com outro conteúdo.'],
 CONVERSATION_TURN_BUSY:[409,'Aguarde a resposta que já está em processamento.'],
 CONVERSATION_REPAIR_CONFLICT:[409,'O registro liquidado mudou. Atualize a conversa para conferir o resultado.'],
 CONVERSATION_LEASE_INVALID:[409,'A resposta não pode mais ser gravada nesta conversa.'],
 CONVERSATION_LIMIT:[429,'O histórico atingiu seu limite. Exclua uma conversa antiga ou inicie outra mais tarde.'],
 CONVERSATION_AUTH_REQUIRED:[401,'Entre na sua conta para continuar.'],
 CONVERSATION_SENSITIVE_INPUT:[400,'Não envie senhas, chaves ou tokens. Esse conteúdo não foi salvo.'],
 CONVERSATION_INVALID:[400,'A conversa contém dados inválidos.']
};
function checkId(id){if(!validConversationId(id))throw conversationError('Conversa ou pergunta inválida.');return id;}
function dbError(error){
 const name=Object.keys(sqlErrors).find(k=>error?.message===k);
 if(name){const [status,message]=sqlErrors[name];throw conversationError(message,status,name);}
 throw conversationError('O histórico está temporariamente indisponível.',503,'CONVERSATION_STORAGE_UNAVAILABLE');
}
/** Every call supplies an actor resolved on the server; no direct table reads. */
export function conversationRepository(db,actor){
 if(!db?.rpc||!['user','visitor'].includes(actor?.kind)||!validConversationId(actor.ownerId))
  throw conversationError('Identidade do atendimento não confirmada.',401,'CONVERSATION_AUTH_REQUIRED');
 const rpc=async(action,payload={})=>{
  const result=await db.rpc(CONVERSATION_RPC,{p_action:action,p_owner_kind:actor.kind,p_owner_id:actor.ownerId,p_payload:payload});
  if(result?.error)dbError(result.error);
  const data=result?.data;
  if(!data||typeof data!=='object'||Array.isArray(data)||data.ok!==true)dbError(null);
  return data;
 };
 const repairRpc=async(action,id,turnId,payload={})=>{
  if(actor.kind!=='user')throw conversationError('Entre na sua conta para conferir o Pro.',401,'CONVERSATION_AUTH_REQUIRED');
  const result=await db.rpc('jenios_assistant_repair_context_g44',{p_action:action,p_user_id:actor.ownerId,
   p_conversation_id:checkId(id),p_turn_id:checkId(turnId),p_payload:payload});
  if(result?.error)dbError(result.error);
  if(result?.data?.ok!==true)dbError(null);
  return result.data;
 };
 return Object.freeze({
  async list(channel='support'){return (await rpc('list',{channel:conversationChannel(channel)})).conversations;},
  async read(id,channel){return (await rpc('read',{id:checkId(id),...(channel?{channel:conversationChannel(channel)}:{})})).conversation;},
  async create({channel='support',persona='genio',remember=false}={}){
   if(typeof remember!=='boolean'||remember&&actor.kind!=='user')throw conversationError('O histórico de 30 dias exige uma conta autenticada.');
   if(channel==='pro'&&actor.kind!=='user')throw conversationError('Entre na sua conta para usar o Pro.',401,'CONVERSATION_AUTH_REQUIRED');
   return (await rpc('create',{channel:conversationChannel(channel),persona:conversationPersona(persona),remember})).conversation;
  },
  async remove({id,revision}){return rpc('delete',{id:checkId(id),revision:conversationRevision(revision)});},
  async setPersona({id,revision,persona}){return (await rpc('persona',{id:checkId(id),revision:conversationRevision(revision),persona:conversationPersona(persona)})).conversation;},
  async claimTurn({id,turnId,revision,question,requestFingerprint}){
   if(requestFingerprint!==undefined&&(typeof requestFingerprint!=='string'||!/^[a-f0-9]{64}$/.test(requestFingerprint)))throw conversationError('Identificador da consulta Pro inválido.');
   return rpc('claim',{id:checkId(id),turnId:checkId(turnId),revision:conversationRevision(revision),question:conversationText(question,2500),...(requestFingerprint!==undefined?{requestFingerprint}:{})});
  },
  async repairProTurn({id,turnId}){return rpc('repair_pro',{id:checkId(id),turnId:checkId(turnId)});},
  async inspectProTurnRepair({id,turnId}){return repairRpc('inspect',id,turnId);},
  async applyProTurnRepair({id,turnId,revision,answer,articles,summary}){
   return repairRpc('apply',id,turnId,{revision:conversationRevision(revision),answer:conversationText(answer,16000),
    articles:normalizeConversationArticles(articles),summary:normalizeConversationSummary(summary)});
  },
  async completeTurn({id,turnId,leaseToken,answer,articles=[],summary,toolContext}){
   return rpc('complete',{id:checkId(id),turnId:checkId(turnId),leaseToken:checkId(leaseToken),answer:conversationText(answer,16000),
    articles:normalizeConversationArticles(articles),summary:normalizeConversationSummary(summary),
    ...(toolContext!==undefined?{toolContext:normalizeConversationToolContext(toolContext)}:{})});
  },
  async failTurn({id,turnId,leaseToken,code='TURN_FAILED',uncertain=false}){
   if(typeof code!=='string'||!/^[A-Z0-9_]{3,80}$/.test(code)||typeof uncertain!=='boolean')throw conversationError('Motivo de falha inválido.');
   return rpc('fail',{id:checkId(id),turnId:checkId(turnId),leaseToken:checkId(leaseToken),code,uncertain});
  },
  async feedback({id,turnId,rating,note='',allowReview=false}){
   if(!['helpful','needs_review'].includes(rating)||typeof allowReview!=='boolean')throw conversationError('Avaliação inválida.');
   return rpc('feedback',{id:checkId(id),turnId:checkId(turnId),rating,note:redactedReviewNote(note),allowReview});
  }
 });
}
/** Calling API must verify Master permission; this function never returns conversation ownership/text. */
export async function adminConversationReview(db,{limit=30,days=30}={}){
 if(!Number.isSafeInteger(limit)||limit<1||limit>100||!Number.isSafeInteger(days)||days<1||days>30)throw conversationError('Filtro de revisão inválido.');
 const result=await db.rpc('jenios_assistant_review_g43',{p_limit:limit,p_days:days});
 if(result?.error||result?.data?.ok!==true)dbError(result?.error);
 return result.data;
}
export async function cleanupExpiredConversations(db,{limit=500}={}){
 if(!Number.isSafeInteger(limit)||limit<1||limit>5000)throw conversationError('Limite de limpeza inválido.');
 const result=await db.rpc('jenios_assistant_cleanup_g43',{p_limit:limit});
 if(result?.error||!Number.isSafeInteger(result?.data)||result.data<0)dbError(result?.error);
 return result.data;
}
