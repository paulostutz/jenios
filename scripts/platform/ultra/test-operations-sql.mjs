import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initialOperation} from '../../../lib/platform/ultra/operation.mjs';
const {PGlite}=await import(process.env.JENIOS_PGLITE_MODULE||'@electric-sql/pglite');
const db=new PGlite();let checks=0;const check=(v)=>{assert.ok(v);checks++;};
try{
 await db.exec('create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);grant usage on schema public to service_role;');
 await db.exec(readFileSync('docs/release/R117-OPERATIONS-SCHEMA.sql','utf8'));
 const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';
 await db.query('insert into auth.users values ($1),($2)',[a,b]);
 const device=async(owner,hash,env='demo')=>(await db.query("insert into public.jenios_ultra_devices(user_id,label,provider,market,environment,token_hash) values($1,'Fixture','mt5','forex',$2,$3) returning id",[owner,env,hash])).rows[0].id;
 const hash='1'.repeat(64),fingerprint='a'.repeat(64),id=await device(a,hash),other=await device(b,'2'.repeat(64));
 const now=Date.parse('2026-11-10T12:00:00Z');
 const queued=initialOperation({market:'forex',symbol:'EURUSD',currency:'USD',side:'buy',quantity:1},'op-1',now);
 const closed={...queued,revision:2,state:'closed',entryQuantity:'1',exitQuantity:'1',entryPrice:'1.1',exitPrice:'1.2',openedAt:queued.createdAt,closedAt:queued.createdAt,gross:'10',fees:'-0.1',financing:'0.2',costsComplete:true};
 const ingest=(ops,token=hash,env='demo',fp=fingerprint)=>db.query("select public.jenios_ultra_ingest($1,$2::jsonb,'monitoring','mt5',$3,$4) r",[token,JSON.stringify(ops),env,fp]);
 const report=async(owner,env='demo')=>(await db.query("select public.jenios_ultra_operations_report($1,$2,null,'2026-11-11',0) r",[owner,env])).rows[0].r;
 await db.exec('set role service_role');
 check((await ingest([queued])).rows[0].r.accepted===1);check((await ingest([closed])).rows[0].r.accepted===1);
 check((await ingest([closed])).rows[0].r.accepted===1);check(Number((await db.query('select count(*) n from public.jenios_ultra_operation_events')).rows[0].n)===2);
 const r=await report(a);check(r.operations.length===1&&r.totals[0].net==='9.90000000');check(r.totals[0].gains==='9.90000000'&&r.totals[0].losses==='0');
 check((await report(b)).count===0);check((await report(a,'live')).count===0);
 await assert.rejects(()=>ingest([{...closed,gross:'11'}]),/ULTRA_REVISION_CONFLICT/);checks++;
 await assert.rejects(()=>ingest([closed],hash,'live'),/ULTRA_DEVICE_SCOPE/);checks++;
 await assert.rejects(()=>ingest([closed],hash,'demo','b'.repeat(64)),/ULTRA_DEVICE_SCOPE/);checks++;
 await assert.rejects(()=>ingest([{...closed,revision:3,symbol:'GBPUSD'}]),/ULTRA_IDENTITY_CHANGED/);checks++;
 await assert.rejects(()=>ingest([{...closed,revision:3,state:'open'}]),/ULTRA_FINAL_STATE_CHANGED/);checks++;
 await assert.rejects(()=>ingest([{...queued,id:'rolled-back'}, {...closed,gross:'12'}]),/ULTRA_REVISION_CONFLICT/);checks++;
 check((await report(a)).count===1);
 await db.query('update public.jenios_ultra_devices set revoked_at=now() where id=$1',[id]);
 await assert.rejects(()=>ingest([]),/ULTRA_DEVICE_UNAUTHORIZED/);checks++;
 check((await report(a)).count===1);
 await db.exec('reset role');
 const rotated=await device(a,'3'.repeat(64));
 await db.exec('set role service_role');await ingest([closed],'3'.repeat(64));
 check((await report(a)).count===1);check((await report(a)).totals[0].net==='9.90000000');
 for(const role of ['anon','authenticated']){
  await db.exec('reset role;set role '+role);
  await assert.rejects(()=>db.query('select * from public.jenios_ultra_operations'),/permission denied/);checks++;
  await assert.rejects(()=>report(a),/permission denied/);checks++;
  await assert.rejects(()=>ingest([]),/permission denied/);checks++;
 }
 await db.exec('reset role');
 check((await db.query("select bool_and(relrowsecurity) ok from pg_class where relname in ('jenios_ultra_operations','jenios_ultra_devices','jenios_ultra_operation_events')")).rows[0].ok);
 console.log('R117_SQL_PASS',checks);
}finally{await db.close();}
