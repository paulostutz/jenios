import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PRACTICAL_STUDY_WORKSHOPS,workshopsForTrack} from '../lib/learning/trade-study-workshops-b271.mjs';
import {USER_VIDEO_RESOURCES} from '../lib/learning/trade-video-resources.mjs';
import {SUPPLEMENTAL_TRADE_VIDEO_RESOURCES} from '../lib/learning/trade-video-supplement-20261021.mjs';
import {freezeOfflineStudy,evaluateOfflineHoldout,OFFLINE_HYPOTHESES} from '../lib/platform/research/b272-walkforward-lab.mjs';
const H=3600000,ORIGIN=Date.parse('2026-09-01T00:00:00Z');
const series=()=>{
 let last=100;
 return Array.from({length:500},(_,i)=>{
  const open=last,close=open*(1+.00055+.0015*Math.sin(i/7));
  last=close;
  return {t:ORIGIN+i*H,open,high:Math.max(open,close)*1.003,low:Math.min(open,close)*.997,close,volume:500+i};
 });
};
const spec=()=>({hypothesisId:'EMA_CONTEXT_V1',asset:'BTCUSDT',intervalMs:H,
 trainEndsAtMs:ORIGIN+210*H,frozenAtMs:ORIGIN+211*H,
 holdoutStartsAtMs:ORIGIN+240*H,holdoutEndsAtMs:ORIGIN+410*H,
 prospectiveStartsAtMs:ORIGIN+435*H,stopPct:.01,costBps:[30,0,10]});
