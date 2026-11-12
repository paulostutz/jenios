import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHmac} from 'node:crypto';
import {
 stageR83PrivateLiveConnection,verifyR83PrivateLiveConnection,
 inspectR83PrivateLiveConnection,revokeR83PrivateLiveConnection
} from '../lib/platform/connections/alpaca-live-private-worker-r83.mjs';

const owner='4d238a7a-8c7b-4d8e-9a10-1c5c82db59a7';
const other='0d8caf6a-4d0a-4f79-b4d5-fd3087ea834c';
const connection='50b85e9d-339c-4d32-b2bf-82c467673832';
const account='alpaca-live-user-101';
const token='real-session-verified-only-in-test-long';
const now=1793091600000;
const env={
 VERCEL_ENV:'preview',JENIOS_R83_PRIVATE_NODE_WORKER:'true',
 JENIOS_R83_LIVE_VAULT_ENABLED:'true',
 JENIOS_R83_ALPACA_THIRD_PARTY_APP_APPROVED:'true',
 JENIOS_R82_PRIVATE_NODE_WORKER:'true',
 JENIOS_R82_ALPACA_LIVE_READ_ENABLED:'true',
 JENIOS_REAL_EXECUTION_ENABLED:'false',
 JENIOS_R82_ALPACA_LIVE_ORDER_EXECUTION_ENABLED:'false',
 JENIOS_R83_LIVE_VAULT_KEY_ID:'k1',
 JENIOS_R83_LIVE_VAULT_KEY_B64:Buffer.alloc(32,11).toString('base64'),
 JENIOS_R82_LIVE_ACCOUNT_DIGEST_KEY_B64:Buffer.alloc(32,12).toString('base64')
};
const consent='I_AUTHORIZE_JENIOS_ALPACA_LIVE_READ_ONLY';
const apiKey={kind:'ALPACA_API_KEY_PAIR',apiKey:'syntheticAccountLiveKeyID123',
 secret:'syntheticAccountLiveSecretKeyValue123'};
const oauth={kind:'ALPACA_OAUTH_ACCESS_TOKEN',
 accessToken:'syntheticApprovedThirdPartyOAuthTokenNoTrading123'};
