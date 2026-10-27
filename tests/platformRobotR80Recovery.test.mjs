import test from 'node:test';
import assert from 'node:assert/strict';
import {recoverR80PaperAfterRestart} from '../lib/platform/connections/paper-worker-recovery-r80.mjs';
const owner='4d238a7a-8c7b-4d8e-9a10-1c5c82db59a7';
const connection='50b85e9d-339c-4d32-b2bf-82c467673832',now=1793091600000;
const input={session:{userId:owner,authenticated:true,diagnosticCompleted:true},
 storedConnection:{id:connection,user_id:owner,provider:'alpaca',environment:'paper',status:'active'},
 credentials:null,nowMs:now,
 orders:[{clientOrderId:'order-a',symbol:'AAPL',previousState:'UNKNOWN'}]};
const env={VERCEL_ENV:'preview',JENIOS_REAL_EXECUTION_ENABLED:'false',
 JENIOS_PRIVATE_PAPER_RECOVERY_ENABLED:'true',JENIOS_PRIVATE_PAPER_REHEARSAL:'true'};
const safetyStore={readSafety:async()=>({ownerUserId:owner,connectionId:connection,
 status:'PAUSED',liveExecutionEnabled:false})};
const ledger={snapshot:()=>[],event:()=>{}};
test('R80 recovery can observe after restart while kill is engaged, without resubmitting',async()=>{
 let reads=0;
 const r=await recoverR80PaperAfterRestart(input,{env,safetyStore,ledger,
  recorder:async()=>{reads++;return {state:'UNKNOWN',manualReview:true,
   automaticResubmissionAllowed:false,realExecution:false,ordersSent:0};}});
 assert.equal(reads,1);assert.equal(r.autoResubmitAllowed,false);assert.equal(r.ordersSent,0);
 assert.equal(r.killSwitchUnchanged,true);assert.equal(r.requiresManualReview,true);
});
test('R80 recovery refuses production, live flags, forged ownership and missing durable stores',async()=>{
 await assert.rejects(recoverR80PaperAfterRestart(input,{env:{...env,VERCEL_ENV:'production'},safetyStore,ledger}),/R80_RECOVERY_DISABLED/);
 await assert.rejects(recoverR80PaperAfterRestart(input,{env:{...env,JENIOS_REAL_EXECUTION_ENABLED:'true'},safetyStore,ledger}),/R80_RECOVERY_DISABLED/);
 await assert.rejects(recoverR80PaperAfterRestart({...input,session:{...input.session,userId:connection}},{env,safetyStore,ledger}),/R80_RECOVERY_SCOPE_DENIED/);
 await assert.rejects(recoverR80PaperAfterRestart(input,{env}),/R80_RECOVERY_STORES_REQUIRED/);
});
test('R80 recovery never trusts a receipt allowing automatic resubmission',async()=>{
 const r=await recoverR80PaperAfterRestart(input,{env,safetyStore,ledger,
  recorder:async()=>({state:'ACK',manualReview:false,automaticResubmissionAllowed:true,
   realExecution:false,ordersSent:0})});
 assert.equal(r.reports[0].state,'UNKNOWN');assert.equal(r.requiresManualReview,true);
});
test('R80 recovery rejects duplicate or unsafe order references before lookup',async()=>{
 await assert.rejects(recoverR80PaperAfterRestart({...input,orders:[
  input.orders[0],input.orders[0]]},{env,safetyStore,ledger,recorder:async()=>({})}),
  /R80_RECOVERY_INVALID_ORDER/);
});
