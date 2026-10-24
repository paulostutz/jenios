import test from 'node:test';
import assert from 'node:assert/strict';
import {handleFreeAssistant,normalizeFreeInput} from '../lib/assistant/free-service.mjs';
import {handlePro} from '../lib/assistant/pro-service.mjs';
import {normalizeProInput} from '../lib/assistant/pro-input.mjs';
import {proProviderPayload} from '../lib/assistant/pro-provider.mjs';
import {accountContextFromPlan,loadAuthorizedLesson,assistantContextDigest,toolContextFromResult} from '../lib/assistant/context-authority.mjs';
import {initialConversationSummary} from '../lib/assistant/conversation-contract.mjs';
import {handleAssistantReview} from '../lib/assistant/admin-feedback-service.mjs';
import {initialState} from '../lib/learning/engine.mjs';
import {handleAssistant} from '../lib/assistant/service.mjs';
import {INITIAL_ASSISTANT_STATE} from '../lib/assistant/contracts.mjs';

const USER='43000000-0000-4000-8000-000000000001',OTHER='43000000-0000-4000-8000-000000000002';
const CID='43000000-0000-4000-8000-000000000003',TURN='43000000-0000-4000-8000-000000000004',LEASE='43000000-0000-4000-8000-000000000005';
const OLD='43000000-0000-4000-8000-000000000006',now=Date.parse('2026-10-24T20:00:00Z');
const prior={turnId:OLD,question:'Quais são os planos?',answer:'Nacional, Global Crypto e Internacional Pro.',articles:[{id:'plans',title:'Planos',href:'/lp#planos'}],createdAt:'2026-10-24T19:59:00.000Z',status:'completed'};
const actor={kind:'user',ownerId:USER,userId:USER,user:{id:USER}};
const plan={code:'platform-global-crypto',periodStart:'2026-10-01T00:00:00Z',periodEnd:'2026-11-01T00:00:00Z'};
const request=(body,path='/api/assistant/free')=>new Request('https://jenios.test'+path,{method:'POST',headers:{'content-type':'application/json',origin:'https://jenios.test',authorization:'Bearer fixture'},body:JSON.stringify(body)});
const fail=(code,status=409)=>Object.assign(Error(code),{code,status});
const clone=value=>structuredClone(value);
function memoryFixture(channel='support'){
 const snapshot={id:CID,channel,persona:'genio',revision:0,remember:false,expiresAt:'2026-10-25T20:00:00Z',turns:[clone(prior)],summary:initialConversationSummary(),toolContext:null};
 let completions=0,claims=0,failComplete=false;
 const repo={
  read:async(id,requested)=>{if(id!==CID||requested&&requested!==channel)throw fail('CONVERSATION_NOT_FOUND',404);return clone(snapshot);},
  claimTurn:async({id,turnId,revision,question,requestFingerprint})=>{
   claims++;assert.equal(id,CID);if(channel==='pro')assert.match(requestFingerprint,/^[a-f0-9]{64}$/);
   let turn=snapshot.turns.find(x=>x.turnId===turnId);
   if(turn){if(turn.question!==question)throw fail('CONVERSATION_TURN_CONFLICT');return {state:turn.status,turn:clone(turn),conversation:clone(snapshot)};}
   if(revision!==snapshot.revision)throw fail('CONVERSATION_REVISION_CONFLICT');
   if(snapshot.turns.some(t=>t.status==='pending'))throw fail('CONVERSATION_TURN_BUSY');
   turn={turnId,question,answer:null,articles:[],createdAt:new Date(now).toISOString(),status:'pending'};
   snapshot.turns.push(turn);snapshot.revision++;
   return {state:'claimed',turn:clone(turn),conversation:clone(snapshot),leaseToken:LEASE};
  },
  completeTurn:async({turnId,leaseToken,answer,articles,summary,toolContext})=>{
   assert.equal(leaseToken,LEASE);if(failComplete)throw fail('CONVERSATION_STORAGE_UNAVAILABLE',503);
   const turn=snapshot.turns.find(x=>x.turnId===turnId);turn.answer=answer;turn.articles=articles;turn.status='completed';snapshot.summary=summary;
   if(toolContext!==undefined)snapshot.toolContext=toolContext;snapshot.revision++;completions++;
   return {ok:true,conversation:clone(snapshot)};
  },
  failTurn:async({turnId,uncertain})=>{const turn=snapshot.turns.find(t=>t.turnId===turnId);if(turn)turn.status=uncertain?'uncertain':'failed';return {ok:true};}
 };
 return {repo,snapshot,setFailComplete:v=>{failComplete=v;},stats:()=>({claims,completions}),factory:(db,resolved)=>{assert.equal(resolved.ownerId,USER);return repo;}};
}
const supportBody={persona:'genia',message:'E o segundo?',conversationId:CID,revision:0,turnId:TURN,screen:'/platform/assistente'};
const supportAnswer={ok:true,free:true,paidAi:false,mode:'guided',explanation:'O Global Crypto custa R$ 149,90 por mês.',articles:[],summary:initialConversationSummary(),modelCalls:0};
const supportOptions=memory=>({db:{},env:{JENIOS_ASSISTANT_MEMORY_ENABLED:'true'},now,actorResolver:async()=>actor,repository:memory.factory,
 accountLoader:async()=>accountContextFromPlan(actor.user,plan,{},now)});

