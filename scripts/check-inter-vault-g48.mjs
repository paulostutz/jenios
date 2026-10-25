/** G48 exact source, security boundaries and activation-gate verification. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync,existsSync} from 'node:fs';

const read=path=>readFileSync(path,'utf8');
const blob=body=>createHash('sha1').update(Buffer.from(`blob ${body.byteLength}\0`)).update(body).digest('hex');

import {verifyProImageG49} from './check-pro-image-g49.mjs';
export function verifyInterVaultG48(){
 if(existsSync('docs/assistant/G49-REVIEWED-CHANGES.json'))verifyProImageG49();
 else{
 const baselineRaw=readFileSync('docs/platform/G48-INTEGRATION-BASELINE.json');
 assert.equal(createHash('sha256').update(baselineRaw).digest('hex'),'c24d88a6f829585687d06bff5629496c81a468148ab0633c6e6a4decb575de5b');
 const baseline=JSON.parse(baselineRaw),review=JSON.parse(read('docs/platform/G48-REVIEWED-CHANGES.json'));
 assert.equal(baseline.baseCommit,'dec6ae5965b443ed0b8baabf05f750e33b403067');
 assert.equal(baseline.baseTree,'1adba07a869ecd798455bd0805e50a9d5500b58d');
 assert.equal(review.baseCommit,baseline.baseCommit);
 const mobileReview=existsSync('docs/mobile/M02-REVIEWED-CHANGES.json')?JSON.parse(read('docs/mobile/M02-REVIEWED-CHANGES.json')):null;
 if(mobileReview) assert.equal(mobileReview.baseCommit,baseline.baseCommit);
 const allowed=new Set([".github/workflows/jenios-inter-vault-g48.yml", "app/admin/cobrancas/page.js", "app/api/admin/inter/setup/route.js", "app/components/InterAdminPanel.js", "app/components/InterSetupForm.js", "docs/platform/G48-INTEGRATION-BASELINE.json", "docs/platform/G48-INTER-VAULT-CHECKPOINT.md", "lib/assistant/pro-topups.mjs", "lib/assistant/university-subscription.mjs", "lib/pay/gateway.mjs", "lib/pay/inter-material.mjs", "lib/pay/inter-pix.mjs", "lib/pay/inter-vault.mjs", "lib/pay/pix-status.mjs", "lib/platform/monthly-billing.mjs", "scripts/check-inter-vault-g48.mjs", "scripts/test-inter-vault-g48-postgres.mjs", "supabase/migrations/20261025013000_jenios_g48_inter_vault_setup.sql", "tests/interPix.test.mjs", "tests/jeniosGeniosQuotaG45.test.mjs", "tests/jeniosInterSetupG48.test.mjs", "tests/jeniosProTopupsB146.test.mjs", "tests/jeniosUniversityMonthlyB147.test.mjs", "tests/paymentActivationR44.test.mjs", "tests/platformMonthlyG47.test.mjs", "tests/sql/jenios_inter_setup_g48_regression.sql"]);
 assert.deepEqual(Object.keys(review.reviewedBlobs).sort(),[...allowed].sort());
 for(const [path,expected] of Object.entries({...baseline.blobs,...(mobileReview?.reviewedBlobs||{}),...review.reviewedBlobs}))
  assert.equal(blob(readFileSync(path)),expected,'Unreviewed G48 change: '+path);
 const tracked=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
 assert.deepEqual(tracked.sort(),[...new Set([...Object.keys(baseline.blobs),...allowed,'docs/platform/G48-REVIEWED-CHANGES.json',...(mobileReview?[...Object.keys(mobileReview.reviewedBlobs),'docs/mobile/M02-REVIEWED-CHANGES.json']:[])])].sort());

 }
 const migration=read('supabase/migrations/20261025013000_jenios_g48_inter_vault_setup.sql');
 const vault=read('lib/pay/inter-vault.mjs'),inter=read('lib/pay/inter-pix.mjs');
 const gateway=read('lib/pay/gateway.mjs'),route=read('app/api/admin/inter/setup/route.js');
 const monthly=read('lib/platform/monthly-billing.mjs');
 assert.match(migration,/jenios_g48_inter_pix/);
 assert.match(migration,/'schema_version','g48'/);
 assert.match(migration,/revoke all on public\.jenios_inter_settings_b283 from PUBLIC,anon,authenticated/i);
 assert.match(migration,/grant execute on function public\.jenios_inter_load_b283\(\) to service_role/i);
 assert.doesNotMatch(migration,/JENIOS_PAY_PAYMENTS_ENABLED\s*=\s*true|JENIOS_INTER_CHARGES_ENABLED\s*=\s*true/i);
 assert.match(vault,/JENIOS_INTER_VAULT_REQUIRED/);
 assert.match(vault,/jenios_g48_inter_pix/);
 assert.match(inter,/JENIOS_PAY_PAYMENTS_ENABLED==='true'&&env\.JENIOS_INTER_CHARGES_ENABLED==='true'/);
 assert.match(gateway,/resolveJeniosInterRuntimeEnv/);
 assert.match(monthly,/resolveJeniosInterRuntimeEnv/);
 assert.match(route,/requireAdminPermission\(request,db,'finance\.manage'\)/);
 assert.match(route,/assistantSameOrigin\(request\)/);
 assert.match(route,/connectJeniosInter/);
 assert.doesNotMatch(route,/action==='save'/);
 for(const path of ['lib/pay/inter-vault.mjs','app/api/admin/inter/setup/route.js','app/components/InterSetupForm.js']){
  const source=read(path);
  assert.doesNotMatch(source,/-----BEGIN (?:RSA |EC )?PRIVATE KEY-----[A-Za-z0-9+/=]{16}/);
  assert.doesNotMatch(source,/clientSecret\s*:\s*['"][^'"]{16,}['"]/);
 }
 console.log('G48_INTER_VAULT_SOURCE_PASS: exact source and financial safeguards verified.');
}
if(process.argv[1]?.endsWith('/check-inter-vault-g48.mjs'))verifyInterVaultG48();
