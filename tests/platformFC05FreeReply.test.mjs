import test from 'node:test';
import assert from 'node:assert/strict';
import {projectFreeReply,readFreeReply,FREE_REPLY_UNAVAILABLE} from '../lib/assistant/free-reply-client.mjs';
import {replySales} from '../lib/assistant/sales-provider.mjs';
const fixture=()=>({ok:true,persona:'genio',paidAi:false,name:'Gênio',explanation:'Conheça os planos.',links:[{title:'Planos',href:'/checkout'}]});

test('FC05 actual guided sales responses for both personas satisfy the UI boundary',async()=>{
 for(const persona of ['genio','genia'])for(const question of ['Planos 149,90','Como contratar?','Universidade','Ajuda com minha conta']){
  const reply=await replySales(question,persona,{env:{},fetcher:()=>assert.fail('External request prohibited')});
  const view=await readFreeReply(Response.json(reply),persona);
  assert.equal(view.persona,persona);assert.ok(view.links.length);assert.ok(view.explanation);
 }
});
test('FC05 incomplete success cannot enter render state',()=>{
 for(const mutation of [r=>delete r.links,r=>r.links={},r=>r.links=[null],r=>r.explanation=null,r=>r.explanation={},r=>r.name={},r=>r.links[0].title=null]){
  const r=fixture();mutation(r);assert.throws(()=>projectFreeReply(r,'genio'),{message:FREE_REPLY_UNAVAILABLE});
 }
});
test('FC05 unexpected persona or paid response fails closed',()=>{
 for(const field of [{persona:'genia'},{paidAi:true},{ok:false},{name:'Outro'}])assert.throws(()=>projectFreeReply({...fixture(),...field},'genio'));
 assert.throws(()=>projectFreeReply(fixture(),'unknown'));
});
test('FC05 service errors and malformed JSON produce a recoverable user message',async()=>{
 for(const response of [new Response('<html>503</html>',{status:503}),new Response('not json'),Response.json(null)])await assert.rejects(readFreeReply(response,'genio'),{message:FREE_REPLY_UNAVAILABLE});
 assert.equal((await readFreeReply(Response.json(fixture()),'genio')).links[0].href,'/checkout');
});
test('FC05 service-supplied links cannot leave local product navigation or execute script',()=>{
 for(const href of ['javascript:alert(1)','https://example.invalid','//example.invalid','/\\example.invalid','/%2f%2fexample.invalid','/checkout\n','data:text/html,bad']){
  const r=fixture();r.links[0].href=href;assert.throws(()=>projectFreeReply(r,'genio'),href);
 }
});
test('FC05 accepted replies are projected without mutable service objects or hidden fields',()=>{
 const r=fixture();r.secret='not forwarded';const view=projectFreeReply(r,'genio');r.links[0].href='//invalid';
 assert.equal(view.links[0].href,'/checkout');assert.equal(view.secret,undefined);
});
test('FC05 previous articles contract remains compatible',()=>{
 const r=fixture();r.articles=r.links;delete r.links;assert.equal(projectFreeReply(r,'genio').links[0].href,'/checkout');
});
