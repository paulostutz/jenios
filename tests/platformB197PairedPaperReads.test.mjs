import test from 'node:test';import assert from 'node:assert/strict';
import {assessPairedPaperReads} from '../lib/platform/connections/b197-independent-order-observations.mjs';
const now=1792527000000;
const base={id:'broker-internal-1',client_order_id:'client-ord-1',symbol:'AAPL',qty:'4',filled_qty:'4',status:'filled'};
const first={receivedAtMs:now-3000,order:base},second={receivedAtMs:now-1000,order:base};
const input={clientOrderId:'client-ord-1',symbol:'AAPL',expectedQuantity:'4',first,second,nowMs:now};
const bad=(patch,code)=>assert.throws(()=>assessPairedPaperReads({...input,...patch}),e=>e.code===code);
test('B197 identical FILLED Paper observations require human reconciliation; never place or replay orders',()=>{
 const r=assessPairedPaperReads(input);
 assert.equal(r.assessment,'STABLE_TERMINAL_OBSERVATIONS');
 assert.equal(r.operatorMayInspectReceipt,true);
 assert.equal(r.orderStateCommitted,false);assert.equal(r.ordersSent,0);
 assert.equal(r.independentExternalWitnessCertified,false);
 assert.equal(r.automaticOrderRetryAllowed,false);
 assert.equal(JSON.stringify(r).includes(base.client_order_id),false);
});
test('B197 ACK, PARTIAL and uncertain statuses remain unresolved',()=>{
 for(const [status,filled_qty,expected] of [['new','0','STABLE_NONTERMINAL_OBSERVATIONS'],
  ['partially_filled','2','STABLE_NONTERMINAL_OBSERVATIONS'],
  ['pending_cancel','0','STABLE_NONTERMINAL_OBSERVATIONS']]){
  const row={...base,status,filled_qty};const result=assessPairedPaperReads({...input,
   first:{...first,order:row},second:{...second,order:row}});
  assert.equal(result.assessment,expected);
  assert.equal(result.operatorMayInspectReceipt,false);
 }
});
test('B197 changing partial fill never becomes a false stable terminal state',()=>{
 const r=assessPairedPaperReads({...input,first:{...first,order:{...base,status:'partially_filled',filled_qty:'1'}}});
 assert.equal(r.assessment,'EVOLVING_OR_AMBIGUOUS');
 assert.equal(r.independentExternalWitnessCertified,false);
});
test('B197 lost, stale, reordered and too-frequent samples are rejected',()=>{
 bad({second:{...second,receivedAtMs:first.receivedAtMs}},'INDEPENDENT_PAPER_OBSERVATION_TIMING_INVALID');
 bad({second:{...second,receivedAtMs:now+1}},'INDEPENDENT_PAPER_OBSERVATION_TIMING_INVALID');
 bad({first:{...first,receivedAtMs:now-200000},second:{...second,receivedAtMs:now-125000}},'INDEPENDENT_PAPER_OBSERVATION_TIMING_INVALID');
 bad({second:{...second,order:{...base,id:'another-id'}}},'BROKER_ORDER_ID_CHANGED');
 bad({second:{...second,order:{...base,symbol:'MSFT'}}},'BROKER_ORDER_MISMATCH');
});
test('B197 rejects quantity drift, retrograde fills and impossible rejection after an observed fill',()=>{
 bad({second:{...second,order:{...base,qty:'5'}}},'BROKER_QUANTITY_DRIFT');
 bad({first:{...first,order:base},second:{...second,order:{...base,status:'partially_filled',filled_qty:'2'}}},'BROKER_CUMULATIVE_FILL_REGRESSION');
 bad({first:{...first,order:{...base,status:'partially_filled',filled_qty:'2'}},
  second:{...second,order:{...base,status:'rejected',filled_qty:'0'}}},'BROKER_CUMULATIVE_FILL_REGRESSION');
});
