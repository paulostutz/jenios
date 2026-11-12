import test from 'node:test';
import {checkS05DeploymentScope} from '../lib/release/environment-scope.mjs';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PaperLedger} from '../lib/platform/pilot-prep/paper-ledger.mjs';
import {CORE_SHA,digest,units} from '../lib/platform/pilot-prep/contracts.mjs';
import {encryptDemo,digestDemoAccount} from '../lib/platform/connections/demo-vault.mjs';
import {alpacaPaperLedgerConnection,reserveAlpacaPaperProposal} from '../lib/platform/connections/alpaca-paper-risk-rehearsal.mjs';
import {reconcileOwnAlpacaPaperLedger} from '../lib/platform/connections/alpaca-paper-ledger-reconcile.mjs';
import {cancelR103PrivatePaperOnce} from '../lib/platform/connections/alpaca-private-cancel-r103.mjs';
const owner='4d238a7a-8c7b-4d8e-9a10-1c5c82db59a7',id='50b85e9d-339c-4d32-b2bf-82c467673832';
const accountId='30282d05-1422-4011-af04-d3fc32b73d51',brokerId='10282d05-1422-4011-af04-d3fc32b73d51';
const now=1793091600000,apiKey='synthetic-paper-api-key-abc12345',secret='synthetic-paper-secret-key-abc12345';
const env={VERCEL_ENV:'preview',JENIOS_R103_PRIVATE_PAPER_CANCEL_ENABLED:'true',
 JENIOS_PRIVATE_PAPER_REHEARSAL:'true',JENIOS_REAL_EXECUTION_ENABLED:'false',
 JENIOS_PRIVATE_PAPER_EXECUTOR:'false',JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED:'false',
 JENIOS_R80_PRIVATE_ISSUER_ENABLED:'false',JENIOS_R82_ALPACA_LIVE_ORDER_EXECUTION_ENABLED:'false',
 JENIOS_R83_PRIVATE_NODE_WORKER:'false',JENIOS_PAY_PAYMENTS_ENABLED:'false',
 JENIOS_INTER_CHARGES_ENABLED:'false',JENIOS_R100_INERT_WORKER_ENABLED:'false',
 JENIOS_DEMO_VAULT_KEY_B64:Buffer.alloc(32,7).toString('base64')};
