import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {productionEmailScope,productionEmailDeliveryPolicy} from '../lib/email/production-delivery-policy.mjs';
import {verifyResendSvix,parseResendSuppressionEvent,resendWebhookReadiness} from '../lib/email/resend-webhook-verifier.mjs';
import {marketingDeliveryReadiness,runMarketingEmailBatch} from '../lib/email/marketing-delivery-worker.mjs';

const key=Buffer.from('r42-local-only-fixture-signing-key');
const secret='whsec_'+key.toString('base64');
const env=Object.freeze({
 VERCEL_ENV:'production',VERCEL_PROJECT_ID:'prj_fixtureProduction42',VERCEL_GIT_COMMIT_REF:'release/fixture-email-r42',
 NEXT_PUBLIC_SUPABASE_URL:'https://abcdefghijklmnopqrst.supabase.co',
 JENIOS_EMAIL_PRODUCTION_PROJECT_ID:'prj_fixtureProduction42',JENIOS_EMAIL_PRODUCTION_BRANCH:'release/fixture-email-r42',
 JENIOS_EMAIL_PRODUCTION_SUPABASE_URL:'https://abcdefghijklmnopqrst.supabase.co',
 JENIOS_B305_TEST_SEND_APPROVED:'false',JENIOS_B305_PRIVATE_EMAIL_RUNNER_ENABLED:'false',JENIOS_B305_QA_TEST_ROUTE_ARMED:'false',
 CRON_SECRET:'local-only-fixture-internal-secret-r42',JENIOS_EMAIL_PRODUCTION_ENABLED:'false',
 JENIOS_RESEND_WEBHOOK_ENABLED:'true',RESEND_WEBHOOK_SECRET:secret
});

function request({body,raw,signature,method='POST',eventId='evt_local_r42_12345678'}={}){
 const timestamp=String(Math.floor(Date.now()/1000));
 const payload=raw??JSON.stringify(body??{type:'email.complained',created_at:new Date().toISOString(),data:{to:['fixture@example.com']}});
 const signed='v1,'+createHmac('sha256',key).update(eventId+'.'+timestamp+'.'+payload).digest('base64');
 return new Request('https://fixture.invalid/api/webhooks/resend',{method,
  headers:{'content-type':'application/json','svix-id':eventId,'svix-timestamp':timestamp,'svix-signature':signature??signed},
  ...(['GET','HEAD'].includes(method)?{}:{body:payload})});
}

function handler(settings=env,{rpcResult={ok:true,duplicate:false,disposition:'complaint'}}={}){
 const calls=[];
 const source=readFileSync(new URL('../app/api/webhooks/resend/route.js',import.meta.url),'utf8')
  .replace(/^import[^\n]+\n/gm,'').replace(/^export const /gm,'const ').replace(/^export async function /gm,'async function ');
 const deps={process:{env:settings},Response,Buffer,verifyResendSvix,parseResendSuppressionEvent,resendWebhookReadiness,
  getJeniosPayAdmin(){calls.push('database');return {rpc:async(name,args)=>{
   calls.push({name,args});return {data:rpcResult,error:null};
  }};}};
 return {calls,run:new Function(...Object.keys(deps),source+'\nreturn POST;')(...Object.values(deps))};
}

test('R42 production webhook can be prepared while every delivery remains disabled',()=>{
 assert.equal(productionEmailScope(env).ready,true);
 assert.equal(productionEmailDeliveryPolicy(env).ready,false);
 const gate=resendWebhookReadiness(env);
 assert.equal(gate.ready,true);assert.equal(gate.mode,'production');
 assert.equal(JSON.stringify(gate).includes(secret),false);
});

test('R42 production webhook rejects mismatched scope, QA flags and missing signing secret',async()=>{
 for(const patch of [{VERCEL_ENV:'preview'},{VERCEL_PROJECT_ID:'prj_wrongFixture42'},
  {VERCEL_GIT_COMMIT_REF:'other'},{NEXT_PUBLIC_SUPABASE_URL:'https://rebzztxlzofxpfwjvbee.supabase.co'},
  {JENIOS_B305_TEST_SEND_APPROVED:'true'},{JENIOS_B305_QA_TEST_ROUTE_ARMED:undefined},
  {RESEND_WEBHOOK_SECRET:''}]){
  const fixture=handler({...env,...patch});
  assert.equal((await fixture.run(request())).status,503);
  assert.equal(fixture.calls.length,0);
 }
 const disabled=handler({...env,JENIOS_RESEND_WEBHOOK_ENABLED:'false'});
 assert.equal((await disabled.run(request())).status,404);assert.equal(disabled.calls.length,0);
});

test('R42 signed suppression retains the existing idempotent RPC and returns only safe acknowledgement',async()=>{
 const fixture=handler(env,{rpcResult:{ok:true,duplicate:true,disposition:'complaint',private:'must-not-leak'}});
 const response=await fixture.run(request());
 assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
 assert.deepEqual(await response.json(),{ok:true,duplicate:true,disposition:'complaint'});
 assert.equal(fixture.calls[1].name,'jenios_ingest_resend_suppression_b305');
 assert.equal(fixture.calls[1].args.p_recipient_email,'fixture@example.com');
 assert.equal(fixture.calls[1].args.p_event_type,'email.complained');
 assert.equal(Object.keys(fixture.calls[1].args).length,5);
});

test('R42 invalid signature, excessive body and unsupported method do not open a privileged client',async()=>{
 for(const [input,status] of [[{signature:'v1,invalid'},400],[{raw:'x'.repeat(65537)},413],[{method:'GET'},405]]){
  const fixture=handler();const response=await fixture.run(request(input));
  assert.equal(response.status,status);assert.equal(fixture.calls.length,0);
 }
});

test('R42 unknown webhook event is ignored without claiming delivery or touching a queue',async()=>{
 const fixture=handler();
 const response=await fixture.run(request({body:{type:'email.delivered'}}));
 assert.deepEqual(await response.json(),{ok:true,ignored:true});assert.equal(fixture.calls.length,0);
});

test('R42 marketing requires the production webhook and its explicit certification before database I/O',async()=>{
 const settings={...env,JENIOS_EMAIL_PRODUCTION_ENABLED:'true',JENIOS_MARKETING_EMAILS_ENABLED:'true',
  JENIOS_EMAIL_DELIVERY_START_AT:'2020-01-01T00:00:00Z',RESEND_API_KEY:'re_local_only_fixture123',
  SUPABASE_SECRET_KEY:'sb_secret_local_only_fixture',JENIOS_RESEND_EXPECTED_DOMAIN:'jenios.com.br',
  JENIOS_RESEND_DOMAIN_VERIFIED:'true',JENIOS_RESEND_WEBHOOK_ENDPOINT_CERTIFIED:'true'};
 assert.equal(marketingDeliveryReadiness(settings).ready,true);
 for(const patch of [{JENIOS_RESEND_WEBHOOK_ENABLED:'false'},{RESEND_WEBHOOK_SECRET:''},
  {JENIOS_RESEND_WEBHOOK_ENDPOINT_CERTIFIED:'false'},{JENIOS_RESEND_WEBHOOK_ENDPOINT_CERTIFIED:undefined}]){
  let calls=0;
  const result=await runMarketingEmailBatch({env:{...settings,...patch},
   db:{rpc:async()=>{calls++;throw Error('database must stay closed');}},
   fetcher:async()=>{calls++;throw Error('transport must stay closed');}});
  assert.equal(result.status,'DISABLED');assert.equal(calls,0);
 }
});
