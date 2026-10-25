/** JENIOS B283. Parser derivado do padrão testado no CHEFE CP304.
 * Somente arquivo ZIP em memória; nenhum conteúdo vai para logs ou browser.
 */

import {inflateRawSync} from 'node:zlib';
import {X509Certificate,createPrivateKey} from 'node:crypto';
function crc32(buf){let n=0xffffffff;for(const b of buf){n^=b;for(let i=0;i<8;i++)n=(n>>>1)^((n&1)?0xedb88320:0);}return(n^0xffffffff)>>>0;}
function zipMaterial(base64){
 if(typeof base64!=='string'||base64.length>700000||!/^[A-Za-z0-9+/]*={0,2}$/.test(base64))throw Error('INTER_ZIP_INVALID');
 const b=Buffer.from(base64,'base64');if(b.length<22||b.length>524288)throw Error('INTER_ZIP_INVALID');
 let end=-1;for(let i=b.length-22;i>=Math.max(0,b.length-65557);i--){if(b.readUInt32LE(i)===0x06054b50){end=i;break;}}
 if(end<0||b.readUInt16LE(end+4)||b.readUInt16LE(end+6))throw Error('INTER_ZIP_INVALID');
 const count=b.readUInt16LE(end+10),centralSize=b.readUInt32LE(end+12),centralStart=b.readUInt32LE(end+16),comment=b.readUInt16LE(end+20);
 if(count<1||count>32||count!==b.readUInt16LE(end+8)||end+22+comment!==b.length||centralStart+centralSize!==end)throw Error('INTER_ZIP_INVALID');
 const names=new Set();let p=centralStart,total=0,certificate=null,privateKey=null;
 for(let i=0;i<count;i++){
  if(p+46>end||b.readUInt32LE(p)!==0x02014b50)throw Error('INTER_ZIP_INVALID');
  const flags=b.readUInt16LE(p+8),method=b.readUInt16LE(p+10),crc=b.readUInt32LE(p+16),compressed=b.readUInt32LE(p+20),size=b.readUInt32LE(p+24),nl=b.readUInt16LE(p+28),el=b.readUInt16LE(p+30),cl=b.readUInt16LE(p+32),attrs=b.readUInt32LE(p+38),offset=b.readUInt32LE(p+42);
  if(p+46+nl+el+cl>end||nl<1||nl>250||(flags&1)||![0,8].includes(method)||((attrs>>>16)&0xf000)===0xa000||size>65536||compressed>262144||size>Math.max(1,compressed)*200)throw Error('INTER_ZIP_UNSAFE');
  const name=new TextDecoder('utf-8',{fatal:true}).decode(b.subarray(p+46,p+46+nl));p+=46+nl+el+cl;
  if(name.includes('\\')||name.startsWith('/')||name.includes(':')||name.split('/').some(s=>s==='..'||s==='.')||/[\u0000-\u001f]/.test(name)||names.has(name.toLowerCase()))throw Error('INTER_ZIP_UNSAFE');
  names.add(name.toLowerCase());if(name.endsWith('/')){if(size!==0)throw Error('INTER_ZIP_INVALID');continue;}
  if(!/\.(crt|pem|key|txt|json)$/i.test(name))throw Error('INTER_ZIP_UNSAFE');
  if(offset+30>centralStart||b.readUInt32LE(offset)!==0x04034b50||b.readUInt16LE(offset+8)!==method||b.readUInt16LE(offset+6)!==flags)throw Error('INTER_ZIP_INVALID');
  const ln=b.readUInt16LE(offset+26),le=b.readUInt16LE(offset+28);const start=offset+30+ln+le;
  if(start+compressed>centralStart||b.subarray(offset+30,offset+30+ln).toString('utf8')!==name)throw Error('INTER_ZIP_INVALID');
  total+=size;if(total>262144)throw Error('INTER_ZIP_TOO_LARGE');
  const raw=method===0?b.subarray(start,start+compressed):inflateRawSync(b.subarray(start,start+compressed),{maxOutputLength:65536});
  if(raw.length!==size||crc32(raw)!==crc)throw Error('INTER_ZIP_INVALID');
  if(/\.(crt|pem|key)$/i.test(name)){
   const text=new TextDecoder('utf-8',{fatal:true}).decode(raw);
   if(text.includes('-----BEGIN CERTIFICATE-----')){if(certificate)throw Error('INTER_CERTIFICATE_AMBIGUOUS');certificate=text;}
   else if(/-----BEGIN (RSA |EC )?PRIVATE KEY-----/.test(text)){if(privateKey)throw Error('INTER_KEY_AMBIGUOUS');privateKey=text;}
   else throw Error('INTER_PEM_INVALID');
  }
 }
 if(p!==end||!certificate||!privateKey)throw Error('INTER_CERTIFICATE_AND_KEY_REQUIRED');
 return {certificate,privateKey};
}
function validateMaterial(certificate,privateKey,now=Date.now()){
 if(typeof certificate!=='string'||typeof privateKey!=='string'||certificate.length>32768||privateKey.length>32768||certificate.includes('PRIVATE KEY'))throw Error('INTER_PEM_INVALID');
 try{
  const cert=new X509Certificate(certificate),key=createPrivateKey(privateKey);
  if(!cert.checkPrivateKey(key))throw Error('INTER_KEY_MISMATCH');
  if(Date.parse(cert.validFrom)>now||Date.parse(cert.validTo)<=now)throw Error('INTER_CERTIFICATE_EXPIRED');
  return {expires_at:new Date(cert.validTo).toISOString(),fingerprint:cert.fingerprint256};
 }catch(e){if(['INTER_KEY_MISMATCH','INTER_CERTIFICATE_EXPIRED'].includes(e?.message))throw e;throw Error('INTER_PEM_INVALID');}
}
export {zipMaterial,validateMaterial,crc32};
