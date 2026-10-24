import {interpretSupport,normalizeSupportText,supportArticleById} from './knowledge.mjs';
import {SALES_PLANS,commercialPlans,salesReplyGuided} from './sales-policy.mjs';
import {commercialConcern} from './commercial-guidance.mjs';
import {connectionGuide} from '../platform/connections/catalog.mjs';
import {connectionHelpFor,connectionSecret} from '../platform/connections/support.mjs';
import {lessonById,SOURCES} from '../learning/catalog.mjs';
import {initialConversationSummary,normalizeConversationSummary,normalizeConversationToolContext} from './conversation-contract.mjs';

export const CONVERSATION_CONTEXT_LIMITS=Object.freeze({turns:8,question:2500,previousQuestion:1200,previousAnswer:2200,summary:4000,corrections:3});
const code=value=>typeof value==='string'&&/^[a-z0-9][a-z0-9._-]{0,99}$/i.test(value);
const record=value=>value&&typeof value==='object'&&!Array.isArray(value);
const screens=new Set(['/','/lp','/social','/dashboard-logado','/dashboard','/mesa-operacoes','/platform/assistente','/platform/assistente/consultas','/platform/aprender','/platform/entrar','/platform/recuperar','/genios-pro','/universidade','/universidade/entrar','/checkout','/planos','/login','/recuperar-senha','/admin/login','/tendencias','/bankscore','/notifications','/integracoes']);
const planCodes=new Set(SALES_PLANS.map(p=>p.code));
const date=(value,now)=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&Date.parse(value)<=now+60_000?new Date(value).toISOString():null;
const periodDate=(value,now)=>typeof value==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,6})?(?:Z|\+00:00)$/.test(value)&&Number.isFinite(Date.parse(value))&&Math.abs(Date.parse(value)-now)<=5*366*86400_000?new Date(value).toISOString():null;
const redacted=value=>value.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,'[e-mail omitido]').replace(/\b\d{3}[. ]?\d{3}[. ]?\d{3}[- ]?\d{2}\b/g,'[documento omitido]').replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,'[identificador omitido]');
const secret=value=>connectionSecret(value)||/(?:senha|password|api[ _-]?secret|private[ _-]?key)\s+(?:é|e|is)\s+\S{6,}/i.test(value);
const text=(value,max)=>typeof value==='string'&&!secret(value)?redacted(value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'')).trim().slice(0,max):'';
const knownArticles=value=>Array.isArray(value)?[...new Set(value.map(x=>typeof x==='string'?x:x?.id).filter(id=>supportArticleById(id)))].slice(0,8):[];
const publicArticle=a=>({id:a.id,title:a.title,href:a.href});
const uniqueArticles=items=>[...new Map(items.filter(Boolean).map(a=>[a.id,a])).values()].slice(0,6);

