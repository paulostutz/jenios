import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {assessPublicCandidate} from '../lib/platform/release250/b231-public-release-gate.mjs';
import {inspectReleaseRouteBoundaries} from '../lib/platform/release250/b233-public-route-guard.mjs';
const e={ciPassed:true,buildPassed:true,browserRegressionPassed:true,criticalModulesPreserved:true};
test('B231 all checks passed is still product owner review, not a production release',()=>{
 const v=assessPublicCandidate(e,{nowMs:1792540000000});assert.equal(v.technicalChecksClaimedPassed,true);
 assert.equal(v.productOwnerAccepted,false);assert.equal(v.deploymentPromoted,false);assert.equal(v.chargesCreated,0);
});
test('B231 missing browser regression blocks even technical candidate',()=>{
 const v=assessPublicCandidate({...e,browserRegressionPassed:false},{nowMs:1792540000000});assert.equal(v.classification,'TECHNICAL_HOLD');
});
test('B231 client forged extra permissions and nonboolean evidence are rejected',()=>{
 assert.throws(()=>assessPublicCandidate({...e,liveTrading:true}),/B231_INVALID_RELEASE_EVIDENCE/);
 assert.throws(()=>assessPublicCandidate({...e,ciPassed:1}),/B231_UNTRUSTED_RELEASE_EVIDENCE/);
});
test('B232/B233 present QA route is explicitly preview only; production cannot expose orders',()=>{
 const root=new URL('..',import.meta.url).pathname;const check=inspectReleaseRouteBoundaries(root);
 assert.equal(check.compliant,true);assert.equal(check.forbiddenRoutesFound.length,0);
});
test('B233 unexpected broker execution endpoint prevents release check',()=>{
 const d=mkdtempSync(join(tmpdir(),'jenios-route-guard-'));
 try{mkdirSync(join(d,'app/platform/homologacao'),{recursive:true});
  writeFileSync(join(d,'app/platform/homologacao/page.js'),"process.env.VERCEL_ENV!=='preview';process.env.JENIOS_QA_CANDIDATE_ENABLED!=='true';notFound()");
  const p=join(d,'app/api/platform/broker-execution');mkdirSync(p,{recursive:true});writeFileSync(join(p,'route.js'),'export const POST = ()=>{};');
  assert.equal(inspectReleaseRouteBoundaries(d).compliant,false);
 }finally{rmSync(d,{recursive:true,force:true});}
});
