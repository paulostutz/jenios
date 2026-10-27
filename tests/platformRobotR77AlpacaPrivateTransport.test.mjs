import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PaperLedger} from '../lib/platform/pilot-prep/paper-ledger.mjs';
import {checkS05DeploymentScope} from '../lib/release/environment-scope.mjs';
import {CORE_SHA,units} from '../lib/platform/pilot-prep/contracts.mjs';
import {digestDemoAccount} from '../lib/platform/connections/demo-vault.mjs';
import {alpacaPaperLedgerConnection} from '../lib/platform/connections/alpaca-paper-risk-rehearsal.mjs';
import {readR77PaperExecutionPreflight,submitAlpacaPaperOnce,
 requireR77PrivatePaperGate,verifyR77PaperApproval} from '../lib/platform/connections/alpaca-paper-private-transport-r77.mjs';

const user='4d238a7a-8c7b-4d8e-9a10-1c5c82db59a7';
const other='b8e32748-9c47-4eb1-9c5f-1a7cc0d2e496';
const now=1793091600000;
const env={VERCEL_ENV:'preview',JENIOS_REAL_EXECUTION_ENABLED:'false',
 JENIOS_PRIVATE_PAPER_REHEARSAL:'true',
 JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED:'true',
 JENIOS_PRIVATE_PAPER_EXECUTOR:'true',
 JENIOS_DEMO_CONNECTORS_ENABLED:'true',
 JENIOS_DEMO_VAULT_KEY_B64:Buffer.alloc(32,8).toString('base64')};
const credentials={apiKey:'fixture_api_key_abcdefghijkl',secret:'fixture_secret_abcdefghijkl'};
const accountId='fixture-account-1';
const storedConnection={id:'50b85e9d-339c-4d32-b2bf-82c467673832',
 user_id:user,provider:'alpaca',environment:'paper',status:'active',
 identity_verified:true,last_sync_at:new Date(now-900).toISOString(),
 created_at:new Date(now-1800).toISOString(),
 external_digest:digestDemoAccount('account-'+accountId,
  {userId:user,provider:'alpaca',environment:'paper'},env)};
const session={userId:user,authenticated:true,diagnosticCompleted:true};
const order={clientOrderId:'order_r77',mode:'direct',side:'buy',symbol:'AAPL',
 quantity:'1',entry:'100',stop:'98',target:'104'};
const meta={provider:'alpaca',id:'AAPL',marketType:'spot',base:'AAPL',quote:'USD',settlement:'USD',
 contractSize:'1',qtyStep:'1',minQty:'1',maxQty:'10',tickSize:'0.01',
 capturedAtMs:now-300,sourceSha256:'a'.repeat(64),quantityUnit:'base'};
const quote={provider:'alpaca',instrument:'AAPL',receivedAtMs:now-250,sourceAtMs:now-250,
 bid:'99.99',ask:'100.01'};
const costs={roundTripFeeBps:0,slippageBps:0,fundingCost:'0'};
const signal={originalCoreSha256:CORE_SHA.engine,executionEnabled:false,
 mode:'direct',side:'buy',contextDigest:'b'.repeat(64),reviewStatus:'allow'};
const source={provider:'alpaca',environment:'paper',accountDigest:storedConnection.external_digest,
 accountAuthenticated:true,ownershipVerified:true,permissionsVerified:true,
 marketDataVerified:true,prospective:true,liveAccount:false,serverVerified:true};
const approval={consent:'PAPER_TEST_ONLY',authorizedBy:user,connectionId:storedConnection.id,
 provider:'alpaca',environment:'paper',liveAccount:false,
 authorizedAtMs:now-1000,maxNotionalUnits:units('150').toString()};
const limits={currency:'USD',ownerRisk:'5',accountRisk:'5',orderRisk:'4',
 notional:'1000',dailyLoss:'5',maxOrders:2};
const input={session,storedConnection,credentials,approval,mode:'direct',signal,order,
 source,meta,quote,costs,nowMs:now};
const receipt={id:'alpaca-fixture-id',client_order_id:order.clientOrderId,
 symbol:'AAPL',qty:'1',filled_qty:'0',status:'new'};
