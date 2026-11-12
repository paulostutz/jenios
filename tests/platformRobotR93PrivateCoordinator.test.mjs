import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PaperLedger} from '../lib/platform/pilot-prep/paper-ledger.mjs';
import {CORE_SHA} from '../lib/platform/pilot-prep/contracts.mjs';
import {encryptDemo} from '../lib/platform/connections/demo-vault.mjs';
import {alpacaPaperLedgerConnection,reserveAlpacaPaperProposal} from '../lib/platform/connections/alpaca-paper-risk-rehearsal.mjs';
import {reconcileR93PrivatePaperAfterRestart} from '../lib/platform/connections/paper-private-coordinator-r93.mjs';
const owner='4d238a7a-8c7b-4d8e-9a10-1c5c82db59a7';
const other='b8e32748-9c47-4eb1-9c5f-1a7cc0d2e496';
const id='50b85e9d-339c-4d32-b2bf-82c467673832',now=1793091600000;
const accessToken='synthetic-platform-auth-token-abc1234567';
const apiKey='synthetic-alpaca-paper-key-abc123456';
const secret='synthetic-alpaca-secret-key-abc123456';
const env={VERCEL_ENV:'preview',JENIOS_R93_PRIVATE_NODE_WORKER:'true',
 JENIOS_R93_READONLY_RECOVERY_ENABLED:'true',JENIOS_REAL_EXECUTION_ENABLED:'false',
 JENIOS_PRIVATE_PAPER_REHEARSAL:'true',JENIOS_PRIVATE_PAPER_RECOVERY_ENABLED:'true',
 JENIOS_PRIVATE_PAPER_EXECUTOR:'false',JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED:'false',
 JENIOS_R80_PRIVATE_ISSUER_ENABLED:'false',
 JENIOS_R82_ALPACA_LIVE_ORDER_EXECUTION_ENABLED:'false',
 JENIOS_R83_PRIVATE_NODE_WORKER:'false',JENIOS_PAY_PAYMENTS_ENABLED:'false',
 JENIOS_DEMO_CONNECTORS_ENABLED:'true',
 JENIOS_DEMO_VAULT_KEY_B64:Buffer.alloc(32,7).toString('base64')};
const connection={id,user_id:owner,provider:'alpaca',environment:'paper',
 status:'active',identity_verified:true,external_digest:'a'.repeat(64),
 last_sync_at:new Date(now-1000).toISOString(),
 created_at:new Date(now-100000).toISOString()};
const session={userId:owner,authenticated:true,diagnosticCompleted:true};
const order={clientOrderId:'r93-paper-test',mode:'direct',side:'buy',
 symbol:'AAPL',quantity:'1',entry:'100',stop:'98',target:'104'};
const proposal={session,storedConnection:connection,mode:'direct',order,nowMs:now,
 signal:{originalCoreSha256:CORE_SHA.engine,executionEnabled:false,
  mode:'direct',side:'buy',contextDigest:'a'.repeat(64),reviewStatus:'allow'},
 source:{provider:'alpaca',environment:'paper',accountDigest:connection.external_digest,
  accountAuthenticated:true,ownershipVerified:true,permissionsVerified:true,
  marketDataVerified:true,prospective:true,liveAccount:false,serverVerified:true},
 meta:{provider:'alpaca',id:'AAPL',marketType:'spot',base:'AAPL',quote:'USD',
  settlement:'USD',contractSize:'1',qtyStep:'1',minQty:'1',maxQty:'10',
  tickSize:'0.01',capturedAtMs:now-500,sourceSha256:'b'.repeat(64),quantityUnit:'base'},
 quote:{provider:'alpaca',instrument:'AAPL',receivedAtMs:now-200,
  sourceAtMs:now-200,bid:'99.98',ask:'100.02'},
 costs:{roundTripFeeBps:0,slippageBps:0,fundingCost:'0'}};
const limits={currency:'USD',ownerRisk:'5',accountRisk:'5',orderRisk:'4',
 notional:'1000',dailyLoss:'5',maxOrders:3};
