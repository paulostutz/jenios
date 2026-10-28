import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync,chmodSync,symlinkSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {startR106AlpacaConnect,finishR106AlpacaConnect} from '../lib/platform/connections/alpaca-connect-oauth-r106.mjs';
import {R106OAuthState} from '../lib/platform/connections/alpaca-connect-state-r106.mjs';
import {checkS05DeploymentScope} from '../lib/release/environment-scope.mjs';
const owner='4d238a7a-8c7b-4d8e-9a10-1c5c82db59a7',other='0d8caf6a-4d0a-4f79-b4d5-fd3087ea834c';
const session='synthetic-platform-session-token-12345',oauth='synthetic-alpaca-oauth-access-token-12345';
const consent='CONNECT_MY_ALPACA_LIVE_ACCOUNT_WITHOUT_CUSTODY';
const startRequest={accessToken:session,consent};
const hash=s=>createHash('sha256').update(s).digest('hex');
function fixture(t,options={}){
 const dir=mkdtempSync(join(process.cwd(),'.jenios-r106-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 let now=1793091600000,user=owner,row=null,confirmed=true;
 const calls=[];
 const env={JENIOS_R106_ALPACA_CONNECT_ENABLED:'true',JENIOS_R106_PRIVATE_VOLUME:dir,
  JENIOS_R106_ALPACA_CLIENT_ID:'synthetic-app-client-id-123',JENIOS_R106_ALPACA_CLIENT_SECRET:'synthetic-app-client-secret-123',
  JENIOS_R106_ALPACA_REDIRECT_URI:'https://jenios.com.br/platform/integracoes/alpaca/retorno',
  JENIOS_R100_INERT_WORKER_ENABLED:'false',JENIOS_R104_PRIVATE_OPERATOR_ENABLED:'false',
  JENIOS_PRIVATE_PAPER_EXECUTOR:'false',JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED:'false',
  JENIOS_PAY_PAYMENTS_ENABLED:'false',JENIOS_INTER_CHARGES_ENABLED:'false',
  JENIOS_R83_PRIVATE_NODE_WORKER:'true',JENIOS_R83_LIVE_VAULT_ENABLED:'true',
  JENIOS_R83_ALPACA_THIRD_PARTY_APP_APPROVED:'true',JENIOS_R82_PRIVATE_NODE_WORKER:'true',
  JENIOS_R82_ALPACA_LIVE_READ_ENABLED:'true',JENIOS_REAL_EXECUTION_ENABLED:'false',
  JENIOS_R82_ALPACA_LIVE_ORDER_EXECUTION_ENABLED:'false',JENIOS_R83_LIVE_VAULT_KEY_ID:'k1',
  JENIOS_R83_LIVE_VAULT_KEY_B64:Buffer.alloc(32,11).toString('base64'),
  JENIOS_R82_LIVE_ACCOUNT_DIGEST_KEY_B64:Buffer.alloc(32,12).toString('base64')};
 const db={auth:{getUser:async()=>({data:{user:{id:user,is_anonymous:false,email_confirmed_at:confirmed?'2026-10-01':null}},error:null})},
  from(name){assert.equal(name,'jenios_robot_live_connections_r83');let matches=true;
   return {insert(data){row={...data,revision:1};return {select(){return this;},async single(){return {data:{id:row.id,owner_user_id:row.owner_user_id,status:'STAGED',revision:1},error:null};}};},
    select(){return this;},eq(field,value){matches=matches&&row?.[field]===value;return this;},
    async maybeSingle(){return {data:matches?row:null,error:null};}};
  },
  async rpc(name,p){
   if(!row||row.id!==p.p_connection_id||row.owner_user_id!==p.p_owner_user_id)return {data:false,error:null};
   if(name==='jenios_r83_mark_live_read_verified'){
    if(options.failMark)return {data:false,error:null};
    assert.equal(row.status,'STAGED');assert.equal(row.revision,p.p_expected_revision);
    row.status='READ_VERIFIED';row.identity_verified=true;row.external_digest=p.p_external_digest;
    row.source='JENIOS_PRIVATE_LIVE_VAULT_VERIFIED';row.last_sync_at=new Date(now).toISOString();row.revision++;return {data:true,error:null};
   }
   if(name==='jenios_r83_revoke_live_connection'){row.status='REVOKED';row.credential_box=null;row.identity_verified=false;row.external_digest=null;row.revision++;return {data:true,error:null};}
   throw Error('UNEXPECTED_RPC');
  }};
 const fetcher=async(url,init)=>{
  calls.push({url,method:init.method});
  assert.equal(init.redirect,'error');assert.equal(new URL(url).origin,'https://api.alpaca.markets');
  if(url==='https://api.alpaca.markets/oauth/token'){
   assert.equal(init.method,'POST');const body=new URLSearchParams(init.body);
   assert.equal(body.get('client_secret'),env.JENIOS_R106_ALPACA_CLIENT_SECRET);
   assert.equal(body.get('redirect_uri'),env.JENIOS_R106_ALPACA_REDIRECT_URI);
   // Persisted consume precedes the irreversible token exchange.
   const sqlite=new DatabaseSync(join(dir,'alpaca-connect-r106.sqlite'));
   assert.equal(sqlite.prepare("SELECT status FROM oauth_states ORDER BY created_at DESC LIMIT 1").get().status,'CLAIMED');sqlite.close();
   if(options.tokenResponse)return options.tokenResponse();
   return Response.json({access_token:oauth,token_type:'Bearer',scope:'trading'});
  }
  assert.equal(init.method,'GET');assert.equal(init.headers.Authorization,'Bearer '+oauth);
  if(url.endsWith('/v2/account'))return Response.json({id:'synthetic-customer-account',status:'ACTIVE',trading_blocked:false});
  if(url.endsWith('/v2/clock'))return Response.json({timestamp:new Date(now).toISOString(),is_open:true});
  throw Error('UNEXPECTED_NETWORK_PATH');
 };
 const deps={db,env,clock:()=>now,fetcher};
 return {dir,env,deps,calls,get row(){return row;},set user(v){user=v;},set confirmed(v){confirmed=v;},advance(ms){now+=ms;},
  start:(request=startRequest)=>startR106AlpacaConnect(request,deps),
  callback(start){return {accessToken:session,state:new URL(start.authorizationUrl).searchParams.get('state'),browserBinding:start.callbackCookie.value,code:'synthetic-authorization-code'};}};
}
test('R106 official per-user OAuth seals token, verifies GETs, consumes state and never places orders',async t=>{
 const f=fixture(t),start=await f.start(),url=new URL(start.authorizationUrl);
 assert.equal(url.origin,'https://app.alpaca.markets');assert.equal(url.pathname,'/oauth/authorize');
 assert.equal(url.searchParams.get('scope'),'trading');assert.equal(url.searchParams.get('env'),'live');
 assert.equal(start.callbackCookie.httpOnly,true);assert.equal(start.callbackCookie.secure,true);
 assert.equal(start.callbackCookie.sameSite,'Lax');assert.equal(start.callbackCookie.name.startsWith('__Host-'),true);
 assert.notEqual(url.searchParams.get('state'),start.callbackCookie.value);
 const request=f.callback(start),result=await finishR106AlpacaConnect(request,f.deps);
 assert.equal(result.accountReadConfirmed,true);assert.equal(result.ordersEnabled,false);assert.equal(result.ordersSent,0);
 assert.equal(result.requiresSeparateRiskApproval,true);assert.equal(result.grantedScope,'trading');
 assert.equal(result.custody,false);assert.equal(result.withdrawals,false);assert.equal(result.clearCookie,true);
 assert.equal(f.row.status,'READ_VERIFIED');assert.ok(f.row.credential_box);
 for(const value of [oauth,request.code,request.state,request.browserBinding,session,f.env.JENIOS_R106_ALPACA_CLIENT_SECRET]){
  assert.equal(JSON.stringify(f.row).includes(value),false);assert.equal(JSON.stringify(result).includes(value),false);
  assert.equal(readFileSync(join(f.dir,'alpaca-connect-r106.sqlite')).includes(Buffer.from(value)),false);
 }
 assert.deepEqual(f.calls.map(x=>x.method),['POST','GET','GET']);
 await assert.rejects(finishR106AlpacaConnect(request,f.deps),/R106_STATE_INVALID_OR_CONSUMED/);
 assert.equal(f.calls.length,3);
});
test('R106 owner/browser/config substitution cannot consume the original authorization',async t=>{
 const f=fixture(t),request=f.callback(await f.start());
 f.user=other;await assert.rejects(finishR106AlpacaConnect(request,f.deps),/R106_STATE_INVALID_OR_CONSUMED/);f.user=owner;
 await assert.rejects(finishR106AlpacaConnect({...request,browserBinding:'A'.repeat(43)},f.deps),/R106_STATE_INVALID_OR_CONSUMED/);
 const id=f.env.JENIOS_R106_ALPACA_CLIENT_ID;f.env.JENIOS_R106_ALPACA_CLIENT_ID='synthetic-different-app-id';
 await assert.rejects(finishR106AlpacaConnect(request,f.deps),/R106_STATE_INVALID_OR_CONSUMED/);f.env.JENIOS_R106_ALPACA_CLIENT_ID=id;
 assert.equal(f.calls.length,0);assert.equal((await finishR106AlpacaConnect(request,f.deps)).connected,true);
});
test('R106 state expires at ten minutes and rejects backward clock',async t=>{
 for(const delta of [600000,-1]){
  const f=fixture(t),request=f.callback(await f.start());f.advance(delta);
  await assert.rejects(finishR106AlpacaConnect(request,f.deps),/R106_STATE_INVALID_OR_CONSUMED/);assert.equal(f.calls.length,0);
 }
});
test('R106 concurrent callbacks exchange exactly once',async t=>{
 const f=fixture(t),request=f.callback(await f.start());
 const outcomes=await Promise.allSettled([finishR106AlpacaConnect(request,f.deps),finishR106AlpacaConnect(request,f.deps)]);
 assert.equal(outcomes.filter(x=>x.status==='fulfilled').length,1);
 assert.equal(f.calls.filter(x=>x.method==='POST').length,1);
});
test('R106 denial consumes authorization without contacting provider',async t=>{
 const f=fixture(t),{code,...request}=f.callback(await f.start());
 const result=await finishR106AlpacaConnect({...request,error:'access_denied'},f.deps);
 assert.equal(result.denied,true);assert.equal(result.connected,false);assert.equal(f.calls.length,0);
 await assert.rejects(finishR106AlpacaConnect({...request,code},f.deps),/R106_STATE_INVALID_OR_CONSUMED/);
});
for(const [name,tokenResponse] of [
 ['network ambiguity',()=>{throw Error('DO_NOT_LEAK_'+oauth);}],
 ['rejection',()=>new Response('DO_NOT_LEAK_'+oauth,{status:401})],
 ['oversize',()=>new Response('x'.repeat(16385))],
 ['malformed',()=>new Response('{bad')],
 ['missing scope',()=>Response.json({access_token:oauth,token_type:'Bearer'})],
 ['excess scopes',()=>Response.json({access_token:oauth,token_type:'Bearer',scope:'trading account:write'})],
 ['wrong type',()=>Response.json({access_token:oauth,token_type:'Basic',scope:'trading'})],
 ['redirect',()=>({ok:true,redirected:true})]
])test('R106 '+name+' fails closed and cannot be retried',async t=>{
 const f=fixture(t,{tokenResponse}),request=f.callback(await f.start());
 await assert.rejects(finishR106AlpacaConnect(request,f.deps),error=>{assert.match(error.message,/^R106_/);assert.ok(!error.message.includes(oauth));return true;});
 assert.equal(f.row,null);assert.equal(f.calls.length,1);
 await assert.rejects(finishR106AlpacaConnect(request,f.deps),/R106_STATE_INVALID_OR_CONSUMED/);assert.equal(f.calls.length,1);
});
test('R106 failed account verification destroys the locally staged credential',async t=>{
 const f=fixture(t,{failMark:true}),request=f.callback(await f.start());
 await assert.rejects(finishR106AlpacaConnect(request,f.deps),/R106_CONNECT_UNCONFIRMED/);
 assert.equal(f.row.status,'REVOKED');assert.equal(f.row.credential_box,null);
});
test('R106 callback claim survives process exit and restart',async t=>{
 const f=fixture(t),request=f.callback(await f.start());
 const db=new DatabaseSync(join(f.dir,'alpaca-connect-r106.sqlite'));
 const row=db.prepare('SELECT * FROM oauth_states').get();db.close();
 const code=`import {R106OAuthState} from './lib/platform/connections/alpaca-connect-state-r106.mjs';
 const j=new R106OAuthState(process.env.TEST_VOLUME);j.claim(JSON.parse(process.env.TEST_CLAIM));process.exit(0);`;
 const child=spawnSync(process.execPath,['--input-type=module','-e',code],{cwd:process.cwd(),encoding:'utf8',env:{PATH:process.env.PATH,TEST_VOLUME:f.dir,
  TEST_CLAIM:JSON.stringify({stateHash:hash(request.state),owner,browserHash:hash(request.browserBinding),configHash:row.config_hash,now:row.created_at})}});
 assert.equal(child.status,0,child.stderr);
 await assert.rejects(finishR106AlpacaConnect(request,f.deps),/R106_STATE_INVALID_OR_CONSUMED/);assert.equal(f.calls.length,0);
});
test('R106 rejects wrong host, app configuration, ambient execution or missing customer consent before requests',async t=>{
 const f=fixture(t);
 for(const patch of [{VERCEL:'1'},{VERCEL_ENV:'preview'},{NEXT_RUNTIME:'nodejs'},{AWS_LAMBDA_FUNCTION_NAME:'worker'},
  {JENIOS_REAL_EXECUTION_ENABLED:'true'},{JENIOS_R100_INERT_WORKER_ENABLED:'true'},
  {JENIOS_R83_ALPACA_THIRD_PARTY_APP_APPROVED:'false'},{JENIOS_R106_ALPACA_CLIENT_SECRET:''},
  ...['http://jenios.com.br/platform/integracoes/alpaca/retorno','https://evil.invalid/callback',
   'https://jenios.com.br/platform/integracoes/alpaca/retorno?next=https://evil.invalid','https://jenios.com.br/other'].map(JENIOS_R106_ALPACA_REDIRECT_URI=>({JENIOS_R106_ALPACA_REDIRECT_URI}))]){
  await assert.rejects(startR106AlpacaConnect(startRequest,{...f.deps,env:{...f.env,...patch}}));
 }
 for(const request of [{...startRequest,consent:'yes'},{...startRequest,redirectUri:'https://evil.invalid'}, {...startRequest,accessToken:''}])await assert.rejects(f.start(request));
 f.confirmed=false;await assert.rejects(f.start(),/R106_PLATFORM_AUTH_REQUIRED/);
 assert.equal(f.calls.length,0);assert.equal(f.row,null);
 for(const env of [{VERCEL_ENV:'preview'},{VERCEL_ENV:'production'},{VERCEL:'1'},{NEXT_RUNTIME:'nodejs'}])
  assert.deepEqual(checkS05DeploymentScope({...env,JENIOS_R106_ALPACA_CONNECT_ENABLED:'true'}),{ok:false,reason:'R106_ALPACA_CONNECT_FORBIDDEN_ON_WEB'});
});
test('R106 journal refuses unsafe files and bounds repeated authorizations',async t=>{
 const f=fixture(t);await f.start();const path=join(f.dir,'alpaca-connect-r106.sqlite');
 chmodSync(path,0o644);assert.throws(()=>new R106OAuthState(f.dir),/R106_STATE_STORAGE_UNSAFE/);chmodSync(path,0o600);
 const otherFixture=fixture(t);symlinkSync(path,join(otherFixture.dir,'alpaca-connect-r106.sqlite'));
 assert.throws(()=>new R106OAuthState(otherFixture.dir),/R106_STATE_STORAGE_UNSAFE/);
 for(let i=1;i<100;i++)await f.start();await assert.rejects(f.start(),/R106_CONNECT_RATE_LIMIT/);
 assert.equal(f.calls.length,0);
});
