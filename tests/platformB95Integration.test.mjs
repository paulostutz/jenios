import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assessLaunchReadiness,PLATFORM_LAUNCH_GATES} from '../lib/platform/release-readiness.mjs';
const text=p=>readFileSync(p,'utf8');
test('B95 release readiness never mistakes CI for a commercially certified trading product',()=>{
 const x=assessLaunchReadiness({ci:true,browser:true,criticalApisPreserved:true});
 assert.equal(x.ciVerified,true);assert.equal(x.productReady,false);
 assert.equal(x.commercialCheckoutAuthorized,false);assert.equal(x.realExecutionAuthorized,false);
 assert.equal(PLATFORM_LAUNCH_GATES.length,5);
});
test('B95 even a synthetic all-green readiness matrix never grants any real authorization',()=>{
 const x=assessLaunchReadiness({
  ci:true,browser:true,criticalApisPreserved:true,
  independentTimestampedCaptures:true,privateRuntimeBytesVerified:true,
  providerTermsReviewed:true,prospectivePolicyValidated:true,
  identityLinkVerified:true,subscriptionLifecycleVerified:true
 });
 assert.equal(x.productReady,true);
 assert.equal(x.realExecutionAuthorized,false);assert.equal(x.commercialCheckoutAuthorized,false);
});
test('B95 lab exposes multi-timeframe, rolling stress and prospective uncertainty',()=>{
 const x=text('app/components/platform/PlatformStrategyLab.js');
 for(const marker of ['multiTimeframeStudy','evaluateRollingPaperWindows','auditLocalProspectiveCohort',
  'multiStudy.series.map','rollingEvaluation.modeSummary.map','readSimulatedBalance','assessPaperStrategy'])
  assert.ok(x.includes(marker),marker);
 assert.doesNotMatch(x,/\/api\/platform\/checkout|orderAuthorized:true|brokerConnected:true/);
});
test('B95 admin readiness is gated by dedicated Platform permission, not Social role',()=>{
 const admin=text('app/platform/admin/page.js');
 assert.match(admin,/<PlatformAdminAccess permission="platform.admin">/);
 assert.match(admin,/<PlatformResearchReadiness\/>/);
 const widget=text('app/components/platform/PlatformResearchReadiness.js');
 assert.match(widget,/ainda não foram instalados neste runtime público/);
 assert.match(widget,/PLATFORM_LAUNCH_GATES/);
});
test('B95 existing user area still has independent private auth and billing',()=>{
 const page=text('app/dashboard-logado/page.js');
 assert.match(page,/PlatformBillingStatus/);
 assert.match(page,/PlatformIdentityInspection/);
 const access=text('app/components/platform/PlatformAuthGuard.js');
 assert.match(access,/platformSupabase\.auth\.getUser/);
});
