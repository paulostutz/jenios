/** JENIOS B283: Vault-backed bank setup; no secret material in browser or logs.
 * Vault RPC must be available ONLY to service_role in the Social/JENIOS DB.
 */
import {zipMaterial,validateMaterial} from './inter-material.mjs';
import {createInterPixClient} from './inter-pix.mjs';
const error=(code,status=503)=>Object.assign(Error(code),{status,code});
const valid=(s,min,max)=>typeof s==='string'&&s.length>=min&&s.length<=max&&!/[\u0000-\u001f]/.test(s);
export function validateJeniosInterSetup(input,{now=Date.now()}={}){
 if(!input||Object.keys(input).some(k=>!['action','clientId','clientSecret','zipBase64','pixKey','accountNumber'].includes(k))||
  !valid(input.clientId,8,200)||/\s/.test(input.clientId)||
  !valid(input.clientSecret,16,500)||
  !valid(input.pixKey,4,140)||
  input.accountNumber!==undefined&&!valid(input.accountNumber,0,60)||
  typeof input.zipBase64!=='string')throw error('INTER_INPUT_INVALID',400);
 let material;try{material=zipMaterial(input.zipBase64);}catch(e){throw error(/^INTER_[A-Z_]+$/.test(e?.message)?e.message:'INTER_ZIP_INVALID',400);}
 let cert;try{cert=validateMaterial(material.certificate,material.privateKey,now);}catch(e){throw error(/^INTER_[A-Z_]+$/.test(e?.message)?e.message:'INTER_PEM_INVALID',400);}
 return Object.freeze({clientId:input.clientId,clientSecret:input.clientSecret,pixKey:input.pixKey,
  accountNumber:input.accountNumber||'',certificate:material.certificate,privateKey:material.privateKey,
  certificateExpiresAt:cert.expires_at,
  fingerprintSha256:String(cert.fingerprint).replaceAll(':','').toLowerCase()});
}
export async function statusJeniosInter(db){
 const {data,error:e}=await db.rpc('jenios_inter_status_b283');
 if(e)throw error('INTER_VAULT_NOT_READY');
 if(!data||typeof data!=='object'||Array.isArray(data))throw error('INTER_VAULT_RESPONSE_INVALID');
 return data;
}
export async function saveJeniosInter(db,material){
 const {data,error:e}=await db.rpc('jenios_inter_store_b283',{
  p_client_id:material.clientId,p_client_secret:material.clientSecret,
  p_certificate:material.certificate,p_private_key:material.privateKey,p_pix_key:material.pixKey,
  p_account_number:material.accountNumber,p_cert_fingerprint:material.fingerprintSha256,
  p_cert_expires_at:material.certificateExpiresAt
 });
 if(e||data?.configured!==true)throw error('INTER_VAULT_SAVE_NOT_CONFIRMED');
 return data;
}
export async function loadJeniosInterServerEnv(db,env=process.env){
 const {data,error:e}=await db.rpc('jenios_inter_load_b283');
 if(e||!data||typeof data!=='object'||data.purpose!=='jenios_pix_configuration_only')
  throw error('INTER_SECURE_CONFIG_UNAVAILABLE');
 const safe={
  JENIOS_PAY_PROVIDER:'inter_pix',INTER_CLIENT_ID:data.client_id,INTER_CLIENT_SECRET:data.client_secret,
  INTER_CERTIFICATE:data.certificate,INTER_PRIVATE_KEY:data.private_key,
  INTER_PIX_KEY:data.pix_key,INTER_ACCOUNT_NUMBER:data.account_number||''
 };
 if(!valid(safe.INTER_CLIENT_ID,8,200)||!valid(safe.INTER_CLIENT_SECRET,16,500)||
  !valid(safe.INTER_PIX_KEY,4,140))throw error('INTER_SECURE_CONFIG_INVALID');
 try{validateMaterial(safe.INTER_CERTIFICATE,safe.INTER_PRIVATE_KEY);}catch{throw error('INTER_SECURE_CERTIFICATE_INVALID');}
 return {...env,...safe};
}
export async function testJeniosInterAuth(db,{makeClient=createInterPixClient,env=process.env}={}){
 const safe=await loadJeniosInterServerEnv(db,env);
 const client=makeClient({env:safe});
 // An intentionally nonexistent transaction is queried via GET; no PUT/POST charge.
 try{await client.read('00000000000000000000000000000000');}
 catch(e){if(e.bankStatus!==404)throw error('INTER_BANK_READONLY_CONNECTION_FAILED');}
 const {data,error:e}=await db.rpc('jenios_inter_mark_auth_b283',{p_authenticated:true});
 if(e||data?.bankAuthenticated!==true)throw error('INTER_BANK_TEST_NOT_RECORDED');
 return {...data,chargesEnabled:false,authenticationTestOnly:true};
}
