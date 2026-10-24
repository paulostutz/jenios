import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeNewsletterAction,readNewsletterBody,NEWSLETTER_SUBJECT} from '../lib/email/newsletter-admin.mjs';
const now=Date.parse('2026-10-24T12:00:00Z');
const valid=()=>({action:'create',editionKey:'radar-2026-10-25',scheduledAt:'2026-10-25T12:00:00Z',
 items:[{title:'Título verificado',summary:'Resumo editorial com contexto.',sourceName:'Fonte original',sourceUrl:'https://example.com/noticia'}]});
test('R42 newsletter keeps the approved subject and separates draft from approval',()=>{
 const value=normalizeNewsletterAction(valid(),{now});
 assert.equal(value.action,'create');assert.equal(value.id,null);assert.equal(value.payload.subject,NEWSLETTER_SUBJECT);
 assert.equal(value.payload.items.length,1);assert.equal(value.payload.scheduled_at,'2026-10-25T12:00:00.000Z');
 const approved=normalizeNewsletterAction({action:'approve',id:'1d35264a-0123-4234-9234-123456789012',revision:2},{now});
 assert.deepEqual(approved.payload,{});assert.equal(approved.revision,2);
});
test('R42 newsletter rejects recipient injection, editable roles and invalid revision',()=>{
 for(const extra of [{to:'someone@example.com'},{actorId:'fake'},{role:'master'},{status:'approved'},{subject:'Different'}])
  assert.throws(()=>normalizeNewsletterAction({...valid(),...extra},{now}),{status:400});
 assert.throws(()=>normalizeNewsletterAction({...valid(),action:'save',id:'invalid',revision:0},{now}),{status:400});
 assert.throws(()=>normalizeNewsletterAction({action:'approve',id:'1d35264a-0123-4234-9234-123456789012',revision:0,items:[]},{now}),{status:400});
});
test('R42 newsletter accepts only bounded HTTPS sources without embedded credentials',()=>{
 for(const url of ['javascript:alert(1)','http://example.com','https://user:pass@example.com','https://localhost','https://127.0.0.1/a','https://192.168.1.2/a']){
  const input=valid();input.items[0].sourceUrl=url;
  assert.throws(()=>normalizeNewsletterAction(input,{now}),{status:400},url);
 }
 const input=valid();input.items[0].summary='a'.repeat(1401);
 assert.throws(()=>normalizeNewsletterAction(input,{now}),{status:400});
 assert.throws(()=>normalizeNewsletterAction({...valid(),items:[]},{now}),{status:400});
 assert.throws(()=>normalizeNewsletterAction({...valid(),scheduledAt:'2028-01-01'},{now}),{status:400});
});
test('R42 newsletter request body enforces size even without content length',async()=>{
 const request=body=>new Request('https://www.jenios.com.br/api/admin/newsletters',{method:'POST',headers:{'content-type':'application/json'},body});
 assert.deepEqual(await readNewsletterBody(request(JSON.stringify(valid()))),valid());
 await assert.rejects(readNewsletterBody(request('"'+'a'.repeat(24001)+'"')),{status:413});
 await assert.rejects(readNewsletterBody(request('{bad')),{status:400});
});
test('R42 newsletter API uses verified Master authorization and a single audited RPC',()=>{
 const source=readFileSync('app/api/admin/newsletters/route.js','utf8');
 assert.match(source,/requireAdminPermission\(request,db,'permissions.manage'\)/);
 assert.match(source,/noCrossOriginMutation\(request\)/);
 assert.match(source,/p_actor_id:actor.id/);
 assert.match(source,/jenios_manage_newsletter_r42/);
 assert.doesNotMatch(source,/sendResend|RESEND_API_KEY|\.auth\.admin|\.insert\(/);
 const migration=readFileSync('supabase/migrations/20261024175918_jenios_email_newsletter_admin_r42.sql','utf8');
 assert.match(migration,/SECURITY INVOKER SET search_path=''/);
 assert.match(migration,/FOR UPDATE/);
 assert.match(migration,/edition\.revision<>p_expected_revision/);
 assert.match(migration,/INSERT INTO public\.jenios_admin_audit/);
 assert.match(migration,/REVOKE ALL ON FUNCTION[\s\S]*FROM PUBLIC,anon,authenticated/);
});
