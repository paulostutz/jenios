import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {AttributedExecutionLedgerR127} from '../lib/platform/ultra/client/operation-records-r127.mjs';
import {ExecutionLedger} from '../lib/platform/ultra/client/execution-ledger.mjs';
import {UltraExecutionRuntime} from '../lib/platform/ultra/client/execution-runtime.mjs';
import {OfflineFixtureBroker,quantityText} from '../lib/platform/ultra/client/fixture-broker.mjs';
import {digest} from '../lib/platform/ultra/client/journal.mjs';
import {initialOperation,units12} from '../lib/platform/ultra/operation.mjs';

const start=Date.parse('2026-11-10T12:00:00Z');
function fixture(t,{provider='binance',product='spot',entry='full',account='offline-account',sourcePlatform='jenios',currency=provider==='binance'?'USDT':'BRL'}={}){
 const dir=mkdtempSync(join(tmpdir(),'ultra-r127-records-'));
 const path=join(dir,'operations.sqlite'),binding={account,environment:'demo',provider},market=provider==='binance'?'crypto':'b3';
 const clock={now:start},config={markets:[{id:market,currency,capital:1000,leverage:1}],sessionMinutes:60,maxPositions:3,tradeRiskPct:.25,dailyLossPct:2,maxAssetPct:20,excludedSymbols:[]};
 const context={sourcePlatform,connectionId:'demo-connection',ownerScope:'demo-owner',sessionId:'demo-session',strategy:{id:'ultrafast-existing',version:'R18-R53',configDigest:digest(config)},product,evidenceMode:'offline_fixture'};
 const ledger=new AttributedExecutionLedgerR127(path,binding,context),adapter=new OfflineFixtureBroker({binding:ledger.binding,market,currency,entry,now:()=>clock.now});
 const runtime=new UltraExecutionRuntime({config,market,ledger,adapter,now:()=>clock.now,onWarning:async()=>true});
 t.after(()=>{try{ledger.close();}catch{}rmSync(dir,{recursive:true,force:true});});
 return {ledger,adapter,runtime,clock,path,binding,context,config,market};
}
const batch=f=>f.ledger.recordBatch({now:f.clock.now});
const latest=(f,id)=>batch(f).records.filter(x=>x.operation.id===id).at(-1);

test('strategy and local intent attribution commit before sending and contain no raw account',async t=>{
 const f=fixture(t),submit=f.adapter.submitProtected.bind(f.adapter);
 f.adapter.submitProtected=async request=>{
  const record=latest(f,request.clientOrderId);
  assert.equal(record.operation.state,'sending');
  assert.equal(record.origin.strategy.configDigest,digest(f.config));
  assert.equal(record.evidence.localIntentLinked,true);
  assert.equal(record.evidence.receiptRecorded,false);
  assert.equal(f.ledger.order(request.clientOrderId).state,'sending');
  return submit(request);
 };
 await f.runtime.start();const {clientOrderId}=await f.runtime.tick();
 const record=latest(f,clientOrderId);
 assert.equal(record.evidence.receiptRecorded,true);
 assert.equal(record.evidence.brokerAuthenticated,false);
 assert.equal(record.evidence.nativeValidated,false);
 assert.equal(record.scope.accountBinding,f.ledger.binding);
 assert.equal(record.result.afterBrokerCosts,null);
 assert.equal(JSON.stringify(batch(f)).includes('offline-account'),false);
 assert.equal(record.billingDecisionIncluded,false);
});

test('partial entry, cancel, partial exit, closure and late costs retain independent full revisions',async t=>{
 const f=fixture(t,{entry:'partial'});await f.runtime.start();const {clientOrderId:id}=await f.runtime.tick();
 const partial=latest(f,id);assert.equal(partial.operation.state,'open');assert.ok(units12(partial.operation.entryQuantity)<units12(partial.operation.requestedQuantity));
 f.clock.now+=100;await f.runtime.cancel(id);assert.equal(latest(f,id).operation.state,'open');
 f.clock.now+=100;await f.runtime.close(id,quantityText(units12(f.ledger.operation(id).entryQuantity)/2n));
 assert.equal(latest(f,id).operation.state,'partially_closed');assert.equal(latest(f,id).result.afterBrokerCosts,null);
 f.clock.now+=100;await f.runtime.close(id,quantityText(units12(f.ledger.operation(id).entryQuantity)-units12(f.ledger.operation(id).exitQuantity)));
 const closed=latest(f,id);assert.equal(closed.result.status,'awaiting_costs');assert.deepEqual(closed.result.pendingFields,['financing']);assert.equal(closed.operation.fees,'0.01000000');
 assert.equal(closed.result.afterBrokerCosts,null);const cursor=batch(f).nextCursor;
 f.clock.now+=100;f.adapter.completeCosts(id);await f.runtime.reconcile();
 const addition=f.ledger.recordBatch({cursor,now:f.clock.now});assert.equal(addition.records.length,1);
 const final=addition.records[0];assert.equal(final.result.status,'closed_complete');assert.equal(final.operation.financing,'-0.00200000');assert.deepEqual(final.result.pendingFields,[]);
 assert.notEqual(final.result.afterBrokerCosts,null);assert.equal(final.operationKey,closed.operationKey);assert.notEqual(final.eventId,closed.eventId);
 assert.equal(final.financialActivationAllowed,false);assert.equal(final.evidence.kind,'offline_fixture');assert.equal(f.adapter.submissions,1);
});

