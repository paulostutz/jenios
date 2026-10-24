import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {resolveConversationActor,createConversationVisitorCookie,verifyConversationVisitorCookie,CONVERSATION_VISITOR_COOKIE} from '../lib/assistant/conversation-actor.mjs';
import {handleConversations} from '../lib/assistant/conversation-service.mjs';
import {conversationRepository,adminConversationReview,cleanupExpiredConversations} from '../lib/assistant/conversation-repository.mjs';
import {conversationText,normalizeConversationSummary,initialConversationSummary,normalizeConversationToolContext,redactedReviewNote} from '../lib/assistant/conversation-contract.mjs';

const A='43000000-0000-4000-8000-000000000001',B='43000000-0000-4000-8000-000000000002';
const V='43000000-0000-4000-8000-000000000003',C='43000000-0000-4000-8000-000000000004',T='43000000-0000-4000-8000-000000000005';
const now=Date.parse('2026-10-24T20:00:00Z');
const env={JENIOS_ASSISTANT_MEMORY_ENABLED:'true',JENIOS_ASSISTANT_SESSION_SECRET:'offline-fixture-session-signing-key-never-used-in-deployment'};
function req(body=null,{method=body?'POST':'GET',headers={},query=''}={}){
 return new Request('https://jenios.test/api/assistant/conversations'+query,{method,
  headers:{origin:'https://jenios.test',...(body?{'content-type':'application/json'}:{}),...headers},
  ...(body?{body:JSON.stringify(body)}:{})});
}
const userDb={auth:{getUser:async token=>token==='valid-a'?{data:{user:{id:A,is_anonymous:false,app_metadata:{}}}}:{error:{message:'invalid token'}}}};
const cookie=createConversationVisitorCookie(env,now,V);
const header=CONVERSATION_VISITOR_COOKIE+'='+cookie.value;

test('G43 visitor identity is random, signed, HttpOnly/Secure, and expires at 24 hours',async()=>{
 const a=await resolveConversationActor(req(),{env,now}),b=await resolveConversationActor(req(),{env,now});
 assert.equal(a.kind,'visitor');assert.notEqual(a.ownerId,b.ownerId);assert.equal(a.userId,null);
 assert.match(a.setCookie,/HttpOnly/);assert.match(a.setCookie,/Secure/);assert.match(a.setCookie,/SameSite=Lax/);assert.match(a.setCookie,/Max-Age=86400/);
 const restored=await resolveConversationActor(req(null,{headers:{cookie:header}}),{env,now:now+1000});
 assert.equal(restored.ownerId,V);assert.equal(restored.setCookie,null);
 assert.equal(verifyConversationVisitorCookie(cookie.value,env,now+86400000),null);
 assert.equal(verifyConversationVisitorCookie(cookie.value,{...env,JENIOS_ASSISTANT_SESSION_SECRET:'a-different-signing-key-that-is-long-enough'},now),null);
});

test('G43 tampered, duplicate and expired visitor cookies never recover the original identity',async()=>{
 const [data,sig]=cookie.value.split('.');
 const forged=Buffer.from(JSON.stringify({v:1,id:A,issuedAt:now,expiresAt:now+86400000})).toString('base64url')+'.'+sig;
 for(const value of [forged,cookie.value+'x',data+'.'+sig.slice(1),header+'; '+header]){
  const raw=value.startsWith(CONVERSATION_VISITOR_COOKIE)?value:CONVERSATION_VISITOR_COOKIE+'='+value;
  const actor=await resolveConversationActor(req(null,{headers:{cookie:raw}}),{env,now});
  assert.notEqual(actor.ownerId,V);assert.notEqual(actor.ownerId,A);
 }
 const expired=await resolveConversationActor(req(null,{headers:{cookie:header}}),{env,now:now+86400001});
 assert.notEqual(expired.ownerId,V);
});

test('G43 valid authenticated identity overrides visitor cookie without merging histories',async()=>{
 const actor=await resolveConversationActor(req(null,{headers:{authorization:'Bearer valid-a',cookie:header}}),{env,db:userDb,now});
 assert.equal(actor.kind,'user');assert.equal(actor.ownerId,A);assert.equal(actor.userId,A);assert.equal(actor.setCookie,null);
});

