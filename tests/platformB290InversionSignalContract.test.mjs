import test from 'node:test';import assert from 'node:assert/strict';
import {reverseOperatorCommand,inspectSignalDelivery} from '../lib/platform/research/b290-inversion-signal-contract.mjs';
const command=(action,side)=>({eventId:'test-1',action,side});
test('B290 reverses operator buy to sell and sell to buy',()=>{
 assert.equal(reverseOperatorCommand(command('open','buy')).side,'sell');
 assert.equal(reverseOperatorCommand(command('open','sell')).side,'buy');
});
test('B290 mega trend veto follows trend rather than blindly inverting',()=>{
 const a=reverseOperatorCommand(command('open','buy'),{megaTrendDirection:'buy'});
 const b=reverseOperatorCommand(command('open','buy'),{megaTrendDirection:'sell'});
 assert.equal(a.side,'buy');assert.equal(b.side,'sell');
 assert.equal(a.decision,'MEGATREND_FOLLOW');
 assert.equal(b.decision,'MEGATREND_VETO_REVERSE');
});
test('B290 cancellation and closing do not open reverse exposure',()=>{
 for(const action of ['close','cancel'])for(const side of ['buy','sell']){
  const x=reverseOperatorCommand(command(action,side));
  assert.equal(x.action,action);assert.equal(x.side,side);
  assert.equal(x.noNewExposure,true);assert.equal(x.ordersSent,0);
 }
});
test('B290 invalid input or absent authorization fails closed',()=>{
 assert.throws(()=>reverseOperatorCommand(command('open','buy'),{operatorAuthorized:false}),/B290_INVALID_OR_UNAUTHORIZED_COMMAND/);
 assert.throws(()=>reverseOperatorCommand(command('open','hold')),/B290_INVALID_OR_UNAUTHORIZED_COMMAND/);
});
test('B290 manual and hybrid signals must be recorded and delivered before target',()=>{
 for(const mode of ['manual','hybrid']){
  const signal={mode,direction:'UP',emittedAtMs:1000,targetCandleOpenMs:4000,isOrder:false};
  const x=inspectSignalDelivery(signal,{recordedAtMs:2000,deliveredAtMs:3000});
  assert.equal(x.deliveredBeforeTarget,true);assert.equal(x.originalSignalSourceVerified,false);
  assert.throws(()=>inspectSignalDelivery(signal,{recordedAtMs:2000,deliveredAtMs:4000}),/B290_UNVERIFIED_OR_LATE_SIGNAL/);
 }
});