function fake({userId=owner,confirmed=true,accountId=account,
 revokeDuringVerify=false,failMark=false,failRead=false}={}){
 let row=null;
 let orderRequests=0;
 const calls=[];
 const db={
  auth:{getUser:async(_token)=>({data:{user:{id:userId,
   is_anonymous:false,email_confirmed_at:confirmed?'2026-10-01':null}},error:null})},
  from(name){
   assert.equal(name,'jenios_robot_live_connections_r83');
   return {
    insert(payload){
     calls.push({type:'insert'});
     row={...payload,revision:1};
     return {select(){return this;},async single(){return {data:{
      id:row.id,owner_user_id:row.owner_user_id,status:'STAGED',revision:1},error:null};}};
    },
    select(){return this;},
    eq(field,value){
     calls.push({type:'eq',field,value});
     if(field==='owner_user_id'&&value!==row?.owner_user_id)throw Error('CROSS_OWNER_QUERY');
     if(field==='id'&&value!==row?.id)throw Error('CROSS_CONNECTION_QUERY');
     return this;
    },
    async maybeSingle(){
     if(failRead)throw Error('DATA_FAILURE');
     return {data:row,error:null};
    }
   };
  },
  async rpc(name,vars){
   calls.push({type:'rpc',name,vars});
   if(!row||row.id!==vars.p_connection_id||row.owner_user_id!==vars.p_owner_user_id)
    return {data:false,error:null};
   if(name==='jenios_r83_mark_live_read_verified'){
    if(revokeDuringVerify){
     row.status='REVOKED';row.credential_box=null;return {data:false,error:null};
    }
    if(failMark||row.status!=='STAGED'||row.revision!==vars.p_expected_revision)
     return {data:false,error:null};
    row.status='READ_VERIFIED';row.identity_verified=true;
    row.external_digest=vars.p_external_digest;
    row.source='JENIOS_PRIVATE_LIVE_VAULT_VERIFIED';
    row.last_sync_at=new Date(now).toISOString();
    row.revision++;return {data:true,error:null};
   }
   if(name==='jenios_r83_note_live_read'){
    if(row.status!=='READ_VERIFIED'||row.revision!==vars.p_expected_revision||
       row.external_digest!==vars.p_external_digest)
     return {data:false,error:null};
    row.last_sync_at=new Date(now).toISOString();row.revision++;
    return {data:true,error:null};
   }
   if(name==='jenios_r83_revoke_live_connection'){
    if(row.status==='REVOKED')return {data:false,error:null};
    row.status='REVOKED';row.credential_box=null;row.identity_verified=false;
    row.external_digest=null;row.last_sync_at=null;row.revision++;
    return {data:true,error:null};
   }
   throw Error('UNRECOGNIZED_RPC');
  }
 };
 const fetcher=async(url,init)=>{
  calls.push({type:'broker',url,method:init.method,
   authOAuth:Boolean(init.headers.Authorization)});
  if(init.method!=='GET'||new URL(url).host!=='api.alpaca.markets'){
   orderRequests++;throw Error('NETWORK_ORDER_DENIED');
  }
  if(url.endsWith('/v2/account')){
   return new Response(JSON.stringify({id:accountId,status:'ACTIVE',trading_blocked:false}));
  }
  if(url.endsWith('/v2/clock')){
   return new Response(JSON.stringify({timestamp:new Date(now).toISOString(),is_open:true}));
  }
  throw Error('PATH_NOT_ALLOWED');
 };
 return {db,fetcher,calls,get row(){return row;},get orderRequests(){return orderRequests;}};
}
async function stage(testCtx,credentials=apiKey,overrides={}){
 return stageR83PrivateLiveConnection({
  accessToken:token,credentials,consent,...overrides
 },{db:testCtx.db,env,uuid:()=>connection});
}
async function verify(testCtx,e=env){
 return verifyR83PrivateLiveConnection({accessToken:token,connectionId:connection},
  {db:testCtx.db,env:e,fetcher:testCtx.fetcher,clock:()=>now});
}
async function read(testCtx,e=env){
 return inspectR83PrivateLiveConnection({accessToken:token,connectionId:connection},
  {db:testCtx.db,env:e,fetcher:testCtx.fetcher,clock:()=>now});
}

test('R83 private worker stages, verifies and reads a Live account via official GET only',async()=>{
 const t=fake();
 const staged=await stage(t);
 assert.equal(staged.status,'STAGED');assert.equal(staged.realOrdersEnabled,false);
 assert.equal(t.row.identity_verified,false);assert.equal(t.row.external_digest,null);
 assert.equal(JSON.stringify(t.row.credential_box).includes(apiKey.secret),false);
 const verified=await verify(t);
 assert.equal(verified.status,'READ_VERIFIED');assert.equal(verified.liveOrdersEnabled,false);
 const expected=createHmac('sha256',Buffer.alloc(32,12))
  .update('jenios-live-readonly-r82-v1\0'+owner+'\0'+account).digest('hex');
 assert.equal(t.row.external_digest,expected);
 const result=await read(t);
 assert.equal(result.accountReadConfirmed,true);
 assert.equal(result.tradingPermissionsCertified,false);assert.equal(result.riskLimitsApproved,false);
 assert.equal(result.liveOrdersEnabled,false);assert.equal(result.ordersSent,0);
 assert.equal(JSON.stringify(result).includes(apiKey.secret),false);
 assert.equal(JSON.stringify(result).includes(account),false);
 assert.equal(t.orderRequests,0);
 assert.deepEqual(t.calls.filter(x=>x.type==='broker').map(x=>x.method),['GET','GET','GET','GET']);
});

