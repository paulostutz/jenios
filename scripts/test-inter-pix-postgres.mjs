import {readFile} from 'node:fs/promises';import assert from 'node:assert/strict';
const {PGlite}=await import(process.env.JENIOS_PGLITE_MODULE||'@electric-sql/pglite');const db=new PGlite();
await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
create table jenios_pay_orders(id uuid primary key,amount_cents bigint,currency text,status text,external_reference text,created_at timestamptz default now(),updated_at timestamptz default now());
create table jenios_pay_payments(id uuid primary key default gen_random_uuid(),order_id uuid references jenios_pay_orders,provider text,provider_payment_id text,payment_method text,amount_cents bigint,status text,confirmed_at timestamptz,updated_at timestamptz,unique(provider,provider_payment_id));
alter table jenios_pay_orders enable row level security;alter table jenios_pay_payments enable row level security;
grant select,update on jenios_pay_orders to service_role;`);
await db.exec(await readFile(new URL('../supabase/migrations/20261015212117_inter_pix_confirmation_r21.sql',import.meta.url),'utf8'));
const id='11111111-1111-4111-8111-111111111111',id2='22222222-2222-4222-8222-222222222222',receipt='E'+'1'.repeat(31);
for(const key of [id,id2]){await db.query(`insert into jenios_pay_orders(id,amount_cents,currency,status,external_reference) values($1,990,'BRL','awaiting_payment','{"scope":"social"}')`,[key]);await db.query(`insert into jenios_pay_payments(order_id,provider,provider_payment_id,payment_method,amount_cents,status) values($1,'inter_pix',$2,'pix',990,'pending')`,[key,key.replaceAll('-','')]);}
const call=(key=id,amount=990,end=receipt)=>db.query('select jenios_confirm_inter_pix($1,$2,$3,$4,now())',[key,key.replaceAll('-',''),amount,end]);
await db.exec('set role authenticated');await assert.rejects(call());await db.exec('reset role;set role anon');await assert.rejects(call());await db.exec('reset role;set role service_role');
await assert.rejects(call(id,1));await assert.rejects(call(id,990,null));assert.equal((await db.query('select status from jenios_pay_orders where id=$1',[id])).rows[0].status,'awaiting_payment');
await call();await call();assert.equal((await db.query('select status from jenios_pay_orders where id=$1',[id])).rows[0].status,'paid');
await assert.rejects(call(id,990,'E'+'2'.repeat(31)));await assert.rejects(call(id2));
assert.equal((await db.query('select status from jenios_pay_orders where id=$1',[id2])).rows[0].status,'awaiting_payment');
assert.equal((await db.query('select status from jenios_pay_payments where order_id=$1',[id2])).rows[0].status,'pending');
await db.close();console.log('PASS only service role confirms; amount, null receipt and receipt replay rejected; idempotent confirmation; atomic rollback');
