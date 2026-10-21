import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const qa=readFileSync(new URL('../supabase/qa/jenios_b289qa_financial_preflight.sql',import.meta.url),'utf8');
const canonical=readFileSync(new URL('../supabase/migrations/20261012_jenios_pay_v1.sql',import.meta.url),'utf8');
const learning=readFileSync(new URL('../db/schema/learning-r26.sql',import.meta.url),'utf8');
test('B289 QA mirrors original schema rather than recreating or touching production tables',()=>{
 for(const table of ['jenios_pay_products','jenios_pay_orders','jenios_pay_payments','jenios_pay_subscriptions','jenios_pay_webhook_events','jenios_pay_entitlements'])
  assert.match(canonical,new RegExp('CREATE TABLE IF NOT EXISTS public\\.'+table));
 assert.match(learning,/CREATE TABLE public\.jenios_learning_state/);
 assert.match(qa,/revoke all on public\.jenios_pay_products/);
 assert.match(qa,/grant select,insert,update,delete on public\.jenios_pay_products/);
 assert.match(qa,/security_invoker=true/);
});
test('B289 approved three prices exist but no plan may sell in QA',()=>{
 for(const [code,cents] of [['platform-nacional',9990],['platform-global-crypto',14990],['platform-internacional-pro',19990]]){
  assert.ok(qa.includes("'"+code+"'"),code);
  assert.ok(qa.includes(String(cents)),String(cents));
 }
 assert.match(qa,/on conflict\(code\) do nothing/);
 assert.doesNotMatch(qa,/\btrue\s*\)\s*,?\s*$/m);
 assert.match(qa,/ZERO users, ZERO orders, ZERO payment receipts/);
});
test('B289 SQL blocks browser writes and learner content exposure',()=>{
 assert.match(qa,/revoke all on public\.jenios_learning_state from public,anon,authenticated/);
 assert.match(qa,/grant select,insert,update,delete on public\.jenios_learning_state to service_role/);
 assert.match(qa,/from public,anon,authenticated/);
 assert.match(qa,/ALTER TABLE|alter table/i);
 assert.doesNotMatch(qa,/\bINSERT INTO auth\.users|UPDATE auth\.users|real.*Pix.*charge/i);
});
