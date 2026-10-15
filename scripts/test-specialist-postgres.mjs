// Isolated PostgreSQL/WASM integration checks. Never connects to Supabase.
// Install @electric-sql/pglite@0.5.10 outside the repo and set JENIOS_PGLITE_MODULE
// to its absolute dist/index.js path. No runtime dependency is added to the app.
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

if (!process.env.JENIOS_PGLITE_MODULE) throw new Error('Defina JENIOS_PGLITE_MODULE para executar os testes PostgreSQL isolados.');
const { PGlite } = await import(pathToFileURL(process.env.JENIOS_PGLITE_MODULE).href);
const db = new PGlite();
let checks = 0;
function pass(label) { checks++; console.log('PASS SQL ' + label); }
const buyer = '11111111-1111-4111-8111-111111111111', seller = '22222222-2222-4222-8222-222222222222', outsider = '33333333-3333-4333-8333-333333333333';
const a = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', b = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', c = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
try {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema public,auth to anon,authenticated,service_role;
    grant execute on function auth.uid() to authenticated,service_role;
    create table public.jenios_pay_orders(id uuid primary key,user_id uuid,amount_cents bigint,currency text,status text,external_reference text);
    grant all on public.jenios_pay_orders to service_role;`);
  const migration = (await readdir(new URL('../supabase/migrations/', import.meta.url))).find(name => name.endsWith('_specialist_order_fulfillment.sql'));
  assert.ok(migration);
  await db.exec(await readFile(new URL('../supabase/migrations/' + migration, import.meta.url), 'utf8')); pass('migration compiles');
  for (const [id, owner, professional] of [[a, buyer, seller], [b, outsider, outsider], [c, buyer, seller]]) {
    await db.query('insert into public.jenios_pay_orders values($1,$2,12345,\'BRL\',\'paid\',\'immutable-reference\')', [id, owner]);
    await db.query(`insert into public.jenios_specialist_orders(order_id,buyer_id,seller_id,offer_id,snapshot,amount_cents,commission_cents,seller_amount_cents)
      values($1,$2,$3,$4,$5,12345,1235,11110)`, [id, owner, id === b ? seller : professional, a, JSON.stringify({ title: 'Oferta original', description: 'Condições contratadas', kind: 'mentoria', sellerName: 'Especialista' })]);
  }
  const before = (await db.query('select * from public.jenios_pay_orders order by id')).rows;
  await db.exec('set role service_role');
  const action = (id, actor, revision, name, scheduled = null, url = null, note = '') => db.query('select * from public.jenios_specialist_order_action($1,$2,$3,$4,$5,$6,$7)', [id, actor, revision, name, scheduled, url, note]);
  await assert.rejects(action(a, outsider, 0, 'accept'), { code: 'P0002' }); pass('outsider denied');
  await assert.rejects(action(a, buyer, 0, 'accept'), { code: '42501' }); pass('buyer cannot act as seller');
  assert.equal((await action(a, seller, 0, 'accept')).rows[0].state, 'accepted'); pass('seller accepts paid order');
  await assert.rejects(action(a, seller, 0, 'accept'), { code: '40001' }); pass('stale revision denied');
  await assert.rejects(action(a, seller, 1, 'schedule', '2000-01-01T00:00:00Z'), { code: '22023' }); pass('past date denied');
  const tomorrow = new Date(Date.now() + 86400000).toISOString();
  await assert.rejects(action(a, seller, 1, 'schedule', tomorrow, 'https://user:secret@meeting.test'), { code: '22023' }); pass('credential URL denied');
  const scheduled = (await action(a, seller, 1, 'schedule', tomorrow, 'https://meeting.test/session')).rows[0];
  assert.equal(scheduled.state, 'scheduled'); assert.equal(scheduled.revision, 2); pass('schedule recorded');
  await assert.rejects(action(a, seller, 2, 'deliver', null, null, 'short'), { code: '22023' }); pass('empty delivery denied');
  assert.equal((await action(a, seller, 2, 'deliver', null, null, 'Sessão e materiais entregues ao cliente.')).rows[0].state, 'delivered'); pass('seller delivery recorded');
  await assert.rejects(action(a, seller, 3, 'complete'), { code: '42501' }); pass('seller cannot confirm buyer receipt');
  const completed = (await action(a, buyer, 3, 'complete')).rows[0];
  assert.equal(completed.state, 'completed'); assert.equal(completed.history.length, 4); assert.equal(completed.snapshot.title, 'Oferta original'); pass('buyer confirms; snapshot and history preserved');
  assert.equal((await action(c, seller, 0, 'decline', null, null, 'Indisponível para este atendimento.')).rows[0].state, 'declined'); pass('decline is a service state');
  assert.deepEqual((await db.query('select * from public.jenios_pay_orders order by id')).rows, before); pass('all financial records unchanged');
  await db.exec(`update public.jenios_pay_orders set status='refunded' where id='${b}'`);
  await assert.rejects(action(b, seller, 0, 'accept'), { code: '42501' }); pass('refund blocks service actions');
  await db.exec(`update public.jenios_pay_orders set status='awaiting_payment' where id='${b}'`);
  await assert.rejects(action(b, seller, 0, 'accept'), { code: '42501' }); pass('unpaid order blocked');
  await db.exec('reset role; set role authenticated');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [buyer]);
  assert.equal((await db.query('select * from public.jenios_specialist_orders')).rows.length, 2); pass('RLS buyer sees own services only');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [outsider]);
  assert.equal((await db.query('select * from public.jenios_specialist_orders')).rows.length, 1); pass('RLS isolates other account');
  await assert.rejects(action(a, seller, 4, 'complete'), { code: '42501' }); pass('authenticated cannot execute backend RPC');
  await assert.rejects(db.query("update public.jenios_specialist_orders set state='completed'"), { code: '42501' }); pass('authenticated direct writes denied');
  await db.exec('reset role; set role anon');
  await assert.rejects(db.query('select * from public.jenios_specialist_orders'), { code: '42501' }); pass('anonymous reads denied');
  console.log(`${checks} PostgreSQL checks passed (isolated WASM, not remote homologation).`);
} finally { await db.close(); }
