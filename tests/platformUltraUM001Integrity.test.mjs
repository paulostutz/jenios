import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {verifyR106PublicGuidance} from '../scripts/check-authentication-r106.mjs';

const manifestPath='docs/release/UM001-MONTHLY-PREPARATION-EXTENSION.json';
const manifest=()=>JSON.parse(readFileSync(manifestPath,'utf8'));
const tracked=()=>execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);

test('UM001 source extension accepts only the exact local preparation over preserved R126',()=>{
 const result=verifyR106PublicGuidance(),m=manifest();
 assert.equal(result.exactSource,true);assert.equal(result.monthlyPreparationOnly,true);
 assert.equal(result.liveExecutionAllowed,false);assert.equal(result.billingAllowed,false);
 assert.equal(m.baseCommit,'02f547531d4e2353fa1c397d0a6cb2b8edb68b2c');
 assert.equal(Object.keys(m.replacements).length,6);assert.equal(Object.keys(m.additions).length,8);
 for(const flag of ['liveExecutionAllowed','externalPaperAllowed','nativeValidated','productionPublished','billingAllowed','realDebitAllowed','visualQaPerformed'])assert.equal(m[flag],false);
});

test('UM001 rejects changed monthly sources, historical manifests and preserved execution/authentication files',()=>{
 const m=manifest();
 const targets=[manifestPath,...Object.keys(m.additions),...Object.keys(m.replacements),
  'docs/release/R126-TEST-EXTENSION.json','docs/release/R125-ULTRA-CANDIDATE-EXTENSION.json',
  'lib/platform/ultra/client/execution-runtime.mjs','lib/platform/ultra/operation.mjs',
  'app/components/platform/PlatformAuthGuard.js','public/downloads/jenios-ultra-r126-rehearsal.zip'];
 for(const target of targets){
  assert.throws(()=>verifyR106PublicGuidance({read:path=>path===target?Buffer.from('unreviewed fixture change'):readFileSync(path)}),undefined,target);
 }
});

test('UM001 inventory rejects an unknown file, a missing approved file and duplicate entries',()=>{
 const files=tracked(),added=Object.keys(manifest().additions)[0];
 assert.throws(()=>verifyR106PublicGuidance({tracked:[...files,'lib/platform/ultra/unreviewed-fixture.mjs']}),/inventory/);
 assert.throws(()=>verifyR106PublicGuidance({tracked:files.filter(path=>path!==added)}),/inventory/);
 assert.throws(()=>verifyR106PublicGuidance({tracked:[...files,added]}),/inventory/);
});
