import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectR85PaperWorkerReadiness} from '../lib/platform/connections/paper-worker-readiness-r85.mjs';
const owner='4d238a7a-8c7b-4d8e-9a10-1c5c82db59a7';
const connection='50b85e9d-339c-4d32-b2bf-82c467673832';
const env={JENIOS_REAL_EXECUTION_ENABLED:'false',JENIOS_PRIVATE_PAPER_EXECUTOR:'false',
 JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED:'false',JENIOS_R80_PRIVATE_ISSUER_ENABLED:'false',
 JENIOS_R83_PRIVATE_NODE_WORKER:'false'};
const input={ownerUserId:owner,connectionId:connection,
 session:{authenticated:true,userId:owner},
 storedConnection:{id:connection,user_id:owner,environment:'paper',provider:'alpaca'},
 ledger:{snapshot(){return []}}};
test('R85 readiness never enables orders even with an ACTIVE row',async()=>{
 const db={rpc:async()=>({data:[{owner_user_id:owner,connection_id:connection,
 status:'ACTIVE',kill_switch_engaged:false,paper_consent_enabled:true,
 live_execution_enabled:false,checked_at:new Date().toISOString(),
 max_notional_units:'100000000',risk_approved_at:new Date().toISOString(),
 risk_expires_at:new Date(Date.now()+60000).toISOString(),
 approval_source:'PLATFORM_OWNER_SERVER_VERIFIED'}],error:null})};
 const r=await inspectR85PaperWorkerReadiness(input,{db,env});
 assert.equal(r.ready,false);assert.equal(r.ordersSent,0);
 assert.equal(r.reason,'WORKER_NOT_DEPLOYED');
});
test('R85 rejects any activated financial switch and forged owner',async()=>{
 for(const key of Object.keys(env))
  await assert.rejects(inspectR85PaperWorkerReadiness(input,{
   env:{...env,[key]:'true'},db:{rpc(){}}
  }),/R85_READINESS_MUST_BE_INERT/);
 await assert.rejects(inspectR85PaperWorkerReadiness({...input,ownerUserId:connection},{
  env,db:{rpc(){}}
 }),/R85_OWNER_SCOPE_DENIED/);
});
