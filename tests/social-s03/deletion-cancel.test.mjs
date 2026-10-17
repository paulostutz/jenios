import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {cancelAccountDeletion,CANCEL_CONFIRMATION} from '../../lib/social/account-deletion-cancel.mjs';
const uid='11111111-1111-4111-8111-111111111111',now=Date.parse('2026-10-17T20:00:00Z');
function mock({signIn=now,uidFromAuth=uid,dbError=false,row={id:'request-1',status:'cancelled',created_at:'2026-10-17'},anonymous=false}={}){
 const calls=[];
 const db={auth:{getUser:async()=>({data:{user:{id:uidFromAuth,last_sign_in_at:new Date(signIn).toISOString(),is_anonymous:anonymous}},error:null})},
  from(table){calls.push(['table',table]);const q={update(fields){calls.push(['update',fields]);return q},eq(key,val){calls.push(['eq',key,val]);return q},select(fields){calls.push(['select',fields]);return q},async maybeSingle(){return {data:row,error:dbError?{message:'backend error'}:null}}};return q;}};
 return {context:async()=>({db,userId:uid}),now:()=>now,calls};
}
function req(body={confirmation:CANCEL_CONFIRMATION},options={}) {return new Request('https://jenios.test/api/social/account-deletion/cancel',{method:options.method||'POST',headers:{'content-type':'application/json',authorization:'Bearer user-token',...(options.headers||{})},body:options.method==='GET'?undefined:JSON.stringify(body)});}
test('owner can cancel pending request by updating status only',async()=>{
 const env=mock();const r=await cancelAccountDeletion(req(),env),body=await r.json();
 assert.equal(r.status,200);assert.equal(body.accountDeleted,false);assert.equal(body.request.status,'cancelled');
 assert.deepEqual(env.calls,[['table','social_account_deletion_requests'],['update',{status:'cancelled'}],['eq','user_id',uid],['eq','status','pending'],['select','id,status,created_at']]);
});
test('already processed/completed request cannot be silently cancelled',async()=>{
 const r=await cancelAccountDeletion(req(),mock({row:null}));assert.equal(r.status,409);
});
test('backend error cannot claim cancellation',async()=>{
 const r=await cancelAccountDeletion(req(),mock({dbError:true}));assert.equal(r.status,503);assert.match((await r.json()).error,/Nenhuma mudança/);
});
test('old session and a different account cannot cancel',async()=>{
 assert.equal((await cancelAccountDeletion(req(),mock({signIn:now-20*60000}))).status,403);
 assert.equal((await cancelAccountDeletion(req(),mock({uidFromAuth:'another'}))).status,401);
 assert.equal((await cancelAccountDeletion(req(),mock({anonymous:true}))).status,401);
});
test('unauthenticated request returns 401',async()=>{
 assert.equal((await cancelAccountDeletion(req(),{context:async()=>({error:'AUTH_REQUIRED',status:401})})).status,401);
});
for(const invalid of [null,{},'cancel',{confirmation:'EXCLUIR MINHA CONTA'},{confirmation:CANCEL_CONFIRMATION,userId:'victim'}])test('reject missing or tampered confirmation '+JSON.stringify(invalid),async()=>{
 const env=mock();const r=await cancelAccountDeletion(req(invalid),env);assert.equal(r.status,400);assert.equal(env.calls.length,0);
});
test('cross-origin and invalid content type fail before auth',async()=>{
 let called=0;const env={context:async()=>{called++;return mock();}};
 assert.equal((await cancelAccountDeletion(req(undefined,{headers:{origin:'https://evil.test'}}),env)).status,403);
 assert.equal((await cancelAccountDeletion(req(undefined,{headers:{'content-type':'text/plain'}}),env)).status,415);
 assert.equal(called,0);
});
test('non POST methods remain disabled',async()=>{
 for(const method of ['GET','PUT','DELETE','PATCH']){
  const r=await cancelAccountDeletion(new Request('https://jenios.test/api/social/account-deletion/cancel',{method}),mock());assert.equal(r.status,405);
 }
});
test('staging SQL restricts updates to pending owner and status cancelled only',()=>{
 const sql=readFileSync('supabase/review-only/20261017_s03_deletion_cancel_STAGING_ONLY.sql','utf8');
 assert.match(sql,/GRANT UPDATE\(status\)/);assert.match(sql,/FOR UPDATE TO authenticated/);assert.match(sql,/user_id=\(SELECT auth.uid\(\)\) AND status='pending'/);assert.match(sql,/WITH CHECK \(user_id=\(SELECT auth.uid\(\)\) AND status='cancelled'\)/);
 const route=readFileSync('app/api/social/account-deletion/cancel/route.js','utf8');assert.match(route,/socialContext/);assert.doesNotMatch(route,/service_role|SUPABASE_SECRET/);
});
