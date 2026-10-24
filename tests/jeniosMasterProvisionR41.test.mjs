/** Operator bootstrap contract. All Auth responses and credentials are synthetic;
 * the global transport is forbidden so no test can contact a real service. */
import test,{after,mock} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createMasterProvisionHandler} from '../scripts/admin/master-provision-r41.mjs';

const network=mock.method(globalThis,'fetch',()=>{throw Error('BOOTSTRAP_TEST_NETWORK_FORBIDDEN');});
after(()=>{assert.equal(network.mock.callCount(),0);network.mock.restore();});
const URL='https://rebzztxlzofxpfwjvbee.supabase.co';
const EMAIL='bootstrap-owner@example.com';
const TOKEN='A'.repeat(43); // Deterministic fixture only; never a deployed credential.
const SECRET='fixture-service-role-key-not-real';
const OPERATION='jenios_r41_master_fixture';
const NOW=Date.parse('2026-10-24T12:00:00Z');
const uid=n=>String(n).padStart(8,'0')+'-1111-4111-8111-111111111111';
const config={projectUrl:URL,targetEmail:EMAIL,operationId:OPERATION,
 tokenSha256:createHash('sha256').update(TOKEN).digest('hex'),expiresAt:NOW+60000};
const user=(overrides={})=>({id:uid(1),email:EMAIL,is_anonymous:false,email_confirmed_at:null,
 app_metadata:{role:'master',jenios_master_bootstrap:OPERATION},...overrides});
const ordinary=n=>({id:uid(n),email:'fixture'+n+'@example.com',app_metadata:{role:'user'}});
const json=(body,status=200)=>Response.json(body,{status});
function request({method='POST',token=TOKEN,authorization,body={action:'provision'},raw,
 query='',headers={}}={}){
 const h={'authorization':authorization??'Bearer '+token,'content-type':'application/json',...headers};
 return new Request('https://fixture.invalid/functions/v1/master-bootstrap'+query,{
  method,headers:h,...(!['GET','HEAD'].includes(method)?{body:raw??JSON.stringify(body)}:{})
 });
}
function fixture({users=[],clock={value:NOW},environment={},onFetch,options={}}={}){
 const state={users:structuredClone(users),created:0};
 const calls={environment:[],http:[]};
 const readEnv=name=>{calls.environment.push(name);return name in environment?environment[name]
  :name==='SUPABASE_URL'?URL:name==='SUPABASE_SERVICE_ROLE_KEY'?SECRET:undefined;};
 const fetcher=async(input,init)=>{
  const url=new globalThis.URL(input);
  const call={url,method:init.method,headers:init.headers,redirect:init.redirect,
   body:init.body?JSON.parse(init.body):null,signal:init.signal};
  calls.http.push(call);
  if(onFetch){const response=await onFetch(call,state,calls);if(response!==undefined)return response;}
  if(url.origin!==URL||!url.pathname.startsWith('/auth/v1/admin/users'))throw Error('Unexpected fixture URL');
  if(call.method==='POST'&&url.pathname==='/auth/v1/admin/users'){
   const created=user({id:uid(9000),...call.body});
   state.users.push(created);state.created++;return json(created);
  }
  if(call.method==='GET'&&url.pathname==='/auth/v1/admin/users'){
   const page=Number(url.searchParams.get('page')),perPage=Number(url.searchParams.get('per_page'));
   return json({users:state.users.slice((page-1)*perPage,page*perPage)});
  }
  if(call.method==='GET'){
   const id=url.pathname.split('/').at(-1);
   const found=state.users.find(item=>item.id===id);return found?json(found):json({error:'missing fixture'},404);
  }
  throw Error('Unexpected fixture operation');
 };
 const handle=createMasterProvisionHandler({...config,now:()=>clock.value,getEnv:readEnv,fetcher,...options});
 return {handle,calls,state,clock};
}
async function outcome(fixture,req=request()){
 const response=await fixture.handle(req),body=await response.json();
 assert.equal(response.headers.get('cache-control'),'no-store');
 assert.equal(response.headers.get('x-content-type-options'),'nosniff');
 const serialized=JSON.stringify(body);
 for(const value of [TOKEN,SECRET,EMAIL,'private-provider-error','private-debug-detail'])
  assert.equal(serialized.includes(value),false,'Response leaked '+value);
 return {status:response.status,body};
}
function untouched(fixture){assert.deepEqual(fixture.calls.environment,[]);assert.deepEqual(fixture.calls.http,[]);}
const posts=fixture=>fixture.calls.http.filter(call=>call.method==='POST');

