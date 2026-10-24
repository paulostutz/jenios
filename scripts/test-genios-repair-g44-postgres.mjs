/** Focused G44 repair integration. Requires an empty, disposable loopback DB. */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {conversationRepository} from '../lib/assistant/conversation-repository.mjs';
import {repairProConversationTurn,reconstructSettledProContext} from '../lib/assistant/conversation-service.mjs';
import {initialConversationSummary} from '../lib/assistant/conversation-contract.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),raw=process.env.JENIOS_G44_REPAIR_TEST_DATABASE_URL;
if(!raw)throw Error('Set JENIOS_G44_REPAIR_TEST_DATABASE_URL to an empty disposable loopback database.');
let target;try{target=new URL(raw);}catch{throw Error('G44_REPAIR_DATABASE_INVALID');}
const host=target.hostname.replace(/^\[|\]$/g,''),dbName=decodeURIComponent(target.pathname.slice(1));
if(!['postgres:','postgresql:'].includes(target.protocol)||!['127.0.0.1','localhost','::1'].includes(host)||target.search||target.hash||!/^jenios_genios_g44_[a-z0-9_]+$/.test(dbName))throw Error('G44_REPAIR_DATABASE_MUST_BE_DISPOSABLE_LOOPBACK');
const args=['-X','--no-password','--host',host,'--port',target.port||'5432','--username',decodeURIComponent(target.username||'postgres'),
 '--dbname',dbName,'--set','ON_ERROR_STOP=1','--tuples-only','--no-align','--quiet'];
const env={PATH:process.env.PATH,LANG:'C.UTF-8',PGCONNECT_TIMEOUT:'5',PGPASSFILE:'/tmp/jenios-g44-repair-no-password-file',
 PGOPTIONS:'-c statement_timeout=30000 -c lock_timeout=10000 -c timezone=UTC',PGPASSWORD:decodeURIComponent(target.password||'')};
function sql(source){return new Promise((resolve,reject)=>{
 const c=spawn('psql',args,{cwd:root,env,stdio:['pipe','pipe','pipe']});let out='',err='';
 c.stdout.on('data',d=>out+=d);c.stderr.on('data',d=>err+=d);c.once('error',reject);
 c.once('close',code=>code===0?resolve(out.trim()):reject(Error('G44_REPAIR_PSQL_FAILED\n'+err.slice(-6000))));c.stdin.end(source);
});}
const literal=value=>"'"+String(value).replaceAll("'","''")+"'";
const json=value=>literal(JSON.stringify(value))+'::jsonb';
async function file(path){const out=await sql(await readFile(new URL('../'+path,import.meta.url),'utf8'));if(out)console.log(out);}
const endpoint=await sql("SELECT current_database()||'|'||coalesce(host(inet_server_addr()),'')");
assert.ok([dbName+'|127.0.0.1',dbName+'|::1'].includes(endpoint),'Actual server must be loopback');
assert.equal(await sql("SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','auth') AND c.relkind IN ('r','p','v','m')"),'0','Database must be empty');
for(const path of ['tests/sql/jenios-assistant-conversations-g43-fixture.sql','supabase/migrations/20261024201548_jenios_assistant_conversations_g43.sql',
 'supabase/migrations/20261012_jenios_pay_v1.sql','db/schema/pro-wallet-b143.sql',
 'supabase/migrations/20261024210637_jenios_assistant_pro_context_repair_g44.sql','tests/sql/jenios-assistant-pro-context-repair-g44.sql'])await file(path);
const U='44000000-0000-4000-8000-000000009001';
await sql(`INSERT INTO auth.users(id,email) VALUES(${literal(U)},'g44-real-repair@example.invalid');
 INSERT INTO public.jenios_pro_budgets_b143(month,limit_nano_usd) VALUES(to_char(now() AT TIME ZONE 'UTC','YYYY-MM'),1000000);`);
const db={async rpc(name,p){let call;
 if(name==='jenios_assistant_conversation_g43')call=`public.jenios_assistant_conversation_g43(${literal(p.p_action)},${literal(p.p_owner_kind)},${literal(p.p_owner_id)}::uuid,${json(p.p_payload)})`;
 else if(name==='jenios_assistant_repair_context_g44')call=`public.jenios_assistant_repair_context_g44(${literal(p.p_action)},${literal(p.p_user_id)}::uuid,${literal(p.p_conversation_id)}::uuid,${literal(p.p_turn_id)}::uuid,${json(p.p_payload)})`;
 else throw Error('G44_RPC_NOT_ALLOWED');
 try{return{data:JSON.parse(await sql('SET ROLE service_role; SELECT '+call+';'))};}
 catch(error){return{error:{message:error.message.match(/ERROR:\s+(CONVERSATION_[A-Z_]+)/)?.[1]||'G44_STORAGE_ERROR'}};}
}};
const repo=conversationRepository(db,{kind:'user',ownerId:U}),c=await repo.create({channel:'pro',remember:true});
const first=randomUUID();let claim=await repo.claimTurn({id:c.id,turnId:first,revision:0,question:'Quero o Global Crypto.',requestFingerprint:'a'.repeat(64)});
await repo.completeTurn({id:c.id,turnId:first,leaseToken:claim.leaseToken,answer:'Global Crypto custa R$ 149,90.',
 articles:[{id:'plans',title:'Planos oficiais',href:'/lp#planos'}],summary:{...initialConversationSummary(),topic:'plans',articleIds:['plans'],planCodes:['platform-global-crypto']}});
