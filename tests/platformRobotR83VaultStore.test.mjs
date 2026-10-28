import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createR83PrivateLiveStore} from '../lib/platform/connections/alpaca-live-store-r83.mjs';
import {sealR83LiveCredentials} from '../lib/platform/connections/alpaca-live-vault-r83.mjs';

const owner='4d238a7a-8c7b-4d8e-9a10-1c5c82db59a7',
 conn='50b85e9d-339c-4d32-b2bf-82c467673832',
 other='0d8caf6a-4d0a-4f79-b4d5-fd3087ea834c';
const env={VERCEL_ENV:'preview',JENIOS_R83_PRIVATE_NODE_WORKER:'true',
 JENIOS_R83_LIVE_VAULT_ENABLED:'true',JENIOS_REAL_EXECUTION_ENABLED:'false',
 JENIOS_R82_ALPACA_LIVE_ORDER_EXECUTION_ENABLED:'false',
 JENIOS_R83_LIVE_VAULT_KEY_ID:'k1',
 JENIOS_R83_LIVE_VAULT_KEY_B64:Buffer.alloc(32,21).toString('base64'),
 JENIOS_R82_LIVE_ACCOUNT_DIGEST_KEY_B64:Buffer.alloc(32,19).toString('base64')};
const scope={ownerUserId:owner,connectionId:conn};
const credentials={kind:'ALPACA_API_KEY_PAIR',apiKey:'syntheticApiKeyForLive123',
 secret:'syntheticLiveSecretOnlyNOTREALKEY'};
const box=sealR83LiveCredentials({...scope,kind:'ALPACA_API_KEY_PAIR'},credentials,{env});
const stub=({scopeOwner=owner,kind='ALPACA_API_KEY_PAIR',status='STAGED',digest=null}={})=>{
 const calls=[];
 const row={id:conn,owner_user_id:scopeOwner,provider:'alpaca',environment:'live',
  credential_kind:kind,credential_box:box,status,identity_verified:status==='READ_VERIFIED',
  external_digest:digest,source:status==='STAGED'?'JENIOS_R83_PRIVATE_OWNER_AUTH':
   'JENIOS_PRIVATE_LIVE_VAULT_VERIFIED',
  last_sync_at:status==='READ_VERIFIED'?'2026-10-27T13:00:00Z':null,revision:1};
 const db={
  from(table){
   assert.equal(table,'jenios_robot_live_connections_r83');
   return {
    insert(payload){calls.push({action:'insert',payload});
     return {select(){return this;},async single(){return {
      data:{id:conn,owner_user_id:owner,status:'STAGED',revision:1},error:null
     };}};
    },
    select(){calls.push({action:'select'});return this;},
    eq(k,v){calls.push({action:'eq',k,v});return this;},
    async maybeSingle(){return {data:row,error:null};}
   };
  },
  async rpc(name,params){calls.push({action:'rpc',name,params});return {data:true,error:null};}
 };
 return {db,calls,row};
};
test('R83 stages a sealed box with no verified owner, risk or order permission',async()=>{
 const s=stub();
 const result=await createR83PrivateLiveStore(s.db,{env}).stage({...scope,envelope:box});
 assert.equal(result.status,'STAGED');assert.equal(result.liveExecution,false);
 assert.equal(s.calls[0].payload.credential_box.kind,'ALPACA_API_KEY_PAIR');
 assert.equal(JSON.stringify(s.calls[0].payload).includes(credentials.secret),false);
 assert.equal(s.calls[0].payload.identity_verified,false);
 assert.equal(s.calls[0].payload.external_digest,null);
});
test('R83 sealed reads filter exact owner and reject another tenant or revoked row',async()=>{
 const s=stub();
 const r=await createR83PrivateLiveStore(s.db,{env}).loadSealed(scope);
 assert.equal(r.kind,'ALPACA_API_KEY_PAIR');assert.equal(r.meta.status,'STAGED');
 assert.deepEqual(s.calls.filter(x=>x.action==='eq'),[
  {action:'eq',k:'owner_user_id',v:owner},{action:'eq',k:'id',v:conn}]);
 await assert.rejects(createR83PrivateLiveStore(stub({scopeOwner:other}).db,{env})
   .loadSealed(scope),/R83_PRIVATE_STORE_SCOPE_MISMATCH/);
 await assert.rejects(createR83PrivateLiveStore(stub({status:'REVOKED'}).db,{env})
   .loadSealed(scope),/R83_PRIVATE_STORE_SCOPE_MISMATCH/);
});
test('R83 verification is revision-scoped; revoke clears credentials in one SQL RPC',async()=>{
 const s=stub();
 const store=createR83PrivateLiveStore(s.db,{env});
 const digest='b'.repeat(64);
 const v=await store.markReadVerified({...scope,expectedRevision:1,brokerDigest:digest});
 assert.equal(v.readVerified,true);
 await store.noteRead({...scope,expectedRevision:2,brokerDigest:digest});
 const r=await store.revoke(scope);
 assert.equal(r.revoked,true);assert.equal(r.ordersCancelled,false);
 assert.equal(r.providerRevocationRequired,true);
 assert.deepEqual(s.calls.filter(x=>x.action==='rpc').map(x=>x.name),[
  'jenios_r83_mark_live_read_verified','jenios_r83_note_live_read',
  'jenios_r83_revoke_live_connection'
 ]);
 assert.deepEqual(s.calls.filter(x=>x.action==='rpc')[0].params,{
  p_owner_user_id:owner,p_connection_id:conn,p_expected_revision:1,
  p_external_digest:digest
 });
});
test('R83 rejects unverified broker digest, forged store receipts and missing service role',async()=>{
 const s=stub({status:'READ_VERIFIED',digest:'bad'});
 await assert.rejects(createR83PrivateLiveStore(s.db,{env}).loadSealed(scope),
  /R83_PRIVATE_STORE_SCOPE_MISMATCH/);
 await assert.rejects(createR83PrivateLiveStore(stub().db,{env}).markReadVerified({
  ...scope,expectedRevision:0,brokerDigest:'bad'
 }),/R83_INVALID_VERIFICATION/);
 assert.throws(()=>createR83PrivateLiveStore(null,{env}),/R83_PRIVATE_DATABASE_REQUIRED/);
 assert.throws(()=>createR83PrivateLiveStore(stub().db,{
  env:{...env,JENIOS_REAL_EXECUTION_ENABLED:'true'}
 }),/R83_VAULT_DISABLED/);
});
test('R83 schema restricts all direct owner access, defaults STAGED and wipes on revoke',()=>{
 const sql=readFileSync(new URL('../supabase/review/jenios_r83_live_private_vault.sql',import.meta.url),'utf8');
 for(const pattern of [
  /jenios_robot_live_connections_r83/,/status text not null default 'STAGED'/,
  /credential_box jsonb/,/credential_box=null/,
  /enable row level security/i,/from public,anon,authenticated,service_role/i,
  /grant select,insert,update on public.jenios_robot_live_connections_r83 to service_role/i,
  /jenios_r83_mark_live_read_verified/,/jenios_r83_note_live_read/,
  /jenios_r83_revoke_live_connection/
 ])assert.match(sql,pattern);
 assert.doesNotMatch(sql,/security definer|grant .* to authenticated/i);
});
