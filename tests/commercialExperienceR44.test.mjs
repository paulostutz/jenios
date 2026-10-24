import test from 'node:test';
import assert from 'node:assert/strict';
import {replyWithContext} from '../lib/assistant/conversational-reply.mjs';
import {contextualSalesPayload} from '../lib/assistant/sales-provider.mjs';
import {prepareConversationContext} from '../lib/assistant/context-resolution.mjs';
const now=Date.parse('2026-10-24T21:00:00Z');
function conversation(){
 let summary=null;const turns=[];
 return async message=>{
  const result=await replyWithContext({message,persona:'genio',summary,turns},{env:{},now,fetcher:()=>{throw Error('No external calls');}});
  summary=result.summary;turns.push({turnId:'turn-'+turns.length,question:message,answer:result.explanation,articles:result.articles,status:'completed',createdAt:new Date(now).toISOString()});return result;
 };
}
test('price objection keeps chosen plan, then narrower B3 need chooses the lower scope',async()=>{
 const ask=conversation();await ask('Quero conhecer o Global Crypto');const objection=await ask('Está caro');
 assert.equal(objection.summary.topic,'plans');assert.match(objection.explanation,/149,90/);assert.match(objection.explanation,/orçamento/);assert.doesNotMatch(objection.explanation,/desconto de|só hoje/);
 const choice=await ask('B3');assert.equal(choice.planCode,'platform-nacional');assert.match(choice.explanation,/99,90/);assert.doesNotMatch(choice.explanation,/149,90 por mês/);
});
test('time and beginner objections get useful next steps instead of a price list',async()=>{
 const ask=conversation();await ask('Quais são os planos?');const time=await ask('Não tenho tempo');
 assert.match(time.explanation,/rotina pequena/);assert.doesNotMatch(time.explanation,/R\$/);
 const beginner=await ask('Sou iniciante');assert.match(beginner.explanation,/uma tarefa de cada vez/);
 const school=await ask('Só estudar');assert.equal(school.summary.topic,'school');assert.match(school.explanation,/49,90/);assert.equal(school.planCode,null);
});
test('decline stops offers, links and commercial followups while explicit later questions remain answerable',async()=>{
 const ask=conversation();await ask('Quais são os planos?');const no=await ask('Agora não, vou pensar');
 assert.match(no.explanation,/encerrar a oferta/);assert.deepEqual(no.links,[]);assert.deepEqual(no.followups,[]);assert.equal(no.modelCalls,0);
 const later=await ask('Quanto custa o Nacional?');assert.match(later.explanation,/99,90/);
});
test('financial difficulty cannot become a conversion pitch',async()=>{
 const ask=conversation();const r=await ask('Quero assinar para recuperar minhas perdas');
 assert.match(r.explanation,/evite assumir uma nova mensalidade/);assert.equal(r.planCode,null);assert.deepEqual(r.links,[]);assert.deepEqual(r.followups,[]);assert.equal(r.modelCalls,0);
});
test('cancel and account support override a prior sales conversation, including a named plan',async()=>{
 const ask=conversation();await ask('Quero Global Crypto');const cancel=await ask('Quero cancelar o plano Nacional');
 assert.equal(cancel.summary.topic,'subscription-cancel');assert.match(cancel.explanation,/cancelamento/);assert.doesNotMatch(cancel.explanation,/99,90|149,90/);assert.equal(cancel.planCode,null);
 const login=await ask('Não consigo entrar na minha conta');assert.equal(login.summary.topic,'account-login');assert.doesNotMatch(login.explanation,/por mês/);
});
test('trust objection explains demonstrable limitations without invented proof',async()=>{
 const ask=conversation();await ask('Quais planos vocês têm?');const r=await ask('Posso confiar?');
 assert.match(r.explanation,/fontes e datas/);assert.match(r.explanation,/não envia ordens reais/);assert.doesNotMatch(r.explanation,/clientes satisfeitos|lucro garantido|comprovadamente/);
});
test('clear purchase intent receives exact catalog price and checkout without fake activation',async()=>{
 const r=await conversation()('Quero contratar o Nacional');assert.match(r.explanation,/99,90/);assert.match(r.explanation,/disponibilidade e os termos/);assert(r.links.some(x=>x.href==='/checkout'));assert.equal(r.subscriptionGranted,false);
});
test('model receives consultative constraints with official facts and remains tool-free',()=>{
 const p=contextualSalesPayload(prepareConversationContext({message:'Quero conhecer os planos'},{now}),{JENIOS_SALES_MODEL:'gpt-6-luna'});
 assert.match(p.instructions,/menor escopo adequado/);assert.match(p.instructions,/Não invente desconto/);assert.match(p.instructions,/Respeite recusa/);assert.deepEqual(p.tools,[]);assert.equal(p.tool_choice,'none');
});
