import test from 'node:test';
import assert from 'node:assert/strict';
import { checkoutService } from '../lib/pay/checkout.mjs';
import { DEFAULT_PRODUCTS } from '../lib/pay/catalog.mjs';

function memoryDb() {
  const orders = [];
  const db = { orders, price: 990, from(table) {
    let operation='select', payload, filters=[];
    const query = {
      select(){return query}, eq(k,v){filters.push([k,v]);return query},
      insert(body){operation='insert';payload=body;return query}, update(body){operation='update';payload=body;return query},
      maybeSingle:async()=>run(), single:async()=>run(), then(resolve,reject){return Promise.resolve(run()).then(resolve,reject)},
    };
    function run() {
      if(table==='jenios_pay_products') return {data:{...DEFAULT_PRODUCTS[0],id:'product-1',price_cents:db.price},error:null};
      if(operation==='insert') {const row={...payload,id:'order-'+(orders.length+1)};orders.push(row);return {data:row,error:null};}
      const row=orders.find(o=>filters.every(([k,v])=>o[k]===v));
      if(operation==='update'&&row)Object.assign(row,payload);
      return {data:row||null,error:null};
    }
    return query;
  }};
  return db;
}
const body={productCode:'social-bankscore-report',amount_cents:1,target:{codigo:'C123',periodo:'202606'}};
const base={body,user:{id:'user-1'},scope:'social',key:'12345678-1234-1234-1234-123456789abc',configured:()=>true};

test('checkout persiste valor server-side e reutiliza pedido em repetição',async()=>{
  const db=memoryDb();const calls=[];
  const gateway=async p=>{calls.push(p);return {checkoutUrl:'https://pay.example/'+p.orderId}};
  const first=await checkoutService({...base,db,gateway});
  const second=await checkoutService({...base,db,gateway});
  assert.equal(first.orderId,second.orderId);assert.equal(db.orders.length,1);
  assert.equal(calls[0].amount_cents,990);assert.equal(db.orders[0].status,'awaiting_payment');
  assert.equal(JSON.parse(db.orders[0].external_reference).target,undefined);
});
test('erro do gateway permite retentar sem novo pedido',async()=>{
  const db=memoryDb();
  await assert.rejects(()=>checkoutService({...base,db,gateway:async()=>{throw new Error('offline')}}));
  assert.equal(db.orders[0].status,'pending');
  await checkoutService({...base,db,gateway:async()=>({checkoutUrl:'https://pay.example/'})});
  assert.equal(db.orders.length,1);
});
test('mesma chave com outro alvo é rejeitada',async()=>{
  const db=memoryDb(); const gateway=async()=>({checkoutUrl:'https://pay.example/'});
  await checkoutService({...base,db,gateway});
  await assert.rejects(()=>checkoutService({...base,db,gateway,body:{...body,target:{codigo:'C456',periodo:'202606'}}}),e=>e.status===409);
});
test('pedido pago não emite nova cobrança',async()=>{
  const db=memoryDb(); const gateway=async()=>({checkoutUrl:'https://pay.example/'});
  await checkoutService({...base,db,gateway});db.orders[0].status='paid';
  const result=await checkoutService({...base,db,gateway:async()=>{throw new Error('não pode chamar')}});
  assert.equal(result.status,'paid');
});
test('sem configuração da PAY não persiste nem gera cobrança',async()=>{
  const db=memoryDb(); await assert.rejects(()=>checkoutService({...base,db,configured:()=>false}),e=>e.status===503);assert.equal(db.orders.length,0);
});
test('repetição conserva valor original após alteração administrativa',async()=>{
  const db=memoryDb();const calls=[];const gateway=async p=>{calls.push(p);return {checkoutUrl:'https://pay.example/'}};
  await checkoutService({...base,db,gateway});db.price=1290;
  await checkoutService({...base,db,gateway});
  assert.equal(calls[1].amount_cents,990);assert.equal(db.orders.length,1);
});
test('duas contratações do mesmo serviço têm referências financeiras distintas',async()=>{
  const db=memoryDb();const gateway=async()=>({checkoutUrl:'https://pay.example/'});
  await checkoutService({...base,db,gateway});
  await checkoutService({...base,db,gateway,key:'different-1234567890'});
  assert.equal(db.orders.length,2);assert.notEqual(db.orders[0].external_reference,db.orders[1].external_reference);
});
