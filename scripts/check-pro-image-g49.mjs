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
 const r76ManifestPath='docs/release/R76-REVIEWED-CHANGES.json';
 const r77ManifestPath='docs/release/R77-REVIEWED-CHANGES.json';
 const r77Paths=[".github/workflows/jenios-r77-private-paper.yml","docs/release/R77-001-ALPACA-PAPER-PRIVATE-TRANSPORT-20261027.md","lib/platform/connections/alpaca-paper-private-transport-r77.mjs","lib/release/environment-scope.mjs","scripts/check-pro-image-g49.mjs","tests/platformRobotR77AlpacaPrivateTransport.test.mjs"];
 const r76Paths=[".github/workflows/jenios-r76-host-health.yml","app/api/platform/admin/robots/host-health/route.js","app/components/platform/PlatformRobotHostHealth.js","app/platform/admin/robos/page.js","docs/release/R76-001-SAUDE-HOST-R74-20261027.md","lib/platform/research/robot-r76-host-health.mjs","lib/release/environment-scope.mjs","scripts/check-pro-image-g49.mjs","tests/platformRobotR76HostHealth.test.mjs"];
 const r75Paths=[".github/workflows/jenios-r75-panel-recovery.yml","app/api/platform/admin/robots/status/route.js","app/api/platform/internal/robots/deployment-status/route.js","app/components/platform/PlatformRobotDefinitiveAdmin.js","app/platform/admin/page.js","app/platform/admin/robos/page.js","app/platform/entrar/page.js","docs/release/R75-001-BACKUPS-E-ESTADO-REAL-20261026.md","docs/release/R75-002-REGRESSAO-PAINEL-R73-20261026.md","docs/release/R75-003-RECUPERACAO-CI-PREVIEW-20261026.md","lib/platform/research/b290-inversion-signal-contract.mjs","lib/platform/research/b297-private-readonly-audit.mjs","lib/platform/research/robot-r47-marketdata-freshness-fence.mjs","lib/platform/research/robot-r61-qa-access.mjs","lib/platform/research/robot-r63-admin-report.mjs","lib/platform/research/robot-r63-continuous-evolution.mjs","lib/platform/research/robot-r63-generative-analyst.mjs","lib/platform/research/robot-r63-observation-study.mjs","lib/platform/research/robot-r64-access.mjs","lib/platform/research/robot-r64-telemetry.mjs","lib/platform/research/robot-r65-cycle-access.mjs","lib/platform/research/robot-r67-access.mjs","lib/platform/research/robot-r67-private-protocol.mjs","lib/platform/research/robot-r71-access.mjs","lib/platform/research/robot-r73-definitive-status.mjs","lib/release/environment-scope.mjs","scripts/check-pro-image-g49.mjs","tests/platformRobotR73DefinitiveStatus.test.mjs","tests/platformRobotR75PreviewScope.test.mjs","tests/platformRobotR75Restoration.test.mjs"];
 const r75=existsSync(r75ManifestPath)?JSON.parse(readFileSync(r75ManifestPath)):null;
 if(r75){
  assert.equal(r75.schema,'JENIOS_R75_APPROVED_RECOVERY_BLOBS_V1');
  assert.equal(r75.baseCommit,'2ee913339d01c7c20e4d837867f10d3258bc8dcc');
  assert.deepEqual(Object.keys(r75.reviewedBlobs||{}).sort(),r75Paths.slice().sort());
  assert.ok(Object.values(r75.reviewedBlobs).every(hash=>typeof hash==='string'&&/^[a-f0-9]{40}$/.test(hash)));
 }
 const r76=existsSync(r76ManifestPath)?JSON.parse(readFileSync(r76ManifestPath)):null;
 if(r76){
  assert.equal(r76.schema,'JENIOS_R76_APPROVED_HOST_HEALTH_BLOBS_V1');
  assert.equal(r76.baseCommit,'05f622b249c0d41814a0af47a9fff050005293d8');
  assert.deepEqual(Object.keys(r76.reviewedBlobs||{}).sort(),r76Paths.slice().sort());
  assert.ok(Object.values(r76.reviewedBlobs).every(hash=>typeof hash==='string'&&/^[a-f0-9]{40}$/.test(hash)));
 }
 const r77=existsSync(r77ManifestPath)?JSON.parse(readFileSync(r77ManifestPath)):null;
 if(r77){
  assert.equal(r77.schema,'JENIOS_R77_PRIVATE_PAPER_SOURCE_V1');
  assert.equal(r77.baseCommit,'7ef18860276e220041c89b7a6094eeae6c856e72');
  assert.deepEqual(Object.keys(r77.reviewedBlobs||{}).sort(),r77Paths.slice().sort());
  assert.ok(Object.values(r77.reviewedBlobs).every(hash=>typeof hash==='string'&&/^[a-f0-9]{40}$/.test(hash)));
 }
 const blob=body=>createHash('sha1').update(Buffer.from('blob '+body.byteLength+'\0')).update(body).digest('hex');
 for(const [path,expected] of Object.entries({...base.blobs,...review.reviewedBlobs,...(r75?.reviewedBlobs||{}),...(r76?.reviewedBlobs||{}),...(r77?.reviewedBlobs||{})}))assert.equal(blob(readFileSync(path)),expected,'Unreviewed G49/R75 change: '+path);
 const tracked=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
 assert.deepEqual(tracked.sort(),[...new Set([...Object.keys(base.blobs),...allowed,'docs/assistant/G49-REVIEWED-CHANGES.json',...(r75?[...r75Paths,r75ManifestPath]:[]),...(r76?[...r76Paths,r76ManifestPath]:[]),...(r77?[...r77Paths,r77ManifestPath]:[])])].sort());
 console.log('G49_IMAGE_SOURCE_PASS: '+Object.keys(base.blobs).length+' inherited files, '+allowed.size+' reviewed changes.');
}
if(process.argv[1]?.endsWith('/check-pro-image-g49.mjs'))verifyProImageG49();
