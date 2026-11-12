import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {inspectR97PrivateHostDeploymentGates,R97_PRIVATE_HOST_REQUIREMENTS} from '../lib/platform/connections/private-host-deployment-gates-r97.mjs';
const env={JENIOS_R94_PRIVATE_WORKER_ENABLED:'false',
 JENIOS_R94_READONLY_ONLY:'true',
 JENIOS_R93_PRIVATE_NODE_WORKER:'false',
 JENIOS_R93_READONLY_RECOVERY_ENABLED:'false',
 JENIOS_REAL_EXECUTION_ENABLED:'false',
 JENIOS_PRIVATE_PAPER_EXECUTOR:'false',
 JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED:'false',
 JENIOS_R80_PRIVATE_ISSUER_ENABLED:'false',
 JENIOS_R82_ALPACA_LIVE_ORDER_EXECUTION_ENABLED:'false',
 JENIOS_R83_PRIVATE_NODE_WORKER:'false',
 JENIOS_PAY_PAYMENTS_ENABLED:'false',
 JENIOS_INTER_CHARGES_ENABLED:'false'};
function fixture(fn){
 const dir=mkdtempSync(join(process.cwd(),'.jenios-r97-'));
 try{const volume=join(dir,'private');mkdirSync(volume,{mode:0o700});return fn(volume);}
 finally{rmSync(dir,{recursive:true,force:true});}
}
test('R97 reports all missing infrastructure evidence and never approves deployment',()=>{
 fixture(volume=>{
  const result=inspectR97PrivateHostDeploymentGates({env,volumePath:volume});
  assert.equal(result.requiredChecks,R97_PRIVATE_HOST_REQUIREMENTS.length);
  assert.equal(result.missing.length,R97_PRIVATE_HOST_REQUIREMENTS.length);
  assert.equal(result.deployAuthorized,false);
  assert.equal(result.ordersSent,0);
  assert.equal(result.liveExecution,false);
 });
});
test('R97 cannot promote self-asserted evidence into a certified host',()=>{
 fixture(volume=>{
  const evidence=Object.fromEntries(R97_PRIVATE_HOST_REQUIREMENTS.map(x=>[x,true]));
  const result=inspectR97PrivateHostDeploymentGates({env,volumePath:volume,evidence});
  assert.equal(result.assertedChecksPassed,R97_PRIVATE_HOST_REQUIREMENTS.length);
  assert.equal(result.missing.length,0);
  assert.equal(result.evidenceIndependentlyVerified,false);
  assert.equal(result.deployAuthorized,false);
  assert.equal(result.hostDeployed,false);
  assert.equal(result.durableStorageCertified,false);
 });
});
test('R97 rejects web/real execution and untrusted evidence objects',()=>{
 fixture(volume=>{
  for(const patch of [
   {JENIOS_REAL_EXECUTION_ENABLED:'true'},
   {JENIOS_PRIVATE_PAPER_EXECUTOR:'true'},
   {JENIOS_R94_PRIVATE_WORKER_ENABLED:'true'}
  ])assert.throws(()=>inspectR97PrivateHostDeploymentGates({
   env:{...env,...patch},volumePath:volume}),/R94_PRIVATE_WORKER_MUST_BE_DISABLED/);
  for(const evidence of [null,[],true,'approved'])
   assert.throws(()=>inspectR97PrivateHostDeploymentGates({
    env,volumePath:volume,evidence}),/R97_EVIDENCE_REQUIRED/);
 });
});