test('B271 10 optional and original workshops in the five existing routes',()=>{
 const ids=new Set(PRACTICAL_STUDY_WORKSHOPS.map(x=>x.id));
 assert.equal(PRACTICAL_STUDY_WORKSHOPS.length,10);
 assert.equal(ids.size,10);
 for(const track of ['fundamentos','graficos','execucao','estrategias','laboratorio']){
  assert.equal(workshopsForTrack(track).length,2);
 }
 const source=new Map(USER_VIDEO_RESOURCES.map(x=>[x.id,x]));
 for(const w of PRACTICAL_STUDY_WORKSHOPS){
  assert.ok(w.explanation.length>80&&w.example.length>70);
  assert.ok(w.practice.length>35&&w.selfCheck.length>30&&w.caution.length>25);
  assert.equal(w.steps.length,3);
  assert.ok(w.relatedVideoIds.every(id=>source.get(id)?.verification==='transcript_reviewed'));
 }
 const ui=readFileSync(new URL('../app/components/learning/LearningRoom.js',import.meta.url),'utf8');
 assert.match(ui,/PRACTICAL_STUDY_WORKSHOPS/);
 assert.match(ui,/Oficinas práticas opcionais/);
 assert.match(ui,/Não vale nota e não desbloqueia operações/);
 assert.doesNotMatch(ui,/start_quiz|submit_quiz|QUESTION_BANK|localStorage/);
});
test('B271 never promotes any of 36 new sources without source verification',()=>{
 assert.equal(USER_VIDEO_RESOURCES.length,56);
 assert.equal(SUPPLEMENTAL_TRADE_VIDEO_RESOURCES.length,36);
 assert.ok(SUPPLEMENTAL_TRADE_VIDEO_RESOURCES.every(v=>
  v.verification==='needs_video_review'&&v.channel===null));
 assert.equal(OFFLINE_HYPOTHESES.length,2);
 assert.ok(OFFLINE_HYPOTHESES.every(x=>x.sourceVideoClaim===false));
});
test('B272 freeze requires causal chronological separation, risk limits and cost stress',()=>{
 const p=freezeOfflineStudy(spec());
 assert.equal(p.protocolHash.length,64);
 assert.deepEqual(p.costBps,[0,10,30]);
 assert.equal(p.brokerOrdersPermitted,false);
 const patches=[
  {frozenAtMs:ORIGIN+242*H},{holdoutStartsAtMs:ORIGIN+220*H},
  {holdoutEndsAtMs:ORIGIN+240*H},{prospectiveStartsAtMs:ORIGIN+405*H},
  {stopPct:null},{stopPct:.07},{costBps:[0,10]},
  {hypothesisId:'VIDEO_UNKNOWN'},{asset:'RANDOM'},{intervalMs:75000}
 ];
 for(const change of patches)assert.throws(()=>freezeOfflineStudy({...spec(),...change}));
});
test('B272 walks on strictly closed holdout candles for three modes x three costs, never sends orders',()=>{
 const p=freezeOfflineStudy(spec());
 const out=evaluateOfflineHoldout({candles:series(),protocol:p,asOfMs:ORIGIN+500*H});
 assert.equal(out.holdoutCandles,170);
 assert.equal(out.scenarios.length,9);
 assert.equal(out.brokerOrdersSent,0);
 assert.equal(out.proprietaryTradingCoreModified,false);
 assert.equal(out.dataProvenance,'CALLER_SUPPLIED_OHLCV_UNVERIFIED');
 assert.equal(out.statisticalAdvantageCertified,false);
 assert.equal(out.publicationApproved,false);
 assert.ok(out.firstDecisionAtMs>=p.holdoutStartsAtMs);
 for(const mode of ['direct','reverse','hybrid']){
  const row=out.scenarios.filter(x=>x.mode===mode).sort((a,b)=>a.roundTripCostBps-b.roundTripCostBps);
  assert.deepEqual(row.map(x=>x.roundTripCostBps),[0,10,30]);
  assert.equal(row[0].trades,row[2].trades);
  if(row[0].trades)assert.ok(row[0].averageNetR>=row[1].averageNetR&&row[1].averageNetR>=row[2].averageNetR);
 }
});
test('B272 second hypothesis keeps no-orders and guards unknown methods',()=>{
 const p=freezeOfflineStudy({...spec(),hypothesisId:'CLOSED_BREAKOUT_V1'});
 const out=evaluateOfflineHoldout({candles:series(),protocol:p,asOfMs:ORIGIN+500*H});
 assert.equal(out.scenarios.length,9);
 assert.equal(out.brokerOrdersSent,0);
 assert.equal(out.independentSourceCertified,false);
});
test('B272 rejects future, missing candles, OHLC corruption and a mutated study hash',()=>{
 const p=freezeOfflineStudy(spec()),bars=series();
 assert.throws(()=>evaluateOfflineHoldout({candles:bars,protocol:{...p,stopPct:.03},asOfMs:ORIGIN+500*H}),/B272_PROTOCOL_NOT_FROZEN_OR_TAMPERED/);
 assert.throws(()=>evaluateOfflineHoldout({candles:bars,protocol:p,asOfMs:ORIGIN+499*H}),/B272_FUTURE_OR_OPEN_CANDLE/);
 const gap=bars.map(x=>({...x}));gap[200].t+=H;
 assert.throws(()=>evaluateOfflineHoldout({candles:gap,protocol:p,asOfMs:ORIGIN+500*H}),/B272_GAPPED_OR_INVALID_CANDLES/);
 const invalid=bars.map(x=>({...x}));invalid[5].high=1;
 assert.throws(()=>evaluateOfflineHoldout({candles:invalid,protocol:p,asOfMs:ORIGIN+500*H}),/B272_GAPPED_OR_INVALID_CANDLES/);
 assert.throws(()=>evaluateOfflineHoldout({candles:bars.slice(0,400),protocol:p,asOfMs:ORIGIN+500*H}),/B272_INSUFFICIENT_TRAIN_OR_HOLDOUT_COVERAGE/);
});
test('B272 holdout scenarios cannot be altered by unseen future bars',()=>{
 const p=freezeOfflineStudy(spec()),a=series(),b=series();
 for(let i=450;i<b.length;i++){
  b[i].open*=1.25;b[i].high*=1.25;b[i].low*=1.25;b[i].close*=1.25;
 }
 const x=evaluateOfflineHoldout({candles:a,protocol:p,asOfMs:ORIGIN+500*H});
 const y=evaluateOfflineHoldout({candles:b,protocol:p,asOfMs:ORIGIN+500*H});
 assert.deepEqual(x.scenarios,y.scenarios);
 assert.notEqual(x.dataSha256,y.dataSha256);
});
