import test from 'node:test';
import assert from 'node:assert/strict';
import {AttributedExecutionLedgerR127} from '../lib/platform/ultra/client/operation-records-r127.mjs';
import {UltraExecutionRuntime} from '../lib/platform/ultra/client/execution-runtime.mjs';
import {OfflineFixtureBroker,quantityText} from '../lib/platform/ultra/client/fixture-broker.mjs';
import {digest} from '../lib/platform/ultra/client/journal.mjs';
import {initialOperation,operationNet,units12} from '../lib/platform/ultra/operation.mjs';
import {ingestRecordBatchesR129,monthlyRecordsReportR129} from '../lib/platform/ultra/client/records-monthly-r129.mjs';

const start=Date.parse('2026-10-15T12:00:00Z'),now=Date.parse('2026-11-10T15:00:00Z');
const fixtureBinding={registrationId:'registration-fixture-1',clientId:'client-fixture-1',ownerScope:'owner-fixture-1',evidenceMode:'offline_fixture'};
const copy=value=>JSON.parse(JSON.stringify(value));
const ingest=(pages,state=null,registered=fixtureBinding)=>ingestRecordBatchesR129(state,pages,{fixtureBinding:registered,now});
const report=state=>monthlyRecordsReportR129(state,{month:'2026-10',now});
const codes=value=>value.pendingReasons.map(reason=>reason.code);
function fixture(t,{account='account-fixture-1',connectionId='connection-fixture-1',ownerScope=fixtureBinding.ownerScope,provider='binance',product='spot',currency=provider==='binance'?'USDT':'BRL',entry='full',sourcePlatform='jenios',strategyId='existing-strategy',at=start}={}){
 const market=provider==='binance'?'crypto':'b3',clock={now:at};
 const config={markets:[{id:market,currency,capital:1000,leverage:1}],sessionMinutes:60,maxPositions:3,tradeRiskPct:.25,dailyLossPct:2,maxAssetPct:20,excludedSymbols:[]};
 const context={sourcePlatform,connectionId,ownerScope,sessionId:'session-fixture-1',strategy:{id:strategyId,version:'R18-R53',configDigest:digest(config)},product,evidenceMode:'offline_fixture'};
 const ledger=new AttributedExecutionLedgerR127(':memory:',{account,environment:'demo',provider},context);
 const adapter=new OfflineFixtureBroker({binding:ledger.binding,market,currency,entry,now:()=>clock.now});
 const runtime=new UltraExecutionRuntime({config,market,ledger,adapter,now:()=>clock.now,onWarning:async()=>true});
 t.after(()=>ledger.close());return {ledger,adapter,runtime,clock,context};
}
function page(f,fromCursor=null,limit=1000){return {fromCursor,batch:f.ledger.recordBatch({cursor:fromCursor,limit,now})};}
async function open(f){await f.runtime.start();return (await f.runtime.tick()).clientOrderId;}
async function close(f,id,{costs=true}={}){
 const operation=f.ledger.operation(id);f.clock.now+=100;
 if(units12(operation.entryQuantity)<units12(operation.requestedQuantity))await f.runtime.cancel(id);
 f.clock.now+=100;await f.runtime.close(id,quantityText(units12(operation.entryQuantity)-units12(operation.exitQuantity)));
 if(costs){f.clock.now+=100;f.adapter.completeCosts(id);await f.runtime.reconcile();}
}
function rehash(record){const {recordDigest,...payload}=record;return {...payload,recordDigest:digest(payload)};}

test('R129 partial executions and late costs replace one operation while retaining every revision',async t=>{
 const f=fixture(t,{entry:'partial'}),id=await open(f);
 f.clock.now+=100;await f.runtime.cancel(id);
 f.clock.now+=100;await f.runtime.close(id,quantityText(units12(f.ledger.operation(id).entryQuantity)/2n));
 const partial=ingest([page(f)]),partialReport=report(partial);
 assert.ok(codes(partialReport).includes('PARTIAL_ALLOCATION_PENDING'));
 assert.equal(partialReport.groups[0].monthly.confirmed.net,null);
 await close(f,id,{costs:false});
 const pending=ingest([page(f,partial.feeds[0].nextCursor)],partial),pendingReport=report(pending);
 assert.equal(pendingReport.groups[0].monthly.counts.closed,0);
 assert.equal(pendingReport.groups[0].monthly.counts.awaitingCosts,1);
 assert.equal(pendingReport.groups[0].monthly.provisional.financing,null);
 f.clock.now=Date.parse('2026-11-02T12:00:00Z');f.adapter.completeCosts(id);await f.runtime.reconcile();
 const final=ingest([page(f,pending.feeds[0].nextCursor)],pending),result=report(final),group=result.groups[0];
 assert.equal(group.monthly.counts.closed,1);assert.equal(group.monthly.counts.conflicts,0);
 assert.equal(group.records.length,1);assert.equal(group.records[0].operation.id,id);
 assert.equal(group.history.length,final.eventCount);assert.ok(group.history.length>5);
 assert.equal(group.monthly.confirmed.net,operationNet(f.ledger.operation(id)));
 assert.equal(group.monthly.confirmed.financing,'-0.00200000');
 assert.equal(group.records[0].origin.strategy.id,'existing-strategy');
 assert.equal(group.records[0].origin.sessionId,'session-fixture-1');
 assert.equal(group.fillDetail.individualFills,null);assert.ok(codes(group).includes('FILL_DETAIL_PENDING'));
 assert.equal(result.financialActivationAllowed,false);assert.equal(result.billable,false);
 assert.equal(result.sources[0].report.accountFingerprint,undefined);
 assert.equal(group.monthly.accountFingerprint,null);
});

