import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {verifyResendSvix,parseResendSuppressionEvent,resendWebhookReadiness} from '../lib/email/resend-webhook-verifier.mjs';

const rawKey=Buffer.from('0123456789abcdef0123456789abcdef');
const secret='whsec_'+rawKey.toString('base64');
const id='msg_test_123456789';
const timestamp='1792723200';
const payload=JSON.stringify({
 type:'email.bounced',
 created_at:'2026-10-23T02:40:00.000Z',
 data:{to:['client@example.com'],bounce:{type:'Permanent',subType:'General',message:'Rejected'}}
});
const signature='v1,'+createHmac('sha256',rawKey)
 .update(id+'.'+timestamp+'.'+payload,'utf8').digest('base64');

test('B305-R33 verifies Svix signature on exact raw body',()=>{
 const now=Number(timestamp)*1000;
 assert.equal(verifyResendSvix({payload,id,timestamp,signature,secret,now}),true);
 assert.equal(verifyResendSvix({payload:payload+' ',id,timestamp,signature,secret,now}),false);
 assert.equal(verifyResendSvix({payload,id,timestamp,signature,secret,now:now+301000}),false);
 assert.equal(verifyResendSvix({payload,id,timestamp,signature:'v1,invalid',secret,now}),false);
});

test('B305-R33 parses complaint and permanent/transient bounce correctly',()=>{
 const hard=parseResendSuppressionEvent(payload);
 assert.equal(hard.supported,true);
 assert.equal(hard.permanentBounce,true);
 assert.equal(hard.recipient,'client@example.com');

 const soft=parseResendSuppressionEvent(JSON.stringify({
  type:'email.bounced',
  created_at:'2026-10-23T02:40:00.000Z',
  data:{to:['client@example.com'],bounce:{type:'Transient'}}
 }));
 assert.equal(soft.permanentBounce,false);

 const complaint=parseResendSuppressionEvent(JSON.stringify({
  type:'email.complained',
  created_at:'2026-10-23T02:40:00.000Z',
  data:{to:['client@example.com']}
 }));
 assert.equal(complaint.supported,true);
 assert.equal(complaint.eventType,'email.complained');

 const ignored=parseResendSuppressionEvent(JSON.stringify({
  type:'email.delivered',
  created_at:'2026-10-23T02:40:00.000Z',
  data:{to:['client@example.com']}
 }));
 assert.equal(ignored.supported,false);
});

test('B305-R33 webhook readiness is exact Preview branch/project and explicit gate',()=>{
 const env={
  VERCEL_ENV:'preview',
  VERCEL_GIT_COMMIT_REF:'fix/jenios-b305-finance-email-20261022',
  VERCEL_PROJECT_ID:'prj_9cRnjWFRsLkfTToF4U4xZQBa7Gq9',
  JENIOS_B305_QA_PROJECT_ID:'prj_9cRnjWFRsLkfTToF4U4xZQBa7Gq9',
  NEXT_PUBLIC_SUPABASE_URL:'https://rebzztxlzofxpfwjvbee.supabase.co',
  JENIOS_RESEND_WEBHOOK_ENABLED:'true',
  RESEND_WEBHOOK_SECRET:secret
 };
 assert.equal(resendWebhookReadiness(env).ready,true);
 assert.equal(resendWebhookReadiness({...env,VERCEL_ENV:'production'}).ready,false);
 assert.equal(resendWebhookReadiness({...env,JENIOS_RESEND_WEBHOOK_ENABLED:'false'}).ready,false);
 assert.equal(resendWebhookReadiness({...env,RESEND_WEBHOOK_SECRET:''}).ready,false);
});

test('B305-R33 route accepts only POST, stays gated and writes only through suppression RPC',()=>{
 const src=readFileSync('app/api/webhooks/resend/route.js','utf8');
 assert.match(src,/export async function POST/);
 assert.doesNotMatch(src,/export async function (GET|PUT|PATCH|DELETE)/);
 assert.match(src,/JENIOS_RESEND_WEBHOOK_ENABLED/);
 assert.match(src,/svix-id/);
 assert.match(src,/svix-timestamp/);
 assert.match(src,/svix-signature/);
 assert.match(src,/jenios_ingest_resend_suppression_b305/);
 assert.doesNotMatch(src,/sendResend|api\.resend\.com/);
});
