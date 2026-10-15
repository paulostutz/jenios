import test from 'node:test';
import assert from 'node:assert/strict';
import { checkoutService } from '../lib/pay/checkout.mjs';
import { DEFAULT_PRODUCTS } from '../lib/pay/catalog.mjs';

function memoryDb({product=DEFAULT_PRODUCTS[0],profile=null}={}) {
  const orders = [];
  const db = { orders, price: product.price_cents, from(table) {
    let operation='select', payload, filters=[];
    const query = {
      select(){return query}, eq(k,v){filters.push([k,v]);return query},
      insert(body){operation='insert';payload=body;return query}, update(body){operation='update';payload=body;return query},
      maybeSingle:async()=>run(), single:async()=>run(), then(resolve,reject){return Promise.resolve(run()).then(resolve,reject)},
    };
    function run() {
      if(table==='jenios_pay_products') return {data:{...product,id:'product-1',price_cents:db.price},error:null};
      if(table==='jenios_specialist_profiles')return {data:profile,error:null};
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

test('não cobra por rede sem provedor homologado', async () => {
  const db = memoryDb({ product: DEFAULT_PRODUCTS[1] });
  await assert.rejects(checkoutService({ ...base, db, body: { productCode: 'social-crypto-validator', target: { network: 'litecoin', type: 'wallet', identifier: 'test' } }, gateway: async () => { throw Error('Gateway não deve ser chamado'); } }), { status: 400 });
  assert.equal(db.orders.length, 0);
});

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
test('contratação de especialista usa oferta salva e calcula 10% no servidor',async()=>{
  const specialistId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',offerId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const profile={user_id:specialistId,nome:'Profissional',sobre:JSON.stringify({schema:'jenios-specialist-v1',public:true,about:'Perfil público',offers:[{id:offerId,kind:'mentoria',title:'Sessão',description:'Uma sessão',price_cents:12345}]})};
  const db=memoryDb({product:DEFAULT_PRODUCTS.find(p=>p.code==='social-specialist-offer'),profile});let sent;
  await checkoutService({...base,db,body:{productCode:'social-specialist-offer',amount_cents:1,target:{specialistId,offerId}},gateway:async payload=>{sent=payload;return {checkoutUrl:'https://pay.example/'}}});
  assert.equal(sent.amount_cents,12345);assert.equal(sent.commission_cents,1235);assert.equal(sent.seller_amount_cents,11110);assert.equal(sent.seller_id,specialistId);
});
test('ofertas privadas não podem ser contratadas por ID adivinhado',async()=>{
  const db=memoryDb({product:DEFAULT_PRODUCTS.find(p=>p.code==='social-specialist-offer'),profile:{sobre:'Currículo privado'}});
  await assert.rejects(()=>checkoutService({...base,db,body:{productCode:'social-specialist-offer',target:{specialistId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',offerId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'}}}),e=>e.status===404);
});
