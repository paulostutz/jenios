import test from 'node:test';
import assert from 'node:assert/strict';
import {recoverR80PaperAfterRestart} from '../lib/platform/connections/paper-worker-recovery-r80.mjs';
const owner='4d238a7a-8c7b-4d8e-9a10-1c5c82db59a7';
const connection='50b85e9d-339c-4d32-b2bf-82c467673832';
const now=1793091600000;
const env={VERCEL_ENV:'preview',JENIOS_REAL_EXECUTION_ENABLED:'false',
 JENIOS_PRIVATE_PAPER_RECOVERY_ENABLED:'true',JENIOS_PRIVATE_PAPER_REHEARSAL:'true'};
const session={userId:owner,authenticated:true,diagnosticCompleted:true};
const storedConnection={id:connection,user_id:owner,provider:'alpaca',environment:'paper',
 status:'active',identity_verified:true,external_digest:'a'.repeat(64),
 last_sync_at:new Date(now-1000).toISOString(),created_at:new Date(now-100000).toISOString()};
const orders=[{clientOrderId:'persisted-order',symbol:'AAPL',previousState:'UNKNOWN'}];
const safetyStore={readSafety:async()=>({ownerUserId:owner,connectionId:connection,
 status:'PAUSED',liveExecutionEnabled:false})};
test('R89 refuses forged recovery list before broker lookup',async()=>{
 let called=0;
 const ledger={snapshot(){return [];},event(){},
  pendingRecovery(){return orders;}};
 const result=await recoverR80PaperAfterRestart({
  session,storedConnection,credentials:{},orders,nowMs:now
 },{ledger,safetyStore,env,recorder:async()=>{called++;return {
  state:'UNKNOWN',manualReview:true,automaticResubmissionAllowed:false,
  realExecution:false,ordersSent:0};}});
 assert.equal(called,1);assert.equal(result.ordersSent,0);
 for(const bad of [
  [{...orders[0],symbol:'MSFT'}],
  [{...orders[0],previousState:'ACK'}],
  [{...orders[0],clientOrderId:'another'}],
  []
 ]){
  await assert.rejects(recoverR80PaperAfterRestart({
   session,storedConnection,credentials:{},orders:bad,nowMs:now
  },{ledger,safetyStore,env,recorder:async()=>{called++;}}),
  /R89_RECOVERY_INVENTORY_MISMATCH/);
 }
 assert.equal(called,1);
});
