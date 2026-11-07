import test from 'node:test';import assert from 'node:assert/strict';
import {runUltraR113Laboratory} from '../lib/platform/research/ultrafast-r113-laboratory.mjs';
import {analyzeUltraV2WithCertifiedHistory} from '../lib/platform/research/ultrafast-v2-certified-bridge.mjs';
import {buildMarketFlowContext} from '../lib/platform/research/market-flow-context.mjs';
const now=1800000000000;
function input(){let captured;runUltraR113Laboratory('favorable',{nowMs:now,analyzeV2:x=>{
 captured=x;return analyzeUltraV2WithCertifiedHistory(x);
 }});return {...captured,market:{...captured.market,symbol:'BTC-USDT'}};}
function context(){return buildMarketFlowContext({startMs:now-60000,endMs:now,receivedAtMs:now,complete:true,
 evidenceKind:'SYNTHETIC',trades:Array.from({length:12},(_,i)=>({a:i,T:now-60000+Math.floor(i/4)*20000+i%4*6000,
 p:String(100-i%4*.02),q:'1000',m:true}))});}
test('R114 Ultra observes a conflicting market without changing its established gates or adding another engine',()=>{
 const cfg=input(),baseline=analyzeUltraV2WithCertifiedHistory(cfg);
 const observed=analyzeUltraV2WithCertifiedHistory({...cfg,flowContext:context()});
 assert.equal(observed.marketFlow.wouldWait,true);assert.equal(observed.marketFlow.enforcement,'OBSERVE_ONLY');
 assert.equal(observed.eligibleForFurtherResearch,baseline.eligibleForFurtherResearch);
 assert.deepEqual(observed.blockers,baseline.blockers);assert.deepEqual(observed.candidate,baseline.candidate);
 assert.deepEqual(observed.preservedHistoricalGates,baseline.preservedHistoricalGates);
 assert.equal(observed.ordersSent,0);assert.equal(observed.liveExecutionEnabled,false);
});
test('R114 Ultra decision path has no external I/O and keeps original kill-switch refusals',()=>{
 const cfg=input(),previous=globalThis.fetch;globalThis.fetch=()=>{throw Error('NETWORK_IN_ULTRA_DECISION');};
 try{const observed=analyzeUltraV2WithCertifiedHistory({...cfg,safety:{...cfg.safety,userStopped:true},flowContext:context()});
  assert.equal(observed.eligibleForFurtherResearch,false);assert.ok(observed.blockers.includes('R18_KILL_SWITCH'));
 }finally{globalThis.fetch=previous;}
});
test('R114 Ultra rejects cross-venue or USD/USDT substitution for the context, without changing eligibility',()=>{
 const cfg=input();const x=analyzeUltraV2WithCertifiedHistory({...cfg,market:{...cfg.market,symbol:'BTC-USD'},flowContext:context()});
 assert.equal(x.marketFlow.applicable,false);
});
