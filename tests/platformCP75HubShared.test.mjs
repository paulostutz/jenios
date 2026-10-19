import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dashboardHubModule} from '../lib/platform/dashboard-trends.mjs';
const now=Date.parse('2026-10-19T16:00:00Z');
test('B75 dashboard consumes same named Hub modules, not CoinGecko as MegaPulse',()=>{
 const data={tokens:[{id:'bitcoin',nome:'Bitcoin',simbolo:'BTC',rankingMercado:1}],megapulse:[],baleias:[],
  modulos:{tokens:{disponivel:true},megapulse:{disponivel:false},baleias:{disponivel:false}}};
 assert.equal(dashboardHubModule('tokens',data,now).rows[0].nome,'Bitcoin');
 assert.equal(dashboardHubModule('megapulse',data,now).rows.length,0);
 assert.throws(()=>dashboardHubModule('unknown',data,now));
});
test('B75 dashboard MegaPulse excludes outdated prices although API keeps an old cache',()=>{
 const data={megapulse:[{id:'PETR4',nome:'Petrobras',simbolo:'PETR4',preco:34,variacao:1,volume:200,negociadoEm:new Date(now-240000).toISOString()}],
 modulos:{megapulse:{disponivel:true}}};
 assert.equal(dashboardHubModule('megapulse',data,now).rows.length,0);
});
test('B75 whale history uses only last three verified rows and marks not current',()=>{
 const rows=Array.from({length:5},(_,i)=>({id:'tx'+i,nome:'BTC',simbolo:'BTC',quantidade:101+i,data:new Date(now-(i+1)*60e4).toISOString()}));
 const result=dashboardHubModule('baleias',{baleias:rows,modulos:{baleias:{disponivel:true,historico:true,mensagem:'Historico'}}},now);
 assert.equal(result.rows.length,3);assert.equal(result.historical,true);assert.equal(result.message,'Historico');
});
test('B75 provider failure cannot show cached values without valid status',()=>{
 const result=dashboardHubModule('tokens',{tokens:[{id:'x',nome:'X'}],modulos:{tokens:{disponivel:false,mensagem:'offline'}}},now);
 assert.deepEqual(result.rows,[]);assert.equal(result.message,'offline');
});
test('B75 real source reused in dashboard and classic source removed',()=>{
 const s=readFileSync('app/dashboard/page.js','utf8');
 assert.match(s,/useTrendsData\('\\/api\\/tendencias'\)/);
 assert.match(s,/dashboardHubModule\('megapulse'/);
 assert.match(s,/dashboardHubModule\('baleias'/);
 assert.doesNotMatch(s,/const baleias = \[\]/);
 assert.doesNotMatch(s,/setMegatendencias/);
 assert.doesNotMatch(s,/Fonte institucional não conectada/);
 assert.match(s,/NewTokenRadar/);
});
