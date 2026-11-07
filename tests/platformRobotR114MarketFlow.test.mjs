import test from 'node:test';
import assert from 'node:assert/strict';
import {buildMarketFlowContext,inspectMarketFlow,refineReverseWithFlow,FLOW_POLICY} from '../lib/platform/research/market-flow-context.mjs';
import {createMarketFlowProvider} from '../lib/platform/research/market-flow-provider.mjs';
const now=1800000000000;
function trades({maker=true,buyWeight=1,sellWeight=8,up=false}={}){
 return Array.from({length:12},(_,i)=>({a:100+i,T:now-60000+Math.floor(i/4)*20000+(i%4)*6000,
  p:String(100+(up?1:-1)*(i%4)*.02),q:String((i%4===0?buyWeight:sellWeight)*100),m:i%4===0?!maker:maker}));
}
const whales={rows:[{id:'a'.repeat(64),simbolo:'BTC',quantidade:150,data:new Date(now-10000).toISOString()}],
 status:{disponivel:true,stale:false,historico:false,parcial:false,atualizadoEm:new Date(now).toISOString()}};
const build=(options={})=>buildMarketFlowContext({trades:trades(),startMs:now-60000,endMs:now,
 receivedAtMs:now,complete:true,whales,evidenceKind:'SYNTHETIC',...options});
