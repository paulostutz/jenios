/** Integrates the two already published releases. Every file in the G44
 * production tree is exact-pinned; R44 exceptions are exact blobs, not skips.
 * Historical R42/R43/G43/G44 manifests stay unchanged for audit/rollback. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
export function verifyIntegratedR44(){
 const raw=readFileSync('docs/platform/R44-INTEGRATED-PRODUCTION-BASELINE.json');
 assert.equal(createHash('sha256').update(raw).digest('hex'),'33a1fddba415a6f651bb9ffc1e49a6ee743bdffba68e69fda23786110590e6ee','Published G44 tree manifest changed');
 const baseline=JSON.parse(raw),review=JSON.parse(readFileSync('docs/platform/R44-CLIENT-EXPERIENCE-BASELINE.json','utf8'));
 assert.equal(baseline.commit,'9eb3a528120149abe2e09acc6f2d5c740c2f451d');
 assert.equal(review.baseCommit,'43283a1833e8c9527f452a29fa5912b910ed5a00');
 assert.equal(review.integratedBaseCommit,baseline.commit);
 assert.equal(Object.keys(baseline.blobs).length,1008);
 for(const path of Object.keys(review.reviewedBlobs)){
  assert.ok(!/^(?:supabase\/|lib\/(?:email\/|jenios-pay|subscriptions|inter|brokers\/)|app\/api\/(?:email|webhooks|jenios-pay|payments|inter))/.test(path),'R44 must preserve the financial/email/database engines: '+path);
 }
 const blob=body=>createHash('sha1').update(Buffer.from('blob '+body.byteLength+'\0')).update(body).digest('hex');
 for(const [path,expected] of Object.entries({...baseline.blobs,...review.reviewedBlobs}))
  assert.equal(blob(readFileSync(path)),expected,'File changed outside exact reviewed R44/G44 integration: '+path);
 console.log('R44_G44_INTEGRATED_BASELINE_PASS='+Object.keys(baseline.blobs).length+' published files; '+Object.keys(review.reviewedBlobs).length+' exact reviewed client/commercial changes; email, payments, brokers and migrations preserved.');
}
