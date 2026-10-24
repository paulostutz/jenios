/** Local database and bank fixtures only. No real account, credential or payment is used. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {handleUniversitySubscription} from '../lib/assistant/university-subscription.mjs';
import {pixStatus} from '../lib/pay/pix-status.mjs';
import {UNIVERSITY_MONTHLY_PRODUCT as PRODUCT,UNIVERSITY_MONTHLY_TERMS as TERMS,
 UNIVERSITY_MONTHLY_TABLE as TABLE,UNIVERSITY_MONTHLY_RPC as RPC,universityMonthEnd} from '../lib/assistant/university-monthly-access.mjs';

const A='b1400040-0000-4000-8000-000000000001',B='b1400040-0000-4000-8000-000000000002';
const O='b1400040-0000-4000-8000-000000000011',P='b1400040-0000-4000-8000-000000000012',I='b1400040-0000-4000-8000-000000000013';
const NOW=Date.now(),paid=new Date(NOW-60000).toISOString(),created=new Date(NOW-120000).toISOString(),key='r40-university-request-001';
const local=new Date(Date.parse(paid)-3*3600000),anchorDay=local.getUTCDate();
const anchorTime=[local.getUTCHours(),local.getUTCMinutes(),local.getUTCSeconds()].map(n=>String(n).padStart(2,'0')).join(':')+'.'+String(local.getUTCMilliseconds()).padStart(3,'0');
const flags=Object.freeze({JENIOS_PAY_PROVIDER:'inter_pix',JENIOS_PAY_PAYMENTS_ENABLED:'true',JENIOS_INTER_CHARGES_ENABLED:'true'});
// Exercise the actual Vault loader and certificate validator with disposable local material.
const temp=mkdtempSync(join(tmpdir(),'jenios-r40-university-cert-'));
let certificate,privateKey;
try{
 execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-keyout',join(temp,'private.pem'),'-out',join(temp,'cert.pem'),'-days','2','-nodes','-subj','/CN=university-r40.test.invalid'],{stdio:'ignore'});
 certificate=readFileSync(join(temp,'cert.pem'),'utf8');privateKey=readFileSync(join(temp,'private.pem'),'utf8');
}finally{rmSync(temp,{recursive:true,force:true});}
const vault=Object.freeze({purpose:'jenios_pix_configuration_only',client_id:'r40-fixture-client-id',client_secret:'r40-fixture-client-secret-only',certificate,private_key:privateKey,pix_key:'r40-fixture-pix-key',account_number:'r40-fixture-account'});
const credentials=Object.freeze({INTER_CLIENT_ID:vault.client_id,INTER_CLIENT_SECRET:vault.client_secret,INTER_CERTIFICATE:certificate,INTER_PRIVATE_KEY:privateKey,INTER_PIX_KEY:vault.pix_key,INTER_ACCOUNT_NUMBER:vault.account_number});
const completeEnv=Object.freeze({...flags,...credentials});
const sku={id:P,code:PRODUCT,category:'other',price_cents:4990,currency:'BRL',billing_type:'monthly',active:true};
const receipt=()=>({id:'r40-fixture-receipt',order_id:O,provider:'inter_pix',payment_method:'pix',provider_payment_id:O.replaceAll('-',''),amount_cents:4990,status:'confirmed',confirmed_at:paid});
function order(requestKey=key,status='pending'){
 return {id:O,user_id:A,product_id:P,provider:'inter_pix',amount_cents:4990,currency:'BRL',status,created_at:created,idempotency_key:'university:'+A+':'+requestKey,
  external_reference:JSON.stringify({productCode:PRODUCT,scope:'social',termsVersion:TERMS,billingType:'monthly',renewalMode:'manual_pix',fingerprint:'university:'+A+':'+requestKey})};
}
function invoice(requestKey=key,active=false){
 return {id:I,user_id:A,order_id:O,request_key:requestKey,terms_version:TERMS,amount_cents:4990,currency:'BRL',status:active?'active':'pending',created_at:created,
  ...(active?{receipt_id:receipt().id,paid_at:paid,period_start:paid,period_end:universityMonthEnd(paid,anchorDay,anchorTime),anchor_day:anchorDay,anchor_time:anchorTime}:{})};
}
function fixture({state='empty',vaultValue=vault,vaultError=null,viewer=A,bankPaid=false,productActive=true}={}){
 const calls={auth:0,vault:0,prepare:0,confirm:0,pixConfirm:0,gateway:0,client:0,read:0,create:0},events=[],runtimeEnvs=[];
 const tables={jenios_pay_products:[{...sku,active:productActive}],jenios_pay_subscriptions:[],jenios_pay_entitlements:[],jenios_pay_orders:[],jenios_pay_payments:[],[TABLE]:[]};
 if(state!=='empty'){
  tables.jenios_pay_orders.push(order(key,state==='active'||state==='paid'?'paid':state==='closed'?'cancelled':'awaiting_payment'));
  tables[TABLE].push(invoice(key,state==='active'));
  tables.jenios_pay_payments.push(state==='active'||state==='paid'?receipt():{...receipt(),status:'pending',confirmed_at:null});
 }
 const db={tables,calls,events,runtimeEnvs,auth:{async getUser(){calls.auth++;events.push('auth');return {data:{user:viewer?{id:viewer,app_metadata:{}}:null},error:null};}},
  from(table){
   assert.ok(table in tables,'Unexpected table '+table);events.push('table:'+table);
   const filters=[];let limit=Infinity,patch=null,sort=null;
   const execute=()=>{
    let rows=tables[table].filter(row=>filters.every(fn=>fn(row)));
    if(patch)for(const row of rows)Object.assign(row,structuredClone(patch));
    if(sort)rows.sort((a,b)=>String(a[sort[0]]||'').localeCompare(String(b[sort[0]]||''))*(sort[1]?1:-1));
    return {data:structuredClone(rows.slice(0,limit)),error:null};
   };
   const q={select(){return q;},eq(k,v){filters.push(r=>r[k]===v);return q;},in(k,v){filters.push(r=>v.includes(r[k]));return q;},gt(k,v){filters.push(r=>Date.parse(r[k])>Date.parse(v));return q;},limit(n){limit=n;return q;},order(k,{ascending=true}={}){sort=[k,ascending];return q;},update(v){patch=v;return q;},then(ok,bad){return Promise.resolve(execute()).then(ok,bad);},async maybeSingle(){const result=execute();return {...result,data:result.data[0]||null};}};
   return q;
  },
  async rpc(name,args){
   events.push('rpc:'+name);
   if(name==='jenios_inter_load_b283'){
    calls.vault++;if(vaultError)throw vaultError;
    return {data:vaultValue,error:null};
   }
   if(name===RPC.prepare){
    calls.prepare++;assert.equal(args.p_user_id,A);
    let found=tables[TABLE].find(row=>row.user_id===A&&(row.request_key===args.p_request_key||row.status==='pending'));
    const replayed=Boolean(found);
    if(!found){found=invoice(args.p_request_key);tables[TABLE].push(found);tables.jenios_pay_orders.push(order(args.p_request_key));}
    return {data:{ok:true,replayed,invoice:structuredClone(found),order:structuredClone(tables.jenios_pay_orders.find(row=>row.id===found.order_id))},error:null};
   }
   if(name==='jenios_confirm_inter_pix'){
    calls.pixConfirm++;assert.equal(args.p_order_id,O);assert.equal(args.p_txid,O.replaceAll('-',''));assert.equal(args.p_amount,4990);
    tables.jenios_pay_orders[0].status='paid';tables.jenios_pay_payments.splice(0,Infinity,receipt());
    return {data:null,error:null};
   }
   if(name===RPC.confirm){
    calls.confirm++;assert.equal(args.p_user_id,A);assert.equal(args.p_order_id,O);
    const record=tables[TABLE].find(row=>row.user_id===args.p_user_id&&row.order_id===args.p_order_id);
    if(!record||tables.jenios_pay_orders[0]?.status!=='paid'||!tables.jenios_pay_payments.some(row=>row.status==='confirmed'&&row.amount_cents===4990))return {data:{ok:false,code:'PAYMENT_NOT_CONFIRMED'},error:null};
    Object.assign(record,invoice(record.request_key,true));return {data:{ok:true,invoice:structuredClone(record)},error:null};
   }
   assert.fail('Unexpected RPC '+name);
  }
 };
 const options={db,now:NOW,
  gateway:async(payload,{env})=>{
   calls.gateway++;runtimeEnvs.push(env);assert.equal(payload.userId,A);assert.equal(payload.amount_cents,4990);assert.equal(payload.billing_type,'one_time');assert.equal(payload.scope,'social');
   return {checkoutUrl:'/social/pagamento?pedido='+payload.orderId};
  },
  pixClientFactory:({env})=>{
   calls.client++;runtimeEnvs.push(env);
   return {read:async txid=>{
    calls.read++;assert.equal(txid,O.replaceAll('-',''));
    return {txid,chave:env.INTER_PIX_KEY,valor:{original:'49.90'},calendario:{criacao:created,expiracao:3600},
     status:bankPaid?'CONCLUIDA':'ATIVA',pixCopiaECola:'000201-r40-fixture-pix-code',...(bankPaid?{pix:[{txid,valor:'49.90',endToEndId:'E'+'1'.repeat(31),horario:paid}]}:{})};
   },create:async()=>{calls.create++;assert.fail('A status lookup must never create a charge');}};
  },
  paymentStatus:async args=>{assert.equal(args.env,runtimeEnvs.at(-1));return pixStatus(args);}
 };
 return {db,options,calls,tables,events,runtimeEnvs};
}
const consent=()=>({requestKey:key,acceptTerms:true,amountCents:4990,currency:'BRL',termsVersion:TERMS});
function request(action,{body=consent(),withToken=true,orderId=O}={}){
 return new Request('https://qa.invalid/api/assistant/university/'+action+(action==='status'?'?orderId='+orderId:''),{
  method:action==='checkout'?'POST':'GET',headers:{...(withToken?{authorization:'Bearer r40-fixture-token'}:{}),...(action==='checkout'?{'content-type':'application/json'}:{})},...(action==='checkout'?{body:JSON.stringify(body)}:{})
 });
}
async function invoke(f,action,env=flags,{requestOptions={},...overrides}={}){
 const response=await handleUniversitySubscription(request(action,requestOptions),{action,...f.options,env,...overrides});
 const body=await response.json();return {response,body};
}
function noSecrets(body){const text=JSON.stringify(body);for(const value of Object.values(credentials))assert.ok(!text.includes(value),'Credential material must not leave the server');}
function noBank(calls){for(const key of ['gateway','client','read','create'])assert.equal(calls[key],0,key);}

test('R40 complete server env is reused without Vault, mutation or returned secrets',async()=>{
 const f=fixture({vaultError:Error('Vault must not be read')}),before=structuredClone(completeEnv);
 const {response,body}=await invoke(f,'checkout',completeEnv);
 assert.equal(response.status,200);assert.equal(body.state,'awaiting_payment');assert.equal(f.calls.vault,0);assert.equal(f.calls.gateway,1);
 assert.notEqual(f.runtimeEnvs[0],completeEnv);assert.deepEqual(f.runtimeEnvs[0],completeEnv);assert.deepEqual(completeEnv,before);noSecrets(body);
});

test('R40 Vault-only configuration enables the offer and manual Pix checkout through the actual loader',async()=>{
 const env=Object.freeze({...flags}),before=structuredClone(env),offer=fixture();
 const access=await invoke(offer,'access',env);assert.equal(access.response.status,200);assert.equal(access.body.offer.available,true);assert.equal(access.body.offer.renewalMode,'manual_pix');assert.equal(offer.calls.vault,1);noBank(offer.calls);noSecrets(access.body);
 const f=fixture(),{response,body}=await invoke(f,'checkout',env);
 assert.equal(response.status,200);assert.equal(f.calls.vault,1);assert.equal(f.calls.prepare,1);assert.equal(f.calls.gateway,1);assert.equal(body.amountCents,4990);
 assert.ok(f.events.indexOf('auth')<f.events.indexOf('rpc:jenios_inter_load_b283'));assert.ok(f.events.indexOf('rpc:jenios_inter_load_b283')<f.events.indexOf('rpc:'+RPC.prepare));
 assert.deepEqual(f.runtimeEnvs[0],{...flags,...credentials});assert.deepEqual(env,before);noSecrets(body);
});

test('R40 partial env is completed by the single Vault source without mixing stale credentials',async()=>{
 const env=Object.freeze({...flags,INTER_CLIENT_ID:'stale-env-client',INTER_PIX_KEY:'stale-env-pix'}),f=fixture();
 const {response,body}=await invoke(f,'checkout',env);assert.equal(response.status,200);assert.equal(f.calls.vault,1);
 assert.equal(f.runtimeEnvs[0].INTER_CLIENT_ID,vault.client_id);assert.equal(f.runtimeEnvs[0].INTER_PIX_KEY,vault.pix_key);assert.equal(env.INTER_CLIENT_ID,'stale-env-client');noSecrets(body);
});

test('R40 visitors and anonymous identities never reach private Vault, ledger or bank',async()=>{
 for(const action of ['access','checkout','status'])for(const mode of ['missing','anonymous']){
  const f=fixture({state:'pending'}),overrides=mode==='missing'?{requestOptions:{withToken:false}}:{authorize:async()=>({id:A,is_anonymous:true})};
  const {response}=await invoke(f,action,flags,overrides);assert.equal(response.status,401);assert.equal(f.calls.vault,0);assert.equal(f.events.filter(x=>x.startsWith('table:')).length,0);noBank(f.calls);
 }
});

test('R40 invalid consent is rejected before resolving bank credentials',async()=>{
 const f=fixture();const {response}=await invoke(f,'checkout',flags,{requestOptions:{body:{...consent(),amountCents:1}}});
 assert.equal(response.status,400);assert.equal(f.calls.vault,0);assert.equal(f.calls.prepare,0);noBank(f.calls);
});

test('R40 missing, malformed or failed Vault disables the offer and blocks preparation safely',async()=>{
 for(const config of [{vaultValue:null},{vaultValue:{}},{vaultValue:{...vault,purpose:'other'}},{vaultValue:{...vault,private_key:'invalid private key'}},{vaultError:Object.assign(Error(vault.client_secret),{status:503})}]){
  const offer=fixture(config),access=await invoke(offer,'access');assert.equal(access.response.status,200);assert.equal(access.body.offer.available,false);assert.equal(access.body.canPurchase,false);noSecrets(access.body);noBank(offer.calls);
  const f=fixture(config),{response,body}=await invoke(f,'checkout');assert.equal(response.status,503);assert.equal(body.code,'UNIVERSITY_PAYMENTS_UNAVAILABLE');assert.equal(f.calls.prepare,0);noBank(f.calls);noSecrets(body);
 }
});

test('R40 each charge flag must be exactly true before any private Vault read or new charge',async()=>{
 for(const name of ['JENIOS_PAY_PAYMENTS_ENABLED','JENIOS_INTER_CHARGES_ENABLED'])for(const value of [undefined,'false','TRUE',true,'1'])for(const source of [flags,completeEnv]){
  const env={...source,[name]:value},offer=fixture(),access=await invoke(offer,'access',env);
  assert.equal(access.body.offer.available,false);assert.equal(offer.calls.vault,0);noBank(offer.calls);
  const f=fixture(),{response,body}=await invoke(f,'checkout',env);assert.equal(response.status,503);assert.equal(body.code,'UNIVERSITY_PAYMENTS_UNAVAILABLE');assert.equal(f.calls.vault,0);assert.equal(f.calls.prepare,0);noBank(f.calls);
 }
});

test('R40 another provider or inactive catalog does not trigger private Vault loading',async()=>{
 for(const config of [{env:{...flags,JENIOS_PAY_PROVIDER:'other'},productActive:true},{env:flags,productActive:false}]){
  const f=fixture(config),{response,body}=await invoke(f,'access',config.env);assert.equal(response.status,200);assert.equal(body.offer.available,false);assert.equal(f.calls.vault,0);noBank(f.calls);
  const result=await invoke(f,'checkout',config.env);assert.equal(result.response.status,503);assert.equal(f.calls.prepare,0);assert.equal(f.calls.vault,0);noBank(f.calls);
 }
});

test('R40 status verifies ownership before resolving Vault or contacting Inter',async()=>{
 const f=fixture({state:'pending',viewer:B}),{response,body}=await invoke(f,'status');
 assert.equal(response.status,404);assert.equal(body.code,'ORDER_NOT_FOUND');assert.equal(f.calls.vault,0);noBank(f.calls);
});

test('R40 owned pending status reuses the Vault env in the read-only Pix transport',async()=>{
 const f=fixture({state:'pending'}),{response,body}=await invoke(f,'status');
 assert.equal(response.status,200);assert.equal(body.state,'awaiting_payment');assert.equal(body.access.active,false);
 assert.equal(f.calls.vault,1);assert.equal(f.calls.client,1);assert.equal(f.calls.read,1);assert.equal(f.calls.gateway,0);assert.equal(f.calls.create,0);assert.equal(f.calls.confirm,0);noSecrets(body);
 assert.deepEqual(f.runtimeEnvs[0],{...flags,...credentials});
});

test('R40 pausing new charges preserves read-only reconciliation of a bank-confirmed owned order',async()=>{
 for(const source of [flags,completeEnv]){
  const env=Object.freeze({...source,JENIOS_PAY_PAYMENTS_ENABLED:'false',JENIOS_INTER_CHARGES_ENABLED:'false'}),f=fixture({state:'pending',bankPaid:true});
  const {response,body}=await invoke(f,'status',env);assert.equal(response.status,200);assert.equal(body.state,'active');assert.equal(body.access.active,true);
  assert.equal(f.calls.vault,source===flags?1:0);assert.equal(f.calls.read,1);assert.equal(f.calls.pixConfirm,1);assert.equal(f.calls.confirm,1);assert.equal(f.calls.gateway,0);assert.equal(f.calls.create,0);assert.equal(f.tables.jenios_pay_orders.length,1);noSecrets(body);
 }
});

test('R40 unavailable Vault preserves an existing pending order without attempting another charge',async()=>{
 const f=fixture({state:'pending',vaultValue:null}),{response,body}=await invoke(f,'status');
 assert.equal(response.status,503);assert.equal(body.state,'order_preserved');assert.equal(body.orderId,O);assert.equal(body.code,'UNIVERSITY_PAYMENTS_UNAVAILABLE');assert.equal(f.tables.jenios_pay_orders[0].status,'awaiting_payment');noBank(f.calls);noSecrets(body);
});

test('R40 paid access survives paused sales and an unavailable Vault',async()=>{
 for(const paused of [true,false]){
  const env=Object.freeze({...flags,...(paused?{JENIOS_PAY_PAYMENTS_ENABLED:'false',JENIOS_INTER_CHARGES_ENABLED:'false'}:{})}),f=fixture({state:'active',vaultError:Error('offline')});
  const {response,body}=await invoke(f,'access',env);assert.equal(response.status,200);assert.equal(body.access.active,true);assert.equal(body.access.kind,'university-monthly');assert.equal(body.offer.available,false);assert.equal(body.canRenew,false);
  assert.equal(f.calls.vault,paused?0:1);noBank(f.calls);noSecrets(body);
 }
});

test('R40 an already-paid order confirms from its receipt without Vault or bank, even during a sales pause',async()=>{
 const f=fixture({state:'paid',vaultError:Error('must not load')}),{response,body}=await invoke(f,'status',Object.freeze({...flags,JENIOS_PAY_PAYMENTS_ENABLED:'false',JENIOS_INTER_CHARGES_ENABLED:'false'}));
 assert.equal(response.status,200);assert.equal(body.state,'active');assert.equal(body.access.active,true);assert.equal(f.calls.vault,0);assert.equal(f.calls.confirm,1);noBank(f.calls);noSecrets(body);
});

test('R40 a paid order without proof stays pending access and recovers locally when the receipt arrives',async()=>{
 const f=fixture({state:'paid',vaultError:Error('must not load')});f.tables.jenios_pay_payments.length=0;
 const first=await invoke(f,'status',{});assert.equal(first.response.status,202);assert.equal(first.body.state,'paid_pending_access');assert.equal(first.body.checkoutUrl,null);assert.equal(f.calls.vault,0);noBank(f.calls);
 f.tables.jenios_pay_payments.push(receipt());const second=await invoke(f,'status',{});assert.equal(second.response.status,200);assert.equal(second.body.state,'active');assert.equal(f.calls.vault,0);noBank(f.calls);
});

test('R40 terminal orders remain closed without private configuration or bank requests',async()=>{
 const f=fixture({state:'closed',vaultError:Error('must not load')}),{response,body}=await invoke(f,'status',{});
 assert.equal(response.status,200);assert.equal(body.state,'closed');assert.equal(body.checkoutUrl,null);assert.equal(f.calls.vault,0);noBank(f.calls);
});

test('R40 Vault checkout retries retain the existing request, owner and single bank charge',async()=>{
 const f=fixture();const first=await invoke(f,'checkout');assert.equal(first.response.status,200);
 const second=await invoke(f,'checkout',flags,{requestOptions:{body:{...consent(),requestKey:'r40-another-browser-key-002'}}});
 assert.equal(second.response.status,200);assert.equal(second.body.orderId,first.body.orderId);assert.equal(second.body.requestKey,key);assert.equal(f.calls.gateway,1);assert.equal(f.tables.jenios_pay_orders.length,1);assert.equal(f.tables[TABLE][0].user_id,A);noSecrets(second.body);
});
