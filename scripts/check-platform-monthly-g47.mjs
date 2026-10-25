/** G47 exact source verification; historical release manifests are preserved. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
export function verifyPlatformMonthlyG47(){
 const raw=readFileSync('docs/platform/G47-INTEGRATION-BASELINE.json');
 assert.equal(createHash('sha256').update(raw).digest('hex'),"a9b3edf0876641a1d9a432009a26ac862fd90641b8adca0402a82156c434de9d");
 const base=JSON.parse(raw),review=JSON.parse(readFileSync('docs/platform/G47-REVIEWED-CHANGES.json','utf8'));
 assert.equal(base.baseCommit,"9c8493ebbdb99002271ae6292d475facfa1ad4bf");assert.equal(review.baseCommit,base.baseCommit);
 const allowed=new Set([".github/workflows/jenios-genios-addon-g46.yml", ".github/workflows/jenios-platform-monthly-g47.yml", "app/api/platform/subscription/[action]/route.js", "app/checkout/MonthlyPix.js", "app/checkout/page.js", "app/components/platform/PlatformBillingStatus.js", "app/dashboard-logado/page.js", "docs/platform/G47-CHECKPOINT.md", "docs/platform/G47-INTEGRATION-BASELINE.json", "lib/email/subscription-dunning.mjs", "lib/email/transactional-delivery-worker.mjs", "lib/pay/pix-status.mjs", "lib/platform/monthly-billing-contract.mjs", "lib/platform/monthly-billing.mjs", "lib/release/environment-scope.mjs", "scripts/check-email-release-r42.mjs", "scripts/check-genios-activation-g44.mjs", "scripts/check-platform-monthly-g47.mjs", "scripts/test-platform-monthly-g47-postgres.mjs", "supabase/migrations/20261025003623_jenios_platform_monthly_pix_g47.sql", "tests/platformMonthlyG47.test.mjs", "tests/platformR35PublicCheckoutSafety.test.mjs"]);
 assert.deepEqual(Object.keys(review.reviewedBlobs).sort(),[...allowed].sort());
 const blob=body=>createHash('sha1').update(Buffer.from('blob '+body.byteLength+'\0')).update(body).digest('hex');
 for(const [path,expected] of Object.entries({...base.blobs,...review.reviewedBlobs}))assert.equal(blob(readFileSync(path)),expected,'Unreviewed G47 change: '+path);
 const files=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
 assert.deepEqual(files.sort(),[...new Set([...Object.keys(base.blobs),...allowed,'docs/platform/G47-REVIEWED-CHANGES.json'])].sort());
 console.log('G47_INTEGRATED_SOURCE_PASS: '+Object.keys(base.blobs).length+' inherited files, '+allowed.size+' reviewed changes.');
}
if(process.argv[1]?.endsWith('/check-platform-monthly-g47.mjs'))verifyPlatformMonthlyG47();