test('R83 private worker supports owner-scoped OAuth only after explicit external app approval',async()=>{
 const t=fake();
 await stage(t,oauth);
 await verify(t);
 const result=await read(t);
 assert.equal(result.liveOrdersEnabled,false);
 assert.equal(t.calls.filter(x=>x.type==='broker').every(x=>x.authOAuth),true);
});
test('R83 stages nothing without owner login, actual consent or third-party app approval',async()=>{
 for(const [inputPatch,envPatch] of [
  [{consent:'yes'},{}],
  [{}, {JENIOS_R83_ALPACA_THIRD_PARTY_APP_APPROVED:'false'}],
  [{}, {JENIOS_R83_PRIVATE_NODE_WORKER:'false'}],
  [{}, {JENIOS_REAL_EXECUTION_ENABLED:'true'}]
 ]){
  const t=fake();
  await assert.rejects(stageR83PrivateLiveConnection({
   accessToken:token,consent,credentials:apiKey,...inputPatch
  },{db:t.db,env:{...env,...envPatch},uuid:()=>connection}));
  assert.equal(t.row,null);assert.equal(t.calls.filter(x=>x.type==='broker').length,0);
 }
 for(const t of [fake({confirmed:false}),fake({userId:'bad'})]){
  await assert.rejects(stage(t),/R83_PLATFORM_AUTH_REQUIRED/);
 }
});
test('R83 staged GET cannot certify account if the connection was revoked during verification',async()=>{
 const t=fake({revokeDuringVerify:true});
 await stage(t);
 await assert.rejects(verify(t),/R83_READ_VERIFICATION_CONFLICT/);
 assert.equal(t.row.status,'REVOKED');
 assert.equal(t.row.credential_box,null);
 assert.equal(t.orderRequests,0);
});
test('R83 live account never becomes READ_VERIFIED on missing broker read or local secret failure',async()=>{
 const t=fake({failMark:true});
 await stage(t);
 await assert.rejects(verify(t),/R83_READ_VERIFICATION_CONFLICT/);
 assert.equal(t.row.status,'STAGED');
 const wrongKey={...env,JENIOS_R83_LIVE_VAULT_KEY_B64:Buffer.alloc(32,88).toString('base64')};
 await assert.rejects(verifyR83PrivateLiveConnection({
  accessToken:token,connectionId:connection
 },{db:t.db,env:wrongKey,fetcher:t.fetcher,clock:()=>now}),/R83_VAULT_DECRYPT_DENIED/);
 assert.equal(t.row.identity_verified,false);
});
test('R83 local revoke remains available even when external provider approval/key removed',async()=>{
 const t=fake();
 await stage(t);await verify(t);
 const response=await revokeR83PrivateLiveConnection({
  accessToken:token,connectionId:connection
 },{db:t.db,env:{
  VERCEL_ENV:'preview',JENIOS_R83_PRIVATE_NODE_WORKER:'true',
  JENIOS_REAL_EXECUTION_ENABLED:'false',
  JENIOS_R82_ALPACA_LIVE_ORDER_EXECUTION_ENABLED:'false'
 }});
 assert.equal(response.revoked,true);
 assert.equal(response.localCredentialsDestroyed,true);
 assert.equal(response.providerRevocationRequired,true);
 assert.equal(response.ordersCancelled,false);assert.equal(response.positionsClosed,false);
 assert.equal(t.row.credential_box,null);
 await assert.rejects(read(t),/R83_PRIVATE_STORE_SCOPE_MISMATCH/);
 assert.equal(t.orderRequests,0);
});
test('R83 fails closed on tenant replacement and broker account identity changed',async()=>{
 const t=fake({accountId:'some-other-account'});
 await stage(t);
 await verify(t);
 assert.equal(t.row.status,'READ_VERIFIED');
 // The authorized connection has been bound to this account; broker must continue to match.
 const t2=fake({accountId:'changed-account'});
 t2.db.from=t.db.from;
 await assert.rejects(read(t2),/R82_LIVE_ACCOUNT_CHANGED/);
});
test('R83 worker has no HTTP route, no order dispatch and no secret logging',()=>{
 const source=readFileSync(new URL('../lib/platform/connections/alpaca-live-private-worker-r83.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(source,/method\s*:\s*['"]POST['"]|\/v2\/orders|console\.|submitAlpacaPaperOnce|submitRealBrokerOrder/);
 assert.match(source,/JENIOS_R83_ALPACA_THIRD_PARTY_APP_APPROVED/);
});