test('stable replay and restart preserve event identity and do not mutate legacy sync acknowledgements',async t=>{
 const f=fixture(t);await f.runtime.start();const {clientOrderId:id}=await f.runtime.tick();
 const first=batch(f),legacy=f.ledger.outbox('existing-sync');assert.deepEqual(batch(f).records,first.records);assert.deepEqual(f.ledger.outbox('existing-sync'),legacy);
 f.ledger.close();const again=new AttributedExecutionLedgerR127(f.path,f.binding,f.context);t.after(()=>again.close());
 const repeated=again.recordBatch({now:f.clock.now});assert.deepEqual(repeated.records,first.records);
 assert.equal(again.recordBatch({cursor:first.nextCursor,now:f.clock.now}).records.length,0);
 assert.equal(repeated.records.at(-1).operation.id,id);
});

test('Flow and JENIOS use one stored origin and one event identity for the same account journal',async t=>{
 const f=fixture(t);await f.runtime.start();await f.runtime.tick();const before=batch(f);f.ledger.close();
 const flow=new AttributedExecutionLedgerR127(f.path,f.binding,{...f.context,sourcePlatform:'flow'});t.after(()=>flow.close());
 const after=flow.recordBatch({now:f.clock.now});assert.deepEqual(after.records,before.records);assert.equal(after.records[0].origin.sourcePlatform,'jenios');
});

test('unknown response is not a confirmed result and reconciliation does not duplicate the operation',async t=>{
 const f=fixture(t);await f.runtime.start();f.adapter.failAfterSubmit=true;const {clientOrderId:id}=await f.runtime.tick();
 assert.equal(latest(f,id).result.status,'execution_uncertain');assert.equal(latest(f,id).result.afterBrokerCosts,null);
 f.clock.now+=100;await f.runtime.tick();assert.equal(latest(f,id).operation.state,'open');
 assert.equal(new Set(batch(f).records.map(x=>x.operationKey)).size,1);assert.equal(f.adapter.submissions,1);
});

test('rejection and cancellation without fills do not fabricate a realized result',async t=>{
 for(const entry of ['none','reject']){
  const f=fixture(t,{entry});await f.runtime.start();const {clientOrderId:id}=await f.runtime.tick();
  if(entry==='none'){f.clock.now+=100;await f.runtime.cancel(id);}
  const row=latest(f,id);assert.equal(row.operation.state,entry==='none'?'cancelled':'rejected');assert.equal(units12(row.operation.entryQuantity),0n);assert.equal(row.result.afterBrokerCosts,null);
 }
});

test('manual or legacy records without pre-send attribution are excluded and cannot be relabeled',async t=>{
 const f=fixture(t);await f.runtime.start();
 const request={market:'crypto',symbol:'UNATTRIBUTED',currency:'USDT',side:'buy',quantity:'1'};
 const legacy=ExecutionLedger.prototype.prepare.call(f.ledger,request,f.clock.now);
 const manual=initialOperation({...request,symbol:'MANUAL'},'manual_record',f.clock.now);f.ledger.saveOperation(manual,{now:f.clock.now});
 assert.throws(()=>f.ledger.prepare(request,f.clock.now),/ATTRIBUTION_CONFLICT/);
 const result=batch(f);assert.equal(result.records.length,0);assert.equal(result.excludedUnattributedCount,2);assert.equal(result.hasMore,false);
 assert.equal(f.ledger.operation(legacy.id).state,'queued');
});

test('ownership, connection, provider, product and environment cannot be changed on reuse',async t=>{
 const f=fixture(t);await f.runtime.start();await f.runtime.tick();f.ledger.close();
 assert.throws(()=>new AttributedExecutionLedgerR127(f.path,f.binding,{...f.context,ownerScope:'another-owner'}),/JOURNAL_SCOPE_MISMATCH/);
 assert.throws(()=>new AttributedExecutionLedgerR127(f.path,f.binding,{...f.context,connectionId:'another-connection'}),/JOURNAL_SCOPE_MISMATCH/);
 assert.throws(()=>new AttributedExecutionLedgerR127(f.path,f.binding,{...f.context,product:'usds_m_futures'}),/JOURNAL_SCOPE_MISMATCH/);
 assert.throws(()=>new AttributedExecutionLedgerR127(f.path,{...f.binding,environment:'live'},f.context),/DEMO_BINDING_REQUIRED/);
 assert.throws(()=>new AttributedExecutionLedgerR127(f.path,{...f.binding,provider:'profit'},f.context),/PRODUCT_SCOPE_REQUIRED/);
 const other=fixture(t,{account:'another-account'});assert.throws(()=>other.ledger.recordBatch({cursor:{feedId:f.ledger.recordFeedId,sequence:0},now:f.clock.now}),/CURSOR_SCOPE_MISMATCH/);
});

