import test from 'node:test';
import {checkS05DeploymentScope} from '../lib/release/environment-scope.mjs';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {PaperLedger} from '../lib/platform/pilot-prep/paper-ledger.mjs';
import {CORE_SHA} from '../lib/platform/pilot-prep/contracts.mjs';
import {encryptDemo,digestDemoAccount} from '../lib/platform/connections/demo-vault.mjs';
import {alpacaPaperLedgerConnection,reserveAlpacaPaperProposal} from '../lib/platform/connections/alpaca-paper-risk-rehearsal.mjs';
import {runR104PrivatePaperOperator} from '../lib/platform/connections/private-paper-operator-r104.mjs';
import {spawnSync} from 'node:child_process';
import {chmodSync,unlinkSync,symlinkSync,existsSync} from 'node:fs';
const owner='4d238a7a-8c7b-4d8e-9a10-1c5c82db59a7',id='50b85e9d-339c-4d32-b2bf-82c467673832';
const accountId='30282d05-1422-4011-af04-d3fc32b73d51',brokerId='10282d05-1422-4011-af04-d3fc32b73d51';
const now=1793091600000,apiKey='synthetic-paper-api-key-abc12345',secret='synthetic-paper-secret-key-abc12345';
const env={JENIOS_R104_PRIVATE_OPERATOR_ENABLED:'true',JENIOS_DEMO_CONNECTORS_ENABLED:'true',
 JENIOS_R93_PRIVATE_NODE_WORKER:'false',JENIOS_R93_READONLY_RECOVERY_ENABLED:'false',JENIOS_PRIVATE_PAPER_RECOVERY_ENABLED:'false',JENIOS_R103_PRIVATE_PAPER_CANCEL_ENABLED:'true',
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
 const dir=mkdtempSync(join(process.cwd(),'.jenios-r104-')),path=join(dir,'paper-'+id+'.sqlite');
 let ledger=new PaperLedger(path),reads=0,orderReads=0,authCalls=0,deleteAttempted=false;
 t.after(()=>{ledger?.close();rmSync(dir,{recursive:true,force:true});});
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
  from(table){if(table==='jenios_platform_diagnostics'){let permitted=false;return {select(){return this;},eq(k,v){assert.equal(k,'user_id');permitted=v===owner;return this;},async maybeSingle(){return {data:permitted&&!opts.noDiagnostic?{initial_mode:'manual',timeframe:'SWING',methodology:opts.methodology||'JENIOS-UX-2',created_at:opts.diagnosticDate||new Date(now-2000).toISOString()}:null};}};}assert.equal(table,'jenios_platform_demo_broker_connections');let allowed=true;return {select(){return this;},eq(k,v){allowed&&=row[k]===v;return this;},async maybeSingle(){return {data:allowed?structuredClone(row):null};}};},
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
  if(u.pathname==='/v2/account')return Response.json({id:opts.accountId||accountId,status:'ACTIVE',cash:'10000',equity:'10000',trading_blocked:false});
  if(u.pathname==='/v2/positions'||u.pathname==='/v2/orders')return Response.json([]);
  assert.equal(u.pathname,'/v2/orders:by_client_order_id');assert.equal(u.searchParams.get('client_order_id'),order.clientOrderId);
  orderReads++;
  if(deleteAttempted&&opts.afterError)return new Response(null,{status:404});
  return Response.json({...raw,...(!deleteAttempted?opts.before:{status:'canceled',...opts.after})});
 }
 return {row,bound,db,calls,dir,path,get ledger(){return ledger;},get authCalls(){return authCalls;},
  run:(action='cancel',patch={},deps={})=>runR104PrivatePaperOperator({...(action==='cancel'?request:{accessToken:request.accessToken,connectionId:id}),action,...patch},{db,env:{...env,JENIOS_R104_PRIVATE_VOLUME:dir,JENIOS_R103_PRIVATE_PAPER_CANCEL_ENABLED:action==='cancel'?'true':'false',JENIOS_R93_PRIVATE_NODE_WORKER:action==='recover'?'true':'false',JENIOS_R93_READONLY_RECOVERY_ENABLED:action==='recover'?'true':'false',JENIOS_PRIVATE_PAPER_RECOVERY_ENABLED:action==='recover'?'true':'false'},fetcher,clock:()=>now+1,...deps}),
  reopen(){ledger.close();ledger=new PaperLedger(path);},
  removeJournal(){ledger.close();ledger=null;unlinkSync(path);},
  saved(){return ledger.snapshot(session,bound)[0];}};
}
test('R104 real module composition authenticates, reads persisted diagnostic and inspects Paper account',async t=>{
 const f=fixture(t);const r=await f.run('inspect');assert.equal(r.accountReadVerified,true);assert.equal(r.diagnosticVerified,true);
 assert.equal(r.localJournalAvailable,true);assert.equal(r.pendingOrderCount,1);assert.equal(r.paused,true);assert.equal(r.readyForLive,false);
 assert.equal(f.calls.length,3);assert.ok(f.calls.every(x=>x.method==='GET'));
 assert.doesNotMatch(JSON.stringify(r),new RegExp(owner+'|'+accountId+'|'+apiKey+'|'+secret));
});
test('R104 recovers existing journal using actual reader, lookup and reconciliation modules',async t=>{
 const f=fixture(t);const r=await f.run('recover');assert.equal(r.pendingBefore,1);assert.equal(r.pendingAfter,1);
 assert.deepEqual(r.states,{ACK:1});assert.equal(r.paused,true);assert.equal(f.saved().state,'ACK');assert.ok(f.calls.every(x=>x.method==='GET'));
});
test('R104 runs private cancellation with durable diagnosis and no injected approval callback',async t=>{
 const f=fixture(t);const r=await f.run('cancel');assert.equal(r.cancellationConfirmed,true);assert.equal(r.cancelAttempts,1);
 assert.equal(f.saved().state,'CANCELLED');f.reopen();const repeated=await f.run('cancel');assert.equal(repeated.cancelAttempts,0);
 assert.equal(f.calls.filter(x=>x.method==='DELETE').length,1);
});
test('R104 inspection reports missing journal but never creates or configures it',async t=>{
 const f=fixture(t);f.removeJournal();const r=await f.run('inspect');assert.equal(r.localJournalAvailable,false);
 assert.equal(r.pendingOrderCount,null);assert.equal(existsSync(f.path),false);
});
for(const action of ['recover','cancel'])test('R104 '+action+' requires an existing journal before broker calls',async t=>{
 const f=fixture(t);f.removeJournal();await assert.rejects(f.run(action),/R104_EXISTING_JOURNAL_REQUIRED/);assert.equal(f.calls.length,0);assert.equal(existsSync(f.path),false);
});
for(const opts of [{noDiagnostic:true},{methodology:'LEGACY'},{diagnosticDate:'invalid'},{diagnosticDate:new Date(now+1000).toISOString()}])test('R104 invalid persisted diagnostic blocks network '+JSON.stringify(opts),async t=>{
 const f=fixture(t,opts);await assert.rejects(f.run('cancel'),/R104_DIAGNOSTIC_REQUIRED/);assert.equal(f.calls.length,0);
});
test('R104 wrong owner is denied before touching journal or broker',async t=>{
 const f=fixture(t,{owner:accountId});await assert.rejects(f.run('cancel'),/R104_CONNECTION_UNAVAILABLE/);assert.equal(f.calls.length,0);
});
test('R104 cannot accept owner, path, raw keys or diagnostic assertion from input',async t=>{
 const f=fixture(t);
 for(const patch of [{ownerUserId:owner},{volumePath:f.dir},{apiKey},{diagnosticCompleted:true}])await assert.rejects(f.run('cancel',patch),/R104_INVALID_REQUEST/);
 assert.equal(f.authCalls,0);assert.equal(f.calls.length,0);
});
test('R104 rejects public runtime, inactive operator and action/flag mismatches before auth',async t=>{
 const f=fixture(t);
 for(const patch of [{VERCEL:'1'},{VERCEL_ENV:'preview'},{VERCEL_ENV:'production'},{NEXT_RUNTIME:'nodejs'},
  {JENIOS_R104_PRIVATE_OPERATOR_ENABLED:'false'},{JENIOS_REAL_EXECUTION_ENABLED:'true'},
  {JENIOS_R100_INERT_WORKER_ENABLED:'true'},{JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED:'true'}]){
  await assert.rejects(f.run('cancel',{}, {env:{...env,...patch}}),/R104_PRIVATE_OPERATOR_DISABLED/);
 }
 await assert.rejects(f.run('recover',{}, {env}),/R104_ACTION_NOT_CONFIGURED/);assert.equal(f.authCalls,0);
});
test('R104 rejects symlink journal and weak permissions before broker calls',async t=>{
 const f=fixture(t);chmodSync(f.path,0o644);await assert.rejects(f.run('recover'),/R104_JOURNAL_UNSAFE/);
 chmodSync(f.path,0o600);f.removeJournal();symlinkSync('/etc/passwd',f.path);
 await assert.rejects(f.run('cancel'),/R104_JOURNAL_UNSAFE/);assert.equal(f.calls.length,0);
});
test('R104 rejects a journal bound to a different broker account',async t=>{
 const f=fixture(t);f.row.external_digest='f'.repeat(64);await assert.rejects(f.run('cancel'),/UNKNOWN_OR_CHANGED_CONNECTION/);assert.equal(f.calls.length,0);
});
test('R104 explicit inspect never permits cancellation even when a client supplies action fields',async t=>{
 const f=fixture(t);await assert.rejects(f.run('inspect',{clientOrderId:order.clientOrderId,confirmation:request.confirmation}),/R104_INVALID_REQUEST/);assert.equal(f.calls.length,0);
});
const cli=new URL('../scripts/platform/connections/r104-private-paper-operator.mjs',import.meta.url).pathname;
function runCli(input,args=[],extra={}){return spawnSync(process.execPath,[cli,...args],{encoding:'utf8',input,timeout:15000,env:{PATH:process.env.PATH,...extra}});}
test('R104 CLI refuses secret-bearing argv without printing it',()=>{
 const r=runCli('',[secret]);assert.equal(r.status,1);assert.match(r.stderr,/R104_ARGV_FORBIDDEN/);assert.ok(!r.stderr.includes(secret));assert.equal(r.stdout,'');
});
test('R104 CLI bounds malformed/oversized stdin and never echoes credentials',()=>{
 for(const input of ['{"apiKey":"'+apiKey+'"',JSON.stringify({secret:secret.repeat(500)})]){
  const r=runCli(input);assert.equal(r.status,1);assert.match(r.stderr,/R104_INVALID_JSON|R104_INPUT_TOO_LARGE/);assert.ok(!r.stderr.includes(secret));assert.ok(!r.stderr.includes(apiKey));
 }
});
test('R104 CLI disabled by default and refuses Social or arbitrary DB configuration',()=>{
 const r=runCli(JSON.stringify({...request,action:'cancel'}));assert.equal(r.status,1);assert.match(r.stderr,/R104_PRIVATE_OPERATOR_DISABLED/);
 for(const url of ['https://social-test.invalid','https://xaicvhagftzjkqphnbgx.supabase.co.evil.invalid','https://xaicvhagftzjkqphnbgx.supabase.co/']){
  const x=runCli(JSON.stringify({...request,action:'cancel'}),[],{...env,PLATFORM_SUPABASE_URL:url,PLATFORM_SUPABASE_SERVICE_ROLE_KEY:secret});
  assert.equal(x.status,1);assert.match(x.stderr,/R104_PLATFORM_CONFIG_REQUIRED/);assert.ok(!x.stderr.includes(secret));
 }
});

