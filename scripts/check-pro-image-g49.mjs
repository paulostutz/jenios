/** Exact G48+M02 baseline plus the explicitly reviewed image-only changes. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
export function verifyProImageG49(){
 const raw=readFileSync('docs/assistant/G49-INTEGRATION-BASELINE.json');
 assert.equal(createHash('sha256').update(raw).digest('hex'),'df3678a81e40678ccf30bbe33cf9c7c30ed112dfae4614aacedd3aed47201da8');
 const base=JSON.parse(raw),review=JSON.parse(readFileSync('docs/assistant/G49-REVIEWED-CHANGES.json'));
 assert.equal(base.baseCommit,'319ce764682e388772989657eb33f4ae102ee304');assert.equal(review.baseCommit,base.baseCommit);
 const allowed=new Set(['.github/workflows/jenios-pro-image-g49.yml','app/genios-pro/page.js','app/genios-pro/pro-client.mjs','docs/assistant/G49-CHECKPOINT.md','docs/assistant/G49-INTEGRATION-BASELINE.json','lib/assistant/pro-input.mjs','lib/assistant/pro-pricing.mjs','lib/assistant/pro-provider.mjs','lib/assistant/pro-service.mjs','scripts/check-inter-vault-g48.mjs','scripts/check-mobile-m02.mjs','scripts/check-pro-image-g49.mjs','scripts/pro-image-g49-harness.mjs','scripts/verify-pro-image-g49.mjs','tests/fixtures/g49/chart.png','tests/fixtures/g49/not-a-chart.png','tests/jeniosProImageG49.test.mjs','tests/jeniosProLifecycleB144.test.mjs','tests/jeniosProPricingB135.test.mjs']);
 assert.deepEqual(Object.keys(review.reviewedBlobs).sort(),[...allowed].sort());
 const blob=body=>createHash('sha1').update(Buffer.from('blob '+body.byteLength+'\0')).update(body).digest('hex');
 for(const [path,expected] of Object.entries({...base.blobs,...review.reviewedBlobs}))assert.equal(blob(readFileSync(path)),expected,'Unreviewed G49 change: '+path);
 const tracked=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
 assert.deepEqual(tracked.sort(),[...new Set([...Object.keys(base.blobs),...allowed,'docs/assistant/G49-REVIEWED-CHANGES.json'])].sort());
 console.log('G49_IMAGE_SOURCE_PASS: '+Object.keys(base.blobs).length+' inherited files, '+allowed.size+' reviewed changes.');
}
if(process.argv[1]?.endsWith('/check-pro-image-g49.mjs'))verifyProImageG49();
