import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {verifyR106PublicGuidance} from '../scripts/check-authentication-r106.mjs';
test('R106 public release inventory accepts its exact reviewed source',()=>{
 assert.equal(verifyR106PublicGuidance().inheritedFiles,1179);
});
test('R106 source guard still rejects inherited edits, manifest tampering and extra files',()=>{
 for(const target of ['app/integracoes/page.js','lib/pay/gateway.mjs','native-app/App.tsx','docs/release/R106-PUBLIC-GUIDANCE-BASELINE.json']){
  assert.throws(()=>verifyR106PublicGuidance({read:path=>path===target?Buffer.from('unreviewed change'):readFileSync(path)}));
 }
 const tracked=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
 assert.throws(()=>verifyR106PublicGuidance({tracked:[...tracked,'app/api/unreviewed/route.js']}));
});
