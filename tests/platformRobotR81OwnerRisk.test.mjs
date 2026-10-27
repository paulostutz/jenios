import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {approveR81OwnerPaperRisk} from '../lib/platform/connections/paper-owner-risk-r81.mjs';
const owner='4d238a7a-8c7b-4d8e-9a10-1c5c82db59a7';
const conn='50b85e9d-339c-4d32-b2bf-82c467673832';
const now=1793091600000,expiresAtMs=now+600000,limit='15000000000';
const env={VERCEL_ENV:'preview',JENIOS_REAL_EXECUTION_ENABLED:'false',
 JENIOS_R81_PAPER_RISK_APPROVAL_ENABLED:'true'};
const input={accessToken:'synthetic-platform-authentication-only-test-token',
 connectionId:conn,maxNotional:'150',expiresAtMs,
 consent:'I_APPROVE_ALPACA_PAPER_RISK_FOR_MY_OWN_ACCOUNT',acceptsPaperRisk:true};
function fake({rev=1,activated=true,ownerId=owner,connectionOwner=owner,expired=false}={}){
 const names=[];
 const db={auth:{getUser:async()=>({data:{user:{id:ownerId,email_confirmed_at:'2026-10-01',is_anonymous:false}},error:null})},
  from(){return {select(){return this;},eq(){return this;},async maybeSingle(){return {data:{
   id:conn,user_id:connectionOwner,provider:'alpaca',environment:'paper',
   status:'active',identity_verified:true,external_digest:'a'.repeat(64),
   last_sync_at:new Date(now-(expired?600000:1000)).toISOString()
  },error:null};}};},
  async rpc(name,vars){
   names.push({name,vars});
   if(name==='jenios_r81_initialize_paper_safety')return {data:rev,error:null};
   if(name==='jenios_r81_activate_paper_owner_risk')return {data:activated,error:null};
   if(name==='jenios_r80_read_paper_safety')return {data:[{
     owner_user_id:owner,connection_id:conn,status:'ACTIVE',kill_switch_engaged:false,
     paper_consent_enabled:true,live_execution_enabled:false,max_notional_units:limit,
     risk_approved_at:new Date(now).toISOString(),risk_expires_at:new Date(expiresAtMs).toISOString(),
     approval_source:'PLATFORM_OWNER_SERVER_VERIFIED',checked_at:new Date(now).toISOString()
   }],error:null};
   throw Error('unrecognized');
  }};
 return {db,names};
}
const run=(ctx,inputValue=input,envValue=env)=>approveR81OwnerPaperRisk(inputValue,
 {db:ctx.db,env:envValue,clock:()=>now});
test('R81 authenticates owner and stores explicit max-notional in atomic CAS',async()=>{
 const ctx=fake();
 const r=await run(ctx);
 assert.equal(r.riskApproved,true);assert.equal(r.liveExecution,false);assert.equal(r.maxNotionalUnits,limit);
 assert.deepEqual(ctx.names.map(n=>n.name),[
 'jenios_r81_initialize_paper_safety','jenios_r81_activate_paper_owner_risk',
 'jenios_r80_read_paper_safety']);
 assert.equal(ctx.names[1].vars.p_expected_revision,1);
 assert.equal(ctx.names[1].vars.p_owner_user_id,owner);
});
test('R81 rejects missing consent, invalid expiry, zero risk and production',async()=>{
 for(const bad of [{...input,acceptsPaperRisk:false},{...input,consent:'YES'},
  {...input,maxNotional:'0'},{...input,expiresAtMs:now+1000}]){
  const ctx=fake();await assert.rejects(run(ctx,bad));assert.equal(ctx.names.length,0);
 }
 await assert.rejects(run(fake(),input,{...env,VERCEL_ENV:'production'}),/R81_RISK_APPROVAL_DISABLED/);
});
test('R81 blocks forged owner, stale connection or concurrent kill through CAS',async()=>{
 for(const o of [{ownerId:conn},{connectionOwner:conn},{expired:true},{rev:0},{activated:false}]){
  const ctx=fake(o);await assert.rejects(run(ctx));
  assert.equal(ctx.names.some(x=>x.name==='jenios_r80_read_paper_safety'),false);
 }
});
test('R81 SQL restricts owner activation and registration to service role and shared row locks',()=>{
 const sql=readFileSync(new URL('../supabase/review/jenios_r81_paper_owner_risk.sql',import.meta.url),'utf8');
 for(const pattern of [/enable row level security/i,/from public,anon,authenticated,service_role/i,
  /grant execute on function public\.jenios_r81_activate_paper_owner_risk[\s\S]*to service_role/i,
  /s\.revision=p_expected_revision/i,/s\.status='PAUSED'/i,
  /for update of s/i,/jenios_r81_register_signed_paper_permit/,
  /p_notional_units::numeric <= s\.max_notional_units::numeric/i])
  assert.match(sql,pattern);
 assert.doesNotMatch(sql,/security definer/i);
});
