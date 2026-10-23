/**
 * R49 — partial-fill / cancel-replace race reconciliation.
 * Extends R48 without modifying prior certified controls.
 * Synthetic/offline only. No real or external Paper execution.
 */
const fail=c=>{throw Object.assign(new Error(c),{code:c});};

export function createR49OrderBook(){
  return {
    orders:new Map(),
    seenEventIds:new Set(),
    totalSyntheticFilledQty:0,
    duplicateEvents:0,
    lateFillEvents:0,
    reconciliationBlocks:0,
    falseAllows:0
  };
}

function ensureOrder(book,orderId){
  const o=book.orders.get(orderId);
  if(!o)fail('R49_UNKNOWN_ORDER');
  return o;
}

export function submitR49Order(book,{orderId,qty,parentOrderId=null,createdAtMs=0}={}){
  if(!book||typeof orderId!=='string'||!orderId||
     !Number.isFinite(qty)||qty<=0||
     !(parentOrderId===null||typeof parentOrderId==='string')||
     !Number.isSafeInteger(createdAtMs)||createdAtMs<0) fail('R49_INVALID_SUBMIT');
  if(book.orders.has(orderId))fail('R49_ORDER_ALREADY_EXISTS');

  if(parentOrderId!==null){
    const parent=ensureOrder(book,parentOrderId);
    if(!['CANCELLED','REPLACED','FILLED'].includes(parent.status))
      fail('R49_PARENT_NOT_TERMINAL');
  }

  const order={
    orderId,qty,filledQty:0,remainingQty:qty,status:'OPEN',
    parentOrderId,createdAtMs,cancelRequestedAtMs:null,
    terminalAtMs:null,replacedBy:null
  };
  book.orders.set(orderId,order);
  return Object.freeze({...order});
}

export function requestR49Cancel(book,{orderId,requestedAtMs}={}){
  if(!book||!Number.isSafeInteger(requestedAtMs)||requestedAtMs<0)fail('R49_INVALID_CANCEL');
  const o=ensureOrder(book,orderId);
  if(['FILLED','CANCELLED','REPLACED'].includes(o.status))
    return Object.freeze({accepted:false,reason:'R49_ALREADY_TERMINAL'});
  o.status='CANCEL_PENDING';
  o.cancelRequestedAtMs=requestedAtMs;
  return Object.freeze({accepted:true,status:o.status});
}

export function ackR49Cancel(book,{orderId,ackAtMs}={}){
  if(!book||!Number.isSafeInteger(ackAtMs)||ackAtMs<0)fail('R49_INVALID_CANCEL_ACK');
  const o=ensureOrder(book,orderId);
  if(o.status!=='CANCEL_PENDING')
    return Object.freeze({accepted:false,reason:'R49_CANCEL_NOT_PENDING'});
  o.status='CANCELLED';
  o.terminalAtMs=ackAtMs;
  return Object.freeze({accepted:true,status:o.status,remainingQty:o.remainingQty});
}

