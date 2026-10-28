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
 for(const [path,sha] of Object.entries(expected))assert.equal(blob(read(path)),sha,'Unreviewed R106 public release change: '+path);
 const files=tracked||execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
 assert.deepEqual(files.slice().sort(),[...new Set([...Object.keys(expected),manifestPath,helperPath])].sort(),'Unreviewed R106 public release inventory');
 return Object.freeze({inheritedFiles:Object.keys(baseline.blobs).length,exactSource:true,brokerPermissionsGranted:false});
}
if(process.argv[1]?.endsWith('/check-authentication-r106.mjs'))console.log('R106_PUBLIC_GUIDANCE_SOURCE_PASS',verifyR106PublicGuidance());
