import test from 'node:test';import assert from 'node:assert/strict';
import {interPixConfigured,pixTxid,verifyPixCharge,createInterPixClient,createInterCheckout} from '../lib/pay/inter-pix.mjs';
import {pixStatus} from '../lib/pay/pix-status.mjs';
const id='11111111-1111-4111-8111-111111111111',user={id:'buyer'},now=Date.now();
const env={JENIOS_PAY_PROVIDER:'inter_pix',INTER_CLIENT_ID:'fixture',INTER_CLIENT_SECRET:'fixture',INTER_CERTIFICATE:'fixture',INTER_PRIVATE_KEY:'fixture',INTER_PIX_KEY:'qa@example.invalid'};
const order={id,user_id:user.id,amount_cents:990,currency:'BRL',status:'awaiting_payment',external_reference:JSON.stringify({productCode:'social-bankscore-report',scope:'social'})};
const active=()=>({txid:pixTxid(id),chave:env.INTER_PIX_KEY,status:'ATIVA',valor:{original:'9.90'},calendario:{criacao:new Date(now-10000).toISOString(),expiracao:3600},pixCopiaECola:'000201-fixture-not-payable'});
const paid=()=>({...active(),status:'CONCLUIDA',pix:[{txid:pixTxid(id),endToEndId:'E'+'1'.repeat(31),valor:'9.90',horario:new Date(now).toISOString()}]});
test('Pix requires explicit provider and all credentials; txid deterministic per order',()=>{
  assert.equal(interPixConfigured(env),true);for(const field of Object.keys(env))assert.equal(interPixConfigured({...env,[field]:''}),false);
  assert.equal(pixTxid(id),id.replaceAll('-',''));assert.throws(()=>pixTxid('https://attacker.invalid'));
});
test('bank response must match key, order and exact amount; expired code not displayed',()=>{
  assert.equal(verifyPixCharge(active(),order,{env,now}).status,'awaiting_payment');
  for(const changes of [{txid:'a'.repeat(32)},{chave:'other'},{valor:{original:'0.01'}},{valor:{original:9.9}}])assert.throws(()=>verifyPixCharge({...active(),...changes},order,{env,now}));
  assert.equal(verifyPixCharge({...active(),calendario:{criacao:new Date(now-3600001).toISOString(),expiracao:3600}},order,{env,now}).status,'expired');
});
test('only matched bank receipt confirms; forged amount, missing receipt, refund and future timestamp fail',()=>{
  assert.equal(verifyPixCharge(paid(),order,{env,now}).status,'paid');
  for(const change of [{txid:'a'.repeat(32)},{valor:'1.00'},{endToEndId:'fake'},{devolucoes:[{status:'DEVOLVIDO'}]},{horario:new Date(now+3600000).toISOString()}]){
    const charge=paid();Object.assign(charge.pix[0],change);assert.throws(()=>verifyPixCharge(charge,order,{env,now}));
  }
  assert.throws(()=>verifyPixCharge({...paid(),pix:[]},order,{env,now}));
});
test('Inter creates with deterministic PUT, reuses existing charge, never sends payer secrets',async()=>{
  let exists=false;const calls=[];
  const client=createInterPixClient({env:{...env,INTER_CLIENT_ID:'test-create'},request:async input=>{
    calls.push(input);if(input.path==='/oauth/v2/token')return {access_token:'fixture-token',expires_in:3600};
    if(input.method==='GET'&&!exists)throw Object.assign(Error('not found'),{bankStatus:404});
    if(input.method==='PUT'){exists=true;assert.equal(input.body.valor.original,'9.90');assert.equal(input.body.valor.modalidadeAlteracao,0);assert.equal(input.body.devedor,undefined);}return active();
  }});
  await client.create({orderId:id,amount_cents:990});await client.create({orderId:id,amount_cents:990});
  assert.equal(calls.filter(x=>x.method==='PUT').length,1);assert.equal(calls.filter(x=>x.path==='/oauth/v2/token').length,1);
});
test('Inter auth failure never creates a charge; database failure never calls bank',async()=>{
  let calls=0;const client=createInterPixClient({env:{...env,INTER_CLIENT_ID:'test-denied'},request:async()=>{calls++;throw Object.assign(Error('denied'),{bankStatus:403});}});
  await assert.rejects(client.create({orderId:id,amount_cents:990}));assert.equal(calls,1);
  await assert.rejects(createInterCheckout({orderId:id,scope:'social',billing_type:'one_time',amount_cents:990},{env,db:{from:()=>({upsert:async()=>({error:{}})})},client:{create:()=>assert.fail('must not call bank')}}),{status:503});
});
function dbFor(visible=true){let confirmed=0;return {get confirmed(){return confirmed;},from(table){const query={select:()=>query,eq:()=>query,is:()=>query,maybeSingle:async()=>({data:table==='jenios_pay_orders'?(visible?order:null):{id:'payment',amount_cents:990,provider_payment_id:pixTxid(id)}})};return query;},rpc:async(name,args)=>{assert.equal(name,'jenios_confirm_inter_pix');assert.equal(args.p_amount,990);confirmed++;return {error:null};}};}
test('status lookup verifies ownership before bank access and only bank-confirmed data reaches atomic RPC',async()=>{
  await assert.rejects(pixStatus({db:dbFor(false),user,id,env,client:{read:()=>assert.fail('other buyer must not access bank')}}),{status:404});
  const db=dbFor();let result=await pixStatus({db,user,id,env,client:{read:async()=>active()}});assert.equal(result.status,'awaiting_payment');assert.equal(db.confirmed,0);
  result=await pixStatus({db,user,id,env,client:{read:async()=>paid()}});assert.equal(result.status,'paid');assert.equal(db.confirmed,1);assert.equal(result.pixCode,undefined);
});
