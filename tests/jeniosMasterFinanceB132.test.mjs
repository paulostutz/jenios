import test from 'node:test';
import assert from 'node:assert/strict';
import {isFinanceAdmin} from '../lib/pay/auth.mjs';
import {isMasterAdmin} from '../lib/admin-access.mjs';
const id='11111111-1111-4111-8111-111111111111';
test('B132 Masters carry existing finance privileges without changing payments or their core APIs',()=>{
 const master={id,app_metadata:{role:'master'}};
 assert.equal(isMasterAdmin(master,{}),true);
 assert.equal(isFinanceAdmin(master,{}),true);
 assert.equal(isFinanceAdmin({id,app_metadata:{}},{JENIOS_ADMIN_MASTER_USER_IDS:id}),true);
 assert.equal(isFinanceAdmin({id,app_metadata:{role:'admin'}},{}),true);
 assert.equal(isFinanceAdmin({id,app_metadata:{role:'finance_admin'}},{}),true);
});
test('B132 ordinary users cannot get finance privileges from client-controlled metadata',()=>{
 for(const role of ['user',null,'moderator']){
  const user={id,app_metadata:role?{role}:{},user_metadata:{role:'master'}};
  assert.equal(isFinanceAdmin(user,{}),false);
  assert.equal(isMasterAdmin(user,{}),false);
 }
 assert.equal(isFinanceAdmin({id,is_anonymous:true,app_metadata:{role:'master'}},{}),false);
});
