/** G48: actual setup services/HTTP bodies with disposable certificates and local
 * database/HTTPS fixtures. No account, bank, credential or network is used.
 * Route dependency injection follows R37; Next.js validates import wiring.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {deflateRawSync} from 'node:zlib';
import {crc32} from '../lib/pay/inter-material.mjs';
import {createInterPixClient} from '../lib/pay/inter-pix.mjs';
import {validateJeniosInterSetup,statusJeniosInter,saveJeniosInter,connectJeniosInter,testJeniosInterAuth} from '../lib/pay/inter-vault.mjs';
import {requirePayToken} from '../lib/pay/auth.mjs';
import {requireAdminPermission,auditAdmin} from '../lib/admin-access.mjs';
import {assistantSameOrigin} from '../lib/platform/connections/request-origin.mjs';

function zip(entries){
 let offset=0;const parts=[],central=[];
 for(const entry of entries){
  const name=Buffer.from(entry.name),raw=Buffer.from(entry.body),compressed=deflateRawSync(raw),local=Buffer.alloc(30),record=Buffer.alloc(46);
  local.writeUInt32LE(0x04034b50);local.writeUInt16LE(20,4);local.writeUInt16LE(8,8);
  local.writeUInt32LE(crc32(raw),14);local.writeUInt32LE(compressed.length,18);local.writeUInt32LE(raw.length,22);local.writeUInt16LE(name.length,26);
  record.writeUInt32LE(0x02014b50);record.writeUInt16LE(0x0314,4);record.writeUInt16LE(20,6);record.writeUInt16LE(8,10);
  record.writeUInt32LE(crc32(raw),16);record.writeUInt32LE(compressed.length,20);record.writeUInt32LE(raw.length,24);record.writeUInt16LE(name.length,28);record.writeUInt32LE(offset,42);
  parts.push(local,name,compressed);central.push(record,name);offset+=local.length+name.length+compressed.length;
 }
 const directory=Buffer.concat(central),end=Buffer.alloc(22);
 end.writeUInt32LE(0x06054b50);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);
 return Buffer.concat([...parts,directory,end]).toString('base64');
}
const temporary=mkdtempSync(join(tmpdir(),'jenios-inter-r40-local-'));
const pairs=[];
try{
 for(let i=0;i<2;i++){
  const certPath=join(temporary,'certificate-'+i+'.pem'),keyPath=join(temporary,'key-'+i+'.pem');
  execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-keyout',keyPath,'-out',certPath,'-days','2','-nodes','-subj','/CN=inter-r40-'+i+'.test.invalid'],{stdio:'ignore'});
  pairs.push({certificate:readFileSync(certPath,'utf8'),privateKey:readFileSync(keyPath,'utf8')});
 }
}finally{rmSync(temporary,{recursive:true,force:true});}
const archive=pair=>zip([{name:'inter/certificate.crt',body:pair.certificate},{name:'inter/private.key',body:pair.privateKey}]);
let sequence=0;
function input(overrides={},pair=pairs[1]){
 return {action:'connect',confirmBankConnection:true,clientId:'r40-local-client-'+(++sequence),clientSecret:'r40-synthetic-client-secret-only',
  pixKey:'r40-synthetic-pix-key',accountNumber:'r40-local-account',zipBase64:archive(pair),...overrides};
}
const env=Object.freeze({JENIOS_PAY_PROVIDER:'inter_pix',JENIOS_PAY_PAYMENTS_ENABLED:'false',JENIOS_INTER_CHARGES_ENABLED:'false'});
const blank=()=>({configured:false,bankAuthenticated:false,chargesEnabled:false});
const metadata=(material,version=4,authenticated=false)=>({configured:true,bankAuthenticated:authenticated,chargesEnabled:true,
 configurationVersion:version,fingerprintSha256:material.fingerprintSha256,clientIdLast4:material.clientId.slice(-4),pixKeyLast4:material.pixKey.slice(-4),
 certificateExpiresAt:material.certificateExpiresAt,updatedAt:new Date().toISOString()});
const bundle=material=>({purpose:'jenios_pix_configuration_only',schema_version:'g48',client_id:material.clientId,client_secret:material.clientSecret,
 certificate:material.certificate,private_key:material.privateKey,pix_key:material.pixKey,account_number:material.accountNumber});
const count=(f,name)=>f.calls.filter(call=>call.name===name).length;
const safeResult=(result,f)=>{
 const body=JSON.stringify(result);
 for(const secret of [f.candidate.clientSecret,f.candidate.certificate,f.candidate.privateKey,f.previous.certificate,f.previous.privateKey])
  assert.equal(body.includes(JSON.stringify(secret).slice(1,-1)),false,'Private configuration must not be returned');
 assert.equal(result.chargesEnabled,false);
};
const statusError=(code,status)=>error=>error?.code===code&&error?.status===status;
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function until(condition){for(let i=0;i<100;i++){if(condition())return;await tick();}assert.fail('Expected local operation was not reached');}

function fixture({configured=true}={}){
 const previous=validateJeniosInterSetup(input({},pairs[0])),candidate=validateJeniosInterSetup(input());
 const f={previous,candidate,state:configured?metadata(previous):blank(),vault:bundle(previous),
  calls:[],events:[],network:[],runtimeEnvs:[],audits:[],dbReads:0,authReads:0,attempt:true,
  user:{id:'b1400040-0000-4000-8000-000000000099',app_metadata:{role:'master'},user_metadata:{}}};
 f.db={
  auth:{async getUser(token){f.authReads++;return token==='r40-local-token'?{data:{user:f.user},error:null}:{data:null,error:{message:'invalid fixture token'}};}},
  from(table){assert.equal(table,'jenios_admin_audit');return {async insert(row){f.audits.push(structuredClone(row));return {error:null};}};},
  async rpc(name,args){
   f.calls.push({name,args});f.events.push(name);
   if(name==='jenios_inter_claim_setup_attempt_r40')return {data:f.attempt,error:f.attemptError||null};
   if(name==='jenios_inter_status_b283'){
    if(f.statusThrow)throw f.statusThrow;
    return {data:Object.hasOwn(f,'statusReply')?f.statusReply:structuredClone(f.state),error:f.statusError||null};
   }
   if(name==='jenios_inter_load_b283')return {data:structuredClone(f.vault),error:null};
   if(name==='jenios_inter_store_verified_r40'){
    if(f.beforeStore)await f.beforeStore();
    if(args.p_expected_version!==(f.state.configured?f.state.configurationVersion:0))return {data:null,error:{code:'40001',message:'private fixture CAS failure'}};
    if(f.storeError)return {data:null,error:f.storeError};
    f.state={...metadata(f.candidate,args.p_expected_version+1,true),...(f.extra||{})};
    return {data:f.storeReply?f.storeReply(structuredClone(f.state)):structuredClone(f.state),error:null};
   }
   if(name==='jenios_inter_mark_auth_r40'){
    if(f.beforeMark)await f.beforeMark();
    if(args.p_expected_version!==f.state.configurationVersion||args.p_cert_fingerprint!==f.state.fingerprintSha256)
     return {data:null,error:{code:'40001',message:'private fixture CAS failure'}};
    if(f.markError)return {data:null,error:f.markError};
    f.state={...f.state,bankAuthenticated:true};
    return {data:f.markReply?f.markReply(structuredClone(f.state)):structuredClone(f.state),error:null};
   }
   if(name==='jenios_inter_store_b283'){
    f.state=metadata(f.candidate,(f.state.configurationVersion||0)+1,false);
    return {data:{...f.state,...(f.extra||{})},error:null};
   }
   assert.fail('Unexpected RPC '+name);
  }
 };
 f.makeClient=({env:runtime})=>{
  f.runtimeEnvs.push(runtime);
  return createInterPixClient({env:runtime,request:async call=>{
   f.network.push({path:call.path,method:call.method});f.events.push(call.method+' '+call.path);
   if(call.path==='/oauth/v2/token'){
    assert.equal(call.method,'POST');assert.equal(new URLSearchParams(call.body).get('scope'),'cob.read cob.write');
    if(f.oauthError)throw f.oauthError;
    return {access_token:'r40-synthetic-oauth-token-only',expires_in:60};
   }
   assert.equal(call.path,'/pix/v2/cob/'+'0'.repeat(32));assert.equal(call.method,'GET');
   assert.equal(call.token,'r40-synthetic-oauth-token-only');
   if(f.onRead)await f.onRead();
   if(f.readSuccess)return {};
   throw f.readError||Object.assign(Error('synthetic nonexistent Pix'),{bankStatus:404});
  }});
 };
 f.options={makeClient:f.makeClient,env};
 return f;
}

test('G48 connect requires explicit boolean consent and rejects caller-controlled private fields',()=>{
 const valid=input();assert.ok(validateJeniosInterSetup(valid).fingerprintSha256);
 for(const value of [undefined,false,'true',1])assert.throws(()=>validateJeniosInterSetup({...valid,confirmBankConnection:value}),statusError('INTER_INPUT_INVALID',400));
 for(const extra of [{p_expected_version:4},{chargesEnabled:true},{tenant_id:'other'},{action:'test'}])
  assert.throws(()=>validateJeniosInterSetup({...valid,...extra}),statusError('INTER_INPUT_INVALID',400));
 assert.throws(()=>validateJeniosInterSetup([]),statusError('INTER_INPUT_INVALID',400));
 const legacy={...valid,action:'save'};delete legacy.confirmBankConnection;assert.ok(validateJeniosInterSetup(legacy).certificate);
});

test('G48 connect validates the original ZIP and matching certificate before private storage',()=>{
 const valid=input();
 for(const [zipBase64,code] of [
  ['not-base64','INTER_ZIP_INVALID'],
  [zip([{name:'../private.key',body:pairs[1].privateKey},{name:'certificate.crt',body:pairs[1].certificate}]),'INTER_ZIP_UNSAFE'],
  [zip([{name:'certificate.crt',body:pairs[1].certificate}]),'INTER_CERTIFICATE_AND_KEY_REQUIRED'],
  [zip([{name:'certificate.crt',body:pairs[1].certificate},{name:'private.key',body:pairs[0].privateKey}]),'INTER_KEY_MISMATCH']
 ])assert.throws(()=>validateJeniosInterSetup({...valid,zipBase64}),statusError(code,400));
});

test('G48 status projects only public metadata and never inherits charge flags or unknown RPC secrets',async()=>{
 const f=fixture();Object.assign(f.state,{bankAuthenticated:true,clientIdLast4:'entire-client-id-ABCD',pixKeyLast4:'private-pix-WXYZ',
  clientSecret:f.candidate.clientSecret,private_key:f.candidate.privateKey,certificate:f.candidate.certificate,nested:{secret:'private'},paymentsEnabled:true});
 const result=await statusJeniosInter(f.db);safeResult(result,f);
 assert.equal(result.clientIdLast4,'ABCD');assert.equal(result.pixKeyLast4,'WXYZ');
 assert.deepEqual(Object.keys(result).sort(),['bankAuthenticated','certificateExpiresAt','chargesEnabled','clientIdLast4','configurationVersion','configured','fingerprintSha256','pixKeyLast4','status','updatedAt'].sort());
});

test('G48 malformed public status fails closed instead of inventing a configured connection',async()=>{
 for(const reply of [null,[],{}, {configured:'true',bankAuthenticated:true},{configured:true,bankAuthenticated:'true'}]){
  const f=fixture();f.statusReply=reply;
  await assert.rejects(statusJeniosInter(f.db),statusError('INTER_VAULT_RESPONSE_INVALID',503));
 }
 const f=fixture({configured:false});f.state.bankAuthenticated=true;f.state.private_key=f.candidate.privateKey;
 assert.deepEqual(await statusJeniosInter(f.db),{configured:false,bankAuthenticated:false,chargesEnabled:false,configurationVersion:0,status:'not_configured'});
});

test('G48 connect waits for OAuth and Pix GET before one version-bound atomic save',async()=>{
 const f=fixture(),wait=deferred(),before=structuredClone(f.state);f.onRead=()=>wait.promise;
 const pending=connectJeniosInter(f.db,f.candidate,f.options);
 await until(()=>f.network.length===2);
 assert.deepEqual(f.state,before);assert.equal(count(f,'jenios_inter_store_verified_r40'),0);
 wait.resolve();const result=await pending;
 assert.deepEqual(f.events,['jenios_inter_claim_setup_attempt_r40','jenios_inter_status_b283','POST /oauth/v2/token','GET /pix/v2/cob/'+'0'.repeat(32),'jenios_inter_store_verified_r40']);
 const saved=f.calls.find(x=>x.name==='jenios_inter_store_verified_r40').args;
 assert.equal(saved.p_expected_version,4);assert.equal(saved.p_cert_fingerprint,f.candidate.fingerprintSha256);
 assert.equal(saved.p_client_id,f.candidate.clientId);assert.equal(saved.p_private_key,f.candidate.privateKey);
 assert.equal(result.configurationVersion,5);assert.equal(result.bankAuthenticated,true);assert.equal(result.authenticationTestOnly,true);
 assert.equal(count(f,'jenios_inter_load_b283'),0);assert.equal(count(f,'jenios_inter_store_b283'),0);assert.equal(count(f,'jenios_inter_mark_auth_r40'),0);
 assert.equal(f.runtimeEnvs[0].INTER_CLIENT_ID,f.candidate.clientId);assert.equal(f.runtimeEnvs[0].INTER_PIX_KEY,f.candidate.pixKey);
 assert.equal(env.JENIOS_INTER_CHARGES_ENABLED,'false');assert.equal(env.JENIOS_PAY_PAYMENTS_ENABLED,'false');safeResult(result,f);
});

test('G48 first connection starts at version zero and a successful GET also stays read-only',async()=>{
 const f=fixture({configured:false});f.readSuccess=true;
 const result=await connectJeniosInter(f.db,f.candidate,f.options);
 assert.equal(f.calls.find(x=>x.name==='jenios_inter_store_verified_r40').args.p_expected_version,0);
 assert.equal(result.configurationVersion,1);assert.equal(result.chargesEnabled,false);
 assert.deepEqual(f.network.map(x=>x.method),['POST','GET']);
});

for(const operation of ['connect','test']){
 test('G48 '+operation+' rejects an OAuth 404 before any Pix lookup or write',async()=>{
  const f=fixture(),before=structuredClone(f.state);f.oauthError=Object.assign(Error('synthetic OAuth not found'),{bankStatus:404});
  const run=operation==='connect'?connectJeniosInter(f.db,f.candidate,f.options):testJeniosInterAuth(f.db,f.options);
  await assert.rejects(run,statusError('INTER_BANK_READONLY_CONNECTION_FAILED',502));
  assert.deepEqual(f.network,[{path:'/oauth/v2/token',method:'POST'}]);assert.deepEqual(f.state,before);
  assert.equal(count(f,'jenios_inter_store_verified_r40'),0);assert.equal(count(f,'jenios_inter_mark_auth_r40'),0);
 });
}

test('G48 failed Pix authentication or transport preserves the previous saved configuration',async()=>{
 for(const bankStatus of [401,403,500,undefined]){
  const f=fixture(),before=structuredClone(f.state);f.readError=Object.assign(Error(f.candidate.clientSecret),{bankStatus});
  await assert.rejects(connectJeniosInter(f.db,f.candidate,f.options),statusError('INTER_BANK_READONLY_CONNECTION_FAILED',502));
  assert.deepEqual(f.state,before);assert.equal(count(f,'jenios_inter_store_verified_r40'),0);
 }
 const f=fixture();
 await assert.rejects(connectJeniosInter(f.db,f.candidate,{...f.options,makeClient:()=>({read:async()=>{throw Object.assign(Error('unclassified 404'),{bankStatus:404});}})}),statusError('INTER_BANK_READONLY_CONNECTION_FAILED',502));
 assert.equal(count(f,'jenios_inter_store_verified_r40'),0);
});

test('G48 concurrent configuration replacement rejects connect without overwriting the newer version',async()=>{
 const f=fixture();let concurrent;
 f.beforeStore=()=>{f.state=metadata(f.previous,5,true);concurrent=structuredClone(f.state);};
 await assert.rejects(connectJeniosInter(f.db,f.candidate,f.options),statusError('INTER_CONFIGURATION_CHANGED',409));
 assert.deepEqual(f.state,concurrent);assert.equal(count(f,'jenios_inter_store_verified_r40'),1);
});

test('G48 connect rejects inconsistent save confirmation and strips unknown successful RPC fields',async()=>{
 for(const patch of [{bankAuthenticated:false},{configurationVersion:99},{fingerprintSha256:'f'.repeat(64)}]){
  const f=fixture();f.storeReply=data=>({...data,...patch});
  await assert.rejects(connectJeniosInter(f.db,f.candidate,f.options),statusError('INTER_VAULT_SAVE_NOT_CONFIRMED',503));
 }
 const f=fixture();f.extra={clientSecret:f.candidate.clientSecret,private_key:f.candidate.privateKey,chargesEnabled:true};
 const result=await connectJeniosInter(f.db,f.candidate,f.options);safeResult(result,f);assert.equal(Object.hasOwn(result,'private_key'),false);
});

test('G48 setup throttling and unavailable guard stop before status, private load or bank',async()=>{
 for(const operation of ['connect','test'])for(const scenario of ['denied','malformed','error']){
  const f=fixture();f.attempt=scenario==='denied'?false:scenario==='malformed'?'true':true;
  if(scenario==='error')f.attemptError={message:f.candidate.clientSecret};
  const run=operation==='connect'?connectJeniosInter(f.db,f.candidate,f.options):testJeniosInterAuth(f.db,f.options);
  await assert.rejects(run,statusError(scenario==='denied'?'INTER_SETUP_RATE_LIMITED':'INTER_SETUP_GUARD_UNAVAILABLE',scenario==='denied'?429:503));
  assert.deepEqual(f.calls.map(x=>x.name),['jenios_inter_claim_setup_attempt_r40']);assert.equal(f.runtimeEnvs.length,0);assert.equal(f.network.length,0);
 }
});

test('G48 configured snapshots need a positive version and valid fingerprint before bank operations',async()=>{
 for(const operation of ['connect','test'])for(const patch of [{configurationVersion:0},{configurationVersion:'4'},{fingerprintSha256:'invalid'},{fingerprintSha256:undefined}]){
  const f=fixture();Object.assign(f.state,patch);
  const run=operation==='connect'?connectJeniosInter(f.db,f.candidate,f.options):testJeniosInterAuth(f.db,f.options);
  await assert.rejects(run,statusError('INTER_VAULT_RESPONSE_INVALID',503));assert.equal(count(f,'jenios_inter_load_b283'),0);assert.equal(f.network.length,0);
 }
});

test('G48 saved connection test reads Vault and marks only the same version and fingerprint',async()=>{
 const f=fixture(),before=structuredClone(env);const result=await testJeniosInterAuth(f.db,f.options);
 assert.deepEqual(f.events,['jenios_inter_claim_setup_attempt_r40','jenios_inter_status_b283','jenios_inter_load_b283','POST /oauth/v2/token','GET /pix/v2/cob/'+'0'.repeat(32),'jenios_inter_mark_auth_r40']);
 assert.deepEqual(f.calls.find(x=>x.name==='jenios_inter_mark_auth_r40').args,{p_expected_version:4,p_cert_fingerprint:f.previous.fingerprintSha256});
 assert.equal(result.configurationVersion,4);assert.equal(result.authenticationTestOnly,true);assert.equal(result.bankAuthenticated,true);
 assert.equal(f.runtimeEnvs[0].INTER_CLIENT_ID,f.previous.clientId);assert.deepEqual(env,before);safeResult(result,f);
});

test('G48 saved test rejects a different Vault certificate before making a bank call',async()=>{
 const f=fixture();f.vault=bundle(f.candidate);
 await assert.rejects(testJeniosInterAuth(f.db,f.options),statusError('INTER_CONFIGURATION_CHANGED',409));
 assert.equal(count(f,'jenios_inter_load_b283'),1);assert.equal(f.network.length,0);assert.equal(count(f,'jenios_inter_mark_auth_r40'),0);
});

test('G48 saved test needs a configuration and valid private certificate without disclosing errors',async()=>{
 const empty=fixture({configured:false});await assert.rejects(testJeniosInterAuth(empty.db,empty.options),statusError('INTER_CONFIGURATION_REQUIRED',400));
 assert.equal(count(empty,'jenios_inter_load_b283'),0);assert.equal(empty.network.length,0);
 const f=fixture();f.vault.private_key='synthetic invalid private material';
 await assert.rejects(testJeniosInterAuth(f.db,f.options),statusError('INTER_SECURE_CERTIFICATE_INVALID',503));
 assert.equal(f.network.length,0);assert.equal(count(f,'jenios_inter_mark_auth_r40'),0);
});

test('G48 saved test CAS conflict and mismatched acknowledgment cannot confirm another configuration',async()=>{
 const conflict=fixture();let concurrent;
 conflict.beforeMark=()=>{conflict.state=metadata(conflict.candidate,5,false);concurrent=structuredClone(conflict.state);};
 await assert.rejects(testJeniosInterAuth(conflict.db,conflict.options),statusError('INTER_CONFIGURATION_CHANGED',409));assert.deepEqual(conflict.state,concurrent);
 for(const patch of [{bankAuthenticated:false},{configurationVersion:5},{fingerprintSha256:'f'.repeat(64)}]){
  const f=fixture();f.markReply=data=>({...data,...patch});
  await assert.rejects(testJeniosInterAuth(f.db,f.options),statusError('INTER_BANK_TEST_NOT_RECORDED',503));
 }
});

test('G48 legacy save remains configuration-only and returns the same safe projection',async()=>{
 const f=fixture();f.extra={private_key:f.candidate.privateKey,chargesEnabled:true};
 const result=await saveJeniosInter(f.db,f.candidate);
 assert.equal(result.configured,true);assert.equal(result.bankAuthenticated,false);safeResult(result,f);
 assert.deepEqual(f.calls.map(x=>x.name),['jenios_inter_store_b283']);assert.equal(f.network.length,0);
});

function route(f){
 const source=readFileSync(new URL('../app/api/admin/inter/setup/route.js',import.meta.url),'utf8')
  .replace(/^import\b[\s\S]*?;\r?\n/gm,'').replace(/\bexport\s+(?=const|async function)/g,'');
 const deps={Response,requirePayToken,requireAdminPermission,auditAdmin,assistantSameOrigin,
  getJeniosPayAdmin(){f.dbReads++;return f.db;},statusJeniosInter,validateJeniosInterSetup,
  connectJeniosInter:(db,material)=>connectJeniosInter(db,material,f.options),
  testJeniosInterAuth:db=>testJeniosInterAuth(db,f.options)};
 return new Function(...Object.keys(deps),source+'\nreturn {GET,POST};')(...Object.values(deps));
}
function request(body,{method='POST',headers={}}={}){
 return new Request('https://qa.invalid/api/admin/inter/setup',{method,headers:{origin:'https://qa.invalid',authorization:'Bearer r40-local-token','content-type':'application/json',...headers},...(method==='POST'?{body:typeof body==='string'?body:JSON.stringify(body)}:{})});
}

test('G48 HTTP connect authorizes Master, uses the real validator/service and audits metadata only',async()=>{
 const f=fixture(),body=input();f.candidate=validateJeniosInterSetup(body);
 const response=await route(f).POST(request(body)),result=await response.json();
 assert.equal(response.status,200);assert.equal(result.ok,true);assert.equal(result.configuration.bankAuthenticated,true);safeResult(result.configuration,f);
 assert.equal(response.headers.get('cache-control'),'private, no-store');
 assert.deepEqual(f.audits,[{actor_id:f.user.id,action:'inter.configuration_connected',target:{configVersion:5,readOnlyTest:true}}]);
 assert.equal(count(f,'jenios_inter_store_verified_r40'),1);assert.deepEqual(f.network.map(x=>x.method),['POST','GET']);
});

test('G48 HTTP rejects missing identity, non-Master roles and foreign origin before private operations',async()=>{
 const missing=fixture();let response=await route(missing).POST(request(input(),{headers:{authorization:''}}));
 assert.equal(response.status,401);assert.equal(missing.dbReads,0);assert.equal(missing.calls.length,0);
 for(const role of ['admin','finance_admin','user']){
  const f=fixture();f.user.app_metadata={role};f.user.user_metadata={role:'master',permissions:['finance.manage']};
  response=await route(f).POST(request(input()));assert.equal(response.status,403);assert.equal(f.calls.length,0);assert.equal(f.network.length,0);assert.equal(f.audits.length,0);
 }
 const foreign=fixture();response=await route(foreign).POST(request(input(),{headers:{origin:'https://foreign.invalid','sec-fetch-site':'cross-site'}}));
 assert.equal(response.status,403);assert.equal(foreign.dbReads,0);assert.equal(foreign.calls.length,0);
});

test('G48 HTTP refuses missing consent, unknown keys and unsafe ZIP before setup claims',async()=>{
 for(const body of [input({confirmBankConnection:false}),input({confirmBankConnection:'true'}),input({p_expected_version:9}),input({zipBase64:'not-a-zip'}),
  {action:'test',confirmBankConnection:false},{action:'test',confirmBankConnection:'true'},{action:'test',confirmBankConnection:true,clientSecret:'r40-caller-must-not-select-saved-secrets'},
  {...input({action:'save'}),confirmBankConnection:undefined}]){
  const f=fixture(),response=await route(f).POST(request(body));assert.equal(response.status,400);
  assert.equal(f.calls.length,0);assert.equal(f.network.length,0);assert.equal(f.audits.length,0);
 }
});

test('G48 HTTP test reuses saved material and throttling returns a human error with Retry-After',async()=>{
 const f=fixture();const response=await route(f).POST(request({action:'test',confirmBankConnection:true})),body=await response.json();
 assert.equal(response.status,200);assert.equal(body.configuration.configurationVersion,4);assert.equal(count(f,'jenios_inter_load_b283'),1);safeResult(body.configuration,f);
 assert.equal(f.audits[0].action,'inter.read_only_connection_test');
 const denied=fixture();denied.attempt=false;
 const limited=await route(denied).POST(request(input())),result=await limited.json();
 assert.equal(limited.status,429);assert.equal(limited.headers.get('retry-after'),'60');assert.match(result.error,/Aguarde um minuto/);
 assert.equal(denied.network.length,0);assert.equal(count(denied,'jenios_inter_load_b283'),0);
});

test('G48 HTTP GET returns safe stored status and unexpected RPC errors do not leak secrets',async()=>{
 const f=fixture();f.state.private_key=f.previous.privateKey;
 const response=await route(f).GET(request(null,{method:'GET'})),body=await response.json();
 assert.equal(response.status,200);safeResult(body.configuration,f);assert.equal(f.network.length,0);
 const failed=fixture();failed.statusThrow=Object.assign(Error(failed.previous.clientSecret),{code:'UNEXPECTED_PRIVATE_RPC_DETAIL',status:503});
 const result=await route(failed).GET(request(null,{method:'GET'})),errorBody=await result.json();
 assert.equal(result.status,503);assert.equal(errorBody.code,'INTER_SETUP_UNAVAILABLE');
 assert.equal(JSON.stringify(errorBody).includes(failed.previous.clientSecret),false);assert.equal(JSON.stringify(errorBody).includes('UNEXPECTED_PRIVATE_RPC_DETAIL'),false);
});
