import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {verifyOwnerWebRelease} from '../scripts/check-ultra-owner-web.mjs';
test('Owner web release preserves the production predecessor and adds no trading or debit authority',()=>{const s=verifyOwnerWebRelease();assert.equal(s.ownerWebRelease,true);assert.equal(s.exactSource,true);assert.equal(s.liveExecutionAllowed,false);assert.equal(s.realBillingAllowed,false);});
test('Owner web release rejects changes to wallet, auth API and inherited source',()=>{for(const p of ['app/carteira/page.js','app/api/platform/ultra/state/route.js','lib/platform/ultra/web/state-contract.mjs','scripts/check-r106-production-baseline.mjs','app/brocker/page.js'])assert.throws(()=>verifyOwnerWebRelease({read:name=>name===p?Buffer.from('changed'):readFileSync(name)}));});
test('Owner web release refuses unknown, missing and duplicate inventory entries',()=>{const files=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);for(const tracked of [[...files,'unknown.mjs'],files.slice(1),[...files,files[0]]])assert.throws(()=>verifyOwnerWebRelease({tracked}),/exact inventory/);});