test('R41 provision constructor rejects non-QA or malformed deployment configuration',()=>{
 for(const patch of [{projectUrl:'https://xaicvhagftzjkqphnbgx.supabase.co'},
  {projectUrl:'https://example.com'},{projectUrl:URL+'/'},{targetEmail:'not-email'},
  {targetEmail:'a\nb@example.com'},{operationId:'short'},{operationId:'../admin'},
  {tokenSha256:'not-a-hash'},{expiresAt:0},{expiresAt:NaN}]){
  assert.throws(()=>createMasterProvisionHandler({...config,now:()=>NOW,...patch}),{code:'BOOTSTRAP_CONFIGURATION_INVALID',status:400});
 }
});

test('R41 provision rejects TTL beyond fifteen minutes and expires an accepted boundary deployment',async()=>{
 let touched=0;
 for(const duration of [900001,86400000]){
  assert.throws(()=>createMasterProvisionHandler({...config,now:()=>NOW,expiresAt:NOW+duration,
   getEnv:()=>{touched++;},fetcher:async()=>{touched++;}}),
  {code:'BOOTSTRAP_CONFIGURATION_INVALID',status:400});
 }
 assert.equal(touched,0);
 const f=fixture({users:[user()],options:{expiresAt:NOW+900000}});
 f.clock.value=NOW+899999;
 const before=await outcome(f);assert.equal(before.status,200);assert.equal(before.body.status,'existing');
 const reads={environment:f.calls.environment.length,http:f.calls.http.length};
 f.clock.value=NOW+900000;
 const expired=await outcome(f);assert.equal(expired.status,410);assert.equal(expired.body.code,'BOOTSTRAP_EXPIRED');
 assert.equal(f.calls.environment.length,reads.environment);assert.equal(f.calls.http.length,reads.http);
});

test('R41 provision rejects wrong method and invalid Bearer before environment or Auth access',async()=>{
 for(const method of ['GET','HEAD','PUT','DELETE']){
  const f=fixture();const r=await outcome(f,request({method}));
  assert.equal(r.status,405);assert.equal(r.body.code,'METHOD_NOT_ALLOWED');untouched(f);
 }
 for(const authorization of ['',TOKEN,'Basic '+TOKEN,'Bearer '+TOKEN.slice(1),'Bearer '+TOKEN+'A',
  'Bearer '+'B'.repeat(43),'Bearer '+TOKEN.slice(0,42)+'!']){
  const f=fixture();const r=await outcome(f,request({authorization}));
  assert.equal(r.status,401);assert.equal(r.body.code,'UNAUTHORIZED');untouched(f);
 }
});

test('R41 provision expires at the exact deadline, including while request body is being read',async()=>{
 for(const value of [config.expiresAt,config.expiresAt+1]){
  const f=fixture({clock:{value}});const r=await outcome(f);
  assert.equal(r.status,410);assert.equal(r.body.code,'BOOTSTRAP_EXPIRED');untouched(f);
 }
 const f=fixture(),req=request(),read=req.arrayBuffer.bind(req);
 req.arrayBuffer=async()=>{const raw=await read();f.clock.value=config.expiresAt;return raw;};
 assert.equal((await outcome(f,req)).status,410);untouched(f);
});

test('R41 provision rejects browser origins, query parameters and non-JSON requests before environment access',async()=>{
 for(const options of [{headers:{origin:'https://fixture.invalid'}},{headers:{origin:'null'}},{query:'?email=other@example.com'}]){
  const f=fixture();const r=await outcome(f,request(options));
  assert.equal(r.status,403);assert.equal(r.body.code,'REQUEST_CONTEXT_DENIED');untouched(f);
 }
 for(const type of ['text/plain','application/x-www-form-urlencoded','']){
  const f=fixture();const r=await outcome(f,request({headers:{'content-type':type}}));
  assert.equal(r.status,415);assert.equal(r.body.code,'JSON_REQUIRED');untouched(f);
 }
});

