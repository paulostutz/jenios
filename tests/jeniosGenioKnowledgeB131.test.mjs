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
 assert.ok(!HELP_ARTICLES.some(a=>/garantia de lucro|promessa de lucro/i.test(a.text)));
});
