import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 reviewR1ManualSignalWindow,reviewR1HybridSafety,
 reviewR1ReverseEligibility,reviewR1PairedLossAttribution
} from '../lib/platform/research/robot-r1-adversarial-gates.mjs';
import {reverseOperatorCommand} from '../lib/platform/research/b290-inversion-signal-contract.mjs';
import {reviewB280ForwardCoverage,B280_RESEARCH_ACCEPTANCE_GATES}
 from '../lib/platform/research/b280-statistical-gate.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const manual={
 signalId:'laboratory-1',asset:'BTC-USD',mode:'manual',direction:'UP',
 emittedAtMs:1000,recordedAtMs:1200,declaredReceivedAtMs:1400,
 targetOpenMs:10000,observedAtMs:12000,isOrder:false,
 executed:false,source:'CALLER_SUPPLIED_SYNTHETIC'
};
const context={mode:'hybrid',closedAtMs:3600000,observedAtMs:3601000,
 atrPct:1.5,spreadBps:6,maxRiskPct:1,marketBias:'UP',asset:'BTC-USD',
 providerSigned:false,operatorApproved:false};
const hybrid={context,intervalMs:3600000,paused:false,positionOpen:false,
 liquidityState:'declared_adequate'};
const command={action:'open',side:'buy',eventId:'synthetic-buy'};
const reverse={command,marketType:'margin',megaTrendDirection:null,
 paused:false,positionOpen:false,metadataAgeMs:1000,metadataMaxAgeMs:10000,
 spreadBps:5,maxSpreadBps:30,borrowAvailableDeclared:true,fundingBps:10,
 localConsentDeclared:true};
const row=(id,cohortKey,b,c,kind='KEEP')=>({
 id,cohortKey,referenceNetR:b,interventionNetR:c,
 interventionKind:kind,source:'SYNTHETIC_PAIRED_UNVERIFIED'
});
const throws=(f,code)=>assert.throws(f,e=>e?.code===code);

test('R1 Manual even a synthetically timely receipt does NOT become independent delivery',()=>{
 const r=reviewR1ManualSignalWindow(manual);
 assert.equal(r.declaredTimely,true);
 assert.equal(r.deliveryProviderReceiptIndependentlyVerified,false);
 assert.equal(r.originalSignalProvenanceVerified,false);
 assert.equal(r.liveManualPerformanceCertified,false);
 assert.equal(r.ordersSent,0);
 assert.equal(r.actualPnl,null);
});
test('R1 Manual no receipt, late receipt, excessive delay or abstention give no performance credit',()=>{
 for(const [v,reason] of [
  [{declaredReceivedAtMs:null},'NO_RECEPTION_TIMESTAMP'],
  [{declaredReceivedAtMs:10000,observedAtMs:11000},'ARRIVED_AFTER_OPPORTUNITY'],
  [{declaredReceivedAtMs:9000},'DELIVERY_LATENCY_EXCEEDED'],
  [{direction:'ABSTAIN'},'NO_DIRECTION_NO_TRADE']
 ]){
  const r=reviewR1ManualSignalWindow({...manual,...v},{latencyBudgetMs:1000});
  assert.equal(r.declaredTimely,false);
  assert.ok(r.issues.includes(reason));
  assert.equal(r.ordersSent,0);
 }
});
test('R1 Manual refuses reversed time, forged execution, injected provider attestation',()=>{
 for(const patch of [
  {recordedAtMs:11000},{declaredReceivedAtMs:1150},{declaredReceivedAtMs:13000},
  {emittedAtMs:10000},{isOrder:true},{executed:true},{source:'LIVE_BROKER'},
  {deliveryProviderVerified:true},{signalId:'../../evil'},
  {observedAtMs:1000}
 ])throws(()=>reviewR1ManualSignalWindow({...manual,...patch}),'ROBOT_R1_INVALID_MANUAL_EVIDENCE');
 for(const latencyBudgetMs of [0,999,3600001,NaN])
  throws(()=>reviewR1ManualSignalWindow(manual,{latencyBudgetMs}),'ROBOT_R1_INVALID_MANUAL_EVIDENCE');
});
test('R1 Manual preserves original B290 first-before-target and does not send orders',()=>{
 const r=reviewR1ManualSignalWindow({...manual,recordedAtMs:2000,
  declaredReceivedAtMs:3000},{latencyBudgetMs:5000});
 assert.equal(r.declaredTimely,true);
 assert.equal(r.ordersSent,0);
 assert.equal(r.realFillCount,null);
});

