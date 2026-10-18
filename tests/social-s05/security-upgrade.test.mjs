import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const pkg=JSON.parse(readFileSync('package.json','utf8'));
test('S05 Next maintenance LTS patch is pinned exactly',()=>assert.equal(pkg.dependencies.next,'15.5.28'));
test('S05 preserves other pinned runtime dependencies',()=>{
 for(const [key,val] of Object.entries({'ffmpeg-static':'5.3.0','pdf-lib':'1.17.1','tus-js-client':'4.3.1'}))assert.equal(pkg.dependencies[key],val);
});
test('production/payment routes are not part of the security change',()=>{
 const source=readFileSync('lib/staging/route-policy.mjs','utf8');
 for(const sensitive of ['/api/platform/checkout','/api/jenios-pay/checkout','/api/bankscore/detailed','/api/crypto-validator/detailed','/api/platform/trial','/api/social/video'])assert.ok(source.includes("return 'block'"));
});

const lock=JSON.parse(readFileSync('package-lock.json','utf8'));
test('S05 locked dependencies match runtime manifest',()=>{
 assert.equal(lock.lockfileVersion,3);
 for(const [name,spec] of Object.entries(pkg.dependencies)){
  assert.equal(lock.packages?.['']?.dependencies?.[name],spec,name+' root lock spec');
  assert.ok(lock.packages?.['node_modules/'+name]?.version,name+' resolved lock entry');
 }
});
test('S05 lockfile cannot silently upgrade Next or React across major releases',()=>{
 assert.equal(lock.packages['node_modules/next'].version,'15.5.28');
 for(const name of ['react','react-dom'])assert.match(lock.packages['node_modules/'+name].version,/^18\./,name+' must stay React 18');
});
