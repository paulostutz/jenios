import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {deflateRawSync} from 'node:zlib';
import {
 SALES_PLANS,commercialPlan,isAdvancedTier,salesReplyGuided
} from '../lib/assistant/sales-policy.mjs';
import {replySales,reserveSalesAiBudget,anonymousVisitorDigest}
 from '../lib/assistant/sales-provider.mjs';
import {validateJeniosInterSetup,saveJeniosInter,statusJeniosInter,
 loadJeniosInterServerEnv,testJeniosInterAuth} from '../lib/pay/inter-vault.mjs';
import {zipMaterial,validateMaterial,crc32} from '../lib/pay/inter-material.mjs';
import {handlePro} from '../lib/assistant/pro-service.mjs';
import {POST as freePost,GET as freeGet} from '../app/api/assistant/free/route.js';
const req=(data)=>new Request('https://qa.invalid/api/assistant/free',
 {method:'POST',headers:{origin:'https://qa.invalid','content-type':'application/json'},
  body:JSON.stringify(data)});
const salesEnv={JENIOS_SALES_GENERATIVE_ENABLED:'true',
 JENIOS_SALES_MODEL:'test-safe-model',OPENAI_API_KEY:'test-only-key-xxxxxxxxxxxxxxxxxxxxxx',
 JENIOS_SALES_VISITOR_SALT:'sha256-dev-salt-xxxxxxxxxxxxxxxxxxxxxxxxx',
 JENIOS_AI_MONTHLY_BUDGET_USD:'10'};
function testZip(entries){
 let offset=0;const parts=[],central=[];
 for(const x of entries){
  const name=Buffer.from(x.name),raw=Buffer.from(x.body||''),
   data=x.method===8?deflateRawSync(raw):raw;
  const local=Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50);local.writeUInt16LE(20,4);
  local.writeUInt16LE(x.flags||0,6);local.writeUInt16LE(x.method||0,8);
  local.writeUInt32LE(crc32(raw),14);local.writeUInt32LE(data.length,18);
  local.writeUInt32LE(raw.length,22);local.writeUInt16LE(name.length,26);
  parts.push(local,name,data);
  const c=Buffer.alloc(46);
  c.writeUInt32LE(0x02014b50);c.writeUInt16LE(0x0314,4);
  c.writeUInt16LE(20,6);c.writeUInt16LE(x.flags||0,8);
  c.writeUInt16LE(x.method||0,10);c.writeUInt32LE(crc32(raw),16);
  c.writeUInt32LE(data.length,20);c.writeUInt32LE(raw.length,24);
  c.writeUInt16LE(name.length,28);c.writeUInt32LE(offset,42);
  central.push(c,name);
  offset+=local.length+name.length+data.length;
 }
 const cb=Buffer.concat(central),end=Buffer.alloc(22);
 end.writeUInt32LE(0x06054b50);end.writeUInt16LE(entries.length,8);
 end.writeUInt16LE(entries.length,10);end.writeUInt32LE(cb.length,12);end.writeUInt32LE(offset,16);
 return Buffer.concat([...parts,cb,end]).toString('base64');
}
const temp=mkdtempSync(join(tmpdir(),'jenios-b283-cert-'));
let cert,key;
try{
 execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-keyout',join(temp,'private.pem'),
  '-out',join(temp,'cert.pem'),'-days','3','-nodes','-subj','/CN=qa.test.invalid'],
  {stdio:'ignore'});
 cert=readFileSync(join(temp,'cert.pem'),'utf8');key=readFileSync(join(temp,'private.pem'),'utf8');
}finally{rmSync(temp,{recursive:true,force:true});}
const zip=testZip([{name:'inter/certificate.crt',body:cert,method:8},
 {name:'inter/private.key',body:key,method:8}]);
const material=()=>({action:'save',clientId:'b283-fake-client-id',
 clientSecret:'b283-fake-client-secret',pixKey:'qa-pix-key-value',zipBase64:zip,
 accountNumber:''});
