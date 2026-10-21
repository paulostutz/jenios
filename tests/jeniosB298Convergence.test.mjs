import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {assessB295PrivateRunnerProof,B295_REQUIRED} from '../lib/platform/research/b295-private-runner-attestation.mjs';
import {checkS05DeploymentScope} from '../lib/release/environment-scope.mjs';
const m=JSON.parse(readFileSync(new URL('../docs/platform/B298-INTEGRATION-MANIFEST.json',import.meta.url)));
test('B298 41 original research blobs retained bit-for-bit',()=>{
 assert.equal(m.files.length,41);
 assert.equal(new Set(m.files.map(x=>x.path)).size,33);
 for(const {path,gitBlobSha} of m.files){
  const bytes=readFileSync(new URL('../'+path,import.meta.url));
  const result=createHash('sha1').update('blob '+bytes.length+String.fromCharCode(0)).update(bytes).digest('hex');
  assert.equal(result,gitBlobSha,path);
 }
 assert.equal(m.proprietaryEngineInGit,false);
});
test('B298 independently witnessed external proofs remain REQUIRED',()=>{
 const r=assessB295PrivateRunnerProof({});
 assert.equal(r.noGoForFunctionalCertification,true);
 assert.equal(r.functionalThreeModesCertified,false);
 assert.ok(B295_REQUIRED.includes('operatorFeedConsentVerified'));
 assert.ok(B295_REQUIRED.includes('deliveryAcknowledged'));
});
test('B298 private branch cannot automatically deploy or promote',()=>{
 const v=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url)));
 assert.equal(v.git.deploymentEnabled['fix/jenios-b298-integrated-release-reconciliation-20261021'],false);
 assert.ok(v.ignoreCommand.includes('fix/jenios-b298-integrated-release-reconciliation-20261021'));
 assert.equal(checkS05DeploymentScope({VERCEL_ENV:'production',VERCEL_GIT_COMMIT_REF:'fix/jenios-b298-integrated-release-reconciliation-20261021',NEXT_PUBLIC_SUPABASE_URL:'https://rebzztxlzofxpfwjvbee.supabase.co'}).ok,false);
});
test('B298 financial, session, learning and preview guards preserved',()=>{
 for(const path of ['tests/jeniosB293QaAuthBoundaries.test.mjs','tests/jeniosB292QaStrictAccessPropagation.test.mjs','tests/jeniosB291QaIntegratedPreview.test.mjs','lib/pay/catalog.mjs','lib/assistant/verified-subscription-b290.mjs','supabase/qa/jenios_b291qa_university_inactive.sql']){
  assert.ok(readFileSync(new URL('../'+path,import.meta.url)).length>100,path);
 }
 assert.equal(m.externalBrokerExecutionAuthorized,false);
});

test('B298 consolidated signed evidence and consent journal remain local-only',()=>{
 const names=m.files.map(x=>x.path);
 for(const path of ['lib/platform/research/b298-signed-evidence-audit.mjs','lib/platform/research/b299-private-consent-replay-journal.mjs','tests/platformB298SignedEvidenceAudit.test.mjs','tests/platformB299PrivateConsentReplayJournal.test.mjs'])assert.ok(names.includes(path));
 for(const module of ['lib/platform/research/b298-signed-evidence-audit.mjs','lib/platform/research/b299-private-consent-replay-journal.mjs']){
  const s=readFileSync(new URL('../'+module,import.meta.url),'utf8');
  assert.doesNotMatch(s,/\bsubmitOrder\s*\(/);
 }
 assert.equal(m.productionReleaseAuthorized,false);
});