test('R129 replay after JSON restart or a newer revision is stable and cannot roll back results',async t=>{
 const f=fixture(t,{sourcePlatform:'flow'}),id=await open(f),firstPage=page(f),first=ingest([firstPage]);
 await close(f,id);const nextPage=page(f,first.feeds[0].nextCursor),next=ingest([nextPage],copy(first));
 assert.deepEqual(ingest([firstPage,nextPage],copy(next)),next);
 assert.equal(next.operationCount,1);
 const result=report(next);
 assert.equal(result.groups[0].records[0].origin.sourcePlatform,'flow');
 assert.equal(result.sources[0].platform,'flow');
 assert.equal(JSON.stringify(result).includes('account-fixture-1'),false);
 assert.equal(report(copy(next)).reportDigest,result.reportDigest);
});

test('R129 validates all pages before returning a cursor and refuses gaps or conflicting replay',async t=>{
 const f=fixture(t),id=await open(f),firstPage=page(f),state=ingest([firstPage]),before=JSON.stringify(state);
 await close(f,id);const nextPage=page(f,state.feeds[0].nextCursor);
 const invalid=copy(page(f));invalid.batch.records[0].result.currency='BRL';
 assert.throws(()=>ingest([nextPage,invalid],state),/RECORD_DIGEST_MISMATCH/);
 assert.equal(JSON.stringify(state),before);assert.equal(state.operationCount,1);
 assert.throws(()=>ingest([nextPage]),/CURSOR_GAP_OR_OVERLAP/);
 const changed=copy(firstPage);changed.batch.records[0].origin.strategy.version='different-version';
 changed.batch.records[0]=rehash(changed.batch.records[0]);
 assert.throws(()=>ingest([changed],state),/REPLAY_CONFLICT/);
 const omitted=copy(nextPage);omitted.batch.records.shift();
 assert.throws(()=>ingest([omitted],state),/PAGE_RANGE_MISMATCH/);
});

test('R129 rejects another owner, changed client registration and live or native claims',async t=>{
 const f=fixture(t),other=fixture(t,{account:'other-account',ownerScope:'other-owner'});
 await open(f);await open(other);const first=page(f),state=ingest([first]);
 assert.throws(()=>ingest([page(other)],state),/SCOPE_MISMATCH/);
 for(const patch of [{clientId:'other-client'},{ownerScope:'other-owner'},{registrationId:'other-registration'}]){
  assert.throws(()=>ingest([],state,{...fixtureBinding,...patch}),/CLIENT_REGISTRATION_CHANGED/);
 }
 assert.throws(()=>ingest([],null,{...fixtureBinding,evidenceMode:'native'}),/FIXTURE_REGISTRATION_REQUIRED/);
 const live=copy(first);live.batch.scope.environment='live';assert.throws(()=>ingest([live]),/SCOPE_MISMATCH/);
 const native=copy(first);native.batch.nativeValidated=true;assert.throws(()=>ingest([native]),/INVALID_BATCH/);
 const missingOrigin=copy(first);missingOrigin.batch.records[0].origin=null;
 missingOrigin.batch.records[0]=rehash(missingOrigin.batch.records[0]);
 assert.throws(()=>ingest([missingOrigin]),/ATTRIBUTION_REQUIRED/);
});