const second=randomUUID();claim=await repo.claimTurn({id:c.id,turnId:second,revision:2,question:'Não, quis dizer o Nacional.',requestFingerprint:'b'.repeat(64)});
await sql(`INSERT INTO public.jenios_pro_requests_b143(user_id,request_key,fingerprint,task,model,pricing_version,source,budget_month,state,
 held_retail_nano_usd,held_provider_nano_usd,charged_nano_usd,provider_nano_usd,result_data)
 VALUES(${literal(U)},${literal(second)},repeat('b',64),'analysis','fixture-model','test','prepaid',to_char(now() AT TIME ZONE 'UTC','YYYY-MM'),
 'settled',200,100,100,50,'{"answer":"O Nacional custa R$ 99,90 por mês."}');`);
const ledger=await sql(`SELECT to_jsonb(x) FROM public.jenios_pro_requests_b143 x WHERE user_id=${literal(U)}::uuid AND request_key=${literal(second)};`);
const repaired=await repairProConversationTurn(repo,{id:c.id,turnId:second});
assert.equal(repaired.repaired,true);assert.equal(repaired.conversation.revision,4);
assert.deepEqual(repaired.conversation.summary.planCodes,['platform-nacional']);
assert.equal(repaired.conversation.summary.corrections[0].origin,'user');assert.equal(repaired.conversation.summary.corrections[0].verified,false);
const restored=await repo.read(c.id,'pro');assert.deepEqual(restored.summary,repaired.conversation.summary);
assert.equal(restored.turns[1].answer,'O Nacional custa R$ 99,90 por mês.');assert.equal(restored.turns[1].articles[0].id,'plans');
const repeat=await repairProConversationTurn(repo,{id:c.id,turnId:second});assert.equal(repeat.replayed,true);assert.equal(repeat.conversation.revision,4);
assert.equal(await sql(`SELECT to_jsonb(x) FROM public.jenios_pro_requests_b143 x WHERE user_id=${literal(U)}::uuid AND request_key=${literal(second)};`),ledger);
console.log('G44_REAL_REPOSITORY_RECONSTRUCTION_PERSISTENCE_AND_NO_REBILL_PASS');

// Two independent PostgreSQL backends apply the same repair at once. Exactly
// one changes the conversation; the other replays without another revision.
const third=randomUUID();await repo.claimTurn({id:c.id,turnId:third,revision:4,question:'E o Nacional, quanto custa?',requestFingerprint:'c'.repeat(64)});
await sql(`INSERT INTO public.jenios_pro_requests_b143(user_id,request_key,fingerprint,task,model,pricing_version,source,budget_month,state,
 held_retail_nano_usd,held_provider_nano_usd,charged_nano_usd,provider_nano_usd,result_data)
 VALUES(${literal(U)},${literal(third)},repeat('c',64),'analysis','fixture-model','test','prepaid',to_char(now() AT TIME ZONE 'UTC','YYYY-MM'),
 'settled',200,100,100,50,'{"answer":"O Nacional custa R$ 99,90 por mês."}');`);
const context=reconstructSettledProContext(await repo.inspectProTurnRepair({id:c.id,turnId:third}));
const {id,turnId,...body}=context;
const results=await Promise.all([1,2].map(()=>sql(`BEGIN; SET LOCAL ROLE service_role;
 SELECT public.jenios_assistant_repair_context_g44('apply',${literal(U)}::uuid,${literal(id)}::uuid,${literal(turnId)}::uuid,${json(body)});
 SELECT pg_sleep(0.2); COMMIT;`)));
const applied=results.map(x=>JSON.parse(x.trim()));assert.deepEqual(applied.map(x=>x.replayed).sort(),[false,true]);
assert.equal((await repo.read(c.id,'pro')).revision,6);
console.log('G44_CONCURRENT_CONTEXT_REPAIR_SINGLE_MUTATION_PASS');
console.log('PASS G44 Pro context repair: real ledger checks, CAS, atomic persistence, historical-topic protection and no rebilling.');

