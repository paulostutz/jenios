import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createR80PaperSafetyStore} from '../lib/platform/connections/paper-safety-store-r80.mjs';
const owner='4d238a7a-8c7b-4d8e-9a10-1c5c82db59a7',connection='50b85e9d-339c-4d32-b2bf-82c467673832',time='2026-10-27T13:00:00.000Z';
const row={owner_user_id:owner,connection_id:connection,status:'PAUSED',kill_switch_engaged:true,
 paper_consent_enabled:false,live_execution_enabled:false,max_notional_units:null,
 risk_approved_at:null,risk_expires_at:null,approval_source:null,checked_at:time};
test('R80 service-role read maps DB timestamp and owner binding, never defaults to active',async()=>{
 const calls=[];const db={rpc:async(name,input)=>{calls.push([name,input]);return {data:[row],error:null};}};
 const store=createR80PaperSafetyStore(db);
 const s=await store.readSafety({ownerUserId:owner,connectionId:connection});
 assert.equal(s.status,'PAUSED');assert.equal(s.killSwitchEngaged,true);
 assert.equal(s.checkedAtMs,Date.parse(time));assert.equal(s.riskApprovedAtMs,null);
 assert.deepEqual(calls[0],['jenios_r80_read_paper_safety',{p_owner_user_id:owner,p_connection_id:connection}]);
});
test('R80 store treats missing, forged, malformed, unavailable receipts as denied',async()=>{
 const scope={ownerUserId:owner,connectionId:connection};
 assert.equal(await createR80PaperSafetyStore({rpc:async()=>({data:[]})}).readSafety(scope),null);
 for(const v of [{...row,owner_user_id:connection},{...row,checked_at:'bad'},
  {...row,live_execution_enabled:true},{...row,risk_approved_at:'bogus'}]){
  await assert.rejects(createR80PaperSafetyStore({rpc:async()=>({data:[v]})}).readSafety(scope),
   /R80_INVALID_SAFETY_RECEIPT/);
 }
 await assert.rejects(createR80PaperSafetyStore({rpc:async()=>{throw Error('secret');}}).readSafety(scope),
  /R80_PRIVATE_DATABASE_UNAVAILABLE/);
 assert.throws(()=>createR80PaperSafetyStore(null),/R80_PRIVATE_DATABASE_REQUIRED/);
});
test('R80 kill RPC pauses and explicitly reports broker cancellation is NOT completed',async()=>{
 let name;
 const store=createR80PaperSafetyStore({rpc:async(n)=>{name=n;return {data:true,error:null};}});
 const r=await store.engageKill({ownerUserId:owner,connectionId:connection});
 assert.equal(name,'jenios_r80_engage_paper_kill');assert.equal(r.paused,true);
 assert.equal(r.ordersCancelled,false);assert.equal(r.positionsClosed,false);
});
test('R80 schema is service-only, defaults paused, revokes pending and lock-serializes with claim',()=>{
 const sql=readFileSync(new URL('../supabase/review/jenios_r80_paper_safety.sql',import.meta.url),'utf8');
 for(const re of [/jenios_robot_paper_safety_r80/,/default 'PAUSED'/i,
  /kill_switch_engaged boolean not null default true/i,/paper_consent_enabled boolean not null default false/i,
  /live_execution_enabled boolean not null default false/i,/enable row level security/i,
  /revoke all on table[\\s\\S]*from public,anon,authenticated,service_role/i,
  /grant select,insert,update on table[\\s\\S]*to service_role/i,
  /jenios_r80_engage_paper_kill/,/set status='REVOKED',revoked_at=statement_timestamp\\(\\)/i,
  /for update of s/i,/if not found then return; end if/i,
  /jenios_r79_claim_paper_approval/]) assert.match(sql,re);
 assert.doesNotMatch(sql,/security definer/i);
});