test('B282 exactly three sale products and advanced only in two higher plans',()=>{
 assert.deepEqual(SALES_PLANS.map(p=>p.priceCents),[9990,14990,19990]);
 assert.equal(isAdvancedTier('platform-nacional'),false);
 assert.equal(isAdvancedTier('platform-global-crypto'),true);
 assert.equal(isAdvancedTier('platform-internacional-pro'),true);
 assert.equal(isAdvancedTier('other'),false);
 assert.equal(commercialPlan('Qual plano custa R$149,90?').code,'platform-global-crypto');
 assert.equal(commercialPlan('Internacional Pro').code,'platform-internacional-pro');
 const fallback=salesReplyGuided('Como contratar?','genia');
 assert.equal(fallback.links[0].href,'/checkout');
 assert.equal(fallback.name,'Gênia');
});
test('B282 free endpoint serves visitors and never produces orders or direct charges',async()=>{
 const r=await freePost(req({persona:'genia',message:'Como contratar um plano?'}));
 assert.equal(r.status,200);
 const body=await r.json();
 assert.equal(body.ok,true);assert.equal(body.paidAi,false);
 assert.equal(body.executionEnabled,false);
 assert.equal(body.subscriptionGranted,false);
 assert.equal(body.monitoringEnabled,false);
 assert.equal(body.name,'Gênia');
 const caps=await(await freeGet()).json();
 assert.equal(caps.generativeSalesPossible,true);
 assert.deepEqual(caps.personas,['genio','genia']);
});
test('B282 if unavailable, provider is not called and guided sales remain available',async()=>{
 let n=0;
 const r=await replySales('Me apresente os planos','genio',
  {env:{},fetcher:async()=>{n++;throw Error('no external provider');}});
 assert.equal(r.mode,'guided');assert.equal(r.modelCalls,0);assert.equal(n,0);
 assert.equal(r.free,true);assert.equal(r.paidAi,false);
});
test('B282 per-visitor budget reservation is checked BEFORE external generative reply',async()=>{
 let fetchCount=0,reserveCount=0;
 const response=Response.json({status:'completed',output:[{type:'message',content:[
  {type:'output_text',text:JSON.stringify({answer:'O plano Global Crypto custa R$ 149,90 mensais, consulte no checkout.',planCode:'platform-global-crypto'})}
 ]}]});
 const result=await replySales('Quero conhecer R$ 149,90','genio',
  {request:req({persona:'genio',message:'Quero conhecer'}),env:salesEnv,
   db:{},budgetReserve:async()=>{reserveCount++;return true;},
   fetcher:async(url,options)=>{
    fetchCount++;assert.equal(url,'https://api.openai.com/v1/responses');
    const body=JSON.parse(options.body);assert.equal(body.store,false);
    assert.equal(body.tools,undefined);return response;
   }});
 assert.equal(reserveCount,1);assert.equal(fetchCount,1);
 assert.equal(result.mode,'ai');assert.equal(result.paidAi,false);
 assert.equal(result.planCode,'platform-global-crypto');
 assert.equal(result.subscriptionGranted,false);assert.equal(result.executionEnabled,false);
});
test('B282 failed quotas suppress provider calls, and limits cannot be bypassed by a second login',async()=>{
 let fetchCount=0;
 const r=await replySales('Me apresente os planos','genia',
  {request:req({persona:'genia',message:'Oi'}),env:salesEnv,db:{},
   budgetReserve:async()=>false,
   fetcher:async()=>{fetchCount++;throw Error('should not run');}});
 assert.equal(fetchCount,0);assert.equal(r.mode,'guided');
 const request=req({persona:'genia',message:'teste'});
 const a=anonymousVisitorDigest(request,salesEnv);
 assert.match(a,/^[a-f0-9]{64}$/);
 assert.notEqual(a,anonymousVisitorDigest(request,{...salesEnv,JENIOS_SALES_VISITOR_SALT:'other-secret-xxxxxxxxxxxxxxxxxxxxxxxxx'}));
});
test('B282 budget RPC rejects unavailable DB or unauthorized generative flags',async()=>{
 assert.equal(await reserveSalesAiBudget(null,'a'.repeat(64),salesEnv),false);
 assert.equal(await reserveSalesAiBudget({},'a'.repeat(64),{...salesEnv,JENIOS_SALES_GENERATIVE_ENABLED:'false'}),false);
 const db={rpc:async(name,args)=>{
  assert.equal(name,'jenios_sales_budget_hold_b282');
  assert.equal(args.p_amount_micro_usd,20000);
  return {data:true,error:null};
 }};
 assert.equal(await reserveSalesAiBudget(db,'b'.repeat(64),salesEnv,
 Date.parse('2026-10-21T17:15:00Z')),true);
});
test('B283 encrypted ZIP extracts matching cert/key without file writes',()=>{
 const data=zipMaterial(zip);const verified=validateMaterial(data.certificate,data.privateKey);
 assert.equal(data.certificate,cert);assert.equal(data.privateKey,key);
 assert.ok(Number.isFinite(Date.parse(verified.expires_at)));
 const normalized=validateJeniosInterSetup(material());
 assert.equal(normalized.clientId,'b283-fake-client-id');
 assert.equal(normalized.privateKey,key);
 assert.match(normalized.fingerprintSha256,/^[a-f0-9]{64}$/);
});
test('B283 ZIP rejects missing certificate, traversal, encrypted or unsafe files',()=>{
 for(const invalid of [
  testZip([{name:'private.key',body:key}]),
  testZip([{name:'../private.key',body:key},{name:'certificate.crt',body:cert}]),
  testZip([{name:'private.key',body:key,flags:1},{name:'certificate.crt',body:cert}]),
  testZip([{name:'evil.exe',body:key},{name:'certificate.crt',body:cert}]),
  testZip([{name:'private.key',body:key},{name:'private2.key',body:key},{name:'certificate.crt',body:cert}])
 ])assert.throws(()=>zipMaterial(invalid),/INTER_/);
 assert.throws(()=>validateJeniosInterSetup({...material(),clientSecret:'short'}),/INTER_INPUT_INVALID/);
});
test('B283 Master configuration uses secure service_role RPC and NEVER echoes original keys',async()=>{
 const s={configured:true,clientIdLast4:'t-id',pixKeyLast4:'alue',bankAuthenticated:false,
   chargesEnabled:false,configurationVersion:1};
 const calls=[];
 const db={rpc:async(name,args)=>{calls.push({name,args});return {data:
  name==='jenios_inter_store_b283'?s:s,error:null};}};
 const saved=await saveJeniosInter(db,validateJeniosInterSetup(material()));
 assert.equal(saved.configured,true);
 assert.deepEqual(calls.map(x=>x.name),['jenios_inter_store_b283']);
 assert.ok(!JSON.stringify(saved).includes(key));
 assert.ok(!JSON.stringify(saved).includes('b283-fake-client-secret'));
 const read=await statusJeniosInter(db);assert.equal(read.configured,true);
});
test('B283 bank test does only READ for nonexistent charge, never creates payment',async()=>{
 const config={purpose:'jenios_pix_configuration_only',client_id:'b283-fake-client-id',
  client_secret:'b283-fake-client-secret',certificate:cert,private_key:key,
  pix_key:'b283-pix-key-value',account_number:''};
 const calls=[],db={rpc:async(name,params)=>{
  calls.push({name,params});return {data:name==='jenios_inter_load_b283'?config:
   {bankAuthenticated:true,chargesEnabled:false},error:null};
 }};
 const runtime=await loadJeniosInterServerEnv(db,{JENIOS_PAY_PROVIDER:'inter_pix'});
 assert.equal(runtime.INTER_CLIENT_ID,config.client_id);
 const status=await testJeniosInterAuth(db,{makeClient:()=>({
  read:async txid=>{calls.push({name:'GET_CHARGE',txid});throw Object.assign(Error('Not found'),{bankStatus:404});},
  create:async()=>assert.fail('No real bank charge')
 })});
 assert.equal(status.bankAuthenticated,true);assert.equal(status.chargesEnabled,false);
 assert.deepEqual(calls.map(x=>x.name),['jenios_inter_load_b283','jenios_inter_load_b283',
  'GET_CHARGE','jenios_inter_mark_auth_b283']);
});
test('B284 LP and Platform reuse Social sales room, and legacy fixed Pix is absent',()=>{
 const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
 assert.match(read('app/social/layout.js'),/<SocialFreeLauncher\/>/);
 assert.match(read('app/lp/layout.js'),/<SocialFreeLauncher\/>/);
 assert.match(read('app/platform/assistente/page.js'),/<FreeAssistantRoom\/>/);
 assert.match(read('app/components/assistant/AssistantEntry.js'),/<FreeAssistantRoom/);
 assert.match(read('app/planos/page.js'),/redirect\('\/checkout'\)/);
 assert.doesNotMatch(read('app/planos/page.js'),/000201010211|LETTER LETTER/);
});
test('B284 Pro API routes require higher plans and new credit sales are gone',()=>{
 const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
 const service=read('lib/assistant/pro-service.mjs');
 assert.match(service,/ADVANCED_PLAN_REQUIRED/);
 for(const endpoint of ['chat','quote','access'])
  assert.match(read('app/api/assistant/pro/'+endpoint+'/route.js'),/planOnly:true/);
 for(const endpoint of ['quote','checkout','status'])
  assert.match(read('app/api/assistant/pro/credits/'+endpoint+'/route.js'),/AI_CREDITS_SALES_DISABLED/);
 assert.doesNotMatch(read('app/genios-pro/page.js'),/<ProCredits/);
});
test('B283 Inter credentials are only read via protected private Admin endpoint',()=>{
 const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
 const api=read('app/api/admin/inter/setup/route.js'),sql=read('supabase/migrations/20261021170000_jenios_b282_b283_sales_inter_vault.sql');
 assert.match(api,/requireAdminPermission\(request,db,'finance.manage'\)/);
 assert.match(api,/confirmBankConnection===true/);
 assert.match(sql,/supabase_vault|vault\.create_secret/);
 assert.match(sql,/revoke all on function public\.jenios_inter_load_b283\(\) from PUBLIC,anon,authenticated/);
 assert.match(sql,/grant execute on function public\.jenios_inter_load_b283\(\) to service_role/);
 assert.match(sql,/jenios_sales_budget_hold_b282/);
});
