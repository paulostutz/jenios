import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync,spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
const manifest=JSON.parse(readFileSync('docs/platform/evidence/FC04_SOURCE_MANIFEST.json'));
const edits=new Map(manifest.modifications.map(entry=>[entry.path,entry]));
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const base=execFileSync('git',['ls-tree','-rz','--full-tree',manifest.baseFC03],{encoding:'utf8',maxBuffer:4*1024*1024}).split('\0').filter(Boolean);
let unchanged=0;
for(const row of base){
 const [,type,sha,path]=row.match(/^\d+ (\w+) ([a-f0-9]+)\t(.+)$/s)||[];
 assert.equal(type,'blob',path);
 const current=readFileSync(path),edit=edits.get(path);
 if(edit){
  const original=readFileSync(edit.originalArchive);
  assert.equal(digest(original),edit.beforeSha256,path+' archived');
  assert.equal(createHash('sha1').update(Buffer.from(`blob ${original.length}\0`)).update(original).digest('hex'),sha,path+' original Git blob');
  assert.equal(digest(current),edit.afterSha256,path+' refinement');
 }else{
  assert.equal(createHash('sha1').update(Buffer.from(`blob ${current.length}\0`)).update(current).digest('hex'),sha,path+' preserved');unchanged++;
 }
}
assert.equal(base.length-unchanged,edits.size);
const config=JSON.parse(readFileSync('vercel.json'));
for(const branch of ['research/jenios-fc04-commercial-journey-20261023','backup/jenios-fc04-commercial-offline-verified-20261023']){
 assert.equal(config.git.deploymentEnabled[branch],false);
 assert.equal(spawnSync('/bin/sh',['-c',config.ignoreCommand],{env:{VERCEL_GIT_COMMIT_REF:branch}}).status,0);
}
console.log(`FC04: ${unchanged}/${base.length} base files unchanged; ${edits.size} explicit refinements with archived originals; deployment disabled.`);
