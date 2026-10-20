/** B178: private-worker PAPER outbox. This is NOT the B152 risk ledger or a live-order sender.
 * Prepare/claim are distinct durable transactions. A claimed intent can NEVER be auto-claimed again.
 * An ambiguous result requires authoritative broker lookup and manual incident handling.
 */
import { DatabaseSync } from 'node:sqlite';
import {createHash} from 'node:crypto';
import {openSync,closeSync,lstatSync,chmodSync,constants} from 'node:fs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ID=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/;
const HEX=/^[a-f0-9]{64}$/;
const deny=code=>{throw Object.assign(new Error(code),{code});};
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const validInput=x=>{
 if(!x||typeof x!=='object'||!UUID.test(x.userId||'')||!UUID.test(x.connectionId||'')||
 !ID.test(x.clientOrderId||'')||!HEX.test(x.accountDigest||'')||
 !HEX.test(x.proposalDigest||'')||!Number.isSafeInteger(x.atMs)||x.atMs<=0)deny('INVALID_PAPER_INTENT_SCOPE');
};
const same=(a,b)=>a.userId===b.userId&&a.connectionId===b.connectionId&&a.clientOrderId===b.clientOrderId;
const rowPublic=x=>x?Object.freeze({userId:x.owner,connectionId:x.connection,clientOrderId:x.client_id,
 state:x.state,attempts:x.attempts,claimedAtMs:x.claimed_at,updatedAtMs:x.updated_at,
 accountDigest:x.account_digest,proposalDigest:x.proposal_digest,evidenceDigest:x.evidence_digest||null,
 automaticResubmissionAllowed:false,realExecution:false}):null;
