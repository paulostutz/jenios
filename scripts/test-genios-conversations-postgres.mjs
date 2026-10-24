/** Real PostgreSQL memory/lease tests. No hosted or populated database accepted. */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {conversationRepository} from '../lib/assistant/conversation-repository.mjs';
import {handleConversations} from '../lib/assistant/conversation-service.mjs';
import {handleFreeAssistant} from '../lib/assistant/free-service.mjs';
import {accountContextFromPlan} from '../lib/assistant/context-authority.mjs';
import {CONVERSATION_VISITOR_COOKIE} from '../lib/assistant/conversation-actor.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const raw=process.env.JENIOS_G43_TEST_DATABASE_URL;
if(!raw)throw Error('Set JENIOS_G43_TEST_DATABASE_URL to an empty disposable loopback PostgreSQL database.');
let target;try{target=new URL(raw);}catch{throw Error('G43_TEST_DATABASE_URL_INVALID');}
const dbName=decodeURIComponent(target.pathname.slice(1)),host=target.hostname.replace(/^\[|\]$/g,'');
if(!['postgres:','postgresql:'].includes(target.protocol)||!['127.0.0.1','::1','localhost'].includes(host)||target.search||target.hash||
 !/^jenios_genios_g43_[a-z0-9_]+$/.test(dbName))throw Error('G43_TEST_DATABASE_MUST_BE_DISPOSABLE_LOOPBACK');
const args=['-X','--no-password','--host',host,'--port',target.port||'5432','--username',decodeURIComponent(target.username||'postgres'),
 '--dbname',dbName,'--set','ON_ERROR_STOP=1','--tuples-only','--no-align','--quiet'];
const env={PATH:process.env.PATH,LANG:'C.UTF-8',PGCONNECT_TIMEOUT:'5',PGPASSFILE:'/tmp/jenios-g43-no-password-file',
 PGOPTIONS:'-c statement_timeout=30000 -c lock_timeout=10000 -c timezone=UTC',PGPASSWORD:decodeURIComponent(target.password||'')};
function sql(source){return new Promise((resolve,reject)=>{
 const child=spawn('psql',args,{cwd:root,env,stdio:['pipe','pipe','pipe']});let out='',err='';
 child.stdout.on('data',data=>{out+=data;});child.stderr.on('data',data=>{err+=data;});
 child.on('error',()=>reject(Error('G43_PSQL_UNAVAILABLE')));
 child.on('close',code=>code===0?resolve(out.trim()):reject(Error(`G43_PSQL_FAILED (${code})\n${err.slice(-6000)}`)));
 child.stdin.end(source);
});}
async function file(path){const result=await sql(await readFile(new URL('../'+path,import.meta.url),'utf8'));if(result)console.log(result);}
// This quoting exists only in the disposable test adapter. Production uses
// Supabase's parameterized RPC call, never shell/string SQL interpolation.
const literal=value=>"'"+String(value).replaceAll("'","''")+"'";
const payload=value=>literal(JSON.stringify(value))+'::jsonb';
const rpcSql=(action,kind,owner,value)=>`public.jenios_assistant_conversation_g43(${literal(action)},${literal(kind)},${literal(owner)}::uuid,${payload(value)})`;

const endpoint=await sql("SELECT current_database()||'|'||coalesce(host(inet_server_addr()),'')");
assert.ok([dbName+'|127.0.0.1',dbName+'|::1'].includes(endpoint),'Server must actually be loopback');
assert.equal(await sql("SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','auth') AND c.relkind IN ('r','p','v','m')"),'0','Refusing database with existing application objects');
await file('tests/sql/jenios-assistant-conversations-g43-fixture.sql');
await file('supabase/migrations/20261024201548_jenios_assistant_conversations_g43.sql');
await file('supabase/migrations/20261024202054_jenios_assistant_sales_budget_g43.sql');
await file('tests/sql/jenios-assistant-conversations-g43.sql');
await file('tests/sql/jenios-assistant-sales-budget-g43.sql');
// Load the original ledger, not a mock of its queried columns. These fixtures
// create no external integration and execute no financial/provider RPC.
await file('supabase/migrations/20261012_jenios_pay_v1.sql');
await file('db/schema/pro-wallet-b143.sql');
await file('tests/sql/jenios-assistant-conversations-pro-g43.sql');

