import test from 'node:test';
import assert from 'node:assert/strict';
import {helpFor,HELP_ARTICLES} from '../lib/assistant/knowledge.mjs';
test('B131 support uses verified, specific platform procedures rather than generic claims',()=>{
 const cases=[['Como faço para postar foto?','photo-posts'],['Como cadastrar master pelo admin?','master-users'],['Quero rever conteúdo com revisão diária','university-daily'],['Como abrir o gráfico TradingView?','trading-view'],['Onde vejo alertas de baleias?','alerts']];
 for(const [question,id] of cases){const answer=helpFor(question);assert.ok(answer.some(a=>a.id===id),question);}
 assert.ok(HELP_ARTICLES.every(a=>a.href.startsWith('/')&&a.tags.length&&a.text.length>80));
});
test('B131 unsupported market orders, private keys and WhatsApp requests are deterministic, not tool execution',()=>{
 assert.equal(helpFor('Comprar WIN agora')[0].id,'execution');
 assert.equal(helpFor('Me envie avisos por whatsapp')[0].id,'whatsapp');
 assert.ok(HELP_ARTICLES.some(a=>/não há garantia de lucro/i.test(a.text)));
});

test('B134 matching favors specific help phrases, rejects accidental substrings and preserves unknowns',()=>{
 assert.equal(helpFor('quero rever uma aula com revisão diária')[0]?.id,'university-daily');
 assert.equal(helpFor('Como fazer um cadastro de Master?')[0]?.id,'master-users');
 assert.equal(helpFor('Pode ativar o Whatsapp para mim?')[0]?.id,'whatsapp');
 assert.equal(helpFor('Comprar WIN agora')[0]?.id,'execution');
 assert.deepEqual(helpFor('ZZZ nova ferramenta não documentada XYZ'),[]);
 assert.ok(helpFor('Onde ver gráfico do TradingView').some(a=>a.id==='trading-view'));
});
test('B134 answers show grounded follow-up actions without granting tools',async()=>{
 const {answerSupport}=await import('../lib/assistant/reply.mjs');
 const response=await answerSupport('Como funciona a escola para aprender?',{persona:'genia',aiConsent:false},{env:{}});
 assert.equal(response.mode,'guided');
 assert.equal(response.name,'Gênia');
 assert.ok(response.followUps.length);
 assert.ok(response.articles.every(a=>a.href.startsWith('/')));
 const client=await import('node:fs');
 const room=client.readFileSync('app/components/assistant/AssistantRoom.js','utf8');
 assert.match(room,/aria-label="Perguntas relacionadas"/);
 assert.match(room,/onAsk={q=>send/);
});

test('B134 singular lesson words match plural questions without hallucinating nonexistent features',()=>{
 assert.equal(helpFor('Como são as aulas?')[0]?.id,'school');
 assert.equal(helpFor('Como cadastrar usuários e Masters?')[0]?.id,'master-users');
});
