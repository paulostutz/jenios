import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {verifyR106PublicGuidance} from '../scripts/check-authentication-r106.mjs';

const tracked=()=>execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
test('R127 exact source inventory preserves inherited and new candidate bytes',()=>{
 const result=verifyR106PublicGuidance();
 assert.equal(result.exactSource,true);assert.equal(result.liveExecutionAllowed,false);
});
test('R127 inventory continues to refuse changed source or extra paths',()=>{
 const target='lib/platform/ultra/client/execution-runtime-r127.mjs';
 assert.throws(()=>verifyR106PublicGuidance({read:path=>path===target?Buffer.concat([readFileSync(path),Buffer.from('\n')]):readFileSync(path)}),/Unreviewed R127/);
 assert.throws(()=>verifyR106PublicGuidance({tracked:[...tracked(),'unexpected-r127-file.mjs']}),/inventory/);
});