export function applyR49Fill(book,{
  eventId,orderId,fillQty,executionAtMs,receivedAtMs
}={}){
  if(!book||typeof eventId!=='string'||!eventId||
     !Number.isFinite(fillQty)||fillQty<=0||
     !Number.isSafeInteger(executionAtMs)||executionAtMs<0||
     !Number.isSafeInteger(receivedAtMs)||receivedAtMs<executionAtMs)
    fail('R49_INVALID_FILL');

  if(book.seenEventIds.has(eventId)){
    book.duplicateEvents++;
    return Object.freeze({applied:false,duplicate:true,reason:'R49_DUPLICATE_EVENT'});
  }
  book.seenEventIds.add(eventId);

  const o=ensureOrder(book,orderId);
  const wasTerminal=['CANCELLED','REPLACED','FILLED'].includes(o.status);
  const executedBeforeTerminal=o.terminalAtMs===null||executionAtMs<=o.terminalAtMs;

  if(wasTerminal&&!executedBeforeTerminal){
    book.reconciliationBlocks++;
    return Object.freeze({applied:false,reason:'R49_FILL_AFTER_TERMINAL_EXECUTION'});
  }

  const maxRemaining=Math.max(0,o.qty-o.filledQty);
  if(fillQty>maxRemaining+1e-9){
    book.reconciliationBlocks++;
    return Object.freeze({applied:false,reason:'R49_OVERFILL_RECONCILIATION_REQUIRED'});
  }

  if(wasTerminal)book.lateFillEvents++;
  o.filledQty+=fillQty;
  o.remainingQty=Math.max(0,o.qty-o.filledQty);
  book.totalSyntheticFilledQty+=fillQty;

  if(o.remainingQty===0){
    o.status='FILLED';
    o.terminalAtMs=Math.max(o.terminalAtMs??0,executionAtMs);
  }else if(o.status==='OPEN'){
    o.status='PARTIALLY_FILLED';
  }

  return Object.freeze({
    applied:true,
    late:wasTerminal,
    status:o.status,
    filledQty:o.filledQty,
    remainingQty:o.remainingQty
  });
}

export function replaceR49Order(book,{
  oldOrderId,newOrderId,newQty,createdAtMs
}={}){
  if(!book||typeof oldOrderId!=='string'||typeof newOrderId!=='string'||
     !Number.isFinite(newQty)||newQty<=0||
     !Number.isSafeInteger(createdAtMs)||createdAtMs<0)
    fail('R49_INVALID_REPLACE');

  const old=ensureOrder(book,oldOrderId);
  if(old.status!=='CANCELLED')
    return Object.freeze({created:false,reason:'R49_REPLACE_BEFORE_CANCEL_ACK'});
  if(book.orders.has(newOrderId))
    return Object.freeze({created:false,reason:'R49_REPLACEMENT_ID_EXISTS'});

  old.status='REPLACED';
  old.replacedBy=newOrderId;
  old.terminalAtMs=Math.max(old.terminalAtMs??0,createdAtMs);

  const qtyCap=Math.max(0,newQty);
  const replacement=submitR49Order(book,{
    orderId:newOrderId,qty:qtyCap,parentOrderId:oldOrderId,createdAtMs
  });
  return Object.freeze({created:true,replacement});
}

export function reconcileR49Order(book,{
  orderId,brokerFilledQty,brokerStatus
}={}){
  if(!book||typeof orderId!=='string'||
     !Number.isFinite(brokerFilledQty)||brokerFilledQty<0||
     !['OPEN','PARTIALLY_FILLED','FILLED','CANCELLED'].includes(brokerStatus))
    fail('R49_INVALID_RECONCILE');

  const o=ensureOrder(book,orderId);
  const localFilled=Number(o.filledQty.toFixed(12));
  const brokerFilled=Number(brokerFilledQty.toFixed(12));
  if(Math.abs(localFilled-brokerFilled)>1e-9){
    book.reconciliationBlocks++;
    return Object.freeze({
      match:false,
      reason:'R49_FILLED_QTY_MISMATCH',
      localFilledQty:localFilled,
      brokerFilledQty:brokerFilled
    });
  }

  const compatible=
    (brokerStatus==='FILLED'&&o.remainingQty===0) ||
    (brokerStatus==='CANCELLED'&&['CANCELLED','REPLACED'].includes(o.status)) ||
    (brokerStatus==='PARTIALLY_FILLED'&&o.filledQty>0&&o.remainingQty>0) ||
    (brokerStatus==='OPEN'&&['OPEN','PARTIALLY_FILLED','CANCEL_PENDING'].includes(o.status));

  if(!compatible){
    book.reconciliationBlocks++;
    return Object.freeze({match:false,reason:'R49_STATUS_MISMATCH',localStatus:o.status,brokerStatus});
  }
  return Object.freeze({match:true});
}

