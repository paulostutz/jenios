/**
 * HP04 — acceptance against the dedicated Supabase and local Next.js build.
 * Only run within explicitly authorised protected QA environment.
 * All users are invented under reserved example.com, confirmed without mail,
 * deleted in finally; no real payments, broker credentials or trades.
 */
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';

const PROJECT_REF='xaicvhagftzjkqphnbgx';
const EXPECTED_URL='https://'+PROJECT_REF+'.supabase.co';
const url=process.env.PLATFORM_SUPABASE_URL;
const serviceKey=process.env.PLATFORM_SUPABASE_SERVICE_ROLE_KEY;
const publicKey=process.env.PLATFORM_QA_PUBLISHABLE_KEY;
const base=process.env.PLATFORM_QA_NEXT_URL||'http://127.0.0.1:3129';
const checks=[];
const users=[];
const sessions=new Map();
const resultDir='.jenios-hp04-qa';
const originalFetch=globalThis.fetch;
globalThis.fetch=(input,options={})=>{
 const target=new URL(typeof input==='string'?input:input.url||String(input));
 assert.ok(target.origin===EXPECTED_URL||target.origin===base,'QA request outside dedicated scope');
 return originalFetch(input,{...options,signal:options.signal||AbortSignal.timeout(15000)});
};
function report(status,extra={}){
 mkdirSync(resultDir,{recursive:true});
 writeFileSync(resultDir+'/AUTHENTICATED_RESULT.json',JSON.stringify({
  schema:'JENIOS_HP04_AUTHENTICATED_QA_V1',status,
  applicationCommit:process.env.GITHUB_SHA||null,
  certifiedBase:'cdbedfccd65ade53ae0ffb46effd8a32ed7e4658',
  dedicatedProject:PROJECT_REF,checks,checkCount:checks.length,
  originalRuntimeIntegrationVerified:false,browserJourneyVerified:false,
  realOrdersSent:0,externalPaperOrdersSent:0,productionTouched:false,
  actualBrokerPnl:null,actualLossesAvoided:null,realTradeAccuracy:null,...extra
 },null,2)+'\n',{mode:0o600});
}
let admin=null;
function check(condition,name){
 assert.ok(condition,name);
 checks.push(name);
 process.stdout.write('PASS '+name+'\n');
}
function config(){
 assert.equal(process.env.GITHUB_ACTIONS,'true','Protected CI execution required');
 assert.equal(process.env.GITHUB_JOB,'authenticated-qa','Protected authenticated job required');
 assert.equal(process.env.HP04_PROTECTED_ENVIRONMENT,'jenios-platform-auth-qa','Dedicated protected environment required');
 assert.equal(url,EXPECTED_URL,'QA must use dedicated Platform project only');
 assert.ok(serviceKey&&serviceKey.length>20,'Protected server credential is absent');
 assert.ok(publicKey&&publicKey.length>15,'Publishable QA key is absent');
 const u=new URL(base);
 assert.ok(u.protocol==='http:'&&['localhost','127.0.0.1'].includes(u.hostname)
  &&u.port==='3129','HTTP QA target must be local-only, port 3129');
}
function makeUserClient(){
 return createClient(EXPECTED_URL,publicKey,
  {auth:{autoRefreshToken:false,persistSession:false,detectSessionInUrl:false}});
}
function makePassword(){return 'B9z!'+randomBytes(18).toString('base64url')+'aA0!';}
async function api(path,token,method='GET',body){
 const result=await fetch(base+path,{
  method,cache:'no-store',
  headers:{...(token?{authorization:'Bearer '+token}:{}),
    ...(body?{'content-type':'application/json'}:{})},
  ...(body?{body:JSON.stringify(body)}:{})
 });
 const parsed=await result.json().catch(()=>({}));
 return {status:result.status,body:parsed};
}
async function createUser(marker,metadata){
 const email='platform-hp04-'+marker+'-'+randomUUID().replaceAll('-','').slice(0,16)+'@example.com';
 const password=makePassword();
 const {data,error}=await admin.auth.admin.createUser({
  email,password,email_confirm:true,
  app_metadata:metadata,
  user_metadata:{display_name:'Usuário fictício de homologação'}
 });
 if(error||!data?.user?.id)throw Error('QA user creation unsuccessful');
 const id=data.user.id;
 users.push(id);
 if(metadata && Object.keys(metadata).length){
  const updated=await admin.auth.admin.updateUserById(id,{app_metadata:metadata});
  if(updated.error)throw Error('QA role setup unsuccessful');
 }
 const client=makeUserClient();
 const result=await client.auth.signInWithPassword({email,password});
 if(result.error||!result.data?.session?.access_token)throw Error('QA sign-in unsuccessful');
 const account={client,id,token:result.data.session.access_token,
  refreshToken:result.data.session.refresh_token};
 sessions.set(id,account);
 return account;
}
async function countRows(table){
 const {count,error}=await admin.from(table).select('user_id',{head:true,count:'exact'});
 if(error||!Number.isSafeInteger(count))throw Error('QA count unavailable');
 return count;
}
async function run(){
 config();
 admin=createClient(EXPECTED_URL,serviceKey,
  {auth:{autoRefreshToken:false,persistSession:false,detectSessionInUrl:false}});
 const initial={
  diagnostics:await countRows('jenios_platform_diagnostics'),
  permissions:await countRows('jenios_platform_admin_permissions'),
  risk:await countRows('jenios_platform_risk_events')
 };
 let executionError=null;
 try{
  const a=await createUser('admin',{platform_role:'admin'});
  const b=await createUser('regular',{role:'admin'});
  check(a.id!==b.id,'QA users are distinct and belong to dedicated Supabase');
  const [none1,none2,none3]=await Promise.all([
   api('/api/platform/diagnostico'),
   api('/api/platform/admin/access'),
   api('/api/platform/admin/overview')
  ]);
  check([none1.status,none2.status,none3.status].every(s=>s===401),
   'All protected endpoints reject missing authorization');
  const invalidToken=await api('/api/platform/diagnostico','invalid-hp04-token');
  check(invalidToken.status===401,'Malformed tokens cannot access private diagnosis');
  const aRole=await api('/api/platform/admin/access',a.token);
  const bRole=await api('/api/platform/admin/access',b.token);
  check(aRole.status===200&&aRole.body.permissions?.includes('platform.admin'),
    'Dedicated Platform administrator is recognized');
  check(bRole.status===200&&(!bRole.body.permissions?.includes('platform.admin')),
    'Social role metadata never grants Platform administration');
  const denied=await api('/api/platform/admin/overview',b.token);
  check(denied.status===403,'Non-Platform-admin cannot inspect private statistics');
  const before=await Promise.all([
   api('/api/platform/diagnostico',a.token),
   api('/api/platform/diagnostico',b.token)]);
  check(before.every(x=>x.status===200&&x.body.completed===false),
   'Both fictitious authenticated QA accounts start without diagnosis');

  const postA=await api('/api/platform/diagnostico',a.token,'POST',{
   answers:[4,4,4,4,4],timeframe:'SWING'
  });
  const postB=await api('/api/platform/diagnostico',b.token,'POST',{
   answers:[0,0,0,0,0],timeframe:'RAPIDO',user_id:a.id
  });
  check(postA.status===200&&postA.body.mode==='manual'
   &&postB.status===200&&postB.body.mode==='reversa',
   'Dedicated QA diagnoses are persisted independently per user');
  const [readA,readB]=await Promise.all([
   api('/api/platform/diagnostico',a.token),api('/api/platform/diagnostico',b.token)]);
  check(readA.body?.mode==='manual'&&readB.body?.mode==='reversa' &&
    readA.body?.verified===true&&readB.body?.verified===true,
   'Authenticated retrieval never crosses identities');
  const retryA=await api('/api/platform/diagnostico',a.token,'POST',{answers:[0,0,0,0,0],timeframe:'RAPIDO'});
  check(retryA.status===200&&retryA.body.mode==='manual','First diagnosis wins against resubmission');
  const invalid=await api('/api/platform/diagnostico',b.token,'POST',{answers:[5,5,5,5,5],timeframe:'RAPIDO'});
  check(invalid.status===400,'Server validates diagnostic input against the dedicated QA backend');
  const [anonQuery,loggedQuery]=await Promise.all([
   makeUserClient().from('jenios_platform_diagnostics').select('user_id').limit(1),
   b.client.from('jenios_platform_diagnostics').select('user_id').limit(1)]);
  check(!!anonQuery.error&&!!loggedQuery.error,'Database permissions prevent direct browser reads');
  const risk=await api('/api/platform/risk-summary',b.token);
  check(risk.status===200&&risk.body.avoidedLossBRL===null,
   'Platform never fabricates prevented losses');
  const overview=await api('/api/platform/admin/overview',a.token);
  check(overview.status===200&&overview.body.verified===true
   &&overview.body.source==='platform_dedicated_database'
   &&overview.body.diagnostics>=initial.diagnostics+2,
   'Private admin statistics reflect new fictitious QA records');

  check(await countRows('jenios_platform_diagnostics')===initial.diagnostics+2,
   'Exactly two QA diagnoses were added');
  check(await countRows('jenios_platform_risk_events')===initial.risk,
   'No trade or risk event fabricated during QA');
 }catch(e){executionError=e;}
 finally{
  const failures=[];
  for(const id of users.reverse()){
   const session=sessions.get(id);
   if(session){
    try{
     const signedOut=await admin.auth.admin.signOut(session.token,'global');
     if(signedOut.error)failures.push('session-revocation');
    }catch{failures.push('session-revocation');}
   }
   for(let attempt=0;attempt<3;attempt++){
    const {error}=await admin.auth.admin.deleteUser(id).catch(()=>({error:true}));
    if(!error)break;
    if(attempt===2)failures.push(id);
    else await new Promise(r=>setTimeout(r,200*(attempt+1)));
   }
  }
  if(failures.length)throw Error('CRITICAL: some synthetic QA users could not be deleted; inspect dedicated Platform Auth');
  if(await countRows('jenios_platform_diagnostics')!==initial.diagnostics)
    throw Error('CRITICAL: QA diagnosis cleanup was incomplete');
  if(await countRows('jenios_platform_admin_permissions')!==initial.permissions)
    throw Error('CRITICAL: QA permissions cleanup was incomplete');
  if(await countRows('jenios_platform_risk_events')!==initial.risk)
    throw Error('CRITICAL: QA risk table modified unexpectedly');
  for(const account of sessions.values()){
   const refreshed=await account.client.auth.refreshSession({refresh_token:account.refreshToken});
   check(!!refreshed.error&&!refreshed.data?.session,'Deleted QA account cannot refresh its session');
   const afterDelete=await api('/api/platform/diagnostico',account.token);
   check(afterDelete.status===401,'Deleted QA account cannot reuse its previous bearer token');
  }
  process.stdout.write('PASS QA synthetic account cleanup verified\n');
 }
 if(executionError)throw executionError;
 report('PASS',{cleanupVerified:true,createdFictitiousAccounts:users.length});
 process.stdout.write('HP04_REMOTE_AUTHENTICATED_QA_PASS='+checks.length+'\n');
}
run().catch(e=>{
 // Never print credentials, bearer tokens, synthetic account emails or response bodies.
 process.stderr.write('HP04_AUTH_QA_FAILED: '+String(e?.message||'Unspecified').replaceAll(serviceKey||'__absent__','[redacted]')+'\n');
 report('FAILED',{cleanupVerified:false});
 process.exitCode=1;
});
