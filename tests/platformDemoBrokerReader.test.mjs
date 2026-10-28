import test from 'node:test';import assert from 'node:assert/strict';import {createHmac} from 'node:crypto';
import {readDemoBroker} from '../lib/platform/connections/demo-broker-reader.mjs';
const now=1792521600000,creds={apiKey:'fixture_api_01234567890123',secret:'fixture_secret_01234567890123'};
const bin={...creds,provider:'binance',environment:'testnet'},alp={...creds,provider:'alpaca',environment:'paper'};
const account={accountType:'SPOT',uid:777,balances:[{asset:'BTC',free:'1.5',locked:'0.25'},{asset:'USDT',free:'0',locked:'0'}]};
const openOrders=[{symbol:'BTCUSDT',orderId:123,origQty:'2',executedQty:'0.5',side:'BUY',status:'PARTIALLY_FILLED'}];
const j=x=>Response.json(x);
test('R101 Binance refreshes each signature after a six-second account response with a pinned snapshot clock',async()=>{
 let elapsed=0;const signedTimes=[];
 const fetcher=async(raw,options)=>{
  const url=new URL(raw);assert.equal(options.method,'GET');
  if(url.pathname==='/api/v3/time')return j({serverTime:now});
  const signed=Number(url.searchParams.get('timestamp'));
  const query=new URLSearchParams(url.searchParams);const signature=query.get('signature');query.delete('signature');
  assert.equal(signature,createHmac('sha256',creds.secret).update(query.toString()).digest('hex'));
  assert.equal(url.searchParams.get('recvWindow'),'5000');
  signedTimes.push(signed);
  if(now+elapsed-signed>5000)return Response.json({code:-1021},{status:400});
  if(url.pathname==='/api/v3/account'){elapsed=6000;return j(account);}
  return j(openOrders);
 };
 const result=await readDemoBroker(bin,{fetcher,now:()=>now,monotonicNow:()=>elapsed});
 assert.deepEqual(signedTimes,[now,now+6000]);
 assert.equal(result.snapshot.observedAtMs,now);
 assert.equal(result.snapshot.openOrders.length,1);
});
for(const after of [-1,30001,NaN,Infinity])test('R101 Binance refuses invalid/stale monotonic clock '+after,async()=>{
 let elapsed=0,calls=0;
 const fetcher=async raw=>{
  calls++;const path=new URL(raw).pathname;
  if(path==='/api/v3/time')return j({serverTime:now});
  elapsed=after;return j(account);
 };
 await assert.rejects(readDemoBroker(bin,{fetcher,now:()=>now,monotonicNow:()=>elapsed}),/CLOCK_NOT_VERIFIED/);
 assert.equal(calls,2);
});
test('R101 Binance refuses an uncertain slow clock sample before signed requests',async()=>{
 let elapsed=0,calls=0;
 await assert.rejects(readDemoBroker(bin,{now:()=>now,monotonicNow:()=>elapsed,
  fetcher:async()=>{calls++;elapsed=2001;return j({serverTime:now});}}),/CLOCK_NOT_VERIFIED/);
 assert.equal(calls,1);
});
test('B166 Binance Testnet only three GETs, timestamps signed, spot balances not derivatives',async()=>{
 const urls=[];const fetcher=async(url,options)=>{
  assert.equal(options.method,'GET');assert.equal(options.redirect,'error');urls.push(url);
  const u=new URL(url);assert.equal(u.hostname,'testnet.binance.vision');
  if(u.pathname==='/api/v3/time'){assert.equal(options.headers['X-MBX-APIKEY'],undefined);return j({serverTime:now});}
  const signed=u.searchParams.get('signature');u.searchParams.delete('signature');
  assert.equal(signed,createHmac('sha256',creds.secret).update(u.searchParams.toString()).digest('hex'));
  assert.equal(options.headers['X-MBX-APIKEY'],creds.apiKey);
  return j(u.pathname==='/api/v3/account'?account:openOrders);
 };
 const r=await readDemoBroker(bin,{fetcher,now:()=>now});
 assert.deepEqual(urls.map(x=>new URL(x).pathname),['/api/v3/time','/api/v3/account','/api/v3/openOrders']);
 assert.equal(r.snapshot.positions[0].quantity,'1.75');assert.equal(r.publicSummary.spotBalancesNotDerivativePositions,true);
 assert.equal(r.snapshot.openOrders[0].filledQuantity,'0.5');assert.equal(r.identityVerified,true);
 assert.equal(r.publicSummary.orderExecutionEnabled,false);assert.equal(r.publicSummary.permissionsVerified,false);
 assert.ok(!JSON.stringify(r.publicSummary).includes('777'));assert.ok(!JSON.stringify(r.publicSummary).includes(creds.secret));
});
test('B166 Alpaca Paper reads account, positions and OPEN orders, never live',async()=>{
 const urls=[];const fetcher=async(url,options)=>{urls.push(url);assert.equal(options.method,'GET');assert.equal(options.headers['APCA-API-KEY-ID'],creds.apiKey);
  const u=new URL(url);assert.equal(u.hostname,'paper-api.alpaca.markets');
  if(u.pathname==='/v2/account')return j({id:'test-account-001',status:'ACTIVE',cash:'100',equity:'120',trading_blocked:false});
  if(u.pathname==='/v2/positions')return j([{asset_id:'8bb4-asset',symbol:'AAPL',side:'long',qty:'3'}]);
  return j([{id:'order-1',symbol:'AAPL',side:'sell',status:'new',qty:'1',filled_qty:'0'}]);
 };
 const r=await readDemoBroker(alp,{fetcher,now:()=>now});
 assert.deepEqual(urls.map(x=>new URL(x).pathname),['/v2/account','/v2/positions','/v2/orders']);assert.ok(urls[2].includes('status=open'));
 assert.equal(r.publicSummary.positionCount,1);assert.equal(r.publicSummary.openOrderCount,1);
 assert.ok(!JSON.stringify(r.publicSummary).includes('test-account-001'));assert.equal(r.identityVerified,true);
});
for(const patch of [{environment:'live'},{provider:'profit'},{url:'https://evil.com'},{method:'POST'},{secret:'a'},{apiKey:'bad'}])test('B166 fails before network '+JSON.stringify(patch),async()=>{
 let calls=0;await assert.rejects(readDemoBroker({...bin,...patch},{fetcher:async()=>{calls++;throw Error('network');}}));assert.equal(calls,0);
});
test('B166 fail-closed on incomplete positions, clock skew, network error or truncated orders',async()=>{
 await assert.rejects(readDemoBroker(bin,{now:()=>now,fetcher:async()=>j({serverTime:now-31000})}),/CLOCK_NOT_VERIFIED/);
 await assert.rejects(readDemoBroker(alp,{now:()=>now,fetcher:async()=>{throw Error('secret echo');}}),/PROVIDER_NETWORK_UNAVAILABLE/);
 let i=0;await assert.rejects(readDemoBroker(alp,{now:()=>now,fetcher:async()=>{i++;return j(i===1?{id:'demo',status:'ACTIVE',cash:'1',equity:'2',trading_blocked:false}:i===2?[]:Array.from({length:500},(_,j)=>({id:'order-'+j,symbol:'AAPL',side:'buy',status:'new',qty:'1',filled_qty:'0'})));}}),/PAGINATION_REQUIRED/);
});
