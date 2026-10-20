/** B165: encrypted server-only demo credential/snapshot envelopes. Not browser-importable. */
import {createCipheriv,createDecipheriv,createHmac,randomBytes} from 'node:crypto';
const bad=code=>{throw Object.assign(new Error(code),{code});};
function key(env){
 const raw=env.JENIOS_DEMO_VAULT_KEY_B64;
 if(typeof raw!=='string'||!/^[A-Za-z0-9+/]{43}=$/.test(raw))bad('VAULT_NOT_CONFIGURED');
 const bytes=Buffer.from(raw,'base64');
 if(bytes.length!==32||bytes.toString('base64')!==raw)bad('VAULT_NOT_CONFIGURED');
 return bytes;
}
export function vaultReady(env=process.env){try{key(env);return true;}catch{return false;}}
function aad(scope){
 const {userId,id,provider,environment,kind}=scope||{};
 if(!/^[0-9a-f-]{36}$/i.test(userId||'')||!/^[0-9a-f-]{36}$/i.test(id||'')||!['binance','alpaca'].includes(provider)||!['testnet','paper'].includes(environment)||!['credentials','snapshot'].includes(kind))bad('INVALID_VAULT_SCOPE');
 return Buffer.from(['jenios-demo-b165',userId,id,provider,environment,kind].join('|'));
}
export function encryptDemo(value,scope,env=process.env){
 const plaintext=Buffer.from(JSON.stringify(value),'utf8');
 if(plaintext.length>140_000)bad('VAULT_PAYLOAD_TOO_LARGE');
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key(env),iv);
 cipher.setAAD(aad(scope));
 const data=Buffer.concat([cipher.update(plaintext),cipher.final()]);
 return Object.freeze({v:1,iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:data.toString('base64')});
}
export function decryptDemo(box,scope,env=process.env){
 if(!box||box.v!==1||typeof box.data!=='string'||box.data.length>190_000||typeof box.iv!=='string'||typeof box.tag!=='string')bad('INVALID_VAULT_ENVELOPE');
 try{
  const iv=Buffer.from(box.iv,'base64'),tag=Buffer.from(box.tag,'base64');
  if(iv.length!==12||tag.length!==16)bad('INVALID_VAULT_ENVELOPE');
  const decipher=createDecipheriv('aes-256-gcm',key(env),iv);
  decipher.setAAD(aad(scope));decipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(box.data,'base64')),decipher.final()]).toString('utf8'));
 }catch{bad('VAULT_DECRYPT_DENIED');}
}
/** Account digest cannot be brute-forced from a known account number without the server key. */
export function digestDemoAccount(raw,scope,env=process.env){
 if(typeof raw!=='string'||raw.length<1||raw.length>256)bad('INVALID_EXTERNAL_REFERENCE');
 const {userId,provider,environment}=scope;
 return createHmac('sha256',key(env)).update('jenios-account-reference-v1\0'+userId+'\0'+provider+'\0'+environment+'\0'+raw).digest('hex');
}
