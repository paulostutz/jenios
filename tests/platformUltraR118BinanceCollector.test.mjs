import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {BinanceOrderCollector,binanceReadOnlyKeyFingerprint} from '../lib/platform/ultra/client/binance-collector.mjs';

const now=Date.parse('2026-11-10T12:00:00Z'),env={JENIOS_BINANCE_API_KEY:'k'.repeat(64),JENIOS_BINANCE_API_SECRET:'s'.repeat(64)};
const ref={symbol:'BTCUSDT',orderId:'9007199254740995',clientOrderId:'ju_fixture_1',side:'BUY',positionSide:'BOTH'};
const nativeOrder=()=>({...ref,origQty:'1',executedQty:'1',status:'FILLED',time:now-10000,updateTime:now-1000});
const fill=(overrides={})=>({id:'9007199254741001',orderId:ref.orderId,symbol:ref.symbol,side:ref.side,positionSide:ref.positionSide,price:'100.000000000000000001',qty:'1',commission:'0.000000000000000001',commissionAsset:'USDT',realizedPnl:'0',marginAsset:'USDT',time:now-1000,...overrides});
const funding=(overrides={})=>({symbol:ref.symbol,incomeType:'FUNDING_FEE',asset:'USDT',income:'-0.01',time:now-500,tranId:'9007199254741003',...overrides});
function harness({order=nativeOrder(),trades=[fill()],positions=[],fundingRows=[],handler,environment='demo',clock=()=>now,mono=()=>0}={}){
 const requests=[];let orderReads=0;
 const fetchImpl=async(url,init)=>{
  const u=new URL(url);requests.push({url:u,init});
  const intercepted=await handler?.(u,init,requests.length);if(intercepted!==undefined)return intercepted;
  if(u.pathname==='/fapi/v1/time')return Response.json({serverTime:now});
  if(u.pathname==='/fapi/v1/order'){orderReads++;return Response.json(typeof order==='function'?order(orderReads):order);}
  if(u.pathname==='/fapi/v3/positionRisk')return Response.json(positions);
  const source=u.pathname==='/fapi/v1/userTrades'?trades:fundingRows;
  const start=Number(u.searchParams.get('startTime')),end=Number(u.searchParams.get('endTime'));
  return Response.json(source.filter(t=>t.time>=start&&t.time<=end).slice(0,1000));
 };
 const collector=new BinanceOrderCollector({product:'usds_m_futures',environment,expectedKeyFingerprint:binanceReadOnlyKeyFingerprint(env.JENIOS_BINANCE_API_KEY,environment)},{env,fetchImpl,now:clock,monotonicNow:mono});
 return {collector,requests,collect:()=>collector.collect([ref])};
}

