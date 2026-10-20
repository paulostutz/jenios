import test from 'node:test';
import assert from 'node:assert/strict';
import {simulatePaperReceipt} from '../lib/platform/connections/b185-paper-simulator.mjs';
for(const [scenario,kinds] of Object.entries({accepted:['ACK'],partial_then_filled:['ACK','PARTIAL','FILLED'],partial_then_cancelled:['ACK','PARTIAL','CANCELLED'],rejected:['REJECTED'],timeout:['UNKNOWN'],filled:['FILLED']})){
 test('B185 simulates '+scenario+' without broker network or live orders',()=>{
  const r=simulatePaperReceipt({clientOrderId:'sim-test-123',quantity:'4',scenario,atMs:1792526000000});
  assert.deepEqual(r.events.map(e=>e.kind),kinds);assert.equal(r.networkCalls,0);assert.equal(r.ordersSent,0);assert.equal(r.realExecution,false);assert.equal(r.brokerAuthenticated,false);assert.equal(r.automaticRetryAllowed,false);
  if(scenario==='partial_then_cancelled')assert.equal(r.events.at(-1).cumulativeQuantity,'2');
 });
}
test('B185 refuses impossible partial quantity',()=>assert.throws(()=>simulatePaperReceipt({clientOrderId:'a',quantity:'1',scenario:'partial_then_filled',atMs:1792526000000}),/PARTIAL_REQUIRES_MULTIPLE_UNITS/));
test('B185 rejects invalid scenario',()=>assert.throws(()=>simulatePaperReceipt({clientOrderId:'a',quantity:'4',scenario:'real',atMs:1792526000000}),/INVALID_SIMULATION/));
