import {DatabaseSync} from 'node:sqlite';
import {createHash,randomUUID} from 'node:crypto';
export const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fail=code=>{throw Object.assign(Error(code),{code});};
/** Trader-owned disk. FULL synchronous commits precede every external submission. */
export class UltraJournal {
 constructor(path,{account,environment,provider}){
  if(!account||!['live','demo'].includes(environment)||!['binance','mt5','profit'].includes(provider))fail('INVALID_ACCOUNT_BINDING');
  this.db=new DatabaseSync(path);this.worker=randomUUID();this.binding=digest({account,environment,provider});
  this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;
   CREATE TABLE IF NOT EXISTS identity (id INTEGER PRIMARY KEY CHECK(id=1),digest TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS runner (id INTEGER PRIMARY KEY CHECK(id=1),owner TEXT NOT NULL,heartbeat INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY,decision_digest TEXT NOT NULL UNIQUE,request TEXT NOT NULL,state TEXT NOT NULL,receipt TEXT,updated INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS events (seq INTEGER PRIMARY KEY,event_id TEXT NOT NULL UNIQUE,payload TEXT NOT NULL,digest TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS controls (id INTEGER PRIMARY KEY CHECK(id=1),paused INTEGER NOT NULL DEFAULT 1);`);
  this.transaction(()=>{const row=this.db.prepare('SELECT digest FROM identity WHERE id=1').get();if(row&&row.digest!==this.binding)fail('JOURNAL_ACCOUNT_MISMATCH');if(!row)this.db.prepare('INSERT INTO identity VALUES(1,?)').run(this.binding);this.db.exec('INSERT OR IGNORE INTO controls(id,paused) VALUES(1,1)');});
 }
 transaction(fn){this.db.exec('BEGIN IMMEDIATE');try{const result=fn();this.db.exec('COMMIT');return result;}catch(e){this.db.exec('ROLLBACK');throw e;}}
 claim(now,{recover=false}={}){return this.transaction(()=>{
  const old=this.db.prepare('SELECT * FROM runner WHERE id=1').get();
  if(old&&old.owner!==this.worker&&(!recover||now-old.heartbeat<60000))fail('ANOTHER_RUNNER_OR_RECOVERY_REQUIRED');
  this.db.prepare('INSERT INTO runner VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET owner=excluded.owner,heartbeat=excluded.heartbeat').run(this.worker,now);
  this.db.exec('UPDATE controls SET paused=1');return this.pending();
 });}
 heartbeat(now){const r=this.db.prepare('UPDATE runner SET heartbeat=? WHERE id=1 AND owner=?').run(now,this.worker);if(r.changes!==1)fail('RUNNER_LEASE_LOST');}
 ownsLease(){const lease=this.db.prepare('SELECT owner FROM runner WHERE id=1').get();if(lease?.owner!==this.worker)fail('RUNNER_LEASE_LOST');}
 paused(){return this.db.prepare('SELECT paused FROM controls WHERE id=1').get().paused===1;}
 pause(){this.db.exec('UPDATE controls SET paused=1');}
 resume(){this.transaction(()=>{this.ownsLease();if(this.pending().some(o=>['sending','unknown'].includes(o.state)))fail('RECONCILIATION_REQUIRED');this.db.exec('UPDATE controls SET paused=0');});}
 pending(){return this.db.prepare("SELECT * FROM orders WHERE state NOT IN ('closed','rejected','cancelled') ORDER BY updated,id").all().map(o=>({...o,request:JSON.parse(o.request),receipt:o.receipt?JSON.parse(o.receipt):null}));}
 prepare(request,now){return this.transaction(()=>{
  const lease=this.db.prepare('SELECT * FROM runner WHERE id=1').get();
  if(!lease||lease.owner!==this.worker||now-lease.heartbeat>10000||this.paused())fail('RUNNER_NOT_ACTIVE');
  const hash=digest(request);const existing=this.db.prepare('SELECT id FROM orders WHERE decision_digest=?').get(hash);if(existing)return {id:existing.id,created:false};
  const id='ju_'+randomUUID().replaceAll('-','');
  this.db.prepare('INSERT INTO orders(id,decision_digest,request,state,updated) VALUES(?,?,?,\'prepared\',?)').run(id,hash,JSON.stringify(request),now);
  return {id,created:true};
 });}
 transition(id,from,to,receipt,now){return this.transaction(()=>{
  this.ownsLease();
  const paths={prepared:['sending','cancelled'],sending:['working','closed','cancelled','unknown','rejected'],unknown:['working','closed','cancelled','rejected'],working:['working','closed','cancelled','unknown']};
  if(!paths[from]?.includes(to))fail('INVALID_ORDER_TRANSITION');
  const r=this.db.prepare('UPDATE orders SET state=?,receipt=?,updated=? WHERE id=? AND state=?').run(to,JSON.stringify(receipt??null),now,id,from);
  if(r.changes!==1)fail('ORDER_STATE_CHANGED');
 });}
 record(event){return this.transaction(()=>{if(!event?.id)fail('RECEIPT_ID_REQUIRED');const hash=digest(event),old=this.db.prepare('SELECT digest FROM events WHERE event_id=?').get(event.id);if(old){if(old.digest!==hash)fail('BROKER_RECEIPT_CHANGED');return false;}this.db.prepare('INSERT INTO events(event_id,payload,digest) VALUES(?,?,?)').run(event.id,JSON.stringify(event),hash);return true;});}
 events(){return this.db.prepare('SELECT payload FROM events ORDER BY seq').all().map(r=>JSON.parse(r.payload));}
 close(){this.transaction(()=>{const lease=this.db.prepare('SELECT owner FROM runner WHERE id=1').get();if(lease?.owner===this.worker){this.pause();this.db.prepare('DELETE FROM runner WHERE id=1 AND owner=?').run(this.worker);}});this.db.close();}
}