test('R1 Híbrido uses B291 context, still human-operated and never inverts',()=>{
 const r=reviewR1HybridSafety(hybrid);
 assert.equal(r.classification,'DESCRIPTIVE_CONTEXT_UNVERIFIED');
 assert.equal(r.operatorDecides,true);
 assert.equal(r.hybridInvertsOrders,false);
 assert.equal(r.marketProviderIndependentlyVerified,false);
 assert.equal(r.entryPriceSuggestion,null);
 assert.equal(r.stopPriceSuggestion,null);
 assert.equal(r.automatedPositionSizing,null);
 assert.equal(r.ordersSent,0);
});
test('R1 Híbrido stale closed context blocks favorable looking signals',()=>{
 const r=reviewR1HybridSafety({...hybrid,context:{
  ...context,observedAtMs:context.closedAtMs+7200000}});
 assert.equal(r.classification,'WAIT_AND_REVIEW');
 assert.ok(r.reasons.includes('CLOSED_MARKET_DATA_STALE'));
 assert.equal(r.entryPriceSuggestion,null);
});
test('R1 Híbrido spread, volatility, neutrality, halted/thin/unknown liquidity block review',()=>{
 for(const [patch,reason] of [
  [{context:{...context,spreadBps:40}},'WIDE_SPREAD'],
  [{context:{...context,atrPct:9}},'VOLATILITY_STRESS'],
  [{context:{...context,marketBias:'NEUTRAL'}},'NO_DIRECTIONAL_CONFIRMATION'],
  [{liquidityState:'thin'},'LOW_LIQUIDITY'],
  [{liquidityState:'unknown'},'LIQUIDITY_UNVERIFIED'],
  [{liquidityState:'halted'},'MARKET_HALTED'],
  [{paused:true},'OPERATOR_PAUSED'],
  [{positionOpen:true},'EXISTING_POSITION_REQUIRES_REVIEW']
 ]){
  const x=reviewR1HybridSafety({...hybrid,...patch});
  assert.equal(x.classification,'WAIT_AND_REVIEW',reason);
  assert.ok(x.reasons.includes(reason));
  assert.equal(x.ordersSent,0);
 }
});
test('R1 Híbrido rejects open candle and unsupported claims or cadence',()=>{
 for(const patch of [
  {context:{...context,closedAtMs:context.observedAtMs+1}},
  {context:{...context,providerSigned:true}},
  {context:{...context,operatorApproved:true}},
  {intervalMs:0},{intervalMs:70000},{liquidityState:'certified'},
  {paused:'false'}
 ])assert.throws(()=>reviewR1HybridSafety({...hybrid,...patch}));
});
test('R1 Reverso current spot BUY cannot imply free short sale',()=>{
 const x=reviewR1ReverseEligibility({...reverse,marketType:'spot',fundingBps:null});
 assert.equal(x.classification,'BLOCK_NEW_EXPOSURE');
 assert.equal(x.referenceSide,null);
 assert.ok(x.reasonCodes.includes('SPOT_SHORT_UNSUPPORTED'));
 assert.equal(x.ordersSent,0);
});
test('R1 Reverso absence of borrow/funding or stale metadata fails closed',()=>{
 for(const [patch,reason] of [
  [{borrowAvailableDeclared:false},'SHORT_BORROW_NOT_DECLARED'],
  [{fundingBps:null},'FUNDING_NOT_MODELED'],
  [{metadataAgeMs:10001},'INSTRUMENT_METADATA_STALE'],
  [{spreadBps:31},'SPREAD_TOO_WIDE'],
  [{paused:true},'OPERATOR_PAUSED'],
  [{positionOpen:true},'POSITION_ALREADY_OPEN'],
  [{localConsentDeclared:false},'OPERATOR_CONSENT_NOT_DECLARED']
 ]){
  const x=reviewR1ReverseEligibility({...reverse,...patch});
  assert.equal(x.classification,'BLOCK_NEW_EXPOSURE',reason);
  assert.ok(x.reasonCodes.includes(reason));
  assert.equal(x.referenceSide,null);
 }
});
test('R1 Reverso validated lab inputs remain only a reference, not an order',()=>{
 const x=reviewR1ReverseEligibility(reverse);
 assert.equal(x.referenceSide,'sell');
 assert.equal(x.classification,'REFERENCE_FOR_HUMAN_REVIEW_ONLY');
 assert.equal(x.liveShortBorrowVerified,false);
 assert.equal(x.externalConsentVerified,false);
 assert.equal(x.orderTransportAuthorized,false);
 assert.equal(x.ordersSent,0);
});
test('R1 Reverso mega trend exception uses original B290, not blind inversion',()=>{
 const x=reviewR1ReverseEligibility({...reverse,megaTrendDirection:'buy'});
 assert.equal(x.referenceSide,'buy');
 assert.equal(x.theoreticalReferenceDecision,'MEGATREND_FOLLOW');
 assert.deepEqual(x.referenceSide,reverseOperatorCommand(command,{megaTrendDirection:'buy'}).side);
});
test('R1 Reverso close/cancel lifecycle never creates opposite exposure',()=>{
 for(const action of ['cancel','close']){
  const x=reviewR1ReverseEligibility({...reverse,command:{...command,action},
   paused:true,positionOpen:true});
  assert.equal(x.noNewExposure,true);
  assert.equal(x.referenceAction,action);
  assert.equal(x.referenceSide,'buy');
  assert.equal(x.brokerCancelOrClosePerformed,false);
  assert.equal(x.ordersSent,0);
 }
});
test('R1 Reverso rejects unsupported venue, nonfinite costs and fake authorization',()=>{
 for(const patch of [
  {marketType:'unknown'},{borrowAvailableDeclared:'true'},
  {fundingBps:NaN},{metadataAgeMs:-1},{spreadBps:Infinity},
  {command:{...command,action:'transfer'}},
  {command:{...command,eventId:'../inject'}}
 ])throws(()=>reviewR1ReverseEligibility({...reverse,...patch}),'ROBOT_R1_INVALID_REVERSE_INPUT');
});
test('R1 Paired Lossômetro displays avoided, partial, new losses and sacrificed gains together',()=>{
 const rows=[
  row('a','cohort-1',-1.2,0,'ABSTAIN'),
  row('b','cohort-2',-2,-1),
  row('c','cohort-3',-1,-1.5),
  row('d','cohort-4',1.5,-0.5,'REVERSE_REFERENCE'),
  row('e','cohort-5',1.3,0,'ABSTAIN'),
  row('f','cohort-6',1.5,0.5),
  row('g','cohort-7',0,-0.1)
 ];
 const x=reviewR1PairedLossAttribution(rows);
 assert.equal(x.hypotheticalLossesFullyAvoided,1);
 assert.equal(x.hypotheticalLossesPartiallyReduced,1);
 assert.equal(x.hypotheticalLossesWorsened,1);
 assert.equal(x.hypotheticalNewLossesIntroduced,2);
 assert.equal(x.hypotheticalGainsForegone,2);
 assert.equal(x.hypotheticalGainsReduced,1);
 assert.equal(x.paired,7);
 assert.equal(x.actualLossesAvoided,null);
 assert.equal(x.actualBrokerRealizedPnl,null);
 assert.equal(x.commercialLossometerAllowed,false);
 assert.equal(x.ordersSent,0);
});
test('R1 Paired only reduces one losing outcome if still negative; never claims fully avoided',()=>{
 const a=reviewR1PairedLossAttribution([row('x','hour-one',-1.1,-0.1)]);
 assert.equal(a.hypotheticalLossesFullyAvoided,0);
 assert.equal(a.hypotheticalLossesPartiallyReduced,1);
 assert.equal(a.customerEconomyObserved,false);
});
test('R1 Paired refuses fabricated market performance, duplicates and contradictory abstention',()=>{
 const good=row('valid','c1',-1.1,0,'ABSTAIN');
 for(const sample of [
  {...good,source:'BROKER_ATTESTED'},{...good,realizedPnl:100},
  {...good,interventionNetR:0.2},{...good,referenceNetR:Infinity},
  {...good,interventionNetR:NaN},{...good,id:'../../'},
  {...good,interventionKind:'AUTO_EXECUTE'},
 ]){
  throws(()=>reviewR1PairedLossAttribution([sample]),'ROBOT_R1_UNTRUSTED_PAIRED_OUTCOME');
 }
 for(const rows of [[good,good],[good,{...good,id:'different'}]])
  throws(()=>reviewR1PairedLossAttribution(rows),'ROBOT_R1_UNTRUSTED_PAIRED_OUTCOME');
});
test('R1 Paired empty and negative samples never invent performance certification',()=>{
 const x=reviewR1PairedLossAttribution([]);
 assert.equal(x.paired,0);
 assert.equal(x.actualBrokerRealizedPnl,null);
 assert.equal(x.statisticalAdvantageCertified,false);
 assert.equal(x.realExecutionEnabled,false);
 assert.equal(x.netDifferenceR,0);
});
test('R1 Retained B280 30-day, 300-hour, 100-outcome independent coverage gate',()=>{
 assert.equal(B280_RESEARCH_ACCEPTANCE_GATES.minimumCalendarDays,30);
 assert.equal(B280_RESEARCH_ACCEPTANCE_GATES.minimumUniqueTargetHours,300);
 assert.equal(B280_RESEARCH_ACCEPTANCE_GATES.minimumOutcomesPerAssetHypothesisMode,100);
 const b=reviewB280ForwardCoverage([]);
 assert.equal(b.descriptiveCoverageReached,false);
 assert.equal(b.readyForOperationalRollout,false);
 assert.equal(b.statisticalAdvantageCertified,false);
});
test('R1 new module has no network broker, order sender or payment calls',()=>{
 const s=read('lib/platform/research/robot-r1-adversarial-gates.mjs');
 assert.doesNotMatch(s,/\bfetch\s*\(|\bsubmitOrder\s*\(|\bcreateOrder\s*\(/);
 assert.doesNotMatch(s,/from ['"].*app\/api|process\.env|OPENAI_API_KEY/);
 const vercel=JSON.parse(read('vercel.json'));
 assert.equal(vercel.git.deploymentEnabled['fix/jenios-robot-r1-adversarial-qa-20261021'],false);
});
