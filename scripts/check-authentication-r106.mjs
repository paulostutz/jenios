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
const helperPath='scripts/check-authentication-r106.mjs';
const testPath='tests/platformAuthenticationReleaseR106.test.mjs';
const blob=body=>createHash('sha1').update(Buffer.from('blob '+body.byteLength+'\0')).update(body).digest('hex');
export function verifyR106PublicGuidance({read=readFileSync,tracked}={}){
 const raw=read(manifestPath);
 assert.equal(createHash('sha256').update(raw).digest('hex'),'598e79e56d0ac4fccd3140ebbbc4be563240cc4aa5ac1d2d70f95057d2fb85d0','R106 baseline manifest changed');
 const baseline=JSON.parse(raw);
 assert.equal(baseline.schema,'JENIOS_R106_PUBLIC_GUIDANCE_BASELINE_V1');
 assert.equal(baseline.baseCommit,'6c7b4e69d6a82523714c63d1e64ecbcf5ec465cc');
 assert.equal(baseline.previousProductionCommit,'3dec421bfb9ef1e85d0083a55f63223d3491a256');
 const expected={...baseline.blobs,'scripts/check-pro-image-g49.mjs':'16bfc99c1916fe010f0ad1768cdd17ea1fe9af17',[testPath]:'d2313397603bf89f5fce23dcd59aa5ce2129163d'};
 // R106 immutable predecessor: every reviewed inherited byte is still checked.
 for(const [path,sha] of Object.entries(expected))assert.equal(blob(read(path)),sha,'Unreviewed R106 public release change: '+path);
 // R113 extension is append-only, explicitly pinned, and cannot replace R106 files.
 const extensionRaw=read(extensionManifestPath);
 assert.equal(blob(extensionRaw),extensionManifestSha1,'R113 extension manifest changed');
 const extension=JSON.parse(extensionRaw);
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
   assert.equal(blob(read(path)),sha,'Unreviewed R113 release change: '+path);
 }
 const files=tracked||execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
 const accepted=[...Object.keys(expected),...Object.keys(extension.blobs),manifestPath,helperPath,extensionManifestPath];
 assert.deepEqual(files.slice().sort(),[...new Set(accepted)].sort(),'Unreviewed R106/R113 public release inventory');
 return Object.freeze({inheritedFiles:Object.keys(baseline.blobs).length,extensionFiles:Object.keys(extension.blobs).length,
   exactSource:true,brokerPermissionsGranted:false});
}
if(process.argv[1]?.endsWith('/check-authentication-r106.mjs'))console.log('R106_PUBLIC_GUIDANCE_SOURCE_PASS',verifyR106PublicGuidance());
