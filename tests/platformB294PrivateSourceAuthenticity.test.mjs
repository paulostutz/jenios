import test from 'node:test';import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {B92_SCHEMA,PINNED_ENGINE_SHA256} from '../lib/platform/private-core-bridge.mjs';
import {inspectB294AuthenticatedPrivateTriplet} from '../lib/platform/research/b294-private-source-authenticity.mjs';
const secret='research_only_example_secret_very_long_no_real_credentials';
const now=1792600000000;
function envelope(mode,side){
 const e={schema:B92_SCHEMA,engineSha256:PINNED_ENGINE_SHA256,mode,
 eventId:mode==='direct'?'11111111-1111-4111-8111-111111111111':
 mode==='hybrid'?'22222222-2222-4222-8222-222222222222':'33333333-3333-4333-8333-333333333333',
 observationSha256:'a'.repeat(64),asset:'BTCUSDT',decisionAtMs:now-1000,side,
 declaredSandbox:true,realExecutionAllowed:false};
 const fields=[e.schema,e.engineSha256,e.mode,e.eventId,e.observationSha256,e.asset,
 e.decisionAtMs,e.side,true,true];
 return {...e,hmacSha256:createHmac('sha256',secret).update(JSON.stringify(fields)).digest('hex')};
}
const rows=()=>[envelope('direct','buy'),envelope('reverse','sell'),envelope('hybrid',null)];
test('B294 authenticates three private-runner envelopes but does not claim runtime proof',()=>{
 const x=inspectB294AuthenticatedPrivateTriplet(rows(),{secret,now});
 assert.equal(x.authenticatedMessages,true);assert.equal(x.privateRuntimeLoaded,false);
 assert.equal(x.executableBytesAttested,false);assert.equal(x.ordersSent,0);
 assert.equal(x.modeSides.reverse,'sell');
});
test('B294 rejects tampered HMAC',()=>{
 const x=rows();x[1]={...x[1],side:'buy'};
 assert.throws(()=>inspectB294AuthenticatedPrivateTriplet(x,{secret,now}),/B294_AUTHENTICATION_FAILED/);
});
test('B294 rejects wrong shared candle and missing mode',()=>{
 const x=rows();x[1]=envelope('reverse','sell');x[1].observationSha256='b'.repeat(64);
 const e=x[1],fields=[e.schema,e.engineSha256,e.mode,e.eventId,e.observationSha256,e.asset,
 e.decisionAtMs,e.side,true,true];
 x[1].hmacSha256=createHmac('sha256',secret).update(JSON.stringify(fields)).digest('hex');
 assert.throws(()=>inspectB294AuthenticatedPrivateTriplet(x,{secret,now}),/B294_UNMATCHED_PRIVATE_CONTEXT/);
 assert.throws(()=>inspectB294AuthenticatedPrivateTriplet(rows().slice(0,2),{secret,now}),/B294_THREE_ENVELOPES_REQUIRED/);
});
