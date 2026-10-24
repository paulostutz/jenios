import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {conversationSnapshot,conversationKey,storedConversation,rememberConversationId,mergeConversationTurns,mergeConsultationRows,safeAssistantLinks,lessonFromSearch,conversationScreen,assistantResponsePresentation} from '../app/components/assistant/conversation-client.mjs';
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
 const rows=mergeConversationTurns(snapshot(),[{turnId,question:'E esse plano?',answer:'',status:'unconfirmed',notice:'A espera foi interrompida.'},{turnId:'30000000-0000-4000-8000-000000000001',question:'Outra dúvida',answer:'',status:'pending'}]);
 assert.equal(rows.length,2);assert.equal(rows[0].answer,'Continuação confirmada');
 assert.equal(rows[0].mode,'history');assert.equal(rows[0].notice,undefined);
 assert.equal(rows[1].status,'pending');
});
test('confirmed snapshot keeps the mode and notice returned with the same answer in this visit',()=>{
 const server=snapshot();server.turns[0].articles=[{id:'planos',href:'/checkout',title:'Planos'}];
 for(const mode of ['ai','guided']){
  const rows=mergeConversationTurns(server,[{turnId,answer:' Continuação confirmada ',mode,notice:'Aviso desta resposta',articles:[]}]);
  assert.equal(rows.length,1);assert.equal(rows[0].answer,server.turns[0].answer);
  assert.equal(rows[0].mode,mode);assert.equal(rows[0].notice,'Aviso desta resposta');
  assert.equal(rows[0].source,'server');assert.deepEqual(rows[0].articles,server.turns[0].articles);
 }
});
test('another or restored answer never inherits an unconfirmed AI label or an unrelated notice',()=>{
 const rows=mergeConversationTurns(snapshot(),[{turnId,answer:'Outra resposta',mode:'ai',notice:'Aviso de outra resposta'}]);
 assert.equal(rows[0].answer,'Continuação confirmada');assert.equal(rows[0].mode,'history');assert.equal(rows[0].notice,undefined);
 assert.equal(mergeConversationTurns(snapshot())[0].mode,'history');
 const explicit=snapshot();explicit.turns[0]={...explicit.turns[0],mode:'guided',notice:'Aviso confirmado'};
 const confirmed=mergeConversationTurns(explicit,[{turnId,answer:'Continuação confirmada',mode:'ai',notice:'Aviso local'}])[0];
 assert.equal(confirmed.mode,'guided');assert.equal(confirmed.notice,'Aviso confirmado');
});
test('protected consultation refresh recovers the same turn and preserves completed tool cards',()=>{
 const pending={id:turnId,result:{mode:'pending',explanation:'Esperando'}};
 const rich={id:turnId,result:{mode:'tool',facts:[{label:'Fonte',value:'Verificada'}],explanation:'Consulta confirmada'}};
 const draft={id:'next:question',question:'E a próxima consulta?'};
 const recovered=mergeConsultationRows(snapshot(),[{id:turnId+':question',question:'E esse plano?'},pending,draft]);
 assert.equal(recovered.filter(r=>r.id===turnId).length,1);
 assert.equal(recovered.find(r=>r.id===turnId).result.explanation,'Continuação confirmada');
 assert.equal(recovered.find(r=>r.id===turnId).result.mode,'history');
 assert.equal(recovered.at(-1),draft);
 assert.equal(mergeConsultationRows(snapshot(),[rich]).find(r=>r.id===turnId),rich);
 assert.equal(mergeConsultationRows({...snapshot(),turns:[{...snapshot().turns[0],answer:'',status:'pending'}]},[rich]).find(r=>r.id===turnId),rich);
});
test('response labels identify actual AI, guided, tool and restored results without inferring from memory',()=>{
 assert.equal(assistantResponsePresentation('ai').label,'Resposta com IA');
 assert.equal(assistantResponsePresentation('guided').label,'Resposta guiada');
 assert.equal(assistantResponsePresentation('tool').label,'Consulta ao serviço');
 for(const mode of ['history','replayed']){
  const view=assistantResponsePresentation(mode);
  assert.equal(view.label,'Histórico da conversa');assert.match(view.notice,/recuperada/);
  assert.doesNotMatch(view.notice,/gerada|guiada/);
 }
 assert.equal(assistantResponsePresentation(undefined).label,'Resposta do atendimento');
 const notice='Resposta gerada com contexto e referências. Confira as condições oficiais; nenhuma ação foi executada.';
 assert.equal(assistantResponsePresentation('ai',notice).notice,notice);
});
test('guided response notices retain a readable reason without internal activation or provider jargon',()=>{
 const cases=[
  ['Material revisado disponível. A geração de respostas depende de configuração e orçamento autorizados.','não está disponível agora'],
  ['O orçamento autorizado de IA não foi confirmado. A orientação do material revisado continua disponível.','não está disponível agora'],
  ['Modo guiado: a IA externa ainda não está conectada a este ambiente.','não está disponível agora'],
  ['O contexto atingiu o limite desta resposta. O material revisado continua disponível.','Não consegui confirmar'],
  ['O modelo, o serviço ou o formato da resposta não foi confirmado. Exibindo o material revisado.','Não consegui confirmar'],
  ['A IA não respondeu. O contexto e o material revisado continuam disponível.','A IA não pôde responder'],
  ['Modo guiado: resposta do material revisado. Envio à IA externa não autorizado.','Você não autorizou']
 ];
 for(const [notice,expected] of cases){
  const view=assistantResponsePresentation('guided',notice);
  assert.equal(view.label,'Resposta guiada');assert.ok(view.notice.includes(expected),notice);
  assert.doesNotMatch(view.notice,/orçamento|configuração|modelo|formato|contexto/);
 }
 const safety='Não envie dados pessoais ou credenciais. Use os formulários oficiais para tratar sua conta.';
 assert.equal(assistantResponsePresentation('guided',safety).notice,safety);
 const limit='Orientação do material revisado. Nenhuma ação foi executada.';
 assert.equal(assistantResponsePresentation('guided',limit).notice,limit);
});
test('unavailable memory copy stays independent from guided response state in both channels',()=>{
 for(const file of ['ConversationControls.js','useAssistantConversation.js']){
  const source=readFileSync(new URL('../app/components/assistant/'+file,import.meta.url),'utf8');
  assert.match(source,/memória de conversas ainda não está disponível/);
  assert.doesNotMatch(source,/modo guiado|Atendimento guiado/);
 }
 const free=readFileSync(new URL('../app/components/assistant/FreeAssistantRoom.js',import.meta.url),'utf8');
 assert.match(free,/notice:body\.notice/);assert.doesNotMatch(free,/modo guiado/);
 assert.match(free,/assistantResponsePresentation\(row\.mode,row\.notice\)/);
 const tools=readFileSync(new URL('../app/components/assistant/AssistantRoom.js',import.meta.url),'utf8');
 assert.match(tools,/assistantResponsePresentation\(r\.replayed\?'history':r\.mode,r\.notice\)/);
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