test('G43 invalid or anonymous Bearer never falls back to a visitor even with a valid cookie',async()=>{
 for(const authorization of ['Bearer invalid','Basic abc','Bearer ','']){
  await assert.rejects(resolveConversationActor(req(null,{headers:{authorization,cookie:header}}),{env,db:userDb,now}),{status:401,code:'CONVERSATION_AUTH_REQUIRED'});
 }
 await assert.rejects(resolveConversationActor(req(null,{headers:{authorization:'Bearer anything',cookie:header}}),
  {env,db:{auth:{getUser:async()=>({data:{user:{id:A,is_anonymous:true}}})}},now}),{status:401});
 await assert.rejects(resolveConversationActor(req(),{env,now,allowVisitor:false}),{status:401});
});

test('G43 user verification failures are fail-closed and a missing visitor signing key has no fallback',async()=>{
 await assert.rejects(resolveConversationActor(req(null,{headers:{authorization:'Bearer valid-a'}}),{db:{auth:{getUser:async()=>{throw Error('network');}}},env,now}),{status:503});
 await assert.rejects(resolveConversationActor(req(),{env:{},now}),{status:503});
 const user=await resolveConversationActor(req(null,{headers:{authorization:'Bearer valid-a'}}),{env:{},db:userDb,now});
 assert.equal(user.userId,A);
});

test('G43 memory disabled preserves an available:false GET without constructing a database client',async()=>{
 let calls=0;
 const r=await handleConversations(req(),{env:{},getDb:()=>{calls++;throw Error('must not connect');}});
 assert.equal(r.status,200);assert.deepEqual(await r.json(),{ok:true,available:false});assert.equal(calls,0);
 const post=await handleConversations(req({action:'create'}),{env:{},getDb:()=>{calls++;}});
 assert.equal(post.status,503);assert.equal(calls,0);
});

test('G43 API rejects cross-origin, oversized chunks and caller-supplied owner/summary fields',async()=>{
 let mutations=0;
 const deps={env,now,db:userDb,repository:()=>({create:async()=>{mutations++;return{id:C};}})};
 const bad=await handleConversations(req({action:'create',channel:'support',persona:'genio',remember:false},{headers:{origin:'https://foreign.invalid'}}),deps);
 assert.equal(bad.status,403);
 for(const extra of [{userId:B},{ownerId:B},{role:'master'},{summary:initialConversationSummary()},{requestFingerprint:'a'.repeat(64)}]){
  const r=await handleConversations(req({action:'create',channel:'support',persona:'genio',remember:false,...extra},{headers:{authorization:'Bearer valid-a'}}),deps);
  assert.equal(r.status,400);
 }
 const large=await handleConversations(req({action:'feedback',note:'x'.repeat(9000)}),deps);
 assert.equal(large.status,413);assert.equal(mutations,0);
 const query=await handleConversations(req(null,{query:'?channel=support&ownerId='+B}),deps);assert.equal(query.status,400);
});

test('G43 visitor API sets a protected cookie and does not return internal ownership',async()=>{
 let seen;
 const r=await handleConversations(req({action:'create',channel:'support',persona:'genia',remember:false}),{env,now,db:{},
  repository:(_db,actor)=>{seen=actor;return{create:async input=>({id:C,...input,revision:0,turns:[]})};}});
 const data=await r.json();assert.equal(data.ok,true);assert.equal(data.conversation.persona,'genia');
 assert.match(r.headers.get('set-cookie'),/__Host-jenios-assistant-session=/);
 assert.equal(JSON.stringify(data).includes(seen.ownerId),false);assert.match(r.headers.get('vary'),/Cookie/);
});

