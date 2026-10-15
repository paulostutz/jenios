import test from 'node:test';
import assert from 'node:assert/strict';
import { screenNewPools, createNewTokenRadar } from '../lib/newTokenRadar.mjs';
const now = Date.parse('2026-10-15T01:00:00Z');
function fixture() { return { data:[{id:'eth_0xabc',type:'pool',attributes:{address:'0xabc',pool_created_at:'2026-10-15T00:00:00Z',reserve_in_usd:'50000',volume_usd:{h1:'100000'},price_change_percentage:{h1:'10'},transactions:{h1:{buys:200,sells:100,buyers:100}}},relationships:{base_token:{data:{id:'eth_0xdef'}}}}],included:[{id:'eth_0xdef',type:'token',attributes:{address:'0xdef',name:'Synthetic QA',symbol:'QA',coingecko_coin_id:null}}]}; }
test('qualifying pool exposes evidence but never asserts token birth or institutional buying', () => {
  const [row] = screenNewPools(fixture(),{now});
  assert.equal(row.comprasH1,200);assert.equal(row.criacaoTokenConfirmada,false);assert.equal(row.comprasInstitucionaisConfirmadas,false);
  assert.equal(row.url,'https://www.geckoterminal.com/eth/pools/0xabc');
});
test('old, future, too young or unknown pool dates excluded', () => {
  for (const date of ['2026-10-01T00:00:00Z','2026-10-16T00:00:00Z','2026-10-15T00:59:00Z',null,'invalid']) {
    const f=fixture();f.data[0].attributes.pool_created_at=date;assert.deepEqual(screenNewPools(f,{now}),[]);
  }
});
test('established assets and catalogued coins excluded even with fresh pools', () => {
  for (const symbol of ['USDC','USDT','WETH','BTC','SOL']) { const f=fixture();f.included[0].attributes.symbol=symbol;assert.deepEqual(screenNewPools(f,{now}),[]); }
  const f=fixture();f.included[0].attributes.coingecko_coin_id='old-token';assert.deepEqual(screenNewPools(f,{now}),[]);
});
test('activity gates reject low liquidity, wash-like turnover, few buyers and sell pressure', () => {
  for (const change of [a=>a.reserve_in_usd='20000',a=>a.volume_usd.h1='100',a=>a.volume_usd.h1='2000000',a=>a.transactions.h1.buyers=2,a=>a.transactions.h1.sells=900,a=>a.transactions.h1.buys=null,a=>a.price_change_percentage.h1='-1']) {
    const f=fixture();change(f.data[0].attributes);assert.deepEqual(screenNewPools(f,{now}),[]);
  }
});
test('identity mismatch and unsafe addresses never become links', () => {
  const f=fixture();f.included[0].attributes.address='https://evil.example';assert.deepEqual(screenNewPools(f,{now}),[]);
  const g=fixture();g.data[0].id='bsc_0xabc';assert.deepEqual(screenNewPools(g,{now}),[]);
});
test('deduplicates by network and contract', () => {const f=fixture();f.data.push(structuredClone(f.data[0]));assert.equal(screenNewPools(f,{now}).length,1);});
test('successful empty scan differs from failed source; malformed data fails closed', async () => {
  const radar=createNewTokenRadar({now:()=>now,env:{},fetchImpl:async()=>({ok:true,json:async()=>({data:[],included:[]})})});
  assert.equal((await radar()).disponivel,true);
  const broken=createNewTokenRadar({now:()=>now,env:{},fetchImpl:async()=>({ok:true,json:async()=>({coins:[]})})});
  assert.equal((await broken()).disponivel,false);
});
test('cached deduped calls protect provider; expiry failure never retains candidates', async () => {
  let time=now,calls=0;
  const radar=createNewTokenRadar({now:()=>time,env:{},fetchImpl:async()=>{calls++;return calls===1?{ok:true,json:async()=>fixture()}:{ok:false,status:429};}});
  const results=await Promise.all([radar(),radar()]);assert.equal(calls,1);results[0].candidatos.length=0;
  assert.equal((await radar()).candidatos.length,1);
  time+=300001;const failed=await radar();assert.equal(failed.disponivel,false);assert.deepEqual(failed.candidatos,[]);
  await radar();assert.equal(calls,2);
});
test('Demo/Pro credentials use only provider headers and static keyed hosts',async()=>{
  for(const pro of [false,true]) {
    const key=pro?'COINGECKO_PRO_API_KEY':'COINGECKO_DEMO_API_KEY';let request;
    const radar=createNewTokenRadar({now:()=>now,env:{[key]:'secret'},fetchImpl:async(url,options)=>{request={url,options};return {ok:true,json:async()=>fixture()};}});
    assert.equal(JSON.stringify(await radar()).includes('secret'),false);
    assert.equal(new URL(request.url).hostname,pro?'pro-api.coingecko.com':'api.coingecko.com');
    assert.equal(request.options.headers[pro?'x-cg-pro-api-key':'x-cg-demo-api-key'],'secret');assert.equal(request.options.redirect,'error');
  }
});
