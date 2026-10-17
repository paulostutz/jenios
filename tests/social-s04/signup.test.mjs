import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {prepareSocialSignup,isCanonicalSocialSignupMetadata} from '../../lib/social/signup-policy.mjs';

const base={name:' Nome   Exemplo ',email:' TESTE@EXAMPLE.COM ',password:'SenhaSegura#2026',handle:' @Abc_123 '};
test('social signup normalizes authoritative handle, email, and name',()=>{
  const result=prepareSocialSignup(base);
  assert.equal(result.email,'teste@example.com');assert.equal(result.options.data.full_name,'Nome Exemplo');
  assert.equal(result.options.data.handle,'abc_123');
  assert.deepEqual(Object.keys(result.options.data).sort(),['full_name','handle','registration_source']);
  assert.equal(isCanonicalSocialSignupMetadata(result.options.data),true);
});
for(const change of [
  {name:' '},{name:'n'},{name:'a'.repeat(121)},{email:'bad@email'},{email:'x@b.c'.repeat(60)},
  {password:'fraca'},{password:'abcd'.repeat(40)},{handle:'ad'},{handle:'admin'},{handle:'@nome-com-hifen'}
])test('social signup rejects invalid and reserved input '+Object.keys(change),()=>{
  assert.throws(()=>prepareSocialSignup({...base,...change}),{status:400});
});
test('client cannot pass privilege or trial flags in metadata',()=>{
 const safe=prepareSocialSignup({...base,role:'admin',paid:true,trialVerified:true}).options.data;
 assert.equal('role' in safe,false);assert.equal('paid' in safe,false);
 assert.equal(isCanonicalSocialSignupMetadata({...safe,role:'admin'}),false);
});
test('signup still requires server-side availability and avoids metadata account overwrite',()=>{
 const s=readFileSync('app/components/SocialAccessForm.js','utf8');
 assert.match(s,/prepareSocialSignup/);assert.match(s,/checkHandleAvailability/);assert.match(s,/supabase\.auth\.signUp/);
 assert.doesNotMatch(s,/\.from\('profiles'\)\.insert/);
});
