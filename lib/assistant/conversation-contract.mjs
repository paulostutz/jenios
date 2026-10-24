/** Server-owned conversation contracts. Browser input never supplies ownership or summaries. */
import {connectionSecret} from '../platform/connections/support.mjs';

export const CONVERSATION_VERSION=1;
export const CONVERSATION_CHANNELS=Object.freeze(['support','pro']);
export const CONVERSATION_HEADERS=Object.freeze({'Cache-Control':'private, no-store','Vary':'Authorization, Cookie','X-Content-Type-Options':'nosniff'});
export const CONVERSATION_UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const conversationError=(message,status=400,code='CONVERSATION_INVALID')=>Object.assign(Error(message),{status,code});
export const conversationMemoryEnabled=env=>env?.JENIOS_ASSISTANT_MEMORY_ENABLED==='true';
export const validConversationId=id=>typeof id==='string'&&CONVERSATION_UUID.test(id);
export function conversationKeys(value,allowed){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!allowed.includes(key)))
  throw conversationError('Há um campo não permitido nesta conversa.');
}
export function conversationText(value,max,{empty=false}={}){
 if(typeof value!=='string'||value.length>max||(!empty&&!value.trim())||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value))
  throw conversationError('O texto está vazio, inválido ou acima do limite.');
 if(connectionSecret(value)||/(?:senha|password|api[ _-]?secret|private[ _-]?key)\s+(?:é|e|is)\s+\S{6,}/i.test(value))
  throw conversationError('Não envie senhas, chaves ou tokens. Esse conteúdo não foi salvo.',400,'CONVERSATION_SENSITIVE_INPUT');
 return value.trim();
}
export function conversationRevision(value){
 if(!Number.isSafeInteger(value)||value<0||value>=Number.MAX_SAFE_INTEGER-2)throw conversationError('Atualize a conversa antes de continuar.');
 return value;
}
export function conversationChannel(value){if(!CONVERSATION_CHANNELS.includes(value))throw conversationError('Canal inválido.');return value;}
export function conversationPersona(value){if(!['genio','genia'].includes(value))throw conversationError('Escolha o Gênio ou a Gênia.');return value;}
const code=value=>typeof value==='string'&&/^[a-z0-9][a-z0-9._-]{0,99}$/i.test(value);
const iso=value=>typeof value==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,6})?(?:Z|\+00:00)$/.test(value)&&Number.isFinite(Date.parse(value));
export const initialConversationSummary=()=>({version:1,topic:null,articleIds:[],planCodes:[],corrections:[],reportedStep:null});
export function normalizeConversationSummary(input){
 if(input==null)return initialConversationSummary();
 conversationKeys(input,['version','topic','articleIds','planCodes','guideId','pendingQuestion','corrections','reportedStep']);
 if(input.version!==1||!(input.topic==null||code(input.topic))||!Array.isArray(input.articleIds)||input.articleIds.length>8||
  input.articleIds.some(x=>!code(x))||new Set(input.articleIds).size!==input.articleIds.length||!Array.isArray(input.planCodes)||input.planCodes.length>3||
  input.planCodes.some(x=>!['platform-nacional','platform-global-crypto','platform-internacional-pro'].includes(x))||
  !Array.isArray(input.corrections)||input.corrections.length>3)throw conversationError('Resumo de contexto inválido.');
 const reported=value=>{
  conversationKeys(value,['text','origin','verified','createdAt']);
  if(value.origin!=='user'||value.verified!==false||!iso(value.createdAt))throw conversationError('A origem deste relato não foi confirmada.');
  return {text:conversationText(value.text,600),origin:'user',verified:false,createdAt:new Date(value.createdAt).toISOString()};
 };
 const summary={version:1,topic:input.topic||null,articleIds:[...input.articleIds],planCodes:[...new Set(input.planCodes)],
  corrections:input.corrections.map(reported),reportedStep:input.reportedStep==null?null:reported(input.reportedStep)};
 if(input.guideId!=null){if(!code(input.guideId))throw conversationError('Guia inválido no contexto.');summary.guideId=input.guideId;}
 if(input.pendingQuestion!=null)summary.pendingQuestion=conversationText(input.pendingQuestion,350,{empty:true});
 if(JSON.stringify(summary).length>4000)throw conversationError('Resumo de contexto acima do limite.');
 return summary;
}
export function normalizeConversationArticles(input=[]){
 if(!Array.isArray(input)||input.length>8)throw conversationError('Referências inválidas.');
 return input.map(article=>{
  conversationKeys(article,['id','title','href','version','reviewedAt']);
  if(!code(article.id)||typeof article.href!=='string'||article.href.length>500||!/^\/(?!\/)[A-Za-z0-9_/?=&.#%:-]*$/.test(article.href))
   throw conversationError('Referência de suporte inválida.');
  const result={id:article.id,title:conversationText(article.title,180),href:article.href};
  if(article.version!=null){if(!code(article.version))throw conversationError('Versão da referência inválida.');result.version=article.version;}
  if(article.reviewedAt!=null){if(!/^\d{4}-\d\d-\d\d$/.test(article.reviewedAt)&&!iso(article.reviewedAt))throw conversationError('Data da referência inválida.');result.reviewedAt=article.reviewedAt;}
  return result;
 });
}
export function normalizeConversationToolContext(input){
 if(input==null)return null;
 conversationKeys(input,['origin','verified','tool','observedAt','sourceAt','facts']);
 if(input.origin!=='server'||input.verified!==true||!code(input.tool)||!iso(input.observedAt)||
  !(input.sourceAt==null||iso(input.sourceAt))||!Array.isArray(input.facts)||input.facts.length>12)
  throw conversationError('Contexto de consulta não verificado.');
 const result={origin:'server',verified:true,tool:input.tool,observedAt:new Date(input.observedAt).toISOString(),
  sourceAt:input.sourceAt==null?null:new Date(input.sourceAt).toISOString(),facts:input.facts.map(f=>{
   conversationKeys(f,['label','value']);return {label:conversationText(f.label,100),value:conversationText(f.value,500)};
  })};
 if(Buffer.byteLength(JSON.stringify(result),'utf8')>3000)throw conversationError('Contexto de consulta acima do limite.');
 return result;
}
/** Notes are explicitly shared, never treated as verified knowledge. Remove obvious identifiers. */
export function redactedReviewNote(value=''){
 return conversationText(value,500,{empty:true})
  .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,'[e-mail removido]')
  .replace(/https?:\/\/\S+/gi,'[endereço removido]')
  .replace(/\b\d{3}[. ]?\d{3}[. ]?\d{3}[- ]?\d{2}\b/g,'[documento removido]')
  .replace(/\b\d{2}[. ]?\d{3}[. ]?\d{3}[\/ ]?\d{4}[- ]?\d{2}\b/g,'[documento removido]')
  .replace(/(?:\+?55\s*)?\(?\d{2}\)?\s*\d{4,5}[- ]?\d{4}\b/g,'[telefone removido]')
  .replace(/(?:meu nome é|me chamo|my name is)\s+[\p{L}][\p{L}' -]{1,80}/giu,'[nome removido]');
}