const A='43000000-0000-4000-8000-000000009001',B='43000000-0000-4000-8000-000000009002';
await sql(`INSERT INTO auth.users(id,email) VALUES(${literal(A)},'g43-concurrent-a@example.invalid'),(${literal(B)},'g43-concurrent-b@example.invalid');`);
let budgetRpcCalls=0;
const db={auth:{getUser:async token=>token==='g43-fixture-a'?{data:{user:{id:A,is_anonymous:false}}}:token==='g43-fixture-b'?{data:{user:{id:B,is_anonymous:false}}}:{error:{message:'invalid'}}},
 async rpc(name,p){
  assert.ok(['jenios_assistant_conversation_g43','jenios_sales_budget_hold_b282'].includes(name),'test RPC allowlist');
  let expression;
  if(name==='jenios_assistant_conversation_g43')expression=rpcSql(p.p_action,p.p_owner_kind,p.p_owner_id,p.p_payload);
  else{
   budgetRpcCalls++;
   expression=`public.jenios_sales_budget_hold_b282(${literal(p.p_month)},${literal(p.p_visitor_hash)},${literal(p.p_hour)},${literal(p.p_amount_micro_usd)}::bigint,${literal(p.p_limit_micro_usd)}::bigint)`;
  }
  try{return{data:JSON.parse(await sql(`SET ROLE service_role; SELECT to_jsonb(${expression});`))};}
  catch(error){return{error:{message:error.message.match(/ERROR:\s+(CONVERSATION_[A-Z_]+)/)?.[1]||'G43_STORAGE_ERROR'}};}
 }};
const repo=conversationRepository(db,{kind:'user',ownerId:A});
const c=await repo.create({remember:true}),turnId=randomUUID();
const attempts=await Promise.all([1,2].map(()=>sql(`BEGIN; SET LOCAL ROLE service_role;
 SELECT ${rpcSql('claim','user',A,{id:c.id,turnId,revision:0,question:'Consulta concorrente do mesmo turno.'})};
 SELECT pg_sleep(0.2); COMMIT;`)));
const claims=attempts.map(x=>JSON.parse(x.trim()));
assert.deepEqual(claims.map(x=>x.state).sort(),['claimed','pending']);
assert.equal(claims.filter(x=>x.leaseToken).length,1);assert.equal((await repo.read(c.id)).turns.length,1);
const lease=claims.find(x=>x.leaseToken).leaseToken;
const completions=await Promise.all([1,2].map(()=>repo.completeTurn({id:c.id,turnId,leaseToken:lease,answer:'Resposta registrada uma vez.'})));
assert.deepEqual(completions.map(x=>x.replayed).sort(),[false,true]);
assert.equal((await repo.read(c.id)).revision,2);
console.log('G43_CONCURRENT_DUPLICATE_TURN_AND_COMPLETION_PASS');

// Two distinct turn IDs racing on the same revision: exactly one may claim.
const next=await repo.create();
const races=await Promise.allSettled([randomUUID(),randomUUID()].map(id=>sql(`BEGIN; SET LOCAL ROLE service_role;
 SELECT ${rpcSql('claim','user',A,{id:next.id,turnId:id,revision:0,question:'Duas abas tentam continuar.'})};
 SELECT pg_sleep(0.2); COMMIT;`)));
assert.equal(races.filter(r=>r.status==='fulfilled').length,1);
assert.match(races.find(r=>r.status==='rejected').reason.message,/CONVERSATION_REVISION_CONFLICT/);
assert.equal((await repo.read(next.id)).turns.length,1);
console.log('G43_CONCURRENT_DISTINCT_TURNS_CAS_PASS');

