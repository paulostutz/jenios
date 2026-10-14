import test from 'node:test';
import assert from 'node:assert/strict';
import {getJeniosTrends,normalizeCoinGeckoTrending} from '../lib/jeniosTrends.mjs';
const coin={item:{id:'bitcoin',name:'Bitcoin',symbol:'btc',market_cap_rank:1,score:0}};
test('normaliza somente registros identificados',()=>{assert.equal(normalizeCoinGeckoTrending({coins:[coin,{}, {item:{id:'x',name:'X'}}]}).length,1)});
test('habilita apenas tendencias de busca, nao B3 nem baleias',async()=>{const r=await getJeniosTrends({fetchImpl:async()=>({ok:true,json:async()=>({coins:[coin]})})});assert.equal(r.tokens[0].nome,'Bitcoin');assert.equal(r.modulos.tokens.disponivel,true);assert.equal(r.modulos.baleias.disponivel,false);assert.equal(r.fonte,'CoinGecko Search Trending')});
test('erro HTTP nao inventa dados',async()=>{const r=await getJeniosTrends({fetchImpl:async()=>({ok:false,status:429})});assert.equal(r.disponivel,false);assert.deepEqual(r.tokens,[])});
test('falha de rede nao inventa dados',async()=>{const r=await getJeniosTrends({fetchImpl:async()=>{throw Error('offline')}});assert.equal(r.disponivel,false)});
test('resposta malformada nao inventa dados',async()=>{const r=await getJeniosTrends({fetchImpl:async()=>({ok:true,json:async()=>({error:'bad'})})});assert.equal(r.disponivel,false)});
