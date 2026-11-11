/** Exact public guidance release inventory. No runtime capability is changed.
 * The immutable baseline is the reviewed, tested production-base commit.
 * The verifier itself is reviewed as source; baseline, inherited files and tests
 * are pinned independently. Unknown files and inherited edits remain errors.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
const manifestPath='docs/release/R106-PUBLIC-GUIDANCE-BASELINE.json';
const extensionManifestPath='docs/release/R113-ULTRAFAST-SOURCE-EXTENSION.json';
const extensionManifestSha1='668de7824825beb675f69003cac4f34e322a0478';
const flowManifestPath='docs/release/R114-FLOW-SOURCE-EXTENSION.json';
const flowManifestSha1='c7f6c89c825f8c22c9cafeadaebcb8b5910f7f73';
const helperPath='scripts/check-authentication-r106.mjs';
const testPath='tests/platformAuthenticationReleaseR106.test.mjs';
const footerManifestPath='docs/release/KIVORYN-TEXT-FOOTER-20261106.json';
const footerManifestSha1='d7bb9e98eb86677826ea489d8a827ee79edbb192';
const blob=body=>createHash('sha1').update(Buffer.from('blob '+body.byteLength+'\0')).update(body).digest('hex');
export function verifyR106PublicGuidance({read=readFileSync,tracked}={}){
 const raw=read(manifestPath);
 assert.equal(createHash('sha256').update(raw).digest('hex'),'598e79e56d0ac4fccd3140ebbbc4be563240cc4aa5ac1d2d70f95057d2fb85d0','R106 baseline manifest changed');
 const baseline=JSON.parse(raw);
 assert.equal(baseline.schema,'JENIOS_R106_PUBLIC_GUIDANCE_BASELINE_V1');
 assert.equal(baseline.baseCommit,'6c7b4e69d6a82523714c63d1e64ecbcf5ec465cc');
 assert.equal(baseline.previousProductionCommit,'3dec421bfb9ef1e85d0083a55f63223d3491a256');
 const cbRaw=read('docs/release/CB006-LETTER-SOURCE-EXTENSION.json');
 assert.equal(blob(cbRaw),'ab6147dc2a27e4904d15e0384f9734eb722317ff','CB006 manifest changed');
 const cb=JSON.parse(cbRaw);
 assert.equal(cb.schema,'JENIOS_CB006_LETTER_SOURCE_EXTENSION_V1');
 assert.equal(cb.baseCommit,'c9944b88a03f2f572166f686e2ebac8b614dd3ef');
 assert.equal(cb.liveIssuanceAllowed,false);
 const r115Raw=read('docs/release/R115-ULTRA-SOURCE-EXTENSION.json');
 assert.equal(blob(r115Raw),'4d20c5314196cf9e82b35dbfd87e9043c40b6063','R115 manifest changed');
 const r115=JSON.parse(r115Raw);
 assert.equal(r115.schema,'JENIOS_R115_ULTRA_SOURCE_EXTENSION_V1');
 assert.equal(r115.baseCommit,'a17ff75b927e7c1671d81ec77e8de76546799ad8');
 assert.equal(r115.liveExecutionAllowed,false);
 const r115aRaw=read('docs/release/R115A-ULTRA-ACCESS-EXTENSION.json');
 assert.equal(blob(r115aRaw),'251b842992399863ebd9f2a29a8e48db1b57caf0','R115A manifest changed');
 const r115a=JSON.parse(r115aRaw);
 assert.equal(r115a.schema,'JENIOS_R115A_ULTRA_ACCESS_EXTENSION_V1');
 assert.equal(r115a.baseCommit,'fa5dbfa3a49e31c0752dce01e4211cb48e69d79d');
 assert.equal(r115a.liveExecutionAllowed,false);
 const r116Raw=read('docs/release/R116-LOCAL-CLIENT-EXTENSION.json');
 assert.equal(blob(r116Raw),'bdadb820bead9d27265b462015343004faab1eb9','R116 manifest changed');
 const r116=JSON.parse(r116Raw);
 assert.equal(r116.schema,'JENIOS_R116_LOCAL_CLIENT_EXTENSION_V1');
 assert.equal(r116.baseCommit,'76b0021c018f05c337a0bb98961c21481ea7bdfa');
 assert.equal(r116.liveExecutionAllowed,false);
 assert.equal(r116.credentialLocation,'trader_device');
 const r117Raw=read('docs/release/R117-OPERATIONS-EXTENSION.json');
 assert.equal(blob(r117Raw),'6a47722761b103342bd0b7d4f7742c8a03245ac7','R117 manifest changed');
 const r117=JSON.parse(r117Raw);
 assert.equal(r117.schema,'JENIOS_R117_OPERATIONS_EXTENSION_V1');
 assert.equal(r117.baseCommit,'b238ea569a522324ae33755d3f3ee25da417e56e');
 assert.equal(r117.liveExecutionAllowed,false);
 assert.equal(r117.credentialLocation,'trader_device');
 const r124Raw=read('docs/release/R124-INDIVIDUAL-EXTENSION.json');
 assert.equal(blob(r124Raw),'75fa3619ecab1269abf04abf5dfd259cef05f7d5','R124 manifest changed');
 const r124=JSON.parse(r124Raw);
 assert.equal(r124.schema,'JENIOS_R124_INDIVIDUAL_EXTENSION_V1');
 assert.equal(r124.baseCommit,'25770702de5acfa2eb5e7e6d44a62386eba37a93');
 assert.equal(r124.liveExecutionAllowed,false);assert.equal(r124.billingAllowed,false);
 assert.equal(r124.credentialLocation,'trader_device');
 assert.deepEqual(Object.keys(r124.replacements).sort(),['app/components/platform/PlatformUltraControl.js','app/components/platform/PlatformUltraOperations.js','lib/platform/ultra/operations-http.mjs']);
 for(const [path,entry] of Object.entries(r124.replacements)){
  assert.equal(entry.baseline,r117.replacements[path]?.target||r117.additions[path],'R124 predecessor mismatch');
  assert.match(entry.target,/^[a-f0-9]{40}$/);
 }
 for(const [path,sha] of Object.entries(r124.additions)){
  assert.match(sha,/^[a-f0-9]{40}$/);assert.equal(blob(read(path)),sha,'Unreviewed R124 addition: '+path);
 }
 const truthRaw=read('docs/release/PUBLIC-TRUTH-CANDIDATE-20261111.json');
 assert.equal(blob(truthRaw),'7bcaa57b11dae9f9b2ca62866c7c57c7624040a8','Public truth candidate manifest changed');
 const truth=JSON.parse(truthRaw);
 assert.equal(truth.schema,'JENIOS_PUBLIC_TRUTH_CANDIDATE_V1');
 assert.equal(truth.baseCommit,'d63f26ca9ddb9987f74cd62aabe0f42bc181ab63');
 assert.equal(truth.publicationApproved,true);
 assert.equal(truth.liveExecutionAllowed,false);assert.equal(truth.billingAllowed,false);
 assert.equal(truth.credentialCollectionAllowed,false);
 assert.deepEqual(Object.keys(truth.replacements).sort(),["app/brocker/page.js","app/comunidades/page.js","app/copy-trading/page.js","app/engenharia-reversa/page.js","app/risco/page.js","app/torneios/page.js"]);
 for(const [path,entry] of Object.entries(truth.replacements)){
  assert.equal(entry.baseline,baseline.blobs[path],'Public truth predecessor mismatch');
  assert.match(entry.target,/^[a-f0-9]{40}$/);
  assert.equal(blob(read(path)),entry.target,'Unreviewed public truth replacement: '+path);
 }
 assert.deepEqual(Object.keys(truth.additions),['tests/publicTruthReview.test.mjs']);
 for(const [path,sha] of Object.entries(truth.additions)){
  assert.ok(!Object.hasOwn(baseline.blobs,path));
  assert.match(sha,/^[a-f0-9]{40}$/);
  assert.equal(blob(read(path)),sha,'Unreviewed public truth test: '+path);
 }
 const expected={...baseline.blobs,'scripts/check-pro-image-g49.mjs':'16bfc99c1916fe010f0ad1768cdd17ea1fe9af17',[testPath]:'d2313397603bf89f5fce23dcd59aa5ce2129163d'};
 // Only the two reviewed attribution files may differ from the immutable predecessor.
 // Every other inherited byte, including all auth/financial/native code, stays pinned.
 const footerRaw=read(footerManifestPath);
 assert.equal(blob(footerRaw),footerManifestSha1,'Kivoryn footer manifest changed');
 const footer=JSON.parse(footerRaw);
 assert.equal(footer.schema,'JENIOS_KIVORYN_TEXT_FOOTER_V1');
 assert.equal(footer.baseCommit,'006a58dbb94b957c30c2ff370b7a705f1cdb467e');
 assert.deepEqual(Object.keys(footer.replacements).sort(),['app/components/brand/BrandSignature.js','app/components/brand/BrandSignature.module.css']);
 for(const [path,entry] of Object.entries(footer.replacements)){
   assert.equal(entry.baseline,expected[path],'Kivoryn replacement baseline mismatch');
   assert.match(entry.target,/^[a-f0-9]{40}$/);
 }
 for(const [path,sha] of Object.entries(expected))assert.equal(blob(read(path)),truth.replacements[path]?.target||r124.replacements[path]?.target||r117.replacements[path]?.target||r116.replacements[path]?.target||r115a.replacements[path]?.target||r115.replacements[path]?.target||cb.replacements[path]?.target||footer.replacements[path]?.target||sha,'Unreviewed R106 public release change: '+path);
 // R113 extension is append-only, explicitly pinned, and cannot replace R106 files.
 const extensionRaw=read(extensionManifestPath);
 assert.equal(blob(extensionRaw),extensionManifestSha1,'R113 extension manifest changed');
 const extension=JSON.parse(extensionRaw);
 const flowRaw=read(flowManifestPath);
 assert.equal(blob(flowRaw),flowManifestSha1,'R114 flow manifest changed');
 const flow=JSON.parse(flowRaw);
 assert.equal(flow.schema,'JENIOS_R114_FLOW_SOURCE_EXTENSION_V1');
 assert.equal(flow.baseCommit,'bcf678c7ce6644e078fbd9bd0c159c69199fe033');
 assert.equal(flow.liveExecutionAllowed,false);
 assert.deepEqual(Object.keys(flow.replacements).sort(),[
   'app/api/platform/admin/robots/ultrafast/route.js',
   'app/components/platform/PlatformUltraResearchLab.js',
   'lib/platform/research/ultrafast-v2-pipeline.mjs']);
 for(const [path,entry] of Object.entries(flow.replacements)){
   assert.equal(entry.baseline,extension.blobs[path],'R114 replacement baseline mismatch');
   assert.match(entry.target,/^[a-f0-9]{40}$/);
 }

 assert.equal(extension.schema,'JENIOS_R113_APPEND_ONLY_SOURCE_EXTENSION_V1');
 assert.equal(extension.baseCommit,'8f1b8e4827814d7efe42dc5b91226def2ea42ad5');
 assert.equal(extension.financialLiveAllowed,false);
 assert.equal(extension.externalPaperAllowed,false);
 assert.equal(typeof extension.blobs,'object');
 assert.ok(extension.blobs&&!Array.isArray(extension.blobs));
 for(const [path,sha] of Object.entries(extension.blobs)){
   assert.ok(!Object.hasOwn(expected,path) && path!==manifestPath && path!==helperPath && path!==extensionManifestPath,
     'R113 extension must not replace reviewed R106 source: '+path);
   assert.match(sha,/^[a-f0-9]{40}$/);
   assert.equal(blob(read(path)),r124.replacements[path]?.target||r117.replacements[path]?.target||r116.replacements[path]?.target||r115a.replacements[path]?.target||r115.replacements[path]?.target||cb.replacements[path]?.target||flow.replacements[path]?.target||sha,'Unreviewed R113/R114 release change: '+path);
 }
 const inherited={...expected,...extension.blobs,...footer.additions,...flow.additions};
 for(const [path,entry] of Object.entries(cb.replacements)){
  assert.equal(entry.baseline,footer.replacements[path]?.target||flow.replacements[path]?.target||inherited[path],'CB006 replacement baseline mismatch');
  assert.match(entry.target,/^[a-f0-9]{40}$/);
  assert.equal(blob(read(path)),r124.replacements[path]?.target||r117.replacements[path]?.target||r116.replacements[path]?.target||r115a.replacements[path]?.target||r115.replacements[path]?.target||entry.target,'Unreviewed CB006 replacement: '+path);
 }
 for(const [path,sha] of Object.entries(cb.additions)){
  assert.ok(!Object.hasOwn(inherited,path)&&path!==helperPath);
  assert.match(sha,/^[a-f0-9]{40}$/);
  assert.equal(blob(read(path)),sha,'Unreviewed CB006 addition: '+path);
 }
 const inheritedR115={...inherited,...cb.additions};
 assert.deepEqual(Object.keys(r115.replacements).sort(),['app/dashboard-logado/page.js','app/platform/admin/robos/page.js']);
 for(const [path,entry] of Object.entries(r115.replacements)){
  assert.equal(entry.baseline,cb.replacements[path]?.target||footer.replacements[path]?.target||flow.replacements[path]?.target||inheritedR115[path],'R115 replacement predecessor mismatch');
  assert.equal(blob(read(path)),r124.replacements[path]?.target||r117.replacements[path]?.target||r116.replacements[path]?.target||r115a.replacements[path]?.target||entry.target,'Unreviewed R115 replacement: '+path);
 }
 for(const [path,sha] of Object.entries(r115.additions)){
  assert.ok(!Object.hasOwn(inheritedR115,path)&&path!==helperPath);
  assert.match(sha,/^[a-f0-9]{40}$/);
  assert.equal(blob(read(path)),r124.replacements[path]?.target||r117.replacements[path]?.target||r116.replacements[path]?.target||r115a.replacements[path]?.target||sha,'Unreviewed R115 addition: '+path);
 }
 assert.deepEqual(Object.keys(r115a.replacements).sort(),["app/components/platform/PlatformAuthGuard.js", "app/components/social-auth-return.mjs", "app/platform/entrar/page.js", "app/platform/ultra/page.js", "tests/platformUltraR115.test.mjs"]);
 for(const [path,entry] of Object.entries(r115a.replacements)){
  assert.equal(entry.baseline,r115.additions[path]||r115.replacements[path]?.target||cb.replacements[path]?.target||footer.replacements[path]?.target||flow.replacements[path]?.target||inheritedR115[path],'R115A predecessor mismatch');
  assert.equal(blob(read(path)),r124.replacements[path]?.target||r117.replacements[path]?.target||r116.replacements[path]?.target||entry.target,'Unreviewed R115A replacement: '+path);
 }
 const inheritedR116={...inheritedR115,...r115.additions};
 assert.deepEqual(Object.keys(r116.replacements).sort(),['app/components/platform/PlatformUltraControl.js','app/components/platform/PlatformUltraControl.module.css']);
 for(const [path,entry] of Object.entries(r116.replacements)){
  assert.equal(entry.baseline,r115a.replacements[path]?.target||r115.replacements[path]?.target||cb.replacements[path]?.target||footer.replacements[path]?.target||flow.replacements[path]?.target||inheritedR116[path],'R116 predecessor mismatch');
  assert.equal(blob(read(path)),r124.replacements[path]?.target||r117.replacements[path]?.target||entry.target,'Unreviewed R116 replacement: '+path);
 }
 for(const [path,sha] of Object.entries(r116.additions)){
  assert.ok(!Object.hasOwn(inheritedR116,path)&&path!==helperPath&&!path.endsWith('-EXTENSION.json'),'R116 must not replace inherited source: '+path);
  assert.match(sha,/^[a-f0-9]{40}$/);
  assert.equal(blob(read(path)),r124.replacements[path]?.target||r117.replacements[path]?.target||sha,'Unreviewed R116 addition: '+path);
 }
 const inheritedR117={...inheritedR116,...r116.additions};
 assert.deepEqual(Object.keys(r117.replacements).sort(),['app/components/platform/PlatformUltraControl.js','app/components/platform/PlatformUltraControl.module.css','app/components/platform/PlatformUltraLocal.js']);
 for(const [path,entry] of Object.entries(r117.replacements)){
  assert.equal(entry.baseline,r116.replacements[path]?.target||r115a.replacements[path]?.target||r115.replacements[path]?.target||inheritedR117[path],'R117 predecessor mismatch');
  assert.equal(blob(read(path)),r124.replacements[path]?.target||entry.target,'Unreviewed R117 replacement: '+path);
 }
 for(const [path,sha] of Object.entries(r117.additions)){
  assert.ok(!Object.hasOwn(inheritedR117,path)&&path!==helperPath&&!path.endsWith('-EXTENSION.json'),'R117 must not replace inherited source: '+path);
  assert.match(sha,/^[a-f0-9]{40}$/);
  assert.equal(blob(read(path)),r124.replacements[path]?.target||sha,'Unreviewed R117 addition: '+path);
 }
 const files=tracked||execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
 assert.deepEqual(Object.keys(footer.additions).sort(),['.github/workflows/kivoryn-footer-validation.yml','tests/brandFooterText.test.mjs']);
 for(const [path,sha] of Object.entries(footer.additions)){
   assert.ok(!Object.hasOwn(expected,path)&&!Object.hasOwn(extension.blobs,path));
   assert.match(sha,/^[a-f0-9]{40}$/);
   assert.equal(blob(read(path)),sha,'Unreviewed Kivoryn validation file: '+path);
 }
 for(const [path,sha] of Object.entries(flow.additions)){
   assert.ok(!Object.hasOwn(expected,path)&&!Object.hasOwn(extension.blobs,path)&&!Object.hasOwn(footer.additions,path));
   assert.match(sha,/^[a-f0-9]{40}$/);
   assert.equal(blob(read(path)),sha,'Unreviewed R114 addition: '+path);
 }
 const accepted=['docs/release/PUBLIC-TRUTH-CANDIDATE-20261111.json',...Object.keys(truth.additions),'docs/release/R124-INDIVIDUAL-EXTENSION.json',...Object.keys(r124.additions),'docs/release/R117-OPERATIONS-EXTENSION.json',...Object.keys(r117.additions),'docs/release/R116-LOCAL-CLIENT-EXTENSION.json',...Object.keys(r116.additions),'docs/release/R115A-ULTRA-ACCESS-EXTENSION.json','docs/release/R115-ULTRA-SOURCE-EXTENSION.json',...Object.keys(r115.additions),'docs/release/CB006-LETTER-SOURCE-EXTENSION.json',...Object.keys(cb.additions),...Object.keys(expected),...Object.keys(extension.blobs),...Object.keys(footer.additions),...Object.keys(flow.additions),flowManifestPath,manifestPath,helperPath,extensionManifestPath,footerManifestPath];
 assert.deepEqual(files.slice().sort(),[...new Set(accepted)].sort(),'Unreviewed R106/R113 public release inventory');
 return Object.freeze({inheritedFiles:Object.keys(baseline.blobs).length,extensionFiles:Object.keys(extension.blobs).length,
   exactSource:true,brokerPermissionsGranted:false});
}
if(process.argv[1]?.endsWith('/check-authentication-r106.mjs'))console.log('R106_PUBLIC_GUIDANCE_SOURCE_PASS',verifyR106PublicGuidance());
