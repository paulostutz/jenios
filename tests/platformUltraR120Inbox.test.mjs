import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {BinanceActionJournalR119} from '../lib/platform/ultra/client/binance-action-journal-r119.mjs';
import {DurableBinanceAdapterR119} from '../lib/platform/ultra/client/binance-durable-adapter-r119.mjs';
import {BinanceProtocolSandboxR119} from '../lib/platform/ultra/client/binance-protocol-sandbox-r119.mjs';
import {BinanceEventInboxR120} from '../lib/platform/ultra/client/binance-event-inbox-r120.mjs';
import {buildSpotLimitRequest,buildSpotQueryRequest,buildSpotOcoRequest,buildSpotOrderListQueryRequest} from '../lib/platform/ultra/client/binance-spot-protocol-r119.mjs';
const now=Date.parse('2026-11-10T15:00:00Z');
const meta={symbol:'BTCUSDT',status:'TRADING',isSpotTradingAllowed:true,ocoAllowed:true,baseAsset:'BTC',quoteAsset:'USDT',orderTypes:['LIMIT','LIMIT_MAKER','STOP_LOSS_LIMIT'],filters:[{filterType:'PRICE_FILTER',minPrice:'0.01',maxPrice:'1000000',tickSize:'0.01'},{filterType:'LOT_SIZE',minQty:'0.001',maxQty:'100',stepSize:'0.001'},{filterType:'MIN_NOTIONAL',minNotional:'1'}]};
const account={accountType:'SPOT',canTrade:true,balances:[{asset:'BTC',free:'2'},{asset:'USDT',free:'1000'}]};
const eventBinding={product:'spot',environment:'demo',keyFingerprint:'a'.repeat(64),mode:'offline_fixture'};
function event(patch={}){return {e:'executionReport',E:now,s:'BTCUSDT',c:'ju_native120',S:'BUY',o:'LIMIT',f:'GTC',q:'1',p:'100',P:'0',F:'0',g:-1,C:'',x:'TRADE',X:'PARTIALLY_FILLED',r:'NONE',i:'90071992547409931',l:'0.4',z:'0.4',L:'100',n:'0.0004',N:'BTC',T:now,t:'17',I:'181',w:true,m:false,M:false,O:now-1,Z:'40',Y:'40',Q:'0',V:'NONE',...patch};}
function receipt(){return {symbol:'BTCUSDT',orderId:'90071992547409931',clientOrderId:'ju_native120',side:'BUY',status:'PARTIALLY_FILLED',origQty:'1',executedQty:'0.4',cummulativeQuoteQty:'40',updateTime:now};}
async function fixture(t,{send=true}={}){
 const dir=mkdtempSync(join(tmpdir(),'ultra-r120-inbox-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));const path=join(dir,'events.sqlite'),binding={account:'synthetic',provider:'binance',environment:'demo'},ledger=new BinanceActionJournalR119(path,binding,{product:'spot'}),clock={now};t.after(()=>{try{ledger.close();}catch{}});ledger.claim(now);ledger.resume();
 const operationId=ledger.prepare({market:'crypto',symbol:'BTCUSDT',side:'buy',quantity:'1',entryPrice:'100',currency:'USDT'},now).id,clientId='ju_native120',request=buildSpotLimitRequest({product:'spot',symbol:'BTCUSDT',side:'BUY',type:'LIMIT',quantity:'1',price:'100',clientOrderId:clientId},meta,account),lookup=buildSpotQueryRequest({product:'spot',symbol:'BTCUSDT',origClientOrderId:clientId}),expected={product:'spot',kind:'order',clientId,symbol:'BTCUSDT',side:'BUY'},transport=new BinanceProtocolSandboxR119({product:'spot',responses:[{method:'POST',path:request.path,httpStatus:200,body:receipt()}]}),adapter=new DurableBinanceAdapterR119({ledger,transport,now:()=>clock.now}),actionId=adapter.prepare({operationId,role:'entry',request,lookup,expected}).id;if(send)await adapter.dispatch(actionId);
 const inbox=new BinanceEventInboxR120({ledger,binding:eventBinding}),sessionId=inbox.startSession({now}).sessionId;return {dir,path,binding,ledger,clock,operationId,transport,adapter,actionId,inbox,sessionId};
}
function ingest(f,payload=event()){return f.inbox.ingest({sessionId:f.sessionId,payload,receivedAtMs:f.clock.now});}
async function reconcile(f){const ticket=f.inbox.beginReconciliation({sessionId:f.sessionId,now:f.clock.now});for(const q of ticket.queries)f.transport.append({method:'GET',path:q.lookup.path,httpStatus:200,body:receipt()});await f.inbox.reconcileTicket({ticketId:ticket.ticketId,adapter:f.adapter});return {ticket,result:f.inbox.finishReconciliation({ticketId:ticket.ticketId,now:f.clock.now})};}
test('owned user-stream evidence is persisted before reconciliation and never closes the financial operation',async t=>{
 const f=await fixture(t),r=ingest(f);assert.equal(r.accepted,true);assert.deepEqual(r.matchedActionIds,[f.actionId]);assert.equal(f.inbox.entries().length,1);assert.equal(f.ledger.paused(),true);assert.equal(f.ledger.operation(f.operationId).entryQuantity,'0');assert.equal(r.financialRecordPending,true);assert.equal(r.protectionConfirmed,false);assert.equal(r.canSubmit,false);
});
test('duplicate event across wrapper/restart is idempotent on disk',async t=>{
 const f=await fixture(t);assert.equal(ingest(f).duplicate,false);assert.equal(ingest(f,{subscriptionId:7,event:event()}).duplicate,true);f.ledger.close();
 const ledger=new BinanceActionJournalR119(f.path,f.binding,{product:'spot'});t.after(()=>ledger.close());ledger.claim(now+100,{recover:true});const inbox=new BinanceEventInboxR120({ledger,binding:eventBinding}),session=inbox.startSession({now:now+100,reason:'reconnect'});assert.equal(inbox.ingest({sessionId:session.sessionId,payload:event(),receivedAtMs:now+100}).duplicate,true);assert.equal(inbox.entries().length,1);assert.equal(ledger.paused(),true);
});
test('same native identity with changed content retains original evidence and blocks reconciliation',async t=>{
 const f=await fixture(t);ingest(f);const r=ingest(f,event({n:'0.0005'}));assert.equal(r.conflict,true);assert.equal(f.inbox.entries().length,1);assert.equal(f.inbox.incidents().at(-1).kind,'conflict');await assert.rejects(reconcile(f),/EVENT_CONFLICT_UNRESOLVED/);assert.equal(f.ledger.paused(),true);
});
test('late events remain evidence without regressing or incrementing financial quantities',async t=>{
 const f=await fixture(t);ingest(f,event({I:'182',t:'18',E:now+1,T:now+1,l:'0.6',z:'1',X:'FILLED',n:'0.0006',Z:'100',Y:'60'}));ingest(f);assert.equal(f.inbox.entries().length,2);assert.equal(f.ledger.operation(f.operationId).entryQuantity,'0');assert.notEqual(f.ledger.operation(f.operationId).state,'closed');
});
test('reconciliation needs a fresh durable REST query after its fence, not an earlier ACK',async t=>{
 const f=await fixture(t);ingest(f);const ticket=f.inbox.beginReconciliation({sessionId:f.sessionId,now});assert.throws(()=>f.inbox.finishReconciliation({ticketId:ticket.ticketId,now}),/NATIVE_QUERY_PENDING/);const {result}=await reconcile(f);assert.equal(result.locallySynchronized,true);assert.equal(result.tradeActivationAllowed,false);assert.equal(result.financialReconciliationRequired,true);assert.equal(f.ledger.paused(),true);
});
test('an older REST query at exactly the same millisecond cannot satisfy a new fence',async t=>{
 const f=await fixture(t);await reconcile(f);const ticket=f.inbox.beginReconciliation({sessionId:f.sessionId,now});assert.throws(()=>f.inbox.finishReconciliation({ticketId:ticket.ticketId,now}),/NATIVE_QUERY_PENDING/);
});
test('event arriving during REST catch-up invalidates the ticket instead of losing the race',async t=>{
 const f=await fixture(t),ticket=f.inbox.beginReconciliation({sessionId:f.sessionId,now});ingest(f);assert.throws(()=>f.inbox.finishReconciliation({ticketId:ticket.ticketId,now}),/TICKET_INVALID/);assert.equal(f.inbox.session().status,'reconcile_required');
});
test('reconnect invalidates old session and old pending reconciliation without resending mutations',async t=>{
 const f=await fixture(t),ticket=f.inbox.beginReconciliation({sessionId:f.sessionId,now});f.inbox.disconnect({sessionId:f.sessionId,now,reason:'listen_key_expired'});assert.throws(()=>ingest(f),/SESSION_INVALID/);const newSession=f.inbox.startSession({now:now+100,reason:'reconnect'});assert.notEqual(newSession.sessionId,f.sessionId);assert.throws(()=>f.inbox.finishReconciliation({ticketId:ticket.ticketId,now:now+100}),/TICKET_INVALID/);assert.equal(f.transport.calls.filter(c=>c.method==='POST').length,1);
});
test('unowned IDs do not become the robot order merely by matching symbol or quantity',async t=>{
 const f=await fixture(t),r=ingest(f,event({c:'manual',I:'999'}));assert.deepEqual(r.matchedActionIds,[]);await assert.rejects(reconcile(f),/UNOWNED_OR_INVALID_EVENT_UNRESOLVED/);assert.equal(f.ledger.operations().length,1);
});
test('unknown or malformed payloads cannot silently open a reconciliation barrier',async t=>{
 const f=await fixture(t);const result=ingest(f,{e:'something_new',E:now,secret:'never-store-this'});assert.equal(result.needsReconciliation,true);assert.doesNotMatch(JSON.stringify(f.inbox.entries())+JSON.stringify(f.inbox.incidents()),/never-store-this/);await assert.rejects(reconcile(f),/UNOWNED_OR_INVALID_EVENT_UNRESOLVED/);
});
test('unsafe native numeric IDs and future events are quarantined without leaking raw payload',async t=>{
 const f=await fixture(t);for(const payload of [event({i:90071992547409932}),event({E:now+5000})])assert.equal(ingest(f,payload).accepted,false);assert.equal(f.inbox.entries().length,0);assert.equal(f.inbox.incidents().filter(i=>i.kind==='invalid_event').length,2);
});
test('product/account/credential fingerprint binding cannot be replaced for the same disk journal',async t=>{
 const f=await fixture(t);assert.throws(()=>new BinanceEventInboxR120({ledger:f.ledger,binding:{...eventBinding,product:'usds_m_futures'}}),/OFFLINE_BINDING/);assert.throws(()=>new BinanceEventInboxR120({ledger:f.ledger,binding:{...eventBinding,keyFingerprint:'b'.repeat(64)}}),/SCOPE_MISMATCH/);assert.throws(()=>new BinanceEventInboxR120({ledger:f.ledger,binding:{...eventBinding,secret:'bad'}}),/OFFLINE_BINDING/);
});
test('clock regression, stale ticket and lost local lease fail closed',async t=>{
 const f=await fixture(t),ticket=f.inbox.beginReconciliation({sessionId:f.sessionId,now});assert.throws(()=>f.inbox.ingest({sessionId:f.sessionId,payload:event(),receivedAtMs:now-1}),/SESSION_INVALID/);assert.throws(()=>f.inbox.finishReconciliation({ticketId:ticket.ticketId,now:now+5001}),/FENCE_CHANGED/);f.ledger.db.prepare('UPDATE runner SET owner=?').run('other');assert.throws(()=>ingest(f),/LEASE_LOST/);
});
test('event inbox contains no stream, network, credential or financial-ledger mutation integration',()=>{
 const source=readFileSync('lib/platform/ultra/client/binance-event-inbox-r120.mjs','utf8');assert.doesNotMatch(source,/\bfetch\s*\(|\bWebSocket\s*\(|process\.env|createHmac|\.saveOperation\s*\(|\.applyReceipt\s*\(|\.resume\s*\(/);
});

test('client identity cannot override a contradictory native order ID or side',async t=>{
 for(const patch of [{i:'99999'},{S:'SELL'}]){const f=await fixture(t);const result=ingest(f,event(patch));assert.equal(result.conflict,true);assert.equal(result.accepted,false);assert.equal(f.inbox.entries().length,0);assert.equal(f.ledger.paused(),true);}
});
test('event claiming an unsent prepared action requires explicit reconciliation of contradictory evidence',async t=>{
 const f=await fixture(t,{send:false}),result=ingest(f);assert.equal(result.conflict,true);assert.equal(f.transport.calls.length,0);await assert.rejects(reconcile(f),/EVENT_CONFLICT_UNRESOLVED/);
});

test('a query begun before the event/fence cannot qualify merely because its response arrives afterward',async t=>{
 const f=await fixture(t);f.transport.append({method:'GET',path:'/api/v3/order',httpStatus:200,body:receipt(),delayMs:25});const oldQuery=f.adapter.reconcile(f.actionId);f.clock.now+=1;ingest(f);const ticket=f.inbox.beginReconciliation({sessionId:f.sessionId,now:f.clock.now});await oldQuery;assert.throws(()=>f.inbox.finishReconciliation({ticketId:ticket.ticketId,now:f.clock.now}),/NATIVE_QUERY_PENDING/);assert.equal(f.ledger.paused(),true);
});
test('events arriving during ticket-owned query prevent completion and do not retry',async t=>{
 const f=await fixture(t),ticket=f.inbox.beginReconciliation({sessionId:f.sessionId,now});f.transport.append({method:'GET',path:'/api/v3/order',httpStatus:200,body:receipt(),delayMs:25});const query=f.inbox.reconcileTicket({ticketId:ticket.ticketId,adapter:f.adapter});ingest(f);await assert.rejects(query,/TICKET_INVALID/);assert.equal(f.transport.calls.filter(c=>c.method==='GET').length,1);
});

test('duplicate receipt still advances the receive clock and rejects later clock regression',async t=>{
 const f=await fixture(t);ingest(f);f.clock.now+=100;assert.equal(ingest(f).duplicate,true);f.clock.now-=50;assert.throws(()=>ingest(f,event({I:'182',t:'18'})),/SESSION_INVALID/);
});
test('ticket-owned query cannot replace the native ID already bound by receipt and event',async t=>{
 const f=await fixture(t);ingest(f);const ticket=f.inbox.beginReconciliation({sessionId:f.sessionId,now});f.transport.append({method:'GET',path:'/api/v3/order',httpStatus:200,body:{...receipt(),orderId:'99999'}});await assert.rejects(f.inbox.reconcileTicket({ticketId:ticket.ticketId,adapter:f.adapter}),/NATIVE_IDENTITY_CONFLICT/);assert.throws(()=>f.inbox.finishReconciliation({ticketId:ticket.ticketId,now}),/NATIVE_QUERY_PENDING/);
});

async function listFixture(t){
 const f=await fixture(t),old=f.ledger.operation(f.operationId);f.ledger.applyReceipt({receiptId:'owned_exposure_fixture',accountBinding:f.ledger.binding,clientOrderId:f.operationId,commandId:null,observedAtMs:now,orderState:'working',positionReconciled:true,protectionConfirmed:true,entryRemainderCancelled:false,operation:{...old,state:'open',entryQuantity:'1',entryPrice:'100',openedAt:old.createdAt}},{now});
 const request=buildSpotOcoRequest({product:'spot',symbol:'BTCUSDT',side:'SELL',quantity:'1',takeProfitPrice:'110',stopPrice:'90',stopLimitPrice:'89',lastPrice:'100',listClientOrderId:'list_120',aboveClientOrderId:'tp_120',belowClientOrderId:'sl_120'},meta,account),lookup=buildSpotOrderListQueryRequest({product:'spot',origClientOrderId:'list_120'}),expected={product:'spot',kind:'list',clientId:'list_120',symbol:'BTCUSDT',side:'SELL',childClientIds:['tp_120','sl_120']};
 const listReceipt={orderListId:'30',listClientOrderId:'list_120',symbol:'BTCUSDT',contingencyType:'OCO',listStatusType:'EXEC_STARTED',listOrderStatus:'EXECUTING',transactionTime:now,orders:[{symbol:'BTCUSDT',orderId:'31',clientOrderId:'tp_120'},{symbol:'BTCUSDT',orderId:'32',clientOrderId:'sl_120'}]},listActionId=f.adapter.prepare({operationId:f.operationId,role:'protection_list',request,lookup,expected}).id;
 f.transport.append({method:'POST',path:request.path,httpStatus:200,body:listReceipt});await f.adapter.dispatch(listActionId);return {...f,listActionId,listReceipt};
}
test('Spot child events bind only to the durable list and matching native child identities',async t=>{
 const f=await listFixture(t),r=ingest(f,event({c:'tp_120',i:'31',g:'30',S:'SELL',I:'282'}));assert.deepEqual(r.matchedActionIds,[f.listActionId]);const ticket=f.inbox.beginReconciliation({sessionId:f.sessionId,now});for(const q of ticket.queries)f.transport.append({method:'GET',path:q.lookup.path,httpStatus:200,body:q.lookup.path==='/api/v3/orderList'?f.listReceipt:receipt()});await f.inbox.reconcileTicket({ticketId:ticket.ticketId,adapter:f.adapter});assert.equal(f.inbox.finishReconciliation({ticketId:ticket.ticketId,now}).locallySynchronized,true);assert.equal(f.ledger.operation(f.operationId).exitQuantity,'0');
});
test('Spot child labels cannot substitute a different native list, child ID or direction',async t=>{
 for(const patch of [{g:'99'},{i:'99'},{S:'BUY'}]){const f=await listFixture(t),r=ingest(f,event({c:'tp_120',i:'31',g:'30',S:'SELL',I:'282',...patch}));assert.equal(r.conflict,true);assert.equal(r.accepted,false);}
});
async function futuresAlgoFixture(t,{actualOrderId='991'}={}){
 const dir=mkdtempSync(join(tmpdir(),'ultra-r120-algo-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));const ledger=new BinanceActionJournalR119(join(dir,'state.sqlite'),{account:'synthetic',provider:'binance',environment:'demo'},{product:'usds_m_futures'});t.after(()=>ledger.close());ledger.claim(now);ledger.resume();const operationId=ledger.prepare({market:'crypto',symbol:'BTCUSDT',side:'buy',quantity:'1',entryPrice:'100',currency:'USDT'},now).id;ledger.transition(operationId,'prepared','sending',null,now);const old=ledger.operation(operationId);ledger.applyReceipt({receiptId:'future_owned_fixture',accountBinding:ledger.binding,clientOrderId:operationId,commandId:null,observedAtMs:now,orderState:'working',positionReconciled:true,protectionConfirmed:true,entryRemainderCancelled:false,operation:{...old,state:'open',entryQuantity:'1',entryPrice:'100',openedAt:old.createdAt}},{now});
 const binding={product:'usds_m_futures',environment:'demo',keyFingerprint:'a'.repeat(64)},request={product:binding.product,binding,method:'POST',path:'/fapi/v1/algoOrder',params:{symbol:'BTCUSDT',side:'SELL',type:'STOP_MARKET',quantity:'1',triggerPrice:'90',clientAlgoId:'js_120',reduceOnly:'true',timestamp:now},signed:false,canSubmit:false},lookup={...request,method:'GET',params:{clientAlgoId:'js_120',timestamp:now}},expected={product:binding.product,kind:'algo',clientId:'js_120',symbol:'BTCUSDT',side:'SELL',binding};
 const body={algoId:'90',clientAlgoId:'js_120',symbol:'BTCUSDT',side:'SELL',positionSide:'BOTH',algoStatus:'TRIGGERED',quantity:'1',...(actualOrderId?{actualOrderId}:{})},transport=new BinanceProtocolSandboxR119({product:binding.product,responses:[{method:'POST',path:request.path,httpStatus:200,body}]}),adapter=new DurableBinanceAdapterR119({ledger,transport,now:()=>now}),actionId=adapter.prepare({operationId,role:'stop',request,lookup,expected}).id;await adapter.dispatch(actionId);const inbox=new BinanceEventInboxR120({ledger,binding:{...binding,mode:'offline_fixture'}}),sessionId=inbox.startSession({now}).sessionId;return {ledger,inbox,sessionId,actionId,adapter,transport,body,operationId};
}
const futuresTriggeredEvent=patch=>({e:'ORDER_TRADE_UPDATE',E:now,T:now,o:{s:'BTCUSDT',c:'exchange_triggered_order',S:'SELL',o:'MARKET',f:'GTC',q:'1',p:'0',ap:'90',x:'TRADE',X:'PARTIALLY_FILLED',i:'991',l:'0.4',z:'0.4',L:'90',N:'USDT',n:'0.02',T:now,t:'891',m:false,R:true,ps:'BOTH',cp:false,rp:'-4',...patch}});
test('Futures triggered order associates only through a previously observed exact actualOrderId',async t=>{
 const f=await futuresAlgoFixture(t),r=f.inbox.ingest({sessionId:f.sessionId,payload:futuresTriggeredEvent(),receivedAtMs:now});assert.deepEqual(r.matchedActionIds,[f.actionId]);const ticket=f.inbox.beginReconciliation({sessionId:f.sessionId,now});f.transport.append({method:'GET',path:'/fapi/v1/algoOrder',httpStatus:200,body:f.body});await f.inbox.reconcileTicket({ticketId:ticket.ticketId,adapter:f.adapter});assert.equal(f.inbox.finishReconciliation({ticketId:ticket.ticketId,now}).locallySynchronized,true);assert.equal(f.ledger.operation(f.operationId).exitQuantity,'0');
});
test('Futures child order cannot borrow ownership by symbol, changed actualOrderId or direction',async t=>{
 for(const patch of [{i:'992'},{S:'BUY'}]){const f=await futuresAlgoFixture(t),r=f.inbox.ingest({sessionId:f.sessionId,payload:futuresTriggeredEvent(patch),receivedAtMs:now});assert.equal(r.matchedActionIds?.length??0,0);assert.equal(r.needsReconciliation,true);if(patch.S)assert.equal(r.conflict,true);}
});

const algoLinkEvent=actualOrderId=>({e:'ALGO_UPDATE',E:now,T:now,o:{caid:'js_120',aid:'90',at:'CONDITIONAL',o:'STOP_MARKET',s:'BTCUSDT',S:'SELL',ps:'BOTH',f:'GTC',q:'1',X:'TRIGGERED',ai:actualOrderId,tp:'90',p:'0',wt:'MARK_PRICE',cp:false,pP:false,R:true,tt:now,gtd:0}});
test('ALGO event cannot substitute a triggered order already linked in durable REST evidence',async t=>{
 const f=await futuresAlgoFixture(t),r=f.inbox.ingest({sessionId:f.sessionId,payload:algoLinkEvent('992'),receivedAtMs:now});assert.equal(r.conflict,true);assert.equal(r.accepted,false);
});
test('new actualOrderId from ALGO event must be confirmed by the ticket-owned REST query',async t=>{
 const f=await futuresAlgoFixture(t,{actualOrderId:null}),r=f.inbox.ingest({sessionId:f.sessionId,payload:algoLinkEvent('992'),receivedAtMs:now});assert.equal(r.accepted,true);const ticket=f.inbox.beginReconciliation({sessionId:f.sessionId,now});f.transport.append({method:'GET',path:'/fapi/v1/algoOrder',httpStatus:200,body:f.body});await assert.rejects(f.inbox.reconcileTicket({ticketId:ticket.ticketId,adapter:f.adapter}),/NATIVE_IDENTITY_CONFLICT/);
});

test('direct Futures ALGO events and REST queries must remain in the configured one-way mode',async t=>{
 const f=await futuresAlgoFixture(t),payload=algoLinkEvent('991');payload.o.ps='LONG';assert.equal(f.inbox.ingest({sessionId:f.sessionId,payload,receivedAtMs:now}).conflict,true);
 const clean=await futuresAlgoFixture(t),ticket=clean.inbox.beginReconciliation({sessionId:clean.sessionId,now});clean.transport.append({method:'GET',path:'/fapi/v1/algoOrder',httpStatus:200,body:{...clean.body,positionSide:'SHORT'}});await assert.rejects(clean.inbox.reconcileTicket({ticketId:ticket.ticketId,adapter:clean.adapter}),/NATIVE_IDENTITY_CONFLICT/);
});
