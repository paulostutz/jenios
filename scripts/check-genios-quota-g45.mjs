/** G45 integrated certification: preserve PR5, PR6, University and the exact hosted release gate. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';

export function verifyGeniosQuotaG45(){
  const baselineRaw=readFileSync('docs/assistant/G45-INTEGRATION-BASELINE.json');
  assert.equal(
    createHash('sha256').update(baselineRaw).digest('hex'),
    '2692a5cc04302a796d68a0c3958e287d142887aaa9b66b697a2a7a6d540ff89e',
    'G45 integration baseline changed'
  );

  const base=JSON.parse(baselineRaw);
  const review=JSON.parse(readFileSync('docs/assistant/G45-REVIEWED-CHANGES.json','utf8'));
  assert.equal(base.baseCommit,'dd2e6ce9d2beeea64bc63e42557da8357f0cce94');
  assert.equal(review.baseCommit,base.baseCommit);
  assert.equal(review.integrationBaseCommit,'8d4936e0b02c39bb217ad542d01d330dc6cb71d6');
  assert.equal(review.g45SourceCommit,'a82dca08e7847eabe3fb31f79a39de93c4c80a00');
  assert.equal(review.paymentGateCommit,'42fcda845fcba17bbe27175749eae8251f54925c');
  assert.equal(review.universityGuardCommit,'bc0433cd4348490faedb95a59c37e7e750927b42');
  assert.equal(review.hostedReleaseGateBaseCommit,'cbd528d66ae82b19ac3ddf0b0584babb505eede1');
  assert.equal(Object.keys(base.blobs).length,1019);
  assert.equal(Object.keys(review.reviewedBlobs).length,48);
  assert.deepEqual(review.approvedProviderBudgetNanoUsd,{
    'platform-global-crypto':2000000000,
    'platform-internacional-pro':4000000000
  });

  const allowedG45=/^(?:lib\/assistant\/pro-(?:quota-policy|quota-activation|service|topups|access|repository|wallet-contract)\.mjs|app\/api\/assistant\/pro\/credits\/(?:status|quote|checkout)\/route\.js|app\/genios-pro\/(?:page\.js|pro-client\.mjs|credits-client\.mjs|ProCredits\.js|pro\.module\.css|credits\.module\.css)|supabase\/migrations\/\d{14}_jenios_pro_allowances_g45\.sql|tests\/(?:jeniosProAccessB139|jeniosGeniosIntegration|jeniosProTopupsB146|jeniosProEntitlementsB137|[A-Za-z0-9]*G45)\.test\.mjs|tests\/sql\/jenios-[a-z-]*g45\.sql|scripts\/(?:test-genios-quota-g45-postgres|check-genios-quota-g45|check-genios-activation-g44|check-email-release-r42)\.mjs|docs\/assistant\/G45-[A-Z-]+\.(?:md|json)|\.github\/workflows\/jenios-genios-quota-g45\.yml)$/;
  const allowedPr6=new Set([
    'app/api/jenios-pay/health/route.js',
    'docs/platform/R44-PAYMENT-ACTIVATION-BASELINE.json',
    'docs/platform/R44-PAYMENT-ACTIVATION.md',
    'lib/pay/gateway.mjs',
    'lib/pay/inter-pix.mjs',
    'scripts/check-client-experience-r44.mjs',
    'tests/interPix.test.mjs',
    'tests/jeniosBoostB148.test.mjs',
    'tests/payAccess.test.mjs',
    'tests/payCatalog.test.mjs',
    'tests/paymentActivationR44.test.mjs'
  ]);
  const allowedUniversity=new Set([
    'docs/platform/UNIVERSITY-PAYMENT-GUARD-20261024.md',
    'lib/assistant/university-subscription.mjs',
    'tests/jeniosUniversityMonthlyB147.test.mjs'
  ]);
  const allowedHostedReleaseGate=new Set([
    'lib/release/environment-scope.mjs',
    'tests/jeniosGeniosReleaseGateG45.test.mjs'
  ]);

  for(const path of Object.keys(review.reviewedBlobs)){
    assert.ok(
      allowedG45.test(path)||allowedPr6.has(path)||allowedUniversity.has(path)||allowedHostedReleaseGate.has(path),
      'Unapproved G45/PR6/University/hosted-release scope: '+path
    );
  }

  const gitBlob=body=>createHash('sha1').update(Buffer.from('blob '+body.byteLength+'\0')).update(body).digest('hex');
  for(const [path,expected] of Object.entries({...base.blobs,...review.reviewedBlobs})){
    assert.equal(gitBlob(readFileSync(path)),expected,'File changed outside exact reviewed G45 integration scope: '+path);
  }

  const expectedFiles=new Set([
    ...Object.keys(base.blobs),
    ...Object.keys(review.reviewedBlobs),
    'docs/assistant/G45-REVIEWED-CHANGES.json'
  ]);
  const actualFiles=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
  assert.deepEqual([...actualFiles].sort(),[...expectedFiles].sort(),'Repository contains an unreviewed added, removed or renamed file');

  console.log(
    'G45_INTEGRATED_BASELINE_PASS='+Object.keys(base.blobs).length+
    ' PR5 files; '+Object.keys(review.reviewedBlobs).length+
    ' exact G45+PR6+University+hosted-release changes; payment and generation gates preserved.'
  );
}

if(process.argv[1]?.endsWith('/check-genios-quota-g45.mjs')) verifyGeniosQuotaG45();