function safeSummary(input,now){
 let value;try{value=normalizeConversationSummary(input);}catch{return initialConversationSummary();}
 const reports=value.corrections.filter(x=>date(x.createdAt,now)&&text(x.text,280)).map(x=>({...x,text:text(x.text,280),origin:'user',verified:false}));
 const reported=value.reportedStep&&date(value.reportedStep.createdAt,now)&&text(value.reportedStep.text,280)?{...value.reportedStep,text:text(value.reportedStep.text,280),origin:'user',verified:false}:null;
 return {version:1,topic:supportArticleById(value.topic)?value.topic:null,articleIds:knownArticles(value.articleIds),planCodes:value.planCodes.filter(x=>planCodes.has(x)),corrections:reports.slice(-3),reportedStep:reported,
  ...(connectionGuide(value.guideId)?{guideId:value.guideId}:{}),...(value.pendingQuestion?{pendingQuestion:text(value.pendingQuestion,350)}:{})};
}
function safeTurns(input,now){
 if(!Array.isArray(input))return [];
 const seen=new Set();
 return input.slice(-32).filter(turn=>record(turn)&&['completed','answered','settled'].includes(turn.status)&&code(turn.turnId)&&!seen.has(turn.turnId)&&(seen.add(turn.turnId),true))
  .map(turn=>({turnId:turn.turnId,question:text(turn.question,1200),answer:text(turn.answer,2200),articles:knownArticles(turn.articles).map(id=>publicArticle(supportArticleById(id))),createdAt:date(turn.createdAt,now),status:'completed'}))
  .filter(turn=>turn.question&&turn.answer&&turn.createdAt).sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt)).slice(-8);
}
function safeScreen(value){
 const path=typeof value==='string'?value:record(value)&&value.origin==='user'&&value.verified===false?value.path:null;
 return typeof path==='string'&&screens.has(path)?{path,origin:'user',verified:false}:null;
}
function safeAccount(value,now){
 if(!record(value)||value.origin!=='server'||value.verified!==true||value.signedIn!==true||!date(value.asOf,now))return null;
 const plan=SALES_PLANS.find(p=>p.code===value.planCode);
 const status=['active','trialing','past_due','canceled','cancel_scheduled','inactive','expired','unknown','no_active_plan'].includes(value.planStatus)?value.planStatus:'unknown';
 return {origin:'server',verified:true,signedIn:true,planCode:plan?.code||null,planName:plan?.name||null,planStatus:status,periodEnd:periodDate(value.periodEnd,now),proIncluded:value.proIncluded===true,asOf:date(value.asOf,now)};
}
function safeLesson(value,now){
 if(!record(value)||value.origin!=='server'||value.verified!==true||!date(value.asOf,now))return null;
 const lesson=lessonById(value.lessonId);if(!lesson)return null;
 // The calling server must authorize this lesson first. Re-read official content
 // by ID so neither a user turn nor a stored title can replace the curriculum.
 return {origin:'server',verified:true,lessonId:lesson.id,title:lesson.title,objective:lesson.objective,paragraphs:lesson.paragraphs.slice(0,6).map(p=>p.slice(0,1800)),example:lesson.example.slice(0,1800),exercise:lesson.exercise.slice(0,1400),sources:SOURCES.filter(s=>lesson.sourceIds.includes(s.id)).map(({id,title,url})=>({id,title,url})),asOf:date(value.asOf,now)};
}
function safeTool(value,now){
 try{
  const tool=normalizeConversationToolContext(value);if(!tool||!date(tool.observedAt,now)||tool.sourceAt&&!date(tool.sourceAt,now))return null;
  return {...tool,facts:tool.facts.map(f=>({label:text(f.label,100),value:text(f.value,500)})).filter(f=>f.label&&f.value)};
 }catch{return null;}
}
const questionKind=q=>/\b(?:quanto|custa|custo|preco|valor|mais barato|mais caro)\b/.test(q)?'price':/\b(?:mais simples|explique melhor|explicar melhor|nao entendi|resumir|resuma)\b/.test(q)?'simplify':/\b(?:proximo passo|proxima etapa|ja fiz|ja conclui|terminei)\b/.test(q)?'steps':/\b(?:meu plano|minha assinatura|ja paguei|pagamento|liberado|ativo)\b/.test(q)?'status':'explain';
const toolTopic=tool=>tool?.startsWith('bankscore')?'bankscore':tool?.startsWith('crypto')?'crypto':tool==='trends'?'trends':null;
/** Select for this answer only. The stored, dated result remains in the server
 * snapshot so an explicit return to its subject can use it later. */
export function toolContextForTopic(toolContext,topic){
 const related=toolTopic(toolContext?.tool);
 return related&&related===topic?toolContext:null;
}
const screenTopic=screen=>screen?.path==='/platform/aprender'?'school':['/checkout','/planos'].includes(screen?.path)?'plans':screen?.path==='/tendencias'?'trends':null;

/** Pure: callers supply already-authorized server contexts, never browser body
 * objects promoted to verified. History is conversational evidence, not authority. */
