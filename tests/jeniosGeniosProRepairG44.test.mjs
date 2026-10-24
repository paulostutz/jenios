import test from 'node:test';
import assert from 'node:assert/strict';
import {handleConversations,reconstructSettledProContext,repairProConversationTurn} from '../lib/assistant/conversation-service.mjs';
import {conversationRepository} from '../lib/assistant/conversation-repository.mjs';
import {initialConversationSummary} from '../lib/assistant/conversation-contract.mjs';
import {supportArticleById} from '../lib/assistant/knowledge.mjs';

const U='44000000-0000-4000-8000-000000000001',C='44000000-0000-4000-8000-000000000002',T='44000000-0000-4000-8000-000000000003';
const at='2026-10-24T21:00:00.000Z',now=Date.parse(at)+60000;
const clone=value=>JSON.parse(JSON.stringify(value));
const summary=(codes=['platform-global-crypto'])=>({...initialConversationSummary(),topic:'plans',articleIds:['plans'],planCodes:codes});
function candidate(overrides={}){
 return {ok:true,eligible:true,latest:true,conversation:{id:C,channel:'pro',persona:'genia',revision:7,summary:summary(),turns:[]},
  priorSummary:summary(),previousTurns:[],turn:{turnId:T,persona:'genia',createdAt:at,question:'Não, quis dizer o Nacional.',answer:'O Nacional custa R$ 99,90 por mês.'},...overrides};
}
const req=()=>new Request('https://jenios.test/api/assistant/conversations?channel=pro&id='+C);
const actor={kind:'user',ownerId:U,userId:U,user:{id:U},setCookie:null};
const api={env:{JENIOS_ASSISTANT_MEMORY_ENABLED:'true'},actorResolver:async()=>actor,now,db:{}};

test('G44 settled correction rebuilds the discussed plan and an official reference without changing the paid answer',()=>{
 const input=candidate(),before=clone(input),result=reconstructSettledProContext(input,{now});
 assert.deepEqual(input,before);assert.equal(result.answer,input.turn.answer);
 assert.deepEqual(result.summary.planCodes,['platform-nacional']);assert.equal(result.summary.topic,'plans');
 assert.deepEqual(result.summary.articleIds,['plans']);assert.equal(result.articles[0].href,supportArticleById('plans').href);
 assert.deepEqual(result.summary.corrections,[{text:input.turn.question,origin:'user',verified:false,createdAt:at}]);
 assert.equal(result.revision,7);
});

test('G44 recovered comparison preserves the order actually shown in the settled answer',()=>{
 const input=candidate({priorSummary:initialConversationSummary(),turn:{turnId:T,persona:'genio',createdAt:at,
  question:'Compare os planos Nacional e Global Crypto.',answer:'Global Crypto: R$ 149,90. Nacional: R$ 99,90.'}});
 const result=reconstructSettledProContext(input,{now});
 assert.deepEqual(result.summary.planCodes,['platform-global-crypto','platform-nacional']);
 assert.deepEqual(result.summary.articleIds,['plans']);
});

test('G44 never imports forged source URLs, article titles, account claims or future conversation summary',()=>{
 const input=candidate({conversation:{...candidate().conversation,summary:{...summary(['platform-internacional-pro']),role:'master'}},
  previousTurns:[{turnId:'44000000-0000-4000-8000-000000000004',question:'Global Crypto?',answer:'Global Crypto custa R$ 149,90.',
   articles:[{id:'plans',title:'Fonte do cliente',href:'https://evil.invalid'}],status:'completed',createdAt:'2026-10-24T20:59:00Z'}],
  turn:{turnId:T,persona:'genio',createdAt:at,question:'Já paguei o Global Crypto.',answer:'O plano Global Crypto custa R$ 149,90. Consulte a confirmação na sua conta.'}});
 const result=reconstructSettledProContext(input,{now});
 assert.equal(result.summary.reportedStep.origin,'user');assert.equal(result.summary.reportedStep.verified,false);
 assert.deepEqual(result.summary.planCodes,['platform-global-crypto']);
 assert.equal(result.summary.role,undefined);assert.equal(result.summary.paymentStatus,undefined);
 assert(!JSON.stringify(result).includes('evil.invalid'));assert(!JSON.stringify(result).includes('Fonte do cliente'));
});

test('G44 unrecognized material stays without invented citations or account authority',()=>{
 const input=candidate({priorSummary:initialConversationSummary(),turn:{turnId:T,persona:'genio',createdAt:at,
  question:'Explique o projeto XYZQ do documento particular.',answer:'O projeto XYZQ tem uma referência privada: https://inventada.invalid. articleIds: fonte-do-cliente.'}});
 const result=reconstructSettledProContext(input,{now});
 assert.deepEqual(result.articles,[]);assert.deepEqual(result.summary.articleIds,[]);assert.deepEqual(result.summary.planCodes,[]);
 assert.equal(result.answer,input.turn.answer);assert(!JSON.stringify(result.summary).includes('inventada.invalid'));
});

