import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign,randomBytes} from 'node:crypto';
import {mkdtempSync,chmodSync,writeFileSync,rmSync,symlinkSync} from 'node:fs';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const REPO_ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {canonical} from '../lib/platform/pilot-prep/contracts.mjs';
import {B299PrivateEvidenceJournal,verifyB299OfflineConsent,
 assessB299ExternalReady,B299_SCHEMAS} from '../lib/platform/research/b299-private-consent-replay-journal.mjs';
const T=Date.parse('2026-10-21T21:30:00Z');
const collector=generateKeyPairSync('ed25519');
const authority=generateKeyPairSync('ed25519');
const other=generateKeyPairSync('ed25519');
const keyPem=k=>k.publicKey.export({format:'pem',type:'spki'});
const trustedConsentKeys={'consent-v1':keyPem(authority)};
const trustedCollectorKeys={'collector-v1':keyPem(collector)};
const scope={ownerDigest:'a'.repeat(64),accountDigest:'b'.repeat(64),consentDigest:'c'.repeat(64)};
const key=randomBytes(32).toString('base64');
const signObject=(payload,privateKey,domain)=>({payload,signatureBase64:sign(null,
 Buffer.from(domain+canonical(payload),'utf8'),privateKey).toString('base64')});
let idx=0;
const consent=(overrides={})=>signObject({
 schema:B299_SCHEMAS.consent,consentId:'consent-001',...scope,
 collectorKeyId:'collector-v1',consentKeyId:'consent-v1',
 allowedKinds:['POSITION_GET','OPERATOR_INTENT'],issuedAtMs:T-10000,expiresAtMs:T+60000,
 readOnly:true,paperExecutionAllowed:false,liveExecutionAllowed:false,...overrides
},authority.privateKey,'JENIOS_B299_OWNER_CONSENT_V1\0');
const position=(overrides={},eventOverrides={})=>{
 idx++;
 const at=T-3000+idx;
 const payload={schema:'JENIOS_B298_READONLY_EVIDENCE_V1',kind:'POSITION_GET',
  keyId:'collector-v1',nonce:`evidence-${idx}`,...scope,provider:'alpaca',
  environment:'paper',capturedAtMs:at,expiresAtMs:T+20000,
  readOnly:true,executionTransportEnabled:false,ordersSent:0,paperOrdersSent:0,
  event:{kind:'POSITION_GET',symbol:'BTCUSD',side:'flat',quantity:'0',observedAtMs:at,...eventOverrides},
  ...overrides};
 return signObject(payload,collector.privateKey,'JENIOS_B298_READONLY_EVIDENCE_V1\0');
};
const operator=()=>{
 idx++;const at=T-3000+idx;
 const payload={schema:'JENIOS_B298_READONLY_EVIDENCE_V1',kind:'OPERATOR_INTENT',
  keyId:'collector-v1',nonce:`intent-${idx}`,...scope,provider:'customer-event-export',
  environment:'isolated',capturedAtMs:at,expiresAtMs:T+20000,
  readOnly:true,executionTransportEnabled:false,ordersSent:0,paperOrdersSent:0,
  event:{kind:'OPERATOR_INTENT',eventId:`evt-${idx}`,referenceId:'ref-x',
   commercialMode:'reverse',action:'open',side:'buy',observedAtMs:at}};
 return signObject(payload,collector.privateKey,'JENIOS_B298_READONLY_EVIDENCE_V1\0');
};
const revocation=(overrides={})=>signObject({schema:B299_SCHEMAS.revocation,
 consentId:'consent-001',...scope,consentKeyId:'consent-v1',
 revokedAtMs:T-1000,...overrides},authority.privateKey,
 'JENIOS_B299_CONSENT_REVOCATION_V1\0');
const proof={scope,trustedConsentKeys,trustedCollectorKeys,nowMs:T};
const withJournal=fn=>{
 const dir=mkdtempSync(join(tmpdir(),'jenios-b299-journal-'));chmodSync(dir,0o700);
 const path=join(dir,'audit.sqlite');
 try{return fn({dir,path});}finally{rmSync(dir,{recursive:true,force:true});}
};
const journal=(path,extra={})=>new B299PrivateEvidenceJournal(path,
 {auditKeyBase64:key,repositoryRoot:REPO_ROOT,...extra});

