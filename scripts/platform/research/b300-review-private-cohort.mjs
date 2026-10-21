/** B300 private, off-repository, single-shot offline report. No API or executions. */
import {open,realpath,lstat} from 'node:fs/promises';
import {constants} from 'node:fs';
import {resolve,dirname,sep} from 'node:path';
import {auditB300ReadOnlyCohort} from '../../../lib/platform/research/b300-evidence-reconciliation-gate.mjs';
const fail=code=>{throw Object.assign(new Error(code),{code});};
const env=process.env;
if(env.VERCEL||env.VERCEL_ENV||env.JENIOS_B300_PRIVATE_READ_ONLY!=='true'||
 ['JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED','JENIOS_PRIVATE_PAPER_EXECUTOR',
  'JENIOS_REAL_EXECUTION_ENABLED'].some(k=>env[k]==='true'))
 fail('B300_PRIVATE_READONLY_ENV_REQUIRED');
const hex=s=>typeof s==='string'&&/^[0-9a-f]{64}$/.test(s);
const id=s=>typeof s==='string'&&/^[A-Za-z0-9._:-]{1,80}$/.test(s);
const scope={ownerDigest:env.JENIOS_B300_OWNER_DIGEST,
 accountDigest:env.JENIOS_B300_ACCOUNT_DIGEST,
 consentDigest:env.JENIOS_B300_CONSENT_DIGEST};
if(Object.values(scope).some(v=>!hex(v))||!id(env.JENIOS_B300_COLLECTOR_KEY_ID)||
 !id(env.JENIOS_B300_CONSENT_KEY_ID))fail('B300_CONFIGURED_SCOPE_REQUIRED');
const repo=await realpath(resolve(process.cwd()));
async function protectedFile(input,maxBytes,ending){
 if(typeof input!=='string'||input.length>2048||!input.startsWith('/')||
  input.includes('\0')||!input.endsWith(ending))fail('B300_PRIVATE_FILE_PATH_REQUIRED');
 const path=resolve(input),parent=dirname(path);
 if(path===repo||path.startsWith(repo+sep))fail('B300_FILE_IN_PUBLIC_REPOSITORY');
 let st,d,actual;try{[st,d,actual]=await Promise.all([lstat(path),lstat(parent),realpath(path)]);}
 catch{fail('B300_PRIVATE_FILE_NOT_FOUND');}
 if(actual!==path||!st.isFile()||st.nlink!==1||st.size<1||st.size>maxBytes||
   (st.mode&0o077)!==0||!d.isDirectory()||(d.mode&0o077)!==0||
   (typeof process.getuid==='function'&&(st.uid!==process.getuid()||d.uid!==process.getuid()))||
   await realpath(parent)!==parent)fail('B300_PRIVATE_FILE_UNSAFE');
 const fd=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);
 try{
  const opened=await fd.stat();
  if(!opened.isFile()||opened.ino!==st.ino||opened.dev!==st.dev||
   opened.size>maxBytes||(opened.mode&0o077)!==0)fail('B300_PRIVATE_FILE_CHANGED');
  return await fd.readFile({encoding:'utf8'});
 }finally{await fd.close();}
}
const packageRaw=await protectedFile(env.JENIOS_B300_PACKAGE_PATH,524288,'.json');
const consentKey=await protectedFile(env.JENIOS_B300_CONSENT_PUBLIC_KEY_PATH,4096,'.pem');
const collectorKey=await protectedFile(env.JENIOS_B300_COLLECTOR_PUBLIC_KEY_PATH,4096,'.pem');
if(!consentKey.includes('BEGIN PUBLIC KEY')||!collectorKey.includes('BEGIN PUBLIC KEY'))
 fail('B300_PUBLIC_TRUST_ROOT_REQUIRED');
let input;try{input=JSON.parse(packageRaw);}catch{fail('B300_INVALID_PRIVATE_JSON');}
const FIELDS=['schema','signedConsent','b297Capture','orderPairs','positionPairs',
 'deliveryReceipts','operatorIntents','riskChecks','lossometerWhatIf'];
if(!input||typeof input!=='object'||Array.isArray(input)||
 Object.keys(input).some(k=>!FIELDS.includes(k))||
 input.schema!=='JENIOS_B300_PRIVATE_COHORT_V1')fail('B300_PRIVATE_PACKAGE_INVALID');
// Only a lab-only offline fixture may choose a historical clock; live identities
// and market performance remain categorically uncertified even in that case.
let nowMs=Date.now();
if(env.JENIOS_B300_LAB_CLOCK_OVERRIDE!==undefined){
 if(env.JENIOS_B300_FIXTURE_ONLY!=='LAB_SYNTHETIC_FIXTURE_ONLY'||
  !/^\d{13}$/.test(env.JENIOS_B300_LAB_CLOCK_OVERRIDE))
  fail('B300_UNAUTHORIZED_CLOCK_OVERRIDE');
 nowMs=Number(env.JENIOS_B300_LAB_CLOCK_OVERRIDE);
}
// Network is not used by the audit library. Disable global fetch as defense in depth.
globalThis.fetch=async()=>fail('B300_NETWORK_FORBIDDEN');
const {schema,...bundle}=input;
const report=auditB300ReadOnlyCohort({...bundle,scope,
 trustedConsentKeys:{[env.JENIOS_B300_CONSENT_KEY_ID]:consentKey},
 trustedCollectorKeys:{[env.JENIOS_B300_COLLECTOR_KEY_ID]:collectorKey},nowMs});
process.stdout.write(JSON.stringify({...report,
  source:'PRIVATE_OPERATOR_SUPPLIED_OFFLINE_FILES',
  labClockOverridden:env.JENIOS_B300_LAB_CLOCK_OVERRIDE!==undefined,
  rawSourceContentsEmitted:false},null,2)+'\n');