function fixture({pending=false,ownerAuth=owner,diagnostic=true,connectionPatch={}}={}){
 const dir=mkdtempSync(join(tmpdir(),'jenios-r93-')),path=join(dir,'journal.db');
 let ledger=new PaperLedger(path);
 const bound=alpacaPaperLedgerConnection(owner,connection,{now,env});
 ledger.configure(session,bound,limits);
 if(pending){
  reserveAlpacaPaperProposal(proposal,{ledger,env});
  ledger.event(session,bound,order.clientOrderId,{
   id:'send-before-restart',kind:'SUBMITTING',atMs:now,cumulativeQuantity:'0'
  });
  ledger.close();ledger=new PaperLedger(path);
 }
 let reads=0,brokerQueries=0;
 const row={...connection,...connectionPatch,
  credential_box:encryptDemo({apiKey,secret},{userId:owner,id,provider:'alpaca',
    environment:'paper',kind:'credentials'},env)};
 const db={
  auth:{async getUser(){return {error:null,data:{user:{
   id:ownerAuth,is_anonymous:false,email_confirmed_at:'2026-10-01'
  }}};}},
  from(t){assert.equal(t,'jenios_platform_demo_broker_connections');brokerQueries++;
   let permitted=true;
   return {select(){return this;},eq(k,v){
    if(k==='id')permitted=permitted&&v===id;
    if(k==='user_id')permitted=permitted&&v===owner;
    return this;
   },async maybeSingle(){return {error:null,data:permitted?row:null};}};
  },
  async rpc(t){assert.equal(t,'jenios_r80_read_paper_safety');reads++;
   return {error:null,data:[{owner_user_id:owner,connection_id:id,
    status:'PAUSED',kill_switch_engaged:true,paper_consent_enabled:false,
    live_execution_enabled:false,max_notional_units:null,
    risk_approved_at:null,risk_expires_at:null,approval_source:null,
    checked_at:new Date(now).toISOString()}]};
  }
 };
 const verifyDiagnostic=async()=>({source:'JENIOS_PLATFORM_PRIVATE_DIAGNOSTIC',
  ownerUserId:owner,connectionId:id,verified:diagnostic,verifiedAtMs:now-1000});
 return {get ledger(){return ledger;},bound,row,db,verifyDiagnostic,
  get reads(){return reads;},get brokerQueries(){return brokerQueries;},
  cleanup(){ledger.close();rmSync(dir,{recursive:true,force:true});}};
}
const request={accessToken,connectionId:id};
function run(f,options={}){return reconcileR93PrivatePaperAfterRestart(request,{
 db:f.db,ledger:f.ledger,verifyDiagnostic:f.verifyDiagnostic,
 env,clock:()=>now+1,...options});}
test('R93 validates owner and safety; empty journal never decrypts vault',async()=>{
 const f=fixture();
 try{
  Object.defineProperty(f.row,'credential_box',{get(){throw Error('VAULT_READ_NOT_ALLOWED');}});
  const res=await run(f);
  assert.equal(res.ordersSent,0);assert.equal(res.paused,true);
  assert.deepEqual(res.reports,[]);assert.equal(f.reads,1);
  assert.equal(f.brokerQueries,1);
 }finally{f.cleanup();}
});
test('R93 restart recovers synthetic ACK while kill remains engaged',async()=>{
 const f=fixture({pending:true});
 try{
  let calls=0;
  const res=await run(f,{lookup:async x=>{
   calls++;assert.equal(x.verifiedUserId,owner);
   assert.equal(x.credentials.apiKey,apiKey);
   return {found:true,state:'ACK',manualReview:false,
    event:{id:'offline-ack',kind:'ACK',cumulativeQuantity:'0'}};
  }});
  assert.equal(calls,1);assert.equal(res.ordersSent,0);
  assert.equal(res.autoResubmitAllowed,false);assert.equal(res.paused,true);
  assert.equal(res.reports[0].state,'ACK');
  assert.equal(f.ledger.snapshot(session,f.bound)[0].state,'ACK');
  assert.equal(JSON.stringify(res).includes(secret),false);
 }finally{f.cleanup();}
});
test('R93 timeout stays UNKNOWN and holds risk; no automatic retry',async()=>{
 const f=fixture({pending:true});
 try{
  const res=await run(f,{lookup:async()=>({found:false,state:'UNKNOWN'})});
  assert.equal(res.ordersSent,0);assert.equal(res.requiresManualReview,true);
  assert.equal(f.ledger.snapshot(session,f.bound)[0].state,'UNKNOWN');
  assert.notEqual(f.ledger.snapshot(session,f.bound)[0].held,'0');
  assert.throws(()=>reserveAlpacaPaperProposal({...proposal,
   order:{...order,clientOrderId:'different'}},{ledger:f.ledger,env}),
   /RECONCILIATION_REQUIRED/);
 }finally{f.cleanup();}
});
test('R93 rejects forged owner, invalid diagnostic or wrong provider before lookup',async()=>{
 for(const opts of [
  {ownerAuth:other},{diagnostic:false},
  {connectionPatch:{provider:'binance'}},
  {connectionPatch:{environment:'live'}},
  {connectionPatch:{identity_verified:false}},
  {connectionPatch:{status:'revoked'}},
  {connectionPatch:{external_digest:'bad'}}
 ]){
  const f=fixture({...opts,pending:true});
  try{
   let calls=0;
   await assert.rejects(run(f,{lookup:async()=>{calls++;}}));
   assert.equal(calls,0);
  }finally{f.cleanup();}
 }
});
test('R93 cannot run on web, production, live or with a fake journal',async()=>{
 const f=fixture();
 try{
  for(const patch of [
   {VERCEL_ENV:'production'},{JENIOS_REAL_EXECUTION_ENABLED:'true'},
   {JENIOS_R93_PRIVATE_NODE_WORKER:'false'},
   {JENIOS_PRIVATE_PAPER_EXECUTOR:'true'},
   {JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED:'true'},
   {JENIOS_PAY_PAYMENTS_ENABLED:'true'}
  ])await assert.rejects(run(f,{env:{...env,...patch}}),/R93_PRIVATE_READONLY_DISABLED/);
  await assert.rejects(run(f,{ledger:{snapshot(){return [];}}}),
   /R93_PRIVATE_DEPENDENCIES_REQUIRED/);
  await assert.rejects(run(f,{verifyDiagnostic:undefined}),
   /R93_PRIVATE_DEPENDENCIES_REQUIRED/);
 }finally{f.cleanup();}
});