test('B299 consent signature verified yet never certifies external customer identity',()=>{
 const x=verifyB299OfflineConsent({signedConsent:consent(),...proof});
 assert.equal(x.configuredConsentSignerSignatureVerified,true);
 assert.equal(x.independentConsentAuthorityVerified,false);
 assert.equal(x.independentCustomerIdentityVerified,false);
 assert.equal(x.realExecutionAuthorized,false);
 assert.deepEqual(x.allowedKinds,['POSITION_GET','OPERATOR_INTENT']);
});
test('B299 single signed B298 collector export enters owner-only durable local journal',()=>withJournal(({path})=>{
 const db=journal(path);
 try{const x=db.record({signedConsent:consent(),signedEvidence:position(),...proof});
  assert.equal(x.durableReplayJournalRecorded,true);assert.equal(x.configuredCollectorSignatureVerified,true);
  assert.equal(x.brokerProviderReceiptVerified,false);assert.equal(x.externalConnectionCertified,false);
  assert.equal(x.ordersSent,0);assert.equal(x.paperOrdersSent,0);
  assert.deepEqual(db.inspect(scope,'consent-001').recordedEvidenceCount,1);
 }finally{db.close();}
}));
test('B299 duplicate signed export rejected within process',()=>withJournal(({path})=>{
 const db=journal(path),a=position();try{
  db.record({signedConsent:consent(),signedEvidence:a,...proof});
  assert.throws(()=>db.record({signedConsent:consent(),signedEvidence:a,...proof}),/B299_DUPLICATE_OR_REPLAYED_EVIDENCE/);
  assert.equal(db.inspect(scope,'consent-001').recordedEvidenceCount,1);
 }finally{db.close();}
}));
test('B299 anti-replay survives close and SQLite reopen',()=>withJournal(({path})=>{
 const a=position();let db=journal(path);
 db.record({signedConsent:consent(),signedEvidence:a,...proof});db.close();
 db=journal(path);
 try{assert.throws(()=>db.record({signedConsent:consent(),signedEvidence:a,...proof}),/B299_DUPLICATE_OR_REPLAYED_EVIDENCE/);
 assert.equal(db.inspect(scope,'consent-001').recordedEvidenceCount,1);}finally{db.close();}
}));
test('B299 reused nonce with newly signed body is rejected',()=>withJournal(({path})=>{
 const db=journal(path),a=position(),p=position();
 const renamed=signObject({...p.payload,nonce:a.payload.nonce},collector.privateKey,
  'JENIOS_B298_READONLY_EVIDENCE_V1\0');
 try{db.record({signedConsent:consent(),signedEvidence:a,...proof});
  assert.throws(()=>db.record({signedConsent:consent(),signedEvidence:renamed,...proof}),/B299_DUPLICATE_OR_REPLAYED_EVIDENCE/);
 }finally{db.close();}
}));
test('B299 distinct authorized events are journaled without rewriting B152',()=>withJournal(({path})=>{
 const db=journal(path);try{
 const one=db.record({signedConsent:consent(),signedEvidence:position(),...proof});
 const two=db.record({signedConsent:consent(),signedEvidence:operator(),...proof});
 assert.notEqual(one.journalReceiptDigestSha256,two.journalReceiptDigestSha256);
 assert.equal(db.inspect(scope,'consent-001').recordedEvidenceCount,2);
 }finally{db.close();}
}));
test('B299 replay cannot be bypassed by replacing consent ID with same scope digest',()=>withJournal(({path})=>{
 const db=journal(path),a=position();
 try{
  db.record({signedConsent:consent(),signedEvidence:a,...proof});
  assert.throws(()=>db.record({signedConsent:consent({consentId:'consent-002'}),
   signedEvidence:a,...proof}),/B299_DUPLICATE_OR_REPLAYED_EVIDENCE/);
 }finally{db.close();}
}));
test('B299 invalid collector signature fails before journal write',()=>withJournal(({path})=>{
 const db=journal(path),a=position();
 try{assert.throws(()=>db.record({signedConsent:consent(),signedEvidence:{...a,payload:{...a.payload,nonce:'tampered'}},...proof}),/B298_INVALID_EVIDENCE_SIGNATURE/);
 assert.equal(db.inspect(scope,'consent-001').recordedEvidenceCount,0);}finally{db.close();}
}));
test('B299 wrong account, owner and consent all fail closed',()=>{
 for(const key of Object.keys(scope)){
  const bad={...scope,[key]:'d'.repeat(64)};
  assert.throws(()=>verifyB299OfflineConsent({signedConsent:consent(),trustedConsentKeys,
   trustedCollectorKeys,scope:bad,nowMs:T}),/B299_CONSENT_INACTIVE_OR_INVALID/);
 }
});
test('B299 consent expiry, future issuance and overlong duration refused',()=>{
 for(const c of [consent({expiresAtMs:T}),consent({issuedAtMs:T+1}),
  consent({expiresAtMs:T+86400001}),consent({expiresAtMs:T-1})])
 assert.throws(()=>verifyB299OfflineConsent({signedConsent:c,...proof}),/B299_CONSENT_INACTIVE_OR_INVALID/);
});
test('B299 forged signer, wrong pinned key or changed grant fields rejected',()=>{
 const c=consent(),forged=signObject(c.payload,other.privateKey,'JENIOS_B299_OWNER_CONSENT_V1\0');
 assert.throws(()=>verifyB299OfflineConsent({signedConsent:forged,...proof}),/B299_SIGNATURE_VERIFICATION_FAILED/);
 assert.throws(()=>verifyB299OfflineConsent({signedConsent:c,...proof,trustedConsentKeys:{'consent-v1':keyPem(other)}}),/B299_SIGNATURE_VERIFICATION_FAILED/);
 assert.throws(()=>verifyB299OfflineConsent({signedConsent:{...c,payload:{...c.payload,liveExecutionAllowed:true}},...proof}),/B299_CONSENT_INACTIVE_OR_INVALID/);
});
test('B299 collector and consent same key material never pass',()=>{
 const c=consent({collectorKeyId:'same'});
 assert.throws(()=>verifyB299OfflineConsent({signedConsent:c,...proof,
  trustedCollectorKeys:{same:keyPem(authority)}}),/B299_CONSENT_AND_COLLECTOR_KEYS_MUST_DIFFER/);
});
test('B299 unpinned collector is rejected before any journal',()=>{
 assert.throws(()=>verifyB299OfflineConsent({signedConsent:consent(),...proof,
  trustedCollectorKeys:{}}),/B299_COLLECTOR_KEY_UNTRUSTED/);
});
test('B299 unexpected fields, repeated kinds, forbidden execution claims rejected',()=>{
 for(const c of [
  consent({authorization:'live'}),consent({allowedKinds:['POSITION_GET','POSITION_GET']}),
  consent({allowedKinds:['ORDER_SUBMIT']}),consent({paperExecutionAllowed:true}),
  consent({readOnly:false})])
 assert.throws(()=>verifyB299OfflineConsent({signedConsent:c,...proof}),/B299_CONSENT_(?:INACTIVE_OR_INVALID|INVALID)/);
});
test('B299 event cannot predate consent issuance',()=>withJournal(({path})=>{
 const db=journal(path),a=position();
 try{const c=consent({issuedAtMs:a.payload.capturedAtMs+1});
  assert.throws(()=>db.record({signedConsent:c,signedEvidence:a,...proof}),/B299_EVENT_NOT_COVERED_BY_CONSENT/);
 }finally{db.close();}
}));
test('B299 unauthorized event kind denied by signed allowedKinds',()=>withJournal(({path})=>{
 const db=journal(path);
 try{const c=consent({allowedKinds:['POSITION_GET']});
 assert.throws(()=>db.record({signedConsent:c,signedEvidence:operator(),...proof}),/B299_EVENT_NOT_COVERED_BY_CONSENT/);
 }finally{db.close();}
}));
test('B299 revocation signed by configured authority blocks all future evidence',()=>withJournal(({path})=>{
 const db=journal(path),c=consent();
 try{db.record({signedConsent:c,signedEvidence:position(),...proof});
 const revoked=db.revoke({signedConsent:c,signedRevocation:revocation(),...proof});
 assert.equal(revoked.localRevocationRecorded,true);
 assert.equal(revoked.brokerPermissionRevokedExternally,false);
 assert.equal(db.inspect(scope,'consent-001').locallyRevoked,true);
 assert.throws(()=>db.record({signedConsent:c,signedEvidence:position(),...proof}),/B299_CONSENT_REVOKED/);
 }finally{db.close();}
}));
test('B299 revocation is effective after reopening private journal',()=>withJournal(({path})=>{
 const c=consent(),rev=revocation();let db=journal(path);
 db.revoke({signedConsent:c,signedRevocation:rev,...proof});db.close();
 db=journal(path);
 try{assert.throws(()=>db.record({signedConsent:c,signedEvidence:position(),...proof}),/B299_CONSENT_REVOKED/);}finally{db.close();}
}));
test('B299 forged revocation rejected and consent remains usable locally',()=>withJournal(({path})=>{
 const db=journal(path),c=consent(),a=revocation();
 const forged=signObject(a.payload,other.privateKey,'JENIOS_B299_CONSENT_REVOCATION_V1\0');
 try{assert.throws(()=>db.revoke({signedConsent:c,signedRevocation:forged,...proof}),/B299_SIGNATURE_VERIFICATION_FAILED/);
 assert.equal(db.inspect(scope,'consent-001').locallyRevoked,false);
 db.record({signedConsent:c,signedEvidence:position(),...proof});
 }finally{db.close();}
}));
test('B299 revocation requires same account, consent ID and valid date',()=>withJournal(({path})=>{
 const db=journal(path);const c=consent();
 try{for(const r of [revocation({consentId:'other'}),revocation({accountDigest:'d'.repeat(64)}),
  revocation({revokedAtMs:T+1}),revocation({revokedAtMs:T-100000})])
  assert.throws(()=>db.revoke({signedConsent:c,signedRevocation:r,...proof}),/B299_REVOCATION_SCOPE_OR_TIME_INVALID/);
  assert.equal(db.inspect(scope,'consent-001').locallyRevoked,false);
 }finally{db.close();}
}));
test('B299 repeated signed revocation fails closed, without writes to broker',()=>withJournal(({path})=>{
 const db=journal(path),c=consent(),r=revocation();
 try{db.revoke({signedConsent:c,signedRevocation:r,...proof});
 assert.throws(()=>db.revoke({signedConsent:c,signedRevocation:r,...proof}),/B299_DUPLICATE_REVOCATION/);
 }finally{db.close();}
}));
test('B299 rejects invalid audit key bytes',()=>withJournal(({path})=>{
 assert.throws(()=>new B299PrivateEvidenceJournal(path,{auditKeyBase64:'plain-text',repositoryRoot:process.cwd()}),/B299_PRIVATE_AUDIT_KEY_REQUIRED/);
}));
test('B299 refuses database inside repository even if directory restricted',()=>{
 const path=join(REPO_ROOT,'local-audit.sqlite');
 assert.throws(()=>journal(path),/B299_AUDIT_JOURNAL_IN_REPOSITORY/);
});
test('B299 refuses world-accessible audit directory',()=>{
 const dir=mkdtempSync(join(tmpdir(),'jenios-b299-world-'));
 try{chmodSync(dir,0o755);assert.throws(()=>journal(join(dir,'audit.sqlite')),/B299_UNSAFE_PRIVATE_DIRECTORY/);}
 finally{rmSync(dir,{recursive:true,force:true});}
});
test('B299 refuses symlinked journal directory',()=>withJournal(({dir,path})=>{
 const link=dir+'-link';symlinkSync(dir,link);
 try{assert.throws(()=>journal(join(link,'audit.sqlite')),/B299_UNSAFE_PRIVATE_DIRECTORY/);}
 finally{rmSync(link,{force:true});}
}));
test('B299 keeps journal scopes isolated across consenting account digests',()=>withJournal(({path})=>{
 const db=journal(path);
 const newScope={...scope,accountDigest:'d'.repeat(64)};
 const c2=consent({accountDigest:newScope.accountDigest});
 const old=position();
 const p2=position({accountDigest:newScope.accountDigest});
 try{db.record({signedConsent:consent(),signedEvidence:old,...proof});
  db.record({signedConsent:c2,signedEvidence:p2,...proof,scope:newScope});
  assert.equal(db.inspect(scope,'consent-001').recordedEvidenceCount,1);
  assert.equal(db.inspect(newScope,'consent-001').recordedEvidenceCount,1);
 }finally{db.close();}
}));
test('B299 revocation after consent expiry can still be stored',()=>withJournal(({path})=>{
 const db=journal(path),c=consent({expiresAtMs:T-1}),r=revocation();
 try{const x=db.revoke({signedConsent:c,signedRevocation:r,...proof});
 assert.equal(x.localRevocationRecorded,true);
 }finally{db.close();}
}));
test('B299 launch, provider, cash and actual Lossometro remain NO-GO',()=>{
 const r=assessB299ExternalReady();
 assert.equal(r.status,'NO_GO_EXTERNAL_AUTHENTICITY_UNVERIFIED');
 assert.equal(r.independentAccountOwnerVerification,false);
 assert.equal(r.actualRealizedPnlVerified,false);
 assert.equal(r.ordersSent,0);assert.equal(r.paperOrdersSent,0);
});

