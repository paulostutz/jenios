/** Exact G48+M02 baseline plus the explicitly reviewed image-only changes. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync,existsSync} from 'node:fs';
export function verifyProImageG49(){
 const raw=readFileSync('docs/assistant/G49-INTEGRATION-BASELINE.json');
 assert.equal(createHash('sha256').update(raw).digest('hex'),'df3678a81e40678ccf30bbe33cf9c7c30ed112dfae4614aacedd3aed47201da8');
 const base=JSON.parse(raw),review=JSON.parse(readFileSync('docs/assistant/G49-REVIEWED-CHANGES.json'));
 assert.equal(base.baseCommit,'319ce764682e388772989657eb33f4ae102ee304');assert.equal(review.baseCommit,base.baseCommit);
 const allowed=new Set(['.github/workflows/jenios-pro-image-g49.yml','app/genios-pro/page.js','app/genios-pro/pro-client.mjs','docs/assistant/G49-CHECKPOINT.md','docs/assistant/G49-INTEGRATION-BASELINE.json','lib/assistant/pro-input.mjs','lib/assistant/pro-pricing.mjs','lib/assistant/pro-provider.mjs','lib/assistant/pro-service.mjs','scripts/check-inter-vault-g48.mjs','scripts/check-mobile-m02.mjs','scripts/check-pro-image-g49.mjs','scripts/pro-image-g49-harness.mjs','scripts/verify-pro-image-g49.mjs','tests/fixtures/g49/chart.png','tests/fixtures/g49/not-a-chart.png','tests/jeniosProImageG49.test.mjs','tests/jeniosProLifecycleB144.test.mjs','tests/jeniosProPricingB135.test.mjs']);
 assert.deepEqual(Object.keys(review.reviewedBlobs).sort(),[...allowed].sort());
 const r75ManifestPath='docs/release/R75-REVIEWED-CHANGES.json';
 const r75Paths=[".github/workflows/jenios-r75-panel-recovery.yml","app/api/platform/admin/robots/status/route.js","app/api/platform/internal/robots/deployment-status/route.js","app/components/platform/PlatformRobotDefinitiveAdmin.js","app/platform/admin/page.js","app/platform/admin/robos/page.js","app/platform/entrar/page.js","docs/release/R75-001-BACKUPS-E-ESTADO-REAL-20261026.md","docs/release/R75-002-REGRESSAO-PAINEL-R73-20261026.md","docs/release/R75-003-RECUPERACAO-CI-PREVIEW-20261026.md","lib/platform/research/b290-inversion-signal-contract.mjs","lib/platform/research/b297-private-readonly-audit.mjs","lib/platform/research/robot-r47-marketdata-freshness-fence.mjs","lib/platform/research/robot-r61-qa-access.mjs","lib/platform/research/robot-r63-admin-report.mjs","lib/platform/research/robot-r63-continuous-evolution.mjs","lib/platform/research/robot-r63-generative-analyst.mjs","lib/platform/research/robot-r63-observation-study.mjs","lib/platform/research/robot-r64-access.mjs","lib/platform/research/robot-r64-telemetry.mjs","lib/platform/research/robot-r65-cycle-access.mjs","lib/platform/research/robot-r67-access.mjs","lib/platform/research/robot-r67-private-protocol.mjs","lib/platform/research/robot-r71-access.mjs","lib/platform/research/robot-r73-definitive-status.mjs","lib/release/environment-scope.mjs","scripts/check-pro-image-g49.mjs","tests/platformRobotR73DefinitiveStatus.test.mjs","tests/platformRobotR75PreviewScope.test.mjs","tests/platformRobotR75Restoration.test.mjs"];
 const r75=existsSync(r75ManifestPath)?JSON.parse(readFileSync(r75ManifestPath)):null;
 if(r75){
  assert.equal(r75.schema,'JENIOS_R75_APPROVED_RECOVERY_BLOBS_V1');
  assert.equal(r75.baseCommit,'2ee913339d01c7c20e4d837867f10d3258bc8dcc');
  assert.deepEqual(Object.keys(r75.reviewedBlobs||{}).sort(),r75Paths.slice().sort());
  assert.ok(Object.values(r75.reviewedBlobs).every(hash=>typeof hash==='string'&&/^[a-f0-9]{40}$/.test(hash)));
 }
 const blob=body=>createHash('sha1').update(Buffer.from('blob '+body.byteLength+'\0')).update(body).digest('hex');
 for(const [path,expected] of Object.entries({...base.blobs,...review.reviewedBlobs,...(r75?.reviewedBlobs||{})}))assert.equal(blob(readFileSync(path)),expected,'Unreviewed G49/R75 change: '+path);
 const tracked=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
 assert.deepEqual(tracked.sort(),[...new Set([...Object.keys(base.blobs),...allowed,'docs/assistant/G49-REVIEWED-CHANGES.json',...(r75?[...r75Paths,r75ManifestPath]:[])])].sort());
 console.log('G49_IMAGE_SOURCE_PASS: '+Object.keys(base.blobs).length+' inherited files, '+allowed.size+' reviewed changes.');
}
if(process.argv[1]?.endsWith('/check-pro-image-g49.mjs'))verifyProImageG49();
