import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeInvite,normalizeMasterChange,safeUser,noCrossOriginMutation} from '../lib/admin-users.mjs';
import {isMasterAdmin} from '../lib/admin-access.mjs';
const src=p=>readFileSync(p,'utf8');
const uid='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
test('B129 only valid email and explicit user/master roles are accepted',()=>{
 assert.deepEqual(normalizeInvite({email:' PESSOA@example.com ',role:'master'}),{email:'pessoa@example.com',role:'master'});
 for(const x of [{email:'a@example.com',role:'admin'},{email:'wrong',role:'master'},{email:'x@example.com',role:'user',admin:true},null])
  assert.throws(()=>normalizeInvite(x),{status:400});
});
test('B129 cannot demote self or use client provided privilege role',()=>{
 assert.throws(()=>normalizeMasterChange({userId:uid,enabled:false},uid),{status:403});
 assert.throws(()=>normalizeMasterChange({userId:other,enabled:true,role:'master'},uid),{status:400});
 assert.deepEqual(normalizeMasterChange({userId:other,enabled:true},uid),{userId:other,enabled:true});
});
test('B129 master is checked solely from server-owned metadata or protected environment',()=>{
 assert.equal(isMasterAdmin({id:uid,app_metadata:{role:'master'}}),true);
 assert.equal(isMasterAdmin({id:uid,app_metadata:{role:'user'},user_metadata:{role:'master'}},{}),false);
 assert.equal(safeUser({id:uid,email:'x@example.com',app_metadata:{role:'user'}},{JENIOS_ADMIN_MASTER_USER_IDS:uid}).isMaster,true);
});
test('B129 cross-origin mutations are rejected',()=>{
 assert.doesNotThrow(()=>noCrossOriginMutation(new Request('https://jenios.example/api/admin/users',{headers:{origin:'https://jenios.example'}})));
 assert.throws(()=>noCrossOriginMutation(new Request('https://jenios.example/api/admin/users',{headers:{origin:'https://malicious.example'}})),{status:403});
});
test('B129 server verifies Master before any Auth Admin management API or invitation',()=>{
 const route=src('app/api/admin/users/route.js');
 assert.match(route,/requireAdminPermission\(request,db,'permissions.manage'\)/);
 assert.match(route,/admin\.inviteUserByEmail\(email/);
 assert.match(route,/admin\.updateUserById/);
 assert.match(route,/admin\.getUserById\(userId\)/);
 assert.match(src('lib/admin-users.mjs'),/userId===actorId/);
});
test('B129 native Platform remains isolated, Social Master bridge is read-only through verified endpoints',()=>{
 const wrapper=src('app/components/platform/PlatformAdminAccess.js');
 const code=src('lib/platform/admin-session.mjs');
 assert.match(wrapper,/import \{createPlatformAdminSession\} from ['"](?:\.\.\/)+lib\/platform\/admin-session\.mjs['"]/);
 assert.match(wrapper,/createPlatformAdminSession\(\{platformAuth:platformSupabase\?\.auth,socialAuth:socialSupabase\?\.auth\}\)/);
 assert.match(wrapper,/export async function platformAdminFetch\(url,options=\{\}\)\{\s*return adminSession\.fetch\(url,options\);/);
 assert.match(code,/\/api\/admin\/access/);
 assert.match(code,/\/api\/admin\/ecosystem/);
 assert.match(code,/grants\?\.isMaster!==true/);
 assert.match(code,/getSession/);
 assert.doesNotMatch(wrapper+'\n'+code,/auth\.setSession|signInWithPassword/);
 assert.match(src('app/api/admin/ecosystem/route.js'),/if\(!isMasterAdmin\(user\)\)/);
});
