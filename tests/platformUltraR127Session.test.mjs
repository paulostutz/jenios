import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {ExecutionLedger} from '../lib/platform/ultra/client/execution-ledger.mjs';
import {OfflineFixtureBroker} from '../lib/platform/ultra/client/fixture-broker.mjs';
import {DurableUltraRuntimeR127} from '../lib/platform/ultra/client/session-runtime-r127.mjs';

function fixture(t,{market='crypto',provider='binance',currency='USDT',config:changes={},...extra}={}){
 const directory=mkdtempSync(join(tmpdir(),'r127-session-')),path=join(directory,'fixture.sqlite');
 const binding={provider,environment:'demo',account:'FIXTURE_ONLY_R127'};
 const clock={now:Date.parse('2026-11-10T22:00:00Z')};
 const ledger=new ExecutionLedger(path,binding);let closed=false;
 const adapter=new OfflineFixtureBroker({binding:ledger.binding,market,currency,symbol:'FIXTURE_ONLY',now:()=>clock.now});
 const config={markets:[{id:market,currency,capital:1000,leverage:1}],sessionMinutes:2,maxPositions:1,tradeRiskPct:.25,dailyLossPct:2,maxAssetPct:20,excludedSymbols:[],...changes};
 const options={sessionId:'session-1',ownerScope:'fixture-owner',connectionScope:'fixture-account',config,market,ledger,adapter,now:()=>clock.now,onWarning:async()=>true,...extra};
 const runtime=new DurableUltraRuntimeR127(options);
 t.after(()=>{if(!closed)ledger.close();rmSync(directory,{recursive:true,force:true});});
 return {directory,path,binding,clock,ledger,adapter,config,options,runtime,close:()=>{ledger.close();closed=true;}};
}
test('R127 persists a single Start and repeated Start never extends the duration',async t=>{
 const f=fixture(t);const first=await f.runtime.start();assert.equal(first.created,true);assert.equal(first.session.phase,'active');
 const deadline=first.session.expiresAtMs;f.clock.now+=30000;const again=await f.runtime.start();assert.equal(again.created,false);assert.equal(again.session.expiresAtMs,deadline);
 assert.equal(f.ledger.db.prepare("SELECT count(*) AS n FROM ultra_transport WHERE id LIKE 'ultra_r127_session:%'").get().n,1);
 assert.equal(f.adapter.submissions,0);for(const flag of ['liveExecutionEnabled','externalPaperEnabled','nativeValidated','billingEnabled'])assert.equal(again.session[flag],false);
});
test('R127 pause and explicit resume preserve session identity and original expiry',async t=>{
 const f=fixture(t);await f.runtime.start();const expiry=f.runtime.session().expiresAtMs;f.clock.now+=20000;f.runtime.pause();
 assert.equal((await f.runtime.start()).session.phase,'paused');assert.equal(f.ledger.paused(),true);
 f.clock.now+=10000;const resumed=await f.runtime.resume();assert.equal(resumed.session.phase,'active');assert.equal(resumed.created,false);assert.equal(resumed.session.expiresAtMs,expiry);
});
test('R127 clean restart requires explicit resume and does not reset its deadline',async t=>{
 const f=fixture(t);await f.runtime.start();const expiry=f.runtime.session().expiresAtMs;f.close();f.clock.now+=30000;
 const ledger=new ExecutionLedger(f.path,f.binding);t.after(()=>ledger.close());const runtime=new DurableUltraRuntimeR127({...f.options,ledger});
 const retry=await runtime.start();assert.equal(retry.created,false);assert.equal(retry.resumeRequired,true);await assert.rejects(()=>runtime.tick(),/SESSION_RESUME_REQUIRED/);
 await runtime.resume({recover:true});assert.equal(runtime.deadline,expiry);assert.equal(runtime.session().expiresAtMs,expiry);
});
test('R127 expiry pauses new entries without pretending an open position closed',async t=>{
 const f=fixture(t);await f.runtime.start();const entry=await f.runtime.tick();assert.equal(entry.state,'open');
 f.clock.now=f.runtime.session().expiresAtMs;const result=await f.runtime.tick();assert.equal(result.state,'paused');assert.equal(result.session.phase,'expired');
 assert.equal(f.ledger.operation(entry.clientOrderId).state,'open');assert.equal(result.session.openOrUncertainOperations,1);assert.equal(f.adapter.submissions,1);
 await f.runtime.resume();assert.equal(f.runtime.session().phase,'expired');await f.runtime.tick();assert.equal(f.adapter.submissions,1);
});
test('R127 second session is refused while the first is active or exposure remains',async t=>{
 const f=fixture(t);await f.runtime.start();const next=new DurableUltraRuntimeR127({...f.options,sessionId:'session-2'});
 await assert.rejects(()=>next.start(),/ANOTHER_SESSION_REQUIRES_FINISH/);assert.equal(f.runtime.session().phase,'active');
 await f.runtime.tick();f.clock.now=f.runtime.session().expiresAtMs;await f.runtime.tick();await assert.rejects(()=>next.start(),/SESSION_EXPOSURE_RECONCILIATION_REQUIRED/);
});
test('R127 finishing with exposure enters draining; a flat session can finish',async t=>{
 const f=fixture(t);await f.runtime.start();await f.runtime.tick();const draining=await f.runtime.finish();assert.equal(draining.phase,'draining');assert.equal(draining.finishedAtMs,null);
 assert.equal(draining.openOrUncertainOperations,1);const close=await f.runtime.closePositions();assert.equal(close.state,'confirmed');
 const ended=await f.runtime.finish();assert.equal(ended.phase,'ended');assert.equal(ended.openOrUncertainOperations,0);assert.ok(ended.finishedAtMs);
 await assert.rejects(()=>f.runtime.resume(),/SESSION_ALREADY_ENDED/);
});
test('R127 new session after flat finish has a new deadline; stale controls cannot pause it',async t=>{
 const f=fixture(t);await f.runtime.start();await f.runtime.finish();f.clock.now+=10000;
 const next=new DurableUltraRuntimeR127({...f.options,sessionId:'session-2'});await next.start();assert.equal(next.session().phase,'active');
 assert.equal(next.session().expiresAtMs,f.clock.now+120000);assert.throws(()=>f.runtime.pause(),/SESSION_SUPERSEDED/);
 await assert.rejects(()=>f.runtime.tick(),/SESSION_SUPERSEDED/);assert.equal(f.ledger.paused(),false);assert.equal(next.session().phase,'active');
});
test('R127 another user, connection, or changed configuration cannot adopt a session',async t=>{
 const f=fixture(t);await f.runtime.start();
 for(const extra of [{ownerScope:'another-owner'},{connectionScope:'another-connection'},{config:{...f.config,sessionMinutes:10}}])assert.throws(()=>new DurableUltraRuntimeR127({...f.options,...extra}),/SESSION_.*MISMATCH/);
 assert.equal(f.runtime.session().phase,'active');assert.equal(f.ledger.paused(),false);
});
test('R127 configuration and budget cannot be mutated or replaced',async t=>{
 const f=fixture(t);await f.runtime.start();
 for(const change of [()=>{f.runtime.config.sessionMinutes=200;},()=>{f.runtime.config.markets[0].capital=100000;},()=>{f.runtime.config.excludedSymbols.push('OTHER');},()=>{f.runtime.budget.capital=100000;},()=>{f.runtime.config={};},()=>{f.runtime.budget={};}])assert.throws(change,TypeError);
 assert.equal(f.runtime.config.sessionMinutes,2);assert.equal(f.runtime.budget.capital,1000);assert.equal(f.adapter.submissions,0);
});
test('R127 clock rollback fails closed and cannot prolong a session',async t=>{
 const f=fixture(t);await f.runtime.start();f.clock.now+=20000;await f.runtime.tick();const expiry=f.runtime.session().expiresAtMs;f.clock.now-=1;
 await assert.rejects(()=>f.runtime.tick(),/SESSION_CLOCK_REGRESSED/);assert.equal(f.ledger.paused(),true);assert.equal(f.runtime.session().expiresAtMs,expiry);assert.equal(f.adapter.submissions,1);
});
test('R127 Pause still blocks entries if the clock has regressed',async t=>{
 const f=fixture(t);await f.runtime.start();f.clock.now-=1;assert.throws(()=>f.runtime.pause(),/SESSION_CLOCK_REGRESSED/);assert.equal(f.ledger.paused(),true);assert.equal(f.adapter.submissions,0);
});
test('R127 invalid clock is refused before Start persists or submits',async t=>{
 const f=fixture(t);for(const value of [NaN,-1,1.5,Infinity,Number.MAX_SAFE_INTEGER]){f.clock.now=value;await assert.rejects(()=>f.runtime.start(),/SESSION_CLOCK_INVALID/);}
 assert.equal(f.runtime.session(),null);assert.equal(f.adapter.submissions,0);
});
test('R127 a duplicate concurrent Start cannot renew or duplicate the session',async t=>{
 let release;const gate=new Promise(resolve=>{release=resolve;});const f=fixture(t);const inspect=f.adapter.inspect.bind(f.adapter);f.adapter.inspect=async()=>{await gate;return inspect();};
 const start=f.runtime.start();const duplicate=await f.runtime.start();assert.equal(duplicate.created,false);assert.equal(duplicate.session.phase,'preparing');release();await start;
 assert.equal(f.runtime.session().startedAtMs,f.clock.now);assert.equal(f.adapter.submissions,0);
});
test('R127 a Pause during preflight wins over delayed activation',async t=>{
 let release;const gate=new Promise(resolve=>{release=resolve;});const f=fixture(t);const inspect=f.adapter.inspect.bind(f.adapter);f.adapter.inspect=async()=>{await gate;return inspect();};
 const start=f.runtime.start();f.runtime.pause();release();const result=await start;assert.equal(result.session.phase,'paused');assert.equal(f.ledger.paused(),true);
 await f.runtime.tick();assert.equal(f.adapter.submissions,0);
});
test('R127 duration elapsed during preflight cannot activate late',async t=>{
 const f=fixture(t),inspect=f.adapter.inspect.bind(f.adapter);f.adapter.inspect=async()=>{f.clock.now+=120001;return inspect();};
 const result=await f.runtime.start();assert.equal(result.session.phase,'expired');await f.runtime.tick();assert.equal(f.adapter.submissions,0);
});
test('R127 lost submission response stays in the same session and is reconciled once',async t=>{
 const f=fixture(t);await f.runtime.start();const expiry=f.runtime.session().expiresAtMs;f.adapter.failAfterSubmit=true;
 const result=await f.runtime.tick();assert.equal(result.state,'reconciliation_required');assert.equal(result.session.phase,'paused');f.clock.now+=100;
 await f.runtime.resume();assert.equal(f.runtime.session().expiresAtMs,expiry);await f.runtime.tick();assert.equal(f.adapter.submissions,1);
});
test('R127 lost lease cannot alter the new owner or submit more work',async t=>{
 const f=fixture(t);await f.runtime.start();f.ledger.db.prepare('UPDATE runner SET owner=?').run('another-worker');
 await assert.rejects(()=>f.runtime.tick(),/RUNNER_LEASE_LOST/);assert.equal(f.ledger.paused(),false);assert.equal(f.adapter.submissions,0);
});
test('R127 separate runner cannot claim a live session lease',async t=>{
 const f=fixture(t);await f.runtime.start();const otherLedger=new ExecutionLedger(f.path,f.binding);t.after(()=>otherLedger.close());
 const other=new DurableUltraRuntimeR127({...f.options,ledger:otherLedger});await assert.rejects(()=>other.resume({recover:true}),/ANOTHER_RUNNER_OR_RECOVERY_REQUIRED/);
 assert.equal(f.runtime.session().phase,'active');assert.equal(f.ledger.paused(),false);
});
test('R127 failed preparation remains the same nonbillable session',async t=>{
 const f=fixture(t);f.adapter.connected=false;await assert.rejects(()=>f.runtime.start(),/FIXTURE_DISCONNECTED/);const saved=f.runtime.session();assert.equal(saved.phase,'paused');assert.equal(saved.billingEnabled,false);
 f.clock.now+=10000;f.adapter.connected=true;await f.runtime.resume();assert.equal(f.runtime.session().expiresAtMs,saved.expiresAtMs);assert.equal(f.adapter.submissions,0);
});
test('R127 keeps native adapters and legacy Forex outside this candidate',t=>{
 const f=fixture(t);assert.throws(()=>new DurableUltraRuntimeR127({...f.options,adapter:{executionEnvironment:'native'}}),/NATIVE_EXECUTION_NOT_RELEASED/);
 assert.throws(()=>new DurableUltraRuntimeR127({...f.options,market:'forex'}),/SESSION_MARKET_OUT_OF_SCOPE/);
 for(const key of ['sessionId','ownerScope','connectionScope'])assert.throws(()=>new DurableUltraRuntimeR127({...f.options,[key]:'bad scope'}),/INVALID_SESSION_SCOPE/);
});
test('R127 B3 uses the same durable session controller without changing strategy',async t=>{
 const f=fixture(t,{market:'b3',provider:'profit',currency:'BRL'});await f.runtime.start();const entry=await f.runtime.tick();assert.equal(entry.state,'open');assert.equal(f.ledger.operation(entry.clientOrderId).market,'b3');
 f.clock.now=f.runtime.session().expiresAtMs;await f.runtime.tick();assert.equal(f.runtime.session().phase,'expired');assert.equal(f.adapter.submissions,1);
});
test('R127 abrupt process exit retains the session and enforces the recovery lease',async t=>{
 const f=fixture(t);
 const source=`
 import {ExecutionLedger} from ${JSON.stringify(new URL('../lib/platform/ultra/client/execution-ledger.mjs',import.meta.url).href)};
 import {OfflineFixtureBroker} from ${JSON.stringify(new URL('../lib/platform/ultra/client/fixture-broker.mjs',import.meta.url).href)};
 import {DurableUltraRuntimeR127} from ${JSON.stringify(new URL('../lib/platform/ultra/client/session-runtime-r127.mjs',import.meta.url).href)};
 const ledger=new ExecutionLedger(${JSON.stringify(f.path)},${JSON.stringify(f.binding)});
 const now=()=>${f.clock.now};const adapter=new OfflineFixtureBroker({binding:ledger.binding,market:'crypto',currency:'USDT',now});
 const runtime=new DurableUltraRuntimeR127({sessionId:'session-1',ownerScope:'fixture-owner',connectionScope:'fixture-account',config:${JSON.stringify(f.config)},market:'crypto',ledger,adapter,now});
 await runtime.start();process.stdout.write(JSON.stringify(runtime.session()));process.exit(0);
 `;
 const crashed=JSON.parse(execFileSync(process.execPath,['--input-type=module','-e',source],{encoding:'utf8'}));
 await assert.rejects(()=>f.runtime.resume({recover:true}),/ANOTHER_RUNNER_OR_RECOVERY_REQUIRED/);
 f.clock.now+=65000;await assert.rejects(()=>f.runtime.resume(),/ANOTHER_RUNNER_OR_RECOVERY_REQUIRED/);
 const recovered=await f.runtime.resume({recover:true});assert.equal(recovered.session.expiresAtMs,crashed.expiresAtMs);assert.equal(recovered.session.startedAtMs,crashed.startedAtMs);assert.equal(f.adapter.submissions,0);
});
test('R127 duplicate ticks are serialized while pause during preflight prevents submission',async t=>{
 const f=fixture(t);await f.runtime.start();let release;const gate=new Promise(resolve=>{release=resolve;});const preflight=f.adapter.preflight.bind(f.adapter);
 f.adapter.preflight=async()=>{await gate;return preflight();};const first=f.runtime.tick();
 assert.equal((await f.runtime.tick()).state,'busy');f.runtime.pause();release();const result=await first;
 assert.equal(result.state,'paused');assert.equal(f.adapter.submissions,0);assert.equal(result.session.phase,'paused');
});
test('R127 expiry during order preflight prevents a late entry',async t=>{
 const f=fixture(t);await f.runtime.start();const preflight=f.adapter.preflight.bind(f.adapter);
 f.adapter.preflight=async()=>{f.clock.now=f.runtime.session().expiresAtMs;return preflight();};
 const result=await f.runtime.tick();assert.equal(result.state,'paused');assert.equal(result.session.phase,'expired');assert.equal(f.adapter.submissions,0);
});
test('R127 a declined risk warning does not create a replacement session on retry',async t=>{
 let accepted=false;const f=fixture(t,{config:{tradeRiskPct:3},onWarning:async()=>accepted});
 await assert.rejects(()=>f.runtime.start(),/RISK_ACKNOWLEDGEMENT_REQUIRED/);const first=f.runtime.session();assert.equal(first.phase,'paused');
 f.clock.now+=1000;accepted=true;await f.runtime.resume();assert.equal(f.runtime.session().startedAtMs,first.startedAtMs);assert.equal(f.runtime.session().expiresAtMs,first.expiresAtMs);
});
test('R127 lease loss during Start preflight cannot pause the replacement owner',async t=>{
 let release,entered;const gate=new Promise(resolve=>{release=resolve;}),ready=new Promise(resolve=>{entered=resolve;});const f=fixture(t),inspect=f.adapter.inspect.bind(f.adapter);
 f.adapter.inspect=async()=>{entered();await gate;return inspect();};const start=f.runtime.start();await ready;
 f.ledger.db.prepare('UPDATE runner SET owner=?').run('replacement-worker');f.ledger.db.exec('UPDATE controls SET paused=0');release();
 await assert.rejects(()=>start,/RUNNER_LEASE_LOST/);assert.equal(f.ledger.paused(),false);assert.equal(f.adapter.submissions,0);
});
test('R127 lease loss during order preflight prevents submission and cannot pause new owner',async t=>{
 const f=fixture(t);await f.runtime.start();let release,entered;const gate=new Promise(resolve=>{release=resolve;}),ready=new Promise(resolve=>{entered=resolve;});const preflight=f.adapter.preflight.bind(f.adapter);
 f.adapter.preflight=async()=>{entered();await gate;return preflight();};const tick=f.runtime.tick();await ready;
 f.ledger.db.prepare('UPDATE runner SET owner=?').run('replacement-worker');f.ledger.db.exec('UPDATE controls SET paused=0');release();
 await assert.rejects(()=>tick,/RUNNER_LEASE_LOST/);assert.equal(f.ledger.paused(),false);assert.equal(f.adapter.submissions,0);
});
test('R127 mutations attempted during preflight cannot change the submitted risk config',async t=>{
 const f=fixture(t);await f.runtime.start();const preflight=f.adapter.preflight.bind(f.adapter);let attempted=0;
 f.adapter.preflight=async()=>{for(const action of [()=>{f.runtime.config.tradeRiskPct=100;},()=>{f.runtime.budget.capital=1e9;}]){assert.throws(action,TypeError);attempted++;}return preflight();};
 const result=await f.runtime.tick();assert.equal(result.state,'open');assert.equal(attempted,2);assert.ok(f.ledger.order(result.clientOrderId).request.estimatedLoss<=2.5);
});
test('R127 two controllers sharing a ledger serialize work and fence the replaced controller',async t=>{
 const f=fixture(t);await f.runtime.start();const other=new DurableUltraRuntimeR127({...f.options});
 let release,entered;const gate=new Promise(resolve=>{release=resolve;}),ready=new Promise(resolve=>{entered=resolve;});const preflight=f.adapter.preflight.bind(f.adapter);
 f.adapter.preflight=async()=>{entered();await gate;return preflight();};const tick=f.runtime.tick();await ready;
 await assert.rejects(()=>other.resume(),/SESSION_BUSY/);assert.equal((await other.tick()).state,'busy');release();await tick;
 await other.resume();await assert.rejects(()=>f.runtime.tick(),/SESSION_CONTROLLER_SUPERSEDED/);assert.equal(f.ledger.paused(),false);
 assert.equal(f.runtime.session().attached,false);await other.tick();assert.equal(f.adapter.submissions,1);
});
test('R127 an observed clock watermark survives before any final tick save',async t=>{
 const f=fixture(t);await f.runtime.start();f.clock.now+=50000;assert.equal(f.runtime.now(),f.clock.now);
 assert.equal(f.runtime.session().lastObservedAtMs,f.clock.now);f.close();f.clock.now-=1;
 const ledger=new ExecutionLedger(f.path,f.binding);t.after(()=>ledger.close());const runtime=new DurableUltraRuntimeR127({...f.options,ledger});
 await assert.rejects(()=>runtime.resume({recover:true}),/SESSION_CLOCK_REGRESSED/);assert.equal(f.adapter.submissions,0);
});
test('R127 resume rechecks a session finished between its read and adoption transaction',async t=>{
 const f=fixture(t);await f.runtime.start();const now=f.runtime.now;
 f.runtime.now=()=>{const key='ultra_r127_session:session-1',saved=f.ledger.transport(key);f.ledger.saveTransport(key,{...saved,phase:'ended',finishedAtMs:f.clock.now});return now();};
 await assert.rejects(()=>f.runtime.resume(),/SESSION_ALREADY_ENDED/);assert.equal(f.runtime.session().phase,'ended');assert.equal(f.ledger.paused(),false);
});
