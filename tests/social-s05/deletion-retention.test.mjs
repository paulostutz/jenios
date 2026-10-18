import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';import {evaluateAccountErasure} from '../../lib/social/deletion-retention-plan.mjs';
const accountId='11111111-1111-4111-8111-111111118801';
const relations=[{table:'jenios_pay_orders',onDelete:'NO ACTION'},{table:'posts',onDelete:'CASCADE'},{table:'jenios_direct_messages_v7',onDelete:'NO ACTION'}];
test('financial/messaging obligations block automatic erasure',()=>{
 const a=evaluateAccountErasure({accountId,foreignKeys:relations});assert.equal(a.executable,false);assert.equal(a.manualReview,true);
 assert.deepEqual(a.retentionCategories,['jenios_direct_messages_v7','jenios_pay_orders']);
});
test('even without known relations erasure is not implicitly enabled',()=>{
 const a=evaluateAccountErasure({accountId,foreignKeys:[]});assert.equal(a.executable,false);assert.equal(a.decision,'HUMAN_APPROVAL_REQUIRED');
});
test('legal holds override ordinary processing',()=>{
 assert.equal(evaluateAccountErasure({accountId,foreignKeys:relations,hasLegalHold:true}).decision,'LEGAL_HOLD');
});
for(const candidate of [{},{accountId:'invalid',foreignKeys:relations},{accountId,foreignKeys:null}])
 test('unknown account/relation states fail closed',()=>assert.equal(evaluateAccountErasure(candidate).executable,false));
test('request/withdrawal/reopen APIs never execute destructive deletion',()=>{
 for(const name of ['lib/social/account-deletion.mjs','lib/social/account-deletion-cancel.mjs','app/api/social/account-deletion/route.js']){
  const s=readFileSync(name,'utf8');assert.doesNotMatch(s,/\bdeleteUser\(|auth\.admin\.deleteUser|DELETE FROM auth\.users|storage\.remove\(/i);
 }
});