test('R41 provision accepts only its fixed action and rejects extra attributes or oversized bodies',async()=>{
 for(const body of [null,[],{},'provision',{action:'invite'},{action:'provision',email:'other@example.com'},
  {action:'provision',role:'master'},{action:'provision',email_confirm:true},{action:'provision',password:'attacker'}]){
  const f=fixture();const r=await outcome(f,request({body}));
  assert.equal(r.status,400);assert.equal(r.body.code,'INVALID_REQUEST');untouched(f);
 }
 const invalid=fixture();assert.equal((await outcome(invalid,request({raw:'{'}))).status,400);untouched(invalid);
 for(const options of [{headers:{'content-length':'1025'}},{raw:' '.repeat(1025)}]){
  const f=fixture();const r=await outcome(f,request(options));
  assert.equal(r.status,413);assert.equal(r.body.code,'BODY_TOO_LARGE');untouched(f);
 }
});

test('R41 provision rejects runtime project mismatch before reading service key, and missing key before Auth',async()=>{
 const wrong=fixture({environment:{SUPABASE_URL:'https://xaicvhagftzjkqphnbgx.supabase.co'}});
 const result=await outcome(wrong);
 assert.equal(result.status,403);assert.equal(result.body.code,'BOOTSTRAP_PROJECT_MISMATCH');
 assert.deepEqual(wrong.calls.environment,['SUPABASE_URL']);assert.equal(wrong.calls.http.length,0);
 for(const key of [undefined,'','short']){
  const f=fixture({environment:{SUPABASE_SERVICE_ROLE_KEY:key}});const r=await outcome(f);
  assert.equal(r.status,503);assert.equal(r.body.code,'BOOTSTRAP_ADMIN_UNAVAILABLE');
  assert.equal(f.calls.http.length,0);
 }
});

test('R41 provision creates only the authorized unconfirmed Master and verifies the returned UUID',async()=>{
 const f=fixture();const r=await outcome(f);
 assert.equal(r.status,200);
 assert.deepEqual(r.body,{ok:true,status:'created',userId:uid(9000),role:'master',emailConfirmed:false});
 assert.equal(posts(f).length,1);assert.equal(f.state.created,1);
 assert.deepEqual(posts(f)[0].body,{email:EMAIL,email_confirm:false,
  app_metadata:{role:'master',jenios_master_bootstrap:OPERATION},
  user_metadata:{origin:'jenios_admin_bootstrap_r41'}});
 assert.deepEqual(f.calls.http.map(call=>[call.method,call.url.pathname,call.url.search]),[
  ['GET','/auth/v1/admin/users','?page=1&per_page=100'],
  ['POST','/auth/v1/admin/users',''],['GET','/auth/v1/admin/users/'+uid(9000),'']]);
 for(const call of f.calls.http){
  assert.equal(call.redirect,'error');assert.equal(call.headers.apikey,SECRET);
  assert.equal(call.headers.Authorization,'Bearer '+SECRET);assert.ok(call.signal instanceof AbortSignal);
 }
 assert.deepEqual(f.calls.environment,['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY']);
});

test('R41 provision reuses the stable UUID on repeat even after the owner changes email',async()=>{
 const f=fixture();const first=await outcome(f);
 f.state.users[0].email='changed-owner@example.com';
 f.state.users[0].email_confirmed_at='2026-10-24T12:00:30Z';
 const second=await outcome(f);
 assert.equal(second.status,200);
 assert.deepEqual(second.body,{ok:true,status:'existing',userId:first.body.userId,role:'master',emailConfirmed:true});
 assert.equal(posts(f).length,1);assert.equal(f.state.created,1);
 assert.equal(f.state.users[0].email,'changed-owner@example.com');
});

test('R41 provision never promotes an unmarked existing identity or restores a revoked Master',async()=>{
 const candidates=[user({app_metadata:{role:'user'}}),user({app_metadata:{role:'master'}}),
  user({app_metadata:{role:'user',jenios_master_bootstrap:OPERATION}}),user({is_anonymous:true})];
 for(const candidate of candidates){
  const f=fixture({users:[candidate]}),before=structuredClone(f.state.users);
  const r=await outcome(f);assert.equal(r.status,409);assert.equal(posts(f).length,0);
  assert.deepEqual(f.state.users,before);
 }
});

