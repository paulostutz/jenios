import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const m=JSON.parse(readFileSync(new URL('../../../docs/platform/B298-INTEGRATION-MANIFEST.json',import.meta.url)));
assert.equal(m.importMode,'additive-blobs-exact-no-merge');
const wanted=new Map(m.files.map(x=>[x.path,x.gitBlobSha]));
assert.equal(wanted.size,33);
const sha=b=>createHash('sha1').update('blob '+b.length+String.fromCharCode(0)).update(b).digest('hex');
for(const [path,hash] of wanted){
 assert.ok(existsSync(path),'Research file missing '+path);
 assert.equal(sha(readFileSync(path)),hash,'Source research changed '+path);
}
for(const n of ['engine.mjs','service.mjs'])assert.ok(!existsSync('lib/platform/research/'+n));
const branch='fix/jenios-b298-integrated-release-reconciliation-20261021',v=JSON.parse(readFileSync('vercel.json','utf8'));
assert.equal(v.git.deploymentEnabled[branch],false);
assert.ok(v.ignoreCommand.includes(branch));
const paths=execFileSync('git',['diff','--name-status','--no-renames',m.baseCommercialCommit,'HEAD'],{encoding:'utf8'}).trim().split('\n').filter(Boolean).map(x=>x.split('\t'));
const extra=new Set(["vercel.json","docs/platform/B298-INTEGRATION-MANIFEST.json","docs/platform/B298-PRIVATE-INTEGRATION-CHECKPOINT.md","scripts/platform/research/b298-verify-convergence.mjs","tests/jeniosB298Convergence.test.mjs",".github/workflows/jenios-b298-private-integration.yml"]);
for(const [status,path] of paths){
 assert.equal(status,'A','Protected earlier file modified: '+path);
 assert.ok(wanted.has(path)||extra.has(path),'Unexpected changed file: '+path);
}
assert.equal(paths.length,39);
console.log('B298_CONVERGENCE_PASS 33 exact research blobs + 6 new private integration files; 0 changed legacy paths');
