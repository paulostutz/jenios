import test from 'node:test';import assert from 'node:assert/strict';
import {B295_REQUIRED,assessB295PrivateRunnerProof} from '../lib/platform/research/b295-private-runner-attestation.mjs';
test('B295 no evidence never certifies genuine robots',()=>{
 const x=assessB295PrivateRunnerProof({});
 assert.equal(x.noGoForFunctionalCertification,true);
 assert.equal(x.functionalThreeModesCertified,false);
 assert.equal(x.missing.length,B295_REQUIRED.length);
 assert.equal(x.brokerOrdersSent,0);
});
test('B295 each missing evidence item fails closed',()=>{
 const all=Object.fromEntries(B295_REQUIRED.map(x=>[x,true]));
 for(const key of B295_REQUIRED){
  const x=assessB295PrivateRunnerProof({...all,[key]:false});
  assert.equal(x.noGoForFunctionalCertification,true);
  assert.ok(x.missing.includes(key));
 }
});
test('B295 checklist completion does not imply runtime invocation by module',()=>{
 const all=Object.fromEntries(B295_REQUIRED.map(x=>[x,true]));
 const x=assessB295PrivateRunnerProof(all);
 assert.equal(x.evidenceAccepted,true);
 assert.equal(x.privateCoreExecutedByThisModule,false);
 assert.equal(x.noAutomaticDeployment,true);
});