test('R104 build gate refuses the private operator on all website targets',()=>{
 for(const VERCEL_ENV of ['preview','production'])assert.deepEqual(checkS05DeploymentScope({VERCEL_ENV,JENIOS_R104_PRIVATE_OPERATOR_ENABLED:'true'}),{ok:false,reason:'R104_PRIVATE_OPERATOR_FORBIDDEN_ON_WEB'});
});
test('R104 cancelled entry is recovered with GETs only and never cancelled twice',async t=>{
 const f=fixture(t);await f.run('cancel');const count=f.calls.length;
 const r=await f.run('recover');assert.equal(r.pendingBefore,0);assert.equal(r.pendingAfter,0);assert.equal(f.calls.length,count);
 const repeated=await f.run('cancel');assert.equal(repeated.cancelAttempts,0);assert.equal(f.calls.length,count);
});
test('R104 broker read failure retains existing journal and held exposure',async t=>{
 const f=fixture(t);const before=f.saved();
 await assert.rejects(f.run('inspect',{}, {fetcher:async()=>{throw Error('sensitive socket detail');}}));
 assert.deepEqual(f.saved(),before);
});
test('R104 revocation before cancellation is enforced across composed modules',async t=>{
 const f=fixture(t,{revoke:true});await assert.rejects(f.run('cancel'),/R103_CONSENT_REQUIRED/);assert.ok(f.calls.every(x=>x.method==='GET'));
});
