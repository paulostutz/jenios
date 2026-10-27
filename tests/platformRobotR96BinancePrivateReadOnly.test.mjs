import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {encryptDemo,digestDemoAccount} from '../lib/platform/connections/demo-vault.mjs';
import {inspectR96BinanceTestnet} from '../lib/platform/connections/binance-private-readonly-r96.mjs';

const owner='4d238a7a-8c7b-4d8e-9a10-1c5c82db59a7';
const other='b8e32748-9c47-4eb1-9c5f-1a7cc0d2e496';
const connectionId='50b85e9d-339c-4d32-b2bf-82c467673832';
const now=1793091600000;
const uid=1987654321;
const accessToken='fixture-platform-verified-user-access-123';
const apiKey='fixture_binance_demo_key_123456';
const secret='fixture_binance_demo_secret_123456';
const env={VERCEL_ENV:'preview',
 JENIOS_R96_PRIVATE_NODE_WORKER:'true',
 JENIOS_R96_BINANCE_PRIVATE_READ_ENABLED:'true',
 JENIOS_DEMO_CONNECTORS_ENABLED:'true',
 JENIOS_REAL_EXECUTION_ENABLED:'false',
 JENIOS_PRIVATE_PAPER_EXECUTOR:'false',
 JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED:'false',
 JENIOS_R80_PRIVATE_ISSUER_ENABLED:'false',
 JENIOS_R82_ALPACA_LIVE_ORDER_EXECUTION_ENABLED:'false',
 JENIOS_PAY_PAYMENTS_ENABLED:'false',
 JENIOS_DEMO_VAULT_KEY_B64:Buffer.alloc(32,5).toString('base64')};
const stored={id:connectionId,user_id:owner,provider:'binance',
 environment:'testnet',status:'active',identity_verified:true,
 last_sync_at:new Date(now-500).toISOString(),
 created_at:new Date(now-20000).toISOString(),
 external_digest:digestDemoAccount('account-'+uid,{
  userId:owner,provider:'binance',environment:'testnet'
 },env),
 credential_box:encryptDemo({apiKey,secret},{
  userId:owner,id:connectionId,provider:'binance',environment:'testnet',
  kind:'credentials'
 },env)};
function fixture({authUser=owner,account=stored,confirmed=true,serverUid=uid}={}){
 let accountReads=0,apiGets=0,methodViolation=0;
 const calls=[];
 const db={
  auth:{async getUser(token){
   assert.equal(token,accessToken);
   return {error:null,data:{user:{
    id:authUser,is_anonymous:false,
    email_confirmed_at:confirmed?'2026-10-01T00:00:00Z':null
   }}};
  }},
  from(name){
   assert.equal(name,'jenios_platform_demo_broker_connections');
   accountReads++;let matches=true;
   return {select(){return this;},eq(k,v){
    if(k==='id')matches=matches&&v===connectionId;
    if(k==='user_id')matches=matches&&v===owner;
    return this;
   },async maybeSingle(){return {error:null,data:matches?account:null};}};
  }
 };
 const fetcher=async (url,options)=>{
  const u=new URL(url);calls.push({url:u.toString(),method:options.method});
  if(u.hostname!=='testnet.binance.vision'||options.method!=='GET'||
     options.redirect!=='error'){
   methodViolation++;throw Error('OFFICIAL_GET_ONLY');
  }
  apiGets++;
  if(u.pathname==='/api/v3/time')
   return Response.json({serverTime:now});
  const signature=u.searchParams.get('signature');
  const signed=new URLSearchParams(u.searchParams);signed.delete('signature');
  const expected=createHmac('sha256',secret).update(signed.toString()).digest('hex');
  assert.equal(signature,expected);
  assert.equal(options.headers['X-MBX-APIKEY'],apiKey);
  if(u.pathname==='/api/v3/account'){
   return Response.json({accountType:'SPOT',uid:serverUid,
    balances:[{asset:'USDT',free:'100',locked:'0'},
     {asset:'BTC',free:'0.1',locked:'0.0'}]});
  }
  if(u.pathname==='/api/v3/openOrders')return Response.json([]);
  throw Error('UNEXPECTED_UPSTREAM_PATH');
 };
 return {db,fetcher,calls,get accountReads(){return accountReads;},
  get apiGets(){return apiGets;},get methodViolation(){return methodViolation;}};
}
function inspect(f,patch={}){
 return inspectR96BinanceTestnet({accessToken,connectionId},
  {db:f.db,env,clock:()=>now,fetcher:f.fetcher,...patch});
}
test('R96 owner-authenticated Binance Testnet reads only official signed GETs and projects no secrets',async()=>{
 const f=fixture();
 const out=await inspect(f);
 assert.equal(out.accountIdentityVerified,true);
 assert.equal(out.spotBalanceAssetCount,2);
 assert.equal(out.openOrderCount,0);
 assert.equal(out.ordersSent,0);
 assert.equal(out.liveExecution,false);
 assert.equal(out.testnetOrderExecution,false);
 assert.equal(out.tradingPermissionsCertified,false);
 assert.equal(out.stopOcoProtectionCertified,false);
 assert.equal(f.apiGets,3);
 assert.equal(f.methodViolation,0);
 assert.deepEqual(f.calls.map(x=>x.method),['GET','GET','GET']);
 assert.equal(JSON.stringify(out).includes(secret),false);
 assert.equal(JSON.stringify(out).includes(apiKey),false);
 assert.equal(JSON.stringify(out).includes(String(uid)),false);
});
test('R96 refuses another owner and unconfirmed Platform user before any broker request',async()=>{
 for(const f of [fixture({authUser:other}),fixture({confirmed:false})]){
  await assert.rejects(inspect(f));
  assert.equal(f.apiGets,0);
 }
});
test('R96 refuses changed account digest, revoked connection or wrong broker scope',async()=>{
 for(const patch of [
  {external_digest:'b'.repeat(64)},
  {provider:'alpaca'}, {environment:'live'},
  {identity_verified:false}, {status:'revoked'},
  {last_sync_at:new Date(now-400000).toISOString()}
 ]){
  const f=fixture({account:{...stored,...patch}});
  await assert.rejects(inspect(f));
  assert.equal(f.apiGets,0);
 }
 const changed=fixture({serverUid:uid+1});
 await assert.rejects(inspect(changed),/R96_TESTNET_ACCOUNT_CHANGED/);
 assert.equal(changed.apiGets,3);
});
test('R96 requires official account UID and cannot invent identity from API key',async()=>{
 const f=fixture({serverUid:null});
 await assert.rejects(inspect(f),/R96_TESTNET_ACCOUNT_READ_UNVERIFIED/);
 assert.equal(f.apiGets,3);
});
test('R96 never runs in production/web or with any financial sending switch',async()=>{
 const f=fixture();
 for(const patch of [
  {VERCEL:'1'},{VERCEL_ENV:'production'},
  {JENIOS_R96_PRIVATE_NODE_WORKER:'false'},
  {JENIOS_R96_BINANCE_PRIVATE_READ_ENABLED:'false'},
  {JENIOS_REAL_EXECUTION_ENABLED:'true'},
  {JENIOS_PRIVATE_PAPER_EXECUTOR:'true'},
  {JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED:'true'},
  {JENIOS_PAY_PAYMENTS_ENABLED:'true'}
 ]){
  await assert.rejects(inspect(f,{env:{...env,...patch}}),
   /R96_PRIVATE_BINANCE_READ_DISABLED/);
 }
 assert.equal(f.apiGets,0);assert.equal(f.accountReads,0);
});
