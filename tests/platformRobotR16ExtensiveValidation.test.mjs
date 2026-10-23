import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {R16_PLAN,runR16ManualMatrix,runR16HybridMatrix,runR16ReverseMatrix,
 runR16LossStreakMatrix,runR16CounterfactualMatrix,summarizeR16}
 from '../lib/platform/research/robot-r16-extensive-validation.mjs';

test('R16 Manual sweeps latency, abstention and late-delivery states without execution',()=>{
 const rows=runR16ManualMatrix();
 assert.equal(rows.length,126);
 assert.ok(rows.some(x=>x.declaredTimely));
 assert.ok(rows.some(x=>!x.declaredTimely));
 for(const x of rows){
  assert.equal(x.ordersSent,0);assert.equal(x.paperOrdersSent,0);
  assert.equal(x.liveManualPerformanceCertified,false);
  assert.equal(x.actualPnl,null);
 }
});

test('R16 Hybrid sweeps 2,400 regime/risk combinations and fails closed on hazards',()=>{
 const rows=runR16HybridMatrix();
 assert.equal(rows.length,2400);
 assert.ok(rows.filter(x=>x.classification==='WAIT_AND_REVIEW').length>2000);
 for(const x of rows){
  const hazard=x.atrPct>6||x.spreadBps>30||x.marketBias==='NEUTRAL'||
   x.liquidityState!=='declared_adequate'||x.paused||x.positionOpen||x.stale;
  assert.equal(x.classification,hazard?'WAIT_AND_REVIEW':'DESCRIPTIVE_CONTEXT_UNVERIFIED');
  assert.equal(x.operatorDecides,true);assert.equal(x.hybridInvertsOrders,false);
  assert.equal(x.ordersSent,0);
 }
});

test('R16 Reverse sweeps 13,824 combinations and never authorizes broker transport',()=>{
 const rows=runR16ReverseMatrix();
 assert.equal(rows.length,13824);
 assert.ok(rows.filter(x=>x.classification==='BLOCK_NEW_EXPOSURE').length>12000);
 for(const x of rows){
  assert.equal(x.ordersSent,0);assert.equal(x.paperOrdersSent,0);
  assert.equal(x.orderTransportAuthorized,false);
  assert.equal(x.commercialPerformanceClaimAllowed,false);
  if(x.classification==='BLOCK_NEW_EXPOSURE')assert.equal(x.referenceSide,null);
 }
});

test('R16 loss-streak matrix suggests education/pause without automatic mode switching',()=>{
 const rows=runR16LossStreakMatrix();
 assert.equal(rows.length,117);
 for(const x of rows){
  assert.equal(x.pauseSuggested,x.losses>=x.threshold);
  assert.equal(x.reverseModeEducationSuggested,x.losses>=x.threshold);
  assert.equal(x.automaticModeSwitch,false);
  assert.equal(x.executionEnabled,false);
 }
});

test('R16 paired counterfactual remains synthetic and cannot become commercial lossometer',()=>{
 const x=runR16CounterfactualMatrix();
 assert.equal(x.paired,500);
 assert.equal(x.actualLossesAvoided,null);
 assert.equal(x.actualBrokerRealizedPnl,null);
 assert.equal(x.statisticalAdvantageCertified,false);
 assert.equal(x.commercialLossometerAllowed,false);
 assert.equal(x.ordersSent,0);assert.equal(x.paperOrdersSent,0);
});

test('R16 summary covers over 16k deterministic validations with zero execution',()=>{
 const x=summarizeR16();
 assert.equal(x.manualCases,126);
 assert.equal(x.hybridCases,2400);
 assert.equal(x.reverseCases,13824);
 assert.equal(x.lossStreakCases,117);
 assert.equal(x.pairedCounterfactualCases,500);
 assert.equal(x.manualCases+x.hybridCases+x.reverseCases+x.lossStreakCases+x.pairedCounterfactualCases,16967);
 assert.equal(x.ordersSent,0);assert.equal(x.paperOrdersSent,0);
 assert.equal(x.actualLossesAvoided,null);assert.equal(x.tradeAccuracy,null);
 assert.equal(x.statisticalAdvantageCertified,false);
});

test('R16 source itself has no network/broker/secret/private-engine integration',()=>{
 const s=readFileSync(new URL('../lib/platform/research/robot-r16-extensive-validation.mjs',import.meta.url),'utf8');
 assert.equal(R16_PLAN.executionAllowed,false);
 assert.equal(R16_PLAN.paperExternalAllowed,false);
 assert.doesNotMatch(s,/\bfetch\s*\(|submitOrder|createOrder|OPENAI_API_KEY|process\.env|private-core|nucleo-privado/i);
 const v=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url),'utf8'));
 assert.equal(v.git.deploymentEnabled['research/jenios-robot-r16-extensive-validation-20261022'],false);
});
