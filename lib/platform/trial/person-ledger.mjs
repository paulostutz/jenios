import {createHmac} from 'node:crypto';
/** Trial ledger is separate from the payment/checkout and cannot charge anyone. */
export const TRIAL_DURATION_MS=7*24*60*60*1000;
const fail=(code,status,message)=>Object.assign(new Error(message),{code,status});
export function normalizeCpf(value){return typeof value==='string' ? value.replace(/[.\-\s]/g,'') : '';}
export function validCpf(value){
 const s=normalizeCpf(value);if(!/^\d{11}$/.test(s)||/^(\d)\1{10}$/.test(s))return false;
 for(const n of [9,10]){
  let sum=0;for(let i=0;i<n;i++)sum+=Number(s[i])*(n+1-i);
  const remainder=sum%11,check=remainder<2?0:11-remainder;
  if(check!==Number(s[n]))return false;
 }
 return true;
}
export function personDigest(verifiedCpf,secret){
 if(!validCpf(verifiedCpf))throw fail('IDENTITY_INVALID',403,'Documento verificado inválido.');
 if(typeof secret!=='string'||Buffer.byteLength(secret,'utf8')<32)throw fail('TRIAL_NOT_CONFIGURED',503,'Identidade do teste grátis não configurada.');
 // HMAC with a private pepper. No raw CPF, name or email is persisted by this module.
 return createHmac('sha256',secret).update('jenios:platform:trial:cpf:v1\0'+normalizeCpf(verifiedCpf)).digest('hex');
}
export function trialAccessWindow(start,now=Date.now()){
 const ms=Date.parse(start);if(!Number.isFinite(ms)||!Number.isFinite(now)||ms>now)return {active:false,remainingMs:0};
 const remaining=Math.max(0,ms+TRIAL_DURATION_MS-now);
 return {active:remaining>0,remainingMs:remaining,endsAt:new Date(ms+TRIAL_DURATION_MS).toISOString()};
}
/**
 * verifyIdentity MUST be a server-side, independently authenticated identity provider.
 * Never implement it by trusting CPF / verified:true / email from a browser payload.
 * Ledger writes are atomic using a service-role-only RPC in the reviewed SQL proposal.
 * No subscription entitlements or financial transactions are created here.
 */
export async function grantVerifiedPersonTrial({user,verificationToken,verifyIdentity,db,secret,now=()=>Date.now()}={}){
 if(!user?.id||user.is_anonymous)throw fail('AUTH_REQUIRED',401,'Entre em sua conta para continuar.');
 if(typeof verifyIdentity!=='function'||!db?.rpc)throw fail('TRIAL_NOT_CONFIGURED',503,'A verificação de identidade ainda não está disponível.');
 if(typeof secret!=='string'||Buffer.byteLength(secret,'utf8')<32)throw fail('TRIAL_NOT_CONFIGURED',503,'A verificação de identidade ainda não está disponível.');
 const evidence=await verifyIdentity({userId:user.id,verificationToken});
 const nowMs=now();
 if(!evidence||evidence.userId!==user.id||evidence.verified!==true||evidence.documentType!=='CPF'||
    !Number.isFinite(Date.parse(evidence.verifiedAt))||Date.parse(evidence.verifiedAt)>nowMs||nowMs-Date.parse(evidence.verifiedAt)>10*60*1000||
    !Number.isFinite(Date.parse(evidence.expiresAt))||Date.parse(evidence.expiresAt)<=nowMs){
  throw fail('IDENTITY_NOT_VERIFIED',403,'É necessária uma verificação de identidade válida e recente.');
 }
 const digest=personDigest(evidence.document,secret);
 let result;
 try {result=await db.rpc('platform_grant_person_trial_v1',{p_user_id:user.id,p_subject_digest:digest});}
 catch{throw fail('TRIAL_LEDGER_UNAVAILABLE',503,'Não foi possível consultar a elegibilidade do teste grátis.');}
 if(result?.error)throw fail('TRIAL_LEDGER_UNAVAILABLE',503,'Não foi possível consultar a elegibilidade do teste grátis.');
 const row=Array.isArray(result?.data)?result.data[0]:result?.data;
 if(row?.outcome==='already_claimed')return {status:'already_claimed',eligible:false,chargeCreated:false};
 if(row?.outcome!=='granted')throw fail('TRIAL_LEDGER_UNAVAILABLE',503,'Não foi possível confirmar o teste grátis.');
 const start=Date.parse(row.started_at),end=Date.parse(row.expires_at);
 if(!Number.isFinite(start)||!Number.isFinite(end)||Math.abs(end-start-TRIAL_DURATION_MS)>1000||start>nowMs+30000||end<=nowMs){
  throw fail('TRIAL_LEDGER_INVALID',503,'Não foi possível validar o período do teste grátis.');
 }
 return {status:'granted',eligible:true,startedAt:new Date(start).toISOString(),expiresAt:new Date(end).toISOString(),chargeCreated:false};
}