test('R129 unattributed-only pages advance once but remain explicit pending without a fabricated balance',async t=>{
 const f=fixture(t);
 f.ledger.saveOperation(initialOperation({market:'crypto',symbol:'MANUAL',currency:'USDT',side:'buy',quantity:'1'},'manual-operation',start),{now:start});
 const excluded=page(f),state=ingest([excluded]),result=report(state);
 assert.equal(state.feeds[0].nextCursor.sequence,1);assert.equal(state.eventCount,0);
 assert.equal(result.excludedUnattributedCount,1);assert.deepEqual(result.groups,[]);
 assert.equal(result.observedScopes.length,1);assert.equal(result.observedAccountKeys.length,1);
 assert.equal(result.walletBalance,null);assert.equal(result.finalNet,null);
 assert.ok(codes(result).includes('UNATTRIBUTED_RECORDS_EXCLUDED'));
 assert.ok(result.globalPendingReasons.some(reason=>reason.code==='UNATTRIBUTED_RECORDS_EXCLUDED'));
 assert.deepEqual(ingest([excluded],state),state);
});

test('R129 a closed revision without its receipt preserves the original but contributes no confirmed money',async t=>{
 const f=fixture(t),id=await open(f);f.clock.now+=100;
 const original=f.ledger.operation(id),timestamp=new Date(f.clock.now).toISOString();
 f.ledger.saveOperation({...original,state:'closed',updatedAt:timestamp,closedAt:timestamp,exitQuantity:original.entryQuantity,exitPrice:original.entryPrice,gross:'10',fees:'0',financing:'0',costsComplete:true},{now:f.clock.now});
 const state=ingest([page(f)]),before=JSON.stringify(state),result=report(state),group=result.groups[0];
 assert.equal(group.records[0].result.status,'unverified_snapshot');
 assert.equal(group.records[0].operation.gross,'10');assert.equal(group.records[0].operation.costsComplete,true);
 assert.equal(group.monthly.counts.closed,0);assert.equal(group.monthly.confirmed.net,null);
 assert.equal(group.monthly.provisional.net,null);assert.equal(result.sources[0].report.operations[0].gross,null);
 assert.equal(result.sources[0].report.operations[0].costsComplete,false);
 assert.equal(group.projectionAdjustments[0].reason,'EXECUTION_EVIDENCE_PENDING');
 assert.ok(codes(group).includes('EXECUTION_EVIDENCE_PENDING'));
 assert.equal(JSON.stringify(state),before);
});

test('R129 preserves several accounts, products, strategies and currencies under one fixture client',async t=>{
 const fixtures=[fixture(t),fixture(t,{account:'account-fixture-2',currency:'BRL',strategyId:'second-strategy'}),fixture(t,{product:'usds_m_futures'}),fixture(t,{account:'b3-fixture',provider:'profit',product:'b3'})];
 for(const f of fixtures){const id=await open(f);await close(f,id);}
 const first=fixtures[0];
 first.ledger.resume();
 first.ledger.prepare({market:'crypto',symbol:'QUEUEDUSD',currency:'USD',side:'buy',quantity:'1'},first.clock.now);
 const empty=fixture(t,{account:'empty-account'});
 const result=report(ingest([...fixtures.map(f=>page(f)),page(empty)]));
 assert.equal(result.observedScopes.length,5);assert.equal(result.observedAccountKeys.length,5);
 assert.equal(result.groups.length,5);assert.equal(result.view.groups.length,5);
 assert.deepEqual([...new Set(result.groups.map(group=>group.scope.product))].sort(),['b3','spot','usds_m_futures']);
 assert.deepEqual([...new Set(result.groups.map(group=>group.scope.currency))].sort(),['BRL','USD','USDT']);
 assert.ok(result.groups.some(group=>group.scope.strategies.some(strategy=>strategy.id==='second-strategy')));
 assert.ok(result.groups.every(group=>group.scope.clientId===fixtureBinding.clientId&&group.scope.ownerScope===fixtureBinding.ownerScope));
 assert.ok(result.observedAccountKeys.every(key=>JSON.parse(key)[2].startsWith('unverified:r129_')));
 assert.ok(result.sources.every(source=>!Object.hasOwn(source.report,'accountFingerprint')));
 assert.equal(result.finalNet,null);assert.equal(Object.hasOwn(result,'total'),false);
 assert.ok(result.observedScopes.some(observation=>observation.currencies.length===0));
});

test('R129 forwards reference conflicts to UM001 instead of counting separate connections twice',async t=>{
 const a=fixture(t,{connectionId:'connection-a'}),b=fixture(t,{connectionId:'connection-b'});
 for(const f of [a,b]){const id=await open(f);await close(f,id);}
 const result=report(ingest([page(a),page(b)])),group=result.groups[0];
 assert.equal(result.observedAccountKeys.length,1);assert.equal(result.observedScopes.length,2);
 assert.equal(group.records.length,2);assert.equal(group.monthly.counts.conflicts,2);
 assert.equal(group.monthly.confirmed.net,null);assert.ok(codes(group).includes('DUPLICATE_CONFLICT'));
 assert.equal(group.scope.connectionIds.length,2);
});

