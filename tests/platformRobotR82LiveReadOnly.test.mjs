import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {inspectR82AlpacaLiveReadOnly,requireR82LiveReadOnlyGate}
 from '../lib/platform/connections/alpaca-live-readonly-r82.mjs';

const user='4d238a7a-8c7b-4d8e-9a10-1c5c82db59a7';
const conn='50b85e9d-339c-4d32-b2bf-82c467673832';
const account='live-acct-002',now=1793091600000;
const secret=Buffer.alloc(32,23);
const env={
 VERCEL_ENV:'preview',JENIOS_REAL_EXECUTION_ENABLED:'false',
 JENIOS_R82_PRIVATE_NODE_WORKER:'true',
 JENIOS_R82_ALPACA_LIVE_READ_ENABLED:'true',
 JENIOS_R82_ALPACA_LIVE_ORDER_EXECUTION_ENABLED:'false',
 JENIOS_R82_LIVE_ACCOUNT_DIGEST_KEY_B64:secret.toString('base64')
};
const expected=createHmac('sha256',secret)
 .update('jenios-live-readonly-r82-v1\0'+user+'\0'+account).digest('hex');
const input={
 session:{userId:user,authenticated:true},
 storedLiveConnection:{
  id:conn,user_id:user,provider:'alpaca',environment:'live',status:'active',
  identity_verified:true,source:'JENIOS_PRIVATE_LIVE_VAULT_VERIFIED',
  external_digest:expected
 },
 credentials:{apiKey:'A'.repeat(24),secret:'B'.repeat(32)},nowMs:now
};
function provider({accountId=account,status='ACTIVE',blocked=false,clockDiff=0,badResponse=false}={}){
 const calls=[];
 const fetcher=async (url,options)=>{
  calls.push({url,method:options.method,redirect:options.redirect});
  assert.equal(options.method,'GET');
  assert.equal(options.redirect,'error');
  assert.equal(new URL(url).host,'api.alpaca.markets');
  if(url.endsWith('/v2/account'))
   return new Response(JSON.stringify({id:accountId,status,trading_blocked:blocked}));
  if(url.endsWith('/v2/clock'))
   return new Response(badResponse?'invalid JSON':JSON.stringify({
    timestamp:new Date(now+clockDiff).toISOString(),is_open:false
   }));
  throw Error('unknown URL');
 };
 return {fetcher,calls};
}
test('R82 verifies LIVE account identity over official GET-only API; never claims order readiness',async()=>{
 const p=provider();
 const out=await inspectR82AlpacaLiveReadOnly(input,{env,fetcher:p.fetcher});
 assert.deepEqual(p.calls.map(x=>x.method),['GET','GET']);
 assert.deepEqual(p.calls.map(x=>x.url),[
  'https://api.alpaca.markets/v2/account','https://api.alpaca.markets/v2/clock'
 ]);
 assert.equal(out.environment,'live');assert.equal(out.customerAccountVerified,true);
 assert.equal(out.liveOrdersEnabled,false);assert.equal(out.ordersSent,0);
 assert.equal(out.riskLimitsApproved,false);assert.equal(out.tradingPermissionsCertified,false);
 assert.equal(Object.hasOwn(out,'credentials'),false);assert.equal(Object.hasOwn(out,'accountId'),false);
});
test('R82 requires a separate opt-in private worker, never production or Live order flags',async()=>{
 const p=provider();
 for(const e of [
  {...env,VERCEL_ENV:'production'},
  {...env,JENIOS_R82_PRIVATE_NODE_WORKER:'false'},
  {...env,JENIOS_R82_ALPACA_LIVE_READ_ENABLED:'false'},
  {...env,JENIOS_REAL_EXECUTION_ENABLED:'true'},
  {...env,JENIOS_R82_ALPACA_LIVE_ORDER_EXECUTION_ENABLED:'true'}
 ])await assert.rejects(
  inspectR82AlpacaLiveReadOnly(input,{env:e,fetcher:p.fetcher}),
  /R82_LIVE_READ_DISABLED/);
 assert.equal(p.calls.length,0);
 assert.equal(requireR82LiveReadOnlyGate(env),true);
});
test('R82 refuses cross-tenant, Paper, revoked and unsigned connection scope',async()=>{
 for(const patch of [
  {user_id:conn},{environment:'paper'},{provider:'binance'},
  {status:'revoked'},{identity_verified:false},{source:'browser'},
  {external_digest:'f'.repeat(64)}
 ]){
  const p=provider();
  await assert.rejects(inspectR82AlpacaLiveReadOnly({
   ...input,storedLiveConnection:{...input.storedLiveConnection,...patch}
  },{env,fetcher:p.fetcher}));
  if(patch.external_digest===undefined)assert.equal(p.calls.length,0);
 }
});
test('R82 refuses missing private key, wrong account digest and unverified clock',async()=>{
 const p1=provider();
 await assert.rejects(inspectR82AlpacaLiveReadOnly(input,{
  env:{...env,JENIOS_R82_LIVE_ACCOUNT_DIGEST_KEY_B64:undefined},
  fetcher:p1.fetcher
 }),/R82_LIVE_PRIVATE_KEY_REQUIRED/);
 assert.equal(p1.calls.length,0);
 await assert.rejects(inspectR82AlpacaLiveReadOnly(input,{
  env,fetcher:provider({accountId:'a-different-account'}).fetcher
 }),/R82_LIVE_ACCOUNT_CHANGED/);
 await assert.rejects(inspectR82AlpacaLiveReadOnly(input,{
  env,fetcher:provider({clockDiff:120000}).fetcher
 }),/R82_LIVE_MARKET_CLOCK_UNVERIFIED/);
});
test('R82 reports account blocked rather than inventing trading permission',async()=>{
 const result=await inspectR82AlpacaLiveReadOnly(input,{
  env,fetcher:provider({blocked:true,status:'INACTIVE'}).fetcher
 });
 assert.equal(result.accountActive,false);assert.equal(result.tradingBlocked,true);
 assert.equal(result.liveOrdersEnabled,false);
});
test('R82 refuses malformed, oversized and redirected broker response without leaking credentials',async()=>{
 for(const fake of [
  async()=>new Response('x'.repeat(65537)),
  async()=>new Response('not-json'),
  async()=>({redirected:true,ok:true}),
  async()=>{throw Error('secret key was rejected');}
 ]){
  await assert.rejects(inspectR82AlpacaLiveReadOnly(input,{
   env,fetcher:fake
  }),/R82_LIVE_(RESPONSE|UPSTREAM|NETWORK)_/);
 }
});
test('R82 never contains a network order method, mutable endpoint or public route',()=>{
 const source=readFileSync(new URL('../lib/platform/connections/alpaca-live-readonly-r82.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(source,/method:'POST'|method:'DELETE'|method:'PATCH'/);
 assert.doesNotMatch(source,/\/v2\/orders|\/v2\/positions|return\s+account\.id/);
 assert.match(source,/privateWorkerOnly:true/);
});
