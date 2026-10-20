import test from 'node:test';import assert from 'node:assert/strict';
import {replaySimulatedPaperOrder} from '../lib/platform/connections/b186-ledger-replay.mjs';
const session={userId:'4d238a7a-8c7b-4d8e-9a10-1c5c82db59a7',authenticated:true,diagnosticCompleted:true};
const connection={id:'50b85e9d-339c-4d32-b2bf-82c467673832',provider:'alpaca',environment:'paper'};
for(const [scenario,expected] of Object.entries({accepted:'ACK',partial_then_filled:'FILLED',partial_then_cancelled:'CANCELLED',rejected:'REJECTED',timeout:'UNKNOWN',filled:'FILLED'})){
 test('B186 '+scenario+' respects B152 transitions and no network',()=>{
  let state='RESERVED',held='4000000000000000000',filled='0';const seen=new Set();
  const ledger={snapshot:()=>[{client_id:'sim-order',state,held,filled}],event:(_s,_c,_id,e)=>{
   assert.equal(_id,'sim-order');assert.ok(!seen.has(e.id));seen.add(e.id);
   const allowed={RESERVED:['SUBMITTING'],SUBMITTING:['ACK','REJECTED','FILLED','UNKNOWN'],ACK:['PARTIAL','FILLED'],PARTIAL:['FILLED','CANCELLED']};
   assert.ok(allowed[state]?.includes(e.kind),state+' -> '+e.kind);
   state=e.kind;filled=e.cumulativeQuantity;if((state==='REJECTED'||state==='CANCELLED')&&filled==='0')held='0';
   return {state,heldRiskUnits:held,duplicate:false};
  }};
  const r=replaySimulatedPaperOrder({ledger,session,connection,clientOrderId:'sim-order',quantity:'4',scenario,atMs:1792526000000});
  assert.equal(r.finalState,expected);assert.equal(r.ordersSent,0);assert.equal(r.networkCalls,0);assert.equal(r.stopAndTargetBrokerVerified,false);
  assert.equal(r.needsReconciliation,scenario==='timeout');
  if(scenario==='partial_then_cancelled')assert.equal(r.filledUnits,'2');
 });
}
test('B186 blocks unreserved intents and non-paper connection',()=>{
 const ledger={snapshot:()=>[],event:()=>{throw Error('should not execute')}};
 assert.throws(()=>replaySimulatedPaperOrder({ledger,session,connection,clientOrderId:'x',quantity:'4',scenario:'filled',atMs:1792526000000}),/FRESH_RESERVED_INTENT_REQUIRED/);
 assert.throws(()=>replaySimulatedPaperOrder({ledger,session,connection:{...connection,environment:'live'},clientOrderId:'x',quantity:'4',scenario:'filled',atMs:1792526000000}),/PRIVATE_PAPER_SCOPE_REQUIRED/);
});