test('collector uses only official fixed origins and signed GET requests, without exposing credentials',async()=>{
 const h=harness();const evidence=await h.collect();
 assert.equal(evidence.readOnly,true);assert.equal(evidence.executionAvailable,false);assert.equal(evidence.orders[0].trades[0].tradeId,'9007199254741001');
 assert.equal(evidence.orders[0].commissions[0].amount,'0.000000000000000001');
 const json=JSON.stringify(evidence);assert.equal(json.includes(env.JENIOS_BINANCE_API_KEY),false);assert.equal(json.includes(env.JENIOS_BINANCE_API_SECRET),false);
 assert.equal(JSON.stringify(h.collector),'{}');
 for(const {url,init} of h.requests){assert.equal(url.origin,'https://demo-fapi.binance.com');assert.equal(init.method,'GET');assert.equal(init.redirect,'error');assert.equal(init.cache,'no-store');
  if(url.pathname==='/fapi/v1/time')assert.equal(init.headers['X-MBX-APIKEY'],undefined);
  else{const signature=url.searchParams.get('signature');url.searchParams.delete('signature');assert.equal(signature,createHmac('sha256',env.JENIOS_BINANCE_API_SECRET).update(url.searchParams.toString()).digest('hex'));}
 }
});
test('a filled order and absent position never become final realized net profit',async()=>{
 const e=await harness().collect();const o=e.orders[0];assert.equal(o.status,'FILLED');assert.equal(o.fillsCompleteForOrderSnapshot,true);assert.equal(o.positionReconciled,false);assert.equal(o.costsComplete,false);assert.equal(o.financing,null);assert.equal(o.net,null);assert.equal(e.context[0].positionOwnershipVerified,false);
});
test('account-symbol funding and positions stay unallocated, rebates preserve their sign and assets',async()=>{
 const h=harness({trades:[fill({commission:'-0.2',commissionAsset:'BNB'})],fundingRows:[funding()],positions:[{symbol:'BTCUSDT',positionSide:'BOTH',positionAmt:'1',entryPrice:'100',unRealizedProfit:'5',marginAsset:'USDT',updateTime:now-1000}]});
 const e=await h.collect();assert.deepEqual(e.orders[0].commissions,[{asset:'BNB',amount:'-0.2'}]);assert.equal(e.context[0].positions[0].unrealized,'5');assert.equal(e.context[0].funding[0].income,'-0.01');assert.equal(e.context[0].fundingAllocated,false);assert.equal(e.context[0].funding[0].attributedToRobot,false);
});
test('key binding and environment are checked before any read',()=>{
 assert.throws(()=>new BinanceOrderCollector({product:'usds_m_futures',environment:'demo',expectedKeyFingerprint:'0'.repeat(64)},{env}),/BINANCE_KEY_BINDING_MISMATCH/);
 assert.throws(()=>new BinanceOrderCollector({product:'usds_m_futures',environment:'https:\/\/elsewhere',expectedKeyFingerprint:'0'.repeat(64)},{env}),/BINANCE_LOCAL_CREDENTIALS_REQUIRED/);
 assert.notEqual(binanceReadOnlyKeyFingerprint(env.JENIOS_BINANCE_API_KEY,'live'),binanceReadOnlyKeyFingerprint(env.JENIOS_BINANCE_API_KEY,'demo'));
});
test('live uses only the designated official origin',async()=>{const h=harness({environment:'live'});await h.collect();assert.ok(h.requests.every(r=>r.url.origin==='https://fapi.binance.com'));});
test('malformed, extra and duplicate references cannot start a request',async()=>{const h=harness();for(const refs of [[],[{...ref,apiKey:'x'}],[ref,ref],[{...ref,clientOrderId:null}],[{...ref,orderId:9007199254740996}]])await assert.rejects(()=>h.collector.collect(refs));assert.equal(h.requests.length,0);});
test('order account scope uses symbol, durable order ID and exact client order ID',async()=>{for(const override of [{clientOrderId:'someone_else'},{symbol:'ETHUSDT'},{orderId:'1'},{side:'SELL'},{positionSide:'SHORT'}])await assert.rejects(()=>harness({order:{...nativeOrder(),...override}}).collect(),/BINANCE_ORDER_SCOPE_MISMATCH/);});
test('unsafe numeric broker IDs are rejected rather than rounded',async()=>{await assert.rejects(()=>harness({trades:[fill({id:9007199254740996})]}).collect(),/BINANCE_ID_PRECISION_UNVERIFIED/);});
test('foreign fills fail the whole batch instead of contributing another robot profit',async()=>{await assert.rejects(()=>harness({trades:[fill({orderId:'13'})]}).collect(),/BINANCE_TRADE_SCOPE_MISMATCH/);});
test('missing and duplicate fills cannot produce complete evidence',async()=>{await assert.rejects(()=>harness({trades:[]}).collect(),/BINANCE_FILL_RECONCILIATION_PENDING/);await assert.rejects(()=>harness({trades:[fill(),fill()]}).collect(),/BINANCE_DUPLICATE_TRADE/);});
test('order mutation while fills are being collected requires a new snapshot',async()=>{await assert.rejects(()=>harness({order:n=>({...nativeOrder(),updateTime:now-(n===1?1000:900)})}).collect(),/BINANCE_ORDER_CHANGED_DURING_COLLECTION/);});
test('partial cancellation is an order state, not closure of a position',async()=>{const e=await harness({order:{...nativeOrder(),status:'CANCELED',origQty:'2'}}).collect();assert.equal(e.orders[0].executedQuantity,'1');assert.equal(e.orders[0].positionReconciled,false);});
test('unfilled rejected order has no invented trade or P&L',async()=>{const h=harness({order:{...nativeOrder(),status:'REJECTED',executedQty:'0'},trades:[]});const e=await h.collect();assert.equal(e.orders[0].trades.length,0);assert.equal(h.requests.some(r=>r.url.pathname==='/fapi/v1/userTrades'),false);assert.equal(e.orders[0].net,null);});
test('unsupported retention window fails instead of claiming all history',async()=>{await assert.rejects(()=>harness({order:{...nativeOrder(),time:now-90*86400000}}).collect(),/BINANCE_HISTORY_OUTSIDE_SUPPORTED_WINDOW/);});
test('fills are queried in at most seven-day inclusive windows',async()=>{const h=harness({order:{...nativeOrder(),time:now-15*86400000}});await h.collect();const calls=h.requests.filter(r=>r.url.pathname==='/fapi/v1/userTrades');assert.equal(calls.length,3);for(const r of calls)assert.ok(Number(r.url.searchParams.get('endTime'))-Number(r.url.searchParams.get('startTime'))<7*86400000);});
test('full fill pages are subdivided without skipping a time boundary',async()=>{
 const trades=Array.from({length:1500},(_,i)=>fill({id:String(i+1),qty:'1',time:now-2000+i}));
 const h=harness({order:{...nativeOrder(),origQty:'1500',executedQty:'1500',updateTime:now-501},trades});const e=await h.collect();assert.equal(e.orders[0].trades.length,1500);assert.equal(new Set(e.orders[0].trades.map(t=>t.tradeId)).size,1500);
});
test('a saturated one-millisecond fill page cannot be silently truncated',async()=>{
 const trades=Array.from({length:1000},(_,i)=>fill({id:String(i+1)}));
 await assert.rejects(()=>harness({order:{...nativeOrder(),time:now-1000,origQty:'1000',executedQty:'1000'},trades}).collect(),/BINANCE_TRADE_PAGE_INCOMPLETE/);
});
test('full funding pages are subdivided and remain unattributed',async()=>{const rows=Array.from({length:1001},(_,i)=>funding({tranId:String(i+1),time:now-2000+i}));const e=await harness({fundingRows:rows}).collect();assert.equal(e.context[0].funding.length,1001);assert.equal(e.context[0].fundingAllocated,false);});
test('deposits, transfers and unrelated symbols never enter funding evidence',async()=>{for(const override of [{incomeType:'TRANSFER'},{symbol:'ETHUSDT'}])await assert.rejects(()=>harness({fundingRows:[funding(override)]}).collect(),/BINANCE_FUNDING_SCOPE_MISMATCH/);});
test('position rows from another symbol or duplicate hedge side are rejected',async()=>{const p={symbol:'BTCUSDT',positionSide:'BOTH',positionAmt:'1',entryPrice:'100',unRealizedProfit:'0',marginAsset:'USDT',updateTime:now};for(const positions of [[{...p,symbol:'ETHUSDT'}],[p,p]])await assert.rejects(()=>harness({positions}).collect(),/BINANCE_POSITION_SCOPE_MISMATCH/);});
test('rate limits, regional restrictions and authentication denials do not retry or disclose upstream messages',async()=>{for(const [status,code] of [[429,'BINANCE_RATE_LIMITED'],[418,'BINANCE_RATE_LIMITED'],[451,'BINANCE_REGION_RESTRICTED'],[403,'BINANCE_ACCESS_FORBIDDEN'],[401,'BINANCE_AUTHENTICATION_REJECTED']]){const h=harness({handler:()=>new Response(env.JENIOS_BINANCE_API_SECRET,{status})});await assert.rejects(()=>h.collect(),new RegExp(code));assert.equal(h.requests.length,1);}});
test('missing historical order stays unknown and never becomes cancelled',async()=>{await assert.rejects(()=>harness({handler:u=>u.pathname==='/fapi/v1/order'?Response.json({code:-2013,msg:'does not exist'},{status:400}):undefined}).collect(),/BINANCE_ORDER_HISTORY_UNAVAILABLE/);});
test('transport error messages and redirect details are not exposed',async()=>{await assert.rejects(()=>harness({handler:()=>{throw Error(env.JENIOS_BINANCE_API_SECRET);}}).collect(),/^Error: BINANCE_READ_FAILED$/);await assert.rejects(()=>harness({handler:()=>({redirected:true})}).collect(),/BINANCE_REDIRECT_DENIED/);});
test('oversized response and invalid clock are rejected',async()=>{await assert.rejects(()=>harness({handler:()=>new Response('x'.repeat(2_000_001))}).collect(),/BINANCE_RESPONSE_TOO_LARGE/);await assert.rejects(()=>harness({clock:()=>now+60000}).collect(),/BINANCE_CLOCK_UNVERIFIED/);});
test('concurrent collection is rejected and caller mutation cannot retarget an in-flight read',async()=>{
 let release;const block=new Promise(r=>{release=r;});const h=harness({handler:async(u)=>{if(u.pathname==='/fapi/v1/time')await block;}});const input={...ref};const first=h.collector.collect([input]);input.symbol='ETHUSDT';await assert.rejects(()=>h.collect(),/BINANCE_COLLECTION_BUSY/);release();const e=await first;assert.equal(e.orders[0].symbol,'BTCUSDT');
});
test('unknown order statuses and contradictory filled quantities fail closed',async()=>{for(const override of [{status:'SETTLED_SOMEDAY'},{executedQty:'2'},{status:'NEW'},{status:'PARTIALLY_FILLED'}])await assert.rejects(()=>harness({order:{...nativeOrder(),...override}}).collect());});
test('missing commissions, malformed decimals and negative executed quantity are rejected',async()=>{for(const override of [{commission:null},{qty:'NaN'},{qty:'-1'},{price:'0'},{realizedPnl:'1e10'},{marginAsset:'invalid asset'}])await assert.rejects(()=>harness({trades:[fill(override)]}).collect());await assert.rejects(()=>harness({order:{...nativeOrder(),executedQty:'-1'}}).collect());});
test('funding duplicate transaction and saturated one-millisecond window never yield a complete report',async()=>{
 await assert.rejects(()=>harness({fundingRows:[funding(),funding()]}).collect(),/BINANCE_DUPLICATE_FUNDING/);
 const rows=Array.from({length:1000},(_,i)=>funding({tranId:String(i+1),time:now}));await assert.rejects(()=>harness({fundingRows:rows}).collect(),/BINANCE_FUNDING_PAGE_INCOMPLETE/);
});
test('JSON body errors never surface provider message text',async()=>{await assert.rejects(()=>harness({handler:()=>Response.json({code:-1000,msg:env.JENIOS_BINANCE_API_SECRET})}).collect(),/^Error: BINANCE_PROVIDER_REJECTED$/);await assert.rejects(()=>harness({handler:()=>new Response('not json')}).collect(),/^Error: BINANCE_RESPONSE_INVALID$/);});
test('trades without marginAsset retain unknown settlement currency rather than inventing one',async()=>{const t=fill();delete t.marginAsset;const e=await harness({trades:[t]}).collect();assert.equal(e.orders[0].trades[0].marginAsset,null);assert.equal(e.orders[0].net,null);});
test('trade query filter violation outside the requested interval is rejected',async()=>{await assert.rejects(()=>harness({handler:u=>u.pathname==='/fapi/v1/userTrades'?Response.json([fill({time:now+100000})]):undefined}).collect(),/BINANCE_TRADE_RESPONSE_INVALID/);});
test('position response null and unsupported asset return only sanitized domain errors',async()=>{await assert.rejects(()=>harness({positions:[null]}).collect(),/BINANCE_POSITION_SCOPE_MISMATCH/);});
test('Spot cannot be passed to the Futures collector or inferred from a generic crypto market',async()=>{for(const product of ['spot','crypto',undefined])assert.throws(()=>new BinanceOrderCollector({product,environment:'demo',expectedKeyFingerprint:'0'.repeat(64)},{env}),/BINANCE_FUTURES_PRODUCT_REQUIRED/);assert.equal((await harness().collect()).product,'usds_m_futures');});
