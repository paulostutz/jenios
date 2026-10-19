import test from 'node:test';
import assert from 'node:assert/strict';
import {assessPaperStrategy,simulationModeLabels} from '../lib/platform/paper-policy.mjs';
const params={mode:'hibrido',balance:100000,allocation:10000,dailyStop:500};
test('B80 three modes only produce paper plans without any orders',()=>{
 for(const x of simulationModeLabels()){
  const s=assessPaperStrategy({...params,mode:x.code});
  assert.equal(s.brokerOrder,null);assert.equal(s.realExecutionAllowed,false);
  assert.equal(s.verifiedProfit,null);assert.equal(s.avoidedLoss,null);
  assert.equal(s.source,'paper_scenario_only');
 }
});
test('B80 conservative demo budget and antifuria gate are enforced',()=>{
 for(const variation of [{paused:true},{allocation:30000},{dailyStop:4000},{balance:0},{mode:'INVALID'}]){
  const p=assessPaperStrategy({...params,...variation});
  assert.equal(p.rehearsalAllowed,false);
  assert(p.reasons.length>0);
  assert.equal(p.realExecutionAllowed,false);
 }
});
test('B80 imported price samples never become a live market execution signal',()=>{
 const p=assessPaperStrategy({...params,analysis:{source:'user_supplied_historical_unverified',live:false,providerVerified:false}});
 assert(p.reasons.some(x=>x.includes('Sem cotação')));
 assert.equal(p.brokerOrder,null);
});
test('B80 rapid repeated actions inform human safety, never invent avoided losses',()=>{
 const p=assessPaperStrategy({...params,observations:{rapidSequences:4}});
 assert(p.reasons.some(x=>x.includes('Sequência rápida')));
 assert.equal(p.avoidedLoss,null);
});
