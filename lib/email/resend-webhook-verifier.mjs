import {createHmac,timingSafeEqual} from 'node:crypto';
import {productionEmailScope} from './production-delivery-policy.mjs';

const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_SKEW_SECONDS=300;

function decodeSecret(secret){
 if(typeof secret!=='string'||!secret.startsWith('whsec_'))return null;
 try{
  const key=Buffer.from(secret.slice(6),'base64');
  return key.length>=16?key:null;
 }catch{return null;}
}

export function verifyResendSvix({payload,id,timestamp,signature,secret,now=Date.now()}={}){
 if(typeof payload!=='string'||typeof id!=='string'||id.length<8||id.length>200||
    typeof timestamp!=='string'||typeof signature!=='string'||signature.length>4096)return false;
 const ts=Number(timestamp);
 if(!Number.isSafeInteger(ts)||Math.abs(Math.floor(now/1000)-ts)>MAX_SKEW_SECONDS)return false;
 const key=decodeSecret(secret);
 if(!key)return false;
 const expected=createHmac('sha256',key).update(id+'.'+timestamp+'.'+payload,'utf8').digest();
 for(const part of signature.trim().split(/\s+/)){
  const comma=part.indexOf(',');
  if(comma<1||part.slice(0,comma)!=='v1')continue;
  let actual;try{actual=Buffer.from(part.slice(comma+1),'base64');}catch{continue;}
  if(actual.length===expected.length&&timingSafeEqual(actual,expected))return true;
 }
 return false;
}

export function parseResendSuppressionEvent(payload){
 let event;try{event=JSON.parse(payload);}catch{
  throw Object.assign(Error('RESEND_WEBHOOK_JSON_INVALID'),{code:'RESEND_WEBHOOK_JSON_INVALID'});
 }
 if(!event||typeof event!=='object'||Array.isArray(event))
  throw Object.assign(Error('RESEND_WEBHOOK_EVENT_INVALID'),{code:'RESEND_WEBHOOK_EVENT_INVALID'});
 if(!['email.bounced','email.complained'].includes(event.type))
  return Object.freeze({supported:false,eventType:String(event.type||'unknown')});
 const recipients=event.data?.to;
 const at=Date.parse(event.created_at||'');
 if(!Array.isArray(recipients)||recipients.length!==1||
    !EMAIL.test(String(recipients[0]||'').trim())||!Number.isFinite(at))
  throw Object.assign(Error('RESEND_WEBHOOK_EVENT_INVALID'),{code:'RESEND_WEBHOOK_EVENT_INVALID'});
 return Object.freeze({
  supported:true,
  eventType:event.type,
  recipient:String(recipients[0]).trim().toLowerCase(),
  eventAt:new Date(at).toISOString(),
  permanentBounce:event.type==='email.bounced'&&event.data?.bounce?.type==='Permanent'
 });
}

export function resendWebhookReadiness(env={}){
 const preview=env.VERCEL_ENV==='preview';
 const branch=env.VERCEL_GIT_COMMIT_REF==='fix/jenios-b305-finance-email-20261022';
 const project=env.VERCEL_PROJECT_ID==='prj_9cRnjWFRsLkfTToF4U4xZQBa7Gq9'&&
  env.JENIOS_B305_QA_PROJECT_ID==='prj_9cRnjWFRsLkfTToF4U4xZQBa7Gq9';
 const social=env.NEXT_PUBLIC_SUPABASE_URL==='https://rebzztxlzofxpfwjvbee.supabase.co';
 const enabled=env.JENIOS_RESEND_WEBHOOK_ENABLED==='true';
 const secretConfigured=Boolean(decodeSecret(env.RESEND_WEBHOOK_SECRET));
 const isolated=preview&&branch&&project&&social&&env.JENIOS_EMAIL_PRODUCTION_ENABLED!=='true';
 const productionScope=productionEmailScope(env);
 const mode=productionScope.ready?'production':isolated?'qa':null;
 return Object.freeze({ready:Boolean(mode)&&enabled&&secretConfigured,mode,productionScope,
  preview,branch,project,social,enabled,secretConfigured});
}
