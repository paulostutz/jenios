import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,statSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {units,decimal,SCALE,digest,assertRehearsal,assertNoLiveTransport,instrument,BASE_COMMIT} from '../lib/platform/pilot-prep/contracts.mjs';
import {closedBars,QuoteSequence} from '../lib/platform/pilot-prep/market-quality.mjs';
import {refineDecision,tighteningStop} from '../lib/platform/pilot-prep/refinement.mjs';
import {orderRisk} from '../lib/platform/pilot-prep/risk.mjs';
import {PaperLedger} from '../lib/platform/pilot-prep/paper-ledger.mjs';
import {limitDraft,actionPlan,submitLive,PROVIDERS} from '../lib/platform/pilot-prep/adapters.mjs';
import {pilotReadiness,REQUIRED} from '../lib/platform/pilot-prep/readiness.mjs';
const now=1792512000000,sha='a'.repeat(64);
const session={userId:'fixture-a',authenticated:true,diagnosticCompleted:true};
const connection={id:'connection-a',userId:'fixture-a',provider:'ctrader',accountId:'12345',environment:'paper',permissions:['read','trade'],revoked:false,ownershipConfirmedAtMs:now-1000};
const meta={provider:'ctrader',id:'1',marketType:'linear',base:'BTC',quote:'USD',settlement:'USD',contractSize:'1',qtyStep:'0.01',minQty:'0.01',maxQty:'100',tickSize:'0.01',capturedAtMs:now-1000,sourceSha256:sha,quantityUnit:'base'};
const order={clientOrderId:'example-1',mode:'direct',side:'buy',quantity:'1',entry:'100',stop:'99',target:'103'};
const costs={roundTripFeeBps:10,slippageBps:2,fundingCost:'0'};
const quote={provider:meta.provider,instrument:meta.id,receivedAtMs:now-10,sourceAtMs:now-15,bid:'99.99',ask:'100.01'};
const input={order,meta,costs,quote,now};
const limits={currency:'USD',ownerRisk:'3',accountRisk:'3',orderRisk:'2',notional:'1000',dailyLoss:'5',maxOrders:4};
function fixture(fn){const dir=mkdtempSync(join(tmpdir(),'jenios-paper-')),path=join(dir,'paper.db'),db=new PaperLedger(path);try{db.configure(session,connection,limits);return fn(db,path);}finally{db.close();rmSync(dir,{recursive:true,force:true});}}
const err=(fn,code)=>assert.throws(fn,e=>e.code===code);
for(const value of ['0','1','1.23','0.00000001','9999999999999999.99999999'])test('B149 exact decimal roundtrip '+value,()=>assert.equal(decimal(units(value)),value));
for(const value of [1,'01','1e2','-1','1.123456789','NaN','',' 1','+2'])test('B149 rejects imprecise decimal '+String(value),()=>err(()=>units(value),'DECIMAL_STRING_REQUIRED'));
test('B149 all live switches are hard blocked, even with seemingly approved account',()=>{err(()=>assertNoLiveTransport(),'LIVE_EXECUTION_DISABLED');err(()=>submitLive(),'LIVE_EXECUTION_DISABLED');err(()=>assertRehearsal(session,{...connection,environment:'live'}),'LIVE_EXECUTION_DISABLED');});
for(const [patch,code] of [[{userId:'other'},'ACCOUNT_OWNER_MISMATCH'],[{revoked:true},'CONNECTION_REVOKED'],[{permissions:['read','withdraw']},'UNSAFE_OR_UNKNOWN_PERMISSION'],[{permissions:['read','admin']},'UNSAFE_OR_UNKNOWN_PERMISSION'],[{apiKey:'not-accepted'},'UNKNOWN_FIELD']])test('B149 connection denial '+code,()=>err(()=>assertRehearsal(session,{...connection,...patch}),code));
test('B149 inverse metadata is never treated as USD settled linear metadata',()=>err(()=>instrument({...meta,marketType:'inverse'},now),'SETTLEMENT_MISMATCH'));
test('B150 candles preserve source and reject gaps, open candles, repeats and invalid OHLC',()=>{
 const bars=Array.from({length:80},(_,i)=>({time:now-(80-i)*300000,open:100,high:102,low:99,close:101,volume:2}));
 const options={intervalMs:300000,decisionAtMs:now,provider:'coinbase-exchange',expectedProvider:'coinbase-exchange',instrument:'BTC-USD',expectedInstrument:'BTC-USD'};
 assert.equal(closedBars(bars,options).bars.length,80);
 err(()=>closedBars(bars,{...options,expectedProvider:'kraken-futures'}),'WRONG_MARKET_SOURCE');
 err(()=>closedBars([...bars.slice(0,40),...bars.slice(41)],{...options,minBars:79}),'DUPLICATE_OR_GAPPED_BARS');
 err(()=>closedBars([...bars,bars.at(-1)],options),'DUPLICATE_OR_GAPPED_BARS');
 err(()=>closedBars(bars,{...options,decisionAtMs:now-1}),'OPEN_OR_MISALIGNED_BAR');
 err(()=>closedBars(bars.map((b,i)=>i===0?{...b,low:200}:b),options),'INVALID_OHLCV');
});
test('B150 monotonic quote sequence deduplicates only identical payloads',()=>{
 const q=new QuoteSequence(),row={...quote,sequence:5};assert.equal(q.accept(row,{now}).accepted,true);assert.equal(q.accept(row,{now}).duplicate,true);
 err(()=>q.accept({...row,bid:'99.98'},{now}),'CONFLICTING_DUPLICATE_QUOTE');
 err(()=>q.accept({...row,sequence:4},{now}),'REORDERED_QUOTE');
 err(()=>q.accept({...row,sequence:6,sourceAtMs:now-6000},{now}),'STALE_OR_FUTURE_QUOTE');
 err(()=>q.accept({...row,sequence:6,bid:'101'},{now}),'CROSSED_OR_INVALID_BOOK');
});
const guard={paused:false,positionOpen:false,cooldownUntilMs:0,nowMs:now,quoteHealthy:true,feesVerified:true,diagnosticCompleted:true,lossEscalation:false,contextHash:sha};
for(const [k,value] of [['paused',true],['positionOpen',true],['quoteHealthy',false],['feesVerified',false],['diagnosticCompleted',false],['lossEscalation',true],['cooldownUntilMs',now+1]])test('B151 guard prevents new entries for '+k,()=>{const r=refineDecision({side:'buy',action:'manual_preview',mayClose:true},{...guard,[k]:value});assert.equal(r.side,null);assert.equal(r.mayClose,true);assert.equal(r.liveExecution,false);});
test('B151 never changes direction, never unlocks an original refusal and preserves trend exception',()=>{for(const side of [null,'buy','sell']){const r=refineDecision({side,action:side?'preserve_trend_aligned_intent':'reverse_not_calibrated'},guard);assert.equal(r.side,side);}assert.equal(tighteningStop('buy',99,98),99);assert.equal(tighteningStop('sell',101,102),101);});
test('B152 linear quantity, cost and slippage are computed in exact settlement units',()=>{const r=orderRisk(order,meta,{now,...costs});assert.equal(r.risk,'1.12');assert.equal(r.settlement,'USD');assert.equal(r.notionalUnits,units('100').toString());});
test('B152 inverse risk uses reciprocal-price settlement, not a linear USD formula',()=>{const r=orderRisk({...order,quantity:'100',entry:'10000',stop:'9000',target:'12000'},{...meta,provider:'kraken-futures',marketType:'inverse',settlement:'BTC',quantityUnit:'contracts',qtyStep:'1',minQty:'1',maxQty:'10000',tickSize:'1'},{now,roundTripFeeBps:0,slippageBps:0});assert.equal(r.riskUnits,'111112');assert.equal(r.notionalUnits,'1000000');});
for(const [patch,code] of [[{quantity:'0.015'},'QUANTITY_OFF_STEP_OR_BOUNDS'],[{entry:'100.001'},'PRICE_OFF_TICK'],[{stop:'101'},'INVALID_PROTECTIVE_PRICES']])test('B152 invalid contract order '+code,()=>err(()=>orderRisk({...order,...patch},meta,{now,...costs}),code));
test('B152 spot entry cannot fabricate a short sell',()=>err(()=>orderRisk({...order,side:'sell',stop:'101',target:'97'},{...meta,marketType:'spot'},{now,...costs}),'SPOT_SHORT_UNSUPPORTED'));
test('B152 no risk rounding-down over 1000 fractional quantities',()=>{for(let i=1;i<=1000;i++){const q=(i/100).toFixed(2),r=orderRisk({...order,quantity:q},meta,{now,...costs});assert.ok(BigInt(r.riskUnits)*100n>=BigInt(i)*units('1.12'));}});
test('B152 duplicate order cannot reserve twice and changed payload is rejected',()=>fixture(db=>{const a=db.reserve(session,connection,input),b=db.reserve(session,connection,input);assert.equal(a.duplicate,false);assert.equal(b.duplicate,true);assert.equal(db.snapshot(session,connection).length,1);err(()=>db.reserve(session,connection,{...input,order:{...order,quantity:'2'}}),'IDEMPOTENCY_CONFLICT');}));
test('B152 all three modes share the same aggregate risk budget',()=>fixture(db=>{db.reserve(session,connection,input);db.reserve(session,connection,{...input,order:{...order,clientOrderId:'second',mode:'reverse'}});err(()=>db.reserve(session,connection,{...input,order:{...order,clientOrderId:'third',mode:'hybrid'}}),'AGGREGATE_RISK_LIMIT');}));
test('B152 separate connections for one owner cannot multiply the global risk budget',()=>fixture(db=>{const c={...connection,id:'connection-b',accountId:'67890'};db.configure(session,c,limits);db.reserve(session,connection,input);db.reserve(session,c,{...input,order:{...order,clientOrderId:'second'}});err(()=>db.reserve(session,c,{...input,order:{...order,clientOrderId:'third'}}),'AGGREGATE_RISK_LIMIT');}));
test('B152 unknown execution blocks retries/new entries across restart and keeps reservation',()=>{
 const dir=mkdtempSync(join(tmpdir(),'jenios-restart-')),path=join(dir,'paper.db');let db=new PaperLedger(path);
 try{db.configure(session,connection,limits);db.reserve(session,connection,input);db.event(session,connection,order.clientOrderId,{id:'event-1',kind:'SUBMITTING',atMs:now,cumulativeQuantity:'0'});db.event(session,connection,order.clientOrderId,{id:'event-2',kind:'UNKNOWN',atMs:now+1,cumulativeQuantity:'0'});db.close();db=new PaperLedger(path);assert.equal(db.snapshot(session,connection)[0].state,'UNKNOWN');err(()=>db.reserve(session,connection,{...input,order:{...order,clientOrderId:'second'}}),'RECONCILIATION_REQUIRED');db.event(session,connection,order.clientOrderId,{id:'event-3',kind:'RECONCILED',reconciledState:'REJECTED',atMs:now+2,cumulativeQuantity:'0'});assert.equal(db.snapshot(session,connection)[0].held,'0');}
 finally{db.close();rmSync(dir,{recursive:true,force:true});}
});
test('B152 partial cancellation retains risk; only explicit position closure releases it',()=>fixture(db=>{
 db.reserve(session,connection,input);let at=now;for(const [kind,q] of [['SUBMITTING','0'],['ACK','0'],['PARTIAL','0.4'],['CANCELLED','0.4']])db.event(session,connection,order.clientOrderId,{id:'event-'+at,kind,atMs:at++,cumulativeQuantity:q});
 assert.equal(db.snapshot(session,connection)[0].held,units('1.12').toString());
 db.event(session,connection,order.clientOrderId,{id:'closed',kind:'CLOSED',atMs:at,cumulativeQuantity:'0.4',realizedLoss:'0.6'});assert.equal(db.snapshot(session,connection)[0].held,'0');
}));
test('B152 forged cross-account events and duplicate conflicting receipts are rejected',()=>fixture(db=>{
 db.reserve(session,connection,input);const e={id:'receipt',kind:'SUBMITTING',atMs:now,cumulativeQuantity:'0'};db.event(session,connection,order.clientOrderId,e);assert.equal(db.event(session,connection,order.clientOrderId,e).duplicate,true);
 err(()=>db.event(session,connection,order.clientOrderId,{...e,kind:'ACK'}),'EVENT_REPLAY_CONFLICT');
 err(()=>db.snapshot({...session,userId:'other'},connection),'ACCOUNT_OWNER_MISMATCH');
 err(()=>db.event(session,connection,order.clientOrderId,{...e,id:'filled',kind:'FILLED',cumulativeQuantity:'0.2'}),'FILL_NOT_COMPLETE');
}));
test('B152 pausing does not close positions or falsely cancel protective orders',()=>fixture(db=>{const r=db.pause(session,connection);assert.equal(r.positionsClosed,false);assert.equal(r.ordersCancelled,false);err(()=>db.reserve(session,connection,input),'ACCOUNT_PAUSED');}));
test('B152 secret fields, stale prices and diagnostic bypass are rejected',()=>fixture(db=>{
 err(()=>db.reserve({...session,diagnosticCompleted:false},connection,input),'DIAGNOSTIC_REQUIRED');
 err(()=>db.reserve(session,connection,{...input,costs:{...costs,now:now-86400000}}),'UNKNOWN_FIELD');
 err(()=>db.reserve(session,connection,{...input,quote:{...quote,sourceAtMs:now-6000}}),'STALE_OR_FUTURE_QUOTE');
}));
test('B152 persistence is owner-readable only and rejects symlink paths',()=>fixture((db,path)=>{assert.equal(statSync(path).mode&0o777,0o600);const link=path+'.link';symlinkSync(path,link);assert.throws(()=>new PaperLedger(link));}));
test('B152 multi-process reservations cannot exceed the configured aggregate budget',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'jenios-concurrent-')),path=join(dir,'paper.db'),db=new PaperLedger(path);db.configure(session,connection,limits);
 const fixture={session,connection,input};
 const worker=new URL('../scripts/platform/pilot-prep/concurrency-worker.mjs',import.meta.url);
 try{const results=await Promise.all(Array.from({length:6},(_,n)=>new Promise((resolve,reject)=>{const child=spawn(process.execPath,[worker.pathname,path,JSON.stringify({...fixture,input:{...input,order:{...order,clientOrderId:'parallel-'+n}}})],{stdio:['ignore','pipe','pipe']});let out='';child.stdout.on('data',x=>out+=x);child.once('error',reject);child.once('exit',code=>code===0?resolve(JSON.parse(out)):reject(Error('Worker failed')));})));assert.equal(results.filter(r=>r.reserved).length,2);assert.equal(db.snapshot(session,connection).length,2);}finally{db.close();rmSync(dir,{recursive:true,force:true});}
});
test('B153 cTrader maps units to centiunits and does not open a network connection',()=>{const d=limitDraft(session,connection,{order,meta,now,costs});assert.equal(d.request.payload.volume,100);assert.equal(d.request.payload.orderType,2);assert.equal(d.request.payloadType,2106);assert.equal(d.request.payload.stopLoss,99);assert.equal(d.networkSent,false);});
test('B153 Kraken preserves contract quantity and explicitly refuses to claim protective orders sent',()=>{const c={...connection,provider:'kraken-futures'},m={...meta,provider:'kraken-futures',quantityUnit:'contracts',id:'PI_XBTUSD'};const d=limitDraft(session,c,{order,meta:m,now,costs});assert.equal(d.request.query.size,'1');assert.equal(d.request.query.cliOrdId,order.clientOrderId);assert.equal(d.protectionStatus,'separate_protective_orders_not_sent; live_readiness_blocked');assert.equal(d.networkSent,false);});
test('B153 readonly connection cannot even format a trading draft',()=>err(()=>limitDraft(session,{...connection,permissions:['read']},{order,meta,now,costs}),'TRADE_PERMISSION_REQUIRED'));
test('B153 cTrader cannot silently truncate a 64-bit account identifier',()=>err(()=>limitDraft(session,{...connection,accountId:'9007199254740993'},{order,meta,now,costs}),'UNSUPPORTED_INTEGER_PRECISION'));
test('B153 disconnect, pause, cancellation and closure are distinct action plans',()=>{assert.equal(actionPlan(session,connection,'pause_entries').closesPositions,false);assert.equal(actionPlan(session,connection,'cancel_pending').closesPositions,false);assert.equal(actionPlan(session,connection,'close_positions').closesPositions,true);assert.equal(actionPlan(session,connection,'disconnect').networkSent,false);assert.ok(PROVIDERS.every(x=>x.liveExecution===false));});
test('B154 missing proof never becomes pilot approval',()=>{const r=pilotReadiness([],{now});assert.equal(r.assessment,'NO_GO');assert.equal(r.missing.length,12);assert.equal(r.liveExecution,false);});
test('B154 even a fully populated claimed evidence set cannot authorize live execution',()=>{
 const evidence=REQUIRED.map(requirement=>({requirement,commit:BASE_COMMIT,artifactSha256:sha,issuedAtMs:now-100,expiresAtMs:now+100,result:'passed',scope:'independently_reviewed'}));
 assert.equal(pilotReadiness(evidence,{now}).assessment,'REQUIRES_MANUAL_INDEPENDENT_REVIEW');assert.equal(pilotReadiness(evidence,{now}).liveExecution,false);
 assert.equal(pilotReadiness(evidence,{now:now+200}).assessment,'NO_GO');assert.equal(pilotReadiness([...evidence,evidence[0]],{now}).assessment,'NO_GO');
});
