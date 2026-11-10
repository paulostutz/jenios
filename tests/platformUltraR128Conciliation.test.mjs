import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {digest} from '../lib/platform/ultra/client/journal.mjs';
import {AttributedExecutionLedgerR127} from '../lib/platform/ultra/client/operation-records-r127.mjs';
import {OfflineFixtureBrokerR127} from '../lib/platform/ultra/client/runtime-fixture-r127.mjs';
import {DurableUltraRuntimeR128} from '../lib/platform/ultra/client/session-runtime-r128.mjs';
import {qualifyScenarioR128,scenariosR128} from '../scripts/platform/ultra/qualify-r128.mjs';

function fixture(t,{market='crypto',provider='binance',product='spot',currency='USDT',symbol='FIXTUREUSDT'}={}){
 const directory=mkdtempSync(join(tmpdir(),'r128-')),path=join(directory,'journal.sqlite'),clock={now:Date.parse('2026-11-10T15:00:00Z')};
 const binding={account:'fictional-r128',environment:'demo',provider};
 const config={markets:[{id:market,provider,currency,capital:1000,leverage:20}],sessionMinutes:2,maxPositions:1,tradeRiskPct:.25,dailyLossPct:2,maxAssetPct:20,excludedSymbols:[]};
 const context={sourcePlatform:'jenios',ownerScope:'owner-1',connectionId:'connection-1',sessionId:'session-1',strategy:{id:'ultrafast-r18-r53',version:'R113-R125',configDigest:digest(config)},product:product==='b3_mini'?'b3':product,evidenceMode:'offline_fixture'};
 const ledgers=[];const reopen=(ctx=context)=>{const l=new AttributedExecutionLedgerR127(path,binding,ctx);ledgers.push(l);return l;};
 const ledger=reopen(),scope={provider,environment:'demo',product,accountFingerprint:ledger.binding};
 const adapter=new OfflineFixtureBrokerR127({binding:ledger.binding,market,currency,symbol,scope,now:()=>clock.now});
 const options={config,market,ledger,adapter,scope,now:()=>clock.now,onWarning:async()=>true,ownerScope:context.ownerScope,connectionScope:context.connectionId,sessionId:context.sessionId};
 const runtime=new DurableUltraRuntimeR128(options);
 t.after(()=>{for(const l of ledgers){try{l.close();}catch{}}rmSync(directory,{recursive:true,force:true});});
 return {directory,path,clock,binding,config,context,ledger,scope,adapter,options,runtime,reopen};
}
for(const scenario of scenariosR128)test(`R128 composes both checkpoints: ${scenario.id}`,async t=>{
 const dir=mkdtempSync(join(tmpdir(),'r128-integration-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const result=await qualifyScenarioR128(dir,scenario);assert.equal(result.fixtureSubmissions,1);assert.equal(result.realOrdersSent,0);assert.equal(result.nativeValidated,false);
});
for(const route of [{market:'crypto',provider:'binance',product:'spot'}, {market:'crypto',provider:'binance',product:'usds_m_futures'}, {market:'b3',provider:'profit',product:'b3_mini',currency:'BRL',symbol:'WINZ99'}, {market:'b3',provider:'mt5',product:'b3_mini',currency:'BRL',symbol:'WDOZ99'}])test(`R128 route scope and attribution ${route.provider}/${route.product}`,async t=>{
 const f=fixture(t,route);await f.runtime.start();const result=await f.runtime.tick();assert.equal(result.state,'open');
 const records=f.ledger.recordBatch({now:f.clock.now}).records;assert.ok(records.length);assert.equal(records.at(-1).origin.sessionId,'session-1');assert.equal(records.at(-1).origin.strategy.configDigest,digest(f.config));
 assert.equal(f.runtime.readiness().status,'locally_reconciled');assert.equal(f.runtime.session().billingEnabled,false);
 if(route.market==='b3')assert.match(f.ledger.operation(result.clientOrderId).requestedQuantity,/^\d+$/);
});
for(const patch of [{sessionId:'wrong'},{ownerScope:'wrong'},{connectionScope:'wrong'},{config:null}])test(`R128 rejects mismatched attribution ${Object.keys(patch)[0]}`,t=>{
 const f=fixture(t);const changes=patch.config===null?{config:{...f.config,sessionMinutes:10}}:patch;
 assert.throws(()=>new DurableUltraRuntimeR128({...f.options,...changes}),/SESSION_RECORD_ATTRIBUTION_MISMATCH/);assert.equal(f.adapter.submissions,0);
});
test('R128 new session requires new record context and preserves historic origin',async t=>{
 const f=fixture(t);await f.runtime.start();const first=await f.runtime.tick();await f.runtime.closePositions();await f.runtime.finish();
 assert.throws(()=>new DurableUltraRuntimeR128({...f.options,sessionId:'session-2'}),/ATTRIBUTION_MISMATCH/);
 f.ledger.close();f.clock.now+=100;const ledger=f.reopen({...f.context,sessionId:'session-2'});
 const next=new DurableUltraRuntimeR128({...f.options,ledger,sessionId:'session-2'});await next.start({recover:true});await next.tick();
 const records=ledger.recordBatch({now:f.clock.now}).records;
 assert.equal(records.find(r=>r.operation.id===first.clientOrderId).origin.sessionId,'session-1');assert.equal(records.at(-1).origin.sessionId,'session-2');
 f.adapter.completeCosts(first.clientOrderId);await next.reconcile();const late=ledger.recordBatch({now:f.clock.now}).records.filter(r=>r.operation.id===first.clientOrderId).at(-1);
 assert.equal(late.origin.sessionId,'session-1');assert.equal(late.result.status,'closed_complete');assert.equal(late.financialActivationAllowed,false);
});
test('R128 pause and restart retain original expiry and need explicit resume',async t=>{
 const f=fixture(t);await f.runtime.start();const expiry=f.runtime.session().expiresAtMs;f.runtime.pause();f.ledger.close();f.clock.now+=30000;
 const ledger=f.reopen(),next=new DurableUltraRuntimeR128({...f.options,ledger});assert.equal((await next.start()).resumeRequired,true);
 await assert.rejects(()=>next.tick(),/SESSION_RESUME_REQUIRED/);await next.resume({recover:true});assert.equal(next.session().expiresAtMs,expiry);
 f.clock.now=expiry;assert.equal((await next.tick()).session.phase,'expired');assert.equal(f.adapter.submissions,0);
});
test('R128 finish drains exposure; trading permission removal still allows reduction',async t=>{
 const f=fixture(t);await f.runtime.start();await f.runtime.tick();assert.equal((await f.runtime.finish()).phase,'draining');f.adapter.tradingAllowed=false;
 assert.equal((await f.runtime.closePositions()).state,'confirmed');assert.equal((await f.runtime.finish()).phase,'ended');assert.equal(f.adapter.submissions,1);
});
for(const flag of ['streamSynchronized','ordersComplete','positionsComplete','fillsComplete'])test(`R128 restart requires ${flag}`,async t=>{
 const f=fixture(t);await f.runtime.start();const expiry=f.runtime.session().expiresAtMs;f.runtime.pause();f.adapter[flag]=false;
 await assert.rejects(()=>f.runtime.resume(),/ACCOUNT_RECONCILIATION_REQUIRED/);assert.equal(f.runtime.session().phase,'paused');assert.equal(f.runtime.session().expiresAtMs,expiry);assert.equal(f.adapter.submissions,0);
});
test('R128 full product identity cannot reuse the durable session',async t=>{
 const f=fixture(t);await f.runtime.start();assert.throws(()=>new DurableUltraRuntimeR128({...f.options,scope:{...f.scope,product:'usds_m_futures'}}),/ATTRIBUTION_MISMATCH|PERSISTED_SCOPE/);
 assert.throws(()=>{f.runtime.sessionId='modified';},TypeError);assert.throws(()=>{f.runtime.sessionConfig='modified';},TypeError);
});
test('R128 persisted R127 session is not silently upgraded',t=>{
 const f=fixture(t);f.ledger.saveTransport(f.runtime.sessionKey,{schema:'JENIOS_ULTRA_DURABLE_SESSION_R127'});
 assert.throws(()=>new DurableUltraRuntimeR128(f.options),/SESSION_CHECKPOINT_REQUIRES_FINISH/);
});
test('R128 stale controller cannot pause or overwrite operational readiness',async t=>{
 const f=fixture(t);await f.runtime.start();const next=new DurableUltraRuntimeR128(f.options);await next.resume();const readiness=f.ledger.transport('ultra_runtime_readiness_r127');
 f.runtime.guard.block('obsolete');assert.deepEqual(f.ledger.transport('ultra_runtime_readiness_r127'),readiness);assert.equal(f.ledger.paused(),false);
 await assert.rejects(()=>f.runtime.guard.capture(),/CONTROLLER_SUPERSEDED/);assert.equal(next.session().phase,'active');assert.equal(f.runtime.readiness().status,'needs_reconciliation');assert.equal(next.readiness().status,'locally_reconciled');
});
for(const method of ['runtimeState','account','preflight','submitProtected','lookup','closeOwned'])test(`R128 fences supersession across ${method} await`,async t=>{
 const f=fixture(t);await f.runtime.start();let order;
 if(['lookup','closeOwned'].includes(method))order=await f.runtime.tick();
 let release,entered;const gate=new Promise(r=>{release=r;}),waiting=new Promise(r=>{entered=r;});const original=f.adapter[method].bind(f.adapter);
 f.adapter[method]=async(...args)=>{const result=await original(...args);entered();await gate;return result;};
 const action=method==='lookup'?f.runtime.reconcile():method==='closeOwned'?f.runtime.closePositions():f.runtime.tick();
 await waiting;
 // Simulates a controller adopted by another process while this await is pending.
 const old=f.ledger.transport(f.runtime.sessionKey);f.ledger.saveTransport(f.runtime.sessionKey,{...old,controllerId:'new-controller'});
 const readiness=f.ledger.transport('ultra_runtime_readiness_r127'),receipts=f.ledger.db.prepare('SELECT count(*) AS n FROM ultra_execution_receipts').get().n;
 release();await assert.rejects(action,/CONTROLLER_SUPERSEDED/);
 assert.equal(f.ledger.transport(f.runtime.sessionKey).controllerId,'new-controller');assert.deepEqual(f.ledger.transport('ultra_runtime_readiness_r127'),readiness);
 assert.equal(f.ledger.db.prepare('SELECT count(*) AS n FROM ultra_execution_receipts').get().n,receipts);assert.equal(f.ledger.paused(),method==='closeOwned');
 if(!['submitProtected','lookup','closeOwned'].includes(method))assert.equal(f.adapter.submissions,0);
});
for(const mode of ['expiry','pause'])test(`R128 ${mode} inside final runtime-state await prevents raw dispatch`,async t=>{
 const f=fixture(t);await f.runtime.start();let afterPreflight=false,count=0;
 const preflight=f.adapter.preflight.bind(f.adapter);f.adapter.preflight=async request=>{const result=await preflight(request);afterPreflight=true;return result;};
 const state=f.adapter.runtimeState.bind(f.adapter);f.adapter.runtimeState=async()=>{
  if(afterPreflight&&++count===2){if(mode==='expiry')f.clock.now=f.runtime.session().expiresAtMs;else f.runtime.pause();}
  return state();
 };
 const result=await f.runtime.tick();assert.equal(result.state,'reconciliation_required');assert.equal(f.adapter.submissions,0);assert.equal(f.ledger.paused(),true);
 if(mode==='expiry')assert.equal(result.session.phase,'expired');
});
test('R128 guard clock observations survive rollback and block dispatch',async t=>{
 const f=fixture(t);await f.runtime.start();f.clock.now+=1000;await f.runtime.guard.capture();assert.equal(f.runtime.session().lastObservedAtMs,f.clock.now);f.clock.now--;
 await assert.rejects(()=>f.runtime.tick(),/SESSION_CLOCK_REGRESSED/);assert.equal(f.ledger.paused(),true);assert.equal(f.adapter.submissions,0);
});
test('R128 generation changes during preflight never dispatch an opening',async t=>{
 const f=fixture(t);await f.runtime.start();const original=f.adapter.preflight.bind(f.adapter);f.adapter.preflight=async request=>{const result=await original(request);f.adapter.generation='changed-generation';return result;};
 await assert.rejects(()=>f.runtime.tick(),/RUNTIME_STATE_CHANGED/);assert.equal(f.adapter.submissions,0);assert.equal(f.runtime.session().phase,'paused');
});
test('R128 receipt after lease takeover is recovered once without resend',async t=>{
 const f=fixture(t);await f.runtime.start();const expiry=f.runtime.session().expiresAtMs;
 let release,entered;const gate=new Promise(r=>{release=r;}),waiting=new Promise(r=>{entered=r;});const original=f.adapter.submitProtected.bind(f.adapter);
 f.adapter.submitProtected=async(...args)=>{const receipt=await original(...args);entered();await gate;return receipt;};
 const pending=f.runtime.tick();await waiting;f.clock.now+=60001;
 const ledger=f.reopen(),next=new DurableUltraRuntimeR128({...f.options,ledger});await next.resume({recover:true});
 const receiptCount=ledger.db.prepare('SELECT count(*) AS n FROM ultra_execution_receipts').get().n;release();await assert.rejects(pending,/RUNNER_LEASE_LOST/);
 assert.equal(ledger.db.prepare('SELECT count(*) AS n FROM ultra_execution_receipts').get().n,receiptCount);assert.equal(ledger.operations()[0].state,'open');
 assert.equal(f.adapter.submissions,1);assert.equal(next.session().expiresAtMs,expiry);assert.equal(next.session().phase,'active');assert.equal(ledger.paused(),false);
});
test('R128 rollback inside account guard fails closed before any dispatch',async t=>{
 const f=fixture(t);await f.runtime.start();f.clock.now+=100;const original=f.adapter.account.bind(f.adapter);
 f.adapter.account=async()=>{const result=await original();f.clock.now-=1;return result;};
 await assert.rejects(()=>f.runtime.tick(),/SESSION_CLOCK_REGRESSED/);assert.equal(f.adapter.submissions,0);assert.equal(f.ledger.paused(),true);
});
test('R128 pause during startup wins and no real adapter can be substituted',async t=>{
 const f=fixture(t);const original=f.adapter.inspect.bind(f.adapter);f.adapter.inspect=async()=>{f.runtime.pause();return original();};
 assert.equal((await f.runtime.start()).session.phase,'paused');assert.equal(f.adapter.submissions,0);
 assert.throws(()=>new DurableUltraRuntimeR128({...f.options,adapter:{...f.adapter,executionEnvironment:'live'}}),/OFFLINE_RUNTIME_STATE_REQUIRED/);
});
