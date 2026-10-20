import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcileDemoSnapshots} from '../lib/platform/connections/demo-reconciliation.mjs';

const base={provider:'alpaca',environment:'paper',complete:true,accountReadConfirmed:true,observedAtMs:1000,
 positions:[{key:'asset-btc',symbol:'BTCUSD',side:'long',quantity:'1'}],
 openOrders:[{key:'order-1',symbol:'BTCUSD',side:'sell',status:'new',quantity:'1',filledQuantity:'0'}]};
test('B163 unchanged observations reconcile without inventing events',()=>{
 const r=reconcileDemoSnapshots(base,{...base,observedAtMs:2000});
 assert.equal(r.changeCount,0);assert.equal(r.reviewRequired,false);assert.equal(r.liveExecution,false);
 assert.equal(r.protectionVerified,false);assert.equal(r.performanceVerified,false);
});
test('B163 a missing order is explicitly unclassified, never cancellation or fill',()=>{
 const r=reconcileDemoSnapshots(base,{...base,observedAtMs:2000,openOrders:[]});
 assert.equal(r.orders.missing.length,1);assert.equal(r.orders.missing[0].state,'no_longer_open_unclassified');
 assert.equal(r.missingMeansCancelled,false);assert.equal(r.missingMeansFilled,false);assert.equal(r.reviewRequired,true);
});
test('B163 a missing position is not classified as closed',()=>{
 const r=reconcileDemoSnapshots(base,{...base,observedAtMs:2000,positions:[]});
 assert.equal(r.positions.missing[0].state,'no_longer_reported_unclassified');assert.equal(r.missingMeansClosed,false);
});
test('B163 added and changed observations are differences, not economic claims',()=>{
 const current={...base,observedAtMs:2000,
  positions:[{...base.positions[0],quantity:'1.5'},{key:'asset-eth',symbol:'ETHUSD',side:'long',quantity:'2'}],
  openOrders:[{...base.openOrders[0],filledQuantity:'0.25'}]};
 const r=reconcileDemoSnapshots(base,current);
 assert.equal(r.positions.added.length,1);assert.equal(r.positions.changed.length,1);assert.equal(r.orders.changed.length,1);
 assert.equal(r.performanceVerified,false);assert.equal(r.liveExecution,false);
});
for(const [name,current,pattern] of [
 ['scope change',{...base,provider:'binance',environment:'testnet',observedAtMs:2000},/SNAPSHOT_SCOPE_MISMATCH/],
 ['older observation',{...base,observedAtMs:999},/NON_MONOTONIC_OBSERVATION/],
 ['incomplete observation',{...base,observedAtMs:2000,complete:false},/COMPLETE_AUTHENTICATED_SNAPSHOT_REQUIRED/],
 ['duplicate position',{...base,observedAtMs:2000,positions:[base.positions[0],base.positions[0]]},/DUPLICATE_EXTERNAL_KEY/]
])test('B163 rejects '+name,()=>assert.throws(()=>reconcileDemoSnapshots(base,current),pattern));
