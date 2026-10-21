import test from 'node:test';import assert from 'node:assert/strict';
import {runOfflineBrokerConformance} from '../lib/platform/launch/b222-offline-provider-conformance.mjs';
import {officialBrokerImplementationMatrix} from '../lib/platform/launch/b220-provider-implementation-matrix.mjs';
import {buildLaunchQaPacket} from '../lib/platform/launch/b229-release-package.mjs';
import {evaluateJeniosReleaseCandidate} from '../lib/platform/launch/b230-release-candidate.mjs';
import {assessSyntheticCommerceLifecycle} from '../lib/platform/launch/b228-synthetic-lifecycle.mjs';
const nowMs=1792530000000;
test('B230 integration: twelve guides, two local GET adapters, no broker/Pix activation',async()=>{
 const cases=await Promise.all(['alpaca','binance'].map(provider=>runOfflineBrokerConformance(provider,{nowMs})));
 assert.ok(cases.every(x=>x.realNetworkCalls===0&&x.simulatedGetCalls===3));
 assert.equal(officialBrokerImplementationMatrix().length,12);
 const trial=assessSyntheticCommerceLifecycle([],{nowMs});assert.equal(trial.chargesCreated,0);
 const packet=buildLaunchQaPacket({nowMs});assert.equal(packet.historicalResearch.economicAdvantageCertified,false);
 const candidate=evaluateJeniosReleaseCandidate({ciPassed:true,buildPassed:true,browserRegressionPassed:true,
  criticalModulesPreserved:true},{nowMs});
 assert.equal(candidate.commercialTrack,'NO_GO_PROVIDER_PAYMENT_LIFECYCLE_NOT_VERIFIED');
 assert.equal(candidate.paperTradingTrack,'NO_GO_EXTERNAL_BROKER_PILOT_NOT_AUTHORIZED');
 assert.equal(candidate.productionReleaseAuthorizedByThisAudit,false);
});
