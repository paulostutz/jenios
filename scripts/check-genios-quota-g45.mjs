/** G45: exact preservation of the Work R44 + G44 integration, with reviewed
 * changes restricted to approved Pro quotas and paid continuation. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
export function verifyGeniosQuotaG45(){
 const raw=readFileSync('docs/assistant/G45-INTEGRATION-BASELINE.json');
 assert.equal(createHash('sha256').update(raw).digest('hex'),'2692a5cc04302a796d68a0c3958e287d142887aaa9b66b697a2a7a6d540ff89e','G45 integration baseline changed');
 const base=JSON.parse(raw),review=JSON.parse(readFileSync('docs/assistant/G45-REVIEWED-CHANGES.json','utf8'));
 assert.equal(base.baseCommit,'dd2e6ce9d2beeea64bc63e42557da8357f0cce94');
 assert.equal(review.baseCommit,base.baseCommit);
 assert.equal(Object.keys(base.blobs).length,1019);
 assert.deepEqual(review.approvedProviderBudgetNanoUsd,{'platform-global-crypto':2000000000,'platform-internacional-pro':4000000000});
 const allowed=/^(?:lib\/assistant\/pro-(?:quota-policy|quota-activation|service|topups|access|repository|wallet-contract)\.mjs|app\/api\/assistant\/pro\/credits\/(?:status|quote|checkout)\/route\.js|app\/genios-pro\/(?:page\.js|pro-client\.mjs|credits-client\.mjs|ProCredits\.js|pro\.module\.css|credits\.module\.css)|supabase\/migrations\/\d{14}_jenios_pro_allowances_g45\.sql|tests\/(?:jeniosProAccessB139|jeniosGeniosIntegration|jeniosProTopupsB146|jeniosProEntitlementsB137|[A-Za-z0-9]*G45)\.test\.mjs|tests\/sql\/jenios-[a-z-]*g45\.sql|scripts\/(?:test-genios-quota-g45-postgres|check-genios-quota-g45|check-genios-activation-g44|check-email-release-r42)\.mjs|docs\/assistant\/G45-[A-Z-]+\.(?:md|json)|\.github\/workflows\/jenios-genios-quota-g45\.yml)$/;
 for(const path of Object.keys(review.reviewedBlobs)) assert.ok(allowed.test(path),'Unapproved G45 scope: '+path);
 const blob=body=>createHash('sha1').update(Buffer.from('blob '+body.byteLength+'\0')).update(body).digest('hex');
 for(const [path,expected] of Object.entries({...base.blobs,...review.reviewedBlobs})) assert.equal(blob(readFileSync(path)),expected,'File changed outside exact reviewed G45 scope: '+path);
 console.log('G45_QUOTA_BASELINE_PASS='+Object.keys(base.blobs).length+' integrated files; '+Object.keys(review.reviewedBlobs).length+' exact reviewed quota/add-on changes; Work, email and Inter preserved.');
}
if(process.argv[1]?.endsWith('/check-genios-quota-g45.mjs'))verifyGeniosQuotaG45();
