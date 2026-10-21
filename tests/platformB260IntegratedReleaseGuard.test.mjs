import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {finalizeInternalReleaseReview} from '../lib/platform/release260/b259-final-release-committee.mjs';
import {auditCustomerBrokerReadOnly} from '../lib/platform/release260/b256-customer-broker-audit.mjs';
import {OfflinePaymentReplayJournal} from '../lib/platform/release260/b255-idempotency-sandbox.mjs';
import {privateReadinessHttp} from '../lib/platform/release260/b252-private-review-http.mjs';
const now=1792573000000,sha='f'.repeat(40);
test('B260 end-to-end review cannot advance financial or automated trading tracks',()=>{
 const broker=auditCustomerBrokerReadOnly({verifiedUserId:'not-registered',connection:null,nowMs:now});
 const payment=new OfflinePaymentReplayJournal();
 const r=finalizeInternalReleaseReview({commit:sha,nowMs:now,
  ciEvidence:{expectedSha:sha,checksReportedPassing:true},
  previewEvidence:{expectedRoutesVerifiedLocally:true,adminReadOnlyRouteFailClosed:true},
  commercialEvidence:{ownerAndPlanConsistent:true,chargesCreated:payment.summary().chargesCreated},brokerEvidence:broker});
 assert.equal(r.publicInformation.status,'PRODUCT_OWNER_REVIEW_REQUIRED');
 assert.equal(r.commercialSubscriptions.status,'EXTERNAL_GATEWAY_QA_REQUIRED');
 assert.equal(r.paperBrokerConnections.status,'EXTERNAL_ACCOUNT_AND_WORKER_REQUIRED');
 assert.equal(r.automatedRobots.status,'NO_GO_LIVE_TRADING');
 assert.equal(r.releasePromotionApproved,false);
});
test('B260 production endpoint denies even authorized admin, independent of underlying DB',async()=>{
 let sideEffects=0;
 const result=await privateReadinessHttp(new Request('https://jenios.com.br/api/platform/homologacao/readiness'),{
   env:{VERCEL_ENV:'production',JENIOS_QA_CANDIDATE_ENABLED:'true',JENIOS_QA_ADMIN_READONLY_ENABLED:'true'},
   createDb:()=>{sideEffects++;return {};},authorize:async()=>{sideEffects++;return {};}});
 assert.equal(result.status,404);assert.equal(sideEffects,0);
});
test('B260 new QA and CI files contain no live broker order POST or gateway calls',()=>{
 const workflow=readFileSync(new URL('../.github/workflows/jenios-b260-private-launch-acceptance.yml',import.meta.url),'utf8');
 assert.match(workflow,/JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED: 'false'/);
 assert.match(workflow,/JENIOS_REAL_EXECUTION_ENABLED: 'false'/);
 assert.match(workflow,/JENIOS_QA_ADMIN_READONLY_ENABLED: 'false'/);
 const endpoint=readFileSync(new URL('../app/api/platform/homologacao/readiness/route.js',import.meta.url),'utf8');
 assert.doesNotMatch(endpoint,/export async function POST|createGatewayCheckout|submitNativeBrokerOrder/);
});
