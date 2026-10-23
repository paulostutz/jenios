import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {
 sealR5ProspectiveBatch,reviewR5DualSourceEvidence,
 ROBOT_R5_FROZEN_PROTOCOL
} from '../lib/platform/research/robot-r5-dual-source-prospective.mjs';
const H=3600000, D=86400000, BASE=Date.parse('2026-10-24T00:00:00Z');
const assets=['BTC-USD','ETH-USD','SOL-USD'];
const pairName={
 'BTC-USD':{coinbase_exchange:'BTC-USD',kraken_spot:'XBTUSD'},
 'ETH-USD':{coinbase_exchange:'ETH-USD',kraken_spot:'ETHUSD'},
 'SOL-USD':{coinbase_exchange:'SOL-USD',kraken_spot:'SOLUSD'}
};
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const r5=(f)=>reviewR5DualSourceEvidence({seal:f.seal,sourcePairs:f.sourcePairs,reviewedAtMs:f.reviewedAtMs});
function fixture({days=2,hoursPerDay=3,names=assets,identical=false}={}){
 const signals=[],sourcePairs=[];let seq=0;
 for(let day=0;day<days;day++)for(let hour=0;hour<hoursPerDay;hour++){
  const targetOpenMs=BASE+day*D+hour*H;
  const targetCloseMs=targetOpenMs+H;
  for(const asset of names){
   const m=seq%3===0?'DOWN':'UP',hybrid=seq%4===0?'ABSTAIN':m;
   for(const mode of ['manual','hybrid','reverse']){
    signals.push({id:'s-'+seq+'-'+mode,asset,mode,
     direction:mode==='manual'?m:mode==='hybrid'?hybrid:m==='UP'?'DOWN':'UP',
     targetCloseMs,signalAtMs:BASE-21*60000,isOrder:false,
     executed:false,realizedPnl:null});
   }
   const open=100+seq*.05,close=open*(seq%2===0?1.003:0.995),
    high=Math.max(open,close)*1.004,low=Math.min(open,close)*.996;
   const source=(provider,ratio,extra)=>({provider,providerPair:pairName[asset][provider],
    asset,targetCloseMs,candleStartMs:targetOpenMs,
    capturedAtMs:targetCloseMs+300000+1000+extra,
    open:open*ratio,high:high*ratio,low:low*ratio,close:close*ratio,
    volume:1000+seq+extra,quoteCurrency:'USD',sourceSigned:false,
    orderExecuted:false,originClaim:'CALLER_SUPPLIED_UNSIGNED_PUBLIC_CANDLE'});
   const cb=source('coinbase_exchange',1,0),kr=source('kraken_spot',identical?1:1.0004,1000);
   if(identical)kr.volume=cb.volume;
   sourcePairs.push({asset,targetCloseMs,readings:[cb,kr]});
   seq++;
  }
 }
 const core={schema:'JENIOS_B287_SIGNAL_BATCH_V1',frozenAtMs:BASE-20*60000,signals};
 const batch={...core,sha256:sha(core)};
 const seal=sealR5ProspectiveBatch(batch,{studyId:'offline-prospective-fixture',registeredAtMs:BASE-19*60000});
 return {seal,sourcePairs,reviewedAtMs:BASE+days*D+hoursPerDay*H+1200000};
}
const throws=(fn,code)=>assert.throws(fn,e=>e?.code===code);