test('G43 repository uses server owner, rejects visitor Pro and opt-in retention without account',async()=>{
 const calls=[];
 const db={rpc:async(name,args)=>{calls.push({name,args});return{data:{ok:true,conversation:{id:C},conversations:[]}};}};
 const visitor=conversationRepository(db,{kind:'visitor',ownerId:V});
 await assert.rejects(visitor.create({channel:'pro'}),{status:401});
 await assert.rejects(visitor.create({remember:true}),{status:400});assert.equal(calls.length,0);
 const user=conversationRepository(db,{kind:'user',ownerId:A});
 await user.create({channel:'support',persona:'genia',remember:true});await user.read(C);
 assert(calls.every(c=>c.args.p_owner_id===A&&c.args.p_owner_kind==='user'));
 assert.equal(calls[0].args.p_payload.remember,true);
});

test('G43 repository distinguishes revision/owner failures and never returns DB errors or credentials',async()=>{
 const db={rpc:async()=>({error:{message:'CONVERSATION_REVISION_CONFLICT'}})};
 await assert.rejects(conversationRepository(db,{kind:'user',ownerId:A}).setPersona({id:C,revision:2,persona:'genia'}),{status:409,code:'CONVERSATION_REVISION_CONFLICT'});
 db.rpc=async()=>({error:{message:'CONVERSATION_NOT_FOUND'}});
 await assert.rejects(conversationRepository(db,{kind:'user',ownerId:A}).read(C),{status:404});
 db.rpc=async()=>({error:{message:'server-secret-that-must-never-be-returned'}});
 await assert.rejects(conversationRepository(db,{kind:'user',ownerId:A}).read(C),e=>e.status===503&&!e.message.includes('server-secret'));
});

test('G43 support tools bind a server fingerprint without persisting the public identifier in the question',async()=>{
 const calls=[];
 const repo=conversationRepository({rpc:async(name,args)=>{calls.push(args);return{data:{ok:true,state:'claimed'}};}},{kind:'user',ownerId:A});
 await repo.claimTurn({id:C,turnId:T,revision:0,question:'Consulta crypto_basic: transação Ethereum.',requestFingerprint:'a'.repeat(64)});
 assert.equal(calls[0].p_payload.requestFingerprint,'a'.repeat(64));
 assert.equal(calls[0].p_payload.question,'Consulta crypto_basic: transação Ethereum.');
 await assert.rejects(repo.claimTurn({id:C,turnId:T,revision:0,question:'Consulta crypto_basic.',requestFingerprint:'invalid'}),{status:400});
 assert.equal(calls.length,1);
});

test('G43 persona/delete/feedback public contract uses conversationId and maps revision without accepting id aliases',async()=>{
 const calls=[];
 const fakeRepo={setPersona:async x=>{calls.push(x);return{id:C,persona:x.persona};},remove:async x=>{calls.push(x);return{deleted:true};},
 feedback:async x=>{calls.push(x);return{feedback:{rating:x.rating}};}};
 const deps={env,db:userDb,now,repository:()=>fakeRepo};
 for(const body of [
  {action:'persona',conversationId:C,revision:3,persona:'genia'},
  {action:'delete',conversationId:C,revision:4},
  {action:'feedback',conversationId:C,turnId:T,rating:'needs_review',note:'Precisa explicar o passo.',allowReview:true}
 ]){
  const r=await handleConversations(req(body,{headers:{authorization:'Bearer valid-a'}}),deps);assert.equal(r.status,200);
 }
 assert(calls.every(x=>x.id===C));assert.equal(calls[0].revision,3);assert.equal(calls[2].allowReview,true);
 const bad=await handleConversations(req({action:'delete',id:C,revision:4},{headers:{authorization:'Bearer valid-a'}}),deps);assert.equal(bad.status,400);
});

test('G43 server summary separates unverified user corrections from verified material and rejects escalation',()=>{
 const s=normalizeConversationSummary({version:1,topic:'plans',articleIds:['plans'],planCodes:['platform-global-crypto'],
  corrections:[{text:'Prefiro somente cripto.',origin:'user',verified:false,createdAt:new Date(now).toISOString()}],reportedStep:null});
 assert.equal(s.corrections[0].verified,false);assert.equal(s.corrections[0].origin,'user');
 assert.throws(()=>normalizeConversationSummary({...s,corrections:[{...s.corrections[0],verified:true}]}));
 assert.throws(()=>normalizeConversationSummary({...s,userId:B}));
 assert.throws(()=>normalizeConversationSummary({...s,corrections:Array(4).fill(s.corrections[0])}));
 assert.throws(()=>normalizeConversationSummary({...s,planCodes:['free-admin']}));assert.throws(()=>conversationText('senha=not-real-fixture-value',2500),{code:'CONVERSATION_SENSITIVE_INPUT'});
});