function broker({tradingBlocked=false,tradable=true,isOpen=true,
 status='ACTIVE',badReceipt=false,postStatus=201,throwAfterPost=false,
 assetClass='us_equity'}={}){
 const calls=[];
 async function fetcher(url,options){
  const u=new URL(url);
  calls.push({host:u.host,path:u.pathname+u.search,method:options.method,
   redirect:options.redirect,body:options.method==='POST'?JSON.parse(options.body):undefined});
  assert.equal(u.origin,'https://paper-api.alpaca.markets');
  assert.equal(options.redirect,'error');
  assert.equal(options.headers['APCA-API-KEY-ID'],credentials.apiKey);
  assert.equal(options.headers['APCA-API-SECRET-KEY'],credentials.secret);
  if(options.method==='POST'){
   assert.equal(u.pathname,'/v2/orders');
   if(throwAfterPost)throw Error('connection reset after sending');
   return Response.json(badReceipt?{...receipt,client_order_id:'wrong'}:receipt,{status:postStatus});
  }
  assert.equal(options.method,'GET');
  if(u.pathname==='/v2/account')return Response.json({id:accountId,status,trading_blocked:tradingBlocked,cash:'1000',equity:'1000'});
  if(u.pathname==='/v2/positions')return Response.json([]);
  if(u.pathname==='/v2/orders')return Response.json([]);
  if(u.pathname==='/v2/assets/AAPL')return Response.json({symbol:'AAPL',
   class:assetClass,status:'active',tradable,fractionable:true});
  if(u.pathname==='/v2/clock')return Response.json({timestamp:new Date(now).toISOString(),is_open:isOpen});
  assert.fail('Unexpected official endpoint '+url);
 }
 return {fetcher,calls,posts:()=>calls.filter(x=>x.method==='POST')};
}
async function withLedger(fn){
 const dir=mkdtempSync(join(tmpdir(),'jenios-r77-'));
 const ledger=new PaperLedger(join(dir,'private-ledger.db'));
 try{
  const c=alpacaPaperLedgerConnection(user,storedConnection,{now,env});
  ledger.configure(session,c,limits);
  return await fn(ledger,c);
 }finally{ledger.close();rmSync(dir,{recursive:true,force:true});}
}