test('R5 reusable B287 preregistration seals three comparable modes in advance',()=>{
 const f=fixture(),seal=f.seal;
 assert.equal(seal.cohortCount,18);
 assert.match(seal.sealDigestSha256,/^[a-f0-9]{64}$/);
 assert.equal(seal.independentlyTimestamped,false);
 assert.equal(seal.originalPrivateSignalProvenanceVerified,false);
 assert.equal(seal.cryptographicDigestIsNotPrecommitProof,true);
 assert.equal(seal.ordersSent,0);
});
test('R5 2 advertised sources may agree numerically without independent provider proof',()=>{
 const r=r5(fixture());
 assert.equal(r.cohortsReviewed,18);
 assert.equal(r.uniqueHourSlots,6);
 assert.equal(r.distinctUtcDays,2);
 assert.equal(r.descriptiveOfflinePairingEligible,true);
 assert.deepEqual(r.issues,[]);
 assert.equal(r.independentProviderDataAuthenticated,false);
 assert.equal(r.providerLabelsCryptographicallyAuthenticated,false);
 assert.equal(r.independentPredictionTimestampVerified,false);
 assert.equal(r.originalPrivateRobotSignalVerified,false);
 assert.equal(r.hypotheticalNetR,null);
 assert.equal(r.actualBrokerRealizedPnl,null);
 assert.equal(r.actualLossesAvoided,null);
 assert.equal(r.ordersSent,0);
 assert.equal(r.releaseStatus,'NO_GO_EXTERNAL_WITNESS_AND_BROKER_RECONCILIATION_REQUIRED');
});
test('R5 wrong mode relation and post-opening signal are rejected even if batch is rehashed',()=>{
 let f=fixture(),batch={...f.seal.signalBatch};
 batch={...batch,frozenAtMs:BASE-2000};
 batch.sha256=sha({schema:batch.schema,frozenAtMs:batch.frozenAtMs,signals:batch.signals});
 throws(()=>sealR5ProspectiveBatch(batch,{studyId:'new',registeredAtMs:BASE-1000}),
  'ROBOT_R5_FORECAST_NOT_REGISTERED_BEFORE_ENTRY');
 f=fixture();batch={...f.seal.signalBatch};
 const changed=batch.signals.map((s,i)=>i===1?{...s,direction:s.direction==='UP'?'DOWN':'UP'}:s);
 batch={...batch,signals:changed};batch.sha256=sha({schema:batch.schema,frozenAtMs:batch.frozenAtMs,signals:changed});
 throws(()=>sealR5ProspectiveBatch(batch,{studyId:'new',registeredAtMs:f.seal.registeredAtMs}),
  'ROBOT_R5_MODES_NOT_COMPARABLE');
});
test('R5 late registration and missing externally proven clock cannot become retrospective commitment',()=>{
 const f=fixture(),batch=f.seal.signalBatch;
 throws(()=>sealR5ProspectiveBatch(batch,{studyId:'new',registeredAtMs:BASE-5000}),
  'ROBOT_R5_INVALID_REGISTRATION');
 assert.equal(f.seal.externalWitnessOfSeal,false);
});
test('R5 later mutation of a registered signal is detected by the local hash',()=>{
 const f=fixture(),clone=structuredClone(f.seal);
 clone.signalBatch.signals[0].direction='ABSTAIN';
 throws(()=>r5({...f,seal:clone}),'ROBOT_R5_SEAL_TAMPERED_OR_CLOCK_INVALID');
});
test('R5 no missing cohort, extra, duplicated or single-provider inputs',()=>{
 const f=fixture();
 throws(()=>r5({...f,sourcePairs:f.sourcePairs.slice(1)}),'ROBOT_R5_MISSING_OR_EXTRA_SOURCE_PAIR');
 throws(()=>r5({...f,sourcePairs:[...f.sourcePairs,f.sourcePairs[0]]}),'ROBOT_R5_MISSING_OR_EXTRA_SOURCE_PAIR');
 const missing=f.sourcePairs.map((p,i)=>i===0?{...p,readings:[p.readings[0]]}:p);
 throws(()=>r5({...f,sourcePairs:missing}),'ROBOT_R5_INVALID_OR_DUPLICATE_SOURCE_PAIR');
 const duplicate=f.sourcePairs.map((p,i)=>i===0?{...p,readings:[p.readings[0],p.readings[0]]}:p);
 throws(()=>r5({...f,sourcePairs:duplicate}),'ROBOT_R5_TWO_DECLARED_PROVIDERS_REQUIRED');
});
test('R5 unsigned provider labels must use allowed quote and exact announced pair mapping',()=>{
 const f=fixture();
 for(const patch of [
  {quoteCurrency:'USDT'},{providerPair:'ETHUSD'},
  {sourceSigned:true},{orderExecuted:true},{originClaim:'SIGNED_COINBASE'},
  {provider:'fake_provider'}, {asset:'ETH-USD'},
  {capturedAtMs:f.sourcePairs[0].targetCloseMs+60000},
  {capturedAtMs:f.sourcePairs[0].targetCloseMs+H*5},
  {candleStartMs:f.sourcePairs[0].targetCloseMs},
  {open:Infinity}, {low:0}, {high:1}, {volume:-1}
 ]){
  const rows=f.sourcePairs.map((p,i)=>i===0?{...p,readings:
   p.readings.map((r,j)=>j===0?{...r,...patch}:r)}:p);
  assert.throws(()=>r5({...f,sourcePairs:rows}),e=>[
   'ROBOT_R5_INVALID_OR_UNWITNESSED_SOURCE_ROW',
   'ROBOT_R5_TWO_DECLARED_PROVIDERS_REQUIRED'].includes(e?.code));
 }
});
test('R5 two providers disagreeing on close block ALL descriptive pairing',()=>{
 const f=fixture();
 const rows=f.sourcePairs.map((p,i)=>i===0?{...p,readings:p.readings.map(r=>
  r.provider==='kraken_spot'?{...r,close:r.close*1.03,
   high:r.high*1.04}:r)}:p);
 const r=r5({...f,sourcePairs:rows});
 assert.equal(r.sourceAgreementWithinLockedTolerances,false);
 assert.equal(r.descriptiveOfflinePairingEligible,false);
 assert.ok(r.issues.includes('CLAIMED_PROVIDER_CLOSE_DISAGREEMENT'));
 assert.equal(r.hypotheticalNetR,null);
 assert.equal(r.actualLossesAvoided,null);
});
test('R5 changing only high/low outside fixed tolerance blocks pairing',()=>{
 const f=fixture();
 const rows=f.sourcePairs.map((p,i)=>i===0?{...p,readings:p.readings.map(r=>
  r.provider==='kraken_spot'?{...r,high:r.high*1.03}:r)}:p);
 const r=r5({...f,sourcePairs:rows});
 assert.ok(r.issues.includes('CLAIMED_PROVIDER_OHLC_DISAGREEMENT'));
 assert.equal(r.descriptiveOfflinePairingEligible,false);
});
test('R5 even byte-identical candles under two labels are suspicious, not independent proof',()=>{
 const r=r5(fixture({identical:true}));
 assert.ok(r.issues.includes('DUPLICATED_OR_IDENTICAL_UNWITNESSED_PROVIDER_PAYLOAD'));
 assert.equal(r.independentProviderDataAuthenticated,false);
 assert.equal(r.descriptiveOfflinePairingEligible,false);
});
test('R5 source clocks too far apart block pairing without forging timestamp attestation',()=>{
 const f=fixture(),rows=f.sourcePairs.map((p,i)=>i===0?{...p,readings:p.readings.map(r=>
  r.provider==='kraken_spot'?{...r,capturedAtMs:r.capturedAtMs+601000}:r)}:p);
 const r=r5({...f,sourcePairs:rows});
 assert.ok(r.issues.includes('CAPTURE_TIMESTAMPS_TOO_FAR_APART'));
 assert.equal(r.independentPredictionTimestampVerified,false);
});
test('R5 source pair reordering is deterministic and does not change local digests',()=>{
 const f=fixture();
 const a=r5(f);
 const b=r5({...f,sourcePairs:[...f.sourcePairs].reverse().map(p=>({
  ...p,readings:[...p.readings].reverse()
 }))});
 assert.deepEqual(a,b);
});
test('R5 300 synthetic hours across 30 days do not qualify as B280 external evidence',()=>{
 const f=fixture({days:30,hoursPerDay:10,names:['BTC-USD']});
 assert.equal(f.seal.signalBatch.signals.length,900);
 const r=r5(f);
 assert.equal(r.cohortsReviewed,300);
 assert.equal(r.uniqueHourSlots,300);
 assert.equal(r.distinctUtcDays,30);
 assert.equal(r.independentProviderDataAuthenticated,false);
 assert.equal(r.b280RealProspectiveCoverageCertified,false);
 assert.equal(r.statisticalAdvantageCertified,false);
 assert.equal(r.commercialPerformanceClaimAllowed,false);
});
test('R5 has no network, order dispatch, paid AI or accidental parameter fitting',()=>{
 const body=readFileSync(new URL('../lib/platform/research/robot-r5-dual-source-prospective.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(body,/\bfetch\s*\(|\bsubmitOrder\s*\(|\bcreateOrder\s*\(/);
 assert.doesNotMatch(body,/process\.env|OPENAI_API_KEY|\bWebSocket\b/);
 assert.equal(ROBOT_R5_FROZEN_PROTOCOL.modelParameterOptimizationAllowed,false);
 assert.equal(ROBOT_R5_FROZEN_PROTOCOL.externalOrdersAllowed,false);
});

test('R5 injected status fields or metadata claims cannot upgrade a local seal',()=>{
 const f=fixture();
 const falseAttested=structuredClone(f.seal);
 falseAttested.independentlyTimestamped=true;
 throws(()=>r5({...f,seal:falseAttested}),'ROBOT_R5_SEAL_TAMPERED_OR_CLOCK_INVALID');
 const forgedExecuted=structuredClone(f.seal);
 forgedExecuted.signalBatch.signals[0].actualBrokerPnl=12345;
 throws(()=>r5({...f,seal:forgedExecuted}),'ROBOT_R5_SEAL_TAMPERED_OR_CLOCK_INVALID');
 const alteredSource=f.sourcePairs.map((p,i)=>i===0?{...p,readings:p.readings.map((r,j)=>
  j===0?{...r,providerReceiptVerified:true}:r)}:p);
 throws(()=>r5({...f,sourcePairs:alteredSource}),
  'ROBOT_R5_INVALID_OR_UNWITNESSED_SOURCE_ROW');
});

test('R5 252 synthetic close variations cannot accidentally authorize broker performance',()=>{
 const f=fixture({days:1,hoursPerDay:1,names:['BTC-USD']});
 let cases=0,disagreements=0;
 for(const closeRatio of [0.98,0.99,0.995,0.998,1.0004,1.002,1.005,1.01,1.02])
 for(const captureSkew of [0,1000,120000,600000,601000,900000,1200000])
 for(const originOrder of [false,true])
 for(const higherOpen of [false,true]){
  const pair=f.sourcePairs[0];
  const sources=pair.readings.map(r=>{
   if(r.provider!=='kraken_spot')return r;
   const open=r.open*(higherOpen?1.02:1),close=r.close*closeRatio;
   return {...r,open,close,high:Math.max(open,close)*1.04,
    low:Math.min(open,close)*.97,capturedAtMs:r.capturedAtMs+captureSkew};
  });
  const current={...f,sourcePairs:[{...pair,readings:originOrder?sources.reverse():sources}]};
  const report=r5(current);
  assert.equal(report.actualLossesAvoided,null);
  assert.equal(report.actualBrokerRealizedPnl,null);
  assert.equal(report.independentProviderDataAuthenticated,false);
  assert.equal(report.statisticalAdvantageCertified,false);
  assert.equal(report.ordersSent,0);
  assert.equal(report.commercialPerformanceClaimAllowed,false);
  if(report.issues.length)disagreements++;
  cases++;
 }
 assert.equal(cases,252);
 assert.ok(disagreements>200);
});

test('R5 imports exactly the certified B287 witness blob from R4 source',()=>{
 const bytes=readFileSync(new URL('../lib/platform/research/b287-signal-witness.mjs',import.meta.url));
 const original=createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
 assert.equal(original,'14744f7c51376aab582bbe9c697bfef8725d1197');
});

test('R5 and every preceding private research branch remain blocked from Vercel auto deployment',()=>{
 const vercel=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url),'utf8'));
 for(const b of [
  'fix/jenios-robot-r5-dual-source-prospective-integrity-20261021',
  'fix/jenios-robot-r4-execution-feasibility-20261021',
  'fix/jenios-robot-r3-prospective-statistical-audit-20261021',
  'fix/jenios-robot-r1-adversarial-qa-20261021',
  'fix/jenios-b301-private-durable-cohort-20261021'
 ]){
  assert.equal(vercel.git.deploymentEnabled[b],false);
  assert.ok(vercel.ignoreCommand.includes(b));
 }
});
