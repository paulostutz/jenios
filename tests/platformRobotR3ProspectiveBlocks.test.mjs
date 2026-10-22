import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {reviewR3ProspectiveBlocks,ROBOT_R3_FROZEN_AUDIT}
 from '../lib/platform/research/robot-r3-prospective-block-audit.mjs';
import {evaluatePairedFrozenSignals}
 from '../lib/platform/research/b288-paired-filter-audit.mjs';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const H=3600000,D=86400000,GRACE=300000,START=Date.parse('2026-10-21T00:00:00Z');
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
function fixture({days=2,hoursPerDay=3,assets=['BTC-USD'],hybridFilter=true}={}){
 const signals=[],observations=[],frozenAtMs=START-H+1000;
 let idx=0;
 for(let day=0;day<days;day++)for(let hour=0;hour<hoursPerDay;hour++){
  const targetCloseMs=START+day*D+(hour+1)*H;
  for(const asset of assets){
   const up=idx%2===0,open=100,close=up?101:99,
   low=Math.min(open,close)-0.1,high=Math.max(open,close)+0.1;
   for(const mode of ['manual','hybrid','reverse']){
    const direction=mode==='reverse'?'DOWN':
     mode==='hybrid'&&hybridFilter&&idx%3===1?'ABSTAIN':'UP';
    const id='case-'+idx+'-'+mode;
    signals.push({id,mode,asset,signalAtMs:START-H+1000,
     targetCloseMs,direction,isOrder:false,executed:false,realizedPnl:null});
    observations.push({id,asset,targetCloseMs,
     observedAtMs:START+days*D+hoursPerDay*H+GRACE+1000,
     open,high,low,close,volume:1000,
     signedByIndependentSource:false,orderExecuted:false,quoteCurrency:'USD'});
   }
   idx++;
  }
 }
 const core={schema:'JENIOS_B287_SIGNAL_BATCH_V1',frozenAtMs,signals};
 const batch={...core,sha256:sha(core)};
 return {batch,observations,observedAtMs:START+days*D+hoursPerDay*H+GRACE+1000};
}
test('R3 frozen 30/30 stress uses B288 and paired zero-exposure abstentions',()=>{
 const x=fixture(),r=reviewR3ProspectiveBlocks(x),b=evaluatePairedFrozenSignals(x);
 assert.equal(r.researchCohorts,6);
 assert.equal(r.uniqueUtcHourlySlots,6);
 assert.equal(r.uniqueUtcCalendarDays,2);
 assert.equal(r.abstentionsCountedAsZeroExposure,true);
 assert.equal(r.comparisons.length,3);
 for(const mode of ['manual','hybrid','reverse']){
  const expected=b.scenarios.find(s=>s.mode===mode&&s.costBps===30&&s.slipBps===30);
  const actual=r.costSensitivity[mode];
  assert.equal(actual.hypotheticalActiveSignals,expected.trades);
  assert.ok(Math.abs(actual.totalHypotheticalTradeNetR-expected.totalNetR)<1e-4);
  assert.equal(actual.actualTradesObserved,0);
 }
 assert.ok(r.costSensitivity.hybrid.hypotheticalAbstentions>0);
 assert.equal(r.realizedBrokerPnl,null);
 assert.equal(r.actualLossesAvoided,null);
 assert.equal(r.ordersSent,0);
});
test('R3 deterministic bootstrap is insensitive to ordering of received observations',()=>{
 const x=fixture({days:6,hoursPerDay:5});
 const a=reviewR3ProspectiveBlocks(x);
 const b=reviewR3ProspectiveBlocks({...x,observations:[...x.observations].reverse()});
 assert.deepEqual(a,b);
 for(const item of a.comparisons){
  assert.equal(item.adjustedIntervalCoveragePct,98.333333);
  assert.equal(item.pValue,null);
  assert.equal(item.externalPerformanceVerified,false);
 }
 assert.equal(a.multiplicityComparisonCount,3);
});
test('R3 simultaneous assets do not inflate number of independent hourly slots',()=>{
 const r=reviewR3ProspectiveBlocks(fixture({days:2,hoursPerDay:3,assets:['BTC-USD','ETH-USD','SOL-USD']}));
 assert.equal(r.researchCohorts,18);
 assert.equal(r.uniqueUtcHourlySlots,6);
 assert.equal(r.uniqueUtcCalendarDays,2);
 assert.equal(r.distinctAssets,3);
 assert.equal(r.sameHourAcrossAssetsCountedOnce,true);
});
test('R3 30 days and 300 hours of SYNTHETIC evidence meet descriptive calendar, NEVER operational gate',()=>{
 const x=fixture({days:30,hoursPerDay:10});
 const r=reviewR3ProspectiveBlocks(x);
 assert.equal(x.batch.signals.length,900);
 assert.equal(r.researchCohorts,300);
 assert.equal(r.uniqueUtcHourlySlots,300);
 assert.equal(r.uniqueUtcCalendarDays,30);
 assert.equal(r.descriptiveCoverage.minimumUtcDaysMet,true);
 assert.equal(r.descriptiveCoverage.minimumUniqueHoursMet,true);
 assert.equal(r.descriptiveCoverage.descriptiveCalendarAndHourCoverageReached,true);
 assert.equal(r.descriptiveCoverage.b280PerAssetHypothesisModeCoverageCertified,false);
 assert.equal(r.descriptiveCoverage.independentlyWitnessedProspectiveCoverage,false);
 assert.equal(r.statisticalAdvantageCertified,false);
 assert.equal(r.shortBorrowAndFundingModeled,false);
 assert.equal(r.status,'NO_GO_PROSPECTIVE_EXTERNAL_EVIDENCE_REQUIRED');
});
test('R3 300 cohorts concentrated in fewer days cannot satisfy calendar gate',()=>{
 const x=fixture({days:15,hoursPerDay:20});
 const r=reviewR3ProspectiveBlocks(x);
 assert.equal(r.uniqueUtcHourlySlots,300);
 assert.equal(r.uniqueUtcCalendarDays,15);
 assert.equal(r.descriptiveCoverage.minimumUtcDaysMet,false);
});
test('R3 catches tampered seal, mismatched OHLC, lookahead and early observations',()=>{
 const x=fixture();
 const tampered={...x.batch,signals:x.batch.signals.map((s,i)=>
  i===0?{...s,direction:'DOWN'}:s)};
 assert.throws(()=>reviewR3ProspectiveBlocks({...x,batch:tampered}),
 /B287_SIGNAL_BATCH_TAMPERED/);
 const leak=x.batch.signals.map((s,i)=>i===0?{...s,signalAtMs:s.targetCloseMs-1000}:s);
 const core={schema:x.batch.schema,signals:leak,frozenAtMs:x.batch.signals[0].targetCloseMs-1000};
 assert.throws(()=>reviewR3ProspectiveBlocks({...x,batch:{...core,sha256:sha(core)}}),
 /B288_LOOKAHEAD_OR_UNCLOSED_SIGNAL/);
 const prices=x.observations.map((o,i)=>i===1?{...o,close:o.close+0.2}:o);
 assert.throws(()=>reviewR3ProspectiveBlocks({...x,observations:prices}),
 /B288_NONMATCHING_MARKET_OBSERVATIONS/);
 const early=x.observations.map((o,i)=>i===0?{...o,observedAtMs:o.targetCloseMs+1000}:o);
 assert.throws(()=>reviewR3ProspectiveBlocks({...x,observations:early}),
 /B288_INVALID_OR_EARLY_PUBLIC_OHLCV/);
});
test('R3 rejects signed provider claims and falsely executed orders in unsigned research inputs',()=>{
 const x=fixture();
 for(const patch of [{signedByIndependentSource:true},{orderExecuted:true},{quoteCurrency:'USDT'}]){
  const observations=x.observations.map((o,i)=>i===0?{...o,...patch}:o);
  assert.throws(()=>reviewR3ProspectiveBlocks({...x,observations}),
   /B288_INVALID_OR_EARLY_PUBLIC_OHLCV/);
 }
});
test('R3 short evidence remains unverified even if resampled mean is positive',()=>{
 const x=fixture({days:2,hoursPerDay:2,hybridFilter:false});
 const r=reviewR3ProspectiveBlocks(x);
 assert.equal(r.descriptiveCoverage.descriptiveCalendarAndHourCoverageReached,false);
 assert.equal(r.commercialPerformanceClaimAllowed,false);
 assert.equal(r.independentDailyReturnsProven,false);
 assert.equal(r.originalPrivateCoreSignalsVerified,false);
 assert.equal(r.independentPriceProviderVerified,false);
 assert.equal(r.serialCorrelationBeyondDayAdjusted,false);
 assert.equal(r.ordersSent,0);assert.equal(r.paperOrdersSent,0);
});
test('R3 refuses an implicit observation clock and never touches Next routes',()=>{
 const x=fixture();
 assert.throws(()=>reviewR3ProspectiveBlocks({...x,observedAtMs:undefined}),
 /ROBOT_R3_EXPLICIT_OBSERVATION_CLOCK_REQUIRED/);
 const code=read('lib/platform/research/robot-r3-prospective-block-audit.mjs');
 assert.doesNotMatch(code,/\bfetch\s*\(|\bsubmitOrder\s*\(|\bcreateOrder\s*\(/);
 assert.doesNotMatch(code,/OPENAI_API_KEY|process\.env|from ['"].*app\/api/);
 const v=JSON.parse(read('vercel.json'));
 assert.equal(v.git.deploymentEnabled['fix/jenios-robot-r3-prospective-statistical-audit-20261021'],false);
});
