import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {verifyPrivateModeEnvelope,comparePrivateModeEnvelopes,signFixtureEnvelope,
 B92_SCHEMA,PINNED_ENGINE_SHA256} from '../lib/platform/private-core-bridge.mjs';
const key='B92_test_only_not_a_prod_secret_'.padEnd(40,'!');
const now=Date.parse('2026-10-19T18:00:00Z');
const common={schema:B92_SCHEMA,engineSha256:PINNED_ENGINE_SHA256,
 eventId:'123e4567-e89b-42d3-a456-426614174000',
 observationSha256:'a'.repeat(64),asset:'BTC-USD',decisionAtMs:now,
 side:'buy',declaredSandbox:true,realExecutionAllowed:false};
const verified=(mode,change={})=>verifyPrivateModeEnvelope(signFixtureEnvelope({...common,mode,...change},key),{secret:key,now});
test('B92 private core SHA pinned to locally audited protected source, no code included',()=>{
 assert.equal(PINNED_ENGINE_SHA256,'9341d9243cbe742b90bf40149663e632fc472f5586c74bf70bdfcfd114e65aea');
 const src=readFileSync('lib/platform/private-core-bridge.mjs','utf8');
 assert.doesNotMatch(src,/export function chooseMode|export function scanSignals|from .*nucleo-privado/);
});
test('B92 three authenticated paper envelopes are comparable by prior observation hash',()=>{
 const results=['direct','reverse','hybrid'].map(mode=>verified(mode));
 assert(results.every(z=>z.valid===true));
 const pair=comparePrivateModeEnvelopes(results);
 assert.equal(pair.valid,true);assert.equal(pair.sideByMode.direct,'buy');
 assert.equal(pair.performanceCertified,false);assert.equal(pair.realExecutionAllowed,false);
 assert.equal(pair.privateCoreLoaded,false);
});
test('B92 no key or mismatched MAC fails closed even if public fields look plausible',()=>{
 const e=signFixtureEnvelope({...common,mode:'direct'},key);
 assert.equal(verifyPrivateModeEnvelope(e,{now}).valid,false);
 assert.equal(verifyPrivateModeEnvelope({...e,side:'sell'},{now,secret:key}).valid,false);
 assert.equal(verifyPrivateModeEnvelope({...e,hmacSha256:'f'.repeat(64)},{now,secret:key}).valid,false);
});
test('B92 stale, wrong engine or unauthorized execution claims do not pass',()=>{
 for(const mutation of [{decisionAtMs:now-360000},{engineSha256:'f'.repeat(64)},
  {realExecutionAllowed:true},{declaredSandbox:false},{side:'leverage'}]){
  assert.equal(verified('hybrid',mutation).valid,false);
 }
});
test('B92 mismatched source snapshots cannot pretend fair comparison of three modes',()=>{
 const valid=['direct','reverse','hybrid'].map((mode,i)=>verified(mode,i===2?{observationSha256:'b'.repeat(64)}:{}));
 assert.equal(comparePrivateModeEnvelopes(valid).valid,false);
 assert.equal(comparePrivateModeEnvelopes(valid.slice(0,2)).valid,false);
});
