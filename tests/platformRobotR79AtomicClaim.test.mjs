import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {generateKeyPairSync,sign} from 'node:crypto';
import {createR79PaperApprovalStore} from '../lib/platform/connections/paper-approval-store-r79.mjs';
import {canonicalR78PaperPermit,submitSignedR78PaperOnce} from '../lib/platform/connections/paper-signed-authorization-r78.mjs';
import {units} from '../lib/platform/pilot-prep/contracts.mjs';

const now=1793091600000;
const owner='4d238a7a-8c7b-4d8e-9a10-1c5c82db59a7';
const connection='50b85e9d-339c-4d32-b2bf-82c467673832';
const approval='4528a72f-c988-45cc-a9f3-7a28d98b40ac';
const permit={schema:'JENIOS_R78_SIGNED_PAPER_PERMIT_V1',approvalId:approval,
 ownerUserId:owner,connectionId:connection,accountDigest:'e'.repeat(64),
 clientOrderId:'jenios-r79-client-order',mode:'direct',side:'buy',symbol:'AAPL',
 maxNotionalUnits:units('150').toString(),issuedAtMs:now-1000,expiresAtMs:now+120000,
 environment:'paper'};
const {publicKey,privateKey}=generateKeyPairSync('ed25519');
const env={VERCEL_ENV:'preview',JENIOS_REAL_EXECUTION_ENABLED:'false',
 JENIOS_PRIVATE_PAPER_REHEARSAL:'true',JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED:'true',
 JENIOS_PRIVATE_PAPER_EXECUTOR:'true',
 JENIOS_R78_PAPER_APPROVAL_VERIFY_KEY:publicKey.export({format:'der',type:'spki'}).toString('base64')};
const signature=sign(null,Buffer.from(canonicalR78PaperPermit(permit)),privateKey).toString('base64');
const session={userId:owner,authenticated:true,diagnosticCompleted:true};
const storedConnection={id:connection,user_id:owner,provider:'alpaca',environment:'paper',
 status:'active',revoked:false,external_digest:permit.accountDigest};
const order={clientOrderId:permit.clientOrderId,mode:'direct',side:'buy',symbol:'AAPL',
 quantity:'1',entry:'100',stop:'98',target:'104'};
const args={permit,signature,session,storedConnection,order,nowMs:now};
const signedScope={approvalId:approval,ownerUserId:owner,connectionId:connection,
 clientOrderId:permit.clientOrderId,permitSha256:'f'.repeat(64),expiresAtMs:permit.expiresAtMs};
const row=scope=>({approval_id:scope.approvalId,owner_user_id:scope.ownerUserId,
 connection_id:scope.connectionId,client_order_id:scope.clientOrderId,permit_sha256:scope.permitSha256,
 expires_at:new Date(scope.expiresAtMs).toISOString(),
 status:'CLAIMED',used_at:new Date(now).toISOString(),revoked_at:null,
 source:'PLATFORM_AUTH_SERVER_VERIFIED'});