const inspect=(context,options={})=>inspectMarketFlow(context,{symbol:'BTC-USDT',side:'buy',nowMs:now,...options});
const core=Object.freeze({side:'buy',action:'preserve_trend_aligned_intent',mayClose:true,confirmationRequired:true});
test('R114 correctly reads maker-side, counts unique transfers and never assigns them direction',()=>{
 const x=build({whales:{...whales,rows:[...whales.rows,...whales.rows]}});
 assert.equal(x.usable,true);assert.ok(x.windows[0].imbalance<-.91);
 assert.equal(x.whales.recentTransfers,1);assert.equal(x.whales.direction,null);
 assert.equal(inspect(x).wouldWait,true);assert.equal(x.ordersSent,0);
 assert.ok(Object.isFrozen(x.windows[0]));
});
test('R114 uses a transfer only together with persistent adverse executed trades and price movement',()=>{
 const moderate=trades({buyWeight:4,sellWeight:8});
 assert.equal(inspect(build({trades:moderate,whales:null})).wouldWait,false);
 assert.equal(inspect(build({trades:moderate})).wouldWait,true);
 assert.equal(inspect(build({trades:moderate.map(t=>({...t,p:'100'}))})).wouldWait,false);
 assert.equal(inspect(build({trades:trades({maker:false,up:true})})).wouldWait,false);
});
test('R114 requires all three independent windows to conflict',()=>{
 const x=trades();x.slice(0,4).forEach(t=>{t.m=!t.m;});
 assert.equal(inspect(build({trades:x})).wouldWait,false);
});
test('R114 no lookup or veto applies to other assets, venues or market types',()=>{
 for(const scope of [{symbol:'ETH-USDT'},{venue:'kraken'},{marketType:'futures'},{symbol:'BTC-USD'}]){
  const x=inspect(null,scope);assert.equal(x.applicable,false);assert.equal(x.wouldWait,false);
 }
});
for(const [name,status] of [['stale',{stale:true}],['partial',{parcial:true}],['history',{historico:true}],
 ['unavailable',{disponivel:false}],['future',{atualizadoEm:new Date(now+1).toISOString()}]]){
 test('R114 excludes '+name+' whale results from the decision',()=>{
  const x=build({trades:trades({buyWeight:4,sellWeight:8}),whales:{...whales,status:{...whales.status,...status}}});
  assert.equal(x.whales.recentTransfers,0);assert.equal(inspect(x).wouldWait,false);
 });
}
test('R114 refuses duplicate, malformed, out of order and future trades',()=>{
 for(const mutate of [a=>a[1].a=a[0].a,a=>a[1].T=a[0].T-1,a=>a[0].p='Infinity',
 a=>a[0].q='-1',a=>a[0].m='false',a=>a[11].T=now+1]){
  const rows=trades();mutate(rows);assert.throws(()=>build({trades:rows}));
 }
});
test('R114 gaps, capped coverage and low activity cannot be used as healthy flow',()=>{
 const rows=trades();rows.slice(5).forEach(t=>t.a++);
 for(const x of [build({trades:rows}),build({complete:false}),build({trades:trades().slice(0,3)}),
 build({trades:trades().map(t=>({...t,q:'0.001'}))})])assert.equal(x.usable,false);
});
test('R114 accepts exact freshness limit and refuses later or future observations',()=>{
 const x=build();assert.equal(inspect(x,{nowMs:now+5000}).reason,'LARGE_TRANSFER_WITH_PERSISTENT_ADVERSE_TRADES');
 assert.match(inspect(x,{nowMs:now+5001}).reason,/STALE/);
 assert.match(inspect(x,{nowMs:now-1}).reason,/STALE/);
 assert.equal(build({receivedAtMs:now+5001}).usable,false);
});
test('R114 does not extend the age of old trade data by fetching it again',()=>{
 assert.equal(build({trades:trades().map(t=>({...t,T:Math.min(t.T,now-6000)}))}).usable,false);
});
test('R114 preserves refusals, trend exceptions, manual/hybrid modes, exits and position protections',()=>{
 const context=build();const options={symbol:'BINANCE:BTCUSDT',context,nowMs:now};
 const waiting={side:null,action:'reverse_not_calibrated',mayClose:true};
 assert.equal(refineReverseWithFlow(waiting,options),waiting);
 for(const action of ['close','cancel','reduce','stop'])assert.equal(refineReverseWithFlow(core,{...options,action}),core);
 for(const mode of ['manual','hybrid'])assert.equal(refineReverseWithFlow(core,{...options,mode}),core);
 const r=refineReverseWithFlow(core,options);assert.equal(r.side,null);assert.equal(r.originalSide,'buy');
 assert.equal(r.confirmationRequired,true);assert.equal(r.mayClose,true);
 const allowed=refineReverseWithFlow({...core,side:'sell'},options);assert.equal(allowed.side,'sell');
});
test('R114 missing BTC context waits rather than relabeling unavailable data as neutral',()=>{
 assert.equal(refineReverseWithFlow(core,{symbol:'BINANCE:BTCUSDT',context:null,nowMs:now}).side,null);
});
test('R114 public provider reuses cache, coalesces concurrent requests and exposes no order endpoint',async()=>{
 let count=0;const provider=createMarketFlowProvider({clock:()=>now,whaleReader:async()=>whales,
 fetchImpl:async(url,options)=>{count++;assert.equal(url.hostname,'data-api.binance.vision');
  assert.equal(options.method,'GET');assert.equal(url.searchParams.get('symbol'),'BTCUSDT');
  assert.equal(url.pathname,'/api/v3/aggTrades');return Response.json(trades());}});
 const [a,b]=await Promise.all([provider.refresh(),provider.refresh()]);
 assert.equal(count,1);assert.equal(a,b);assert.equal(provider.read(),a);assert.equal(a.usable,true);
 await provider.refresh();assert.equal(count,1);
});
test('R114 provider refuses HTTP failures, oversized JSON, malformed pages and invalid sequences',async()=>{
 for(const response of [new Response('',{status:429}),new Response('{}',{headers:{'content-length':'512001'}}),
 Response.json({bad:true}),Response.json([{a:1,T:now},{a:1,T:now}])]){
  const p=createMarketFlowProvider({clock:()=>now,whaleReader:async()=>null,fetchImpl:async()=>response});
  assert.equal((await p.refresh()).usable,false);
 }
});
test('R114 bounded pagination detects missing pages and trims events after cutoff',async()=>{
 const page=Array.from({length:1000},(_,i)=>({a:100+i,T:now-60000+i*50,p:String(100-i*.0001),q:'100',m:true}));
 let calls=0;const p=createMarketFlowProvider({clock:()=>now,whaleReader:async()=>whales,fetchImpl:async url=>{
  calls++;if(calls===1)return Response.json(page);
  assert.equal(url.searchParams.get('fromId'),'1100');
  return Response.json([{a:1100,T:now-100,p:'99.9',q:'100',m:true},{a:1101,T:now+1,p:'99.9',q:'100',m:true}]);
 }});
 const x=await p.refresh();assert.equal(calls,2);assert.equal(x.usable,true);
});
test('R114 freshness policy is versioned and experimental, not a profitability claim',()=>{
 assert.ok(Object.isFrozen(FLOW_POLICY));assert.equal(build().financialPerformanceCertified,false);
});
