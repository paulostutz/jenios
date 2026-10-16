import test from 'node:test';
import assert from 'node:assert/strict';
import {parseNewsRSS,loadNews} from '../lib/socialNews.mjs';
const xml='<rss><channel><item><title><![CDATA[Petrobras: lucro e dividendos]]></title><link>https://example.com/news</link><pubDate>Thu, 15 Oct 2026 12:00:00 GMT</pubDate><source url="https://example.com">Veículo &amp; Economia</source></item><item><title>Inválida</title><link>javascript:alert(1)</link></item></channel></rss>';
test('RSS preserves source, categories and date and rejects non-HTTPS links',()=>{
 const result=parseNewsRSS(xml);assert.equal(result.length,1);assert.equal(result[0].fonte,'Veículo & Economia');assert.deepEqual(result[0].categorias,['Resultados corporativos']);assert.equal(result[0].publicadoEm,'2026-10-15T12:00:00.000Z');
});
test('one failing source does not discard news from the other',async()=>{
 let calls=0;const result=await loadNews({fetchImpl:async()=>{if(calls++===0)throw Error('offline');return {ok:true,text:async()=>xml};}});
 assert.equal(result.disponivel,true);assert.equal(result.noticias.length,1);
});
test('two unavailable feeds produce no invented news',async()=>{
 const result=await loadNews({fetchImpl:async()=>({ok:false})});assert.equal(result.disponivel,false);assert.deepEqual(result.noticias,[]);
});