const rpcStub=({throwError=false,duplicate=false}={})=>{
 let claimed=false;const calls=[];
 const db={async rpc(name,vars){calls.push({name,vars});
  if(throwError)throw Error('internal database secret');
  if(name==='jenios_r79_claim_paper_approval'){
   if(duplicate||claimed)return {data:[],error:null};
   claimed=true;
   return {data:[row({approvalId:vars.p_approval_id,ownerUserId:vars.p_owner_user_id,
    connectionId:vars.p_connection_id,clientOrderId:vars.p_client_order_id,
    permitSha256:vars.p_permit_sha256,expiresAtMs:Date.parse(vars.p_expires_at)})],error:null};
  }
  if(name==='jenios_r79_revoke_paper_approval')return {data:!claimed,error:null};
  throw Error('unexpected RPC');
 }};
 return {db,calls};
};
test('R79 queries one atomic Postgres claim RPC with signed owner, account and order',async()=>{
 const {db,calls}=rpcStub();
 const result=await createR79PaperApprovalStore(db).claimApprovedForExecution(signedScope);
 assert.equal(result.status,'CLAIMED');
 assert.equal(result.ownerUserId,owner);
 assert.equal(result.usedAtMs,now);
 assert.equal(calls.length,1);
 assert.equal(calls[0].name,'jenios_r79_claim_paper_approval');
 assert.deepEqual(calls[0].vars,{p_approval_id:approval,p_owner_user_id:owner,
  p_connection_id:connection,p_client_order_id:permit.clientOrderId,
  p_permit_sha256:'f'.repeat(64),p_expires_at:new Date(permit.expiresAtMs).toISOString()});
});
test('R79 missing approval and database unavailable fail closed with no misleading success',async()=>{
 const {db}=rpcStub({duplicate:true});
 assert.equal(await createR79PaperApprovalStore(db).claimApprovedForExecution(signedScope),null);
 const bad=rpcStub({throwError:true});
 await assert.rejects(createR79PaperApprovalStore(bad.db).claimApprovedForExecution(signedScope),/R79_PRIVATE_DATABASE_UNAVAILABLE/);
 assert.throws(()=>createR79PaperApprovalStore(null),/R79_PRIVATE_DATABASE_REQUIRED/);
 await assert.rejects(createR79PaperApprovalStore(db).claimApprovedForExecution({...signedScope,ownerUserId:'forged'}),/R79_APPROVAL_SCOPE_INVALID/);
});
test('R79 forged or missing DB receipt never authorizes submission',async()=>{
 const fake={rpc:async()=>({data:[{...row(signedScope),status:'APPROVED'}],error:null})};
 await assert.rejects(createR79PaperApprovalStore(fake).claimApprovedForExecution(signedScope),/R79_CLAIM_RECEIPT_INVALID/);
 const tampered={rpc:async()=>({data:[{...row(signedScope),permit_sha256:'0'.repeat(64)}],error:null})};
 await assert.rejects(createR79PaperApprovalStore(tampered).claimApprovedForExecution(signedScope),/R79_CLAIM_RECEIPT_INVALID/);
});
test('R79 can revoke only an unconsumed approval; no broker cancellation',async()=>{
 const {db,calls}=rpcStub();
 const store=createR79PaperApprovalStore(db);
 const revoked=await store.revokePending(approval,owner);
 assert.deepEqual(revoked,{revoked:true,brokerOrdersCancelled:false,liveExecution:false});
 assert.equal(calls[0].name,'jenios_r79_revoke_paper_approval');
 await store.claimApprovedForExecution(signedScope);
 const tooLate=await store.revokePending(approval,owner);
 assert.equal(tooLate.revoked,false);
 await assert.rejects(store.revokePending('bad',owner),/R79_APPROVAL_SCOPE_INVALID/);
});
test('R79 signature validation happens before the database is touched',async()=>{
 const {db,calls}=rpcStub();
 await assert.rejects(submitSignedR78PaperOnce({...args,signature:'invalid'},
  {env,approvalStore:createR79PaperApprovalStore(db)}),/R78_SIGNATURE_INVALID/);
 assert.equal(calls.length,0);
});
test('R79 mock concurrent workers claim one approval; only one can delegate Paper once',async()=>{
 const {db,calls}=rpcStub();
 let submitted=0;
 const approved=createR79PaperApprovalStore(db);
 // The RPC stub models a single Postgres row transitioning once.
 const paperExecutor=async()=>{submitted++;return {state:'ACK',paperOnly:true,
  liveExecution:false,autoResubmitAllowed:false};};
 const results=await Promise.allSettled([
  submitSignedR78PaperOnce(args,{env,approvalStore:approved,ledger:{},paperExecutor}),
  submitSignedR78PaperOnce(args,{env,approvalStore:approved,ledger:{},paperExecutor})
 ]);
 assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
 assert.equal(results.filter(x=>x.status==='rejected').length,1);
 assert.equal(calls.length,2);
 assert.equal(submitted,1);
});
test('R79 a failed downstream transport cannot reuse a consumed consent',async()=>{
 const {db}=rpcStub();const store=createR79PaperApprovalStore(db);
 let attempts=0;
 await assert.rejects(submitSignedR78PaperOnce(args,{env,approvalStore:store,ledger:{},
  paperExecutor:async()=>{attempts++;throw Error('broker timeout');}}));
 await assert.rejects(submitSignedR78PaperOnce(args,{env,approvalStore:store,ledger:{},
  paperExecutor:async()=>{attempts++;throw Error('second broker attempt');}}),/R78_DURABLE_CONSENT_MISMATCH/);
 assert.equal(attempts,1);
});
test('R79 SQL proves RLS, service-only functions, unique owner/order and DB-time CAS',()=>{
 const sql=readFileSync(new URL('../supabase/migrations/20261027091500_jenios_robot_r79_atomic_paper_approval.sql',import.meta.url),'utf8');
 for(const re of [
  /jenios_robot_paper_approvals_r79/,
  /unique\s*\(owner_user_id,connection_id,client_order_id\)/i,
  /enable row level security/i,
  /revoke all on table[\s\S]*from public,anon,authenticated,service_role/i,
  /grant select,insert,update on table[\s\S]*to service_role/i,
  /security invoker/i,
  /set search_path = ''/i,
  /grant execute on function public\.jenios_r79_claim_paper_approval[\s\S]*to service_role/i,
  /and a\.used_at is null/i,
  /and a\.revoked_at is null/i,
  /and a\.expires_at > statement_timestamp\(\)/i,
  /and c\.user_id = a\.owner_user_id/i,
  /c\.environment = 'paper'/i,
  /c\.identity_verified is true/i,
  /set status = 'CLAIMED', used_at = statement_timestamp\(\)/i,
  /jenios_r79_revoke_paper_approval/
 ])assert.match(sql,re);
 assert.doesNotMatch(sql,/security definer|grant execute[\s\S]*to authenticated/i);
});
