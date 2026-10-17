import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {deletionAction} from '../../lib/social/deletion-ui-state.mjs';
import {accountDeletionRequest,DELETION_CONFIRMATION} from '../../lib/social/account-deletion.mjs';
const uid='11111111-1111-4111-8111-111111111111',now=Date.parse('2026-10-17T19:00:00Z');
test('deletion action states never offer reopen for active, processing or completed',()=>{
 assert.equal(deletionAction(null),'request');
 assert.equal(deletionAction('pending'),'cancel');
 assert.equal(deletionAction('cancelled'),'reopen');
 assert.equal(deletionAction('processing'),'read-only');
 assert.equal(deletionAction('completed'),'read-only');
 assert.equal(deletionAction('unknown'),'read-only');
});
test('cancelled request is visible with re-open option and requires confirmation',()=>{
 const src=readFileSync('app/social/configuracoes/page.js','utf8');
 assert.match(src,/deletionAction\(record.status\)==='reopen'/);
 assert.match(src,/Reabrir solicitação de exclusão/);
 assert.match(src,/record\.status==='cancelled'\?'Você pode reabrir/);
 assert.match(src,/onSubmit=\{submit\}/);
 assert.match(src,/confirmation!==DELETION_CONFIRMATION/);
 assert.match(src,/!understood/);
 assert.match(src,/deletionAction\(record.status\)==='cancel'/);
 assert.match(src,/record\.status\]\|\|'Em análise'/);
});
test('reopen uses existing authenticated server RPC and never inserts a duplicate',async()=>{
 let invoked=0,inserted=0;
 const existing={id:'req-1',status:'cancelled',created_at:new Date(now-20000).toISOString()};
 const q={select(){return this},eq(){return this},async maybeSingle(){return {data:existing}},insert(){inserted++;return this}};
 const db={from(){return q},auth:{async getUser(){return {data:{user:{id:uid,is_anonymous:false,last_sign_in_at:new Date(now-1000).toISOString()}}}}},async rpc(name){assert.equal(name,'social_reopen_deletion_request_v1');invoked++;return {data:{...existing,status:'pending'}}}};
 const request=new Request('https://jenios.example/api/social/account-deletion',{method:'POST',headers:{authorization:'Bearer test-token','content-type':'application/json'},body:JSON.stringify({confirmation:DELETION_CONFIRMATION,understood:true})});
 const response=await accountDeletionRequest(request,{context:async()=>({userId:uid,db}),now:()=>now});
 assert.equal(response.status,202);
 assert.equal((await response.json()).request.status,'pending');
 assert.equal(invoked,1);assert.equal(inserted,0);
});
