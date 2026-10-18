import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {validateHandle,parseAvailability} from '../../lib/social/handle-policy.mjs';
import {handleAvailabilityRequest} from '../../lib/social/handle-server.mjs';
import {DELETION_CONFIRMATION,RECENT_AUTH_MS} from '../../lib/social/account-deletion.mjs';
const src=p=>readFileSync(p,'utf8');
const migration=src('supabase/release-review/20261018_s05_social_identity_deletion_PRODUCTION_REVIEW_ONLY.sql');

test('S05 production migration is review-only and requires explicit production-schema preflight',()=>{
 assert.match(migration,/PRODUCTION REVIEW ONLY; NOT EXECUTED/);
 assert.match(migration,/PRODUCTION_EXPECTED_SOCIAL_SCHEMA_MISSING/);
 assert.match(migration,/NOT_ALLOWED_ON_ISOLATED_STAGING_PROJECT/);
 assert.match(migration,/SET LOCAL lock_timeout='5s'/);
 assert.doesNotMatch(migration,/\bDROP TABLE\b|\bTRUNCATE\b|\bDELETE FROM auth\.users\b/i);
});
test('Social signup creates only self profile, keeps canonical uniqueness and does not alter old profiles',()=>{
 assert.match(migration,/CREATE UNIQUE INDEX IF NOT EXISTS profiles_handle_canonical_unique_v1/);
 assert.match(migration,/SOCIAL_HANDLE_CASE_COLLISION/);
 assert.match(migration,/NEW\.raw_user_meta_data->>'registration_source' IS DISTINCT FROM 'social'/);
 assert.match(migration,/INSERT INTO public\.profiles\(id,handle,display_name\)/);
 assert.doesNotMatch(migration,/\bUPDATE public\.profiles SET\b/i);
});
test('handles: four suggestions and reserved identifiers rejected',()=>{
 for(const reserved of ['admin','jenios','support'])assert.equal(validateHandle(reserved).ok,false);
 const result=parseAvailability({handle:'sample',available:false,suggestions:['sample_1','sample_2','sample_3','sample_4','sample_5']},'sample');
 assert.equal(result.suggestions.length,4);
 assert.match(migration,/EXIT WHEN cardinality\(choices\)=4/);
});
test('handle availability fails closed if RPC unavailable, no invented available status',async()=>{
 const req=new Request('https://jenios.test/api/social/handles?handle=sample');
 const unavailable=await handleAvailabilityRequest(req,{database:()=>null});
 assert.equal(unavailable.status,503);
 const noRpc=await handleAvailabilityRequest(req,{database:()=>({rpc:async()=>({data:null,error:{message:'missing'}})})});
 assert.equal(noRpc.status,503);
});
test('account deletion is a reviewed request, not a destructive automatic action',()=>{
 assert.equal(DELETION_CONFIRMATION,'EXCLUIR MINHA CONTA');
 assert.equal(RECENT_AUTH_MS,900000);
 assert.match(migration,/social_account_deletion_requests/);
 assert.match(migration,/social_has_recent_auth_v1/);
 assert.match(migration,/social_reopen_deletion_request_v1/);
 assert.match(migration,/social_deletion_cancel_pending_self_v1/);
 assert.match(src('lib/social/account-deletion.mjs'),/accountDeleted:false/);
 assert.doesNotMatch(src('lib/social/account-deletion.mjs'),/auth\.admin\.deleteUser/);
});
test('confirmation points to public Social, no lab in release',()=>{
 const confirm=src('app/auth/confirm/page.js');
 assert.match(confirm,/href="\/social"/);
 assert.doesNotMatch(confirm,/\/s04-laboratorio/);
 assert.equal(existsSync('middleware.js'),false);
});
