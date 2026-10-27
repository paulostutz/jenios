import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,verify} from 'node:crypto';
import {canonicalR78PaperPermit} from '../lib/platform/connections/paper-signed-authorization-r78.mjs';
import {issueR80PaperPermit} from '../lib/platform/connections/paper-permit-issuer-r80.mjs';
const user='4d238a7a-8c7b-4d8e-9a10-1c5c82db59a7',connection='50b85e9d-339c-4d32-b2bf-82c467673832';
const now=1793091600000;
const {privateKey,publicKey}=generateKeyPairSync('ed25519');
const env={VERCEL_ENV:'preview',JENIOS_REAL_EXECUTION_ENABLED:'false',
 JENIOS_R80_PRIVATE_ISSUER_ENABLED:'true',
 JENIOS_R80_PRIVATE_ED25519_SIGNING_KEY:privateKey.export({format:'der',type:'pkcs8'}).toString('base64')};
const input={accessToken:'valid-long-platform-auth-token-synthetic-not-real',
 connectionId:connection,clientOrderId:'r80-permit-1',mode:'direct',
 side:'buy',symbol:'AAPL',quantity:'1',entry:'100',
 consent:'I_AUTHORIZE_THIS_ALPACA_PAPER_ORDER'};
function store({userId=user,confirmed=true,status='ACTIVE',killed=false,expiry=now+600000,
  connectionUser=user,accountStatus='active',failInsert=false}={}){
 let inserted=0,asked=0;
 const db={auth:{getUser:async()=>({data:{user:{id:userId,is_anonymous:false,
  email_confirmed_at:confirmed?'2026-10-01T00:00:00.000Z':null}}})},
  from(table){
   let op='read';
   return {
    select(){return this;},eq(){return this;},
    maybeSingle:async()=>({data:{id:connection,user_id:connectionUser,
     provider:'alpaca',environment:'paper',status:accountStatus,
     identity_verified:true,external_digest:'a'.repeat(64),
     last_sync_at:new Date(now-1000).toISOString()}}),
    insert(body){op='insert';inserted++;return {
     select(){return this;},async single(){return failInsert?
       {data:null,error:{code:'DB_ERROR'}}:
       {data:{approval_id:body.approval_id,status:'APPROVED'},error:null};}
    };}
   };
  },
  async rpc(name,vars){
   if(name==='jenios_r81_register_signed_paper_permit'){
    inserted++;
    assert.equal(vars.p_owner_user_id,user);
    assert.equal(vars.p_connection_id,connection);
    return {data:!failInsert,error:null};
   }
   asked++;assert.equal(name,'jenios_r80_read_paper_safety');
   return {data:[{owner_user_id:user,connection_id:connection,status,
    kill_switch_engaged:killed,paper_consent_enabled:true,
    live_execution_enabled:false,max_notional_units:'15000000000',
    risk_approved_at:new Date(now-100000).toISOString(),
    risk_expires_at:new Date(expiry).toISOString(),
    approval_source:'PLATFORM_OWNER_SERVER_VERIFIED',
    checked_at:new Date(now).toISOString()}],error:null};
  }
 };
 return {db,get inserted(){return inserted;},get asked(){return asked;}};
}
const issue=(db,e=env,p=input)=>issueR80PaperPermit(p,{db,env:e,clock:()=>now,uuid:()=> '4528a72f-c988-45cc-a9f3-7a28d98b40ac'});
test('R81 signed Paper permit is atomically registered against owner risk before release',async()=>{
 const ctx=store();
 const result=await issue(ctx.db);
 assert.equal(ctx.inserted,1);assert.equal(ctx.asked,1);
 assert.equal(result.permit.ownerUserId,user);assert.equal(result.permit.connectionId,connection);
 assert.equal(result.permit.environment,'paper');assert.equal(result.liveExecution,false);
 assert.equal(verify(null,Buffer.from(canonicalR78PaperPermit(result.permit)),
  publicKey,Buffer.from(result.signature,'base64')),true);
});
test('R80 issuer refuses production, missing private key and missing consent',async()=>{
 for(const e of [{...env,VERCEL_ENV:'production'},
  {...env,JENIOS_R80_PRIVATE_ISSUER_ENABLED:'false'}])
  await assert.rejects(issue(store().db,e),/R80_ISSUER_DISABLED/);
 await assert.rejects(issue(store().db,{...env,JENIOS_R80_PRIVATE_ED25519_SIGNING_KEY:''}),
   /R80_SIGNING_KEY_UNAVAILABLE/);
 await assert.rejects(issue(store().db,env,{...input,consent:'yes'}),
   /R80_EXPLICIT_PAPER_CONSENT_REQUIRED/);
});
test('R80 issuer rejects forged owner, unconfirmed email, revoked account and expired risks',async()=>{
 for(const opt of [{userId:connection},{confirmed:false},{connectionUser:connection},
  {accountStatus:'revoked'},{status:'PAUSED'},{killed:true},{expiry:now-1}]){
  const ctx=store(opt);
  await assert.rejects(issue(ctx.db));
  assert.equal(ctx.inserted,0);
 }
});
test('R81 issuer never returns a signed permit if atomic consent registration fails',async()=>{
 const ctx=store({failInsert:true});
 await assert.rejects(issue(ctx.db),/R80_APPROVAL_PERSISTENCE_FAILED/);
});
test('R80 issuer rejects oversized notional and sell/invalid symbol',async()=>{
 const ctx=store();
 await assert.rejects(issue(ctx.db,env,{...input,quantity:'10'}),/R80_RISK_APPROVAL_REQUIRED/);
 await assert.rejects(issue(ctx.db,env,{...input,side:'sell'}),/R80_EXPLICIT_PAPER_CONSENT_REQUIRED/);
 assert.equal(ctx.inserted,0);
});
