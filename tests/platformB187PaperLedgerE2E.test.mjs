import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PaperLedger} from '../lib/platform/pilot-prep/paper-ledger.mjs';
import {CORE_SHA,units} from '../lib/platform/pilot-prep/contracts.mjs';
import {alpacaPaperLedgerConnection,reserveAlpacaPaperProposal} from '../lib/platform/connections/alpaca-paper-risk-rehearsal.mjs';
import {replaySimulatedPaperOrder} from '../lib/platform/connections/b186-ledger-replay.mjs';
import {inspectPaperBracketReply} from '../lib/platform/connections/alpaca-paper-bracket-audit.mjs';

const nowMs=1792525000000;
const user='4d238a7a-8c7b-4d8e-9a10-1c5c82db59a7';
const session={userId:user,authenticated:true,diagnosticCompleted:true};
const env={VERCEL_ENV:'preview',JENIOS_PRIVATE_PAPER_REHEARSAL:'true'};
const storedConnection={
 id:'50b85e9d-339c-4d32-b2bf-82c467673832',user_id:user,provider:'alpaca',
 environment:'paper',status:'active',external_digest:'d'.repeat(64),
 last_sync_at:new Date(nowMs-1000).toISOString(),
 created_at:new Date(nowMs-500).toISOString(),identity_verified:true
};
const source={provider:'alpaca',environment:'paper',accountDigest:storedConnection.external_digest,
 accountAuthenticated:true,ownershipVerified:true,permissionsVerified:true,marketDataVerified:true,
 prospective:true,liveAccount:false,serverVerified:true};
const meta={provider:'alpaca',id:'AAPL',marketType:'spot',base:'AAPL',quote:'USD',settlement:'USD',
 contractSize:'1',qtyStep:'1',minQty:'1',maxQty:'100',tickSize:'0.01',
 capturedAtMs:nowMs-1000,sourceSha256:'a'.repeat(64),quantityUnit:'base'};
const quote={provider:'alpaca',instrument:'AAPL',receivedAtMs:nowMs-500,sourceAtMs:nowMs-750,bid:'99.99',ask:'100.01'};
const costs={roundTripFeeBps:0,slippageBps:0,fundingCost:'0'};
const limits={currency:'USD',ownerRisk:'8',accountRisk:'8',orderRisk:'5',
 notional:'1500',dailyLoss:'8',maxOrders:6};
