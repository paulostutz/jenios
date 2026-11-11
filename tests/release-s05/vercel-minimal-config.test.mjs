import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {verifyOwnerWebRelease} from '../../scripts/check-ultra-owner-web.mjs';
import {verifyUltraProductionSource} from '../../lib/release/ultra-production-source.mjs';
test('reviewed Vercel config contains only the official schema, with no settings or environment overrides',()=>{
 assert.deepEqual(JSON.parse(readFileSync('vercel.json','utf8')),{$schema:'https://openapi.vercel.sh/vercel.json'});
 assert.equal(JSON.parse(readFileSync('package.json','utf8')).scripts.build,'node scripts/check-s05-env-scope.mjs && npm test && npm run test:release-s05 && next build');
});
test('exact release guard pins the minimal Vercel config and rejects added override fields',()=>{
 assert.equal(verifyOwnerWebRelease().ultraMinimalVercelConfigRelease,true);
 for(const value of [{},{$schema:'https://openapi.vercel.sh/vercel.json',buildCommand:'next build'},{$schema:'https://openapi.vercel.sh/vercel.json',env:{anything:'fixture'}}])assert.throws(()=>verifyOwnerWebRelease({read:name=>name==='vercel.json'?Buffer.from(JSON.stringify(value)):readFileSync(name)}));
});
test('a platform rewrite of tracked Vercel config stays blocked before content approval',()=>{
 const env={VERCEL_ENV:'production',VERCEL_GIT_COMMIT_REF:'release/jenios-ultra-commands-20261111',VERCEL_GIT_PROVIDER:'github',VERCEL_PROJECT_ID:'prj_44ipBY3R9sHlQDAXY7NUn1zDguw4',VERCEL_GIT_COMMIT_SHA:'a'.repeat(40)};
 let checked=false;
 assert.throws(()=>verifyUltraProductionSource(env,{git:(...args)=>args[0]==='rev-parse'?env.VERCEL_GIT_COMMIT_SHA:args[0]==='diff'?'M\0vercel.json\0':'',verifyContent:()=>{checked=true;}}),error=>error.message.startsWith('ULTRA_CHECKOUT_NOT_CLEAN ')&&error.message.includes('vercel.json'));
 assert.equal(checked,false);
});