test('B299 private CLI records owner-only offline fixture and fails closed on replay',()=>withJournal(({dir,path})=>{
 const now=Date.now();
 const c=consent({issuedAtMs:now-10000,expiresAtMs:now+60000});
 const e=position({capturedAtMs:now-2000,expiresAtMs:now+20000},
  {observedAtMs:now-2000});
 const packet=join(dir,'packet.json');
 const consentKey=join(dir,'consent.pem');
 const collectorKey=join(dir,'collector.pem');
 for(const [filename,value] of [[packet,JSON.stringify({schema:'JENIOS_B299_PRIVATE_OFFLINE_PACKET_V1',
  signedConsent:c,signedEvidence:[e]})],[consentKey,keyPem(authority)],[collectorKey,keyPem(collector)]]){
  writeFileSync(filename,value,{mode:0o600});
 }
 const env={...process.env,JENIOS_B299_PRIVATE_READ_ONLY:'true',
  JENIOS_REAL_EXECUTION_ENABLED:'false',JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED:'false',
  JENIOS_PRIVATE_PAPER_EXECUTOR:'false',
  JENIOS_B299_OWNER_DIGEST:scope.ownerDigest,JENIOS_B299_ACCOUNT_DIGEST:scope.accountDigest,
  JENIOS_B299_CONSENT_DIGEST:scope.consentDigest,
  JENIOS_B299_CONSENT_KEY_ID:'consent-v1',
  JENIOS_B299_COLLECTOR_KEY_ID:'collector-v1',
  JENIOS_B299_PACKET_PATH:packet,
  JENIOS_B299_CONSENT_KEY_FILE:consentKey,
  JENIOS_B299_COLLECTOR_KEY_FILE:collectorKey,
  JENIOS_B299_AUDIT_KEY_B64:key,JENIOS_B299_AUDIT_DB:path};
 const cli=join(REPO_ROOT,'scripts/platform/research/b299-private-consent-replay-intake.mjs');
 const run=()=>spawnSync(process.execPath,[cli],{cwd:REPO_ROOT,env,encoding:'utf8'});
 const first=run();assert.equal(first.status,0,first.stderr);
 const output=JSON.parse(first.stdout);
 assert.equal(output.recordedEvidenceCount,1);
 assert.equal(output.external.status,'NO_GO_EXTERNAL_AUTHENTICITY_UNVERIFIED');
 assert.equal(output.externalReadPerformed,false);
 assert.equal(output.brokerOrdersSent,0);
 assert.ok(!first.stdout.includes(scope.ownerDigest));
 assert.ok(!first.stdout.includes(e.payload.nonce));
 const repeat=run();assert.notEqual(repeat.status,0);
 assert.match(repeat.stderr,/B299_DUPLICATE_OR_REPLAYED_EVIDENCE/);
}));
test('B299 private CLI refuses execution transport flags',()=>withJournal(({dir,path})=>{
 const cli=join(REPO_ROOT,'scripts/platform/research/b299-private-consent-replay-intake.mjs');
 const bad=spawnSync(process.execPath,[cli],{cwd:REPO_ROOT,
  env:{...process.env,JENIOS_B299_PRIVATE_READ_ONLY:'true',
   JENIOS_PRIVATE_PAPER_EXECUTOR:'true'},encoding:'utf8'});
 assert.notEqual(bad.status,0);assert.match(bad.stderr,/B299_OFFLINE_READ_ONLY_REQUIRED/);
}));