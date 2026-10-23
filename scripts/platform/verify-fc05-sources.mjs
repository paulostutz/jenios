import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync,spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
const manifest=JSON.parse(readFileSync('docs/platform/evidence/FC05_SOURCE_MANIFEST.json'));
assert.equal(manifest.baseFC04,'65e640b17e670b0a5e5bc9d0e0c056fec5fc5fd6');
const edits=new Map(manifest.modifications.map(e=>[e.path,e]));
const digest=b=>createHash('sha256').update(b).digest('hex');
const blob=b=>createHash('sha1').update(Buffer.from(`blob ${b.length}\0`)).update(b).digest('hex');
const base=execFileSync('git',['ls-tree','-rz','--full-tree',manifest.baseFC04],{encoding:'utf8',maxBuffer:4*1024*1024}).split('\0').filter(Boolean);
let unchanged=0;
for(const row of base){
 const [,type,sha,path]=row.match(/^\d+ (\w+) ([a-f0-9]+)\t(.+)$/s)||[];assert.equal(type,'blob',path);
 const current=readFileSync(path),edit=edits.get(path);
 if(edit){const original=readFileSync(edit.originalArchive);assert.equal(blob(original),sha,path+' original Git blob');assert.equal(digest(original),edit.beforeSha256);assert.equal(digest(current),edit.afterSha256,path+' refinement');}
 else{assert.equal(blob(current),sha,path+' preserved');unchanged++;}
}
assert.equal(base.length-unchanged,edits.size);
const config=JSON.parse(readFileSync('vercel.json'));assert.ok(config.ignoreCommand.length<=256);
for(const branch of ['research/jenios-fc05-integrated-homologation-20261023','backup/jenios-fc05-local-ui-verified-20261023']){
 assert.equal(config.git.deploymentEnabled[branch],false);assert.equal(spawnSync('/bin/sh',['-c',config.ignoreCommand],{env:{VERCEL_GIT_COMMIT_REF:branch}}).status,0);
}
console.log(`FC05: ${unchanged}/${base.length} FC04 files unchanged; ${edits.size} explicit refinements with original Git blobs archived; deployment disabled.`);
