import {requirePayUser} from '../pay/auth.mjs';
import {verifiedPlatformPlan,proPlanAccess,verifiedUniversityPass} from './pro-access.mjs';
import {PRO_TASKS,PRO_PRICING_VERSION} from './pro-pricing.mjs';
import {PRO_HEADERS,PRO_SYMBOLS,PRO_TIMEFRAMES,normalizeProInput,readProBody,createProQuote,verifyProQuote,quoteSecretReady,proError} from './pro-input.mjs';
import {proRepository,projectProRequest} from './pro-repository.mjs';
import {loadProMarket,invokeProProvider} from './pro-provider.mjs';
import {proTopupAvailability} from './pro-topups.mjs';
import {conversationMemoryEnabled} from './conversation-contract.mjs';
import {conversationRepository} from './conversation-repository.mjs';
import {repairProConversationTurn} from './conversation-service.mjs';
import {accountContextFromPlan,loadAuthorizedLesson,assistantContextDigest} from './context-authority.mjs';
import {prepareConversationContext,updateConversationSummary} from './context-resolution.mjs';
export function proRuntimeReady(config,env=process.env){
 return config.installed===true&&config.generationEnabled===true&&config.requiresReconciliation!==true&&env.JENIOS_PRO_GENERATION_ENABLED==='true'&&typeof env.OPENAI_API_KEY==='string'&&env.OPENAI_API_KEY.length>20&&quoteSecretReady(env);
}
const reasonFor=config=>!config.installed?'O Pro está em preparação. O atendimento gratuito permanece disponível.':config.requiresReconciliation?'Novas consultas estão pausadas para conferência de consumo.':'A ativação do Pro aguarda a definição das franquias e do orçamento de IA.';
function requireRuntime(config,env,input){
 if(!proRuntimeReady(config,env))throw proError(reasonFor(config),503,'PRO_DISABLED');
 if(!config.allowedModels.includes(input.model))throw proError('Este recurso aguarda a aprovação do modelo e da tarifa.',503,'MODEL_DISABLED');
}
const stateReply=(entry,replayed=false)=>({ok:entry?.state==='settled',state:entry?.state||'needs_reconciliation',requestId:entry?.id||null,answer:entry?.answer||null,chargedNanoUsd:entry?.chargedNanoUsd??null,providerNanoUsd:entry?.providerNanoUsd??null,sourceInfo:entry?.sourceInfo||null,replayed,executionEnabled:false});
export async function handlePro(request,{action,db,env=process.env,authorize=requirePayUser,repository=proRepository,planResolver=verifiedPlatformPlan,passResolver=verifiedUniversityPass,marketLoader=loadProMarket,provider=invokeProProvider,now=Date.now(),planOnly=false,memoryRepository=conversationRepository,lessonLoader=loadAuthorizedLesson}={}){
 let repo,input,key,attempted=false,dispatched=false,memory,memoryClaim,prepared,contextUser;
 const respond=(body,status=200)=>Response.json(body,{status,headers:PRO_HEADERS});
 const memoryFailure=async(code,uncertain=false)=>{
  if(!memoryClaim?.leaseToken)return;
  try{await memory.failTurn({id:input.conversationId,turnId:key,leaseToken:memoryClaim.leaseToken,code,uncertain});}catch{}
 };
 const memoryCompletion=async(answer)=>{
  if(!memoryClaim?.leaseToken)return {};
  const summary=updateConversationSummary(prepared,{answer,now});
  try{
   const articles=(prepared.articles||[]).map(({id,title,href,version,reviewedAt})=>({id,title,href,...(version?{version}:{}),...(reviewedAt?{reviewedAt}:{})}));
   const completed=await memory.completeTurn({id:input.conversationId,turnId:key,leaseToken:memoryClaim.leaseToken,answer,articles,summary});
   return {conversation:completed.conversation};
  }catch{return {conversationSyncPending:true};}
 };
 const replayMemory=async()=>{
  if(!input?.conversationId)return {};
  if(!conversationMemoryEnabled(env))return {conversationSyncPending:true};
  try{
   memory||=memoryRepository(db,{kind:'user',ownerId:contextUser.id,userId:contextUser.id,user:contextUser});
   const repair=await repairProConversationTurn(memory,{id:input.conversationId,turnId:key,now});
   const conversation=await memory.read(input.conversationId,'pro');
   return {conversation,...(!repair.repairDeferred&&conversation.turns?.some(t=>t.turnId===key&&t.status==='completed')?{}:{conversationSyncPending:true})};
  }catch{return {conversationSyncPending:true};}
 };
 try{
  const user=await authorize(request,db);
  if(!user?.id||user.is_anonymous)throw proError('Entre na sua conta JENIOS.',401,'AUTH_REQUIRED');
  contextUser=user;
  repo=repository(db,user.id);
  const config=await repo.config();
  if(action==='access'){
   const plan=await planResolver(db,user.id,now),rights=proPlanAccess(plan,user,env);
   const pass=rights.universityIncluded?null:await passResolver(db,user.id,now);
   let ledger={wallet:{status:'not_provisioned',totalNanoUsd:null,reservedNanoUsd:null,availableNanoUsd:null},allowance:{status:'unconfigured',totalNanoUsd:null,spentNanoUsd:null,reservedNanoUsd:null,availableNanoUsd:null,periodEnd:rights.periodEnd},pendingRequests:0};
   if(config.installed){ledger=await repo.status();if(ledger.ok!==true)throw proError('Não foi possível conferir o saldo.',503,'LEDGER_UNAVAILABLE');}
   const ready=proRuntimeReady(config,env);
   const creditsOffer=planOnly?{enabled:false,reason:'Créditos avulsos desativados; Pro incluído somente nos planos Global Crypto e Internacional Pro.'}:await proTopupAvailability(db,config,env);
   return respond({ok:true,freeAvailable:true,planCode:plan?.code||null,proIncluded:rights.proIncluded,universityIncluded:rights.universityIncluded||Boolean(pass),universityAccessKind:pass?'purchased-pass':rights.universityIncluded?'subscription':null,masterPreview:rights.master===true,wallet:ledger.wallet,allowance:ledger.allowance,pendingRequests:ledger.pendingRequests||0,monthlyAllowanceMicroUsd:ledger.allowance?.totalNanoUsd==null?null:ledger.allowance.totalNanoUsd/1000,allowancePeriodEnd:ledger.allowance?.periodEnd||null,paidGenerationEnabled:ready&&(!planOnly||rights.proIncluded||rights.master),paymentStatus:creditsOffer.enabled?'available':'not_enabled',creditsOffer,readinessMessage:ready?'Você escolhe a origem do saldo e confirma o limite antes de cada consulta.':reasonFor(config),pricingVersion:PRO_PRICING_VERSION,marketSymbols:PRO_SYMBOLS,marketTimeframes:PRO_TIMEFRAMES,tasks:Object.entries(PRO_TASKS).map(([id,t])=>({id,label:t.label,acceptsImage:t.acceptsImage,requiresCurrentData:t.requiresCurrentData,available:ready&&(!planOnly||rights.proIncluded||rights.master)&&config.allowedModels.includes(t.model),reason:ready?(config.allowedModels.includes(t.model)?null:'Este modelo aguarda aprovação.'):reasonFor(config)})),terms:planOnly?'Acesso avançado incluído nos planos de R$ 149,90 e R$ 199,90, sujeito aos limites internos de segurança.':'Consumo confirmado: duas vezes o custo efetivo da API. A franquia e os créditos comprados têm controles separados.'});
  }
  if(action==='history')return respond({ok:true,status:config.installed?'verified':'not_provisioned',...(config.installed?await repo.history():{items:[],hasMore:false})});
  if(request.method!=='POST')throw proError('Método não permitido.',405);
  const body=await readProBody(request);input=normalizeProInput(body,{chat:action==='chat'});
  requireRuntime(config,env,input);
  const plan=await planResolver(db,user.id,now),rights=proPlanAccess(plan,user,env);
  if(planOnly&&(!rights.proIncluded&&!rights.master||input.source!=='included'))throw proError('Este recurso avançado é exclusivo dos planos Global Crypto e Internacional Pro ativos.',402,'ADVANCED_PLAN_REQUIRED');
  if(input.source==='included'&&(!rights.proIncluded||!config.allowances?.[plan?.code]))throw proError('Não há franquia Pro ativa para esta assinatura. Confira seu plano ou o saldo comprado.',402,'ALLOWANCE_UNAVAILABLE');
  const hydrateContext=async()=>{
   let conversation=null;
   if(input.conversationId){
    if(!conversationMemoryEnabled(env))throw proError('O histórico está temporariamente indisponível. Preserve esta conversa e tente mais tarde.',503,'CONVERSATION_DISABLED');
    memory=memoryRepository(db,{kind:'user',ownerId:user.id,userId:user.id,user});
    conversation=await memory.read(input.conversationId,'pro');
    if(conversation.revision!==input.conversationRevision)throw proError('A conversa mudou. Atualize e prepare um novo orçamento.',409,'CONVERSATION_REVISION_CONFLICT');
   }
   const accountContext=accountContextFromPlan(user,plan,env,now);
   const lessonContext=await lessonLoader({db,user,rights,lessonId:input.lessonId,now});
   const context={message:input.prompt,persona:input.persona,conversationId:input.conversationId,revision:input.conversationRevision,
    turns:conversation?.turns||[],summary:conversation?.summary||null,toolContext:conversation?.toolContext||null,accountContext,lessonContext};
   prepared=prepareConversationContext(context,{now});
   input.conversationContext=prepared;
   if(input.conversationId||input.lessonId)input.contextDigest=assistantContextDigest(context);
  };
  if(action==='quote'){
   await hydrateContext();
   const ledger=await repo.status();
   if(ledger.ok!==true)throw proError('Não foi possível conferir seu saldo.',503,'LEDGER_UNAVAILABLE');
   if(ledger.pendingRequests>0)throw proError('Há uma consulta em conferência. Atualize o histórico antes de continuar.',409,'REQUEST_PENDING');
   const quote=createProQuote(input,user.id,config,env,now);
   const available=input.source==='included'?ledger.allowance?.availableNanoUsd:ledger.wallet?.availableNanoUsd;
   if(!Number.isSafeInteger(available)||available<quote.maxRetailNanoUsd)throw proError('O saldo disponível não cobre o limite desta consulta. Nenhum consumo foi realizado.',402,'INSUFFICIENT_BALANCE');
   return respond({ok:true,state:'not_started',quote,notice:'Este é o limite máximo da reserva. O débito final será duas vezes o consumo efetivo informado pela API; a diferença será liberada.'});
  }
  if(action!=='chat')throw proError('Recurso inválido.');
  const quote=verifyProQuote(body.quoteId,input,user.id,body.maxRetailNanoUsd,env,now);key=body.requestKey;
  if(quote.maxProviderNanoUsd>config.maxRequestProviderNanoUsd)throw proError('O limite por consulta mudou. Prepare um novo orçamento.',409,'REQUEST_LIMIT');
  const previous=await repo.request(key);
  if(previous){
   if(previous.fingerprint!==input.fingerprint)throw proError('Este identificador já pertence a outra consulta.',409,'IDEMPOTENCY_CONFLICT');
   if(previous.state!=='reserved')return respond({...stateReply(projectProRequest(previous),true),...(previous.state==='settled'?await replayMemory():{})},previous.state==='settled'?200:202);
  }
  await hydrateContext();
  if((input.conversationId||input.lessonId)&&quote.contextDigest!==input.contextDigest)throw proError('O contexto da conversa ou da aula mudou. Prepare um novo orçamento.',409,'CONTEXT_CHANGED');
  // Fetch source before any financial mutation; no market fallback to invented bars.
  const market=await marketLoader(input,{now});
  if(memory){
   memoryClaim=await memory.claimTurn({id:input.conversationId,turnId:key,revision:input.conversationRevision,question:input.prompt,requestFingerprint:input.fingerprint});
   if(memoryClaim.state!=='claimed')return respond({ok:false,state:memoryClaim.state==='failed'?'not_started':'needs_reconciliation',
    code:'CONVERSATION_TURN_'+String(memoryClaim.state).toUpperCase(),error:'Esta pergunta já foi registrada. Atualize o histórico antes de continuar; não houve novo envio.',
    conversation:memoryClaim.conversation,executionEnabled:false},memoryClaim.state==='failed'?409:202);
  }
  attempted=true;
  const hold=await repo.reserve(input,quote,key);
  if(hold.ok!==true){
   if(hold.state&&hold.state!=='not_started'){await memoryFailure('PRO_RESERVATION_PENDING',true);return respond({ok:false,state:hold.state,requestId:hold.requestId,error:'A consulta já está em processamento ou conferência.',executionEnabled:false},202);}
   attempted=false;throw proError('A reserva de saldo não foi autorizada. Confira seu saldo e limite.',402,hold.code||'RESERVATION_REJECTED');
  }
  const dispatch=await repo.dispatch(input,key);
  if(dispatch.ok!==true||dispatch.acquired!==true){
   let existing=await repo.request(key);
   if(dispatch.ok!==true&&existing?.state==='reserved'){
    const released=await repo.release(input,key,'Dispatch was declined before any provider call.');
    if(released.ok===true){await memoryFailure('PRO_DISPATCH_DECLINED');return respond({ok:false,state:'released',requestId:existing.id,error:'O envio não foi autorizado. A reserva foi liberada; prepare uma nova consulta.',chargedNanoUsd:0,executionEnabled:false},503);}
    existing=await repo.request(key);
   }
   await memoryFailure('PRO_DISPATCH_PENDING',existing?.state!=='released');
   return respond({...stateReply(projectProRequest(existing),true),...(existing?.state==='settled'?await replayMemory():{})},existing?.state==='settled'?200:202);
  }
  dispatched=true;
  const result=await provider(input,quote,market,{env});
  if(result.kind==='not_generated'){
   const release=await repo.reconcile(input,key,'confirmed_no_charge',{verified:true,reference:'token-preflight:'+key,actor:'jenios-pro-server',reason:'Inference was never dispatched; token preflight: '+result.reason});
   if(release.ok!==true)throw proError('A consulta não foi gerada e a reserva está em conferência.',503,'RECONCILIATION_REQUIRED');
   await memoryFailure('PRO_NOT_GENERATED');
   return respond({ok:false,state:'released',requestId:hold.requestId,error:'Não foi possível preparar a consulta. A reserva foi liberada e não houve geração de IA.',chargedNanoUsd:0,executionEnabled:false},503);
  }
  if(result.kind!=='usage_confirmed'){
   await repo.reconcile(input,key,'mark_unknown',{reason:'Provider usage is not confirmed: '+String(result.reason||'unknown').slice(0,140)});
   await memoryFailure('PRO_USAGE_UNKNOWN',true);
   return respond({ok:false,state:'needs_reconciliation',requestId:hold.requestId,error:'A resposta ou o consumo não foi confirmado. A reserva será conferida; esta consulta não será reenviada automaticamente.',executionEnabled:false},202);
  }
  const settled=await repo.settle(input,key,result);
  if(settled.ok!==true)throw proError('O consumo requer conferência antes de encerrar a reserva.',503,'RECONCILIATION_REQUIRED');
  return respond({ok:true,state:'settled',requestId:hold.requestId,answer:result.result.answer,chargedNanoUsd:result.cost.retailDebitNanoUsd,providerNanoUsd:result.cost.providerCostNanoUsd,sourceInfo:result.result.source,replayed:false,executionEnabled:false,...await memoryCompletion(result.result.answer)});
 }catch(error){
  if(attempted){
   // If a DB response was lost, read the durable state; never claim that no hold exists.
   try{
    const row=await repo.request(key);
    if(row?.state==='settled')return respond({...stateReply(projectProRequest(row),true),...await replayMemory()});
    if(row?.state==='reserved'&&!dispatched){
     const released=await repo.release(input,key,'Server stopped before provider dispatch.');
     if(released.ok===true){await memoryFailure('PRO_NOT_DISPATCHED');return respond({ok:false,state:'released',error:'A consulta não foi enviada e a reserva foi liberada.',chargedNanoUsd:0,executionEnabled:false},503);}
    }
    if(row?.state==='released'){await memoryFailure('PRO_RELEASED');return respond({...stateReply(projectProRequest(row),true),error:'A reserva foi liberada; prepare uma nova consulta.'},503);}
    if(row?.state==='dispatched')await repo.reconcile(input,key,'mark_unknown',{reason:'Dispatch or settlement outcome could not be confirmed by the server.'});
   }catch{}
   await memoryFailure('PRO_RECONCILIATION_REQUIRED',true);
   return respond({ok:false,state:'needs_reconciliation',code:'RECONCILIATION_REQUIRED',error:'Confira o histórico: não foi possível confirmar o encerramento desta consulta. Nenhum reenvio automático será realizado.',executionEnabled:false},202);
  }
  await memoryFailure('PRO_NOT_STARTED');
  return respond({ok:false,state:'not_started',error:error.status?error.message:'O Pro está temporariamente indisponível.',code:error.code||'PRO_UNAVAILABLE',executionEnabled:false},{400:400,401:401,402:402,403:403,404:404,405:405,409:409,413:413,415:415,422:422,429:429,502:502,503:503}[error.status]||503);
 }
}