test('R77 production and live accounts are forbidden even if paper flags are true',async()=>{
 for(const patch of [{VERCEL_ENV:'production'},
  {VERCEL_ENV:undefined},{JENIOS_REAL_EXECUTION_ENABLED:'true'},
  {JENIOS_PRIVATE_PAPER_EXECUTOR:'false'},
  {JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED:'false'},
  {JENIOS_PRIVATE_PAPER_REHEARSAL:'false'}]){
  assert.throws(()=>requireR77PrivatePaperGate({...env,...patch}),/PAPER_TRANSPORT_NOT_AUTHORIZED/);
  let calls=0;
  await assert.rejects(submitAlpacaPaperOnce(input,{env:{...env,...patch},
   fetcher:()=>{calls++;throw Error();}}),/PAPER_TRANSPORT_NOT_AUTHORIZED/);
  assert.equal(calls,0);
 }
});
test('R77 requires recent explicit PAPER-only approval, owner, account and notional ceiling',()=>{
 assert.equal(verifyR77PaperApproval({approval,session,storedConnection,order,nowMs:now}),true);
 for(const bad of [
  {...approval,consent:'LIVE'},
  {...approval,authorizedBy:other},
  {...approval,connectionId:'not-this-connection'},
  {...approval,environment:'live'},
  {...approval,liveAccount:true},
  {...approval,authorizedAtMs:now-700000},
  {...approval,maxNotionalUnits:units('50').toString()}
 ]){
  assert.throws(()=>verifyR77PaperApproval({approval:bad,session,storedConnection,order,nowMs:now}));
 }
 assert.throws(()=>verifyR77PaperApproval({approval,session,storedConnection,
  order:{...order,side:'sell'},nowMs:now}),/EXPLICIT_PRIVATE_PAPER_APPROVAL_REQUIRED/);
});
test('R77 checks official account, clock and asset via six GET requests, no POST',async()=>{
 const b=broker();const result=await readR77PaperExecutionPreflight(input,{env,fetcher:b.fetcher});
 assert.equal(result.accountReadConfirmed,true);
 assert.equal(result.certifiedForLive,false);
 assert.equal(b.calls.length,6);
 assert.equal(b.posts().length,0);
 for(const call of b.calls)assert.equal(call.method,'GET');
});
test('R77 one approved PAPER bracket is sent at most once and gets official ACK',()=>withLedger(async(ledger,c)=>{
 const b=broker();const result=await submitAlpacaPaperOnce(input,{ledger,env,fetcher:b.fetcher});
 assert.equal(result.state,'ACK');
 assert.equal(result.brokerReceiptVerified,true);
 assert.equal(result.paperOnly,true);
 assert.equal(result.liveExecution,false);
 assert.equal(result.autoResubmitAllowed,false);
 assert.equal(b.posts().length,1);
 const placed=b.posts()[0];
 assert.equal(placed.body.order_class,'bracket');
 assert.equal(placed.body.type,'limit');
 assert.equal(placed.body.client_order_id,order.clientOrderId);
 assert.equal(placed.body.stop_loss.stop_price,'98');
 assert.equal(placed.body.take_profit.limit_price,'104');
 assert.equal(ledger.snapshot(session,c)[0].state,'ACK');
 const again=await submitAlpacaPaperOnce(input,{ledger,env,fetcher:b.fetcher});
 assert.equal(again.duplicate,true);
 assert.equal(again.postAttempted,false);
 assert.equal(b.posts().length,1);
}));
test('R77 ambiguous response is UNKNOWN and duplicate calls never retry POST',()=>withLedger(async(ledger,c)=>{
 const b=broker({throwAfterPost:true});
 const first=await submitAlpacaPaperOnce(input,{ledger,env,fetcher:b.fetcher});
 assert.equal(first.state,'UNKNOWN');
 assert.equal(first.manualReview,true);
 assert.equal(first.autoResubmitAllowed,false);
 assert.equal(b.posts().length,1);
 const row=ledger.snapshot(session,c)[0];
 assert.equal(row.state,'UNKNOWN');assert.equal(row.held,units('2').toString());
 const again=await submitAlpacaPaperOnce(input,{ledger,env,fetcher:b.fetcher});
 assert.equal(again.duplicate,true);
 assert.equal(b.posts().length,1);
}));
test('R77 HTTP rejection remains UNKNOWN, it is never counted as clean rejection',()=>withLedger(async(ledger,c)=>{
 const b=broker({postStatus:422});
 const result=await submitAlpacaPaperOnce(input,{ledger,env,fetcher:b.fetcher});
 assert.equal(result.state,'UNKNOWN');assert.equal(result.brokerReceiptVerified,false);
 assert.equal(b.posts().length,1);
 assert.equal(ledger.snapshot(session,c)[0].held,units('2').toString());
}));
test('R77 malformed official client reference is UNKNOWN, never confirmation',()=>withLedger(async ledger=>{
 const b=broker({badReceipt:true});
 const r=await submitAlpacaPaperOnce(input,{ledger,env,fetcher:b.fetcher});
 assert.equal(r.state,'UNKNOWN');assert.equal(r.brokerReceiptVerified,false);
}));
test('R77 nontradable asset, market closed or trading-blocked account cannot POST',()=>withLedger(async ledger=>{
 for(const config of [{tradingBlocked:true},{tradable:false},{isOpen:false},
  {status:'INACTIVE'},{assetClass:'crypto'}]){
  const b=broker(config);
  await assert.rejects(submitAlpacaPaperOnce(input,{ledger,env,fetcher:b.fetcher}));
  assert.equal(b.posts().length,0);
  assert.deepEqual(ledger.snapshot(session,
   alpacaPaperLedgerConnection(user,storedConnection,{now,env})),[]);
 }
}));
test('R77 counterfeit owner and changed account cannot reach POST or reserve risk',()=>withLedger(async ledger=>{
 const b=broker();
 await assert.rejects(submitAlpacaPaperOnce({...input,session:{...session,userId:other}},
  {ledger,env,fetcher:b.fetcher}));
 await assert.rejects(submitAlpacaPaperOnce({...input,storedConnection:{
  ...storedConnection,external_digest:'1'.repeat(64)}},{ledger,env,fetcher:b.fetcher}));
 assert.equal(b.posts().length,0);
}));
test('R77 concurrent duplicate submissions use durable intent, never two POSTs',()=>withLedger(async ledger=>{
 const b=broker();const results=await Promise.all([
  submitAlpacaPaperOnce(input,{ledger,env,fetcher:b.fetcher}),
  submitAlpacaPaperOnce(input,{ledger,env,fetcher:b.fetcher})]);
 assert.equal(b.posts().length,1);
 assert.equal(results.filter(r=>r.duplicate).length,1);
}));
test('R77 module remains private and has no website route, live endpoint or withdrawal',()=>{
 const path=new URL('../lib/platform/connections/alpaca-paper-private-transport-r77.mjs',import.meta.url);
 const code=readFileSync(path,'utf8');
 assert.match(code,/paper-api\.alpaca\.markets/);
 assert.doesNotMatch(code,/api\.alpaca\.markets\/v2|\/v2\/withdrawals|\/v2\/positions\/close/);
 assert.doesNotMatch(code,/export async function (submitReal|withdraw)/);
 assert.match(code,/JENIOS_REAL_EXECUTION_ENABLED/);
 assert.match(code,/PAPER_TEST_ONLY/);
 assert.match(code,/autoResubmitAllowed:false/);
});