const edit=await repo.create();
const edits=await Promise.allSettled(['genio','genia'].map(persona=>sql(`BEGIN; SET LOCAL ROLE service_role;
 SELECT ${rpcSql('persona','user',A,{id:edit.id,revision:0,persona})}; SELECT pg_sleep(0.2); COMMIT;`)));
assert.equal(edits.filter(r=>r.status==='fulfilled').length,1);
assert.match(edits.find(r=>r.status==='rejected').reason.message,/CONVERSATION_REVISION_CONFLICT/);
assert.equal((await repo.read(edit.id)).revision,1);
console.log('G43_CONCURRENT_PERSONA_CAS_PASS');

const apiEnv={JENIOS_ASSISTANT_MEMORY_ENABLED:'true',JENIOS_ASSISTANT_SESSION_SECRET:'g43-offline-integration-signing-key-never-deployed'};
const request=(body=null,headers={},query='')=>new Request('https://jenios.test/api/assistant/conversations'+query,{method:body?'POST':'GET',
 headers:{origin:'https://jenios.test',...(body?{'content-type':'application/json'}:{}),...headers},...(body?{body:JSON.stringify(body)}:{})});
let response=await handleConversations(request({action:'create',persona:'genia',channel:'support',remember:false}),{db,env:apiEnv});
assert.equal(response.status,200);const guest=(await response.json()).conversation,cookie=response.headers.get('set-cookie').split(';')[0];
assert.ok(cookie.startsWith(CONVERSATION_VISITOR_COOKIE+'='));
response=await handleConversations(request(null,{cookie},'?channel=support&id='+guest.id),{db,env:apiEnv});
assert.equal(response.status,200);assert.equal((await response.json()).conversation.id,guest.id);
response=await handleConversations(request(null,{},'?channel=support&id='+guest.id),{db,env:apiEnv});assert.equal(response.status,404);
response=await handleConversations(request(null,{cookie,authorization:'Bearer invalid'},'?channel=support&id='+guest.id),{db,env:apiEnv});assert.equal(response.status,401);
response=await handleConversations(request(null,{authorization:'Bearer g43-fixture-b'},'?channel=support&id='+c.id),{db,env:apiEnv});assert.equal(response.status,404);
response=await handleConversations(request(null,{authorization:'Bearer g43-fixture-a'},'?channel=support&id='+c.id),{db,env:apiEnv});assert.equal(response.status,200);
assert.equal((await response.json()).conversation.turns[0].answer,'Resposta registrada uma vez.');
console.log('G43_API_REPOSITORY_SQL_VISITOR_COOKIE_AND_ACCOUNT_ISOLATION_PASS');

// Exercise the real guided engine through both service APIs and the repository.
// Only server authentication/plan lookup is a fixture; persistence and responses
// are real. A fetch tripwire proves no provider or external site is contacted.
let externalCalls=0;
const actor={kind:'user',ownerId:A,userId:A,user:{id:A,is_anonymous:false},setCookie:null};
const flowDeps={db,env:{...apiEnv,JENIOS_SALES_GENERATIVE_ENABLED:'false'},actorResolver:async()=>actor,
 accountLoader:async()=>accountContextFromPlan(actor.user,{code:'platform-global-crypto'},apiEnv),
 fetcher:async()=>{externalCalls++;throw Error('G43_EXTERNAL_NETWORK_FORBIDDEN');}};