export function authorizeR49NextOrder(book){
  if(!book)fail('R49_INVALID_BOOK');
  if(book.reconciliationBlocks>0)
    return Object.freeze({allow:false,reason:'R49_RECONCILIATION_REQUIRED'});
  const live=[...book.orders.values()].filter(o=>['OPEN','PARTIALLY_FILLED','CANCEL_PENDING'].includes(o.status));
  const chains=new Map();
  for(const o of live){
    const root=o.parentOrderId||o.orderId;
    chains.set(root,(chains.get(root)||0)+1);
  }
  if([...chains.values()].some(v=>v>1)){
    book.falseAllows++;
    return Object.freeze({allow:false,reason:'R49_PARALLEL_EXPOSURE_DETECTED'});
  }
  return Object.freeze({allow:true});
}

export function runR49Battery(){
  const b=createR49OrderBook();
  submitR49Order(b,{orderId:'O1',qty:10,createdAtMs:0});
  const p=applyR49Fill(b,{eventId:'F1',orderId:'O1',fillQty:4,executionAtMs:100,receivedAtMs:110});
  requestR49Cancel(b,{orderId:'O1',requestedAtMs:120});
  const replaceEarly=replaceR49Order(b,{oldOrderId:'O1',newOrderId:'O2',newQty:6,createdAtMs:125});
  ackR49Cancel(b,{orderId:'O1',ackAtMs:150});
  const late=applyR49Fill(b,{eventId:'F2',orderId:'O1',fillQty:2,executionAtMs:140,receivedAtMs:170});
  const dup=applyR49Fill(b,{eventId:'F2',orderId:'O1',fillQty:2,executionAtMs:140,receivedAtMs:171});
  const rep=replaceR49Order(b,{oldOrderId:'O1',newOrderId:'O2',newQty:4,createdAtMs:180});
  const fillRep=applyR49Fill(b,{eventId:'F3',orderId:'O2',fillQty:4,executionAtMs:200,receivedAtMs:205});
  const rec1=reconcileR49Order(b,{orderId:'O1',brokerFilledQty:6,brokerStatus:'CANCELLED'});
  const rec2=reconcileR49Order(b,{orderId:'O2',brokerFilledQty:4,brokerStatus:'FILLED'});
  const auth=authorizeR49NextOrder(b);

  const bad=createR49OrderBook();
  submitR49Order(bad,{orderId:'X1',qty:5,createdAtMs:0});
  applyR49Fill(bad,{eventId:'XF1',orderId:'X1',fillQty:2,executionAtMs:10,receivedAtMs:12});
  const mismatch=reconcileR49Order(bad,{orderId:'X1',brokerFilledQty:3,brokerStatus:'PARTIALLY_FILLED'});
  const blocked=authorizeR49NextOrder(bad);

  return Object.freeze({
    schema:'JENIOS_R49_BATTERY_V1',
    partialFillTracked:p.applied===true&&p.remainingQty===6,
    replaceBlockedBeforeCancelAck:replaceEarly.created===false&&replaceEarly.reason==='R49_REPLACE_BEFORE_CANCEL_ACK',
    latePreCancelFillReconciled:late.applied===true&&late.late===true,
    duplicateFillIdempotent:dup.applied===false&&dup.duplicate===true,
    replacementCreatedAfterCancel:rep.created===true,
    replacementFilled:fillRep.applied===true&&fillRep.status==='FILLED',
    brokerReconciliationMatches:rec1.match===true&&rec2.match===true,
    cleanBookAllowsNextOrder:auth.allow===true,
    mismatchTriggersBlock:mismatch.match===false&&blocked.allow===false,
    pass:p.applied===true&&replaceEarly.created===false&&late.applied===true&&
      dup.duplicate===true&&rep.created===true&&fillRep.status==='FILLED'&&
      rec1.match===true&&rec2.match===true&&auth.allow===true&&
      mismatch.match===false&&blocked.allow===false,
    noExecution:true,
    actualBrokerPnl:null,actualLossesAvoided:null,realTradeAccuracy:null,
    ordersSent:0,paperOrdersSent:0
  });
}