test('G43 free support receives only server history and verified account context',async()=>{
 const memory=memoryFixture();let received;
 const response=await handleFreeAssistant(request(supportBody),{...supportOptions(memory),reply:async input=>{received=input;return supportAnswer;}});
 const body=await response.json();assert.equal(response.status,200);assert.equal(received.turns[0].question,prior.question);assert.equal(received.accountContext.planCode,plan.code);
 assert.equal(body.conversation.turns.at(-1).status,'completed');assert.equal(body.conversation.persona,'genio');assert.equal(body.executionEnabled,false);
});
test('G43 client history, account, owner and elevated roles are rejected before memory or model access',()=>{
 for(const field of ['history','turns','summary','ownerId','userId','accountContext','role','planCode','toolContext'])assert.throws(()=>normalizeFreeInput({...supportBody,[field]:'forged'}));
 assert.throws(()=>normalizeFreeInput({...supportBody,screen:'https://evil.invalid'}));
 assert.throws(()=>normalizeFreeInput({...supportBody,revision:undefined}));
});
test('G43 same free turn replays once without another generation or quota write',async()=>{
 const memory=memoryFixture();let calls=0;const options={...supportOptions(memory),reply:async()=>{calls++;return supportAnswer;}};
 await handleFreeAssistant(request(supportBody),options);
 const response=await handleFreeAssistant(request(supportBody),options),body=await response.json();
 assert.equal(response.status,200);assert.equal(body.replayed,true);assert.equal(calls,1);assert.equal(memory.stats().completions,1);
});
test('G43 overlapping support requests claim the provider operation only once',async()=>{
 const memory=memoryFixture();let calls=0;const options={...supportOptions(memory),reply:async()=>{calls++;await Promise.resolve();return supportAnswer;}};
 const responses=await Promise.all([handleFreeAssistant(request(supportBody),options),handleFreeAssistant(request(supportBody),options)]);
 assert.equal(calls,1);assert.deepEqual(responses.map(r=>r.status).sort(),[200,202]);
});
test('G43 channel and actor errors never silently downgrade to a visitor conversation',async()=>{
 const memory=memoryFixture('pro');let calls=0;
 const response=await handleFreeAssistant(request(supportBody),{...supportOptions(memory),reply:async()=>{calls++;return supportAnswer;}});
 assert.equal(response.status,404);assert.equal(calls,0);assert.equal(memory.stats().claims,0);
 const invalid=await handleFreeAssistant(request(supportBody),{...supportOptions(memory),actorResolver:async()=>{throw fail('CONVERSATION_AUTH_REQUIRED',401);}});
 assert.equal(invalid.status,401);
});
test('G43 disabled memory refuses a supplied conversation but preserves offline public support',async()=>{
 let constructed=0;const options={env:{},getDb:()=>{constructed++;throw Error('not configured');},now};
 const anonymous=new Request('https://jenios.test/api/assistant/free',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({persona:'genio',message:'Como publicar uma foto?'})});
 const response=await handleFreeAssistant(anonymous,options);assert.equal(response.status,200);assert.equal((await response.json()).paidAi,false);assert.equal(constructed,0);
 const blocked=await handleFreeAssistant(request(supportBody),options);assert.equal(blocked.status,503);assert.equal(constructed,0);
});
test('G43 response completion remains visible if conversation synchronization fails',async()=>{
 const memory=memoryFixture();memory.setFailComplete(true);
 const response=await handleFreeAssistant(request(supportBody),{...supportOptions(memory),reply:async()=>supportAnswer}),body=await response.json();
 assert.equal(body.explanation,supportAnswer.explanation);assert.equal(body.conversationSyncPending,true);
 assert.equal(memory.snapshot.turns.at(-1).status,'pending');
});
test('G43 a support provider configuration failure keeps the public guided path available',async()=>{
 const anonymous=new Request('https://jenios.test/api/assistant/free',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({persona:'genia',message:'Quais planos existem?'})});
 const response=await handleFreeAssistant(anonymous,{env:{JENIOS_SALES_GENERATIVE_ENABLED:'true'},getDb:()=>{throw Error('private configuration failure');},now});
 assert.equal(response.status,200);const body=await response.json();assert.equal(body.mode,'guided');assert.equal(body.modelCalls,0);assert.ok(!JSON.stringify(body).includes('private configuration'));
});
test('G43 context digest changes on substantive facts, not clock passage',()=>{
 const context={conversationId:CID,revision:0,turns:[prior],summary:initialConversationSummary(),accountContext:accountContextFromPlan(actor.user,plan,{},now)};
 const expected=assistantContextDigest(context);
 assert.equal(assistantContextDigest({...context,accountContext:{...context.accountContext,asOf:new Date(now+60000).toISOString()}}),expected);
 for(const changed of [{...context,revision:1},{...context,turns:[{...prior,answer:'Different'}]},{...context,accountContext:{...context.accountContext,planCode:'platform-nacional'}}])assert.notEqual(assistantContextDigest(changed),expected);
});
function proHarness(){
 const memory=memoryFixture('pro'),rows=new Map();let calls=0,reserves=0,captured;
 const env={JENIOS_ASSISTANT_MEMORY_ENABLED:'true',JENIOS_PRO_GENERATION_ENABLED:'true',OPENAI_API_KEY:'synthetic-key-for-local-fixture-only',JENIOS_PRO_QUOTE_SECRET:'synthetic-signing-secret-at-least-32-characters'};
 const config={installed:true,generationEnabled:true,allowedModels:['gpt-6-luna'],maxRequestProviderNanoUsd:1_000_000_000,allowances:{[plan.code]:2_000_000_000}};
 const repo={config:async()=>config,status:async()=>({ok:true,pendingRequests:0,allowance:{availableNanoUsd:2_000_000_000}}),request:async key=>rows.get(key),
  reserve:async(input,quote,key)=>{reserves++;rows.set(key,{id:key,user_id:USER,request_key:key,fingerprint:input.fingerprint,task:input.task,source:input.source,state:'reserved',created_at:new Date(now).toISOString(),provider_nano_usd:0,charged_nano_usd:0});return {ok:true,requestId:key};},
  dispatch:async(input,key)=>{rows.get(key).state='dispatched';return {ok:true,acquired:true};},
  settle:async(input,key,result)=>{Object.assign(rows.get(key),{state:'settled',result_data:result.result,provider_nano_usd:100,charged_nano_usd:200});return {ok:true};},
  reconcile:async(input,key)=>{rows.get(key).state='needs_reconciliation';return {ok:true};},release:async(input,key)=>{rows.get(key).state='released';return {ok:true};}};
 const options={db:{},env,now,planOnly:true,authorize:async()=>actor.user,repository:()=>repo,memoryRepository:memory.factory,planResolver:async()=>plan,
  marketLoader:async()=>null,provider:async input=>{calls++;captured=input;return {kind:'usage_confirmed',cost:{providerCostNanoUsd:100,retailDebitNanoUsd:200},usage:{input_tokens:1,output_tokens:0},result:{answer:'O segundo plano é o Global Crypto.',persona:'genia',source:null}};}};
 const input={persona:'genia',task:'advanced_question',prompt:'E o segundo?',source:'included',conversationId:CID,conversationRevision:0};
 return {memory,rows,repo,options,input,stats:()=>({calls,reserves}),captured:()=>captured,
  async quoted(){const response=await handlePro(request(input),{...options,action:'quote'});assert.equal(response.status,200);const {quote}=await response.json();return {...input,requestKey:TURN,quoteId:quote.id,maxRetailNanoUsd:quote.maxRetailNanoUsd,consent:true};}};
}
test('G43 Pro binds server context to its quote, supplies previous turns and replays settled answers',async()=>{
 const h=proHarness(),body=await h.quoted();assert.deepEqual(h.stats(),{calls:0,reserves:0});
 const response=await handlePro(request(body),{...h.options,action:'chat',now:now+60000}),data=await response.json();
 assert.equal(response.status,200);assert.equal(data.conversation.turns.at(-1).status,'completed');
 assert.equal(h.captured().conversationContext.turns[0].question,prior.question);
 const payload=proProviderPayload(h.captured(),{maxOutputTokens:2000},null),prompt=JSON.parse(payload.input[0].content[0].text);
 assert.equal(prompt.verifiedAccount.planCode,plan.code);assert.equal(prompt.conversation.turns.length,1);assert.deepEqual(payload.tools,[]);assert.equal(payload.store,false);
 const repeated=await handlePro(request(body),{...h.options,action:'chat'});assert.equal((await repeated.json()).replayed,true);assert.deepEqual(h.stats(),{calls:1,reserves:1});
});
test('G43 changed conversation revision or lesson facts invalidate quote before holding balance',async()=>{
 const h=proHarness(),body=await h.quoted();h.memory.snapshot.revision++;
 const response=await handlePro(request(body),{...h.options,action:'chat'});assert.equal(response.status,409);assert.deepEqual(h.stats(),{calls:0,reserves:0});
 const fresh=proHarness(),quoted=await fresh.quoted();fresh.memory.snapshot.turns[0].answer='Altered context';
 const changed=await handlePro(request(quoted),{...fresh.options,action:'chat'});assert.equal((await changed.json()).code,'CONTEXT_CHANGED');assert.deepEqual(fresh.stats(),{calls:0,reserves:0});
});
test('G43 a settled Pro result is shown once even when memory is temporarily unavailable',async()=>{
 const h=proHarness(),body=await h.quoted();h.memory.setFailComplete(true);
 const response=await handlePro(request(body),{...h.options,action:'chat'}),data=await response.json();
 assert.equal(response.status,200);assert.equal(data.state,'settled');assert.equal(data.conversationSyncPending,true);assert.ok(data.answer);
 const repeat=await handlePro(request(body),{...h.options,action:'chat'});assert.equal((await repeat.json()).replayed,true);assert.deepEqual(h.stats(),{calls:1,reserves:1});
});
test('G43 prohibited Pro history injection and prepaid usage fail before provider dispatch',async()=>{
 const h=proHarness();assert.throws(()=>normalizeProInput({...h.input,history:[prior]}));assert.throws(()=>normalizeProInput({...h.input,lessonId:'mercado'}));
 const response=await handlePro(request({...h.input,source:'prepaid'}),{...h.options,action:'quote'});assert.equal((await response.json()).code,'ADVANCED_PLAN_REQUIRED');assert.deepEqual(h.stats(),{calls:0,reserves:0});
});
test('G43 official lessons require an entitled user and an unlocked curriculum, with active exams respected',async()=>{
 const state=initialState(),options={db:{},user:actor.user,rights:{universityIncluded:true},lessonId:'mercado',now,repository:()=>({read:async()=>({state})})};
 await assert.rejects(loadAuthorizedLesson({...options,rights:{universityIncluded:false}}),{status:403});
 await assert.rejects(loadAuthorizedLesson(options),{code:'LESSON_LOCKED'});
 state.placement={};const lesson=await loadAuthorizedLesson(options);assert.equal(lesson.lessonId,'mercado');assert.equal(lesson.verified,true);assert.ok(lesson.paragraphs.length);
 state.pending={expiresAt:new Date(now+60000).toISOString()};await assert.rejects(loadAuthorizedLesson(options),{code:'ASSESSMENT_ACTIVE'});
});
test('G43 tool follow-up keeps source date distinct from request date and drops unsafe fields',()=>{
 const context=toolContextFromResult({mode:'tool',tool:'crypto_basic',title:'Consulta',consultedAt:new Date(now).toISOString(),facts:[{label:'Horário da fonte',value:'2026-10-20T12:00:00Z'},{label:'Estado',value:'Fonte indisponível'}],privateSecret:'must not appear'});
 assert.equal(context.sourceAt,'2026-10-20T12:00:00.000Z');assert.notEqual(context.sourceAt,context.observedAt);assert.ok(!JSON.stringify(context).includes('privateSecret'));
 const wide=toolContextFromResult({mode:'tool',tool:'trends',title:'Consulta',consultedAt:new Date(now).toISOString(),facts:Array.from({length:12},(_,i)=>({label:'Texto '+i,value:'漢'.repeat(400)}))});
 assert.ok(Buffer.byteLength(JSON.stringify(wide),'utf8')<3000);
});
test('G43 valid public transaction identifiers reach the protected tool without being stored as a secret',async()=>{
 const identifier='0x'+'1'.repeat(64),target={network:'ethereum',type:'transaction',identifier};
 const snapshot={id:CID,channel:'support',persona:'genio',revision:0,turns:[],summary:initialConversationSummary()};
 let claim,completion,toolCalls=0,row={user_id:USER,revision:0,state:INITIAL_ASSISTANT_STATE()};
 const db={rpc:async(name,args)=>{
  assert.equal(args.p_owner_id,USER);
  if(args.p_action==='read')return {data:{ok:true,conversation:snapshot}};
  if(args.p_action==='claim'){claim=args.p_payload;return {data:{ok:true,state:'claimed',leaseToken:LEASE,conversation:{...snapshot,revision:1},turn:{turnId:TURN}}};}
  if(args.p_action==='complete'){completion=args.p_payload;return {data:{ok:true,conversation:{...snapshot,revision:2}}};}
  throw Error('Unexpected mutation');
 }};
 const response=await handleAssistant(request({action:'tool',revision:0,tool:'crypto_basic',input:target,format:'json',confirmed:true,conversationId:CID,conversationRevision:0,turnId:TURN}),{
  db,now,env:{JENIOS_ASSISTANT_MEMORY_ENABLED:'true'},authorize:async()=>actor.user,
  repository:()=>({read:async()=>row,write:async(revision,state)=>{assert.equal(revision,row.revision);row={...row,state,revision:revision+1};return row;}}),
  handlers:{cryptoBasic:async req=>{toolCalls++;assert.deepEqual(await req.json(),target);return Response.json({ok:true,report:{...target,status:'Registro observado',checkedAt:new Date(now).toISOString(),disclaimer:'Consulta informativa.'}});}}
 });
 const body=await response.json();assert.equal(response.status,200);assert.equal(toolCalls,1);assert.match(claim.requestFingerprint,/^[a-f0-9]{64}$/);
 assert.ok(!claim.question.includes(identifier));assert.match(claim.question,/Validador/);assert.ok(completion);assert.equal(body.conversation.revision,2);
});
test('G43 feedback Admin authenticates Master before any review and never publishes claims',async()=>{
 let reviewed=0,permission;const req=new Request('https://jenios.test/api/admin/assistant-feedback');
 const denied=await handleAssistantReview(req,{env:{JENIOS_ASSISTANT_MEMORY_ENABLED:'true'},authorize:async()=>{throw fail('Forbidden',403);},review:async()=>{reviewed++;}});
 assert.equal(denied.status,403);assert.equal(reviewed,0);
 const allowed=await handleAssistantReview(req,{env:{JENIOS_ASSISTANT_MEMORY_ENABLED:'true'},authorize:async(r,db,p)=>{permission=p;},review:async()=>({ok:true,items:[],totalConsent:0}),now});
 assert.equal(permission,'permissions.manage');assert.equal((await allowed.json()).autoPublished,false);
});
