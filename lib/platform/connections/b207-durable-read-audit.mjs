/** B207 — durable observation-only audit journal (NOT a broker order outbox).
 * One signed auditId can never cause an automatic second GET cycle after a crash.
 * Identifiers are stored solely as keyed HMAC digests. No credentials/order body.
 */
import {DatabaseSync} from 'node:sqlite';
import {createHmac} from 'node:crypto';
import {openSync,closeSync,lstatSync,chmodSync,constants} from 'node:fs';
import {dirname} from 'node:path';
import {assertIsolatedReadWorker} from './b206-private-read-boundary.mjs';
const deny=code=>{throw Object.assign(new Error(code),{code});};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ID=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/;
const HEX=/^[a-f0-9]{64}$/;
const SEVERITY=new Set(['CRITICAL','HIGH','REVIEW']);
function auditKey(env){return Buffer.from(env.JENIOS_PAPER_OBSERVER_KEY_B64,'base64');}
export class PrivatePaperReadAuditStore{
 #db;#secret;
 constructor(path,{env=process.env}={}){
  assertIsolatedReadWorker(env);
  if(typeof path!=='string'||!path.startsWith('/')||path.includes('\0')||path.includes('/../'))
   deny('PRIVATE_ABSOLUTE_AUDIT_PATH_REQUIRED');
  // The SQLite WAL and SHM files must also live inside an owner-only directory.
  const parent=lstatSync(dirname(path));
  if(!parent.isDirectory()||(parent.mode&0o077)!==0||
     (typeof process.getuid==='function'&&parent.uid!==process.getuid()))
   deny('PRIVATE_AUDIT_DIRECTORY_NOT_ISOLATED');
  const fd=openSync(path,constants.O_RDWR|constants.O_CREAT|constants.O_NOFOLLOW,0o600);closeSync(fd);
  if(!lstatSync(path).isFile())deny('PRIVATE_AUDIT_REGULAR_FILE_REQUIRED');
  chmodSync(path,0o600);
  this.#secret=auditKey(env);
  this.#db=new DatabaseSync(path);
  this.#db.exec(`PRAGMA busy_timeout=5000;PRAGMA journal_mode=WAL;PRAGMA synchronous=FULL;
   CREATE TABLE IF NOT EXISTS observations(
    scope_digest TEXT PRIMARY KEY,
    state TEXT NOT NULL CHECK(state IN ('IN_PROGRESS','REVIEW_RECORDED','FAILED_CLOSED','EXPIRED_NEEDS_REVIEW')),
    started_at INTEGER NOT NULL,lease_until INTEGER NOT NULL,updated_at INTEGER NOT NULL,
    checksum TEXT, severity TEXT, sanitized_code TEXT,
    attempts INTEGER NOT NULL DEFAULT 1 CHECK(attempts=1));`);
 }
 #scope(x){
  if(!x||!UUID.test(x.userId||'')||!UUID.test(x.connectionId||'')||
     !ID.test(x.clientOrderId||'')||!ID.test(x.auditId||''))deny('INVALID_AUDIT_OWNER_SCOPE');
  return createHmac('sha256',this.#secret).update(JSON.stringify([
   'jenios-private-paper-audit-v1',x.userId,x.connectionId,x.clientOrderId,x.auditId
  ])).digest('hex');
 }
 #tx(fn){this.#db.exec('BEGIN IMMEDIATE');try{const x=fn();this.#db.exec('COMMIT');return x;}catch(e){this.#db.exec('ROLLBACK');throw e;}}
 #row(hash){return this.#db.prepare('SELECT * FROM observations WHERE scope_digest=?').get(hash);}
 #result(row,claimed=false){return Object.freeze({auditDigest:row.scope_digest,state:row.state,
  claimed,attempts:row.attempts,startedAtMs:row.started_at,updatedAtMs:row.updated_at,
  expiresAtMs:row.lease_until,evidenceChecksumSha256:row.checksum||null,
  severity:row.severity||null,code:row.sanitized_code||null,ordersSent:0,
  automaticRestartAllowed:false,liveExecution:false});}
 claim(scope,{nowMs,leaseMs=120000}={}){
  const hash=this.#scope(scope);
  if(!Number.isSafeInteger(nowMs)||nowMs<=0||
     !Number.isSafeInteger(leaseMs)||leaseMs<1000||leaseMs>300000)
   deny('INVALID_OBSERVER_AUDIT_CLOCK');
  return this.#tx(()=>{
   const old=this.#row(hash);
   if(old){
    if(old.state==='IN_PROGRESS'&&nowMs>=old.lease_until){
     this.#db.prepare(`UPDATE observations SET state='EXPIRED_NEEDS_REVIEW',updated_at=? WHERE scope_digest=?`)
      .run(nowMs,hash);
    }
    return this.#result(this.#row(hash),false);
   }
   this.#db.prepare(`INSERT INTO observations(scope_digest,state,started_at,lease_until,updated_at)
    VALUES(?,'IN_PROGRESS',?,?,?)`).run(hash,nowMs,nowMs+leaseMs,nowMs);
   return this.#result(this.#row(hash),true);
  });
 }
 record(scope,{nowMs,report}={}){
  const hash=this.#scope(scope);
  if(!Number.isSafeInteger(nowMs)||nowMs<=0||
     !report||report.schema!=='JENIOS_B204_REDACTED_PAPER_REVIEW'||
     !HEX.test(report.evidenceChecksumSha256||'')||!SEVERITY.has(report.severity)||
     report.ordersSent!==0||report.chargesCreated!==0||
     report.readyForBrokerPaperPilot!==false||report.realExecutionAuthorized!==false||
     report.productionReleaseAllowed!==false||report.humanAuthorizationGranted!==false||
     report.brokerPermissionCertified!==false||
     report.privateWorkerDeployedByReport!==false||
     report.independentExternalWitnessCertified!==false||
     report.automaticResubmissionAllowed!==false||
     report.liveExecutionAuthorized===true||report.paymentsCharged>0)
   deny('UNTRUSTED_PRIVATE_AUDIT_REPORT');
  return this.#tx(()=>{
   const old=this.#row(hash);
   if(!old||old.state!=='IN_PROGRESS'||nowMs<old.started_at||nowMs>old.lease_until)
    deny('PRIVATE_AUDIT_NOT_ACTIVE');
   this.#db.prepare(`UPDATE observations SET state='REVIEW_RECORDED',updated_at=?,checksum=?,severity=?,sanitized_code=?
    WHERE scope_digest=?`).run(nowMs,report.evidenceChecksumSha256,report.severity,'MANUAL_REVIEW_REQUIRED',hash);
   return this.#result(this.#row(hash));
  });
 }
 failClosed(scope,{nowMs,code='PRIVATE_AUDIT_UNCONFIRMED'}={}){
  const hash=this.#scope(scope);
  if(!Number.isSafeInteger(nowMs)||nowMs<=0||
     !['PRIVATE_AUDIT_UNCONFIRMED','PRIVATE_BROKER_READ_FAILED','RISK_PAUSE_REQUIRED'].includes(code))
   deny('INVALID_FAIL_CLOSED_CODE');
  return this.#tx(()=>{
   const old=this.#row(hash);
   if(!old)deny('PRIVATE_AUDIT_NOT_STARTED');
   if(old.state==='IN_PROGRESS')this.#db.prepare(`UPDATE observations SET state='FAILED_CLOSED',updated_at=?,sanitized_code=?
    WHERE scope_digest=?`).run(Math.max(old.started_at,nowMs),code,hash);
   return this.#result(this.#row(hash));
  });
 }
 inspect(scope){const row=this.#row(this.#scope(scope));return row?this.#result(row):null;}
 close(){this.#db.close();}
}