test('R41 provision rejects duplicate markers, duplicate target emails and marker/target collisions',async()=>{
 for(const users of [[user(),user({id:uid(2),email:'other@example.com'})],
  [user({app_metadata:{}}),user({id:uid(2),app_metadata:{}})],
  [user({email:'changed@example.com'}),user({id:uid(2),app_metadata:{}})]]){
  const f=fixture({users});const r=await outcome(f);
  assert.equal(r.status,409);assert.equal(r.body.code,'BOOTSTRAP_IDENTITY_CONFLICT');assert.equal(posts(f).length,0);
 }
});

test('R41 provision searches all complete pages before creation and finds markers after page one',async()=>{
 const users=Array.from({length:100},(_,i)=>ordinary(i+10));
 const existing=fixture({users:[...users,user()]});
 const result=await outcome(existing);assert.equal(result.body.status,'existing');assert.equal(posts(existing).length,0);
 assert.deepEqual(existing.calls.http.filter(call=>call.url.search).map(call=>call.url.search),
  ['?page=1&per_page=100','?page=2&per_page=100']);
 const emptyEnd=fixture({users});assert.equal((await outcome(emptyEnd)).body.status,'created');
 assert.equal(emptyEnd.calls.http[1].url.search,'?page=2&per_page=100');
 assert.equal(posts(emptyEnd).length,1);
});

test('R41 provision fails closed when ten full pages cannot prove the directory is complete',async()=>{
 const f=fixture({users:Array.from({length:1000},(_,i)=>ordinary(i+10))});
 const r=await outcome(f);assert.equal(r.status,503);assert.equal(r.body.code,'BOOTSTRAP_DIRECTORY_INCOMPLETE');
 assert.equal(f.calls.http.length,10);assert.equal(posts(f).length,0);assert.equal(f.state.created,0);
});

test('R41 provision rejects malformed directory pages and redacts upstream failures',async()=>{
 const failures=[()=>json({users:null}),()=>json({users:[{}]}),()=>json({users:Array.from({length:101},(_,i)=>ordinary(i+10))}),
  ()=>new Response('private-provider-error',{status:503}),()=>new Response('{private-debug-detail'),
  ()=>new Response('x'.repeat(1048577)),()=>{throw Error('private-provider-error '+SECRET);}];
 for(const fail of failures){
  const f=fixture({onFetch:()=>fail()});const r=await outcome(f);
  assert.equal(r.status,503);assert.equal(r.body.ok,false);assert.equal(posts(f).length,0);
 }
});

test('R41 provision requires the same UUID and authoritative marker/role in the final Auth read',async()=>{
 const mutations=[{id:uid(2)},{id:'bad-uuid'},{is_anonymous:true},{app_metadata:{role:'master'}},
  {app_metadata:{role:'user',jenios_master_bootstrap:OPERATION}}];
 for(const patch of mutations){
  const f=fixture({users:[user()],onFetch:call=>call.url.pathname.endsWith('/'+uid(1))?json(user(patch)):undefined});
  const r=await outcome(f);assert.equal(r.status,409);assert.equal(r.body.code,'BOOTSTRAP_IDENTITY_NOT_CONFIRMED');
  assert.equal(posts(f).length,0);
 }
});

test('R41 provision never accepts unexpected email confirmation from create or confirmation read',async()=>{
 for(const phase of ['create','read']){
  const f=fixture({onFetch:(call,state)=>{
   if(phase==='create'&&call.method==='POST')return json(user({email_confirmed_at:'2026-10-24T12:00:00Z'}));
   if(phase==='read'&&call.url.pathname.endsWith('/'+uid(9000)))return json({...state.users[0],email_confirmed_at:'2026-10-24T12:00:00Z'});
  }});
  const r=await outcome(f);assert.equal(r.status,409);assert.equal(r.body.code,'BOOTSTRAP_CONFIRMATION_UNEXPECTED');
  assert.equal(posts(f).length,1);
 }
});

