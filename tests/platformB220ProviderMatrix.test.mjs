import test from 'node:test';import assert from 'node:assert/strict';
import {officialBrokerImplementationMatrix} from '../lib/platform/launch/b220-provider-implementation-matrix.mjs';
test('B220 all twelve providers covered without invented executable integrations',()=>{
 const m=officialBrokerImplementationMatrix();assert.equal(m.length,12);
 assert.deepEqual(m.filter(x=>x.testAccountReadAdapterImplemented).map(x=>x.provider).sort(),['alpaca','binance']);
 assert.ok(m.every(x=>!x.productionTradingAllowed&&!x.custody&&!x.withdrawalsAllowed));
});
test('B220 Profit and MT5 preserve required licensed local terminal status',()=>{
 const m=officialBrokerImplementationMatrix();assert.equal(m.find(x=>x.provider==='profit').requiresTerminal,true);
 assert.equal(m.find(x=>x.provider==='mt5').requiresTerminal,true);
});
