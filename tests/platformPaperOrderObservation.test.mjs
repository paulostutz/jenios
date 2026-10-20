import test from 'node:test';import assert from 'node:assert/strict';
import {observeAlpacaPaperOrder,unknownPaperOrder} from '../lib/platform/connections/paper-order-observation.mjs';
const o={expectedClientOrderId:'test-123',expectedSymbol:'AAPL',environment:'paper',accountMatched:true,observedAtMs:1000,observation:{id:'ord-11',client_order_id:'test-123',symbol:'AAPL',qty:'10',filled_qty:'0',status:'new'}};
const run=(patch={})=>observeAlpacaPaperOrder({...o,...patch});
test('B173 new order yields ACK but never reports a fill',()=>{const x=run();assert.equal(x.event.kind,'ACK');assert.equal(x.ordersSubmitted,0);assert.equal(x.riskReleased,false);assert.equal(x.noAutomaticResubmission,true);assert.deepEqual(x.event,run().event);});
test('B173 partial fill stays partial and risks are not released',()=>{const x=run({observation:{...o.observation,status:'partially_filled',filled_qty:'2'}});assert.equal(x.event.kind,'PARTIAL');assert.equal(x.event.cumulativeQuantity,'2');assert.equal(x.riskReleased,false);});
test('B173 canceled partially filled order requires review, not full risk release',()=>{const x=run({observation:{...o.observation,status:'canceled',filled_qty:'2'}});assert.equal(x.event.kind,'CANCELLED');assert.equal(x.manualReconciliationRequired,true);assert.equal(x.riskReleased,false);});
test('B173 explicit fill requires cumulative=total',()=>{const x=run({observation:{...o.observation,status:'filled',filled_qty:'10'}});assert.equal(x.event.kind,'FILLED');assert.equal(x.riskReleased,false);});
for(const bad of [
 {environment:'live'}, {accountMatched:false},
 {observation:{...o.observation,client_order_id:'other'}},
 {observation:{...o.observation,symbol:'MSFT'}},
 {observation:{...o.observation,status:'filled',filled_qty:'1'}},
 {observation:{...o.observation,status:'partially_filled',filled_qty:'0'}},
 {observation:{...o.observation,filled_qty:'11'}},
 {observation:{...o.observation,status:'surprise'}}
])test('B173 rejects uncertain mismatched status '+JSON.stringify(bad),()=>assert.throws(()=>run(bad)));
test('B173 pending cancellation maps UNKNOWN, never resend',()=>{const x=run({observation:{...o.observation,status:'pending_cancel'}});assert.equal(x.event.kind,'UNKNOWN');assert.equal(x.manualReconciliationRequired,true);});
for(const reason of ['timeout','transport_error','missing_from_open_orders','restart_without_receipt'])test('B173 '+reason+' blocks automatic resend',()=>{const x=unknownPaperOrder({clientOrderId:'test-123',reason,atMs:1000,knownCumulativeQuantity:'2'});assert.equal(x.kind,'UNKNOWN');assert.equal(x.cumulativeQuantity,'2');assert.equal(x.resubmitBlocked,true);});
test('B173 missing previous fill cannot manufacture zero for a restarted order',()=>assert.throws(()=>unknownPaperOrder({clientOrderId:'test-123',reason:'timeout',atMs:1000}),/DECIMAL_STRING_REQUIRED/));