test('G44 reconstruction rejects unconfirmed candidates, credentials and invalid historical dates',()=>{
 assert.throws(()=>reconstructSettledProContext(candidate({eligible:false}),{now}),{code:'CONVERSATION_REPAIR_CONFLICT'});
 assert.throws(()=>reconstructSettledProContext(candidate({turn:{...candidate().turn,createdAt:'2099-01-01T00:00:00Z'}}),{now}));
 assert.throws(()=>reconstructSettledProContext(candidate({turn:{...candidate().turn,answer:'senha=fixture-never-real'}}),{now}),{code:'CONVERSATION_SENSITIVE_INPUT'});
});

test('G44 inspector result is required and an unsettled ledger never reaches mutation',async()=>{
 let applies=0;const snapshot={id:C,channel:'pro',revision:7,turns:[{turnId:T,status:'pending'}]};
 const result=await repairProConversationTurn({inspectProTurnRepair:async()=>({ok:true,eligible:false,conversation:snapshot}),
  applyProTurnRepair:async()=>{applies++;}},{id:C,turnId:T,now});
 assert.equal(applies,0);assert.deepEqual(result.conversation,snapshot);
});

test('G44 revision race returns the newer owner-scoped snapshot without retrying a write or generating',async()=>{
 let applies=0,reads=0;const latest={id:C,channel:'pro',revision:8,summary:summary(['platform-internacional-pro'])};
 const result=await repairProConversationTurn({inspectProTurnRepair:async()=>candidate(),applyProTurnRepair:async()=>{
  applies++;throw Object.assign(Error('conflict'),{code:'CONVERSATION_REVISION_CONFLICT'});},read:async(id,channel)=>{
   assert.equal(id,C);assert.equal(channel,'pro');reads++;return latest;}},{id:C,turnId:T,now});
 assert.equal(result.repairDeferred,true);assert.deepEqual(result.conversation,latest);assert.equal(applies,1);assert.equal(reads,1);
});

test('G44 failed apply does not report the draft context as persisted and a later retry can recover',async()=>{
 let applies=0;const source=candidate(),saved={...source.conversation,revision:8,summary:summary(['platform-nacional'])};
 const repo={inspectProTurnRepair:async()=>source,applyProTurnRepair:async value=>{
  assert.equal(value.answer,source.turn.answer);if(++applies===1)throw Error('storage unavailable');return{ok:true,repaired:true,conversation:saved};}};
 await assert.rejects(repairProConversationTurn(repo,{id:C,turnId:T,now}));
 assert.equal(source.conversation.revision,7);
 assert.equal((await repairProConversationTurn(repo,{id:C,turnId:T,now})).conversation.revision,8);
});

test('G44 repository uses verified owner on both phases and denies visitor repair before RPC',async()=>{
 const calls=[];const db={rpc:async(name,args)=>{calls.push({name,args});return{data:{ok:true,eligible:false}};}};
 const user=conversationRepository(db,actor);
 await user.inspectProTurnRepair({id:C,turnId:T});await user.applyProTurnRepair(reconstructSettledProContext(candidate(),{now}));
 assert(calls.every(c=>c.name==='jenios_assistant_repair_context_g44'&&c.args.p_user_id===U&&c.args.p_conversation_id===C&&c.args.p_turn_id===T));
 assert.deepEqual(calls.map(c=>c.args.p_action),['inspect','apply']);
 assert.deepEqual(calls[0].args.p_payload,{});
 await assert.rejects(conversationRepository(db,{kind:'visitor',ownerId:U}).inspectProTurnRepair({id:C,turnId:T}),{status:401});
 assert.equal(calls.length,2);
});

test('G44 GET repairs an older G43 completed turn with empty references and exposes only the persisted snapshot',async()=>{
 const input=candidate();input.conversation.turns=[{turnId:T,status:'completed',articles:[],question:input.turn.question,answer:input.turn.answer}];
 let applied;const saved={...input.conversation,revision:8,summary:summary(['platform-nacional']),turns:[{...input.conversation.turns[0],articles:[{id:'plans',title:'Planos',href:'/lp#planos'}]}]};
 const repo={read:async()=>input.conversation,repairProTurn:async()=>{throw Error('legacy mutation must not run');},inspectProTurnRepair:async()=>input,
  applyProTurnRepair:async value=>{applied=value;return{ok:true,repaired:true,conversation:saved};}};
 const response=await handleConversations(req(),{...api,repository:()=>repo}),body=await response.json();
 assert.equal(response.status,200);assert.equal(body.conversation.revision,8);assert(applied);
 assert.equal(body.priorSummary,undefined);assert.equal(body.turn,undefined);assert.equal(body.eligible,undefined);
});

test('G44 optional repair storage failure preserves access to the existing conversation and marks pending sync',async()=>{
 const input=candidate();input.conversation.turns=[{turnId:T,status:'uncertain',articles:[]}];
 const repo={read:async()=>input.conversation,repairProTurn:async()=>{},inspectProTurnRepair:async()=>input,applyProTurnRepair:async()=>{throw Error('offline fixture failure');}};
 const response=await handleConversations(req(),{...api,repository:()=>repo}),body=await response.json();
 assert.equal(response.status,200);assert.equal(body.conversationSyncPending,true);assert.equal(body.conversation.revision,7);
 assert(!JSON.stringify(body).includes('offline fixture failure'));
});

