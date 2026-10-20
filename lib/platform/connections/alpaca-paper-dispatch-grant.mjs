/** B179: operator-reviewed, short-lived consent proof for a PRIVATE PAPER WORKER ONLY.
 * Never trust browser flags such as permissionsVerified: true as dispatch authorization.
 * This is an internal technical gate; it is not broker approval, customer legal consent or a license.
 */
import {createHmac,timingSafeEqual} from 'node:crypto';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HEX=/^[a-f0-9]{64}$/;
const ID=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/;
const deny=code=>{throw Object.assign(new Error(code),{code});};
const FIELDS=['accountDigest','bracketReview','brokerPermissions','clientOrderId','connectionId','customerPaperConsent','evidenceDigest','expiresAtMs','issuedAtMs','mode','orderBodyDigest','operatorReview','userId','v'];
function checkData(d){
 if(!d||typeof d!=='object'||Array.isArray(d)||Object.keys(d).sort().join(',')!==FIELDS.slice().sort().join(','))deny('PAPER_GRANT_INVALID_FIELDS');
 if(d.v!==1||!UUID.test(d.userId||'')||!UUID.test(d.connectionId||'')||!ID.test(d.clientOrderId||'')||!HEX.test(d.accountDigest||'')||!HEX.test(d.orderBodyDigest||'')||!HEX.test(d.evidenceDigest||'')||!['direct','reverse','hybrid'].includes(d.mode))deny('PAPER_GRANT_INVALID_SCOPE');
 if(d.customerPaperConsent!=='verified_in_private_worker'||d.brokerPermissions!=='independently_audited_for_paper'||d.bracketReview!=='independently_reviewed'||d.operatorReview!=='human_paper_qa_authorized')deny('PAPER_APPROVAL_INCOMPLETE');
 if(!Number.isSafeInteger(d.issuedAtMs)||!Number.isSafeInteger(d.expiresAtMs)||d.issuedAtMs<=0||d.expiresAtMs<=d.issuedAtMs||d.expiresAtMs-d.issuedAtMs>120000)deny('PAPER_GRANT_INVALID_TIME');
}
function privateRuntime(env){
 if(env.VERCEL||env.VERCEL_ENV||env.JENIOS_PRIVATE_PAPER_EXECUTOR!=='true'||env.JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED!=='true'||env.JENIOS_PRIVATE_PAPER_REHEARSAL!=='true')deny('PRIVATE_PAPER_TRANSPORT_DISABLED');
 const b64=env.JENIOS_PAPER_WORKER_SIGNING_KEY_B64;
 if(typeof b64!=='string'||!/^[A-Za-z0-9+/]{43}=$/.test(b64))deny('PAPER_GRANT_KEY_MISSING');
 const key=Buffer.from(b64,'base64');if(key.length!==32||key.toString('base64')!==b64)deny('PAPER_GRANT_KEY_MISSING');
 return key;
}
const mac=(payload,key)=>createHmac('sha256',key).update('jenios-paper-qa-grant-v1\0').update(JSON.stringify(payload)).digest('hex');
export function issuePaperGrant(payload,{env=process.env}={}){
 const key=privateRuntime(env);checkData(payload);
 return Object.freeze({payload:Object.freeze(structuredClone(payload)),hmacSha256:mac(payload,key)});
}
export function verifyPaperGrant(grant,expected,{env=process.env,nowMs=Date.now()}={}){
 const key=privateRuntime(env);
 if(!grant||typeof grant!=='object'||Object.keys(grant).sort().join(',')!=='hmacSha256,payload'||!HEX.test(grant.hmacSha256||''))deny('PAPER_GRANT_INVALID_FORMAT');
 checkData(grant.payload);
 if(!Number.isSafeInteger(nowMs)||nowMs<=0||nowMs<grant.payload.issuedAtMs||nowMs>=grant.payload.expiresAtMs)deny('PAPER_GRANT_EXPIRED');
 const a=Buffer.from(mac(grant.payload,key),'hex'),b=Buffer.from(grant.hmacSha256,'hex');
 if(!timingSafeEqual(a,b))deny('PAPER_GRANT_SIGNATURE_INVALID');
 for(const k of ['userId','connectionId','accountDigest','clientOrderId','orderBodyDigest','mode'])if(grant.payload[k]!==expected?.[k])deny('PAPER_GRANT_CROSS_SCOPE');
 return Object.freeze({technicallySigned:true,expiresAtMs:grant.payload.expiresAtMs,
  operatorReviewClaimed:true,brokerAuditedClaimed:true,realExecution:false});
}
export function assertPrivatePaperRuntime(env=process.env){privateRuntime(env);return true;}
