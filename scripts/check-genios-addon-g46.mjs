/** Exact integrated source, including all historical release guards. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
export function verifyGeniosAddonG46(){
 const raw=readFileSync('docs/assistant/G46-INTEGRATION-BASELINE.json');
 assert.equal(createHash('sha256').update(raw).digest('hex'),'138051633a432c275b3a9bfc44779ab9deb0a165474f63c81efeed038b0643eb');
 const base=JSON.parse(raw),review=JSON.parse(readFileSync('docs/assistant/G46-REVIEWED-CHANGES.json','utf8'));
 assert.equal(base.baseCommit,'e3411c4e2843eabe871b2196b4e2398d6c262aea');assert.equal(review.baseCommit,base.baseCommit);
 const allowed=new Set([".github/workflows/jenios-genios-addon-g46.yml", "app/genios-pro/ProCredits.js", "app/genios-pro/credits-client.mjs", "docs/assistant/G46-CHECKPOINT.md", "docs/assistant/G46-INTEGRATION-BASELINE.json", "lib/assistant/pro-addon-catalog.mjs", "lib/assistant/pro-topups.mjs", "lib/assistant/pro-wallet-contract.mjs", "scripts/check-email-release-r42.mjs", "scripts/check-genios-activation-g44.mjs", "scripts/check-genios-addon-g46.mjs", "scripts/test-genios-addon-g46-postgres.mjs", "supabase/migrations/20261025000128_jenios_pro_addon_catalog_g46.sql", "tests/jeniosGeniosAddonG46.test.mjs", "tests/jeniosGeniosQuotaG45.test.mjs", "tests/jeniosProTopupsB146.test.mjs"]);
 assert.deepEqual(Object.keys(review.reviewedBlobs).sort(),[...allowed].sort());
 const blob=body=>createHash('sha1').update(Buffer.from('blob '+body.byteLength+'\0')).update(body).digest('hex');
 for(const [path,expected] of Object.entries({...base.blobs,...review.reviewedBlobs}))assert.equal(blob(readFileSync(path)),expected,'Unreviewed G46 change: '+path);
 const files=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
 assert.deepEqual(files.sort(),[...new Set([...Object.keys(base.blobs),...allowed,'docs/assistant/G46-REVIEWED-CHANGES.json'])].sort());
 console.log('G46_INTEGRATED_SOURCE_PASS: '+Object.keys(base.blobs).length+' inherited files, '+allowed.size+' reviewed changes; historical manifests preserved.');
}
if(process.argv[1]?.endsWith('/check-genios-addon-g46.mjs'))verifyGeniosAddonG46();
