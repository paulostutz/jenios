import test from 'node:test';
import assert from 'node:assert/strict';
import {observeSimulatedBehavior} from '../lib/platform/behavioral-observation.mjs';
const event=(time,asset='WIN1!')=>({source:'client_simulation',executed:false,timestamp:time,ativo:asset,direcao:'COMPRA'});
test('B78 no simulated intention becomes a verified trade or avoided loss',()=>{
 const r=observeSimulatedBehavior({events:[event(100000),event(110000),event(120000),event(130000)]});
 assert.equal(r.intentions,4);assert.equal(r.executedTrades,0);
 assert.equal(r.verifiedProfit,null);assert.equal(r.avoidedLoss,null);
 assert.equal(r.performanceInference,false);assert(r.rapidSequences>=3);
});
test('B78 rejects forged executed events and bogus timestamps',()=>{
 const r=observeSimulatedBehavior({events:[{...event(100000),executed:true},event(-1),event(110000)]});
 assert.equal(r.intentions,1);
});
test('B78 account diagnostic is used only if server confirmed, never as execution permission',()=>{
 const uncertain=observeSimulatedBehavior({initialDiagnostic:{verified:false,mode:'reversa'},selectedMode:'manual'});
 assert.equal(uncertain.initialMode,null);
 const confirmed=observeSimulatedBehavior({initialDiagnostic:{verified:true,mode:'reversa'},selectedMode:'manual'});
 assert(confirmed.notes.some(x=>x.includes('difere')));
 assert.equal(confirmed.performanceInference,false);
});
test('B78 antifuria pause always produces an educational safety message',()=>{
 const r=observeSimulatedBehavior({paused:true,selectedMode:'hibrida'});
 assert.equal(r.paused,true);
 assert(r.notes.some(x=>x.includes('Pausa ativa')));
});
test('B78 does not assume candle prices, broker fills or P&L',()=>{
 const r=observeSimulatedBehavior({events:[event(100000)],selectedMode:'INVALID'});
 assert.equal(r.mode,'manual');assert.equal(r.executedTrades,0);assert.equal(r.verifiedProfit,null);
});