test('R129 pending USDT costs remain scoped while global import incompleteness remains visible',async t=>{
 const a=fixture(t),b=fixture(t,{account:'brl-fixture',currency:'BRL'});
 const aId=await open(a);await close(a,aId,{costs:false});
 const bId=await open(b);await close(b,bId);
 const result=report(ingest([page(a),page(b)])),usdt=result.groups.find(group=>group.scope.currency==='USDT'),brl=result.groups.find(group=>group.scope.currency==='BRL');
 assert.ok(codes(result).includes('COSTS_PENDING'));assert.ok(codes(usdt).includes('COSTS_PENDING'));
 assert.equal(codes(brl).includes('COSTS_PENDING'),false);
 assert.equal(result.globalPendingReasons.some(reason=>reason.code==='COSTS_PENDING'),false);
 const limited=report(ingest([page(a,null,1)]));
 assert.ok(limited.globalPendingReasons.some(reason=>reason.code==='MORE_LOCAL_RECORDS_PENDING'));
 assert.equal(limited.sourceComplete,false);
});

test('R129 uncertain execution remains pending and receipt or state mutations cannot upgrade evidence',async t=>{
 const f=fixture(t);f.adapter.failAfterSubmit=true;await open(f);
 const first=page(f),state=ingest([first]),result=report(state);
 assert.ok(codes(result).includes('EXECUTION_UNCERTAIN'));
 assert.equal(result.groups[0].monthly.confirmed.net,null);
 const changed=copy(first);changed.batch.records.at(-1).evidence.nativeValidated=true;
 changed.batch.records[changed.batch.records.length-1]=rehash(changed.batch.records.at(-1));
 assert.throws(()=>ingest([changed]),/INVALID_EVIDENCE/);
 const editedState=copy(state);editedState.feeds[0].nextCursor.sequence++;
 const {stateDigest,...payload}=editedState;editedState.stateDigest=digest(payload);
 assert.throws(()=>report(editedState),/STATE_CONTENT_MISMATCH/);
 const mutable=copy(state);report(mutable);
 assert.equal(Object.isFrozen(mutable.pages[0].batch.records[0]),false);
});

test('R129 refuses missing initial or intermediate revisions even when each local digest is consistent',async t=>{
 const f=fixture(t);await open(f);
 const first=page(f,null,1),state=ingest([first]),second=page(f,first.batch.nextCursor,1);
 const skipped=copy(second),record=skipped.batch.records[0];
 record.operation.revision++;record.eventId=digest({operationKey:record.operationKey,revision:record.operation.revision});
 skipped.batch.records[0]=rehash(record);
 assert.throws(()=>ingest([skipped],state),/REVISION_GAP/);
 assert.equal(state.feeds[0].nextCursor.sequence,1);
 const missing=copy(first),initial=missing.batch.records[0];
 initial.operation.revision=2;initial.eventId=digest({operationKey:initial.operationKey,revision:2});
 missing.batch.records[0]=rehash(initial);
 assert.throws(()=>ingest([missing]),/INITIAL_REVISION_MISSING/);
});

test('R129 preserves the Bahia boundary and later closure without inventing a prior-month position',async t=>{
 const before=fixture(t,{at:Date.parse('2026-11-01T02:59:58.900Z')}),after=fixture(t,{account:'after-boundary',at:Date.parse('2026-11-01T02:59:59.800Z')});
 for(const f of [before,after]){const id=await open(f);await close(f,id);}
 const result=report(ingest([page(before),page(after)]));
 assert.equal(result.periodEnd,'2026-11-01T03:00:00.000Z');
 assert.equal(result.groups.reduce((sum,group)=>sum+group.monthly.counts.closed,0),1);
 const carried=result.groups.find(group=>group.monthly.operations[0].classification==='open_at_period_end');
 assert.ok(carried);assert.equal(carried.monthly.operations[0].gross,null);
 assert.equal(carried.records[0].operation.state,'closed');
 assert.notEqual(carried.records[0].operation.gross,null);
 assert.ok(codes(carried).includes('HISTORICAL_POSITION_PENDING'));
 const stale=copy(page(before));stale.batch.generatedAt='2026-11-01T02:59:59.500Z';
 const staleReport=report(ingest([stale]));
 assert.ok(staleReport.globalPendingReasons.some(reason=>reason.code==='SOURCE_CUTOFF_PENDING'));
});
