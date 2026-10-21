import test from 'node:test';import assert from 'node:assert/strict';
import {finalizeInternalReleaseReview} from '../lib/platform/release260/b259-final-release-committee.mjs';
const sha='b'.repeat(40),now=1792573000000;
test('B259 four tracks remain separated after all internal claims appear ready',()=>{
 const v=finalizeInternalReleaseReview({commit:sha,nowMs:now,
  ciEvidence:{expectedSha:sha,checksReportedPassing:true},
  previewEvidence:{expectedRoutesVerifiedLocally:true,adminReadOnlyRouteFailClosed:true},
  commercialEvidence:{ownerAndPlanConsistent:true,chargesCreated:0},
  brokerEvidence:{recentReadConfirmed:true,permittedToTrade:false},
  prospectiveEvidence:{signatureCryptographicallyValid:true}});
 assert.equal(v.publicInformation.status,'PRODUCT_OWNER_REVIEW_REQUIRED');
 assert.equal(v.paperBrokerConnections.status,'EXTERNAL_ACCOUNT_AND_WORKER_REQUIRED');
 assert.equal(v.commercialSubscriptions.realChargesCreated,0);
 assert.equal(v.automatedRobots.status,'NO_GO_LIVE_TRADING');
 assert.equal(v.releasePromotionApproved,false);
});
test('B259 missing CI or mismatched SHA fails technical track without changing others',()=>{
 const a=finalizeInternalReleaseReview({commit:sha,nowMs:now,ciEvidence:{expectedSha:'a'.repeat(40),checksReportedPassing:true}});
 assert.equal(a.publicInformation.status,'TECHNICAL_NO_GO');assert.equal(a.ordersSubmitted,0);
});
test('B259 impossible commit rejected before composing report',()=>{
 assert.throws(()=>finalizeInternalReleaseReview({commit:'bad',nowMs:now}),/INVALID_RELEASE_COMMIT/);
});
