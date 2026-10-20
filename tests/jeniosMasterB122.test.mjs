import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isMasterAdmin,adminPermissions} from '../lib/admin-access.mjs';
const read=p=>readFileSync(p,'utf8');
const uid='11111111-1111-4111-8111-111111111111';
function db(perms=[]){return {from(){return {select(){return {eq:async()=>({data:perms.map(permission=>({permission})),error:null})}}}}};}
test('B122 Master requires trusted app_metadata role or reviewed admin allowlist',()=>{
 assert.equal(isMasterAdmin({id:uid,app_metadata:{role:'admin'}},{}),false);
 assert.equal(isMasterAdmin({id:uid,app_metadata:{role:'master'}},{}),true);
 assert.equal(isMasterAdmin({id:uid,user_metadata:{role:'master'},app_metadata:{}},{}),false);
 assert.equal(isMasterAdmin({id:uid,app_metadata:{role:'finance_admin'}},{}),false);
 assert.equal(isMasterAdmin({id:uid,app_metadata:{}},{JENIOS_ADMIN_MASTER_USER_IDS:uid}),true);
 assert.equal(isMasterAdmin({id:uid,is_anonymous:true,app_metadata:{role:'admin'}},{}),false);
});
test('B122 operational permissions never establish Master status',async()=>{
 const user={id:uid,app_metadata:{}};
 assert.deepEqual(await adminPermissions(db(['finance.manage','permissions.manage','reports.run']),user,{}),['finance.manage','permissions.manage','reports.run']);
 assert.equal(isMasterAdmin(user,{}),false);
});
test('B122 Master restrictions apply to all admin pages and privileged server APIs',()=>{
 const code=read('lib/admin-access.mjs');
 assert.ok(code.indexOf('if(!isMasterAdmin(user))')<code.indexOf('if(!(await adminPermissions(db,user)).includes(permission))'));
 assert.match(read('app/api/admin/access/route.js'),/permissions:isMaster\?await adminPermissions\(db,user\):\[\]/);
 assert.match(read('app/components/AdminAccess.js'),/data.isMaster===true/);
 assert.match(read('app/admin/login/page.js'),/result.isMaster === true/);
 assert.match(read('app/admin/cobrancas/page.js'),/AdminAccess permission="finance.manage"/);
 assert.match(read('app/admin/moderacao/page.js'),/AdminAccess permission="permissions.manage"/);
});
test('B122 Platform aggregate never exchanges sessions between Social and Platform',()=>{
 const code=read('app/api/admin/ecosystem/route.js');
 assert.ok(code.indexOf('if(!isMasterAdmin(user))')<code.indexOf('getJeniosPlatformAdmin()'));
 assert.match(code,/head:true,count:'exact'/);
 assert.doesNotMatch(code,/setSession|signInWithPassword/);
});
test('B122 Master desktop/mobile sidebar is scrollable, pages are lazily selected',()=>{
 const css=read('app/admin/page.module.css'),page=read('app/admin/page.js');
 assert.match(css,/max-height:100dvh;overflow-y:auto/);
 assert.match(css,/@media\(max-width:640px\)/);
 assert.match(css,/overflow-x:auto/);
 assert.match(page,/section==='platform'\?<PlatformPanel\/>/);
 assert.doesNotMatch(page,/window\.location\.reload/);
});
