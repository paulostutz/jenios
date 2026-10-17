import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stagingRouteDecision} from '../../lib/staging/route-policy.mjs';
const file=path=>readFileSync(new URL('../../'+path,import.meta.url),'utf8');

test('only three test pages, handle lookup and static assets may be viewed',()=>{
 for(const path of ['/login','/cadastro','/s04-laboratorio','/api/social/handles','/icon.svg','/_next/static/chunks/main.js'])
  assert.equal(stagingRouteDecision(path,'GET'),'allow',path);
});
test('home and successful login redirect to safe staging page',()=>{
 for(const path of ['/','/social'])assert.equal(stagingRouteDecision(path,'GET'),'redirect');
});
test('every financial, private, and mutating route is denied',()=>{
 const blocked=['/api/platform/trial','/api/platform/checkout','/api/jenios-pay/checkout','/api/bankscore/detailed','/api/crypto-validator/detailed','/api/admin/consultas','/api/social/media','/api/social/video','/api/social/account-deletion','/api/social/account-deletion/cancel','/social/configuracoes','/social/feed','/api/social/handles/anything','/_next/image','/api/health','/checkout','/billing'];
 for(const path of blocked)for(const method of ['GET','POST','PUT','PATCH','DELETE'])assert.equal(stagingRouteDecision(path,method),'block',method+' '+path);
});
test('only GET and HEAD methods may access allowed routes',()=>{
 for(const path of ['/login','/cadastro','/s04-laboratorio','/api/social/handles']){
  for(const method of ['POST','PUT','PATCH','DELETE','OPTIONS'])assert.equal(stagingRouteDecision(path,method),'block');
  assert.equal(stagingRouteDecision(path,'HEAD'),'allow');
 }
});
test('staging dashboard imports only public Supabase client and has no financial provider imports',()=>{
 const code=file('app/s04-laboratorio/page.js');
 assert.match(code,/supabase\.auth\.getUser\(/);
 assert.match(code,/\.from\('profiles'\)/);
 assert.doesNotMatch(code,/getJeniosPayAdmin|SUPABASE_SECRET_KEY|INTER_PRIVATE_KEY|PAY_ADMIN_TOKEN/);
 assert.match(code,/dados fictícios/);
});
test('middleware enforces route policy unconditionally and does not leak error details',()=>{
 const code=file('middleware.js');
 assert.match(code,/stagingRouteDecision\(pathname, request\.method\)/);
 assert.match(code,/status: 404/);
 assert.match(code,/noindex, nofollow/);
 assert.doesNotMatch(code,/JENIOS_S04_LAB_ENABLED|process\.env/);
});
