import test from 'node:test';import assert from 'node:assert/strict';
import {normalizeLiveQuotes,createMegaPulse,currentMarketRow} from '../lib/megapulse.mjs';
const now=Date.parse('2026-10-15T16:00:00Z');
const quote=(symbol='PETR4',at=now-30000)=>({requestedSymbol:symbol,symbol,changed:false,data:{shortName:symbol,currency:'BRL',regularMarketPrice:57.36,regularMarketChangePercent:-1.29,regularMarketVolume:10000,regularMarketTime:new Date(at).toISOString()}});
test('only fresh matched quotes enter MegaPulse, never daily settlements or future timestamps',()=>{
 const old=quote('VALE3',now-120001),future=quote('ITUB4',now+1),bad=quote('MGLU3');bad.data.regularMarketPrice=null;
 assert.equal(normalizeLiveQuotes({results:[quote(),old,future,bad]},undefined,now).length,1);
 assert.throws(()=>normalizeLiveQuotes({contracts:[{date:now/1000,close:100}]}));
 assert.equal(normalizeLiveQuotes({results:[{...quote(),symbol:'FAKE4'}]},undefined,now).length,0);
 assert.equal(currentMarketRow({preco:1,variacao:0,negociadoEm:new Date(now).toISOString()},now),false);
});
test('shared cache expires rows by trade time and provider failure never returns stale movements',async()=>{
 let clock=now,calls=0,offline=false;
 const load=createMegaPulse({now:()=>clock,env:{BRAPI_TOKEN:'fixture'},fetchImpl:async()=>{calls++;if(offline)throw Error('offline');return {ok:true,json:async()=>({results:[quote()]})}}});
 const [a,b]=await Promise.all([load(),load()]);assert.equal(calls,1);assert.equal(a.rows.length,1);assert.deepEqual(a,b);
 clock=now+121000;offline=true;const stale=await load();assert.equal(stale.rows.length,0);assert.equal(stale.status.disponivel,false);
});
test('without a token requests only the individually supported public tickers',async()=>{
 const urls=[];const load=createMegaPulse({now:()=>now,env:{},fetchImpl:async url=>{urls.push(url);return {ok:true,json:async()=>({results:[quote(new URL(url).searchParams.get('symbols'))]})}}});
 assert.equal((await load()).rows.length,4);assert.equal(urls.length,4);assert(urls.every(url=>!url.includes(',')));
});
