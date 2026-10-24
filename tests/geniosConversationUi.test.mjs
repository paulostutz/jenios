import test from 'node:test';
import assert from 'node:assert/strict';
import {conversationSnapshot,conversationKey,storedConversation,rememberConversationId,mergeConversationTurns,mergeConsultationRows,safeAssistantLinks,lessonFromSearch,conversationScreen} from '../app/components/assistant/conversation-client.mjs';
const id='10000000-0000-4000-8000-000000000001',turnId='20000000-0000-4000-8000-000000000001';
const snapshot=()=>({id,channel:'support',persona:'genia',revision:2,remember:false,turns:[{turnId,question:'E esse plano?',answer:'Continuação confirmada',status:'completed',articles:[]}]});
test('conversation browser storage contains only scoped IDs, never transcript',()=>{
 const data=new Map(),storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
 rememberConversationId(storage,'support','user-a',id);
 assert.equal(storedConversation(storage,'support','user-a'),id);
 assert.equal(storedConversation(storage,'support','user-b'),null);
 assert.equal(storedConversation(storage,'pro','user-a'),null);
 assert.deepEqual([...data.values()],[id]);
 rememberConversationId(storage,'support','user-a',null);assert.equal(data.size,0);
 assert.notEqual(conversationKey('support','visitor'),conversationKey('support','user-a'));
});
test('storage failures do not invent persisted memory',()=>{
 const storage={getItem(){throw Error();},setItem(){throw Error();},removeItem(){throw Error();}};
 assert.equal(storedConversation(storage,'support','visitor'),null);
 assert.equal(rememberConversationId(storage,'support','visitor',id),false);
});
test('snapshot rejects wrong channel and invalid revision before rendering',()=>{
 assert.equal(conversationSnapshot(snapshot(),'support').turns.length,1);
 assert.equal(conversationSnapshot(snapshot(),'pro'),null);
 assert.equal(conversationSnapshot({...snapshot(),revision:-1},'support'),null);
 assert.equal(conversationSnapshot({...snapshot(),id:'other'},'support'),null);
 assert.equal(conversationSnapshot({...snapshot(),remember:'true'},'support'),null);
});
test('confirmed server response supersedes cancelled local placeholder exactly once',()=>{
 const rows=mergeConversationTurns(snapshot(),[{turnId,question:'E esse plano?',answer:'',status:'unconfirmed'},{turnId:'30000000-0000-4000-8000-000000000001',question:'Outra dúvida',answer:'',status:'pending'}]);
 assert.equal(rows.length,2);assert.equal(rows[0].answer,'Continuação confirmada');
 assert.equal(rows[1].status,'pending');
});
test('protected consultation refresh recovers the same turn and preserves completed tool cards',()=>{
 const pending={id:turnId,result:{mode:'pending',explanation:'Esperando'}};
 const rich={id:turnId,result:{mode:'tool',facts:[{label:'Fonte',value:'Verificada'}],explanation:'Consulta confirmada'}};
 const draft={id:'next:question',question:'E a próxima consulta?'};
 const recovered=mergeConsultationRows(snapshot(),[{id:turnId+':question',question:'E esse plano?'},pending,draft]);
 assert.equal(recovered.filter(r=>r.id===turnId).length,1);
 assert.equal(recovered.find(r=>r.id===turnId).result.explanation,'Continuação confirmada');
 assert.equal(recovered.at(-1),draft);
 assert.equal(mergeConsultationRows(snapshot(),[rich]).find(r=>r.id===turnId),rich);
 assert.equal(mergeConsultationRows({...snapshot(),turns:[{...snapshot().turns[0],answer:'',status:'pending'}]},[rich]).find(r=>r.id===turnId),rich);
});
test('rendered references reject script and protocol-relative destinations',()=>{
 assert.deepEqual(safeAssistantLinks([{href:'javascript:alert(1)',title:'bad'},{href:'//evil.invalid',title:'bad'},{href:'/checkout',title:'Planos'},{href:'https://example.invalid/source',title:'Fonte'}]).map(x=>x.href),['/checkout','https://example.invalid/source']);
});
test('lesson handoff allows one bounded identifier but never query commands',()=>{
 assert.equal(lessonFromSearch('?task=university_tutor&lessonId=risco-basico'),'risco-basico');
 for(const search of ['?lessonId=a&lessonId=b','?lessonId=https://bad.invalid','?lessonId=<script>','?lessonId=Risco_Basico','?lessonId='+('x'.repeat(101))])assert.equal(lessonFromSearch(search),null);
});
test('screen context excludes query strings and unsupported routes',()=>{
 assert.equal(conversationScreen('/platform/assistente'),'/platform/assistente');
 assert.equal(conversationScreen('/lp'),'/lp');
 assert.equal(conversationScreen('/social?access_token=secret'),null);
 assert.equal(conversationScreen('//evil.invalid'),null);
});

