import {UltraJournal,digest} from './journal.mjs';
import {validateOperation,units12,initialOperation} from '../operation.mjs';
export class OperationLedger extends UltraJournal {
 constructor(path,binding){super(path,binding);this.db.exec(`
 CREATE TABLE IF NOT EXISTS ultra_operations(id TEXT PRIMARY KEY,revision INTEGER NOT NULL,payload TEXT NOT NULL,digest TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS ultra_operation_audit(seq INTEGER PRIMARY KEY AUTOINCREMENT,operation_id TEXT NOT NULL,revision INTEGER NOT NULL,payload TEXT NOT NULL,UNIQUE(operation_id,revision));
 CREATE TABLE IF NOT EXISTS ultra_sync(device TEXT PRIMARY KEY,last_seq INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS ultra_transport(id TEXT PRIMARY KEY,payload TEXT NOT NULL);
 `);}
 transaction(fn){
  const depth=this.depth||0,name='ultra_nested_'+depth;
  this.db.exec(depth?'SAVEPOINT '+name:'BEGIN IMMEDIATE');this.depth=depth+1;
  try{const result=fn();this.db.exec(depth?'RELEASE '+name:'COMMIT');return result;}
  catch(error){this.db.exec(depth?'ROLLBACK TO '+name:'ROLLBACK');if(depth)this.db.exec('RELEASE '+name);throw error;}
  finally{this.depth=depth;}
 }
 prepare(request,now){return this.transaction(()=>{const intent=super.prepare(request,now);if(intent.created)this.saveOperation(initialOperation(request,intent.id,now),{now});return intent;});}
 transition(id,from,to,receipt,now){return this.transaction(()=>{
  super.transition(id,from,to,receipt,now);const old=this.operation(id);if(!old)return;
  const state={sending:'sending',unknown:'unknown',cancelled:'cancelled',rejected:'rejected'}[to];
  if(state)this.saveOperation({...old,state,updatedAt:new Date(now).toISOString(),reason:receipt?.reason||null},{now});
 });}
 operation(id){const row=this.db.prepare('SELECT payload FROM ultra_operations WHERE id=?').get(id);return row?JSON.parse(row.payload):null;}
 operations(){return this.db.prepare('SELECT payload FROM ultra_operations ORDER BY id').all().map(r=>JSON.parse(r.payload));}
 saveOperation(input,{now=Date.now()}={}){return this.transaction(()=>{
  const old=this.operation(input.id),candidate=validateOperation({...input,revision:old?old.revision+1:input.revision},{now});
  if(old){
   const identity=['id','market','symbol','currency','side','createdAt','requestedQuantity'];
   if(identity.some(k=>old[k]!==candidate[k]))throw Error('OPERATION_IDENTITY_CHANGED');
   if(units12(candidate.entryQuantity)<units12(old.entryQuantity)||units12(candidate.exitQuantity)<units12(old.exitQuantity))throw Error('EXECUTION_QUANTITY_REGRESSED');
   if(['closed','cancelled','rejected'].includes(old.state)&&candidate.state!==old.state)throw Error('FINAL_OPERATION_REOPENED');
   if(Date.parse(candidate.updatedAt)<Date.parse(old.updatedAt))throw Error('OLD_OPERATION_SNAPSHOT');
   const comparable={...candidate,revision:old.revision,updatedAt:old.updatedAt};
   if(digest(comparable)===digest(old))return old;
  }
  this.db.prepare('INSERT INTO ultra_operations VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,payload=excluded.payload,digest=excluded.digest').run(candidate.id,candidate.revision,JSON.stringify(candidate),digest(candidate));
  this.db.prepare('INSERT INTO ultra_operation_audit(operation_id,revision,payload) VALUES(?,?,?)').run(candidate.id,candidate.revision,JSON.stringify(candidate));return candidate;
 });}
 outbox(device,limit=100){const ack=this.db.prepare('SELECT last_seq FROM ultra_sync WHERE device=?').get(device)?.last_seq||0;return this.db.prepare('SELECT seq,payload FROM ultra_operation_audit WHERE seq>? ORDER BY seq LIMIT ?').all(ack,limit).map(row=>({seq:row.seq,operation:JSON.parse(row.payload)}));}
 acknowledge(device,seq){this.db.prepare('INSERT INTO ultra_sync VALUES(?,?) ON CONFLICT(device) DO UPDATE SET last_seq=max(last_seq,excluded.last_seq)').run(device,seq);}
 transport(id){const row=this.db.prepare('SELECT payload FROM ultra_transport WHERE id=?').get(id);return row?JSON.parse(row.payload):null;}
 saveTransport(id,payload){this.db.prepare('INSERT INTO ultra_transport VALUES(?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload').run(id,JSON.stringify(payload));}
 localReport({provider,environment,connectionLabel,now=new Date()}){return {schema:'JENIOS_ULTRA_OPERATIONS_V1',provider,environment,connectionLabel,generatedAt:now.toISOString(),operations:this.operations()};}
}
