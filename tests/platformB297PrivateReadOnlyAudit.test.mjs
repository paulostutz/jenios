import test from 'node:test';
import assert from 'node:assert/strict';
import {captureB297OriginalDecisions,verifyB297CaptureChain,
 inspectB297OperatorLifecycle,inspectB297DeclaredSignalTimeline,
 inspectB297B152Arithmetic,B297_ENGINE_SHA256,B297_SERVICE_SHA256
} from '../lib/platform/research/b297-private-readonly-audit.mjs';
const T=Date.parse('2026-10-21T19:00:00Z');
const scenarios=['manual','hybrid','reverse'].flatMap(mode=>
 ['buy','sell'].map(intent=>({id:`${mode}-${intent}`,mode,intent,horizon:'day'})));
let calls=[];
const callback=async (input,{fetcher,now})=>{
 calls.push({input,now});
 assert.equal(input.sourceMode,'synthetic');
 assert.equal(typeof fetcher,'function');
 await assert.rejects(()=>fetcher('https://example.invalid'),/B297_NETWORK_FORBIDDEN/);
 const action=input.mode==='manual'?'manual_preview':
  input.mode==='hybrid'?'wait_for_confluence':'reverse_not_calibrated';
 const side=input.mode==='manual'?input.intent:null;
 return {ok:true,version:'FAKE_TEST_CALLBACK',simulation:true,executionEnabled:false,
  sourceMode:'synthetic',symbol:'LABORATÓRIO SINTÉTICO',
  scan:{decisionAt:T-300000},decision:{action,side,mayClose:true}};
};
const capture=()=>captureB297OriginalDecisions({analyzeRequest:callback,scenarios,nowMs:T});
test('B297 three commercial modes: chronological local-only capture and hash chain',async()=>{
 calls=[];const a=await capture();
 assert.deepEqual(a.counts,{manual:2,hybrid:2,reverse:2});
 assert.equal(a.entries.length,6);assert.equal(calls.length,6);
 assert.equal(a.ordersSent,0);assert.equal(a.paperOrdersSent,0);
 assert.equal(a.remoteDeliveryAcknowledged,false);
 assert.equal(a.executableBytesVerifiedByAdapter,false);
 assert.equal(a.originalCallbackIdentityAttested,false);
 assert.equal(a.lossesActuallyAvoided,null);
 assert.equal(verifyB297CaptureChain(a).valid,true);
 assert.match(B297_ENGINE_SHA256,/^[a-f0-9]{64}$/);
 assert.match(B297_SERVICE_SHA256,/^[a-f0-9]{64}$/);
});
test('B297 identical captured contents yield deterministic ledger digest',async()=>{
 const a=await capture(),b=await capture();
 assert.equal(a.finalEntrySha256,b.finalEntrySha256);
});
test('B297 every mutated entry or reordered event fails closed',async()=>{
 const a=await capture();
 assert.throws(()=>verifyB297CaptureChain({...a,
  entries:a.entries.map((e,i)=>i===1?{...e,suggestedSide:e.suggestedSide==='buy'?'sell':'buy'}:e)}),/B297_AUDIT_CHAIN_TAMPERED/);
 assert.throws(()=>verifyB297CaptureChain({...a,
  entries:[a.entries[1],a.entries[0],...a.entries.slice(2)]}),/B297_AUDIT_CHAIN_TAMPERED/);
 assert.throws(()=>verifyB297CaptureChain({...a,ordersSent:1}),/B297_INVALID_AUDIT_CHAIN/);
 assert.throws(()=>verifyB297CaptureChain({...a,counts:{...a.counts,manual:999}}),/B297_AUDIT_CHAIN_TAMPERED/);
});
test('B297 no market mode, foreign fields, duplicate IDs or missing modes allowed',async()=>{
 for(const bad of [
  [...scenarios,{...scenarios[0],id:scenarios[0].id}],
  scenarios.map((x,i)=>i===0?{...x,execute:true}:x),
  scenarios.filter(x=>x.mode!=='reverse'),
  scenarios.map((x,i)=>i===0?{...x,horizon:'market'}:x)
 ])await assert.rejects(()=>captureB297OriginalDecisions({analyzeRequest:callback,scenarios:bad,nowMs:T}),/B297_/);
});
test('B297 cannot accept an executor-enabled or forged source response',async()=>{
 for(const payload of [{executionEnabled:true},{simulation:false},{sourceMode:'market'},
  {symbol:'BTC-USD'}, {decision:{action:'reverse_preview',side:'sell',mayClose:true}}]){
  await assert.rejects(()=>captureB297OriginalDecisions({scenarios,nowMs:T,
   analyzeRequest:async ()=>({...await callback({sourceMode:'synthetic',mode:'manual',intent:'buy'},
    {fetcher:async()=>{throw Error('x')},now:T}),...payload})}),/B297_NON_READONLY_OR_INCONSISTENT_ORIGINAL_OUTPUT|x/);
 }
});
const fixtures=[
 {eventId:'e1',referenceId:'r1',action:'open',side:'buy',atMs:T-600,authorization:'LAB_FIXTURE_ONLY'},
 {eventId:'e2',referenceId:'r1',action:'cancel',side:'buy',atMs:T-500,authorization:'LAB_FIXTURE_ONLY'},
 {eventId:'e3',referenceId:'r2',action:'open',side:'sell',atMs:T-400,authorization:'LAB_FIXTURE_ONLY'},
 {eventId:'e4',referenceId:'r2',action:'close',side:'sell',atMs:T-300,authorization:'LAB_FIXTURE_ONLY'}
];
test('B297 reversal buy/sell reference only, cancel/close never create exposure',()=>{
 const x=inspectB297OperatorLifecycle(fixtures,{nowMs:T});
 assert.equal(x.events[0].referenceSide,'sell');
 assert.equal(x.events[2].referenceSide,'buy');
 assert.equal(x.events[1].referenceSide,'buy');
 assert.equal(x.events[3].referenceSide,'sell');
 assert.equal(x.cancelsAndClosesNeverInverted,true);
 assert.equal(x.originalChooseModeUsed,false);
 assert.equal(x.actualPositionReconciled,false);
 assert.equal(x.ordersSent,0);
});
test('B297 megatrend suppresses or redirects reference reversal',()=>{
 const x=inspectB297OperatorLifecycle([
  {...fixtures[0],megaTrendDirection:'buy'},
  {...fixtures[1]}
 ],{nowMs:T});
 assert.equal(x.events[0].referenceSide,'buy');
 assert.equal(x.events[0].referenceDecision,'MEGATREND_FOLLOW');
 const y=inspectB297OperatorLifecycle([
  {...fixtures[0],megaTrendDirection:'sell'},
  {...fixtures[1]}
 ],{nowMs:T});
 assert.equal(y.events[0].referenceSide,'sell');
 assert.equal(y.events[0].referenceDecision,'MEGATREND_VETO_REVERSE');
});
test('B297 lifecycle rejects absent authorization, duplicates, late timestamps and invalid state',()=>{
 const variants=[
  fixtures.map((x,i)=>i===0?{...x,authorization:'BROKER'}:x),
  fixtures.map((x,i)=>i===1?{...x,eventId:'e1'}:x),
  fixtures.map((x,i)=>i===1?{...x,atMs:x.atMs-1000}:x),
  fixtures.map((x,i)=>i===1?{...x,referenceId:'unknown'}:x),
  fixtures.map((x,i)=>i===1?{...x,side:'sell'}:x),
  fixtures.map((x,i)=>i===1?{...x,action:'close'}:x).concat([{...fixtures[1],eventId:'e5',atMs:T-200}])
 ];
 for(const es of variants)assert.throws(()=>inspectB297OperatorLifecycle(es,{nowMs:T}),/B297_/);
});
test('B297 B290 delivery chronology is not provider acknowledgment',()=>{
 const s={mode:'manual',direction:'UP',emittedAtMs:1000,
  targetCandleOpenMs:4000,isOrder:false};
 const x=inspectB297DeclaredSignalTimeline(s,{recordedAtMs:2000,deliveredAtMs:3000});
 assert.equal(x.emittedBeforeTarget,true);
 assert.equal(x.providerDeliveryAcknowledged,false);
 assert.equal(x.confirmedExternalDelivery,false);
 assert.throws(()=>inspectB297DeclaredSignalTimeline(s,
  {recordedAtMs:2000,deliveredAtMs:4000}),/B290_UNVERIFIED_OR_LATE_SIGNAL/);
});
const meta={provider:'alpaca',id:'BTC-USD',marketType:'spot',base:'BTC',quote:'USD',
 settlement:'USD',contractSize:'1',qtyStep:'0.01',minQty:'0.01',maxQty:'2',
 tickSize:'0.01',capturedAtMs:T,sourceSha256:'a'.repeat(64),quantityUnit:'base'};
const order={clientOrderId:'B297-math-1',mode:'direct',side:'buy',quantity:'0.10',
 entry:'100',stop:'95',target:'115'};
const options={now:T,roundTripFeeBps:20,slippageBps:10,fundingCost:'0'};
test('B297 invokes original B152 fixed-point risk arithmetic, not broker transport',()=>{
 const r=inspectB297B152Arithmetic(order,meta,options);
 assert.equal(r.riskCalculationExecuted,true);
 assert.equal(r.orderApprovedForTransmission,false);
 assert.equal(r.ordersSent,0);assert.equal(r.paperOrdersSent,0);
 assert.ok(BigInt(r.riskUnits)>0n);assert.ok(BigInt(r.notionalUnits)>0n);
});
test('B297 B152 rejects unsupported spot shorts, bad stops, step and stale metadata',()=>{
 const variants=[
  [{...order,side:'sell',stop:'105',target:'85'},meta,options],
  [{...order,stop:'105'},meta,options],
  [{...order,quantity:'0.105'},meta,options],
  [order,{...meta,capturedAtMs:T-86400001},options],
  [order,meta,{...options,roundTripFeeBps:1001}]
 ];
 for(const args of variants)assert.throws(()=>inspectB297B152Arithmetic(...args));
});