test('R41 provision rejects a created identity with a different email, role or marker',async()=>{
 for(const patch of [{email:'other@example.com'},{id:'not-a-uuid'},
  {app_metadata:{role:'user',jenios_master_bootstrap:OPERATION}},{app_metadata:{role:'master'}}]){
  const f=fixture({onFetch:call=>call.method==='POST'?json(user(patch)):undefined});
  const r=await outcome(f);assert.equal(r.status,409);assert.equal(r.body.code,'BOOTSTRAP_IDENTITY_NOT_CONFIRMED');
  assert.equal(posts(f).length,1);assert.equal(f.calls.http.length,2);
 }
});

test('R41 provision requires the original target email in the final read of a newly created identity',async()=>{
 for(const email of ['different-owner@example.com',null,undefined,'']){
  const f=fixture({onFetch:(call,state)=>call.method==='GET'&&call.url.pathname.endsWith('/'+uid(9000))
   ?json({...state.users[0],email}):undefined});
  const r=await outcome(f);assert.equal(r.status,409);assert.equal(r.body.code,'BOOTSTRAP_IDENTITY_NOT_CONFIRMED');
  assert.equal(posts(f).length,1);assert.equal(f.calls.http.length,3);
  assert.ok(f.calls.http.every(call=>['GET','POST'].includes(call.method)));
 }
 const normalized=fixture({onFetch:(call,state)=>call.method==='GET'&&call.url.pathname.endsWith('/'+uid(9000))
  ?json({...state.users[0],email:EMAIL.toUpperCase()}):undefined});
 const accepted=await outcome(normalized);
 assert.equal(accepted.status,200);assert.equal(accepted.body.status,'created');
 assert.equal(accepted.body.userId,uid(9000));
});

test('R41 provision resolves a lost create acknowledgement by reading, never by repeating POST',async()=>{
 const f=fixture({onFetch:(call,state)=>{
  if(call.method==='POST'){
   state.users.push(user({id:uid(9000)}));state.created++;
   throw Error('private-provider-error after committed create');
  }
 }});
 const r=await outcome(f);assert.equal(r.status,200);
 assert.deepEqual(r.body,{ok:true,status:'existing',userId:uid(9000),role:'master',emailConfirmed:false});
 assert.equal(posts(f).length,1);assert.equal(f.state.created,1);
 assert.equal(f.calls.http.filter(call=>call.url.search==='?page=1&per_page=100').length,2);
 assert.equal(f.calls.http.at(-1).url.pathname,'/auth/v1/admin/users/'+uid(9000));
});

test('R41 provision reports an unconfirmed failed create without retrying or inventing completion',async()=>{
 const f=fixture({onFetch:call=>call.method==='POST'?new Response('private-provider-error',{status:500}):undefined});
 const r=await outcome(f);assert.equal(r.status,503);assert.equal(r.body.code,'BOOTSTRAP_AUTH_REQUEST_FAILED');
 assert.equal(posts(f).length,1);assert.equal(f.state.created,0);
 assert.ok(f.calls.http.every(call=>call.method==='GET'||call.method==='POST'));
});

test('R41 provision rechecks expiry before the create request',async()=>{
 const clock={value:NOW};
 const f=fixture({clock,onFetch:call=>{
  if(call.method==='GET'&&call.url.search){clock.value=config.expiresAt;return json({users:[]});}
 }});
 const r=await outcome(f);assert.equal(r.status,410);assert.equal(r.body.code,'BOOTSTRAP_EXPIRED');
 assert.equal(posts(f).length,0);assert.equal(f.state.created,0);
});

test('R41 provision tolerates the official wrapped user response and keeps output minimal',async()=>{
 const f=fixture({users:[user()],onFetch:call=>call.url.pathname.endsWith('/'+uid(1))
  ?json({user:{...user(),private_debug:'private-debug-detail',access_token:'not-a-real-session'}}):undefined});
 const r=await outcome(f);assert.equal(r.status,200);
 assert.deepEqual(Object.keys(r.body).sort(),['emailConfirmed','ok','role','status','userId']);
 assert.equal(r.body.status,'existing');
});
