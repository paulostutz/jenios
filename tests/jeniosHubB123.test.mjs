import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {trendAlertBatches,ALERT_MODULES} from '../lib/trend-alerts.mjs';
const src=p=>readFileSync(p,'utf8');
test('B123 removes search-popularity trend module from the Social Hub',()=>{
 const hub=src('app/components/TrendsHub.js');
 assert.match(hub,/const MODULES = ACTIVE_TREND_MODULES/);
 assert.match(hub,/useState\('megapulse'\)/);
 assert.doesNotMatch(hub,/Acompanhe tendências de busca|Ativos em alta nas pesquisas/);
 assert.match(hub,/NewTokenRadar/);
});
test('B123 search-popularity alerts cannot be opted into or dispatched',()=>{
 assert.equal(Object.hasOwn(ALERT_MODULES,'tokens'),false);
 const batches=trendAlertBatches({tokens:[{id:'btc'}],modulos:{tokens:{disponivel:true}}},null);
 assert.deepEqual(batches,[]);
 assert.match(src('app/api/social/trend-alerts/route.js'),/Object\.hasOwn\(ALERT_MODULES,body\.module\)/);
});
test('B123 every remaining opt-in has accessible ? explanation and real notification channel',()=>{
 const code=src('app/components/TrendAlertButton.js');
 for(const id of ['megapulse','baleias','novos'])assert.match(code,new RegExp(id+":\\['"));
 assert.match(code,/helpDialog\.current\?\.showModal/);
 assert.match(code,/aria-label=\{'Como funcionam os alertas de '/);
 assert.match(code,/Central de Notificações/);
 assert.match(code,/form method="dialog"/);
});

test('B127 Hub service does not request or return CoinGecko search-popularity data',async()=>{
 const {loadTrends}=await import('../lib/trends-service.mjs');
 let mega=0,whales=0;
 const result=await loadTrends(null,{mega:async()=>{mega++;return {rows:[],status:{disponivel:false}};},
  whales:async()=>{whales++;return {rows:[],status:{disponivel:false}};},
  now:()=> '2026-10-19T23:59:00Z'});
 assert.equal(mega,1);assert.equal(whales,1);
 assert.deepEqual(result.tokens,[]);assert.equal(result.modulos.tokens.disponivel,false);
 assert.doesNotMatch(src('lib/trends-service.mjs'),/getCachedJeniosTrends|getJeniosTrends/);
});
