import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {BinanceActionJournalR119,canonicalProtocolJson} from '../lib/platform/ultra/client/binance-action-journal-r119.mjs';
import {BinanceProtocolSandboxR119} from '../lib/platform/ultra/client/binance-protocol-sandbox-r119.mjs';
import {DurableBinanceAdapterR119} from '../lib/platform/ultra/client/binance-durable-adapter-r119.mjs';
import {buildSpotLimitRequest,buildSpotQueryRequest,buildSpotCancelRequest,buildSpotOcoRequest,buildSpotOrderListQueryRequest} from '../lib/platform/ultra/client/binance-spot-protocol-r119.mjs';
import {buildBinanceFuturesLookupR119} from '../lib/platform/ultra/client/binance-futures-protocol-r119.mjs';
const now=Date.parse('2026-11-10T12:00:00Z');
const meta={symbol:'BTCUSDT',status:'TRADING',isSpotTradingAllowed:true,ocoAllowed:true,baseAsset:'BTC',quoteAsset:'USDT',orderTypes:['LIMIT','LIMIT_MAKER','STOP_LOSS_LIMIT'],filters:[{filterType:'PRICE_FILTER',minPrice:'0.01',maxPrice:'1000000',tickSize:'0.01'},{filterType:'LOT_SIZE',minQty:'0.001',maxQty:'100',stepSize:'0.001'},{filterType:'MIN_NOTIONAL',minNotional:'1'}]};
const account={accountType:'SPOT',canTrade:true,balances:[{asset:'BTC',free:'2'},{asset:'USDT',free:'1000'}]};
function fixture(t,product='spot'){
 const dir=mkdtempSync(join(tmpdir(),'ultra-r119-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const path=join(dir,'native.sqlite'),binding={account:'synthetic',provider:'binance',environment:'demo'},ledger=new BinanceActionJournalR119(path,binding,{product}),clock={now};
 ledger.claim(now);ledger.resume();const operationId=ledger.prepare({market:'crypto',symbol:'BTCUSDT',side:'buy',quantity:'1',entryPrice:'100',currency:'USDT'},now).id;
 const transport=new BinanceProtocolSandboxR119({product}),adapter=new DurableBinanceAdapterR119({ledger,transport,now:()=>clock.now});t.after(()=>{try{ledger.close();}catch{}});
 return {dir,path,binding,ledger,clock,operationId,transport,adapter,product};
}
function intent(f,clientId='ju_native119'){
 if(f.product==='spot')return {operationId:f.operationId,role:'entry',request:buildSpotLimitRequest({product:'spot',symbol:'BTCUSDT',side:'BUY',type:'LIMIT',quantity:'1',price:'100',clientOrderId:clientId},meta,account),lookup:buildSpotQueryRequest({product:'spot',symbol:'BTCUSDT',origClientOrderId:clientId}),expected:{product:'spot',kind:'order',clientId,symbol:'BTCUSDT',side:'BUY'}};
 const binding={product:f.product,environment:'demo',keyFingerprint:'a'.repeat(64)};
 return {operationId:f.operationId,role:'entry',request:{schema:'JENIOS_ULTRA_BINANCE_UNSIGNED_REQUEST_R119',product:f.product,binding,method:'POST',path:'/fapi/v1/order',params:{symbol:'BTCUSDT',side:'BUY',type:'LIMIT',quantity:'1',price:'100',newClientOrderId:clientId,timeInForce:'GTC',timestamp:now,recvWindow:5000},signed:false,canSubmit:false},lookup:buildBinanceFuturesLookupR119({binding,kind:'order',clientId,symbol:'BTCUSDT',timestamp:now,action:'query'}),expected:{product:f.product,kind:'order',clientId,symbol:'BTCUSDT',side:'BUY',binding}};
}
function response(product,clientId='ju_native119',patch={}){return {symbol:'BTCUSDT',orderId:'90071992547409931',clientOrderId:clientId,side:'BUY',status:'PARTIALLY_FILLED',origQty:'1',executedQty:'0.4',...(product==='spot'?{cummulativeQuoteQty:'40'}:{positionSide:'BOTH',type:'LIMIT',avgPrice:'100'}),updateTime:now,...patch};}
for(const product of ['spot','usds_m_futures'])test(`${product}: durable native intent and sending record precede sandbox mutation`,async t=>{
 const f=fixture(t,product),i=intent(f),prepared=f.adapter.prepare(i);f.transport.append({method:'POST',path:i.request.path,httpStatus:200,body:response(product)});
 const result=await f.adapter.dispatch(prepared.id);assert.equal(result.state,'observed');assert.equal(result.nativeObservation.executedQuantity,'0.4');assert.equal(result.protectionConfirmed,false);assert.equal(result.financialRecordPending,true);assert.deepEqual(f.ledger.nativeEvents(prepared.id).map(e=>e.state),['prepared','sending','observed']);assert.equal(f.ledger.operation(f.operationId).state,'sending');assert.equal(f.transport.calls.length,1);
 const retry=await f.adapter.dispatch(prepared.id);assert.equal(retry.state,'observed');assert.equal(f.transport.calls.length,1);assert.equal(f.ledger.operations().length,1);
});
for(const product of ['spot','usds_m_futures'])test(`${product}: accepted-but-lost response recovers by exact lookup after disk restart`,async t=>{
 const f=fixture(t,product),i=intent(f),prepared=f.adapter.prepare(i);f.transport.append({method:'POST',path:i.request.path,failure:'response_lost'});assert.equal((await f.adapter.dispatch(prepared.id)).state,'unknown');assert.equal(f.ledger.operation(f.operationId).state,'unknown');f.ledger.close();f.clock.now+=100;
 const ledger=new BinanceActionJournalR119(f.path,f.binding,{product});t.after(()=>ledger.close());ledger.claim(f.clock.now,{recover:true});const transport=new BinanceProtocolSandboxR119({product,responses:[{method:'GET',path:i.lookup.path,httpStatus:200,body:response(product)}]}),adapter=new DurableBinanceAdapterR119({ledger,transport,now:()=>f.clock.now});const results=await adapter.recover();assert.equal(results[0].state,'observed');assert.equal(transport.calls.length,1);assert.equal(transport.calls[0].method,'GET');assert.equal(ledger.operations().length,1);assert.equal(ledger.operation(f.operationId).state,'unknown');assert.equal((await adapter.dispatch(prepared.id)).state,'observed');assert.equal(transport.calls.length,1);
});
test('not-found, duplicate, malformed and wrong-identity observations never permit resend',async t=>{
 for(const body of [{code:-2013},{code:-2010},response('spot','other'),{wrong:'shape'}]){
  const f=fixture(t),i=intent(f),p=f.adapter.prepare(i);f.transport.append({method:'POST',path:i.request.path,failure:'timeout'},{method:'GET',path:i.lookup.path,httpStatus:body.code?400:200,body});await f.adapter.dispatch(p.id);assert.equal((await f.adapter.reconcile(p.id)).state,'unknown');await f.adapter.dispatch(p.id);assert.equal(f.transport.calls.filter(c=>c.method==='POST').length,1);
 }
});
test('concurrent callers share one compare-and-set and perform one mutation only',async t=>{
 const f=fixture(t),i=intent(f),p=f.adapter.prepare(i);f.transport.append({method:'POST',path:i.request.path,httpStatus:200,body:response('spot'),delayMs:15});const a=f.adapter.dispatch(p.id),b=new DurableBinanceAdapterR119({ledger:f.ledger,transport:f.transport,now:()=>now}).dispatch(p.id);await Promise.all([a,b]);assert.equal(f.transport.calls.length,1);assert.equal(f.ledger.nativeEvents(p.id).filter(x=>x.state==='sending').length,1);
});
test('unsigned acknowledgements remain observations, never fill/cost/protection certification',async t=>{
 const f=fixture(t),i=intent(f),p=f.adapter.prepare(i);f.transport.append({method:'POST',path:i.request.path,httpStatus:200,body:{symbol:'BTCUSDT',orderId:'12',clientOrderId:'ju_native119'}});const result=await f.adapter.dispatch(p.id);assert.equal(result.state,'observed');assert.equal(result.nativeObservation.executedQuantity,null);assert.equal(result.financialRecordPending,true);assert.equal(result.protectionConfirmed,false);assert.equal(f.ledger.operation(f.operationId).entryQuantity,'0');
});
test('known attempt rejection is durable but cannot be blindly resubmitted',async t=>{
 const f=fixture(t),i=intent(f),p=f.adapter.prepare(i);f.transport.append({method:'POST',path:i.request.path,httpStatus:400,body:{code:-1013,msg:'synthetic rejected quantity'}});const result=await f.adapter.dispatch(p.id);assert.equal(result.state,'rejected');assert.equal(result.automaticResubmitAllowed,false);await f.adapter.dispatch(p.id);assert.equal(f.transport.calls.length,1);
});
test('crash before sending is distinguished from unknown execution and does not auto-send',async t=>{
 const f=fixture(t),p=f.adapter.prepare(intent(f));const results=await f.adapter.recover();assert.equal(results[0].state,'not_sent');assert.equal((await f.adapter.dispatch(p.id)).state,'not_sent');assert.equal(f.transport.calls.length,0);
});
test('same native identity with changed economics or another operation cannot overwrite durable intent',t=>{
 const f=fixture(t),i=intent(f);f.adapter.prepare(i);assert.equal(f.adapter.prepare(structuredClone(i)).created,false);assert.throws(()=>f.adapter.prepare({...i,request:{...i.request,params:{...i.request.params,quantity:'2'}}}),/QUANTITY_MISMATCH/);assert.throws(()=>f.adapter.prepare({...i,request:{...i.request,params:{...i.request.params,price:'101'}}}),/PRICE_MISMATCH/);assert.throws(()=>f.adapter.prepare({...i,lookup:buildSpotQueryRequest({product:'spot',symbol:'BTCUSDT',origClientOrderId:'other'})}),/LOOKUP_TARGET_MISMATCH/);
 const other=f.ledger.prepare({market:'crypto',symbol:'BTCUSDT',side:'buy',quantity:'1',entryPrice:'100',currency:'USDT',observedAtMs:now+1},now).id;assert.throws(()=>f.adapter.prepare({...i,operationId:other}),/INTENT_CONFLICT/);
});
test('product binding cannot share the same journal, even with identical account identity',t=>{
 const f=fixture(t);assert.throws(()=>new BinanceActionJournalR119(f.path,f.binding,{product:'usds_m_futures'}),/PRODUCT_JOURNAL_MISMATCH/);assert.throws(()=>new BinanceActionJournalR119(join(f.dir,'live.sqlite'),{...f.binding,environment:'live'},{product:'spot'}),/OFFLINE_BINANCE_SCOPE_REQUIRED/);
});
test('native transports, endpoints, credentials and strategy inversions are rejected',t=>{
 const f=fixture(t),i=intent(f);assert.throws(()=>new DurableBinanceAdapterR119({ledger:f.ledger,transport:{request:async()=>{throw Error('no');}}}),/NATIVE_TRANSPORT_NOT_RELEASED/);
 for(const request of [{...i.request,path:'/api/v3/withdraw'},{...i.request,params:{...i.request.params,signature:'secret'}},{...i.request,validation:{private:{apiKey:'secret'}}},{...i.request,params:{...i.request.params,side:'SELL'}},{...i.request,product:'usds_m_futures'}])assert.throws(()=>f.adapter.prepare({...i,request}));assert.equal(f.transport.calls.length,0);
});
test('paused or stale-lease entry cannot reach even the sandbox transport',async t=>{
 const f=fixture(t),p=f.adapter.prepare(intent(f));f.ledger.pause();await assert.rejects(f.adapter.dispatch(p.id),/ENTRY_NOT_ACTIVE/);assert.equal(f.transport.calls.length,0);f.ledger.resume();f.clock.now+=11000;await assert.rejects(f.adapter.dispatch(p.id),/HEARTBEAT_STALE/);assert.equal(f.transport.calls.length,0);
});
test('cancel uses exact original target and never interprets an accepted snapshot as operation closed',async t=>{
 const f=fixture(t),entry=intent(f),p=f.adapter.prepare(entry);f.transport.append({method:'POST',path:entry.request.path,httpStatus:200,body:response('spot')});await f.adapter.dispatch(p.id);
 const cancellation={...entry,role:'cancel',request:buildSpotCancelRequest({product:'spot',symbol:'BTCUSDT',origClientOrderId:'ju_native119'})},c=f.adapter.prepare(cancellation);f.transport.append({method:'DELETE',path:entry.request.path,httpStatus:200,body:response('spot','cancel_ack',{origClientOrderId:'ju_native119',status:'CANCELED'})});const result=await f.adapter.dispatch(c.id);assert.equal(result.state,'observed');assert.equal(result.nativeObservation.executedQuantity,'0.4');assert.equal(result.financialRecordPending,true);assert.notEqual(f.ledger.operation(f.operationId).state,'closed');
});
test('Futures algo observation is target-bound and ACK cannot certify installed protection',async t=>{
 const f=fixture(t,'usds_m_futures');const old=f.ledger.operation(f.operationId);f.ledger.saveOperation({...old,state:'open',openedAt:old.createdAt,entryQuantity:'1',entryPrice:'100'},{now});
 const b={product:f.product,environment:'demo',keyFingerprint:'a'.repeat(64)},clientId='js_fixture',request={product:f.product,binding:b,method:'POST',path:'/fapi/v1/algoOrder',params:{symbol:'BTCUSDT',side:'SELL',quantity:'1',type:'STOP_MARKET',triggerPrice:'90',clientAlgoId:clientId,reduceOnly:'true'},signed:false,canSubmit:false};
 const p=f.adapter.prepare({operationId:f.operationId,role:'stop',request,lookup:buildBinanceFuturesLookupR119({binding:b,kind:'algo',clientId,timestamp:now,action:'query'}),expected:{product:f.product,kind:'algo',clientId,symbol:'BTCUSDT',side:'SELL',binding:b}});f.transport.append({method:'POST',path:request.path,httpStatus:200,body:{algoId:'99',clientAlgoId:clientId,symbol:'BTCUSDT',side:'SELL',algoStatus:'NEW'}});const result=await f.adapter.dispatch(p.id);assert.equal(result.state,'observed');assert.equal(result.nativeObservation.protectionInstalled,false);assert.equal(result.protectionConfirmed,false);
});
test('canonical intent equality ignores property order, refuses non-JSON hidden behavior',()=>{
 assert.equal(canonicalProtocolJson({b:2,a:1}),canonicalProtocolJson({a:1,b:2}));for(const x of [()=>{},NaN,new Date(),{x:undefined}])assert.throws(()=>canonicalProtocolJson(x));
});
test('adapter and sandbox contain no network/credential or permission-change path',()=>{
 for(const file of ['binance-durable-adapter-r119.mjs','binance-protocol-sandbox-r119.mjs','binance-action-journal-r119.mjs'])assert.doesNotMatch(readFileSync('lib/platform/ultra/client/'+file,'utf8'),/\bfetch\s*\(|\bWebSocket\s*\(|process\.env|createHmac|\/fapi\/v1\/(?:leverage|marginType|positionSide)/);
});
test('one logical operation cannot acquire two entry identities or mix entry and protected entry',t=>{
 const f=fixture(t);f.adapter.prepare(intent(f,'ju_first'));assert.throws(()=>f.adapter.prepare(intent(f,'ju_second')),/OPERATION_ROLE_ALREADY_BOUND/);assert.equal(f.ledger.nativeActions().length,1);
});
test('Futures recovery refreshes only lookup timing after a long downtime',async t=>{
 const f=fixture(t,'usds_m_futures'),i=intent(f),p=f.adapter.prepare(i);f.transport.append({method:'POST',path:i.request.path,failure:'timeout'});await f.adapter.dispatch(p.id);f.clock.now+=60000;f.ledger.heartbeat(f.clock.now);f.transport.append({method:'GET',path:i.lookup.path,expectParams:{timestamp:f.clock.now,origClientOrderId:'ju_native119'},httpStatus:200,body:response(f.product)});
 const result=await f.adapter.reconcile(p.id);assert.equal(result.state,'observed');assert.equal(f.transport.calls[1].params.timestamp,f.clock.now);assert.equal(f.ledger.nativeAction(p.id).lookup.params.timestamp,now);assert.equal(f.transport.calls.filter(c=>c.method==='POST').length,1);
});
test('a mutation queued beyond its timestamp window is never dispatched even after heartbeat',async t=>{
 const f=fixture(t,'usds_m_futures'),i=intent(f),p=f.adapter.prepare(i);f.clock.now+=6000;f.ledger.heartbeat(f.clock.now);await assert.rejects(f.adapter.dispatch(p.id),/NATIVE_REQUEST_STALE/);assert.equal(f.transport.calls.length,0);assert.equal(f.ledger.nativeAction(p.id).state,'prepared');
});
function makeOwnedExposure(f){
 f.ledger.transition(f.operationId,'prepared','sending',null,now);const old=f.ledger.operation(f.operationId),operation={...old,state:'open',entryQuantity:'1',entryPrice:'100',openedAt:old.createdAt};
 f.ledger.applyReceipt({receiptId:'synthetic_native_position',accountBinding:f.ledger.binding,clientOrderId:f.operationId,commandId:null,observedAtMs:now,orderState:'working',positionReconciled:true,protectionConfirmed:true,entryRemainderCancelled:false,operation},{now});
}
test('each native close binds one durable close command and keeps it unresolved until position evidence',async t=>{
 const f=fixture(t);makeOwnedExposure(f);const command=f.ledger.prepareCommand('close',f.operationId,{quantity:'0.4'},now),clientId='jc_'+command.id.slice(7),request=buildSpotLimitRequest({product:'spot',symbol:'BTCUSDT',side:'SELL',type:'LIMIT',quantity:'0.4',price:'101',clientOrderId:clientId},meta,account),lookup=buildSpotQueryRequest({product:'spot',symbol:'BTCUSDT',origClientOrderId:clientId}),expected={product:'spot',kind:'order',clientId,symbol:'BTCUSDT',side:'SELL'};
 assert.throws(()=>f.adapter.prepare({operationId:f.operationId,role:'close',request,lookup,expected}),/DURABLE_CLOSE_COMMAND_REQUIRED/);
 const p=f.adapter.prepare({operationId:f.operationId,role:'close',request,lookup,expected,commandId:command.id});f.transport.append({method:'POST',path:request.path,failure:'response_lost'});await f.adapter.dispatch(p.id);assert.equal(f.ledger.commands()[0].state,'unknown');assert.equal(f.ledger.nativeAction(p.id).state,'unknown');
 const otherId='jc_different';assert.throws(()=>f.adapter.prepare({operationId:f.operationId,role:'close',commandId:command.id,request:{...request,params:{...request.params,newClientOrderId:otherId}},lookup:buildSpotQueryRequest({product:'spot',symbol:'BTCUSDT',origClientOrderId:otherId}),expected:{...expected,clientId:otherId}}),/CLOSE_COMMAND_ALREADY_BOUND/);
 f.transport.append({method:'GET',path:lookup.path,httpStatus:200,body:response('spot',clientId,{side:'SELL',origQty:'0.4',executedQty:'0.4',cummulativeQuoteQty:'40.4',status:'FILLED'})});const reconciled=await f.adapter.reconcile(p.id);assert.equal(reconciled.state,'observed');assert.equal(f.ledger.commands()[0].state,'unknown');assert.equal(f.ledger.operation(f.operationId).state,'open');assert.equal(reconciled.financialRecordPending,true);
});
test('Spot protection list keeps exact expected child identities during reconciliation',async t=>{
 const f=fixture(t);makeOwnedExposure(f);const request=buildSpotOcoRequest({product:'spot',symbol:'BTCUSDT',side:'SELL',quantity:'1',takeProfitPrice:'110',stopPrice:'90',stopLimitPrice:'89',lastPrice:'100',listClientOrderId:'list_119',aboveClientOrderId:'tp_119',belowClientOrderId:'sl_119'},meta,account),lookup=buildSpotOrderListQueryRequest({product:'spot',origClientOrderId:'list_119'}),expected={product:'spot',kind:'list',clientId:'list_119',symbol:'BTCUSDT',side:'SELL',childClientIds:['tp_119','sl_119']};
 const p=f.adapter.prepare({operationId:f.operationId,role:'protection_list',request,lookup,expected});f.transport.append({method:'POST',path:request.path,httpStatus:200,body:{orderListId:'30',listClientOrderId:'list_119',symbol:'BTCUSDT',contingencyType:'OCO',listStatusType:'EXEC_STARTED',listOrderStatus:'EXECUTING',transactionTime:now,orders:[{symbol:'BTCUSDT',orderId:'31',clientOrderId:'tp_other'},{symbol:'BTCUSDT',orderId:'32',clientOrderId:'sl_119'}]}});assert.equal((await f.adapter.dispatch(p.id)).state,'unknown');assert.equal(f.transport.calls.length,1);
});

test('mutation expiry honors a shorter configured recvWindow and rejects invalid windows',async t=>{
 const f=fixture(t,'usds_m_futures'),i=intent(f);i.request.params.recvWindow=1000;const p=f.adapter.prepare(i);f.clock.now+=1500;await assert.rejects(f.adapter.dispatch(p.id),/NATIVE_REQUEST_STALE/);assert.equal(f.transport.calls.length,0);
 for(const recvWindow of [0,5001,-1,1.5,'1000'])assert.throws(()=>f.adapter.prepare({...i,request:{...i.request,params:{...i.request.params,recvWindow}}}),/PROTOCOL_(?:WINDOW_INVALID|CREDENTIAL_OR_PARAM_REJECTED)/);
});
test('unowned cancellation and mismatched expected side cannot become durable actions',t=>{
 const f=fixture(t),i=intent(f);assert.throws(()=>f.adapter.prepare({...i,expected:{...i.expected,side:'SELL'}}),/EXPECTED_SIDE_MISMATCH/);
 assert.throws(()=>f.adapter.prepare({...i,role:'cancel',request:buildSpotCancelRequest({product:'spot',symbol:'BTCUSDT',origClientOrderId:i.expected.clientId})}),/CANCEL_TARGET_NOT_OWNED/);assert.equal(f.ledger.nativeActions().length,0);
});
