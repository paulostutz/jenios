import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {reviewR4ExecutionFeasibility,reviewR4PairedThreeModeFeasibility,
 ROBOT_R4_LOCKED_ASSUMPTIONS} from '../lib/platform/research/robot-r4-execution-feasibility.mjs';

const H=3600000,T=Date.parse('2026-10-21T10:00:00Z');
function fixtures(){
 return {
  signal:{id:'synthetic-1',mode:'manual',direction:'UP',
   emittedAtMs:T-2000,referencePrice:100,targetOpenMs:T,
   source:'SYNTHETIC_FROZEN_REFERENCE_ONLY',isOrder:false},
  market:{asset:'BTC-USD',marketType:'spot',metadataAgeMs:1000,
   metadataMaxAgeMs:10000,borrowAvailableDeclared:false,
   megaTrendDirection:null,paused:false,positionOpen:false,
   localConsentDeclared:true,liquidityState:'declared_adequate'},
  observation:{targetOpenMs:T,targetCloseMs:T+H,observedAtMs:T+H+300001,
   open:100,high:101.1,low:99.4,close:100.5,volume:1000,
   quoteCurrency:'USD',sourceSigned:false,orderExecuted:false},
  friction:{feeBps:30,spreadBps:10,entrySlippageBps:10,
   exitSlippageBps:10,stopSlippageBps:30,fundingBps:0,
   declaredDepthMultiple:3,declaredFillFraction:1},
  observedAtMs:T+H+300010
 };
}
const patch=(f,{signal={},market={},observation={},friction={},
 observedAtMs=f.observedAtMs}={})=>({
 signal:{...f.signal,...signal},market:{...f.market,...market},
 observation:{...f.observation,...observation},
 friction:{...f.friction,...friction},observedAtMs
});
const checkBlocked=(result,expected)=>{
 assert.equal(result.classification,'NO_EXECUTABLE_REFERENCE');
 assert.equal(result.netRHypothetical,null);
 assert.equal(result.comparableToConfirmedBrokerFills,false);
 assert.ok(result.reasonCodes.includes(expected),JSON.stringify(result.reasonCodes));
 assert.equal(result.ordersSent,0);
};
test('R4 fixed 1% stop and explicit UNKNOWN execution prevent claims',()=>{
 const r=reviewR4ExecutionFeasibility(fixtures());
 assert.equal(r.classification,'HYPOTHETICAL_STRESS_REFERENCE_ONLY');
 assert.equal(r.actualOrderFilled,false);
 assert.equal(r.actualBrokerRealizedPnl,null);
 assert.equal(r.marketIndependentlyWitnessed,false);
 assert.equal(r.originalEngineDecisionAttested,false);
 assert.equal(r.ordersSent,0);
 assert.equal(r.stopTouchedInCallerOhlc,false);
 assert.equal(r.netRHypothetical,-0.1);
 assert.equal(ROBOT_R4_LOCKED_ASSUMPTIONS.stopPct,0.01);
});
test('R4 Manual/Híbrido keep direction, Reverso inverts only reference',()=>{
 const f=fixtures();
 const m=reviewR4ExecutionFeasibility(f),
  h=reviewR4ExecutionFeasibility(patch(f,{signal:{mode:'hybrid'}})),
  r=reviewR4ExecutionFeasibility(patch(f,{signal:{mode:'reverse'}}));
 assert.equal(m.referenceSide,'buy');
 assert.equal(h.referenceSide,'buy');
 assert.equal(r.classification,'NO_EXECUTABLE_REFERENCE');
 assert.ok(r.reasonCodes.includes('SPOT_SHORT_UNSUPPORTED'));
 assert.equal(r.ordersSent,0);
});
test('R4 Reverso margin with declared borrow is still not a verified trade',()=>{
 const f=fixtures();
 const v=patch(f,{signal:{mode:'reverse'},market:{
   marketType:'margin',borrowAvailableDeclared:true},
  friction:{fundingBps:20}});
 const r=reviewR4ExecutionFeasibility(v);
 assert.equal(r.referenceSide,'sell');
 assert.equal(r.classification,'HYPOTHETICAL_STRESS_REFERENCE_ONLY');
 assert.equal(r.borrowPermissionIndependentlyVerified,false);
 assert.equal(r.actualOrderFilled,false);
 assert.equal(r.actualBrokerRealizedPnl,null);
});
test('R4 gap and pre-crossed stop block scoring, never fabricate a fill',()=>{
 const f=fixtures();
 checkBlocked(reviewR4ExecutionFeasibility(patch(f,{observation:{
  open:102,high:102.2,low:99.4}})),'ADVERSE_OPEN_GAP');
 checkBlocked(reviewR4ExecutionFeasibility(patch(f,{observation:{
  open:98.5,high:101,low:98,close:100}})),'STOP_BREACHED_AT_ENTRY_OPEN');
});
test('R4 partial fill, inadequate depth and halted markets cannot be reported as completed',()=>{
 const f=fixtures();
 checkBlocked(reviewR4ExecutionFeasibility(patch(f,{friction:{declaredFillFraction:0.4}})),
  'PARTIAL_OR_MISSING_FILL_UNRECONCILED');
 checkBlocked(reviewR4ExecutionFeasibility(patch(f,{friction:{declaredFillFraction:0}})),
  'PARTIAL_OR_MISSING_FILL_UNRECONCILED');
 checkBlocked(reviewR4ExecutionFeasibility(patch(f,{friction:{declaredDepthMultiple:1}})),
  'DEPTH_INSUFFICIENT_DECLARED');
 checkBlocked(reviewR4ExecutionFeasibility(patch(f,{market:{liquidityState:'halted'}})),
  'MARKET_LIQUIDITY_UNVERIFIED_OR_LOW');
});
test('R4 PAUSE, open position, missing consent and stale metadata fail closed',()=>{
 const f=fixtures();
 for(const [obj,reason] of [
  [{market:{paused:true}},'OPERATOR_PAUSED'],
  [{market:{positionOpen:true}},'POSITION_ALREADY_OPEN'],
  [{market:{localConsentDeclared:false}},'CONSENT_NOT_DECLARED'],
  [{market:{metadataAgeMs:20000}},'INSTRUMENT_METADATA_STALE'],
  [{market:{liquidityState:'unknown'}},'MARKET_LIQUIDITY_UNVERIFIED_OR_LOW'],
  [{observation:{observedAtMs:T+H+14400001},observedAtMs:T+H+14400001},
   'PROSPECTIVE_OBSERVATION_TOO_LATE'],
  [{friction:{spreadBps:31}},'SPREAD_TOO_WIDE']
 ])checkBlocked(reviewR4ExecutionFeasibility(patch(f,obj)),reason);
});
test('R4 funding required for margin and shorts need declared borrow',()=>{
 const f=fixtures();
 checkBlocked(reviewR4ExecutionFeasibility(patch(f,{
  market:{marketType:'perpetual'},friction:{fundingBps:null}})),'FUNDING_UNKNOWN');
 checkBlocked(reviewR4ExecutionFeasibility(patch(f,{
  signal:{mode:'reverse'},market:{marketType:'margin'},
  friction:{fundingBps:20}})),'SHORT_BORROW_NOT_DECLARED');
});
test('R4 disallows fake provider attestations, lookahead, prices or funding',()=>{
 const f=fixtures(),cases=[
  {signal:{source:'INDEPENDENT_ATTESTED'}},
  {signal:{emittedAtMs:T}},
  {observation:{sourceSigned:true}},
  {observation:{orderExecuted:true}},
  {observation:{quoteCurrency:'USDT'}},
  {observation:{targetCloseMs:T+H+1000}},
  {observation:{observedAtMs:T+H+1000}},
  {observation:{high:90}},
  {observation:{volume:0}},
  {friction:{feeBps:-0.1}},
  {friction:{spreadBps:Infinity}},
  {friction:{fundingBps:1}},
  {friction:{declaredFillFraction:2}},
  {market:{marketType:'fake'}}
 ];
 for(const x of cases)assert.throws(()=>reviewR4ExecutionFeasibility(patch(f,x)));
});
test('R4 hypothetical fee/spread/slippage/funding never improve the same signed side',()=>{
 const f=fixtures();
 const fees=[0,10,30,50],spreads=[0,10,30],
  slips=[0,10,30];
 let comparisons=0;
 for(const feeBps of fees)for(const spreadBps of spreads){
  let prior=Infinity;
  for(const entrySlippageBps of slips){
   const r=reviewR4ExecutionFeasibility(patch(f,{
    friction:{feeBps,spreadBps,entrySlippageBps}}));
   assert.ok(r.netRHypothetical<=prior+1e-6);
   prior=r.netRHypothetical;comparisons++;
  }
 }
 assert.equal(comparisons,36);
 const margin=patch(f,{market:{marketType:'margin'}});
 const low=reviewR4ExecutionFeasibility(patch(margin,{friction:{fundingBps:0}}));
 const high=reviewR4ExecutionFeasibility(patch(margin,{friction:{fundingBps:50}}));
 assert.ok(high.netRHypothetical<low.netRHypothetical);
});
test('R4 adverse stop slippage can only reduce hypothetical stop-touched return',()=>{
 const f=fixtures(),o={low:98.8,high:101.1,close:100.5};
 const results=[0,10,30,100].map(stopSlippageBps=>
  reviewR4ExecutionFeasibility(patch(f,{
   observation:o,friction:{stopSlippageBps}})));
 assert.ok(results.every(r=>r.stopTouchedInCallerOhlc===true));
 for(let i=1;i<results.length;i++)
  assert.ok(results[i].netRHypothetical<=results[i-1].netRHypothetical);
});
test('R4 three-mode cohort rejects invented equivalence when a mode cannot trade',()=>{
 const f=fixtures();
 const inputs=['manual','hybrid','reverse'].map(mode=>
  patch(f,{signal:{id:'syn-'+mode,mode}}));
 const r=reviewR4PairedThreeModeFeasibility(inputs);
 assert.deepEqual(r.modesWithBlockedReference,['reverse']);
 assert.equal(r.pairedScoreDeltaR,null);
 assert.equal(r.actualPortfolioPnl,null);
 assert.equal(r.realTradeAuthorization,false);
 assert.equal(r.ordersSent,0);
});
test('R4 margin three-mode comparison remains hypothetical despite full toy scores',()=>{
 const f=fixtures();
 const rows=['manual','hybrid','reverse'].map(mode=>
  patch(f,{signal:{id:'syn-'+mode,mode},
   market:{marketType:'margin',borrowAvailableDeclared:true},
   friction:{fundingBps:20}}));
 const r=reviewR4PairedThreeModeFeasibility(rows);
 assert.equal(r.modesWithBlockedReference.length,0);
 assert.ok(Number.isFinite(r.pairedScoreDeltaR.reverseMinusManual));
 assert.equal(r.privateRobotOutputsAuthenticated,false);
 assert.equal(r.pairedBrokerExecutabilityVerified,false);
 assert.equal(r.comparisonMayBeUsedInCommercialClaims,false);
});
test('R4 mismatched event, price, market or friction cannot be paired',()=>{
 const f=fixtures(),inputs=['manual','hybrid','reverse'].map(mode=>
  patch(f,{signal:{id:'syn-'+mode,mode}}));
 for(const [index,field,value] of [
  [1,'friction',{feeBps:20}],[2,'observation',{close:102}],
  [1,'market',{asset:'SOL-USD'}],[0,'signal',{referencePrice:110}]
 ]) {
  const bad=inputs.map((x,i)=>i===index?patch(x,{[field]:value}):x);
  assert.throws(()=>reviewR4PairedThreeModeFeasibility(bad),
    /ROBOT_R4_NONCOMPARABLE_SYNTHETIC_COHORT/);
 }
});
test('R4 1,296 purely synthetic combinations never authorize any action',()=>{
 const f=fixtures();let count=0,blocked=0;
 for(const mode of ['manual','hybrid','reverse'])
 for(const marketType of ['spot','margin','perpetual'])
 for(const spreadBps of [0,10,30,31])
 for(const declaredFillFraction of [0,0.4,1])
 for(const declaredDepthMultiple of [0,1,3])
 for(const paused of [false,true])
 for(const borrowAvailableDeclared of [false,true]){
  const input=patch(f,{signal:{mode},market:{marketType,paused,borrowAvailableDeclared},
   friction:{spreadBps,declaredFillFraction,declaredDepthMultiple,
    fundingBps:marketType==='spot'?0:20}});
  const r=reviewR4ExecutionFeasibility(input);
  assert.equal(r.ordersSent,0);assert.equal(r.paperOrdersSent,0);
  assert.equal(r.commercialResultClaimAllowed,false);
  assert.equal(r.actualBrokerRealizedPnl,null);
  assert.equal(r.productionReleaseAllowed,false);
  if(r.classification==='NO_EXECUTABLE_REFERENCE'){
   blocked++;assert.equal(r.netRHypothetical,null);
  }else assert.ok(Number.isFinite(r.netRHypothetical));
  count++;
 }
 assert.equal(count,1296);
 assert.ok(blocked>800);
});
test('R4 code has no broker transports, paid AI, Next API imports or environment secrets',()=>{
 const src=readFileSync(new URL('../lib/platform/research/robot-r4-execution-feasibility.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(src,/\bfetch\s*\(|\bsubmitOrder\s*\(|\bcreateOrder\s*\(|process\.env|OPENAI_API_KEY/);
 const v=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url)));
 assert.equal(v.git.deploymentEnabled['fix/jenios-robot-r4-execution-feasibility-20261021'],false);
});