response=await handleConversations(request({action:'create',channel:'support',persona:'genia',remember:true}),flowDeps);
assert.equal(response.status,200);let flow=(await response.json()).conversation;
const firstQuestion={persona:'genia',message:'Compare os planos Nacional e Global Crypto.',conversationId:flow.id,revision:flow.revision,turnId:randomUUID()};
response=await handleFreeAssistant(request(firstQuestion),flowDeps);
assert.equal(response.status,200);const firstReply=await response.json();
assert.equal(firstReply.mode,'guided');assert.equal(firstReply.conversationSyncPending,undefined);assert.equal(firstReply.modelCalls,0);
assert.match(firstReply.explanation,/99,90/);assert.match(firstReply.explanation,/149,90/);
flow=firstReply.conversation;assert.equal(flow.revision,2);assert.deepEqual(flow.summary.planCodes,['platform-nacional','platform-global-crypto']);
const followup={persona:'genia',message:'E o segundo?',conversationId:flow.id,revision:flow.revision,turnId:randomUUID()};
response=await handleFreeAssistant(request(followup),flowDeps);
assert.equal(response.status,200);const secondReply=await response.json();
assert.equal(secondReply.conversationSyncPending,undefined);assert.match(secondReply.explanation,/Global Crypto/);assert.match(secondReply.explanation,/149,90/);
flow=secondReply.conversation;assert.equal(flow.revision,4);assert.equal(flow.turns.length,2);assert.deepEqual(flow.summary.planCodes,['platform-global-crypto']);
const storedFlow=JSON.parse(await sql(`SELECT jsonb_build_object('revision',revision,'summary',summary,'answer',
 (SELECT answer FROM public.jenios_assistant_turns_g43 WHERE id=${literal(followup.turnId)}::uuid)) FROM public.jenios_assistant_conversations_g43 WHERE id=${literal(flow.id)}::uuid;`));
assert.equal(storedFlow.revision,4);assert.equal(storedFlow.answer,secondReply.explanation);assert.deepEqual(storedFlow.summary,flow.summary);
response=await handleFreeAssistant(request(followup),flowDeps);
assert.equal(response.status,200);const replay=await response.json();assert.equal(replay.replayed,true);assert.equal(replay.modelCalls,0);
assert.equal(replay.explanation,secondReply.explanation);assert.equal(replay.conversation.revision,4);assert.equal(replay.conversation.turns.length,2);
response=await handleConversations(request({action:'delete',conversationId:flow.id,revision:flow.revision}),flowDeps);
assert.equal(response.status,200);assert.equal((await response.json()).deleted,true);
assert.equal(await sql(`SELECT count(*) FROM public.jenios_assistant_turns_g43 WHERE conversation_id=${literal(flow.id)}::uuid;`),'0');
assert.equal(await sql(`SELECT count(*) FROM public.jenios_assistant_conversations_g43 WHERE id=${literal(flow.id)}::uuid;`),'0');
assert.equal(externalCalls,0);assert.equal(budgetRpcCalls,0);
console.log('G43_REAL_FREE_GUIDED_CONTEXT_FOLLOWUP_REPLAY_DELETE_SQL_PASS');

await sql(`INSERT INTO public.jenios_sales_budget_b282(month,reserved_micro_usd) VALUES(to_char(now() AT TIME ZONE 'UTC','YYYY-MM'),980000);`);
const budget=await Promise.all(['c','d'].map(letter=>sql(`BEGIN; SET LOCAL ROLE service_role;
 SELECT public.jenios_sales_budget_hold_b282(to_char(now() AT TIME ZONE 'UTC','YYYY-MM'),repeat('${letter}',64),
 to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24'),20000,1000000); SELECT pg_sleep(0.2); COMMIT;`)));
assert.deepEqual(budget.map(x=>x.trim()).sort(),['f','t']);
assert.equal(await sql('SELECT reserved_micro_usd FROM public.jenios_sales_budget_b282'),'1000000');
assert.equal(await sql('SELECT sum(calls) FROM public.jenios_sales_visitor_b282'),'1');
await sql('DELETE FROM public.jenios_sales_visitor_b282; DELETE FROM public.jenios_sales_budget_b282;');
console.log('G43_CONCURRENT_COMMERCIAL_MONTHLY_BUDGET_PASS');
console.log('PASS G43 real PostgreSQL: service grants, isolation, expiry, CAS, replay, consent, settled Pro repair and commercial budget concurrency.');

