/**
 * B299 — isolated off-repository consent and anti-replay journal for B298 exports.
 * Collector signatures + configured consent signer prove integrity, NOT ownership,
 * independently verified consent, broker attestation, notification delivery or P&L.
 * The sole mutation is a LOCAL owner-only SQLite audit journal. No broker/API calls,
 * no order or paper transmission, no risk-ledger changes and no core engine changes.
 */
import {createHash,createHmac,createPublicKey,verify as verifySignature} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {openSync,closeSync,lstatSync,realpathSync,constants} from 'node:fs';
import {resolve,dirname,parse,relative,sep} from 'node:path';
import {canonical} from '../pilot-prep/contracts.mjs';
import {inspectB298SignedReadEnvelope,B298_KINDS} from './b298-signed-evidence-audit.mjs';
const fail=code=>{throw Object.assign(new Error(code),{code});};
const HEX=/^[a-f0-9]{64}$/;
const ID=/^[A-Za-z0-9._:-]{1,80}$/;
const POSITIVE_TIME=x=>Number.isSafeInteger(x)&&x>0;
const CONSENT_FIELDS=['schema','consentId','ownerDigest','accountDigest','consentDigest',
 'collectorKeyId','consentKeyId','allowedKinds','issuedAtMs','expiresAtMs',
 'readOnly','paperExecutionAllowed','liveExecutionAllowed'];
const REVOKE_FIELDS=['schema','consentId','ownerDigest','accountDigest','consentDigest',
 'consentKeyId','revokedAtMs'];
const exact=(x,keys)=>x&&typeof x==='object'&&!Array.isArray(x)&&
 Object.keys(x).length===keys.length&&Object.keys(x).every(k=>keys.includes(k));
