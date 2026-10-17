import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateHandle,normalizeHandle,parseAvailability} from '../../lib/social/handle-policy.mjs';
test('canonical identities match across case/leading @ and reject reserved variants',()=>{
 for(const input of ['@EXEMPLO','  exemplo','exemplo'])assert.deepEqual(validateHandle(input),{ok:true,handle:'exemplo'});
 for(const input of ['@ADMIN','  Administrador  ','@Social','suporte'])assert.equal(validateHandle(input).ok,false);
});
test('availability never guarantees reservation before final signup trigger',()=>{
 const ui=readFileSync('app/components/SocialHandleField.js','utf8');
 assert.match(ui,/parece disponível agora/);assert.match(ui,/confirmação ocorre ao concluir/);
 const sql=readFileSync('supabase/review-only/20261017180000_social_identity_candidate.sql','utf8');
 assert.match(sql,/CREATE UNIQUE INDEX IF NOT EXISTS profiles_handle_canonical_unique_v1/);
 assert.match(sql,/AFTER INSERT ON auth.users/);
 assert.match(sql,/SOCIAL_HANDLE_CASE_COLLISION/);
 assert.match(sql,/SOCIAL_SIGNUP_PROFILE_INVALID/);
});
test('two distinct case-equivalent signup attempts are not both admitted in atomic uniqueness model (not live Postgres)',async()=>{
 const handles=new Set();
 async function checkAndInsert(raw){const h=validateHandle(raw).handle;
  return Promise.resolve().then(()=>{if(handles.has(h))return false;handles.add(h);return true;});}
 const two=await Promise.all([checkAndInsert('TESTUSER'),checkAndInsert('@testuser')]);
 assert.deepEqual(two.sort(),[false,true]);assert.equal(handles.size,1);
});
test('malformed availability payload cannot masquerade as an available handle',()=>{
 assert.throws(()=>parseAvailability({handle:'target',available:'true',suggestions:[]},'target'));
 assert.throws(()=>parseAvailability({handle:'another',available:true,suggestions:[]},'target'));
 const x=parseAvailability({handle:'target',available:false,suggestions:['free_1','@FREE_2','invalid-x','free_1']},'target');
 assert.deepEqual(x.suggestions,['free_1']);
});
