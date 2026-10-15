import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {listAdminOrders} from '../lib/pay/admin-orders.mjs';
const uid='11111111-1111-4111-8111-111111111111';
function mock({matches=[{id:uid}],profileError=null}={}){
  const calls=[];
  return {calls,from(table){let columns;const query={select(value){columns=value;calls.push(['select',table,value]);return query;},order(){return query;},limit(n){calls.push(['limit',table,n]);return query;},eq(k,v){calls.push(['eq',table,k,v]);return query;},in(k,v){calls.push(['in',table,k,v]);return query;},ilike(k,v){calls.push(['ilike',table,k,v]);return query;},then(resolve,reject){return Promise.resolve(table==='profiles'?{data:columns==='id'?matches:[{id:uid,display_name:'QA client'}],error:profileError}:{data:[{id:uid,user_id:uid,amount_cents:990,status:'paid',currency:'BRL',external_reference:JSON.stringify({productCode:'social-crypto-validator',target:'private-target',fingerprint:'private-fingerprint'})}],error:null}).then(resolve,reject);}};return query;}};
}
test('admin exact customer and status filters reach database before bounded listing',async()=>{
  const db=mock();const result=await listAdminOrders(db,{customer:uid,status:'paid'});
  assert.ok(db.calls.some(call=>call[0]==='eq'&&call[2]==='user_id'&&call[3]===uid));
  assert.ok(db.calls.some(call=>call[0]==='eq'&&call[2]==='status'&&call[3]==='paid'));
  assert.equal(result.orders[0].customerName,'QA client');
  assert.equal(JSON.stringify(result).includes('private-'),false);
  assert.equal(result.orders[0].customerId,uid);
});
test('name search escapes wildcard characters and limits customer matches',async()=>{
  const db=mock();await listAdminOrders(db,{customer:'A%_'});
  assert.ok(db.calls.some(call=>call[0]==='ilike'&&call[3]==='%A\\%\\_%'));
  assert.ok(db.calls.some(call=>call[0]==='limit'&&call[1]==='profiles'&&call[2]===50));
  assert.ok(db.calls.some(call=>call[0]==='in'&&call[2]==='user_id'));
});
test('no matching customer returns empty statement, never falls back to all clients',async()=>{
  const db=mock({matches:[]});assert.deepEqual((await listAdminOrders(db,{customer:'no match'})).orders,[]);
  assert.equal(db.calls.some(call=>call[0]==='in'&&call[2]==='id'),false);
});
test('invalid statuses are rejected before a query and profile errors fail closed',async()=>{
  const db=mock();await assert.rejects(listAdminOrders(db,{status:'paid,or=true'}),{status:400});assert.equal(db.calls.length,0);
  await assert.rejects(listAdminOrders(mock({profileError:Error('unavailable')}),{customer:'QA'}));
});
test('financial route authorizes admin before list and dashboard no longer fabricates payment success',()=>{
  const route=readFileSync(new URL('../app/api/jenios-pay/admin/route.js',import.meta.url),'utf8');
  const authorization=route.indexOf("await requireAdminPermission(request, db, 'finance.manage')");
  assert.ok(authorization>=0&&authorization<route.indexOf('listAdminOrders(db,'));
  const dashboard=readFileSync(new URL('../app/dashboard-logado/page.js',import.meta.url),'utf8');
  assert.match(dashboard,/<PaymentStatement embedded/);assert.doesNotMatch(dashboard,/Fatura de R\$ 199,90 processada com sucesso/);
});
