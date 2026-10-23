import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createR49OrderBook,
  submitR49Order,
  requestR49Cancel,
  ackR49Cancel,
  applyR49Fill,
  replaceR49Order,
  reconcileR49Order,
  authorizeR49NextOrder,
  runR49Battery
} from '../lib/platform/research/robot-r49-order-reconciliation-races.mjs';

test('R49 partial fills update remaining quantity deterministically',()=>{
  const b=createR49OrderBook();
  submitR49Order(b,{orderId:'O1',qty:10,createdAtMs:0});
  const x=applyR49Fill(b,{eventId:'F1',orderId:'O1',fillQty:3,executionAtMs:10,receivedAtMs:12});
  assert.equal(x.applied,true); assert.equal(x.status,'PARTIALLY_FILLED'); assert.equal(x.remainingQty,7);
});

test('R49 replacement is blocked until cancel acknowledgement',()=>{
  const b=createR49OrderBook();
  submitR49Order(b,{orderId:'O1',qty:10,createdAtMs:0});
  requestR49Cancel(b,{orderId:'O1',requestedAtMs:10});
  const x=replaceR49Order(b,{oldOrderId:'O1',newOrderId:'O2',newQty:10,createdAtMs:11});
  assert.equal(x.created,false); assert.equal(x.reason,'R49_REPLACE_BEFORE_CANCEL_ACK');
});

test('R49 fill executed before cancel terminal can arrive late and still reconcile',()=>{
  const b=createR49OrderBook();
  submitR49Order(b,{orderId:'O1',qty:10,createdAtMs:0});
  requestR49Cancel(b,{orderId:'O1',requestedAtMs:10});
  ackR49Cancel(b,{orderId:'O1',ackAtMs:20});
  const x=applyR49Fill(b,{eventId:'F1',orderId:'O1',fillQty:2,executionAtMs:15,receivedAtMs:30});
  assert.equal(x.applied,true); assert.equal(x.late,true); assert.equal(x.remainingQty,8);
});

test('R49 fill after terminal execution timestamp is blocked',()=>{
  const b=createR49OrderBook();
  submitR49Order(b,{orderId:'O1',qty:10,createdAtMs:0});
  requestR49Cancel(b,{orderId:'O1',requestedAtMs:10});
  ackR49Cancel(b,{orderId:'O1',ackAtMs:20});
  const x=applyR49Fill(b,{eventId:'F1',orderId:'O1',fillQty:2,executionAtMs:25,receivedAtMs:30});
  assert.equal(x.applied,false); assert.equal(x.reason,'R49_FILL_AFTER_TERMINAL_EXECUTION');
});

test('R49 duplicate fill event is idempotently ignored',()=>{
  const b=createR49OrderBook();
  submitR49Order(b,{orderId:'O1',qty:5,createdAtMs:0});
  applyR49Fill(b,{eventId:'F1',orderId:'O1',fillQty:2,executionAtMs:10,receivedAtMs:11});
  const x=applyR49Fill(b,{eventId:'F1',orderId:'O1',fillQty:2,executionAtMs:10,receivedAtMs:12});
  assert.equal(x.applied,false); assert.equal(x.duplicate,true); assert.equal(b.orders.get('O1').filledQty,2);
});

test('R49 overfill forces reconciliation block',()=>{
  const b=createR49OrderBook();
  submitR49Order(b,{orderId:'O1',qty:5,createdAtMs:0});
  const x=applyR49Fill(b,{eventId:'F1',orderId:'O1',fillQty:6,executionAtMs:10,receivedAtMs:11});
  assert.equal(x.applied,false); assert.equal(x.reason,'R49_OVERFILL_RECONCILIATION_REQUIRED');
  assert.equal(authorizeR49NextOrder(b).allow,false);
});

test('R49 broker filled-quantity mismatch blocks next order',()=>{
  const b=createR49OrderBook();
  submitR49Order(b,{orderId:'O1',qty:5,createdAtMs:0});
  applyR49Fill(b,{eventId:'F1',orderId:'O1',fillQty:2,executionAtMs:10,receivedAtMs:11});
  const r=reconcileR49Order(b,{orderId:'O1',brokerFilledQty:3,brokerStatus:'PARTIALLY_FILLED'});
  assert.equal(r.match,false);
  assert.equal(authorizeR49NextOrder(b).allow,false);
});

test('R49 integrated battery preserves zero execution',()=>{
  const x=runR49Battery();
  assert.equal(x.pass,true);
  assert.equal(x.ordersSent,0); assert.equal(x.paperOrdersSent,0);
  assert.equal(x.actualBrokerPnl,null); assert.equal(x.actualLossesAvoided,null); assert.equal(x.realTradeAccuracy,null);
});