test('R77 preview branch is isolated and all public external action flags stay closed',()=>{
 const blocked=['JENIOS_REAL_EXECUTION_ENABLED','JENIOS_PRIVATE_PAPER_EXECUTOR',
  'JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED','JENIOS_ROBOT_ANALYST_PAID_ENABLED',
  'JENIOS_ROBOT_R73_ADMIN_ENABLED','JENIOS_PAY_PAYMENTS_ENABLED',
  'JENIOS_PRO_PAYMENTS_ENABLED','JENIOS_INTER_CHARGES_ENABLED',
  'JENIOS_EMAIL_PRODUCTION_ENABLED','JENIOS_EMAIL_DISPATCHER_ENABLED',
  'JENIOS_PAYMENT_EMAILS_ENABLED','JENIOS_TRANSACTIONAL_EMAILS_ENABLED',
  'JENIOS_MARKETING_EMAILS_ENABLED','JENIOS_MARKETING_PLANNER_ENABLED',
  'JENIOS_SUBSCRIPTION_DUNNING_ENABLED','JENIOS_RESEND_WEBHOOK_ENABLED',
  'JENIOS_PRO_GENERATION_ENABLED','JENIOS_SALES_GENERATIVE_ENABLED',
  'JENIOS_ASSISTANT_MEMORY_ENABLED','NEXT_PUBLIC_PLATFORM_SIGNUP_ENABLED'];
 const vars={VERCEL_ENV:'preview',VERCEL_PROJECT_ID:'prj_44ipBY3R9sHlQDAXY7NUn1zDguw4',
  VERCEL_GIT_COMMIT_REF:'fix/jenios-r77-paper-official-transport-20261027',
  NEXT_PUBLIC_SUPABASE_URL:'https://rebzztxlzofxpfwjvbee.supabase.co',
  SOCIAL_SUPABASE_URL:'https://rebzztxlzofxpfwjvbee.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY:'public-test-key',
  PLATFORM_SUPABASE_URL:'https://xaicvhagftzjkqphnbgx.supabase.co',
  NEXT_PUBLIC_PLATFORM_SUPABASE_URL:'https://xaicvhagftzjkqphnbgx.supabase.co',
  NEXT_PUBLIC_PLATFORM_SUPABASE_PUBLISHABLE_KEY:'public-platform-test-key',
  ...Object.fromEntries(blocked.map(k=>[k,'false']))};
 assert.deepEqual(checkS05DeploymentScope(vars),{ok:true,mode:'preview-isolated-robot-r75'});
 for(const key of blocked)
  assert.deepEqual(checkS05DeploymentScope({...vars,[key]:'true'}),
   {ok:false,reason:'R75_PREVIEW_EXTERNAL_ACTIONS_MUST_BE_DISABLED'});
 assert.equal(checkS05DeploymentScope({...vars,VERCEL_ENV:'production'}).ok,false);
});
