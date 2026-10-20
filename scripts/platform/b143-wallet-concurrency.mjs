/** Real PostgreSQL concurrency gate. Requires the disposable CI fixture DB.
 * No credentials are written or printed; psql uses standard CI PG* variables.
 */
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const psql=sql=>new Promise((resolve,reject)=>{
 const child=spawn('psql',['-X','-w','-v','ON_ERROR_STOP=1','-At'],{env:process.env,stdio:['pipe','pipe','pipe']});
 let stdout='',stderr='';child.stdout.on('data',x=>stdout+=x);child.stderr.on('data',x=>stderr+=x);
 child.on('error',reject);child.on('close',code=>code===0?resolve(stdout.trim()):reject(Error('PostgreSQL fixture failed: '+stderr.slice(0,2000))));
 child.stdin.end(sql);
});
assert.equal(await psql('SELECT current_database();'),'jenios_pro_b143_test','Concurrency tests only run in the disposable local fixture DB');
const u1='b1430000-0000-4000-8000-000000000101',u2='b1430000-0000-4000-8000-000000000102';
const fp='c'.repeat(64);
await psql(`INSERT INTO auth.users(id) VALUES('${u1}'),('${u2}');
 INSERT INTO public.jenios_pro_wallets_b143(user_id,balance_nano_usd) VALUES('${u1}',10000),('${u2}',10000);
 UPDATE public.jenios_pro_config_b143 SET generation_enabled=true,pricing_approved=true,
 pricing_version='2026-10-20-v2-nano',rates_verified_at=now(),allowed_models=ARRAY['gpt-6-luna'],
 monthly_provider_limit_nano_usd=1000,max_request_provider_nano_usd=1000;`);
const reserve=(user,key)=>`SELECT public.jenios_pro_reserve_b143('${user}','${key}','${fp}','advanced_question','gpt-6-luna','prepaid',1200,600,'2026-10-20-v2-nano');`;
const dup=await Promise.all([psql(reserve(u1,'concurrent-same-0001')),psql(reserve(u1,'concurrent-same-0001'))]);
const d=dup.map(JSON.parse);assert.ok(d.every(x=>x.ok));assert.equal(d.filter(x=>x.replayed===false).length,1);assert.equal(d.filter(x=>x.replayed===true).length,1);
let totals=JSON.parse(await psql(`SELECT jsonb_build_object('requests',(SELECT count(*) FROM public.jenios_pro_requests_b143),
 'walletReserved',(SELECT reserved_nano_usd FROM public.jenios_pro_wallets_b143 WHERE user_id='${u1}'),
 'globalReserved',(SELECT reserved_nano_usd FROM public.jenios_pro_budgets_b143));`));
assert.deepEqual(totals,{requests:1,walletReserved:1200,globalReserved:600});
const dispatch=`SELECT public.jenios_pro_dispatch_b143('${u1}','concurrent-same-0001','${fp}');`;
const responses=await Promise.all([psql(dispatch),psql(dispatch)]);const parsed=responses.map(JSON.parse);
assert.equal(parsed.filter(x=>x.acquired===true).length,1);assert.equal(parsed.filter(x=>x.acquired===false).length,1);
const settled=JSON.parse(await psql(`SELECT public.jenios_pro_settle_b143('${u1}','concurrent-same-0001','${fp}',125,'{}','{"answer":"fixture"}','resp_concurrency_1');`));
assert.equal(settled.chargedNanoUsd,250);
const competing=await Promise.all([psql(reserve(u1,'concurrent-budget-01')),psql(reserve(u2,'concurrent-budget-02'))]);
const c=competing.map(JSON.parse);assert.equal(c.filter(x=>x.ok===true).length,1);assert.equal(c.filter(x=>x.code==='GLOBAL_BUDGET_EXHAUSTED').length,1);
totals=JSON.parse(await psql(`SELECT jsonb_build_object('reserved',(SELECT sum(reserved_nano_usd) FROM public.jenios_pro_wallets_b143),
 'globalReserved',(SELECT reserved_nano_usd FROM public.jenios_pro_budgets_b143),
 'globalSpent',(SELECT spent_nano_usd FROM public.jenios_pro_budgets_b143));`));
assert.deepEqual(totals,{reserved:1200,globalReserved:600,globalSpent:125});
console.log('B143 PostgreSQL concurrent duplicate reservations, single dispatch and shared provider budget passed. Disposable fixture data only.');
