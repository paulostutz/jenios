/** B299: manual OFFLINE, isolated intake. External reads and broker execution prohibited.
 * Only local audit SQLite is written; no credentials/private signing keys consumed.
 * Raw signed packages stay in an owner-only directory outside the repository.
 */
import {lstat,realpath,readFile} from 'node:fs/promises';
import {resolve,dirname,relative,sep} from 'node:path';
import {B299PrivateEvidenceJournal,assessB299ExternalReady}
 from '../../../lib/platform/research/b299-private-consent-replay-journal.mjs';
const fail=code=>{throw Object.assign(new Error(code),{code});};
const env=process.env;
const forbidden=['JENIOS_REAL_EXECUTION_ENABLED','JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED',
 'JENIOS_PRIVATE_PAPER_EXECUTOR'];
if(env.VERCEL||env.VERCEL_ENV||env.JENIOS_B299_PRIVATE_READ_ONLY!=='true'||
 forbidden.some(k=>env[k]==='true'))fail('B299_OFFLINE_READ_ONLY_REQUIRED');
const allowedId=x=>typeof x==='string'&&/^[A-Za-z0-9._:-]{1,80}$/.test(x);
const digest=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const scope={ownerDigest:env.JENIOS_B299_OWNER_DIGEST,
 accountDigest:env.JENIOS_B299_ACCOUNT_DIGEST,
 consentDigest:env.JENIOS_B299_CONSENT_DIGEST};
if(!Object.values(scope).every(digest)||
 !allowedId(env.JENIOS_B299_CONSENT_KEY_ID)||
 !allowedId(env.JENIOS_B299_COLLECTOR_KEY_ID))fail('B299_CONFIG_SCOPE_REQUIRED');
const root=await realpath(process.cwd());
async function privateFile(path,ext,maxSize){
 if(typeof path!=='string'||!path.startsWith('/')||!path.endsWith(ext)||
  path.includes('\0')||path.length>2048)fail('B299_PRIVATE_INPUT_PATH_REQUIRED');
 const p=resolve(path),rel=relative(root,p);
 if(rel===''||!(rel==='..'||rel.startsWith('..'+sep)))
  fail('B299_PRIVATE_INPUT_INSIDE_REPOSITORY');
 const dir=dirname(p),[file,parent,actual,actualDir]=await Promise.all([
  lstat(p),lstat(dir),realpath(p),realpath(dir)]);
 if(!file.isFile()||file.nlink!==1||file.size<1||file.size>maxSize||
  (file.mode&0o077)!==0||
  (typeof process.getuid==='function'&&file.uid!==process.getuid())||
  !parent.isDirectory()||(parent.mode&0o077)!==0||
  (typeof process.getuid==='function'&&parent.uid!==process.getuid())||
  actual!==p||actualDir!==dir)fail('B299_PRIVATE_INPUT_PERMISSIONS_UNSAFE');
 return readFile(p,'utf8');
}
let packet;
try{packet=JSON.parse(await privateFile(env.JENIOS_B299_PACKET_PATH,'.json',524288));}
catch(e){fail(e?.code?.startsWith('B299_')?e.code:'B299_PACKET_NOT_READABLE');}
if(!packet||typeof packet!=='object'||Array.isArray(packet)||
 Object.keys(packet).some(k=>!['schema','signedConsent','signedEvidence','signedRevocation'].includes(k))||
 packet.schema!=='JENIOS_B299_PRIVATE_OFFLINE_PACKET_V1'||
 !Array.isArray(packet.signedEvidence)||packet.signedEvidence.length>100||
 (!packet.signedEvidence.length&&!packet.signedRevocation))
 fail('B299_OFFLINE_PACKET_INVALID');
const [authorityKey,collectorKey]=await Promise.all([
 privateFile(env.JENIOS_B299_CONSENT_KEY_FILE,'.pem',4096),
 privateFile(env.JENIOS_B299_COLLECTOR_KEY_FILE,'.pem',4096)
]);
if(!authorityKey.includes('BEGIN PUBLIC KEY')||!collectorKey.includes('BEGIN PUBLIC KEY'))
 fail('B299_PUBLIC_KEYS_REQUIRED');
const options={signedConsent:packet.signedConsent,scope,
 trustedConsentKeys:{[env.JENIOS_B299_CONSENT_KEY_ID]:authorityKey},
 trustedCollectorKeys:{[env.JENIOS_B299_COLLECTOR_KEY_ID]:collectorKey},
 nowMs:Date.now()};
let db;
try{
 db=new B299PrivateEvidenceJournal(env.JENIOS_B299_AUDIT_DB,
  {auditKeyBase64:env.JENIOS_B299_AUDIT_KEY_B64,repositoryRoot:root});
 let revocationStored=false;
 if(packet.signedRevocation){
  db.revoke({...options,signedRevocation:packet.signedRevocation});
  revocationStored=true;
 }
 let recorded=0;const types=Object.create(null);
 for(const signedEvidence of packet.signedEvidence){
  const receipt=db.record({...options,signedEvidence,nowMs:Date.now()});
  recorded++;types[receipt.evidenceKind]=(types[receipt.evidenceKind]||0)+1;
 }
 const state=db.inspect(scope,packet.signedConsent?.payload?.consentId);
 // No raw account IDs, nonce, broker data, keys or signed bodies printed.
 process.stdout.write(JSON.stringify({schema:'JENIOS_B299_PRIVATE_OFFLINE_INTAKE_REPORT_V1',
  recordedEvidenceCount:recorded,observedEventKinds:types,
  locallyRevoked:state.locallyRevoked,revocationStored,
  durableReplayProtection:true,externalReadPerformed:false,
  originalEngineLoaded:false,brokerOrdersSent:0,paperOrdersSent:0,
  external:assessB299ExternalReady()},null,2)+'\n');
}finally{db?.close();}