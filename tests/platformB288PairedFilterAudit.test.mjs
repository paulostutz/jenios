import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {B288_FIXED_PROTOCOL,evaluatePairedFrozenSignals} from '../lib/platform/research/b288-paired-filter-audit.mjs';

const H=3600000, BASE=Date.parse('2026-10-18T06:00:00Z');
const pairs=['BTC-USD','ETH-USD','SOL-USD'];
const modes=['manual','hybrid','reverse'];
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const coreOf=signals=>({schema:'JENIOS_B287_SIGNAL_BATCH_V1',frozenAtMs:BASE-1000,signals});
const reseal=core=>({...core,sha256:sha({schema:core.schema,frozenAtMs:core.frozenAtMs,signals:core.signals})});
function fixtures(n=12){
 const signals=[],observations=[];
 const cases=[
  {move:1.2,high:1.8,low:-0.6,manual:'UP',hybrid:'UP'}, 
  {move:-1.2,high:1.3,low:-1.6,manual:'UP',hybrid:'ABSTAIN'},
  {move:1.1,high:1.7,low:-0.5,manual:'UP',hybrid:'ABSTAIN'},
  {move:-0.9,high:0.7,low:-1.4,manual:'DOWN',hybrid:'DOWN'},
  {move:-0.8,high:0.7,low:-1.2,manual:'UP',hybrid:'ABSTAIN'},
  {move:0.7,high:1.2,low:-0.5,manual:'UP',hybrid:'UP'}
 ];
 const now=BASE+Math.ceil(n/3)*H+GRACE()+1000;
 for(let i=0;i<n;i++){
  const asset=pairs[i%3],targetCloseMs=BASE+(Math.floor(i/3)+1)*H,
   q=cases[i%cases.length],scale=[800,28,1.6][i%3],open=100*scale;
  for(const mode of modes){
   const direction=mode==='manual'?q.manual:mode==='hybrid'?q.hybrid:
    q.manual==='UP'?'DOWN':'UP';
   const id='case'+i+'-'+mode;
   signals.push({id,mode,asset,signalAtMs:BASE-60000,
    targetCloseMs,direction,isOrder:false,executed:false,realizedPnl:null});
   observations.push({id,asset,targetCloseMs,observedAtMs:now,
    open,high:open*(1+q.high/100),low:open*(1+q.low/100),
    close:open*(1+q.move/100),volume:1500,
    signedByIndependentSource:false,orderExecuted:false,quoteCurrency:'USD'});
  }
 }
 return {batch:reseal(coreOf(signals)),observations,observedAtMs:now};
}
const GRACE=()=>300000;
const run=(source)=>evaluatePairedFrozenSignals(source);
test('B288 accepts 3 modes per event, 9 costs each, no trading or actual PnL',()=>{
 const x=run(fixtures(12));
 assert.equal(x.studiedCohorts,12);
 assert.equal(x.scenarioRows,324);
 assert.equal(x.scenarios.length,27);
 assert.equal(x.privateRobotCodeInvoked,false);
 assert.equal(x.proprietarySignalOriginVerified,false);
 assert.equal(x.ordersSent,0);
 assert.equal(x.paperOrdersSent,0);
 assert.equal(x.paymentsSent,0);
 assert.equal(x.commercialPerformanceClaimAllowed,false);
 assert.equal(x.lossNeutralizationVerified,false);
 assert.equal(x.actualWins,0);assert.equal(x.actualLosses,0);
 assert.equal(x.noAutomatedParameterSelection,true);
 assert.match(x.protocolSha256,/^[0-9a-f]{64}$/);
});
test('B288 stress grid remains fixed to 0/10/30 costs and 0/10/30 stop slip',()=>{
 assert.deepEqual(B288_FIXED_PROTOCOL.roundTripCostBps,[0,10,30]);
 assert.deepEqual(B288_FIXED_PROTOCOL.adverseStopSlipBps,[0,10,30]);
 assert.equal(B288_FIXED_PROTOCOL.riskStopPct,0.01);
 const x=run(fixtures(12));
 for(const mode of modes)
  assert.equal(x.scenarios.filter(y=>y.mode===mode).length,9);
 for(const scenario of x.scenarios)
  assert.equal(scenario.trades+scenario.abstained,12);
});
test('B288 counts filtered gains missed as well as hypothetical losses not taken',()=>{
 const x=run(fixtures(12)).counterfactual30_30;
 assert.ok(x.filteredSignals>0);
 assert.ok(x.hypotheticalLossesAvoided>0);
 assert.ok(x.hypotheticalGainsMissed>0);
 assert.equal(x.filteredSignals,x.hypotheticalLossesAvoided+
 x.hypotheticalGainsMissed+x.neutralFiltered);
 assert.ok(x.hypotheticalLossRNotTaken>0);
 assert.ok(x.hypotheticalGainRForegone>0);
});
test('B288 fees never improve the return for the same mode and slippage',()=>{
 const rows=run(fixtures(30)).scenarios;
 for(const mode of modes)for(const slip of [0,10,30]){
  const matching=rows.filter(x=>x.mode===mode&&x.slipBps===slip)
    .sort((a,b)=>a.costBps-b.costBps);
  assert.equal(matching.length,3);
  assert.ok(matching[0].totalNetR>=matching[1].totalNetR);
  assert.ok(matching[1].totalNetR>=matching[2].totalNetR);
 }
});
test('B288 stop slippage cannot improve returns at fixed cost',()=>{
 const rows=run(fixtures(30)).scenarios;
 for(const mode of modes)for(const cost of [0,10,30]){
  const matching=rows.filter(x=>x.mode===mode&&x.costBps===cost)
    .sort((a,b)=>a.slipBps-b.slipBps);
  assert.equal(matching.length,3);
  assert.ok(matching[0].totalNetR>=matching[1].totalNetR);
  assert.ok(matching[1].totalNetR>=matching[2].totalNetR);
 }
});
test('B288 deterministic 60 paired synthetic groups produce 1620 scenario rows',()=>{
 const a=run(fixtures(60)),b=run(fixtures(60));
 assert.deepEqual(a,b);assert.equal(a.scenarioRows,1620);
 assert.equal(a.studiedCohorts,60);assert.equal(a.sourceCandleHashes.length,60);
 assert.equal(a.scenarios.length,27);
});
test('B288 rejects tampering with previously sealed direction',()=>{
 const x=fixtures(6);
 const tampered={...x.batch,signals:[{...x.batch.signals[0],direction:'DOWN'},...x.batch.signals.slice(1)]};
 assert.throws(()=>run({...x,batch:tampered}),/B287_SIGNAL_BATCH_TAMPERED/);
});
test('B288 rejects missing paired mode even with fresh local hash',()=>{
 const x=fixtures(6),signals=x.batch.signals.filter(s=>s.id!=='case0-hybrid');
 assert.throws(()=>run({...x,batch:reseal(coreOf(signals)),
  observations:x.observations.filter(o=>o.id!=='case0-hybrid')}),/B288_PAIRED_COHORT_INCOMPLETE/);
});
test('B288 rejects duplicate mode within same asset/hour cohort',()=>{
 const x=fixtures(6),signals=x.batch.signals.map(s=>s.id==='case0-hybrid'?
  {...s,mode:'manual'}:s);
 assert.throws(()=>run({...x,batch:reseal(coreOf(signals))}),/B288_DUPLICATE_MODE_IN_COHORT/);
});
test('B288 rejects contradictory hybrid direction instead of inventing a filter win',()=>{
 const x=fixtures(6),signals=x.batch.signals.map(s=>s.id==='case0-hybrid'?
  {...s,direction:'DOWN'}:s);
 assert.throws(()=>run({...x,batch:reseal(coreOf(signals))}),/B288_NONCOMPARABLE_MODE_DECISIONS/);
});
test('B288 rejects outcomes with mismatched candle values across three modes',()=>{
 const x=fixtures(6),out=x.observations.map(o=>o.id==='case0-hybrid'?
  {...o,close:o.close*1.0001}:o);
 assert.throws(()=>run({...x,observations:out}),/B288_NONMATCHING_MARKET_OBSERVATIONS/);
});
test('B288 rejects early outcome despite apparent price and favorable PnL',()=>{
 const x=fixtures(6),out=x.observations.map(o=>o.id==='case0-manual'?
  {...o,observedAtMs:o.targetCloseMs+1000}:o);
 assert.throws(()=>run({...x,observations:out}),/B288_INVALID_OR_EARLY_PUBLIC_OHLCV/);
});
test('B288 rejects future-leaking signals after the candle opens',()=>{
 const x=fixtures(3),signals=x.batch.signals.map(s=>({...s,signalAtMs:BASE+3000})),
  core={...coreOf(signals),frozenAtMs:BASE+4000};
 assert.throws(()=>run({...x,batch:reseal(core)}),/B288_LOOKAHEAD_OR_UNCLOSED_SIGNAL/);
});
test('B288 rejects duplicate, missing and extra outcome IDs',()=>{
 const x=fixtures(6);
 assert.throws(()=>run({...x,observations:[x.observations[0],x.observations[0],
    ...x.observations.slice(2)]}),/B288_DUPLICATE_OR_MISSING_OUTCOME/);
 assert.throws(()=>run({...x,observations:x.observations.slice(1)}),
 /B288_INCOMPLETE_OR_INVALID_OUTCOMES/);
});
test('B288 refuses forged USD/USDT, market distortion and signed false claim',()=>{
 const x=fixtures(6);
 for(const patch of [{quoteCurrency:'USDT'},{high:0},{volume:0},
  {signedByIndependentSource:true},{orderExecuted:true}]){
  const out=x.observations.map((o,i)=>i===0?{...o,...patch}:o);
  assert.throws(()=>run({...x,observations:out}),/B288_INVALID_OR_EARLY_PUBLIC_OHLCV/);
 }
});
test('B288 tiny sample and zero orders never become statistical certification',()=>{
 const x=run(fixtures(3));
 assert.equal(x.studiedCohorts,3);
 assert.equal(x.prospectiveStatisticalAdvantageCertified,false);
 assert.equal(x.liveExecutionEnabled,false);
 assert.equal(x.shortBorrowFundingModeled,false);
 assert.equal(x.executionFillVerified,false);
 assert.equal(x.counterfactual30_30.filteredSignals>=0,true);
});
