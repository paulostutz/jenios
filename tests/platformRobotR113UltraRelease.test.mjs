import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runUltraR113Laboratory} from '../lib/platform/research/ultrafast-r113-laboratory.mjs';
const TEST_TIME=1800000000000;
const baseReport=Object.freeze({schema:'JENIOS_ULTRA_V2_CERTIFIED_RESEARCH_CYCLE_V1',
 eligibleForFurtherResearch:true,blockers:[],preservedHistoricalGates:{r18:true,r23:true,r28:true,r53:true,killSwitchClear:true},
 candidate:{symbol:'BTC-USD',eligible:true},execution:{allowProposal:true},
 ordersSent:0,liveExecutionEnabled:false});
const demo=(scenario,analyzeV2=()=>baseReport)=>runUltraR113Laboratory(scenario,{nowMs:TEST_TIME,analyzeV2});
test('R113 integrates R111 + R112 with no real orders, credentials or unlabelled profits',()=>{
 const x=demo('favorable');
 assert.equal(x.schema,'JENIOS_R113_ULTRA_READONLY_LAB_V1');
 assert.equal(x.source,'SYNTHETIC_FIXTURE_NOT_A_MARKET_SIGNAL');
 assert.equal(x.v2.eligibleForFurtherResearch,true);
 assert.equal(x.v3.canContinueOfflineResearch,true);
 assert.equal(x.v3.bookIntegrity,true);
 assert.equal(x.v3.exchangeRuleResearchOnly,true);
 assert.equal(x.v3.watchdogHealthy,true);
 assert.equal(x.simulators.holdoutIsSynthetic,true);
 assert.equal(x.simulators.shadowPerformance.financialPerformanceCertified,false);
 assert.equal(x.externalPaperEnabled,false);
 assert.equal(x.liveExecutionEnabled,false);
 assert.equal(x.ordersSent,0);
 assert.equal(x.noBrokerCredentials,true);
 assert.equal(x.simulators.depthSweep.fillIsHypothetical,true);
 assert.equal(x.simulators.makerQueue.notBrokerFillEvidence,true);
});
test('R113 risk and stale conditions trip the V3 offline gate',()=>{
 const risk=demo('risk');
 assert.equal(risk.v3.canContinueOfflineResearch,false);
 assert.ok(risk.v3.blockers.includes('R112_TOKEN_RISK'));
 assert.ok(risk.v3.tokenRiskFlags.includes('SALE_NOT_PROVEN'));
 assert.equal(risk.v3.stressBudgetResearchOnly,false);
 const stale=demo('stale');
 assert.equal(stale.v3.canContinueOfflineResearch,false);
 assert.ok(stale.v3.blockers.includes('R112_BOOK_INTEGRITY'));
 assert.ok(stale.v3.blockers.includes('R112_WATCHDOG'));
});
test('R113 preserves historical R111 veto and has no synthetic strategy promotion',()=>{
 const denied=demo('favorable',()=>({...baseReport,eligibleForFurtherResearch:false,blockers:['R28_DYNAMIC_BREAKEVEN']}));
 assert.equal(denied.v3.canContinueOfflineResearch,false);
 assert.ok(denied.v3.blockers.includes('R111_V2_RESEARCH_GATE'));
 assert.equal(denied.simulators.holdoutPassing.length,0);
 assert.equal(denied.financialPerformanceCertified,false);
});
test('R113 rejects unknown modes and malformed arguments',()=>{
 assert.throws(()=>demo('trade'),/R113_INVALID_INPUT/);
 assert.throws(()=>runUltraR113Laboratory('favorable',{nowMs:0,analyzeV2:()=>baseReport}),/R113_INVALID_INPUT/);
});
test('R113 route is admin-protected, production-scoped and no outbound finance',()=>{
 const src=readFileSync(new URL('../app/api/platform/admin/robots/ultrafast/route.js',import.meta.url),'utf8');
 assert.match(src,/requirePlatformAdmin\(request,db,'platform\.admin'\)/);
 assert.match(src,/release\/jenios-genios-g44-20261024/);
 assert.match(src,/analyzeUltraV2WithCertifiedHistory/);
 assert.doesNotMatch(src,/submitOrder|sendOrder|createMarketOrder|createLimitOrder|AddOrder|\/private\/AddOrder/);
 assert.match(src,/SYNTHETIC_FIXTURE|runUltraR113Laboratory/);
});