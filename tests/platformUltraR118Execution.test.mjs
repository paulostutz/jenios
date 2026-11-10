import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {ExecutionLedger} from '../lib/platform/ultra/client/execution-ledger.mjs';
import {UltraExecutionRuntime} from '../lib/platform/ultra/client/execution-runtime.mjs';
import {OfflineFixtureBroker,quantityText} from '../lib/platform/ultra/client/fixture-broker.mjs';
import {operationNet,units12} from '../lib/platform/ultra/operation.mjs';
const start=Date.parse('2026-11-10T12:00:00Z');
function fixture(t,{market='forex',provider='mt5',currency='USD',entry='partial',leverage=20,ack=true,margin=1000}={}){
 const dir=mkdtempSync(join(tmpdir(),'ultra-r118-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const path=join(dir,'state.sqlite'),binding={provider,environment:'demo',account:'offline-fixture'},ledger=new ExecutionLedger(path,binding),clock={now:start};
 const config={markets:[{id:market,currency,capital:1000,leverage}],sessionMinutes:60,maxPositions:3,tradeRiskPct:.25,dailyLossPct:2,maxAssetPct:20,excludedSymbols:[]};
 const adapter=new OfflineFixtureBroker({binding:ledger.binding,market,currency,entry,now:()=>clock.now,freeMargin:margin});
 const runtime=new UltraExecutionRuntime({config,market,ledger,adapter,now:()=>clock.now,onWarning:async()=>ack});
 t.after(()=>{try{ledger.close();}catch{}});return {ledger,runtime,adapter,clock,path,binding,config,market};
}
for(const [market,provider,currency] of [['crypto','binance','USDT'],['forex','mt5','USD'],['b3','profit','BRL']])test(`${provider} fixture records entry, partial exit, final exit and late costs`,async t=>{
 const f=fixture(t,{market,provider,currency});await f.runtime.start();const result=await f.runtime.tick(),id=result.clientOrderId;
 assert.equal(result.state,'open');let operation=f.ledger.operation(id);assert.ok(units12(operation.entryQuantity)<units12(operation.requestedQuantity));assert.equal(operationNet(operation),null);
 f.clock.now+=100;assert.equal((await f.runtime.cancel(id)).state,'confirmed');assert.equal(f.ledger.operation(id).state,'open');
 f.clock.now+=100;const half=quantityText(units12(operation.entryQuantity)/2n);assert.equal((await f.runtime.close(id,half)).state,'confirmed');assert.equal(f.ledger.operation(id).state,'partially_closed');assert.equal(operationNet(f.ledger.operation(id)),null);
 f.clock.now+=100;operation=f.ledger.operation(id);await f.runtime.close(id,quantityText(units12(operation.entryQuantity)-units12(operation.exitQuantity)));
 assert.equal(f.ledger.operation(id).state,'closed');assert.equal(operationNet(f.ledger.operation(id)),null);
 f.clock.now+=100;f.adapter.completeCosts(id);await f.runtime.reconcile();assert.notEqual(operationNet(f.ledger.operation(id)),null);assert.ok(f.ledger.outbox('fixture').length>=6);assert.equal(f.adapter.submissions,1);
});
test('intent and financial revision exist before submission; no secret is required',async t=>{
 const f=fixture(t);const original=f.adapter.submitProtected.bind(f.adapter);f.adapter.submitProtected=async request=>{assert.equal(f.ledger.order(request.clientOrderId).state,'sending');assert.equal(f.ledger.operation(request.clientOrderId).state,'sending');assert.ok(f.ledger.outbox('x').length>=2);return original(request);};await f.runtime.start();await f.runtime.tick();
});
test('submission timeout reconciles without resending and remains paused until explicit resume',async t=>{
 const f=fixture(t);await f.runtime.start();f.adapter.failAfterSubmit=true;const result=await f.runtime.tick();assert.equal(result.state,'reconciliation_required');assert.equal(f.ledger.operation(result.clientOrderId).state,'unknown');
 f.clock.now+=100;await f.runtime.tick();assert.equal(f.ledger.operation(result.clientOrderId).state,'open');assert.equal(f.adapter.submissions,1);assert.equal(f.ledger.paused(),true);await f.runtime.resume();assert.equal(f.ledger.paused(),false);
});
test('restart recovers unknown entry without invoking submit',async t=>{
 const f=fixture(t);await f.runtime.start();f.adapter.failAfterSubmit=true;const result=await f.runtime.tick();f.ledger.close();f.clock.now+=100;
 const again=new ExecutionLedger(f.path,f.binding);t.after(()=>again.close());const runtime=new UltraExecutionRuntime({config:f.config,market:f.market,ledger:again,adapter:f.adapter,now:()=>f.clock.now,onWarning:async()=>true});await runtime.start({recover:true});assert.equal(again.operation(result.clientOrderId).state,'open');assert.equal(f.adapter.submissions,1);
});
test('unknown lookup never means not sent and never authorizes a retry',async t=>{
 const f=fixture(t);await f.runtime.start();f.adapter.failAfterSubmit=true;await f.runtime.tick();f.adapter.lookup=async()=>null;f.clock.now+=100;await assert.rejects(f.runtime.resume(),/RECONCILIATION_REQUIRED/);await f.runtime.tick();assert.equal(f.adapter.submissions,1);
});
test('known rejection is final with no position or invented result',async t=>{
 const f=fixture(t,{entry:'reject'});await f.runtime.start();const result=await f.runtime.tick();assert.equal(result.state,'rejected');assert.equal(f.ledger.pending().length,0);assert.equal(operationNet(f.ledger.operation(result.clientOrderId)),null);
});
test('close timeout and restart reconcile the command once, never closing twice',async t=>{
 const f=fixture(t,{entry:'full'});await f.runtime.start();const {clientOrderId:id}=await f.runtime.tick();f.clock.now+=100;f.adapter.failAfterCommand=true;const quantity=f.ledger.operation(id).entryQuantity;
 assert.equal((await f.runtime.close(id,quantity)).state,'reconciliation_required');assert.equal(f.ledger.commands()[0].state,'unknown');f.ledger.close();f.clock.now+=100;
 const again=new ExecutionLedger(f.path,f.binding);t.after(()=>again.close());const runtime=new UltraExecutionRuntime({config:f.config,market:f.market,ledger:again,adapter:f.adapter,now:()=>f.clock.now,onWarning:async()=>true});await runtime.start({recover:true});assert.equal(again.operation(id).state,'closed');assert.equal(again.commands().length,0);assert.equal(f.adapter.commandSubmissions,1);
});
test('partial cancellation does not erase exposure, then a distinct close is allowed',async t=>{
 const f=fixture(t);await f.runtime.start();const {clientOrderId:id}=await f.runtime.tick();f.clock.now+=100;await f.runtime.cancel(id);assert.equal(f.ledger.order(id).state,'working');assert.ok(units12(f.ledger.operation(id).entryQuantity)>0n);await f.runtime.close(id,f.ledger.operation(id).entryQuantity);assert.equal(f.ledger.operation(id).state,'closed');
});
test('receipt identities, chronology and state are validated before persisting',async t=>{
 const f=fixture(t);await f.runtime.start();const {clientOrderId:id}=await f.runtime.tick();f.clock.now+=100;const r=await f.adapter.lookup(id),count=f.ledger.receipts().length;
 for(const changed of [{...r,accountBinding:'other'},{...r,clientOrderId:'other'},{...r,operation:{...r.operation,symbol:'WRONG'}},{...r,observedAtMs:f.clock.now+1},{...r,observedAtMs:f.clock.now-6000},{...r,orderState:'closed'},{...r,apiKey:'secret'}])assert.throws(()=>f.ledger.applyReceipt(changed,{now:f.clock.now}));assert.equal(f.ledger.receipts().length,count);
 f.ledger.applyReceipt(r,{now:f.clock.now});assert.equal(f.ledger.applyReceipt(r,{now:f.clock.now}).duplicate,true);assert.throws(()=>f.ledger.applyReceipt({...r,operation:{...r.operation,fees:'2'}},{now:f.clock.now}),/BROKER_RECEIPT_CHANGED/);
});
test('unprotected fill is retained as unknown exposure and blocks new entry',async t=>{
 const f=fixture(t);await f.runtime.start();const original=f.adapter.submitProtected.bind(f.adapter);f.adapter.submitProtected=async r=>{const receipt=await original(r);return {...receipt,protectionConfirmed:false};};const result=await f.runtime.tick();assert.equal(result.state,'reconciliation_required');const operation=f.ledger.operation(result.clientOrderId);assert.equal(operation.state,'unknown');assert.ok(units12(operation.entryQuantity)>0n);assert.equal(f.ledger.paused(),true);
});
test('terminal order acknowledgement cannot close a position without reconciliation',async t=>{
 const f=fixture(t);await f.runtime.start();const {clientOrderId:id}=await f.runtime.tick();f.clock.now+=100;const old=f.ledger.operation(id),r=await f.adapter.lookup(id);r.orderState='closed';r.positionReconciled=false;r.operation={...r.operation,state:'closed',exitQuantity:old.entryQuantity,exitPrice:old.entryPrice,closedAt:new Date(f.clock.now).toISOString()};f.ledger.applyReceipt(r,{now:f.clock.now});assert.equal(f.ledger.operation(id).state,'unknown');assert.equal(f.ledger.paused(),true);
});
test('broker disconnect, invalid protection and expired session pause new entries',async t=>{
 const f=fixture(t);await f.runtime.start();f.adapter.connected=false;await assert.rejects(f.runtime.tick(),/DISCONNECTED/);assert.equal(f.ledger.paused(),true);f.adapter.connected=true;await f.runtime.resume();f.adapter.protection=false;assert.equal((await f.runtime.tick()).state,'protection_unconfirmed');assert.equal(f.adapter.submissions,0);f.adapter.protection=true;await f.runtime.resume();f.clock.now+=60*60000;assert.equal((await f.runtime.tick()).state,'paused');assert.equal(f.adapter.submissions,0);
});
test('margin and leverage consent remain independent technical and user choices',async t=>{
 const f=fixture(t,{leverage:1000,ack:false});await assert.rejects(f.runtime.start(),/RISK_ACKNOWLEDGEMENT/);assert.equal(f.adapter.submissions,0);
 const g=fixture(t,{leverage:1000,margin:0});await g.runtime.start();assert.equal((await g.runtime.tick()).state,'waiting_for_opportunity');assert.equal(g.adapter.submissions,0);
});
test('native/live adapters cannot be constructed through the qualification runtime',t=>{const f=fixture(t);for(const executionEnvironment of ['live','demo','testnet',undefined])assert.throws(()=>new UltraExecutionRuntime({config:f.config,market:f.market,ledger:f.ledger,adapter:{executionEnvironment}}),/NATIVE_EXECUTION_NOT_RELEASED/);});
test('unsent durable commands are cancelled on recovery, not sent automatically',async t=>{
 const f=fixture(t,{entry:'full'});await f.runtime.start();const {clientOrderId:id}=await f.runtime.tick();const command=f.ledger.prepareCommand('close',id,{quantity:f.ledger.operation(id).entryQuantity},f.clock.now);await f.runtime.reconcile();assert.equal(f.ledger.commands().length,0);assert.equal(f.ledger.commands({pending:false}).find(c=>c.id===command.id).state,'cancelled');assert.equal(f.adapter.commandSubmissions,0);
});
test('concurrent operation commands serialize and repeated unresolved commands block',async t=>{
 const f=fixture(t,{entry:'full'});await f.runtime.start();const {clientOrderId:id}=await f.runtime.tick();const quantity=f.ledger.operation(id).entryQuantity;let release;f.adapter.closeOwned=async()=>new Promise(resolve=>{release=resolve;});const first=f.runtime.close(id,quantity);while(!release)await new Promise(resolve=>setImmediate(resolve));await assert.rejects(f.runtime.close(id,quantity),/RUNTIME_BUSY/);release(null);assert.equal((await first).state,'reconciliation_required');await assert.rejects(f.runtime.close(id,quantity),/COMMAND_RECONCILIATION_REQUIRED/);
});
test('preflight delay invalidates stale quote before any submission',async t=>{
 const f=fixture(t);await f.runtime.start();f.adapter.preflight=async()=>{f.clock.now+=2000;return {allowed:true,protectionSupported:true};};assert.equal((await f.runtime.tick()).state,'waiting_for_opportunity');assert.equal(f.adapter.submissions,0);
});
test('cancel intent is durable before callback and wrong command receipts cannot acknowledge it',async t=>{
 const f=fixture(t);await f.runtime.start();const {clientOrderId:id}=await f.runtime.tick();f.clock.now+=100;const original=f.adapter.cancelRemainder.bind(f.adapter);
 f.adapter.cancelRemainder=async(command,operation)=>{assert.equal(f.ledger.commands()[0].state,'sending');const r=await original(command,operation);return {...r,commandId:'wrong'};};const result=await f.runtime.cancel(id);assert.equal(result.state,'reconciliation_required');assert.equal(f.ledger.commands()[0].state,'unknown');assert.equal(f.adapter.commandSubmissions,1);
});
test('offline qualification creates a distinct non-telemetry report and no external orders',async t=>{
 const {qualifyOffline}=await import('../scripts/platform/ultra/qualify-offline.mjs');const dir=mkdtempSync(join(tmpdir(),'ultra-qualify-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));const result=await qualifyOffline(dir);assert.equal(result.report.schema,'JENIOS_ULTRA_OFFLINE_QUALIFICATION_R118');assert.equal(result.report.results.length,3);assert.ok(result.report.results.every(r=>r.ordersSentToBroker===0&&r.fixtureSubmissions===1&&r.operations[0].state==='closed'));assert.equal(result.report.nativeValidated,false);await assert.rejects(qualifyOffline(dir),/QUALIFICATION_DIRECTORY_MUST_BE_EMPTY/);
});
test('explicit retry after recovery cancels an unsent command uses a new durable command ID',async t=>{
 const f=fixture(t,{entry:'full'});await f.runtime.start();const {clientOrderId:id}=await f.runtime.tick(),quantity=f.ledger.operation(id).entryQuantity;
 const abandoned=f.ledger.prepareCommand('close',id,{quantity},f.clock.now);await f.runtime.reconcile();f.clock.now+=100;const retried=await f.runtime.close(id,quantity);assert.equal(retried.state,'confirmed');assert.notEqual(retried.commandId,abandoned.id);assert.equal(f.adapter.commandSubmissions,1);
});
test('resume cannot bypass denied consent or a failed account preflight',async t=>{
 const f=fixture(t,{ack:false});await assert.rejects(f.runtime.start(),/RISK_ACKNOWLEDGEMENT/);await assert.rejects(f.runtime.resume(),/RISK_ACKNOWLEDGEMENT/);assert.equal((await f.runtime.tick()).state,'paused');assert.equal(f.adapter.submissions,0);
 const g=fixture(t);await g.runtime.start();g.adapter.inspect=async()=>({accountBinding:'wrong'});await assert.rejects(g.runtime.resume(),/BROKER_PREFLIGHT_REQUIRED/);assert.equal(g.ledger.paused(),true);
});
test('unchanged or partially filled close receipts cannot falsely acknowledge the full command',async t=>{
 const f=fixture(t,{entry:'full'});await f.runtime.start();const {clientOrderId:id}=await f.runtime.tick(),quantity=f.ledger.operation(id).entryQuantity;f.clock.now+=100;
 f.adapter.closeOwned=async command=>f.adapter.receipt(f.ledger.operation(id),command.id);const response=await f.runtime.close(id,quantity);assert.equal(response.state,'reconciliation_required');assert.equal(f.ledger.commands()[0].state,'unknown');assert.equal(f.ledger.operation(id).exitQuantity,'0');
 const command=f.ledger.commands()[0],original=f.ledger.operation(id);f.clock.now+=100;const partial={...original,state:'partially_closed',exitQuantity:quantityText(units12(quantity)/2n),exitPrice:original.entryPrice};const r=f.adapter.receipt(partial,command.id);const accepted=f.ledger.applyReceipt(r,{commandId:command.id,now:f.clock.now});assert.equal(accepted.commandConfirmed,false);assert.equal(f.ledger.commands()[0].state,'unknown');assert.equal(f.ledger.operation(id).state,'partially_closed');
});
test('unchanged cancellation snapshot requires explicit evidence that entry remainder is cancelled',async t=>{
 const f=fixture(t);await f.runtime.start();const {clientOrderId:id}=await f.runtime.tick();f.clock.now+=100;f.adapter.cancelRemainder=async command=>f.adapter.receipt(f.ledger.operation(id),command.id);assert.equal((await f.runtime.cancel(id)).state,'reconciliation_required');assert.equal(f.ledger.commands()[0].state,'unknown');assert.equal(f.ledger.order(id).state,'working');
});
test('closePositions reconciles unknown entry exposure before closing it',async t=>{
 const f=fixture(t);await f.runtime.start();f.adapter.failAfterSubmit=true;const {clientOrderId:id}=await f.runtime.tick();assert.equal(f.ledger.operation(id).state,'unknown');f.clock.now+=100;const result=await f.runtime.closePositions();assert.equal(result.state,'confirmed');assert.equal(result.results.length,2);assert.equal(f.ledger.operation(id).state,'closed');assert.equal(f.adapter.commandSubmissions,2);
});
test('closePositions reports unresolved exposure instead of returning an empty success',async t=>{
 const f=fixture(t);await f.runtime.start();f.adapter.failAfterSubmit=true;const {clientOrderId:id}=await f.runtime.tick();f.adapter.lookup=async()=>null;const result=await f.runtime.closePositions();assert.equal(result.state,'reconciliation_required');assert.deepEqual(result.unresolvedOperationIds,[id]);assert.equal(f.adapter.commandSubmissions,0);
});
test('closed position snapshot cannot hide an unfilled uncancelled entry remainder',async t=>{
 const f=fixture(t);await f.runtime.start();const {clientOrderId:id}=await f.runtime.tick();f.clock.now+=100;const old=f.ledger.operation(id),receipt=await f.adapter.lookup(id);receipt.orderState='closed';receipt.operation={...receipt.operation,state:'closed',exitQuantity:old.entryQuantity,exitPrice:old.entryPrice,closedAt:new Date(f.clock.now).toISOString()};
 const result=f.ledger.applyReceipt(receipt,{now:f.clock.now});assert.equal(result.state,'unknown');assert.equal(f.ledger.operation(id).reason,'ENTRY_REMAINDER_UNCONFIRMED');assert.equal(f.ledger.pending().length,1);
});
test('closePositions recalculates exposure when cancellation races the remaining entry fill',async t=>{
 const f=fixture(t);await f.runtime.start();const {clientOrderId:id}=await f.runtime.tick();f.clock.now+=100;const original=f.adapter.cancelRemainder.bind(f.adapter);f.adapter.cancelRemainder=async(command,operation)=>{const current=f.adapter.orders.get(id);f.adapter.orders.set(id,{...current,entryQuantity:current.requestedQuantity});return original(command,operation);};
 const result=await f.runtime.closePositions();assert.equal(result.state,'confirmed');assert.equal(f.ledger.operation(id).entryQuantity,f.ledger.operation(id).requestedQuantity);assert.equal(units12(f.ledger.operation(id).exitQuantity),units12(f.ledger.operation(id).entryQuantity));assert.equal(f.ledger.pending().length,0);
});
test('recovery of sending command with no effect stays unknown without stale-state exception',async t=>{
 const f=fixture(t,{entry:'full'});await f.runtime.start();const {clientOrderId:id}=await f.runtime.tick(),quantity=f.ledger.operation(id).entryQuantity;
 const command=f.ledger.prepareCommand('close',id,{quantity},f.clock.now);f.ledger.markCommand(command.id,'prepared','sending',f.clock.now);f.adapter.lookupCommand=async()=>f.adapter.receipt(f.ledger.operation(id),command.id);
 await f.runtime.reconcile();assert.equal(f.ledger.commands()[0].state,'unknown');assert.equal(f.ledger.paused(),true);assert.equal(f.adapter.commandSubmissions,0);
});
test('explicit full close requires cancelling the incomplete entry first',async t=>{
 const f=fixture(t);await f.runtime.start();const {clientOrderId:id}=await f.runtime.tick();await assert.rejects(f.runtime.close(id,f.ledger.operation(id).entryQuantity),/ENTRY_REMAINDER_CANCEL_REQUIRED/);assert.equal(f.adapter.commandSubmissions,0);
});
test('acknowledged unfilled entry remains working and can be cancelled without invented fills',async t=>{
 const f=fixture(t,{entry:'none'});await f.runtime.start();const {clientOrderId:id,state}=await f.runtime.tick();assert.equal(state,'sending');assert.equal(f.ledger.order(id).state,'working');assert.equal(f.ledger.operation(id).entryQuantity,'0.000000000000');f.clock.now+=100;assert.equal((await f.runtime.cancel(id)).state,'confirmed');assert.equal(f.ledger.operation(id).state,'cancelled');assert.equal(operationNet(f.ledger.operation(id)),null);
});
test('closePositions cancels an acknowledged unfilled entry instead of ignoring it',async t=>{
 const f=fixture(t,{entry:'none'});await f.runtime.start();const {clientOrderId:id}=await f.runtime.tick();f.clock.now+=100;const result=await f.runtime.closePositions();assert.equal(result.state,'confirmed');assert.equal(f.ledger.operation(id).state,'cancelled');assert.equal(f.adapter.commandSubmissions,1);
});
test('closePositions handles entry completing before cancellation without aborting the close',async t=>{
 const f=fixture(t);await f.runtime.start();const {clientOrderId:id}=await f.runtime.tick();f.clock.now+=100;let lookups=0;const original=f.adapter.lookup.bind(f.adapter);f.adapter.lookup=async op=>{if(++lookups===2){const row=f.adapter.orders.get(id);f.adapter.orders.set(id,{...row,entryQuantity:row.requestedQuantity});}return original(op);};
 const result=await f.runtime.closePositions();assert.equal(result.state,'confirmed');assert.equal(f.ledger.operation(id).state,'closed');assert.equal(f.adapter.commandSubmissions,1);
});
