import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {planR7,parseR7Coinbase,parseR7Kraken,inspectR7PublicHour} from '../lib/platform/research/robot-r7-public-h1.mjs';
const T=Date.parse('2026-10-22T08:15:00Z'),p=planR7({nowMs:T}),sec=p.openMs/1000;
const cb=[[sec,99,102,100,101,25]];
const kr={error:[],result:{XXBTZUSD:[[sec,'100','102.1','99','101.02','100.4','24',2],[sec+3600,'101','103','100','102','101.5','21',3]],last:sec+3600}};
const fetcher=async(url,opts)=>{assert.equal(opts.method,'GET');assert.equal(opts.redirect,'error');assert.equal(opts.credentials,'omit');return Response.json(url.includes('kraken')?kr:cb)};
test('R7 plans a closed H1 at least 10m old',()=>{assert.equal(p.closeMs,Date.parse('2026-10-22T08:00:00Z'));assert.equal(planR7({nowMs:Date.parse('2026-10-22T09:05:00Z')}).closeMs,p.closeMs)});
test('R7 excludes uncommitted Kraken candle by exact start timestamp',()=>{assert.equal(parseR7Kraken(kr,p).close,101.02);assert.equal(parseR7Coinbase(cb,p).close,101)});
test('R7 rejects duplicate, invalid or missing public candles',()=>{
 assert.throws(()=>parseR7Coinbase([cb[0],cb[0]],p));
 assert.throws(()=>parseR7Kraken({error:['error'],result:kr.result},p));
 assert.throws(()=>parseR7Kraken({error:[],result:{last:0}},p));
});
test('R7 uses two public GETs without authorizing trades or PnL',async()=>{
 const a=await inspectR7PublicHour({plan:p,observedAtMs:T,fetcher});
 assert.equal(a.publicHttpsRequestsObserved,2);assert.equal(a.sourceProviderSignaturesVerified,false);
 assert.equal(a.prospectivePredictionVerified,false);assert.equal(a.ordersSent,0);assert.equal(a.realizedPnl,null);
});
test('R7 refuses changed request path and still-open time',async()=>{
 await assert.rejects(()=>inspectR7PublicHour({plan:{...p,urls:[p.urls[0],'https://api.kraken.com/0/private/AddOrder']},observedAtMs:T,fetcher}),/R7_TAMPERED_PLAN/);
 await assert.rejects(()=>inspectR7PublicHour({plan:p,observedAtMs:1,fetcher}),/R7_TAMPERED_PLAN/);
});
test('R7 logs provider disagreement without declaring a winner',async()=>{
 const shifted=async url=>Response.json(url.includes('kraken')?{error:[],result:{XXBTZUSD:[[sec,'100','104','99','103','101','24',2]],last:sec}}:cb);
 const a=await inspectR7PublicHour({plan:p,observedAtMs:T,fetcher:shifted});
 assert.ok(a.issues.includes('CLOSE_DIVERGENCE'));assert.equal(a.realizedPnl,null);
});
test('R7 fails closed on broken public HTTP',async()=>{
 await assert.rejects(()=>inspectR7PublicHour({plan:p,observedAtMs:T,fetcher:()=>Response.json({}, {status:500})}),/R7_HTTP_ERROR/);
});
test('R7 mock 300 observations are NOT prospective robot predictions',async()=>{
 for(let i=0;i<300;i++){
  const plan=planR7({nowMs:T+i*3600000}),t=plan.openMs/1000;
  const f=async url=>Response.json(url.includes('kraken')?{error:[],result:{XBTUSD:[[t,'100','102','99','101.02','100','24',3]],last:t}}:[[t,99,102,100,101,25]]);
  const x=await inspectR7PublicHour({plan,observedAtMs:plan.nowMs,fetcher:f});
  assert.equal(x.prospectivePredictionVerified,false);assert.equal(x.tradingAuthorized,false);
 }
});
test('R7 module no order transport or paid AI',()=>{
 const code=readFileSync(new URL('../lib/platform/research/robot-r7-public-h1.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(code,/submitOrder|createOrder|OPENAI_API_KEY|process\.env/);
 const v=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url),'utf8'));
 assert.equal(v.git.deploymentEnabled['fix/jenios-robot-r7-official-public-readonly-h1-20261022'],false);
});