const sha=s=>createHash('sha256').update(s).digest('hex');
const CONSENT_DOMAIN='JENIOS_B299_OWNER_CONSENT_V1\0';
const REVOKE_DOMAIN='JENIOS_B299_CONSENT_REVOCATION_V1\0';
const CONSENT_SCHEMA='JENIOS_B299_SIGNED_READ_CONSENT_V1';
const REVOKE_SCHEMA='JENIOS_B299_SIGNED_CONSENT_REVOCATION_V1';
export const B299_SCHEMAS=Object.freeze({consent:CONSENT_SCHEMA,revocation:REVOKE_SCHEMA});
const signatureBytes=value=>{
 if(typeof value!=='string'||value.length!==88||!/^[-A-Za-z0-9+/]+={0,2}$/.test(value))
  fail('B299_INVALID_SIGNATURE_ENCODING');
 const bytes=Buffer.from(value,'base64');
 if(bytes.length!==64||bytes.toString('base64')!==value)fail('B299_INVALID_SIGNATURE_ENCODING');
 return bytes;
};
function pinnedKey(keys,id){
 if(!keys||typeof keys!=='object'||Array.isArray(keys)||!Object.hasOwn(keys,id))
  fail('B299_CONSENT_TRUST_ROOT_MISSING');
 let key;try{key=createPublicKey(keys[id]);}catch{fail('B299_CONSENT_PUBLIC_KEY_INVALID');}
 if(key.asymmetricKeyType!=='ed25519')fail('B299_CONSENT_SIGNER_MUST_BE_ED25519');
 return key;
}
function authentic(message,keys,keyId,domain){
 if(!exact(message,['payload','signatureBase64']))fail('B299_SIGNATURE_ENVELOPE_INVALID');
 const key=pinnedKey(keys,keyId);
 let ok=false;
 try{ok=verifySignature(null,Buffer.from(domain+canonical(message.payload),'utf8'),
  key,signatureBytes(message.signatureBase64));}catch{fail('B299_SIGNATURE_VERIFICATION_FAILED');}
 if(!ok)fail('B299_SIGNATURE_VERIFICATION_FAILED');
 return key;
}
function validScope(scope){
 if(!exact(scope,['ownerDigest','accountDigest','consentDigest'])||
  !Object.values(scope).every(x=>typeof x==='string'&&HEX.test(x)))
  fail('B299_CONSENT_SCOPE_INVALID');
}
function consentPayload(signedConsent,scope,{nowMs,allowExpired=false}={}){
 validScope(scope);
 if(!POSITIVE_TIME(nowMs)||!exact(signedConsent,['payload','signatureBase64'])||
  !exact(signedConsent.payload,CONSENT_FIELDS))fail('B299_CONSENT_INVALID');
 const p=signedConsent.payload;
 if(p.schema!==CONSENT_SCHEMA||!ID.test(p.consentId)||!ID.test(p.collectorKeyId)||
  !ID.test(p.consentKeyId)||p.ownerDigest!==scope.ownerDigest||
  p.accountDigest!==scope.accountDigest||p.consentDigest!==scope.consentDigest||
  p.readOnly!==true||p.paperExecutionAllowed!==false||p.liveExecutionAllowed!==false||
  !Array.isArray(p.allowedKinds)||p.allowedKinds.length<1||
  p.allowedKinds.length>B298_KINDS.length||
  p.allowedKinds.some(k=>!B298_KINDS.includes(k))||
  new Set(p.allowedKinds).size!==p.allowedKinds.length||
  !POSITIVE_TIME(p.issuedAtMs)||!POSITIVE_TIME(p.expiresAtMs)||
  p.issuedAtMs>nowMs||p.expiresAtMs<=p.issuedAtMs||
  p.expiresAtMs-p.issuedAtMs>86400000||
  (!allowExpired&&nowMs>=p.expiresAtMs))fail('B299_CONSENT_INACTIVE_OR_INVALID');
 return p;
}
export function verifyB299OfflineConsent({signedConsent,trustedConsentKeys,scope,
 trustedCollectorKeys,nowMs=Date.now()}={}){
 const p=consentPayload(signedConsent,scope,{nowMs});
 const consentKey=authentic(signedConsent,trustedConsentKeys,p.consentKeyId,CONSENT_DOMAIN);
 if(!trustedCollectorKeys||!Object.hasOwn(trustedCollectorKeys,p.collectorKeyId))
  fail('B299_COLLECTOR_KEY_UNTRUSTED');
 let collectorKey;try{collectorKey=createPublicKey(trustedCollectorKeys[p.collectorKeyId]);}
 catch{fail('B299_COLLECTOR_KEY_UNTRUSTED');}
 if(collectorKey.asymmetricKeyType!=='ed25519'||
  collectorKey.export({format:'der',type:'spki'}).equals(consentKey.export({format:'der',type:'spki'})))
  fail('B299_CONSENT_AND_COLLECTOR_KEYS_MUST_DIFFER');
 return Object.freeze({schema:'JENIOS_B299_VERIFIED_CONSENT_CONTRACT_V1',
  consentDigestSha256:sha(CONSENT_DOMAIN+canonical(p)),
  consentId:p.consentId,allowedKinds:Object.freeze([...p.allowedKinds]),
  issuedAtMs:p.issuedAtMs,expiresAtMs:p.expiresAtMs,collectorKeyId:p.collectorKeyId,
  configuredConsentSignerSignatureVerified:true,configuredCollectorKeyPinned:true,
  independentCustomerIdentityVerified:false,independentConsentAuthorityVerified:false,
  brokerApiPermissionVerified:false,realOrderAuthorizationVerified:false,
  realExecutionAuthorized:false,paperExecutionAuthorized:false,ordersSent:0,paperOrdersSent:0});
}
function verifyRevocation({signedConsent,signedRevocation,trustedConsentKeys,scope,nowMs}){
 const consent=consentPayload(signedConsent,scope,{nowMs,allowExpired:true});
 authentic(signedConsent,trustedConsentKeys,consent.consentKeyId,CONSENT_DOMAIN);
 if(!exact(signedRevocation,['payload','signatureBase64'])||
  !exact(signedRevocation.payload,REVOKE_FIELDS))fail('B299_REVOCATION_INVALID');
 const p=signedRevocation.payload;
 if(p.schema!==REVOKE_SCHEMA||p.consentId!==consent.consentId||
  p.ownerDigest!==scope.ownerDigest||p.accountDigest!==scope.accountDigest||
  p.consentDigest!==scope.consentDigest||p.consentKeyId!==consent.consentKeyId||
  !POSITIVE_TIME(p.revokedAtMs)||p.revokedAtMs<consent.issuedAtMs||
  p.revokedAtMs>nowMs)fail('B299_REVOCATION_SCOPE_OR_TIME_INVALID');
 authentic(signedRevocation,trustedConsentKeys,p.consentKeyId,REVOKE_DOMAIN);
 return p;
}
function auditKey(value){
 if(typeof value!=='string'||!/^[A-Za-z0-9+/]{43}=$/.test(value))fail('B299_PRIVATE_AUDIT_KEY_REQUIRED');
 const b=Buffer.from(value,'base64');
 if(b.length!==32||b.toString('base64')!==value)fail('B299_PRIVATE_AUDIT_KEY_REQUIRED');
 return b;
}
function privateDbFile(path,repositoryRoot){
 if(typeof path!=='string'||!path.startsWith('/')||path.includes('\0')||
  !path.endsWith('.sqlite')||path.length>2048||typeof repositoryRoot!=='string')
  fail('B299_ABSOLUTE_PRIVATE_JOURNAL_REQUIRED');
 const p=resolve(path),repo=realpathSync(repositoryRoot);
 const rel=relative(repo,p);
 if(rel===''||!(rel==='..'||rel.startsWith('..'+sep)))
  fail('B299_AUDIT_JOURNAL_IN_REPOSITORY');
 const parent=dirname(p);
 let dir;try{dir=lstatSync(parent);}catch{fail('B299_PRIVATE_DIRECTORY_MISSING');}
 if(!dir.isDirectory()||(dir.mode&0o077)!==0||
  (typeof process.getuid==='function'&&dir.uid!==process.getuid())||
  realpathSync(parent)!==parent)fail('B299_UNSAFE_PRIVATE_DIRECTORY');
 let cursor=dirname(parent);let steps=0;
 while(true){
  if(++steps>100)fail('B299_PATH_DEPTH_INVALID');
  let check;try{check=lstatSync(cursor);}catch{fail('B299_UNSAFE_PATH_ANCESTOR');}
  if(!check.isDirectory()||
   ((check.mode&0o022)!==0&&!(check.uid===0&&(check.mode&0o1000)!==0)))
   fail('B299_UNSAFE_PATH_ANCESTOR');
  if(cursor===parse(cursor).root)break;cursor=dirname(cursor);
 }
 const fd=openSync(p,constants.O_RDWR|constants.O_CREAT|constants.O_NOFOLLOW,0o600);
 closeSync(fd);
 const file=lstatSync(p);
 if(!file.isFile()||file.nlink!==1||(file.mode&0o077)!==0||
  (typeof process.getuid==='function'&&file.uid!==process.getuid()))
  fail('B299_UNSAFE_JOURNAL_FILE');
 return p;
}
/** Durable replay protection for one isolated private runner only. */
export class B299PrivateEvidenceJournal{
 #db;#key;
 constructor(path,{auditKeyBase64,repositoryRoot=process.cwd()}={}){
  this.#key=auditKey(auditKeyBase64);
  const file=privateDbFile(path,repositoryRoot);
  this.#db=new DatabaseSync(file);
  this.#db.exec(`PRAGMA busy_timeout=5000;PRAGMA journal_mode=WAL;PRAGMA synchronous=FULL;
   CREATE TABLE IF NOT EXISTS events(
     scope_hash TEXT NOT NULL,nonce_hash TEXT NOT NULL UNIQUE,evidence_hash TEXT NOT NULL UNIQUE,
     event_kind TEXT NOT NULL,stored_at_ms INTEGER NOT NULL,
     PRIMARY KEY(scope_hash,nonce_hash));
   CREATE TABLE IF NOT EXISTS revocations(
     scope_hash TEXT PRIMARY KEY,revoked_at_ms INTEGER NOT NULL,
     stored_at_ms INTEGER NOT NULL);`);
 }
 #hash(parts){return createHmac('sha256',this.#key).update(JSON.stringify(parts)).digest('hex');}
 #scope(scope,consentId){validScope(scope);if(!ID.test(consentId))fail('B299_CONSENT_ID_INVALID');
  return this.#hash(['JENIOS_B299_JOURNAL_SCOPE',scope.ownerDigest,scope.accountDigest,
   scope.consentDigest,consentId]);}
 #transaction(fn){this.#db.exec('BEGIN IMMEDIATE');try{const x=fn();this.#db.exec('COMMIT');return x;}
  catch(e){this.#db.exec('ROLLBACK');throw e;}}
 record({signedConsent,signedEvidence,trustedConsentKeys,trustedCollectorKeys,
  scope,nowMs=Date.now()}={}){
  const authorization=verifyB299OfflineConsent({signedConsent,trustedConsentKeys,
   trustedCollectorKeys,scope,nowMs});
  const evidence=inspectB298SignedReadEnvelope(signedEvidence,
   {scope,trustedKeys:trustedCollectorKeys,nowMs});
  const p=signedEvidence.payload;
  if(!authorization.allowedKinds.includes(evidence.kind)||
   p.keyId!==authorization.collectorKeyId||
   p.capturedAtMs<authorization.issuedAtMs||
   p.capturedAtMs>=authorization.expiresAtMs)
   fail('B299_EVENT_NOT_COVERED_BY_CONSENT');
  const scopeHash=this.#scope(scope,authorization.consentId);
  const shared=[scope.ownerDigest,scope.accountDigest,scope.consentDigest];
  const nonceHash=this.#hash(['nonce-global',...shared,p.keyId,p.nonce]);
  const evidenceHash=this.#hash(['evidence-global',...shared,evidence.evidenceDigestSha256]);
  const receipt=this.#transaction(()=>{
   if(this.#db.prepare('SELECT 1 FROM revocations WHERE scope_hash=?').get(scopeHash))
    fail('B299_CONSENT_REVOKED');
   if(this.#db.prepare('SELECT 1 FROM events WHERE nonce_hash=? OR evidence_hash=?')
    .get(nonceHash,evidenceHash))fail('B299_DUPLICATE_OR_REPLAYED_EVIDENCE');
   this.#db.prepare(`INSERT INTO events(scope_hash,nonce_hash,evidence_hash,event_kind,stored_at_ms)
    VALUES(?,?,?,?,?)`).run(scopeHash,nonceHash,evidenceHash,evidence.kind,nowMs);
   return this.#hash(['receipt',scopeHash,nonceHash,evidenceHash,nowMs]);
  });
  return Object.freeze({schema:'JENIOS_B299_PRIVATE_EVIDENCE_RECEIPT_V1',
   journalReceiptDigestSha256:receipt,evidenceKind:evidence.kind,
   configuredConsentSignerVerified:true,configuredCollectorSignatureVerified:true,
   durableReplayJournalRecorded:true,ownerIdentityIndependentlyVerified:false,
   collectorHostIndependentlyAttested:false,brokerProviderReceiptVerified:false,
   providerSignalDeliveryIndependentlyConfirmed:false,
   consentRevocationCheckedLocally:true,realizedPnlVerified:false,
   brokerOrderOrPaperSubmitted:false,ordersSent:0,paperOrdersSent:0,
   externalConnectionCertified:false,commercialClaimsAllowed:false});
 }
 revoke({signedConsent,signedRevocation,trustedConsentKeys,scope,nowMs=Date.now()}={}){
  const revocation=verifyRevocation({signedConsent,signedRevocation,trustedConsentKeys,scope,nowMs});
  const scopeHash=this.#scope(scope,revocation.consentId);
  return this.#transaction(()=>{
   if(this.#db.prepare('SELECT 1 FROM revocations WHERE scope_hash=?').get(scopeHash))
    fail('B299_DUPLICATE_REVOCATION');
   this.#db.prepare('INSERT INTO revocations(scope_hash,revoked_at_ms,stored_at_ms) VALUES(?,?,?)')
    .run(scopeHash,revocation.revokedAtMs,nowMs);
   return Object.freeze({schema:'JENIOS_B299_PRIVATE_CONSENT_REVOCATION_V1',
    localRevocationRecorded:true,signerVerified:true,
    brokerPermissionRevokedExternally:false,brokerAccountModified:false,
    ordersSent:0,paperOrdersSent:0,commercialLaunchAllowed:false});
  });
 }
 inspect(scope,consentId){
  const digest=this.#scope(scope,consentId);
  const count=this.#db.prepare('SELECT COUNT(*) AS n FROM events WHERE scope_hash=?').get(digest).n;
  const revoked=!!this.#db.prepare('SELECT 1 FROM revocations WHERE scope_hash=?').get(digest);
  return Object.freeze({schema:'JENIOS_B299_PRIVATE_JOURNAL_STATE_V1',
   recordedEvidenceCount:count,locallyRevoked:revoked,externalAuthorityAudited:false,
   actualBrokerOrdersVerified:false,ordersSent:0,paperOrdersSent:0});
 }
 close(){this.#db.close();}
}
export function assessB299ExternalReady(){
 return Object.freeze({schema:'JENIOS_B299_EXTERNAL_CERTIFICATION_GATE_V1',
  localConsentSignatureContract:true,localDurableAntiReplayContract:true,
  independentAccountOwnerVerification:false,independentPermissionAttestation:false,
  providerOriginVerified:false,consentAuthorityIndependentlyVerified:false,
  externalBrokerReadExecutedByModule:false,independentNotificationDeliveryVerified:false,
  actualRealizedPnlVerified:false,lossometerRealSavingsVerified:false,
  realExecutionPermitted:false,paperExecutionPermitted:false,
  productionDeployPermitted:false,commercialClaimsPermitted:false,
  ordersSent:0,paperOrdersSent:0,status:'NO_GO_EXTERNAL_AUTHENTICITY_UNVERIFIED'});
}