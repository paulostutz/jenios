/** JENIOS B283: Vault-backed bank setup; no secret material in browser or logs.
 * Vault RPC must be available ONLY to service_role in the Social/JENIOS DB.
 */
import {zipMaterial,validateMaterial} from './inter-material.mjs';
import {createInterPixClient} from './inter-pix.mjs';
const error=(code,status=503)=>Object.assign(Error(code),{status,code});
const valid=(s,min,max)=>typeof s==='string'&&s.length>=min&&s.length<=max&&!/[\u0000-\u001f]/.test(s);
export function validateJeniosInterSetup(input,{now=Date.now()}={}){
 const connecting=input?.action==='connect';
 const fields=['action','clientId','clientSecret','zipBase64','pixKey','accountNumber',...(connecting?['confirmBankConnection']:[])];
 if(!input||Array.isArray(input)||!['save','connect'].includes(input.action)||
  connecting&&input.confirmBankConnection!==true||Object.keys(input).some(k=>!fields.includes(k))||
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
// Explicit public projection: neither a database error nor an unexpected RPC field
// can carry a credential back to the administrative browser.
function publicConfiguration(data){
 if(!data||typeof data!=='object'||Array.isArray(data)||typeof data.configured!=='boolean'||
  typeof data.bankAuthenticated!=='boolean')throw error('INTER_VAULT_RESPONSE_INVALID');
 const result={configured:data.configured,bankAuthenticated:data.configured&&data.bankAuthenticated,
  chargesEnabled:false,configurationVersion:0,status:'not_configured'};
 if(!data.configured)return result;
 result.status='configuration_saved_pending_payment_homologation';
 if(Number.isSafeInteger(data.configurationVersion)&&data.configurationVersion>0)
  result.configurationVersion=data.configurationVersion;
 for(const field of ['clientIdLast4','pixKeyLast4'])
  if(typeof data[field]==='string')result[field]=data[field].slice(-4);
 for(const field of ['certificateExpiresAt','updatedAt'])
  if(typeof data[field]==='string'&&Number.isFinite(Date.parse(data[field])))result[field]=new Date(data[field]).toISOString();
 if(typeof data.fingerprintSha256==='string'&&/^[a-f0-9]{64}$/.test(data.fingerprintSha256))
  result.fingerprintSha256=data.fingerprintSha256;
 return result;
}
function materialParams(material){
 return {p_client_id:material.clientId,p_client_secret:material.clientSecret,
  p_certificate:material.certificate,p_private_key:material.privateKey,p_pix_key:material.pixKey,
  p_account_number:material.accountNumber,p_cert_fingerprint:material.fingerprintSha256,
  p_cert_expires_at:material.certificateExpiresAt};
}
function versionOf(configuration){
 if(!configuration.configured)return 0;
 if(configuration.configurationVersion<1||!configuration.fingerprintSha256)
  throw error('INTER_VAULT_RESPONSE_INVALID');
 return configuration.configurationVersion;
}
async function claimAttempt(db,action){
 const {data,error:e}=await db.rpc('jenios_inter_claim_setup_attempt_r40',{p_action:action});
 if(e||typeof data!=='boolean')throw error('INTER_SETUP_GUARD_UNAVAILABLE');
 if(!data)throw error('INTER_SETUP_RATE_LIMITED',429);
}
async function authenticateReadOnly(runtime,makeClient){
 const client=makeClient({env:runtime});
 // OAuth followed by GET of a nonexistent transaction. Never invoke create/PUT.
 try{await client.read('00000000000000000000000000000000');}
 catch(e){if(e?.bankStatus!==404||e?.bankOperation!=='pix_read')throw error('INTER_BANK_READONLY_CONNECTION_FAILED',502);}
}
export async function statusJeniosInter(db){
 const {data,error:e}=await db.rpc('jenios_inter_status_b283');
 if(e)throw error('INTER_VAULT_NOT_READY');
 return publicConfiguration(data);
}
export async function saveJeniosInter(db,material){
 const {data,error:e}=await db.rpc('jenios_inter_store_b283',materialParams(material));
 if(e||data?.configured!==true)throw error('INTER_VAULT_SAVE_NOT_CONFIRMED');
 return publicConfiguration(data);
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
export async function connectJeniosInter(db,material,{makeClient=createInterPixClient,env=process.env}={}){
 await claimAttempt(db,'connect');
 const expected=versionOf(await statusJeniosInter(db));
 const runtime={...env,JENIOS_PAY_PROVIDER:'inter_pix',
  INTER_CLIENT_ID:material.clientId,INTER_CLIENT_SECRET:material.clientSecret,
  INTER_CERTIFICATE:material.certificate,INTER_PRIVATE_KEY:material.privateKey,
  INTER_PIX_KEY:material.pixKey,INTER_ACCOUNT_NUMBER:material.accountNumber||''};
 await authenticateReadOnly(runtime,makeClient);
 // The RPC compares the version and saves + marks this exact material in one
 // transaction. A failed test leaves the previous configuration untouched.
 const {data,error:e}=await db.rpc('jenios_inter_store_verified_r40',{
  ...materialParams(material),p_expected_version:expected
 });
 if(e?.code==='40001')throw error('INTER_CONFIGURATION_CHANGED',409);
 if(e)throw error('INTER_VAULT_SAVE_NOT_CONFIRMED');
 const configuration=publicConfiguration(data);
 if(!configuration.configured||!configuration.bankAuthenticated||
  configuration.configurationVersion!==expected+1||configuration.fingerprintSha256!==material.fingerprintSha256)
  throw error('INTER_VAULT_SAVE_NOT_CONFIRMED');
 return {...configuration,authenticationTestOnly:true};
}
export async function testJeniosInterAuth(db,{makeClient=createInterPixClient,env=process.env}={}){
 await claimAttempt(db,'test');
 const snapshot=await statusJeniosInter(db),version=versionOf(snapshot);
 if(!snapshot.configured)throw error('INTER_CONFIGURATION_REQUIRED',400);
 const safe=await loadJeniosInterServerEnv(db,env);
 const loadedFingerprint=validateMaterial(safe.INTER_CERTIFICATE,safe.INTER_PRIVATE_KEY).fingerprint
  .replaceAll(':','').toLowerCase();
 if(loadedFingerprint!==snapshot.fingerprintSha256)throw error('INTER_CONFIGURATION_CHANGED',409);
 await authenticateReadOnly(safe,makeClient);
 const {data,error:e}=await db.rpc('jenios_inter_mark_auth_r40',{
  p_expected_version:version,p_cert_fingerprint:snapshot.fingerprintSha256
 });
 if(e?.code==='40001')throw error('INTER_CONFIGURATION_CHANGED',409);
 if(e)throw error('INTER_BANK_TEST_NOT_RECORDED');
 const configuration=publicConfiguration(data);
 if(!configuration.configured||!configuration.bankAuthenticated||
  configuration.configurationVersion!==version||configuration.fingerprintSha256!==snapshot.fingerprintSha256)
  throw error('INTER_BANK_TEST_NOT_RECORDED');
 return {...configuration,authenticationTestOnly:true};
}
