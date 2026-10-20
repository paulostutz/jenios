import test from 'node:test';import assert from 'node:assert/strict';
import {auditPlatformLaunchTracks} from '../lib/platform/b199-release-readiness-matrix.mjs';
import {PLATFORM_PLAN_PREVIEW} from '../lib/platform/subscription-readiness.mjs';
const nowMs=1792527000000,id='4d238a7a-8c7b-4d8e-9a10-1c5c82db59a7';
const catalog={paymentsEnabled:true,checkoutReady:true,checkoutScope:'platform',catalogStatus:'provider',
 subscriptionLifecycleReady:true,products:PLATFORM_PLAN_PREVIEW.map(p=>({
 ...p,id,category:'platform',configured:true,active:true,currency:'BRL',billing_type:'monthly',price_cents:p.priceCents
 }))};
const subscriptionEvidence={platformOwnerId:id,payerOwnerId:id,link:{serverSigned:true,id,
 platformOwnerId:id,payerOwnerId:id},lifecycle:{activationVerified:true,renewalVerified:true,
 cancellationVerified:true,idempotencyVerified:true,providerReconciliationVerified:true},
 catalog:{source:'provider_confirmed',scope:'platform',pricesVerified:true}};
test('B199 no catalog and unapproved subscription provider are flagged; no invented charges',()=>{
 const report=auditPlatformLaunchTracks({nowMs});
 assert.equal(report.tracks.commercialSubscriptions.planRows.length,3);
 assert.equal(report.tracks.commercialSubscriptions.classification,'NOT_READY_FOR_INDEPENDENT_QA');
 assert.equal(report.paymentsCharged,0);
 assert.equal(report.productionPromotionAuthorized,false);
});
test('B199 claimed perfect provider and subscription evidence still cannot grant checkout or live trading',()=>{
 const report=auditPlatformLaunchTracks({catalog,subscriptionEvidence,
  brokerActivation:{authenticatedAccount:true,code:'READ_ONLY_DEMO_LINKED',environment:'paper'},nowMs});
 assert.equal(report.tracks.commercialSubscriptions.classification,'QA_EVIDENCE_CLAIMED_REQUIRES_INDEPENDENT_PROVIDER_AUDIT');
 assert.equal(report.tracks.commercialSubscriptions.planRows.every(p=>p.checkoutClaimedReady),true);
 assert.equal(report.tracks.customerBrokerPaper.customerReadOnlyDemoClaimed,true);
 assert.equal(report.tracks.customerBrokerPaper.classification,'NO_GO_EXTERNAL_PAPER');
 assert.equal(report.tracks.capitalAtRisk.classification,'NO_GO_LIVE_MONEY');
 assert.equal(report.paymentsCharged,0);
 assert.equal(report.tracks.commercialSubscriptions.subscriptionActivatedByAudit,false);
 assert.equal(report.productionPromotionAuthorized,false);
});
test('B199 mixed/fallback catalog cannot masquerade as true payment readiness',()=>{
 const misleading={...catalog,catalogStatus:'defaults'};
 const r=auditPlatformLaunchTracks({catalog:misleading,subscriptionEvidence,nowMs});
 assert.equal(r.tracks.commercialSubscriptions.planRows.every(x=>x.checkoutClaimedReady===false),true);
 assert.equal(r.tracks.commercialSubscriptions.pending.length>=3,true);
});
test('B199 tampered prospectivity flags and stale/or untrusted client broker status cannot authorize trading',()=>{
 const r=auditPlatformLaunchTracks({catalog,subscriptionEvidence,brokerActivation:{authenticatedAccount:true,
  code:'READ_ONLY_DEMO_LINKED',environment:'live',paperOrdersCertified:true,liveOrdersAllowed:true},
  originalResearch:{robustNetPerformanceDemonstrated:true,prospectiveCertified:true,
   originalCoreSha256:'f'.repeat(64)},nowMs});
 assert.equal(r.tracks.customerBrokerPaper.customerReadOnlyDemoClaimed,false);
 assert.ok(r.tracks.customerBrokerPaper.pending.includes('INDEPENDENT_ORIGINAL_ROBOT_PROSPECTIVE_PERFORMANCE_NOT_PROVEN'));
 assert.equal(r.liveExecutionAuthorized,false);
});
