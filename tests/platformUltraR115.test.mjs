import test from 'node:test';
import assert from 'node:assert/strict';
import {assessUltraLeverage,ultraOperationalBlockers} from '../lib/platform/ultra/policy.mjs';
import {assessUltraLeverage as assessCurrentUltraLeverage} from '../lib/platform/ultra/policy-r125.mjs';
import {rankUltraCandidates,sizeUltraPosition} from '../lib/platform/ultra/selection.mjs';
import {ultraPeriodStart} from '../lib/platform/ultra/reporting.mjs';
import {ultraHttp,ultraReviewDigest} from '../lib/platform/ultra/http.mjs';
import {reviewUltraOrder,authorizeUltraReview} from '../lib/platform/ultra/order-review.mjs';
import {socialAuthReturnPath} from '../app/components/social-auth-return.mjs';
const config={markets:[{id:'crypto',capital:1000,leverage:20,currency:'USDT'}],sessionMinutes:60,maxPositions:3,tradeRiskPct:.25,dailyLossPct:2,maxAssetPct:20,excludedSymbols:[]};
test('Ultra login retains its exact internal destination without widening redirect scope',()=>{
 assert.equal(socialAuthReturnPath('/platform/ultra'),'/platform/ultra');
 for(const path of ['/platform/ultra?next=https://example.test','/platform/ultra/../admin','//example.test','https://example.test'])assert.equal(socialAuthReturnPath(path),'/social');
});
test('20x and 100x are advisory choices, with an explicit account-loss scenario',()=>{
 for(const leverage of [20,100]){
  const p=assessUltraLeverage({...config,markets:[{...config.markets[0],leverage}]});
  assert.equal(p.markets[0].exposure,1000*leverage);
  assert.equal(p.markets[0].scenarios[2].loss,50*leverage);
  assert.equal(p.requiresAcknowledgement,true);assert.equal(p.liveExecutionEnabled,false);
 }
});
test('low exposure does not require an unnecessary warning; malformed budgets cannot be saved',()=>{
 assert.equal(assessUltraLeverage({...config,markets:[{...config.markets[0],leverage:1}]}).requiresAcknowledgement,false);
 for(const capital of [0,-1,Infinity,NaN,1.001])assert.throws(()=>assessUltraLeverage({...config,markets:[{...config.markets[0],capital}]}));
 assert.throws(()=>assessUltraLeverage({...config,markets:[config.markets[0],config.markets[0]]}));
});
test('all three markets remain separate budgets and currencies; Forex is explicit',()=>{
 const markets=[['b3','BRL'],['crypto','USDT'],['forex','USD']].map(([id,currency])=>({id,currency,capital:1000,leverage:5}));
 assert.equal(assessUltraLeverage({...config,markets}).markets.length,3);
});
const validState=Object.fromEntries(ultraOperationalBlockers().map(k=>[k,true]));
test('risk acknowledgement cannot override insufficient margin or provider permission',()=>{
 const review=reviewUltraOrder({ownerId:'one',connectionId:'account',order:{market:'forex',symbol:'EURUSD',side:'buy',currency:'USD',notional:20000,leverage:20},account:{allocatedCapital:1000,equity:2000},technicalState:validState,nowMs:1000});
 const args={ownerId:'one',connectionId:'account',nowMs:2000,technicalState:validState};
 assert.equal(authorizeUltraReview(review,args).decision,'AWAITING_RISK_ACKNOWLEDGEMENT');
 const acknowledgement={reviewDigest:review.reviewDigest,accepted:true};
 assert.equal(authorizeUltraReview(review,{...args,acknowledgement}).decision,'REVIEW_ACCEPTED');
 assert.equal(authorizeUltraReview(review,{...args,acknowledgement,technicalState:{...validState,marginSufficient:false}}).decision,'TECHNICAL_BLOCK');
 assert.throws(()=>authorizeUltraReview(review,{...args,acknowledgement,nowMs:61000}));
 assert.throws(()=>authorizeUltraReview(review,{...args,acknowledgement,ownerId:'another'}));
 assert.throws(()=>authorizeUltraReview({...review,requiresAcknowledgement:false},args));
 assert.throws(()=>authorizeUltraReview({...review,notional:30000},{...args,acknowledgement}));
});
test('existing R53 selection excludes stale, illiquid and client-excluded assets across markets',()=>{
 const base={market:'forex',symbol:'EURUSD',marketOpen:true,observedAtMs:1000,liquidityVerified:true,volatilityBps:40,spreadBps:1,depthUsd:3e6,fillProbability:.9,roundTripCostBps:3,adverseSelectionBps:1,stabilityRatio:.9};
 const cfg={...config,markets:[{id:'forex',currency:'USD',capital:1000,leverage:20}],excludedSymbols:['GBPUSD']};
 const ranked=rankUltraCandidates(cfg,[base,{...base,symbol:'GBPUSD'},{...base,symbol:'USDJPY',observedAtMs:0}],1500);
 assert.equal(ranked[0].symbol,'EURUSD');assert.equal(ranked[0].eligible,true);
 assert.equal(ranked.filter(x=>x.eligible).length,1);
 assert.equal(rankUltraCandidates(cfg,[{...base,liquidityVerified:false}],1500)[0].eligible,false);
 assert.equal(rankUltraCandidates(cfg,[base,{...base,symbol:'eurusd'}],1500).filter(x=>x.eligible).length,0);
});
test('lot sizing respects risk, available margin and contract conversion',()=>{
 const sized=sizeUltraPosition({capital:10000,leverage:20,entryPrice:100,stopDistance:2,contractMultiplier:10,quoteToAccount:1,lotStep:1,minLot:1,freeMargin:60,marginPerLot:20,costPerLot:5,tradeRiskPct:1,maxAssetPct:20});
 assert.equal(sized.lots,3);assert.equal(sized.estimatedLoss,75);
});
test('report period boundaries use Bahia midnight and inclusive calendar days',()=>{
 const now=new Date('2026-11-10T02:30:00Z');
 assert.equal(ultraPeriodStart('today',now),'2026-11-09T03:00:00.000Z');
 assert.equal(ultraPeriodStart('7d',now),'2026-11-03T03:00:00.000Z');
 assert.equal(ultraPeriodStart('all',now),null);
 assert.throws(()=>ultraPeriodStart('bad',now));
});
function request(body,token=true){return new Request('https://www.jenios.com.br/api/platform/ultra',{method:'POST',headers:{'content-type':'application/json',origin:'https://www.jenios.com.br',...(token?{authorization:'Bearer '+'a'.repeat(24)}:{})},body:JSON.stringify(body)});}
function dbFixture(){
 const writes=[];
 return {writes,db:{auth:{getUser:async()=>({data:{user:{id:'server-owner'}}})},from:table=>({insert:row=>{writes.push({table,row});return {select:()=>({single:async()=>({data:{id:'plan-1',...row}})})};}})}};
}
test('authenticated save records the exact review and server identity; changed review must be revisited',async()=>{
 const f=dbFixture();const opts={getAdmin:()=>f.db};const assessment=assessCurrentUltraLeverage(config);
 const body={action:'save',config,reviewDigest:ultraReviewDigest(assessment),riskAcknowledged:true};
 assert.equal((await ultraHttp(request(body,false),opts)).status,401);
 assert.equal((await ultraHttp(request({...body,riskAcknowledged:false}),opts)).status,409);
 assert.equal((await ultraHttp(request({...body,config:{...config,sessionMinutes:90}}),opts)).status,409);
 assert.equal((await ultraHttp(request(body),opts)).status,201);
 assert.equal(f.writes.length,1);assert.equal(f.writes[0].row.user_id,'server-owner');
 assert.equal(f.writes[0].row.risk_acknowledged,true);assert.deepEqual(f.writes[0].row.config,assessment.config);
});
test('start never manufactures operational readiness',async()=>{
 const f=dbFixture();const res=await ultraHttp(request({action:'start'}),{getAdmin:()=>f.db});
 assert.equal(res.status,409);assert.equal((await res.json()).liveExecutionEnabled,false);assert.equal(f.writes.length,0);
});
test('financial reports use the validated account identity and the requested calendar period',async()=>{
 const calls=[];
 const db={auth:{getUser:async()=>({data:{user:{id:'owner-from-session'}}})},from:table=>({select:()=>({eq:(column,value)=>{calls.push({table,column,value});return {order:()=>({limit:async()=>({data:[]})})};}})}),rpc:async(name,args)=>{calls.push({name,args});return {data:{totals:[],lifetime:[],operations:[],days:[],count:0,unrealized:null}};}};
 const req=new Request('https://www.jenios.com.br/api/platform/ultra?period=7d&page=2',{headers:{authorization:'Bearer '+'a'.repeat(24)}});
 const result=await ultraHttp(req,{getAdmin:()=>db,now:()=>new Date('2026-11-10T02:30:00Z')});
 assert.equal(result.status,200);assert.equal((await result.json()).liveExecutionEnabled,false);
 assert.deepEqual(calls[0],{table:'jenios_ultra_plans',column:'user_id',value:'owner-from-session'});
 assert.deepEqual(calls[1],{name:'jenios_ultra_financial_report',args:{p_user_id:'owner-from-session',p_since:'2026-11-03T03:00:00.000Z',p_until:'2026-11-10T02:30:00.000Z',p_page:2}});
});
