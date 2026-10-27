import test from 'node:test';
import assert from 'node:assert/strict';
import {requireR80PaperSafety} from '../lib/platform/connections/paper-safety-gate-r80.mjs';
const ownerUserId='4d238a7a-8c7b-4d8e-9a10-1c5c82db59a7';
const connectionId='50b85e9d-339c-4d32-b2bf-82c467673832';
const clientOrderId='r80-paper-1',nowMs=1793091600000;
const scope={ownerUserId,connectionId,clientOrderId,nowMs,
 order:{clientOrderId,side:'buy',quantity:'1',entry:'100'}};
const env={VERCEL_ENV:'preview',JENIOS_REAL_EXECUTION_ENABLED:'false',
 JENIOS_PRIVATE_PAPER_REHEARSAL:'true',JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED:'true',
 JENIOS_PRIVATE_PAPER_EXECUTOR:'true'};
const state={ownerUserId,connectionId,status:'ACTIVE',killSwitchEngaged:false,
 paperConsentEnabled:true,liveExecutionEnabled:false,checkedAtMs:nowMs,
 riskApprovedAtMs:nowMs-1000,riskExpiresAtMs:nowMs+100000,maxNotionalUnits:'15000000000',
 approvalSource:'PLATFORM_OWNER_SERVER_VERIFIED'};
const run=(s=state,e=env)=>requireR80PaperSafety(scope,{env:e,store:{readSafety:async()=>s}});
test('R80 accepts only recent trusted private PAPER state',async()=>{
 const result=await run();assert.equal(result.paperOnly,true);assert.equal(result.liveExecution,false);
});
test('R80 blocks missing, paused, killed, revoked, stale and mismatched safety state',async()=>{
 for(const bad of [null,{...state,status:'PAUSED'},{...state,killSwitchEngaged:true},
  {...state,paperConsentEnabled:false},{...state,liveExecutionEnabled:true},
  {...state,checkedAtMs:nowMs-30001},{...state,ownerUserId:connectionId},
  {...state,connectionId:ownerUserId},{...state,riskExpiresAtMs:nowMs-1},
  {...state,maxNotionalUnits:null},{...state,maxNotionalUnits:'100000000'},
  {...state,approvalSource:null}])
  await assert.rejects(run(bad),/R80_PAPER_SAFETY_NOT_CONFIRMED/);
});
test('R80 fails closed on missing or failing durable repository',async()=>{
 await assert.rejects(requireR80PaperSafety(scope,{env}),/R80_DURABLE_SAFETY_REQUIRED/);
 await assert.rejects(requireR80PaperSafety(scope,{env,store:{readSafety:async()=>{throw Error('db');}}}),
  /R80_DURABLE_SAFETY_UNAVAILABLE/);
});
test('R80 refuses production and live enabled regardless of trusted state',async()=>{
 for(const bad of [{...env,VERCEL_ENV:'production'},
  {...env,JENIOS_REAL_EXECUTION_ENABLED:'true'},
  {...env,JENIOS_PRIVATE_PAPER_EXECUTOR:'false'}])
  await assert.rejects(run(state,bad),/R80_PAPER_DISABLED/);
});
