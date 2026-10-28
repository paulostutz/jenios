/** Private durable OAuth state. Stores hashes, never codes, cookies or tokens. */
import {DatabaseSync} from 'node:sqlite';
import {openSync,closeSync,lstatSync,constants} from 'node:fs';
import {join} from 'node:path';
import {verifyR94PrivateVolume} from './private-host-preflight-r94.mjs';
const fail=code=>{throw Object.assign(new Error(code),{code});};
const HASH=/^[a-f0-9]{64}$/;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export class R106OAuthState {
 #db;
 constructor(volume){
  const path=join(verifyR94PrivateVolume(volume),'alpaca-connect-r106.sqlite');
  for(const suffix of ['','-wal','-shm']){
   try{const s=lstatSync(path+suffix);
    if(!s.isFile()||s.isSymbolicLink()||s.nlink!==1||(s.mode&0o077)!==0||
       (typeof process.getuid==='function'&&s.uid!==process.getuid()))fail('R106_STATE_STORAGE_UNSAFE');
   }catch(e){if(e.code!=='ENOENT')throw e;}
  }
  const fd=openSync(path,constants.O_CREAT|constants.O_RDWR|constants.O_NOFOLLOW,0o600);closeSync(fd);
  this.#db=new DatabaseSync(path);
  this.#db.exec(`PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;
   CREATE TABLE IF NOT EXISTS oauth_states(
    state_hash TEXT PRIMARY KEY,owner TEXT NOT NULL,browser_hash TEXT NOT NULL,
    config_hash TEXT NOT NULL,created_at INTEGER NOT NULL,expires_at INTEGER NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('PENDING','CLAIMED','COMPLETED','DENIED','FAILED')),
    connection_id TEXT,granted_scope TEXT,
    CHECK(expires_at>created_at AND expires_at-created_at=600000));`);
 }
 create({stateHash,owner,browserHash,configHash,now}){
  if(![stateHash,browserHash,configHash].every(x=>HASH.test(x))||!UUID.test(owner)||
     !Number.isSafeInteger(now)||now<=0)fail('R106_STATE_INVALID');
  this.#db.exec('BEGIN IMMEDIATE');
  try{
   const count=this.#db.prepare('SELECT count(*) AS n FROM oauth_states WHERE owner=? AND created_at>?').get(owner,now-86400000).n;
   if(count>=100)fail('R106_CONNECT_RATE_LIMIT');
   this.#db.prepare("INSERT INTO oauth_states VALUES (?,?,?,?,?,?,'PENDING',NULL,NULL)").run(stateHash,owner,browserHash,configHash,now,now+600000);
   this.#db.exec('COMMIT');
  }catch(e){this.#db.exec('ROLLBACK');throw e;}
 }
 claim({stateHash,owner,browserHash,configHash,now}){
  if(![stateHash,browserHash,configHash].every(x=>HASH.test(x))||!UUID.test(owner)||
     !Number.isSafeInteger(now)||now<=0)fail('R106_STATE_INVALID');
  const row=this.#db.prepare(`UPDATE oauth_states SET status='CLAIMED'
   WHERE state_hash=? AND owner=? AND browser_hash=? AND config_hash=?
   AND status='PENDING' AND created_at<=? AND expires_at>? RETURNING state_hash`).get(
    stateHash,owner,browserHash,configHash,now,now);
  if(!row)fail('R106_STATE_INVALID_OR_CONSUMED');
 }
 finish(stateHash,status,connectionId=null){
  if(!HASH.test(stateHash)||!['COMPLETED','DENIED','FAILED'].includes(status)||
     (status==='COMPLETED'?!UUID.test(connectionId||''):connectionId!==null))fail('R106_STATE_INVALID');
  const out=this.#db.prepare("UPDATE oauth_states SET status=?,connection_id=?,granted_scope=? WHERE state_hash=? AND status='CLAIMED'").run(
   status,connectionId,status==='COMPLETED'?'trading':null,stateHash);
  if(out.changes!==1)fail('R106_STATE_COMPLETION_UNCONFIRMED');
 }
 close(){this.#db.close();}
}