test('failed attribution write rolls back intention and operation audit together',async t=>{
 const f=fixture(t);await f.runtime.start();
 f.ledger.db.exec("CREATE TRIGGER fixture_attribution_failure BEFORE INSERT ON ultra_record_origin_r127 BEGIN SELECT RAISE(ABORT,'fixture storage failure'); END");
 await assert.rejects(f.runtime.tick(),/fixture storage failure/);
 assert.equal(f.adapter.submissions,0);assert.equal(f.ledger.pending().length,0);assert.equal(f.ledger.operations().length,0);assert.equal(f.ledger.outbox('x').length,0);
});

test('failed receipt evidence write does not leave a confirmed financial revision',async t=>{
 const f=fixture(t);await f.runtime.start();
 f.ledger.db.exec("CREATE TRIGGER fixture_evidence_failure BEFORE INSERT ON ultra_record_evidence_r127 BEGIN SELECT RAISE(ABORT,'fixture storage failure'); END");
 const {clientOrderId:id}=await f.runtime.tick();assert.equal(f.adapter.submissions,1);assert.equal(f.ledger.operation(id).state,'unknown');
 assert.equal(f.ledger.receipts().length,0);assert.equal(latest(f,id).result.afterBrokerCosts,null);
 assert.equal(batch(f).records.some(r=>r.evidence.receiptRecorded),false);
});

test('pagination retains currencies per record and reports skipped origins without a hidden total',async t=>{
 const f=fixture(t);await f.runtime.start();
 f.ledger.prepare({market:'crypto',symbol:'FIXTUREUSDT',currency:'USDT',side:'buy',quantity:'1'},f.clock.now);
 f.ledger.prepare({market:'crypto',symbol:'FIXTUREUSD',currency:'USD',side:'buy',quantity:'1'},f.clock.now);
 f.ledger.saveOperation(initialOperation({market:'crypto',symbol:'MANUAL',currency:'EUR',side:'buy',quantity:'1'},'manual',f.clock.now),{now:f.clock.now});
 const one=f.ledger.recordBatch({limit:1,now:f.clock.now}),two=f.ledger.recordBatch({cursor:one.nextCursor,limit:1,now:f.clock.now}),three=f.ledger.recordBatch({cursor:two.nextCursor,limit:1,now:f.clock.now});
 assert.equal(one.records[0].scope.currency,'USDT');assert.equal(two.records[0].scope.currency,'USD');assert.equal(three.records.length,0);assert.equal(three.excludedUnattributedCount,1);assert.equal(three.hasMore,false);
 assert.equal(Object.hasOwn(one,'total'),false);assert.equal(Object.hasOwn(one,'gains'),false);
});

test('manual financial revision on an attributed intent remains unverified without a matching receipt',async t=>{
 const f=fixture(t);await f.runtime.start();const {clientOrderId:id}=await f.runtime.tick();f.clock.now+=100;
 const old=f.ledger.operation(id),time=new Date(f.clock.now).toISOString();
 f.ledger.saveOperation({...old,state:'closed',updatedAt:time,closedAt:time,exitQuantity:old.entryQuantity,exitPrice:old.entryPrice,gross:'10',fees:'0',financing:'0',costsComplete:true},{now:f.clock.now});
 const record=latest(f,id);assert.equal(record.result.status,'unverified_snapshot');assert.equal(record.evidence.receiptRecorded,false);assert.equal(record.result.afterBrokerCosts,null);
});

test('unexpected context fields, credentials, native claims and invalid pagination fail before export',t=>{
 const f=fixture(t);
 for(const change of [{apiKey:'not-a-key'},{evidenceMode:'native'},{strategy:{...f.context.strategy,secret:'not-a-secret'}}])assert.throws(()=>new AttributedExecutionLedgerR127(':memory:',f.binding,{...f.context,...change}));
 for(const limit of [0,1001,1.5])assert.throws(()=>f.ledger.recordBatch({limit,now:f.clock.now}),/INVALID_PAGE/);
 assert.throws(()=>f.ledger.recordBatch({cursor:{feedId:f.ledger.recordFeedId,sequence:1},now:f.clock.now}),/CURSOR_AHEAD_OF_JOURNAL/);
});
