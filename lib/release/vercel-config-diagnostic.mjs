import {openSync,closeSync,fstatSync,readSync,constants} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
const LIMIT=65536;
function readConfig(){
 const fd=openSync('vercel.json',constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
 try{
  const stat=fstatSync(fd);if(!stat.isFile())return {byteLength:stat.size,limited:true};
  if(stat.size>LIMIT)return {byteLength:stat.size,limited:true};
  const bytes=Buffer.alloc(LIMIT+1);let n=0,r;
  while(n<bytes.length&&(r=readSync(fd,bytes,n,bytes.length-n,null))>0)n+=r;
  return n>LIMIT?{byteLength:n,limited:true}:bytes.subarray(0,n);
 }finally{closeSync(fd);}
}
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
// Diagnostic only: never authorizes a dirty file. Values from unknown config are never logged.
export function inspectVercelConfig({readCurrent=readConfig,readSource=()=>execFileSync('git',['show','HEAD:vercel.json'],{maxBuffer:LIMIT+1})}={}){
 try{
  const bytes=readCurrent();if(!Buffer.isBuffer(bytes))return {byteLength:bytes.byteLength,sha256:null,limited:true,semanticEqualToGit:false};
  const result={byteLength:bytes.length,sha256:sha(bytes),keys:[],semanticEqualToGit:false};
  if(bytes.length>LIMIT)return {...result,limited:true};
  let current;try{current=JSON.parse(bytes.toString('utf8'));}catch{return {...result,jsonValid:false};}
  const keys=current&&typeof current==='object'&&!Array.isArray(current)?Object.keys(current):[];
  result.keys=keys.slice(0,20).map(key=>key.replace(/[^A-Za-z0-9_$.-]/g,'_').slice(0,60));result.keyCount=keys.length;result.jsonValid=true;
  try{const source=readSource();result.sourceByteLength=source.length;result.sourceSha256=sha(source);result.semanticEqualToGit=isDeepStrictEqual(current,JSON.parse(source.toString('utf8')));}catch{result.sourceUnavailable=true;}
  const text=bytes.toString('utf8');
  // Strict lexical form prevents duplicate keys or escaped hidden values from leaking.
  if(bytes.length<=4096&&keys.length===1&&keys[0]==='$schema'&&current.$schema==='https://openapi.vercel.sh/vercel.json'&&/^[ \t\r\n]*\{[ \t\r\n]*"\$schema"[ \t\r\n]*:[ \t\r\n]*"https:\/\/openapi\.vercel\.sh\/vercel\.json"[ \t\r\n]*\}[ \t\r\n]*$/.test(text))result.knownSafeOriginalUtf8=text;
  return result;
 }catch{return {unavailable:true,semanticEqualToGit:false};}
}
