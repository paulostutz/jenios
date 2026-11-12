/** JENIOS R83 — private isolated Live credential vault. No public HTTP entrypoint.
 * Seals secrets in AES-256-GCM with owner+connection+provider+environment AAD.
 * Explicit kill flags deny access even to reading/decrypting secrets.
 * This module NEVER transmits orders, brokers funds or stores raw credentials.
 */
import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const VISIBLE=/^[\x21-\x7e]{16,256}$/;
const OAUTH=/^[\x21-\x7e]{20,4096}$/;
const KID=/^[a-z][a-z0-9-]{0,31}$/;
const fail=code=>{throw Object.assign(new Error(code),{code});};
const exact=(value,names)=>value&&typeof value==='object'&&!Array.isArray(value)&&
 Object.keys(value).sort().join('|')===names.slice().sort().join('|');
export function requireR83PrivateVaultGate(env={}){
 if(env.JENIOS_R83_PRIVATE_NODE_WORKER!=='true'||
    env.JENIOS_R83_LIVE_VAULT_ENABLED!=='true'||
    env.JENIOS_REAL_EXECUTION_ENABLED!=='false'||
    env.JENIOS_R82_ALPACA_LIVE_ORDER_EXECUTION_ENABLED!=='false'||
    env.VERCEL_ENV==='production')fail('R83_VAULT_DISABLED');
 return true;
}
function validatedScope(scope){
 if(!UUID.test(scope?.ownerUserId||'')||!UUID.test(scope?.connectionId||'')||
    !['ALPACA_API_KEY_PAIR','ALPACA_OAUTH_ACCESS_TOKEN'].includes(scope?.kind))
  fail('R83_VAULT_SCOPE_INVALID');
 return scope;
}
function keyConfig(env){
 const raw=env.JENIOS_R83_LIVE_VAULT_KEY_B64;
 const kid=env.JENIOS_R83_LIVE_VAULT_KEY_ID;
 if(typeof raw!=='string'||!/^[A-Za-z0-9+/]{43}=$/.test(raw)||
    typeof kid!=='string'||!KID.test(kid))
  fail('R83_PRIVATE_VAULT_KEY_UNAVAILABLE');
 const buf=Buffer.from(raw,'base64');
 if(buf.length!==32||buf.toString('base64')!==raw||
    raw===env.JENIOS_DEMO_VAULT_KEY_B64||
    raw===env.JENIOS_R82_LIVE_ACCOUNT_DIGEST_KEY_B64)
  fail('R83_PRIVATE_VAULT_KEY_UNAVAILABLE');
 return {key:buf,kid};
}
function validateCredentials(value){
 if(exact(value,['kind','apiKey','secret'])&&
    value.kind==='ALPACA_API_KEY_PAIR'&&
    typeof value.apiKey==='string'&&VISIBLE.test(value.apiKey)&&
    typeof value.secret==='string'&&VISIBLE.test(value.secret))
  return value;
 if(exact(value,['kind','accessToken'])&&
    value.kind==='ALPACA_OAUTH_ACCESS_TOKEN'&&
    typeof value.accessToken==='string'&&OAUTH.test(value.accessToken))
  return value;
 fail('R83_INVALID_LIVE_CREDENTIAL_FORMAT');
}
function aad(scope,kid){
 return Buffer.from([
  'JENIOS_R83_LIVE_VAULT_V1','alpaca','live',
  scope.ownerUserId,scope.connectionId,scope.kind,kid
 ].join('\x1f'),'utf8');
}
function base64Bytes(value,expectedLength=0){
 if(typeof value!=='string'||value.length>8192||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(value))fail('R83_VAULT_ENVELOPE_INVALID');
 const raw=Buffer.from(value,'base64');
 if(raw.toString('base64')!==value||(expectedLength&&raw.length!==expectedLength))
  fail('R83_VAULT_ENVELOPE_INVALID');
 return raw;
}
export function sealR83LiveCredentials(scope,credentials,{env=process.env}={}){
 requireR83PrivateVaultGate(env);
 validatedScope(scope);
 const verified=validateCredentials(credentials);
 if(verified.kind!==scope.kind)fail('R83_VAULT_SCOPE_INVALID');
 const {key,kid}=keyConfig(env);
 const raw=Buffer.from(JSON.stringify(verified),'utf8');
 if(raw.length>8192)fail('R83_CREDENTIAL_PAYLOAD_TOO_LARGE');
 const iv=randomBytes(12);
 const cipher=createCipheriv('aes-256-gcm',key,iv);
 cipher.setAAD(aad(scope,kid));
 const sealed=Buffer.concat([cipher.update(raw),cipher.final()]);
 return Object.freeze({v:1,kid,kind:scope.kind,iv:iv.toString('base64'),
  tag:cipher.getAuthTag().toString('base64'),data:sealed.toString('base64')});
}
export function openR83LiveCredentials(scope,envelope,{env=process.env}={}){
 requireR83PrivateVaultGate(env);
 validatedScope(scope);
 const {key,kid}=keyConfig(env);
 if(!exact(envelope,['v','kid','kind','iv','tag','data'])||
    envelope.v!==1||envelope.kind!==scope.kind||envelope.kid!==kid)
  fail('R83_VAULT_ENVELOPE_INVALID');
 const iv=base64Bytes(envelope.iv,12),tag=base64Bytes(envelope.tag,16);
 const bytes=base64Bytes(envelope.data);
 if(bytes.length===0||bytes.length>8192)fail('R83_VAULT_ENVELOPE_INVALID');
 try{
  const decipher=createDecipheriv('aes-256-gcm',key,iv);
  decipher.setAAD(aad(scope,kid));
  decipher.setAuthTag(tag);
  const decoded=Buffer.concat([decipher.update(bytes),decipher.final()]);
  const credentials=validateCredentials(JSON.parse(decoded.toString('utf8')));
  if(credentials.kind!==scope.kind)fail('R83_VAULT_SCOPE_INVALID');
  return Object.freeze(credentials);
 }catch{
  fail('R83_VAULT_DECRYPT_DENIED');
 }
}