export class AlpacaPaperDispatchJournal {
 #db;
 constructor(path){
  if(typeof path!=='string'||!path.startsWith('/')||path.includes('\0'))deny('PRIVATE_ABSOLUTE_DB_PATH_REQUIRED');
  const fd=openSync(path,constants.O_RDWR|constants.O_CREAT|constants.O_NOFOLLOW,0o600);closeSync(fd);
  if(!lstatSync(path).isFile())deny('REGULAR_DB_FILE_REQUIRED');chmodSync(path,0o600);
  this.#db=new DatabaseSync(path);
  this.#db.exec(`PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;
   CREATE TABLE IF NOT EXISTS paper_dispatch(
    owner TEXT NOT NULL, connection TEXT NOT NULL, client_id TEXT NOT NULL,
    account_digest TEXT NOT NULL, proposal_digest TEXT NOT NULL, state TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0, claimed_at INTEGER, updated_at INTEGER NOT NULL,
    evidence_digest TEXT, PRIMARY KEY(owner,connection,client_id));`);
 }
 #tx(fn){this.#db.exec('BEGIN IMMEDIATE');try{const a=fn();this.#db.exec('COMMIT');return a;}catch(e){this.#db.exec('ROLLBACK');throw e;}}
 #stored(x){return this.#db.prepare('SELECT * FROM paper_dispatch WHERE owner=? AND connection=? AND client_id=?').get(x.userId,x.connectionId,x.clientOrderId);}
 /** Persist intent before touching any external system. `proposalDigest` is bound to protected ledger intent. */
 prepare(x){validInput(x);
  return this.#tx(()=>{
   const old=this.#stored(x);
   if(old){if(old.account_digest!==x.accountDigest||old.proposal_digest!==x.proposalDigest)deny('DISPATCH_IDEMPOTENCY_CONFLICT');return Object.freeze({...rowPublic(old),duplicate:true});}
   this.#db.prepare('INSERT INTO paper_dispatch(owner,connection,client_id,account_digest,proposal_digest,state,attempts,updated_at) VALUES(?,?,?,?,?,?,?,?)')
   .run(x.userId,x.connectionId,x.clientOrderId,x.accountDigest,x.proposalDigest,'PREPARED',0,x.atMs);
   return Object.freeze({...rowPublic(this.#stored(x)),duplicate:false});
  });
 }
 /** One-shot atomic lease: exactly one worker may cross the network boundary. Never resets attempts. */
 claim(x){validInput(x);
  return this.#tx(()=>{
   const row=this.#stored(x);
   if(!row||row.account_digest!==x.accountDigest||row.proposal_digest!==x.proposalDigest)deny('DISPATCH_INTENT_NOT_MATCHED');
   if(row.state!=='PREPARED'||row.attempts!==0)return Object.freeze({...rowPublic(row),claimed:false});
   if(x.atMs<row.updated_at)deny('DISPATCH_CLOCK_ROLLBACK');
   const updated=this.#db.prepare("UPDATE paper_dispatch SET state='IN_FLIGHT',attempts=1,claimed_at=?,updated_at=? WHERE owner=? AND connection=? AND client_id=? AND state='PREPARED' AND attempts=0 RETURNING *")
   .get(x.atMs,x.atMs,x.userId,x.connectionId,x.clientOrderId);
   if(!updated)deny('DISPATCH_CLAIM_RACE');
   return Object.freeze({...rowPublic(updated),claimed:true});
  });
 }
 observe(x,{state,evidence}){
  validInput(x);if(!['ACKED','REJECTED','AMBIGUOUS'].includes(state)||typeof evidence!=='string'||!HEX.test(evidence))deny('INVALID_DISPATCH_OBSERVATION');
  return this.#tx(()=>{
   const row=this.#stored(x);
   if(!row||row.account_digest!==x.accountDigest||row.proposal_digest!==x.proposalDigest)deny('DISPATCH_INTENT_NOT_MATCHED');
   if(x.atMs<row.updated_at)deny('DISPATCH_CLOCK_ROLLBACK');
   if(row.state===state&&row.evidence_digest===evidence)return Object.freeze({...rowPublic(row),duplicate:true});
   if(row.state!=='IN_FLIGHT')deny('DISPATCH_FINAL_OBSERVATION_ALREADY_RECORDED');
   const next=this.#db.prepare('UPDATE paper_dispatch SET state=?,evidence_digest=?,updated_at=? WHERE owner=? AND connection=? AND client_id=? RETURNING *')
    .get(state,evidence,x.atMs,x.userId,x.connectionId,x.clientOrderId);
   return Object.freeze({...rowPublic(next),duplicate:false});
  });
 }
 /** Only after independent broker lookup; an UNKNOWN is never made safe to retry. */
 reconcile(x,{brokerEvidenceDigest,verified}){
  validInput(x);if(verified!==true||!HEX.test(brokerEvidenceDigest||''))deny('INDEPENDENT_BROKER_EVIDENCE_REQUIRED');
  return this.#tx(()=>{
   const row=this.#stored(x);
   if(!row||row.account_digest!==x.accountDigest||row.proposal_digest!==x.proposalDigest)deny('DISPATCH_INTENT_NOT_MATCHED');
   if(x.atMs<row.updated_at)deny('DISPATCH_CLOCK_ROLLBACK');
   if(row.state==='RECONCILED'&&row.evidence_digest===brokerEvidenceDigest)return Object.freeze({...rowPublic(row),duplicate:true});
   if(!['IN_FLIGHT','ACKED','AMBIGUOUS','REJECTED'].includes(row.state))deny('NO_PAPER_SEND_TO_RECONCILE');
   const next=this.#db.prepare("UPDATE paper_dispatch SET state='RECONCILED',evidence_digest=?,updated_at=? WHERE owner=? AND connection=? AND client_id=? RETURNING *")
   .get(brokerEvidenceDigest,x.atMs,x.userId,x.connectionId,x.clientOrderId);
   return Object.freeze({...rowPublic(next),duplicate:false});
  });
 }
 inspect(x){validInput(x);const row=this.#stored(x);
  if(row&&(row.account_digest!==x.accountDigest||row.proposal_digest!==x.proposalDigest))deny('DISPATCH_INTENT_NOT_MATCHED');
  return rowPublic(row);
 }
 close(){this.#db.close();}
}
export function paperDispatchHash(x){return digest(x);}
