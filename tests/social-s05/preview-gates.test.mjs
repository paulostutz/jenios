import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stagingRouteDecision} from '../../lib/staging/route-policy.mjs';
const scripts=JSON.parse(readFileSync('package.json','utf8')).scripts;
test('S05 CI requires legacy regression, new regression and staging remote checks',()=>{
 const b=scripts.build;
 for(const part of ['npm run test:s03','npm run test:s04','npm run test:s05','check-s04-staging-build.mjs','check-s04-staging-api.mjs','check-s05-video-runtime.mjs','next build'])assert.ok(b.includes(part));
});
test('S05 middleware fails closed for all financial and content-changing routes',()=>{
 const forbidden=['/api/platform/checkout','/api/jenios-pay/checkout','/api/admin/consultas','/api/bankscore/detailed','/api/crypto-validator/detailed','/api/platform/trial','/api/social/media','/api/social/video','/api/social/account-deletion','/api/social/account-deletion/cancel','/api/social/feed'];
 for(const route of forbidden)for(const method of ['GET','POST','PUT','DELETE','PATCH'])assert.equal(stagingRouteDecision(route,method),'block',route+' '+method);
});
test('S05 open routes are read-only, no preview write APIs',()=>{
 const publicRoutes=['/login','/cadastro','/auth/confirm','/recuperar-senha','/redefinir-senha','/s04-laboratorio','/api/social/handles','/api/s05/video-readiness'];
 for(const route of publicRoutes){assert.equal(stagingRouteDecision(route,'GET'),'allow');assert.equal(stagingRouteDecision(route,'POST'),'block')}
});
test('S05 Next LTS security upgrade is preview-only and protection tool remains active',()=>{
 const pkg=JSON.parse(readFileSync('package.json','utf8'));assert.equal(pkg.dependencies.next,'15.5.28');
 assert.match(readFileSync('scripts/check-s04-staging-build.mjs','utf8'),/VERCEL_ENV/);
 assert.match(readFileSync('middleware.js','utf8'),/Referrer-Policy/);
});
