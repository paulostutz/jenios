import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {inflateRawSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {UltraJournal} from '../lib/platform/ultra/client/journal.mjs';
import {UltraClientEngine} from '../lib/platform/ultra/client/engine.mjs';
import {localResults,parseLocalReport,buildLocalDashboard,formatFinancialAmount,reportCsv,decimal8} from '../lib/platform/ultra/client/reporting.mjs';
import {exportClientPlan,validateClientPlan} from '../lib/platform/ultra/client/plan.mjs';
import {inspectBinance} from '../lib/platform/ultra/client/diagnostics.mjs';
const binding={account:'fixture-account',provider:'mt5',environment:'demo'};
const config={markets:[{id:'forex',currency:'USD',capital:1000,leverage:20}],sessionMinutes:60,maxPositions:3,tradeRiskPct:.25,dailyLossPct:2,maxAssetPct:20,excludedSymbols:[]};
const trade={id:'deal-1',symbol:'EURUSD',market:'forex',currency:'USD',side:'buy',openedAt:'2026-11-10T08:00:00Z',closedAt:'2026-11-10T09:00:00Z',gross:'10.00000001',fees:'1.00000000',financing:'-0.10000000',complete:true,source:'broker'};
const report={schema:'JENIOS_ULTRA_LOCAL_REPORT_V1',environment:'demo',provider:'mt5',connectionLabel:'Minha conta',generatedAt:'2026-11-10T12:00:00Z',operations:[trade]};
function fixture(t){const dir=mkdtempSync(join(tmpdir(),'ultra-r116-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));return join(dir,'journal.sqlite');}
test('a local plan contains no session, broker credentials or execution authorization',()=>{
 const result=exportClientPlan({config,risk_acknowledged:true,user_id:'private',access_token:'private'});
 assert.deepEqual(validateClientPlan(result),result);assert.equal(result.executionAuthorization,false);
 assert.equal(JSON.stringify(result).includes('private'),false);
 assert.throws(()=>validateClientPlan({...result,apiKey:'private'}));
 assert.throws(()=>exportClientPlan({config,risk_acknowledged:false}));
 assert.equal(exportClientPlan({config:{...config,markets:[{...config.markets[0],leverage:1000}]},risk_acknowledged:true}).config.markets[0].leverage,1000);
});
test('persistent intent survives restart, is unique and cannot be reused for another account',t=>{
 const path=fixture(t),a=new UltraJournal(path,binding);a.claim(1000);a.resume();const request={symbol:'EURUSD',quantity:1};
 const intent=a.prepare(request,1000);a.transition(intent.id,'prepared','sending',null,1000);a.transition(intent.id,'sending','unknown',null,1001);
 assert.equal(a.prepare(request,1001).created,false);a.close();
 const b=new UltraJournal(path,binding);b.claim(2000);assert.equal(b.pending()[0].id,intent.id);assert.equal(b.pending()[0].state,'unknown');assert.throws(()=>b.resume(),/RECONCILIATION/);
 b.transition(intent.id,'unknown','closed',{positionReconciled:true},2001);b.resume();assert.equal(b.pending().length,0);b.close();
 assert.throws(()=>new UltraJournal(path,{...binding,account:'other'}),/ACCOUNT_MISMATCH/);
});
test('a concurrent runner cannot claim a live journal; stale runner is fenced after explicit recovery',t=>{
 const path=fixture(t),a=new UltraJournal(path,binding),b=new UltraJournal(path,binding);a.claim(1000);a.resume();const intent=a.prepare({symbol:'X'},1000);
 assert.throws(()=>b.claim(1001,{recover:true}),/ANOTHER_RUNNER/);assert.throws(()=>b.claim(62000),/RECOVERY_REQUIRED/);
 b.claim(62000,{recover:true});assert.throws(()=>a.heartbeat(62001),/LEASE_LOST/);assert.throws(()=>a.transition(intent.id,'prepared','sending',null,62001),/LEASE_LOST/);
 b.transition(intent.id,'prepared','cancelled',null,62001);b.resume();a.close();assert.equal(b.paused(),false);b.close();
});
test('immutable broker receipt deduplicates an exact retry and rejects changed amounts',t=>{
 const a=new UltraJournal(fixture(t),binding);assert.equal(a.record(trade),true);assert.equal(a.record({...trade}),false);assert.throws(()=>a.record({...trade,gross:'200'}),/RECEIPT_CHANGED/);assert.equal(a.events().length,1);a.close();
});
function engineFixture(t,{submit,lookup,loss=0,quotes=[],ack=true}={}){
 const journal=new UltraJournal(fixture(t),binding),state={now:100000,calls:0,protect:0};
 const adapter={executionEnvironment:'offline_fixture',inspect:async()=>({accountBinding:journal.binding,accountCurrency:'USD',tradingAllowed:true,protectionSupported:true,instrumentRulesVerified:true}),closedTrades:async()=>[],lookup:lookup||(async()=>null),protectExisting:async()=>{state.protect++;},
 account:async()=>({accountBinding:journal.binding,reconciled:true,freeMargin:1000,realizedLossToday:loss,openLoss:0,observedAtMs:state.now}),observations:async()=>quotes,preflight:async()=>({allowed:true,protectionSupported:true}),submitProtected:async decision=>{state.calls++;assert.equal(journal.pending()[0].state,'sending');if(submit)return submit(decision);return {clientOrderId:decision.clientOrderId,scopeVerified:true,protectionConfirmed:true};}};
 const engine=new UltraClientEngine({config,market:'forex',journal,adapter,now:()=>state.now,onWarning:async()=>ack});t.after(()=>journal.close());return {engine,journal,state,adapter};
}
const quote={market:'forex',symbol:'EURUSD',marketOpen:true,observedAtMs:100000,liquidityVerified:true,volatilityBps:40,spreadBps:1,depthUsd:3e6,fillProbability:.9,roundTripCostBps:3,adverseSelectionBps:1,stabilityRatio:.9,directionInputsVerified:true,instrumentRulesVerified:true,microMomentumBps:10,orderBookImbalance:.7,bid:1,ask:1.001,stopDistance:.01,targetDistance:.02,contractMultiplier:100,quoteToAccount:1,lotStep:.01,minLot:.01,marginPerLot:10,costPerLot:.1};
test('offline integration kernel cannot be passed a real broker driver',t=>{
 const journal=new UltraJournal(fixture(t),binding);assert.throws(()=>new UltraClientEngine({config,market:'forex',journal,adapter:{}}),/EXECUTION_ADAPTER_NOT_RELEASED/);journal.close();
});
test('leverage acknowledgement is required but does not impose a hidden leverage cap',async t=>{
 const f=engineFixture(t,{ack:false});await assert.rejects(f.engine.start(),/RISK_ACKNOWLEDGEMENT/);assert.equal(f.state.calls,0);
});
test('submission intent is durable before the adapter is called; timeout pauses and never blindly resends',async t=>{
 const f=engineFixture(t,{quotes:[quote],submit:async()=>{throw Error('timeout');}});await f.engine.start();
 assert.equal((await f.engine.tick()).state,'reconciliation_required');assert.equal(f.journal.pending()[0].state,'unknown');assert.equal(f.state.calls,1);
 await f.engine.tick();assert.equal(f.state.calls,1);assert.equal(f.journal.paused(),true);assert.equal(f.state.protect,2);
});
test('loss limit pauses new entries while retaining existing-position protection',async t=>{
 const f=engineFixture(t,{quotes:[quote],loss:20});await f.engine.start();assert.equal((await f.engine.tick()).state,'daily_limit');assert.equal(f.state.calls,0);assert.equal(f.state.protect,1);
});
test('stale quote or unverified liquidity never produces a candidate',async t=>{
 const f=engineFixture(t,{quotes:[{...quote,liquidityVerified:false}]});await f.engine.start();assert.equal((await f.engine.tick()).state,'waiting_for_opportunity');assert.equal(f.state.calls,0);
 f.adapter.observations=async()=>[{...quote,observedAtMs:98000}];await f.engine.tick();assert.equal(f.state.calls,0);
});
test('recovery does not equate missing orders with closed positions',async t=>{
 const f=engineFixture(t,{quotes:[quote],lookup:async()=>({state:'closed',scopeVerified:true,positionReconciled:false})});await f.engine.start();await f.engine.tick();
 assert.equal(f.journal.pending()[0].state,'working');await assert.rejects(f.engine.start(),/RECONCILIATION/);assert.equal(f.journal.pending()[0].state,'unknown');assert.equal(f.state.calls,1);
});
test('a future or missing account observation cannot authorize an entry',async t=>{
 const f=engineFixture(t,{quotes:[quote]});await f.engine.start();const valid=await f.adapter.account();f.adapter.account=async()=>({...valid,observedAtMs:undefined});await assert.rejects(f.engine.tick(),/SNAPSHOT_UNAVAILABLE/);assert.equal(f.state.calls,0);
});
test('financial totals are exact across fees, funding credits and losses',()=>{
 const output=localResults([trade,{...trade,id:'deal-2',gross:'-3',fees:'1',financing:'0.2'}]);
 assert.equal(output.totals[0].gains,'9.10000001');assert.equal(output.totals[0].losses,'4.20000000');assert.equal(output.totals[0].net,'4.90000001');
 assert.equal(formatFinancialAmount('999999999999999999.12345678','USD'),'999.999.999.999.999.999,12345678 USD');
 assert.equal(decimal8('0.00000001'),1n);
});
test('reports reject hidden secrets, duplicates, incomplete costs, wrong markets and unzoned dates',()=>{
 for(const row of [{...trade,fees:0},{...trade,fees:'-1'},{...trade,complete:false},{...trade,openedAt:'2026-11-10'},{...trade,apiKey:'secret'},{...trade,market:'b3'}])assert.throws(()=>parseLocalReport({...report,operations:[row]}));
 assert.throws(()=>parseLocalReport({...report,apiKey:'secret'}));assert.throws(()=>parseLocalReport({...report,operations:[trade,trade]}));
});
test('period totals, lifetime, pagination and daily grouping share the same complete operation set',()=>{
 const operations=Array.from({length:55},(_,i)=>({...trade,id:'deal-'+i}));operations.push({...trade,id:'old',openedAt:'2026-10-01T08:00:00Z',closedAt:'2026-10-01T09:00:00Z',currency:'EUR'});
 const x=buildLocalDashboard({...report,operations},{period:'today',now:new Date('2026-11-10T12:00:00Z'),page:1});
 assert.equal(x.count,55);assert.equal(x.operations.length,5);assert.equal(x.totals[0].operations,55);assert.equal(x.lifetime.length,2);assert.equal(x.days.length,1);assert.equal(x.days[0].operations,55);assert.equal(x.environment,'demo');assert.equal(x.independentlyVerified,false);
});
test('CSV includes costs and result and prevents formula execution in imported labels',()=>{
 const csv=reportCsv({...report,connectionLabel:'=1+1'},{now:new Date('2026-11-10T12:00:00Z')});assert.ok(csv.includes("'=1+1"));assert.ok(csv.includes('Financiamento'));assert.ok(csv.includes('9.10000001'));
});
test('Binance diagnostic uses only fixed official origins and GET, and does not leak keys or balances',async()=>{
 const calls=[];const fetchImpl=async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>url.includes('/time')?{serverTime:1000}:url.includes('/accountConfig')?{canTrade:true}:{assets:[{asset:'USDT',walletBalance:'1234'}],positions:[]}};};
 const result=await inspectBinance({environment:'demo',apiKey:'private-key',apiSecret:'private-secret',fetchImpl,now:()=>1000});assert.equal(result.executionAvailable,false);assert.equal(result.connected,true);
 assert.equal(calls.length,3);assert.ok(calls.every(c=>c.options.method==='GET'&&c.url.startsWith('https://demo-fapi.binance.com/')));assert.equal(calls[1].options.headers['X-MBX-APIKEY'],'private-key');assert.equal(result.tradingPermission,true);
 assert.equal(JSON.stringify(result).includes('private'),false);assert.equal(JSON.stringify(result).includes('1234'),false);
 await assert.rejects(inspectBinance({environment:'custom-host',apiKey:'x',apiSecret:'y',fetchImpl}),/CREDENTIALS_REQUIRED/);
});
test('upstream errors are sanitized without vendor body or credentials',async()=>{
 await assert.rejects(inspectBinance({environment:'live',apiKey:'private',apiSecret:'private',fetchImpl:async()=>{throw Error('private-secret');}}),/^Error: BINANCE_DIAGNOSTIC_FAILED$/);
});
test('download package contains only its documented files with matching integrity hashes',()=>{
 const zip=readFileSync('public/downloads/jenios-ultra-r116.zip'),files=new Map();let offset=0;
 while(zip.readUInt32LE(offset)===0x04034b50){
  assert.equal(zip.readUInt16LE(offset+8),8);const size=zip.readUInt32LE(offset+18),nameSize=zip.readUInt16LE(offset+26),extra=zip.readUInt16LE(offset+28);
  const name=zip.subarray(offset+30,offset+30+nameSize).toString('utf8'),start=offset+30+nameSize+extra;
  files.set(name,inflateRawSync(zip.subarray(start,start+size)));offset=start+size;
 }
 const manifest=JSON.parse(files.get('INTEGRIDADE.json'));assert.equal(files.size,Object.keys(manifest).length+1);
 for(const [path,hash] of Object.entries(manifest)){const body=files.get(path);assert.equal(createHash('sha256').update(body).digest('hex'),hash);if(path!=='LEIA-ME.md')assert.deepEqual(body,readFileSync(path));}
 assert.ok(files.has('LEIA-ME.md'));assert.ok(![...files.keys()].some(p=>/\.env|sqlite|engine\.mjs|node_modules/.test(p)));
});
