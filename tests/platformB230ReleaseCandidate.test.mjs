import test from 'node:test';import assert from 'node:assert/strict';
import {evaluateJeniosReleaseCandidate} from '../lib/platform/launch/b230-release-candidate.mjs';
test('B230 even green CI cannot promote unverified billing or trading',()=>{
 const r=evaluateJeniosReleaseCandidate({ciPassed:true,buildPassed:true,browserRegressionPassed:true,
  criticalModulesPreserved:true},{nowMs:1792530000000});
 assert.equal(r.publicInformationTrack,'TECHNICAL_CANDIDATE_REQUIRES_PRODUCT_OWNER_ACCEPTANCE');
 assert.equal(r.productionReleaseAuthorizedByThisAudit,false);
 assert.equal(r.paperTradingTrack,'NO_GO_EXTERNAL_BROKER_PILOT_NOT_AUTHORIZED');
});
test('B230 missing regression results block public candidate',()=>{
 const r=evaluateJeniosReleaseCandidate({ciPassed:true,buildPassed:true},{nowMs:1792530000000});
 assert.equal(r.publicInformationTrack,'NO_GO_TECHNICAL_RELEASE');
});
test('B230 untrusted claimed provider booleans never approve money/charges',()=>{
 const r=evaluateJeniosReleaseCandidate({ciPassed:true,buildPassed:true,browserRegressionPassed:true,
  criticalModulesPreserved:true,paperPilotCertified:true,realMoneyAuthorized:true,
  paymentProviderVerified:true},{nowMs:1792530000000});
 assert.equal(r.externalProviderCertified,false);assert.equal(r.chargesCreated,0);assert.equal(r.realOrdersSent,0);
});