const session={userId:owner,authenticated:true,diagnosticCompleted:true};
const order={clientOrderId:'r103-test',mode:'direct',side:'buy',symbol:'AAPL',quantity:'1',entry:'100',stop:'98',target:'104'};
const request={accessToken:'synthetic-owner-access-token-abc12345',connectionId:id,clientOrderId:order.clientOrderId,confirmation:'CANCEL_UNFILLED_PAPER_ENTRY_ONLY'};
const raw={id:brokerId,client_order_id:order.clientOrderId,symbol:'AAPL',side:'buy',qty:'1',filled_qty:'0',status:'new',order_class:'bracket',type:'limit',time_in_force:'day',limit_price:'100'};
function fixture(t,opts={}){
 const dir=mkdtempSync(join(tmpdir(),'jenios-r103-')),path=join(dir,'ledger.sqlite');
 let ledger=new PaperLedger(path),reads=0,orderReads=0,authCalls=0,deleteAttempted=false;
 t.after(()=>{ledger.close();rmSync(dir,{recursive:true,force:true});});
 const row={id,user_id:owner,provider:'alpaca',environment:'paper',status:'active',identity_verified:true,
  external_digest:digestDemoAccount('account-'+accountId,{userId:owner,provider:'alpaca',environment:'paper'},env),
  created_at:new Date(now-10000).toISOString(),last_sync_at:new Date(now-1000).toISOString(),
  credential_box:encryptDemo({apiKey,secret},{userId:owner,id,provider:'alpaca',environment:'paper',kind:'credentials'},env)};
 const bound=alpacaPaperLedgerConnection(owner,row,{now,env});
 ledger.configure(session,bound,{currency:'USD',ownerRisk:'5',accountRisk:'5',orderRisk:'4',notional:'1000',dailyLoss:'5',maxOrders:3});
 reserveAlpacaPaperProposal({session,storedConnection:row,mode:'direct',order,nowMs:now,
  signal:{originalCoreSha256:CORE_SHA.engine,executionEnabled:false,mode:'direct',side:'buy',contextDigest:'a'.repeat(64),reviewStatus:'allow'},
  source:{provider:'alpaca',environment:'paper',accountDigest:row.external_digest,accountAuthenticated:true,ownershipVerified:true,permissionsVerified:true,marketDataVerified:true,prospective:true,liveAccount:false,serverVerified:true},
  meta:{provider:'alpaca',id:'AAPL',marketType:'spot',base:'AAPL',quote:'USD',settlement:'USD',contractSize:'1',qtyStep:'1',minQty:'1',maxQty:'10',tickSize:'0.01',capturedAtMs:now,sourceSha256:'b'.repeat(64),quantityUnit:'base'},
  quote:{provider:'alpaca',instrument:'AAPL',receivedAtMs:now,sourceAtMs:now,bid:'99.98',ask:'100.02'},
  costs:{roundTripFeeBps:0,slippageBps:0,fundingCost:'0'}},{ledger,env});
 ledger.event(session,bound,order.clientOrderId,{id:'submit-before-test',kind:'SUBMITTING',atMs:now,cumulativeQuantity:'0'});
 const db={auth:{async getUser(){authCalls++;return {data:{user:{id:opts.owner||owner,email_confirmed_at:'2026-10-01',is_anonymous:false}}};}},
  from(){let allowed=true;return {select(){return this;},eq(k,v){allowed&&=row[k]===v;return this;},async maybeSingle(){return {data:allowed?structuredClone(row):null};}};},
  async rpc(name){assert.equal(name,'jenios_r80_read_paper_safety');reads++;opts.onSafety?.(reads,ledger,bound);
   return {data:[{owner_user_id:owner,connection_id:id,status:'PAUSED',kill_switch_engaged:true,paper_consent_enabled:!(opts.revoke&&reads>1),live_execution_enabled:false,checked_at:new Date(now+1).toISOString(),max_notional_units:null,risk_approved_at:null,risk_expires_at:null,approval_source:null}]};}};
 const calls=[];
 async function fetcher(url,options){
  const u=new URL(url);calls.push({method:options.method,path:u.pathname});
  assert.equal(u.origin,'https://paper-api.alpaca.markets');assert.equal(options.redirect,'error');
  assert.equal(options.headers['APCA-API-KEY-ID'],apiKey);assert.equal(options.headers['APCA-API-SECRET-KEY'],secret);
  assert.equal(options.body,undefined);
  if(options.method==='DELETE'){
   deleteAttempted=true;
   assert.equal(u.pathname,'/v2/orders/'+brokerId);
   assert.equal(ledger.orderDetails(session,bound,order.clientOrderId).cancellationAttempted,true);
   assert.equal(ledger.snapshot(session,bound)[0].state,'UNKNOWN');
   opts.onDelete?.(ledger,bound);
   if(opts.timeout)throw Error('network secret must not leak');
   return new Response(null,{status:opts.deleteStatus||204});
  }
  assert.equal(options.method,'GET');
  if(u.pathname==='/v2/account')return Response.json({id:opts.accountId||accountId,status:'ACTIVE'});
  assert.equal(u.pathname,'/v2/orders:by_client_order_id');assert.equal(u.searchParams.get('client_order_id'),order.clientOrderId);
  orderReads++;
  if(deleteAttempted&&opts.afterError)return new Response(null,{status:404});
  return Response.json({...raw,...(!deleteAttempted?opts.before:{status:'canceled',...opts.after})});
 }
 const verifyDiagnostic=async()=>({source:'JENIOS_PLATFORM_PRIVATE_DIAGNOSTIC',ownerUserId:owner,connectionId:id,verified:!opts.badDiagnostic,verifiedAtMs:now});
 return {row,bound,db,calls,get ledger(){return ledger;},get authCalls(){return authCalls;},
  run:(patch={},deps={})=>cancelR103PrivatePaperOnce({...request,...patch},{db,ledger,env,verifyDiagnostic,fetcher,clock:()=>now+1,...deps}),
  reopen(){ledger.close();ledger=new PaperLedger(path);},
  saved(){return ledger.snapshot(session,bound)[0];}};
}
test('R103 verifies owner/account/contract and confirms cancellation only after GET',async t=>{
 const f=fixture(t);const r=await f.run();assert.equal(r.cancelAttempts,1);assert.equal(r.cancelAccepted,true);
 assert.equal(r.cancellationConfirmed,true);assert.equal(r.state,'CANCELLED');assert.equal(f.saved().held,'0');
 assert.equal(r.ordersSent,0);assert.equal(r.liveExecution,false);assert.equal(r.manualReview,false);
 assert.equal(f.calls.filter(x=>x.method==='DELETE').length,1);
 assert.ok(!JSON.stringify(r).includes(brokerId));assert.ok(!JSON.stringify(r).includes(apiKey));
});
for(const status of ['new','pending_cancel'])test('R103 204 plus '+status+' does not certify cancellation or release risk',async t=>{
 const f=fixture(t,{after:{status}});const r=await f.run();assert.equal(r.cancelAccepted,true);assert.equal(r.cancellationConfirmed,false);
 assert.equal(r.manualReview,true);assert.equal(f.saved().held,units('2').toString());
 f.reopen();const repeat=await f.run();assert.equal(repeat.cancelAttempts,0);assert.equal(f.calls.filter(x=>x.method==='DELETE').length,1);
});
test('R103 pending-cancel fill is persisted and survives restart; zero-fill cancellation cannot erase it',async t=>{
 const f=fixture(t,{after:{status:'pending_cancel',filled_qty:'0.4'}});await f.run();f.reopen();
 assert.equal(f.saved().state,'UNKNOWN');assert.equal(f.saved().filled,units('0.4').toString());
 await assert.rejects(reconcileOwnAlpacaPaperLedger({session,storedConnection:f.row,clientOrderId:order.clientOrderId,symbol:'AAPL',nowMs:now+2},
  {ledger:f.ledger,env,lookup:async()=>({found:true,state:'CANCELLED',event:{id:'bad-zero',kind:'CANCELLED',cumulativeQuantity:'0'}})}),/INVALID_CUMULATIVE_FILL/);
 assert.equal(f.saved().held,units('2').toString());
});
test('R103 partial fill racing with cancel retains all exposure after cancellation',async t=>{
 const f=fixture(t,{after:{status:'canceled',filled_qty:'0.4'}});const r=await f.run();assert.equal(r.cancellationConfirmed,true);
 assert.equal(r.manualReview,true);assert.equal(f.saved().held,units('2').toString());assert.equal(f.saved().filled,units('0.4').toString());
});
for(const status of ['partially_filled','filled'])test('R103 does not cancel bracket protection after '+status,async t=>{
 const f=fixture(t,{before:{status,filled_qty:status==='filled'?'1':'0.4'}});const r=await f.run();assert.equal(r.cancelAttempts,0);
 assert.equal(f.calls.some(x=>x.method==='DELETE'),false);assert.equal(f.saved().held,units('2').toString());
});
for(const opts of [{timeout:true,afterError:true},{deleteStatus:422,after:{status:'new'}},{deleteStatus:429,afterError:true},{deleteStatus:500,afterError:true}])test('R103 ambiguous or rejected DELETE is never retried '+JSON.stringify(opts),async t=>{
 const f=fixture(t,opts);const r=await f.run();assert.equal(r.cancelAccepted,false);assert.equal(r.cancellationConfirmed,false);f.reopen();await f.run();
 assert.equal(f.calls.filter(x=>x.method==='DELETE').length,1);assert.equal(f.saved().held,units('2').toString());
});
for(const before of [{side:'sell'},{qty:'2'},{symbol:'MSFT'},{client_order_id:'other'},{id:'../account'},{limit_price:'101'},{order_class:'simple'}])test('R103 mismatched broker contract cannot reach DELETE '+JSON.stringify(before),async t=>{
 const f=fixture(t,{before});await assert.rejects(f.run());assert.equal(f.calls.some(x=>x.method==='DELETE'),false);
});
test('R103 concurrent calls atomically claim only one cancellation',async t=>{
 const f=fixture(t);await Promise.allSettled([f.run(),f.run()]);assert.equal(f.calls.filter(x=>x.method==='DELETE').length,1);
});
test('R103 lost process after durable claim never replays DELETE on restart',async t=>{
 const f=fixture(t);f.ledger.event(session,f.bound,order.clientOrderId,{id:'ack',kind:'ACK',atMs:now,cumulativeQuantity:'0'});
 const d=f.ledger.orderDetails(session,f.bound,order.clientOrderId);
 f.ledger.claimCancellation(session,f.bound,order.clientOrderId,{fingerprint:d.fingerprint,updatedAtMs:d.updatedAtMs,brokerDigest:digest(brokerId),nowMs:now+1});
 f.reopen();const r=await f.run();assert.equal(r.cancelAttempts,0);assert.equal(f.calls.length,0);assert.equal(f.saved().held,units('2').toString());
});
test('R103 consent revocation immediately before claim blocks DELETE',async t=>{
 const f=fixture(t,{revoke:true});await assert.rejects(f.run(),/R103_CONSENT_REQUIRED/);assert.equal(f.calls.some(x=>x.method==='DELETE'),false);
});
test('R103 fill arriving during final consent recheck blocks cancellation',async t=>{
 const f=fixture(t,{onSafety(n,ledger,c){if(n===2)ledger.event(session,c,order.clientOrderId,{id:'racing-fill',kind:'FILLED',atMs:now+1,cumulativeQuantity:'1'});}});
 await assert.rejects(f.run(),/CANCEL_REQUIRES_UNFILLED_ACK/);assert.equal(f.calls.some(x=>x.method==='DELETE'),false);assert.equal(f.saved().held,units('2').toString());
});
test('R103 refuses wrong account, owner and missing diagnostic',async t=>{
 for(const opts of [{owner:accountId},{accountId:owner},{badDiagnostic:true}]){
  const f=fixture(t,opts);await assert.rejects(f.run());assert.equal(f.calls.some(x=>x.method==='DELETE'),false);
 }
});
test('R103 refuses production, web, Live flags, forged ledger and extra request fields before auth',async t=>{
 const f=fixture(t);
 for(const patch of [{VERCEL:'1'},{NEXT_RUNTIME:'nodejs'},{AWS_LAMBDA_FUNCTION_NAME:'fn'},
  {VERCEL_ENV:'production'},{JENIOS_REAL_EXECUTION_ENABLED:'true'},{JENIOS_R103_PRIVATE_PAPER_CANCEL_ENABLED:'false'},
  {JENIOS_PRIVATE_PAPER_EXECUTOR:'true'},{JENIOS_R100_INERT_WORKER_ENABLED:'true'}])await assert.rejects(f.run({},{env:{...env,...patch}}),/R103_PRIVATE_PAPER_ONLY/);
 await assert.rejects(f.run({},{ledger:{}}),/R103_INVALID_PRIVATE_REQUEST/);
 await assert.rejects(f.run({ownerUserId:owner}),/R103_INVALID_PRIVATE_REQUEST/);
 await assert.rejects(f.run({confirmation:'yes'}),/R103_INVALID_PRIVATE_REQUEST/);assert.equal(f.authCalls,0);assert.equal(f.calls.length,0);
});

test('R103 web build refuses enabling cancellation in preview or production',()=>{
 for(const VERCEL_ENV of ['preview','production'])assert.deepEqual(checkS05DeploymentScope({VERCEL_ENV,JENIOS_R103_PRIVATE_PAPER_CANCEL_ENABLED:'true'}),{ok:false,reason:'R103_PAPER_CANCELLATION_FORBIDDEN_ON_WEB'});
});
test('R103 changed broker UUID after DELETE cannot release risk',async t=>{
 const f=fixture(t,{after:{id:accountId}});const r=await f.run();assert.equal(r.cancellationConfirmed,false);assert.equal(r.manualReview,true);assert.equal(f.saved().held,units('2').toString());
});
test('R103 expired operation deadline blocks DELETE',async t=>{
 const f=fixture(t);let calls=0;
 await assert.rejects(f.run({},{clock:()=>++calls<5?now+1:now+90000}),/R103_CLOCK_EXPIRED/);
 assert.equal(f.calls.some(x=>x.method==='DELETE'),false);
});
