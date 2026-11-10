import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {readFileSync} from 'node:fs';
import {verifyR106PublicGuidance} from '../scripts/check-authentication-r106.mjs';
import {initialOperation} from '../lib/platform/ultra/operation.mjs';
import {OperationLedger} from '../lib/platform/ultra/client/operation-ledger.mjs';
import {parseWorkspaceReport,workspaceReportView,ultraAccessPreparation,prepareOpeningFee} from '../lib/platform/ultra/client/workspace-report.mjs';
const now=Date.parse('2026-11-10T15:00:00Z'),at=n=>new Date(now+n).toISOString();
const operation=(id,patch={})=>({...initialOperation({market:'crypto',symbol:'BTCUSDT',currency:'USDT',side:'buy',quantity:'1'},id,now-3000),...patch});
const closed=(id,patch={})=>operation(id,{state:'closed',openedAt:at(-2000),closedAt:at(-1000),updatedAt:at(-1000),entryQuantity:'1',exitQuantity:'1',entryPrice:'100',exitPrice:'110',gross:'10.00000001',fees:'-0.1',financing:'0.2',costsComplete:true,...patch});
const report=operations=>({schema:'JENIOS_ULTRA_OPERATIONS_V1',provider:'binance',environment:'demo',connectionLabel:'Minha conta fictícia',generatedAt:at(0),operations});
const view=r=>workspaceReportView(r,{period:'all',now:new Date(now)});
test('R124 actual durable OperationLedger export reaches the read-only workspace after restart',t=>{
 const dir=mkdtempSync(join(tmpdir(),'ultra-r124-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));const file=join(dir,'report.sqlite');
 const binding={account:'synthetic-only-account',provider:'binance',environment:'demo'};
 let ledger=new OperationLedger(file,binding);ledger.saveOperation(closed('one'),{now});ledger.close();
 ledger=new OperationLedger(file,binding);t.after(()=>ledger.close());
 const r=view({...ledger.localReport({provider:'binance',environment:'demo',connectionLabel:'Conta do teste',now:new Date(now)}),accountFingerprint:'a'.repeat(64)});
 assert.equal(r.totals[0].net,'9.90000001');assert.equal(r.operations[0].id,'one');
});
test('R124 exact costs/rebates and separate currencies never become a wallet balance',()=>{
 const r=view(report([closed('usdt'),closed('usd',{currency:'USD',gross:'-2',fees:'1',financing:'0'})]));
 assert.equal(r.totals.length,2);assert.equal(r.totals.find(x=>x.currency==='USDT').net,'9.90000001');
 assert.equal(r.totals.find(x=>x.currency==='USD').losses,'3.00000000');assert.equal(r.walletBalance,null);assert.equal(r.brokerBalance,null);assert.equal(r.platformCosts.finalNet,null);
});
test('R124 partial close, unknown send and missing costs do not inflate realized totals',()=>{
 const partial=closed('partial',{state:'partially_closed',closedAt:null,exitQuantity:'0.5'}),unknown=operation('uncertain',{state:'unknown'}),pending=closed('pending',{costsComplete:false,fees:null});
 const r=view(report([partial,unknown,pending]));assert.deepEqual(r.totals,[]);assert.equal(r.openCount,1);assert.equal(r.uncertainCount,1);assert.equal(r.awaitingCosts,1);assert.ok(r.operations.every(o=>o.net===null));assert.equal(r.currentConnectionConfirmed,false);
});
test('R124 same operation ID with conflicting content refuses the entire file',()=>{
 assert.throws(()=>view(report([closed('dup'),closed('dup',{gross:'999'})])),/DUPLICATE/);
});
test('R124 credentials, invalid environment, mixed markets and malformed timestamps are refused',()=>{
 for(const r of [{...report([]),apiKey:'not-a-real-secret'},{...report([]),environment:'other'},{...report([]),generatedAt:'tomorrow'},report([closed('b3',{market:'b3'})])])assert.throws(()=>parseWorkspaceReport(r,now));
});
test('R124 future update beyond the report generation cannot be treated as observed',()=>{
 assert.throws(()=>parseWorkspaceReport(report([closed('future',{updatedAt:at(1000)})]),now),/FUTURE/);
});
test('R124 periods select realized closings while lifetime preserves earlier losses',()=>{
 const old=closed('old',{createdAt:'2026-01-01T00:00:00Z',openedAt:'2026-01-01T00:00:00Z',closedAt:'2026-01-02T00:00:00Z',updatedAt:'2026-01-02T00:00:00Z',gross:'-5',fees:'0',financing:'0'});
 const r=workspaceReportView(report([old,closed('new')]),{period:'7d',now:new Date(now)});assert.equal(r.totals[0].operations,1);assert.equal(r.lifetime[0].operations,2);assert.equal(r.lifetime[0].losses,'5.00000000');
});
test('R124 importing/replacing one account cannot mutate or append another account',()=>{
 const a=report([closed('same')]),b={...report([closed('same',{gross:'2'})]),connectionLabel:'Outra conta',environment:'live'},before=JSON.stringify(a);
 assert.equal(view(a).operations.length,1);assert.equal(view(b).operations.length,1);assert.equal(view(b).environment,'live');assert.equal(JSON.stringify(a),before);
});
test('R124 holder-only professional benefit and separate personal addon remain non-granting',()=>{
 for(const platform of ['flow','jenios']){
  assert.equal(ultraAccessPreparation({platform,plan:'professional',beneficiary:'holder'}).included,true);
  const client=ultraAccessPreparation({platform,plan:'professional',beneficiary:'client'});assert.equal(client.included,false);assert.equal(client.accessGranted,false);assert.equal(client.checkoutEnabled,false);
 }
 const personal=ultraAccessPreparation({platform:'flow',plan:'personal_defi',beneficiary:'holder'});assert.equal(personal.requiresSeparateSubscription,true);assert.equal(personal.annualCents,personal.monthlyCents*10);assert.equal(personal.annualMonths,12);assert.equal(personal.performanceBillable,false);
});
test('R124 start fee preparation repeats the same scope and never debits unknown/insufficient funds',()=>{
 const args={platform:'flow',ownerScope:'synthetic-owner',operationId:'operation-1',availableWalletCents:null};
 const a=prepareOpeningFee(args),b=prepareOpeningFee({...args,availableWalletCents:499});assert.equal(a.idempotencyScope,b.idempotencyScope);assert.equal(a.amountCents,500);assert.equal(a.trigger,'start');assert.equal(a.debitExecuted,false);assert.equal(b.fundsStatus,'insufficient');assert.equal(b.billable,false);assert.equal(b.reversalPolicy,null);assert.equal(b.brokerAccountDebited,false);
 assert.notEqual(a.idempotencyScope,prepareOpeningFee({...args,ownerScope:'another-owner'}).idempotencyScope);
 assert.equal(a.idempotencyScope,prepareOpeningFee({...args,platform:'jenios'}).idempotencyScope);
});
test('R124 exact release inventory still refuses modified new UI/model/manifest',()=>{
 assert.equal(verifyR106PublicGuidance().exactSource,true);
 for(const target of ['app/components/platform/UltraAccountReport.js','lib/platform/ultra/client/workspace-report.mjs','docs/release/R124-INDIVIDUAL-EXTENSION.json'])assert.throws(()=>verifyR106PublicGuidance({read:path=>path===target?Buffer.from('unreviewed change'):readFileSync(path)}));
});
