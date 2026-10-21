import test from 'node:test';import assert from 'node:assert/strict';
import {B291_MODES,classifyB291Mode,reviewB291CopilotContext,reviewB291ManualLossStreak} from '../lib/platform/research/b291-three-mode-copilot.mjs';
const ctx={mode:'hybrid',closedAtMs:1000,observedAtMs:2000,atrPct:2,spreadBps:10,maxRiskPct:1,marketBias:'UP',asset:'BTC-USD',providerSigned:false,operatorApproved:false};
test('B291 commercial manual hybrid reverse have distinct and non-inverting hybrid contracts',()=>{
 assert.equal(classifyB291Mode('manual').assistedSignals,false);
 assert.equal(classifyB291Mode('hybrid').invertsOrders,false);
 assert.equal(classifyB291Mode('hybrid').operatorDecides,true);
 assert.equal(classifyB291Mode('reverse').invertsOrders,true);
 assert.ok(Object.values(B291_MODES).every(x=>x.automaticExecution===false));
});
test('B291 hybrid produces bounded descriptive context, not a fabricated entry or order',()=>{
 const x=reviewB291CopilotContext(ctx);
 assert.equal(x.classification,'CONTEXT_FOR_OPERATOR_REVIEW');
 assert.equal(x.entryPriceSuggestion,null);
 assert.equal(x.stopSuggestion,null);assert.equal(x.targetSuggestion,null);
 assert.equal(x.ordersSent,0);assert.equal(x.reverseOrdersSent,0);
 assert.equal(x.originalEngineSignalVerified,false);
});
test('B291 hybrid stress and neutral market recommend wait and review',()=>{
 for(const patch of [{atrPct:7},{spreadBps:50},{marketBias:'NEUTRAL'}]){
  const x=reviewB291CopilotContext({...ctx,...patch});
  assert.equal(x.classification,'WAIT_AND_REVIEW');
 }
});
test('B291 hybrid rejects stale/lookahead or spoofed provider confirmation',()=>{
 for(const patch of [{closedAtMs:3000},{providerSigned:true},{operatorApproved:true},{atrPct:-1}]){
  assert.throws(()=>reviewB291CopilotContext({...ctx,...patch}),/B291_INVALID_OR_UNVERIFIED_CONTEXT/);
 }
});
test('B291 manual loss streak recommends pause and education, never switches mode',()=>{
 const events=[-1,-2,-3].map((netResult,i)=>({closedAtMs:1000+i,netResult,verifiedClosedTrade:true}));
 const x=reviewB291ManualLossStreak(events);
 assert.equal(x.lossStreak,3);assert.equal(x.pauseSuggested,true);
 assert.equal(x.reverseModeEducationSuggested,true);
 assert.equal(x.automaticModeSwitch,false);
 assert.equal(x.reversePerformanceClaim,false);
});
test('B291 winning manual trade resets streak and unverifiable result fails',()=>{
 const events=[-1,-2,1].map((netResult,i)=>({closedAtMs:1000+i,netResult,verifiedClosedTrade:true}));
 assert.equal(reviewB291ManualLossStreak(events).lossStreak,0);
 assert.throws(()=>reviewB291ManualLossStreak([{...events[0],verifiedClosedTrade:false}]),/B291_UNVERIFIED_MANUAL_TRADE/);
});
