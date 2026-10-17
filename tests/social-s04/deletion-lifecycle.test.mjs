import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {accountDeletionRequest,DELETION_CONFIRMATION,DELETION_VERSION} from '../../lib/social/account-deletion.mjs';
import {cancelAccountDeletion,CANCEL_CONFIRMATION} from '../../lib/social/account-deletion-cancel.mjs';
const uid='11111111-1111-4111-8111-111111111111',now=Date.parse('2026-10-17T17:00:00Z');
function fake({status='cancelled',failure=false,uidFromAuth=uid}={}){
 const calls=[],base={id:'req-1',status,created_at:new Date(now-60000).toISOString()};
 const q={select(){return this},eq(k,v){calls.push([k,v]);return this},async maybeSingle(){return {data:base}},update(fields){calls.push(['update',fields]);return this}};
 const db={auth:{getUser:async()=>({data:{user:{id:uidFromAuth,last_sign_in_at:new Date(now-30000).toISOString(),is_anonymous:false}}})},
  from(){return q},async rpc(name){calls.push(['rpc',name]);return failure?{error:{code:'42P01'}}:{data:{...base,status:'pending'}}}};
 return {context:async()=>({userId:uid,db}),now:()=>now,calls};
}
function req(){return new Request('https://jenios.example/api/social/account-deletion',{method:'POST',headers:{authorization:'Bearer real-token','content-type':'application/json'},body:JSON.stringify({confirmation:DELETION_CONFIRMATION,understood:true})});}
test('owner can reopen cancelled request atomically without creating a second row',async()=>{
 const ctx=fake();const r=await accountDeletionRequest(req(),ctx);
 assert.equal(r.status,202);const j=await r.json();assert.equal(j.accountDeleted,false);assert.equal(j.request.status,'pending');
 assert(ctx.calls.some(c=>c[0]==='rpc'&&c[1]==='social_reopen_deletion_request_v1'));
 assert(!ctx.calls.some(c=>c[0]==='insert'));
});
test('when SQL function is not installed, cancellation re-open fails closed',async()=>{
 const ctx=fake({failure:true});const r=await accountDeletionRequest(req(),ctx);assert.equal(r.status,503);assert(!ctx.calls.some(c=>c[0]==='insert'));
});
for(const status of ['processing','completed'])test('processing/completed state is never reopened '+status,async()=>{
 const ctx=fake({status});const r=await accountDeletionRequest(req(),ctx);assert.equal(r.status,409);
 assert(!ctx.calls.some(c=>c[0]==='rpc'));assert.equal((await r.json()).accountDeleted,false);
});
test('identity changes block re-opening',async()=>{
 assert.equal((await accountDeletionRequest(req(),fake({uidFromAuth:'other'}))).status,401);
});
test('S04 staging SQL performs status-bound UPDATE and minimal append-only audit',()=>{
 const sql=readFileSync('supabase/review-only/20261017_s04_deletion_state_machine_STAGING_ONLY.sql','utf8');
 assert.match(sql,/REVIEW \/ STAGING ONLY/);
 assert.match(sql,/social_reopen_deletion_request_v1/);
 assert.match(sql,/uid:=auth.uid\(\)/);
 assert.match(sql,/NOT public.social_has_recent_auth_v1\(\)/);
 assert.match(sql,/WHERE r.user_id=uid AND r.status='cancelled'/);
 assert.match(sql,/REVOKE ALL ON public.social_account_deletion_audit_v1 FROM PUBLIC,anon,authenticated/);
 assert.match(sql,/event IN\('requested','reopened','cancelled'\)/);
 assert.doesNotMatch(sql,/DELETE FROM|DROP TABLE|TRUNCATE|auth\.admin|storage\.remove/i);
 const newRoute=readFileSync('app/api/social/account-deletion/route.js','utf8');
 assert(!newRoute.includes('service_role'));
});