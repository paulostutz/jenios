import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateHandle,normalizeHandle,parseAvailability,checkHandleAvailability,createLatestHandleLookup} from '../../lib/social/handle-policy.mjs';
import {handleAvailabilityRequest} from '../../lib/social/handle-server.mjs';
const url='https://jenios.test/api/social/handles?handle=Meu_Usuario';
const request=()=>new Request(url,{method:'GET'});
test('case folding, prefixes and allowed characters are deterministic',()=>{
 assert.equal(normalizeHandle(' @PAULO_123 '),'paulo_123');assert.equal(validateHandle(' @PAULO_123 ').ok,true);
 for(const h of ['JENIOS','Admin','A!','àbc','a b','a','x'.repeat(31)])assert.equal(validateHandle(h).ok,false,h);
});
test('database response must be for the exact requested handle and avoid unverified suggestions',()=>{
 assert.throws(()=>parseAvailability({handle:'different',available:true,suggestions:[]},'janio_1'));
 const p=parseAvailability({handle:'janio_1',available:false,suggestions:['janio_2','janio_2','ADMIN','bad!','Janio_3','janio_1']},'janio_1');
 assert.deepEqual(p.suggestions,['janio_2']);
});
test('handle endpoint returns unavailable instead of pretending @ is free with no database',async()=>{
 const r=await handleAvailabilityRequest(request(),{database:async()=>null});assert.equal(r.status,503);assert.equal(r.headers.get('cache-control'),'no-store');
});
test('handle endpoint rejects invalid handle before database',async()=>{
 let used=false;const r=await handleAvailabilityRequest(new Request('https://jenios.test/api/social/handles?handle=admin'),{database:async()=>{used=true;}});
 assert.equal(r.status,400);assert.equal(used,false);
});
test('SQL RPC failure denies claim and never returns available:true',async()=>{
 const r=await handleAvailabilityRequest(request(),{database:async()=>({rpc:async()=>({error:{code:'NO_FN'},data:null})})});
 assert.equal(r.status,503);assert.equal((await r.json()).available,undefined);
});
test('valid public RPC gives only normalized handle, availability and suggestions',async()=>{
 const r=await handleAvailabilityRequest(request(),{database:async()=>({rpc:async(name,args)=>{
  assert.equal(name,'social_handle_availability_v1');assert.equal(args.p_handle,'meu_usuario');
  return {data:{handle:'meu_usuario',available:false,suggestions:['meu_usuario_1']},error:null};
 }})});
 assert.equal(r.status,200);assert.deepEqual(await r.json(),{handle:'meu_usuario',available:false,suggestions:['meu_usuario_1']});
});
test('HTTP check does not accept server response for another @ or a non-200 response',async()=>{
 await assert.rejects(checkHandleAvailability('paulo',{fetcher:async()=>new Response(JSON.stringify({handle:'evil',available:true,suggestions:[]}))}));
 await assert.rejects(checkHandleAvailability('paulo',{fetcher:async()=>new Response(JSON.stringify({error:'offline'}),{status:503})}));
});
test('latest lookup cannot deliver an outdated result after field changes',async()=>{
 const handles=[];let finish;
 const lookup=createLatestHandleLookup(async()=>new Promise(resolve=>{finish=resolve}));
 const first=lookup.check('old',v=>handles.push(v.handle));lookup.cancel();finish({handle:'old',available:true,suggestions:[]});await first;
 assert.deepEqual(handles,[]);
});
test('registration UI never trusts an availability response as a unique reservation',()=>{
 const source=readFileSync('app/components/SocialAccessForm.js','utf8');
 assert.match(source,/checkHandleAvailability\(signup\.options\.data\.handle\)/);assert.match(source,/auth\.signUp/);
 const policy=readFileSync('lib/social/signup-policy.mjs','utf8');assert.match(policy,/registration_source:'social'/);assert.doesNotMatch(source+policy,/user_metadata.*is_admin|admin: true/);
 const cadastro=readFileSync('app/cadastro/page.js','utf8');assert.doesNotMatch(cadastro,/alert\(/);assert.match(cadastro,/SocialAccessForm/);
});
test('migration enforces normalized uniqueness in DB with transaction and no existing-profile mass updates',()=>{
 const s=readFileSync('supabase/review-only/20261017180000_social_identity_candidate.sql','utf8');
 assert.match(s,/UNIQUE INDEX IF NOT EXISTS profiles_handle_canonical_unique_v1/);
 assert.match(s,/SOCIAL_HANDLE_CASE_COLLISION/);assert.match(s,/AFTER INSERT ON auth\.users/);
 assert.match(s,/social_signup_profile_v1/);assert.match(s,/ON FUNCTION public\.social_handle_availability_v1\(text\) TO anon,authenticated/);
 assert.doesNotMatch(s,/UPDATE public\.profiles SET|DELETE FROM public\.profiles|TRUNCATE/);
});