test('G43 historical tool evidence stays dated, verified by server and separate from user text',()=>{
 const context={origin:'server',verified:true,tool:'trends',observedAt:new Date(now).toISOString(),sourceAt:new Date(now-3600000).toISOString(),
  facts:[{label:'Fonte','value':'Série histórica encerrada.'}]};
 assert.deepEqual(normalizeConversationToolContext(context),context);
 assert.throws(()=>normalizeConversationToolContext({...context,origin:'user'}));
 assert.throws(()=>normalizeConversationToolContext({...context,verified:false}));
 assert.throws(()=>normalizeConversationToolContext({...context,userId:B}));
 assert.throws(()=>normalizeConversationToolContext({...context,facts:Array.from({length:8},()=>({label:'Texto',value:'á'.repeat(450)}))}));
});

test('G43 Pro refresh repairs at most two same-owner pending turns without a provider or new claim',async()=>{
 const pending=[1,2,3].map(()=>({turnId:randomUUID(),status:'uncertain'}));let repairs=0;
 const deps={env,db:userDb,now,repository:(_db,actor)=>{
  assert.equal(actor.ownerId,A);return{read:async()=>({id:C,channel:'pro',turns:pending}),
   repairProTurn:async({id,turnId})=>{assert.equal(id,C);assert(pending.some(t=>t.turnId===turnId));repairs++;return{repaired:true,conversation:{id:C,channel:'pro',turns:pending.map(t=>({...t,status:'completed'}))}};}};
 }};
 const r=await handleConversations(req(null,{query:'?channel=pro&id='+C,headers:{authorization:'Bearer valid-a'}}),deps);
 assert.equal(r.status,200);assert.equal(repairs,2);
 const guest=await handleConversations(req(null,{query:'?channel=pro&id='+C,headers:{cookie:header}}),deps);assert.equal(guest.status,401);
});

test('G43 explicitly shared feedback strips common identifiers and secrets before persistence',async()=>{
 const note=redactedReviewNote('Responder a teste@example.invalid, CPF 123.456.789-01, fone (11) 99999-8888. O passo ficou confuso.');
 assert(!note.includes('teste@example.invalid'));assert(!note.includes('123.456.789-01'));assert(!note.includes('99999-8888'));assert(note.includes('O passo ficou confuso.'));
 assert.throws(()=>redactedReviewNote('Minha api_key=sk-fixturesecret1234567890'),{code:'CONVERSATION_SENSITIVE_INPUT'});
 let args;const db={rpc:async(name,input)=>{args={name,input};return{data:{ok:true,feedback:{id:T}}};}};
 await conversationRepository(db,{kind:'user',ownerId:A}).feedback({id:C,turnId:T,rating:'needs_review',note:'E-mail teste@example.invalid',allowReview:true});
 assert.equal(args.input.p_payload.allowReview,true);assert(!args.input.p_payload.note.includes('teste@example.invalid'));
});

test('G43 administration and cleanup call only dedicated bounded RPCs',async()=>{
 const calls=[];const db={rpc:async(name,args)=>{calls.push({name,args});return{data:name.includes('cleanup')?2:{ok:true,items:[],autoPublished:false}};}};
 assert.equal((await adminConversationReview(db)).autoPublished,false);assert.equal(await cleanupExpiredConversations(db),2);
 assert.equal(calls[0].name,'jenios_assistant_review_g43');assert.equal(calls[1].name,'jenios_assistant_cleanup_g43');
 await assert.rejects(adminConversationReview(db,{limit:5000}),{status:400});await assert.rejects(cleanupExpiredConversations(db,{limit:5001}),{status:400});
});