export function prepareConversationContext(input={}, {now=Date.now()}={}){
 if(!Number.isFinite(now))throw Object.assign(Error('Horário do atendimento inválido.'),{status:503});
 if(typeof input.message!=='string'||!input.message.trim()||input.message.length>2500)throw Object.assign(Error('Escreva uma pergunta de até 2.500 caracteres.'),{status:400,code:'ASSISTANT_INPUT_INVALID'});
 if(secret(input.message))throw Object.assign(Error('Não envie senhas, chaves ou tokens. Nenhuma credencial foi utilizada.'),{status:400,code:'SENSITIVE_INPUT'});
 const message=text(input.message,2500),persona=input.persona==='genia'?'genia':'genio',turns=safeTurns(input.turns,now),summary=safeSummary(input.summary,now);
 const screen=safeScreen(input.screen),accountContext=safeAccount(input.accountContext,now),lessonContext=safeLesson(input.lessonContext,now),toolContext=safeTool(input.toolContext,now);
 const intent=interpretSupport(message),q=normalizeSupportText(message);intent.questionKind=questionKind(q);
 let articles=[...intent.articles],topic=intent.topic,clarification=null;
 const priorIds=summary.articleIds.length?summary.articleIds:knownArticles(turns.at(-1)?.articles);
 const priorTopic=summary.topic||priorIds[0]||null;
 // Short objections continue a commercial conversation, never override a new
 // explicit request for account, payment, cancellation or operational support.
 if(priorTopic==='plans'&&commercialConcern(message)&&intent.kind!=='restricted'&&(!topic||topic==='plans'||topic==='day-swing'&&commercialConcern(message)==='complexity')){
  topic='plans';articles=[supportArticleById(topic)];intent.followUp=true;
 }
 const explicitPlans=commercialPlans(message),negativePlans=commercialPlans(message,{includeNegated:true}).filter(p=>!explicitPlans.some(x=>x.code===p.code));
 let selectedPlans=explicitPlans.map(p=>p.code);
 if(priorTopic==='plans'&&!selectedPlans.length&&/^(?:(?:so|somente|apenas) )?b3$/.test(q)){selectedPlans=['platform-nacional'];topic='plans';articles=[supportArticleById(topic)];}
 if(priorTopic==='plans'&&!selectedPlans.length&&/^(?:(?:tambem|e|b3 e) )?cripto(?:moedas)?$/.test(q)){selectedPlans=['platform-global-crypto'];topic='plans';articles=[supportArticleById(topic)];}
 if(priorTopic==='plans'&&/^(?:(?:so|somente|apenas) )?(?:estudo|estudar|universidade)$/.test(q)){topic='school';articles=[supportArticleById(topic)];}
 const previousPlans=summary.planCodes.length?summary.planCodes:commercialPlans(turns.at(-1)?.question||'').map(p=>p.code);
 const ordinal=/\b(?:primeiro|primeira|segundo|segunda|terceiro|terceira)\b/.exec(q);
 if(!selectedPlans.length&&ordinal&&previousPlans.length&&intent.kind!=='restricted'){
  const index=/primeir/.test(ordinal[0])?0:/segund/.test(ordinal[0])?1:2;
  if(previousPlans[index]){selectedPlans=[previousPlans[index]];topic='plans';articles=[supportArticleById(topic)];}
  else clarification='Qual dos planos você quer retomar? Diga o nome ou o preço para eu não escolher por você.';
 }else if(!selectedPlans.length&&intent.followUp&&previousPlans.length&&intent.kind!=='restricted'&&(!topic||topic==='plans'))selectedPlans=previousPlans.filter(code=>!negativePlans.some(p=>p.code===code));
 if(explicitPlans.length&&intent.kind!=='restricted'&&!['subscription-cancel','payments-pix'].includes(topic)){topic='plans';articles=[supportArticleById(topic)];}
 const inherited=intent.followUp&&(!topic||topic==='plans'&&intent.questionKind==='price'&&!explicitPlans.length&&priorTopic==='school');
 if(inherited&&intent.kind!=='restricted'){
  topic=priorTopic||toolTopic(toolContext?.tool)||screenTopic(screen);
  if(lessonContext&&!topic)topic='university-tutor';
  if(topic){articles=uniqueArticles([supportArticleById(topic),...priorIds.map(supportArticleById)]);intent.contextUsed=true;}
 }
 const guideId=topic?.startsWith('connection-')&&connectionGuide(topic.slice(11))?topic.slice(11):inherited?summary.guideId:null;
 if(guideId){
  const guide=connectionGuide(guideId);
  const specific=connectionHelpFor(guide.name+' '+message);
  if(specific.length){articles=specific;topic=specific[0].id;}
 }
 if(!topic&&lessonContext&&(intent.followUp||intent.kind==='unknown')){topic='university-tutor';articles=[supportArticleById(topic)];}
 if(!topic&&selectedPlans.length){topic='plans';articles=[supportArticleById(topic)];}
 if(/\b(?:o outro|a outra|qual deles|qual dos dois)\b/.test(q)&&!previousPlans.length&&!priorTopic)clarification='Quais opções você quer comparar? Diga os nomes para eu retomar o assunto certo.';
 if(!topic&&!clarification)clarification=intent.followUp?'A qual assunto da conversa você está se referindo: conta, plano, Universidade ou outro recurso?':'Ainda não tenho uma resposta verificada para essa pergunta. Você quer ajuda com a conta, a Social, a Universidade ou um plano?';
 if(intent.correction&&!intent.topic&&!selectedPlans.length&&!lessonContext)clarification='Entendi que a resposta anterior não era o que você queria. Qual assunto ou detalhe devo corrigir?';
 intent.topic=topic;intent.clarification=clarification;
 return {message,persona,turns,summary,screen,accountContext,lessonContext,toolContext:toolContextForTopic(toolContext,topic),articles:uniqueArticles(articles),intent,planCodes:selectedPlans.slice(0,3),clarification,asOf:new Date(now).toISOString(),...(guideId?{guideId}:{})};
}

