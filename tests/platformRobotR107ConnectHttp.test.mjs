import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {request as httpRequest} from 'node:http';
import {alpacaConnectHttpR107,R107_ORIGIN,R107_CALLBACK,requireR107HttpConfiguration} from '../lib/platform/connections/alpaca-connect-http-r107.mjs';
import {createR107ConnectServer} from '../lib/platform/connections/alpaca-connect-node-r107.mjs';
import {checkS05DeploymentScope} from '../lib/release/environment-scope.mjs';
const USER='4d238a7a-8c7b-4d8e-9a10-1c5c82db59a7',OTHER='0d8caf6a-4d0a-4f79-b4d5-fd3087ea834c';
const SESSION='1d238a7a-8c7b-4d8e-9a10-1c5c82db59a7',ORIGIN='https://jenios.com.br';
const CONSENT='CONNECT_MY_ALPACA_LIVE_ACCOUNT_WITHOUT_CUSTODY',OAUTH='synthetic-alpaca-oauth-1234567890';
function jwt(claims={}){return ['eyJhbGciOiJIUzI1NiJ9',Buffer.from(JSON.stringify({sub:USER,session_id:SESSION,exp:1793100000,...claims})).toString('base64url'),'synthetic_signature_for_fixture_only'].join('.');}
function fixture(t){
 const dir=mkdtempSync(join(process.cwd(),'.jenios-r107-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 let now=1793091600000,user=USER,active=true,row=null,token=jwt(),authError=false,listError=false,rpcError=false;
 const calls=[],selections=[],env={
  JENIOS_R107_CONNECT_HTTP_ENABLED:'true',JENIOS_R107_PUBLIC_ORIGIN:R107_ORIGIN,
  JENIOS_R107_BROWSER_SESSION_KEY_B64:Buffer.alloc(32,13).toString('base64'),
  JENIOS_R106_ALPACA_CONNECT_ENABLED:'true',JENIOS_R106_PRIVATE_VOLUME:dir,
  JENIOS_R106_ALPACA_CLIENT_ID:'synthetic-app-client-id-123',JENIOS_R106_ALPACA_CLIENT_SECRET:'synthetic-app-client-secret-123',
  JENIOS_R106_ALPACA_REDIRECT_URI:R107_ORIGIN+R107_CALLBACK,
  JENIOS_R100_INERT_WORKER_ENABLED:'false',JENIOS_R104_PRIVATE_OPERATOR_ENABLED:'false',
  JENIOS_R103_PRIVATE_PAPER_CANCEL_ENABLED:'false',JENIOS_R80_PRIVATE_ISSUER_ENABLED:'false',
  JENIOS_PRIVATE_PAPER_EXECUTOR:'false',JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED:'false',
  JENIOS_PAY_PAYMENTS_ENABLED:'false',JENIOS_INTER_CHARGES_ENABLED:'false',
  JENIOS_R83_PRIVATE_NODE_WORKER:'true',JENIOS_R83_LIVE_VAULT_ENABLED:'true',
  JENIOS_R83_ALPACA_THIRD_PARTY_APP_APPROVED:'true',JENIOS_R82_PRIVATE_NODE_WORKER:'true',
  JENIOS_R82_ALPACA_LIVE_READ_ENABLED:'true',JENIOS_REAL_EXECUTION_ENABLED:'false',
  JENIOS_R82_ALPACA_LIVE_ORDER_EXECUTION_ENABLED:'false',JENIOS_R83_LIVE_VAULT_KEY_ID:'k1',
  JENIOS_R83_LIVE_VAULT_KEY_B64:Buffer.alloc(32,11).toString('base64'),
  JENIOS_R82_LIVE_ACCOUNT_DIGEST_KEY_B64:Buffer.alloc(32,12).toString('base64')};
 const db={auth:{getUser:async value=>{assert.equal(value,token);return {data:{user:{id:user,email_confirmed_at:'2026-10-01',is_anonymous:false}},error:authError};}},
  from(name){assert.equal(name,'jenios_robot_live_connections_r83');let matches=true;
   return {insert(value){row={...value,revision:1};return this;},select(value){selections.push(value);return this;},
    eq(key,value){matches=matches&&row?.[key]===value;return this;},order(){return this;},
    async single(){return {data:row,error:null};},async maybeSingle(){return {data:matches?row:null,error:null};},
    async range(first,last){assert.equal(last-first,20);return {data:matches&&row&&first===0?[row]:[],error:listError};}};
  },
  async rpc(name,p){
   if(name==='jenios_r107_session_is_active')return {data:active&&p.p_owner_user_id===user&&p.p_session_id===SESSION,error:rpcError};
   if(!row||p.p_connection_id!==row.id||p.p_owner_user_id!==row.owner_user_id)return {data:false,error:null};
   if(name==='jenios_r83_mark_live_read_verified'){
    row={...row,status:'READ_VERIFIED',identity_verified:true,external_digest:p.p_external_digest,
     source:'JENIOS_PRIVATE_LIVE_VAULT_VERIFIED',last_sync_at:new Date(now).toISOString(),revision:row.revision+1};
    return {data:true,error:null};
   }
   if(name==='jenios_r83_revoke_live_connection'){
    row={...row,status:'REVOKED',identity_verified:false,credential_box:null,external_digest:null,last_sync_at:null,revision:row.revision+1};return {data:true,error:null};
   }throw Error('UNEXPECTED_RPC');
  }};
 const fetcher=async(url,options)=>{
  assert.equal(options.redirect,'error');calls.push({url,method:options.method});
  if(url==='https://api.alpaca.markets/oauth/token'){
   assert.equal(options.method,'POST');return Response.json({access_token:OAUTH,token_type:'Bearer',scope:'trading'});
  }
  assert.equal(options.method,'GET');assert.equal(options.headers.Authorization,'Bearer '+OAUTH);
  if(url==='https://api.alpaca.markets/v2/account')return Response.json({id:'customer-broker-account',status:'ACTIVE',trading_blocked:false});
  if(url==='https://api.alpaca.markets/v2/clock')return Response.json({timestamp:new Date(now).toISOString(),is_open:true});
  throw Error('UNEXPECTED_NETWORK');
 };
 const deps={env,db,fetcher,clock:()=>now};
 const call=(path,options={})=>alpacaConnectHttpR107(new Request(R107_ORIGIN+path,options),deps);
 const start=(extra={})=>call('/connect/alpaca/start',{method:'POST',headers:{origin:ORIGIN,'content-type':'application/x-www-form-urlencoded',...extra.headers},body:new URLSearchParams({accessToken:token,consent:CONSENT,...extra.body}).toString()});
 const api=(path,body={},extra={})=>call(path,{method:'POST',headers:{origin:ORIGIN,'content-type':'application/json',authorization:'Bearer '+token,...extra},body:JSON.stringify(body)});
 const callback=(start,extra={})=>{
  const state=new URL(start.headers.get('location')).searchParams.get('state');
  return call(R107_CALLBACK+'?'+new URLSearchParams({state,code:'synthetic-auth-code',...extra.query}),{
   headers:{cookie:start.headers.getSetCookie().map(v=>v.split(';')[0]).join('; '),...extra.headers}});
 };
 return {dir,env,deps,calls,selections,call,start,api,callback,get row(){return row;},set row(v){row=v;},
  get token(){return token;},set token(v){token=v;},set user(v){user=v;},set active(v){active=v;},
  set authError(v){authError=v;},set rpcError(v){rpcError=v;},set listError(v){listError=v;},advance(ms){now+=ms;}};
}
test('R107 HTTP consent, encrypted browser session, official callback, metadata and local disconnect',async t=>{
 const f=fixture(t),start=await f.start();assert.equal(start.status,303);
 assert.equal(new URL(start.headers.get('location')).origin,'https://app.alpaca.markets');
 const cookies=start.headers.getSetCookie();assert.equal(cookies.length,2);
 for(const value of cookies){assert.match(value,/^__Host-/);assert.match(value,/HttpOnly; Secure; SameSite=Lax/);assert.ok(value.length<4096);assert.equal(value.includes(f.token),false);}
 const returned=await f.callback(start);assert.equal(returned.status,303);assert.match(returned.headers.get('location'),/connectResult=returned$/);
 assert.equal(returned.headers.getSetCookie().every(v=>v.includes('Max-Age=0')),true);
 assert.equal(f.row.status,'READ_VERIFIED');assert.ok(f.row.credential_box);assert.equal(JSON.stringify(f.row).includes(OAUTH),false);
 const response=await f.api('/connections'),data=await response.json();assert.equal(response.status,200);
 assert.equal(data.connections[0].accountReadConfirmed,true);assert.equal(data.ordersEnabled,false);
 assert.equal(response.headers.get('access-control-allow-origin'),ORIGIN);assert.equal(response.headers.get('access-control-allow-credentials'),null);
 assert.equal(response.headers.get('cache-control'),'no-store, max-age=0');
 for(const secret of [f.token,OAUTH,f.env.JENIOS_R106_ALPACA_CLIENT_SECRET,'credential_box','external_digest','owner_user_id'])assert.equal(JSON.stringify(data).includes(secret),false);
 assert.equal(f.selections.at(-1).includes('credential_box'),false);
 const revoked=await f.api('/disconnect',{connectionId:f.row.id,confirmation:'REVOKE_LOCAL_ALPACA_CONNECTION'});
 assert.equal(revoked.status,200);const receipt=await revoked.json();assert.equal(receipt.localCredentialsDestroyed,true);assert.equal(receipt.providerRevocationRequired,true);
 assert.equal(receipt.ordersCancelled,false);assert.equal(f.row.credential_box,null);
 assert.deepEqual(f.calls.map(c=>c.method),['POST','GET','GET']);
 assert.equal(readFileSync(join(f.dir,'alpaca-connect-r106.sqlite')).includes(Buffer.from(f.token)),false);
 // Reconnection is a new owner-approved OAuth flow, never a restore of a revoked box.
 const previous=f.row.id;assert.equal((await f.callback(await f.start())).status,303);assert.notEqual(f.row.id,previous);assert.equal(f.row.status,'READ_VERIFIED');
});
test('R107 repeated and concurrent callback never re-exchanges a consumed code',async t=>{
 const f=fixture(t),start=await f.start();const results=await Promise.all([f.callback(start),f.callback(start)]);
 assert.equal(results.filter(r=>r.headers.get('location').endsWith('=returned')).length,1);
 assert.equal(f.calls.filter(c=>c.method==='POST').length,1);
 assert.match((await f.callback(start)).headers.get('location'),/=unconfirmed$/);assert.equal(f.calls.length,3);
});
test('R107 logged-out or expired session blocks start, list, disconnect and OAuth callback',async t=>{
 const f=fixture(t),start=await f.start();f.active=false;
 for(const response of [await f.start(),await f.api('/connections'),await f.api('/disconnect',{})])assert.equal(response.status,401);
 assert.match((await f.callback(start)).headers.get('location'),/=unconfirmed$/);assert.equal(f.calls.length,0);
 f.active=true;f.token=jwt({exp:1793091599});assert.equal((await f.start()).status,401);
});
test('R107 Auth verification, active-session RPC and verified JWT subject all fail closed',async t=>{
 for(const change of [f=>{f.authError=true;},f=>{f.rpcError=true;},f=>{f.token=jwt({sub:OTHER});},f=>{f.token=jwt({session_id:OTHER});},f=>{f.token='synthetic-non-jwt-token-12345';}]){
  const f=fixture(t);change(f);assert.equal((await f.start()).status,401);assert.equal(f.calls.length,0);
 }
});
test('R107 CSRF origins and preflights use exact allowlist without credentialed CORS',async t=>{
 const f=fixture(t);
 for(const origin of ['null','https://evil.example','https://jenios.com.br.evil.example','http://jenios.com.br']){
  assert.equal((await f.start({headers:{origin}})).status,403);
  const response=await f.api('/connections',{}, {origin});assert.equal(response.status,403);assert.equal(response.headers.get('access-control-allow-origin'),null);
 }
 const allowed=await f.call('/connections',{method:'OPTIONS',headers:{origin:ORIGIN,'access-control-request-method':'POST','access-control-request-headers':'authorization, content-type'}});
 assert.equal(allowed.status,204);assert.equal(allowed.headers.get('access-control-allow-credentials'),null);
 const denied=await f.call('/connections',{method:'OPTIONS',headers:{origin:ORIGIN,'access-control-request-method':'DELETE'}});assert.equal(denied.status,403);
});
test('R107 tampered, missing, duplicate and expired cookies do not contact Alpaca',async t=>{
 for(const kind of ['missing','tampered','duplicate','binding','expired','backward']){
  const f=fixture(t),start=await f.start(),cookies=start.headers.getSetCookie().map(v=>v.split(';')[0]);let value=cookies.join('; ');
  if(kind==='missing')value='';if(kind==='tampered')value=value.replace('session=','session=A');
  if(kind==='duplicate')value+='; '+cookies[0];if(kind==='binding')value=value.replace(/connect=[^;]+/,'connect='+'A'.repeat(43));
  if(kind==='expired')f.advance(600000);if(kind==='backward')f.advance(-1);
  assert.match((await f.callback(start,{headers:{cookie:value}})).headers.get('location'),/=unconfirmed$/,kind);assert.equal(f.calls.length,0);
 }
});
test('R107 caller cannot select another owner, redirect target or overpost secrets',async t=>{
 const f=fixture(t);assert.equal((await f.start({body:{returnTo:'https://evil.example'}})).status,400);
 await f.callback(await f.start());const id=f.row.id;f.user=OTHER;f.token=jwt({sub:OTHER});
 assert.deepEqual((await (await f.api('/connections')).json()).connections,[]);
 assert.equal((await f.api('/disconnect',{connectionId:id,confirmation:'REVOKE_LOCAL_ALPACA_CONNECTION'})).status,503);assert.ok(f.row.credential_box);
 assert.equal((await f.api('/connections',{owner_user_id:USER})).status,400);
});
test('R107 duplicate callback parameters, denial and malformed bodies have fixed safe results',async t=>{
 const f=fixture(t),start=await f.start(),cookie=start.headers.getSetCookie().map(v=>v.split(';')[0]).join('; '),state=new URL(start.headers.get('location')).searchParams.get('state');
 const malformed=await f.call(R107_CALLBACK+'?state='+state+'&state='+state+'&code=secret',{headers:{cookie}});
 assert.match(malformed.headers.get('location'),/=unconfirmed$/);assert.equal(f.calls.length,0);
 const denied=await f.call(R107_CALLBACK+'?'+new URLSearchParams({state,error:'access_denied'}),{headers:{cookie}});
 assert.match(denied.headers.get('location'),/=denied$/);assert.equal(f.calls.length,0);
 assert.equal((await f.call('/connect/alpaca/start',{method:'POST',headers:{origin:ORIGIN,'content-type':'text/plain'},body:'x'})).status,415);
 assert.equal((await f.call('/connect/alpaca/start',{method:'POST',headers:{origin:ORIGIN,'content-type':'application/x-www-form-urlencoded'},body:'a='.repeat(3100)})).status,413);
 assert.equal((await f.api('/orders',{})).status,404);
});
test('R107 deployment gates reject missing vendor approval, shared keys, real execution and public runtime',t=>{
 for(const [key,value] of [['JENIOS_R83_ALPACA_THIRD_PARTY_APP_APPROVED','false'],['JENIOS_REAL_EXECUTION_ENABLED','true'],['JENIOS_R107_CONNECT_HTTP_ENABLED','false'],['VERCEL','1'],['JENIOS_R103_PRIVATE_PAPER_CANCEL_ENABLED','true'],['JENIOS_R107_BROWSER_SESSION_KEY_B64',Buffer.alloc(32,11).toString('base64')]]){
  const f=fixture(t);f.env[key]=value;assert.throws(()=>requireR107HttpConfiguration(f.env));
 }
 const result=checkS05DeploymentScope({VERCEL_ENV:'production',JENIOS_R107_CONNECT_HTTP_ENABLED:'true'});assert.equal(result.ok,false);
});
test('R107 Node socket preserves both cookies, checks Host and provides no order route',async t=>{
 const f=fixture(t),server=createR107ConnectServer(f.deps);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 const send=(path,{method='GET',headers={},body=''}={})=>new Promise((resolve,reject)=>{
  const request=httpRequest({host:'127.0.0.1',port:server.address().port,path,method,headers:{host:'connect.jenios.com.br',...headers}},res=>{
   let text='';res.on('data',chunk=>{text+=chunk;});res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,text}));});request.on('error',reject);request.end(body);
 });
 const health=await send('/healthz',{headers:{host:'render-health.invalid'}});assert.equal(health.status,200);assert.equal(JSON.parse(health.text).ordersEnabled,false);
 const started=await send('/connect/alpaca/start',{method:'POST',headers:{origin:ORIGIN,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({accessToken:f.token,consent:CONSENT}).toString()});
 assert.equal(started.status,303);assert.equal(started.headers['set-cookie'].length,2);
 assert.equal((await send('/connections',{headers:{host:'evil.example'}})).status,400);
 assert.equal((await send('/orders',{method:'POST',body:'{}'})).status,404);assert.equal(f.calls.length,0);
});
test('R107 incomplete encryption configuration cannot report healthy or consume OAuth codes',async t=>{
 for(const key of ['JENIOS_R83_LIVE_VAULT_KEY_B64','JENIOS_R82_LIVE_ACCOUNT_DIGEST_KEY_B64',
  'JENIOS_R107_BROWSER_SESSION_KEY_B64','JENIOS_R83_LIVE_VAULT_KEY_ID']){
  const f=fixture(t),start=await f.start();delete f.env[key];
  assert.throws(()=>createR107ConnectServer(f.deps),{code:'R107_CRYPTO_CONFIGURATION_REQUIRED'});
  assert.equal((await f.call('/healthz')).status,503);
  await f.callback(start);assert.equal(f.calls.length,0);assert.equal(f.row,null);
 }
});
test('R107 rejects malformed, noncanonical and reused encryption keys before startup',t=>{
 for(const change of [
  f=>{f.env.JENIOS_R83_LIVE_VAULT_KEY_B64='invalid';},
  f=>{f.env.JENIOS_R82_LIVE_ACCOUNT_DIGEST_KEY_B64=Buffer.alloc(31,12).toString('base64');},
  f=>{f.env.JENIOS_R107_BROWSER_SESSION_KEY_B64='A'.repeat(42)+'B=';},
  f=>{f.env.JENIOS_R82_LIVE_ACCOUNT_DIGEST_KEY_B64=f.env.JENIOS_R83_LIVE_VAULT_KEY_B64;},
  f=>{f.env.JENIOS_DEMO_VAULT_KEY_B64=f.env.JENIOS_R83_LIVE_VAULT_KEY_B64;},
  f=>{f.env.JENIOS_R83_LIVE_VAULT_KEY_ID='INVALID KEY ID';}
 ]){
  const f=fixture(t);change(f);
  assert.throws(()=>createR107ConnectServer(f.deps),{code:'R107_CRYPTO_CONFIGURATION_REQUIRED'});
  assert.equal(f.calls.length,0);
 }
});