const amount=units('4').toString();
function draft(mode,clientOrderId){
 return {
  mode,signal:{originalCoreSha256:CORE_SHA.engine,executionEnabled:false,mode,
   side:'buy',contextDigest:'a'.repeat(64),reviewStatus:'allow'},
  order:{clientOrderId,mode,side:'buy',symbol:'AAPL',quantity:'4',
   entry:'100',stop:'99',target:'103'}
 };
}
function harness(run){
 const dir=mkdtempSync(join(tmpdir(),'jenios-b187-sqlite-'));
 const path=join(dir,'risk.db');
 const connection=alpacaPaperLedgerConnection(user,storedConnection,{env,now:nowMs});
 let ledger=new PaperLedger(path);
 ledger.configure(session,connection,limits);
 const reserve=(mode,id)=>reserveAlpacaPaperProposal({
  session,storedConnection,...draft(mode,id),source,meta,quote,costs,nowMs
 },{ledger,env});
 const replay=(id,scenario)=>replaySimulatedPaperOrder({
  ledger,session,connection,clientOrderId:id,quantity:'4',scenario,atMs:nowMs+1
 });
 const snapshot=(id)=>ledger.snapshot(session,connection).find(row=>row.client_id===id);
 try{return run({ledger,connection,reserve,replay,snapshot,
  restart:()=>{ledger.close();ledger=new PaperLedger(path);},
  getLedger:()=>ledger});}
 finally{ledger.close();rmSync(dir,{recursive:true,force:true});}
}
for(const mode of ['direct','reverse','hybrid']){
 for(const [scenario,finalState,expectedFill,expectedRisk] of [
  ['accepted','ACK','0',amount],
  ['partial_then_filled','FILLED',units('4').toString(),amount],
  ['partial_then_cancelled','CANCELLED',units('2').toString(),amount],
  ['rejected','REJECTED','0','0'],
  ['timeout','UNKNOWN','0',amount],
  ['filled','FILLED',units('4').toString(),amount]
 ]){
  test('B187 SQLite B152 '+mode+' '+scenario+' preserves true risk accounting',()=>harness(({reserve,replay,snapshot})=>{
   const id='e2e-'+mode+'-'+scenario.replaceAll('_','-');
   const booking=reserve(mode,id);
   assert.equal(booking.riskState,'RESERVED');
   assert.equal(booking.ordersSent,0);
   assert.equal(booking.nativeProposal.body.order_class,'bracket');
   const result=replay(id,scenario);
   assert.equal(result.finalState,finalState);
   assert.equal(result.filledUnits,expectedFill);
   assert.equal(result.heldRiskUnits,expectedRisk);
   assert.equal(snapshot(id).state,finalState);
   assert.equal(snapshot(id).held,expectedRisk);
   assert.equal(result.ordersSent,0);
   assert.equal(result.networkCalls,0);
   assert.equal(result.realExecution,false);
   assert.equal(result.stopAndTargetBrokerVerified,false);
   assert.equal(result.needsReconciliation,scenario==='timeout');
   assert.throws(()=>replay(id,scenario),/FRESH_RESERVED_INTENT_REQUIRED/);
  }));
 }
}
test('B188 direct reverse hybrid share one SQLite risk cap, not independent budgets',()=>harness(({reserve,snapshot})=>{
 reserve('direct','shared-direct');reserve('reverse','shared-reverse');
 assert.throws(()=>reserve('hybrid','shared-hybrid'),/AGGREGATE_RISK_LIMIT|DAILY_LOSS_LIMIT/);
 assert.equal(snapshot('shared-direct').held,amount);
 assert.equal(snapshot('shared-reverse').held,amount);
 assert.equal(snapshot('shared-hybrid'),undefined);
}));
test('B188 unknown/timeout survives worker restart, blocks entries and only independent reconciliation unlocks',()=>{
 const dir=mkdtempSync(join(tmpdir(),'jenios-b188-unknown-')),path=join(dir,'risk.db');
 let ledger=new PaperLedger(path);
 const connection=alpacaPaperLedgerConnection(user,storedConnection,{env,now:nowMs});
 const reserve=(id)=>reserveAlpacaPaperProposal({session,storedConnection,...draft('direct',id),
  source,meta,quote,costs,nowMs},{ledger,env});
 try{
  ledger.configure(session,connection,limits);
  reserve('timeout-1');
  const r=replaySimulatedPaperOrder({ledger,session,connection,clientOrderId:'timeout-1',
   quantity:'4',scenario:'timeout',atMs:nowMs+1});
  assert.equal(r.finalState,'UNKNOWN');
  ledger.close();ledger=new PaperLedger(path);
  assert.equal(ledger.snapshot(session,connection)[0].held,amount);
  assert.throws(()=>reserve('timeout-2'),/RECONCILIATION_REQUIRED/);
  assert.throws(()=>replaySimulatedPaperOrder({ledger,session,connection,clientOrderId:'timeout-1',
   quantity:'4',scenario:'filled',atMs:nowMs+12}),/FRESH_RESERVED_INTENT_REQUIRED/);
  const manual=ledger.event(session,connection,'timeout-1',{
   id:'independent-lookup-1',kind:'RECONCILED',reconciledState:'REJECTED',
   atMs:nowMs+20,cumulativeQuantity:'0'
  });
  assert.equal(manual.state,'REJECTED');
  assert.equal(ledger.snapshot(session,connection)[0].held,'0');
  assert.equal(reserve('timeout-2').riskState,'RESERVED');
 }finally{ledger.close();rmSync(dir,{recursive:true,force:true});}
});
test('B188 cancelled partial still holds risk after restart until explicit CLOSE',()=>harness(({connection,reserve,replay,snapshot,restart,getLedger})=>{
 reserve('hybrid','part-cancel-1');
 assert.equal(replay('part-cancel-1','partial_then_cancelled').finalState,'CANCELLED');
 restart();
 assert.equal(snapshot('part-cancel-1').filled,units('2').toString());
 assert.equal(snapshot('part-cancel-1').held,amount);
 getLedger().event(session,connection,'part-cancel-1',{
  id:'operator-close-1',kind:'CLOSED',atMs:nowMs+20,
  cumulativeQuantity:'2',realizedLoss:'1'
 });
 assert.equal(snapshot('part-cancel-1').held,'0');
}));
test('B188 protective bracket observation does not certify a stop fill',()=>harness(({reserve})=>{
 const order=reserve('direct','bracket-audit-1').nativeProposal.body;
 const brokerOrderId='4d238a7a-8c7b-4d8e-9a10-1c5c82db59a7';
 const parent={id:brokerOrderId,client_order_id:order.client_order_id,
  symbol:order.symbol,order_class:'bracket',side:order.side,qty:order.qty,group_id:'group-1',
  legs:[
   {symbol:order.symbol,side:'sell',qty:order.qty,type:'limit',
    limit_price:order.take_profit.limit_price,group_id:'group-1',group_role:'take_profit'},
   {symbol:order.symbol,side:'sell',qty:order.qty,type:'stop',
    stop_price:order.stop_loss.stop_price,group_id:'group-1',group_role:'stop_loss'}
  ]};
 const verified=inspectPaperBracketReply({parent,body:order,brokerOrderId});
 assert.equal(verified.bracketConfirmed,true);
 assert.equal(verified.stopFillGuaranteed,false);
 const missing=inspectPaperBracketReply({parent:{...parent,legs:[parent.legs[0]]},body:order,brokerOrderId});
 assert.equal(missing.bracketConfirmed,false);
 assert.equal(missing.reviewRequired,true);
 const mismatch=inspectPaperBracketReply({parent:{...parent,legs:[
  parent.legs[0],{...parent.legs[1],stop_price:'101'}]},body:order,brokerOrderId});
 assert.equal(mismatch.bracketConfirmed,false);
 assert.equal(mismatch.reviewRequired,true);
}));
test('B189 invalid simulation never transitions RESERVED; live environment and other users cannot replay',()=>harness(({reserve,replay,snapshot,getLedger,connection})=>{
 reserve('direct','invalid-sim-1');
 assert.throws(()=>replaySimulatedPaperOrder({ledger:getLedger(),session,connection,
  clientOrderId:'invalid-sim-1',quantity:'1',scenario:'partial_then_filled',atMs:nowMs+1}),
  /PARTIAL_REQUIRES_MULTIPLE_UNITS/);
 assert.equal(snapshot('invalid-sim-1').state,'RESERVED');
 assert.throws(()=>replaySimulatedPaperOrder({ledger:getLedger(),session,
  connection:{...connection,environment:'live'},clientOrderId:'invalid-sim-1',
  quantity:'4',scenario:'filled',atMs:nowMs+1}),/PRIVATE_PAPER_SCOPE_REQUIRED/);
 assert.throws(()=>replaySimulatedPaperOrder({ledger:getLedger(),
  session:{...session,userId:'other-user'},connection,clientOrderId:'invalid-sim-1',
  quantity:'4',scenario:'filled',atMs:nowMs+1}),/ACCOUNT_OWNER_MISMATCH/);
 assert.equal(snapshot('invalid-sim-1').state,'RESERVED');
 assert.equal(snapshot('invalid-sim-1').held,amount);
}));
test('B189 kill-switch pause refuses another reservation even with a valid strategy mode',()=>harness(({reserve,replay,connection,snapshot,getLedger})=>{
 reserve('direct','pause-1');
 const r=replay('pause-1','accepted');
 assert.equal(r.finalState,'ACK');
 assert.equal(getLedger().pause(session,connection,true).paused,true);
 assert.throws(()=>reserve('reverse','pause-2'),/ACCOUNT_PAUSED/);
 assert.equal(snapshot('pause-1').held,amount);
}));