export function updateConversationSummary(prepared,{articleIds,now=Date.now()}={}){
 const previous=prepared.summary||initialConversationSummary(),createdAt=new Date(now).toISOString();
 const report={text:text(prepared.message,280),origin:'user',verified:false,createdAt};
 const corrections=prepared.intent.correction?[...previous.corrections,report].slice(-3):previous.corrections.slice(-3);
 const step=/\b(?:ja (?:fiz|conclui|paguei|enviei|abri|instalei)|terminei|completei)\b/.test(normalizeSupportText(prepared.message))?report:prepared.intent.contextUsed?previous.reportedStep:null;
 const allowed=prepared.articles.map(a=>a.id),ids=knownArticles(articleIds||allowed).filter(id=>allowed.includes(id));
 const summary={version:1,topic:prepared.intent.topic||null,articleIds:ids.slice(0,6),planCodes:[...prepared.planCodes],corrections,reportedStep:step,
  ...(prepared.guideId?{guideId:prepared.guideId}:{}),...(prepared.clarification?{pendingQuestion:text(prepared.clarification,350)}:{})};
 return normalizeConversationSummary(summary);
}

export const SUPPORT_FOLLOWUPS=Object.freeze({
 school:['Como funciona o nivelamento da Universidade?','Como faço revisões diárias?'],
 'university-daily':['Como refazer uma avaliação?','Posso rever aulas depois de concluir o curso?'],
 'master-users':['Como um Master cadastra outro Master?'],
 'photo-posts':['Quais formatos de foto são aceitos?'],
 trends:['Para que servem os alertas do Hub?'],
 'trading-view':['Como estudar tendência e lateralização?'],
 plans:['Compare Nacional e Global Crypto.','Como contratar a JENIOS?'],
 'account-login':['Como recuperar a senha da minha conta?'],
 'payments-pix':['Como conferir um pagamento que já fiz?']
});

