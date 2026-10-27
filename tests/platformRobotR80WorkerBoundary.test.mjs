import test from 'node:test';
import assert from 'node:assert/strict';
import {submitR80GuardedPaperOnce} from '../lib/platform/connections/paper-worker-boundary-r80.mjs';
const owner='4d238a7a-8c7b-4d8e-9a10-1c5c82db59a7';
const conn='50b85e9d-339c-4d32-b2bf-82c467673832';
const now=1793091600000;
const input={permit:{ownerUserId:owner,connectionId:conn,clientOrderId:'order1'},
 session:{userId:owner},storedConnection:{id:conn},order:{clientOrderId:'order1'},nowMs:now};
const env={VERCEL_ENV:'preview',JENIOS_REAL_EXECUTION_ENABLED:'false',
 JENIOS_PRIVATE_PAPER_REHEARSAL:'true',JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED:'true',
 JENIOS_PRIVATE_PAPER_EXECUTOR:'true'};
test('R80 worker boundary fails closed without durable safety before any broker attempt',async()=>{
 let attempts=0;
 await assert.rejects(submitR80GuardedPaperOnce(input,{
  env,safetyStore:{readSafety:async()=>null},
  paperExecutor:async()=>{attempts++;}
 }),/R80_PAPER_SAFETY_NOT_CONFIRMED/);
 assert.equal(attempts,0);
});
test('R80 worker boundary rejects forged owner before querying state',async()=>{
 let reads=0;
 await assert.rejects(submitR80GuardedPaperOnce({...input,session:{userId:conn}},{
  env,safetyStore:{readSafety:async()=>{reads++;return null;}}
 }),/R80_SCOPE_MISMATCH/);
 assert.equal(reads,0);
});
test('R80 verified safety alone never bypasses signed consent',async()=>{
 let attempts=0;
 await assert.rejects(submitR80GuardedPaperOnce({...input,signature:'invalid'},{
  env,safetyStore:{readSafety:async()=>({ownerUserId:owner,connectionId:conn,
   status:'ACTIVE',killSwitchEngaged:false,paperConsentEnabled:true,
   liveExecutionEnabled:false,checkedAtMs:now})},
  paperExecutor:async()=>{attempts++;}
 }),/R78_INVALID_SIGNED_PERMIT/);
 assert.equal(attempts,0);
});