export function guidedConversationReply(prepared){
 const {message,persona,articles,intent,accountContext,lessonContext,toolContext}=prepared;
 const relatedToolContext=toolContextForTopic(toolContext,intent.topic);
 let result=salesReplyGuided(message,persona,{articles,planCodes:prepared.planCodes,comparison:intent.comparison});
 if(prepared.clarification)result.explanation=prepared.clarification;
 else if(lessonContext&&intent.topic==='university-tutor'){
  const q=normalizeSupportText(message),material=/exemplo/.test(q)?lessonContext.example:/exercicio|pratic/.test(q)?lessonContext.exercise:lessonContext.paragraphs.slice(0,2).join('\n\n');
  result.explanation='Na aula “'+lessonContext.title+'”, o material revisado explica:\n\n'+material+'\n\nQual parte dessa explicação você quer aprofundar? Sem geração de IA, não avalio sua resposta nem modifico notas.';
 }else if(prepared.guideId&&intent.questionKind==='steps'){
  const guide=connectionGuide(prepared.guideId),reported=/\b(?:ja fiz|ja conclui|terminei|completei)\b/.test(normalizeSupportText(message))?message:prepared.summary.reportedStep?.text||'';
  const n=normalizeSupportText(reported),match=/(?:etapa|passo)\s+(\d{1,2})/.exec(n);
  const completed=match?Number(match[1]):/primeir/.test(n)?1:/segund/.test(n)?2:/terceir/.test(n)?3:null;
  const step=completed!==null&&completed>=0&&completed<guide.steps.length?guide.steps[completed]:null;
  result.explanation=step?'Você relatou ter concluído uma etapa; isso não confirma conexão nem permissões. A próxima etapa no guia '+guide.name+' é:\n\n'+step.title+': '+step.text:
   'Qual etapa do guia '+guide.name+' você concluiu e qual mensagem aparece agora? O relato ajuda a orientar, mas não confirma conexão nem permissões.';
 }else if(accountContext&&intent.questionKind==='status'){
  result.explanation='Na consulta autorizada de '+accountContext.asOf+', o plano constava como '+accountContext.planStatus+(accountContext.planName?' ('+accountContext.planName+')':'')+'. Isso descreve aquele registro; a conversa não confirma um novo pagamento nem altera o acesso.\n\n'+result.explanation;
 }
 if(!prepared.clarification&&intent.questionKind==='simplify'&&!prepared.guideId&&articles.length&&intent.topic!=='plans'&&!lessonContext){
  const concise=articles[0].text.split(/(?<=[.!?])\s+(?=[A-ZÀ-Ú])/u).slice(0,2).join(' ');
  result.explanation='Em poucas palavras: '+concise+'\n\nQual parte você quer detalhar?';
 }
 if(!prepared.clarification&&/\bja paguei\b/.test(normalizeSupportText(message))&&!accountContext)result.explanation='Você informou que já pagou. Esse relato fica separado da confirmação financeira.\n\n'+result.explanation;
 if(relatedToolContext&&!prepared.clarification){
  result.explanation+='\n\nNa consulta de '+relatedToolContext.observedAt+(relatedToolContext.sourceAt?', com fonte datada de '+relatedToolContext.sourceAt:'; sem horário de origem confirmado')+':\n'+relatedToolContext.facts.slice(0,6).map(f=>f.label+': '+f.value).join('\n')+'\nEsses registros não são uma atualização em tempo real.';
 }
 const links=[...result.links];
 if(intent.topic==='account-login')for(const link of [{title:'Recuperar senha da Social',href:'/recuperar-senha'},{title:'Entrar na Platform',href:'/platform/entrar'},{title:'Recuperar senha da Platform',href:'/platform/recuperar'}])if(!links.some(x=>x.href===link.href))links.push(link);
 return {...result,links:links.slice(0,8),articles:articles.map(publicArticle),followups:result.commercialPaused?[]:SUPPORT_FOLLOWUPS[intent.topic]||[]};
}
