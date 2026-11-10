import {OperationLedger} from './operation-ledger.mjs';
import {digest} from './journal.mjs';
import {validateOperation,units12} from '../operation.mjs';
import {randomUUID} from 'node:crypto';
const fail=code=>{throw Error(code);};
const finalStates=new Set(['closed','cancelled','rejected']);
const receiptKeys=['receiptId','accountBinding','clientOrderId','commandId','observedAtMs','orderState','positionReconciled','protectionConfirmed','entryRemainderCancelled','operation'];
/** R118 is additive: the R117 operation/outbox contract and database remain intact. */
export class ExecutionLedger extends OperationLedger {
 constructor(path,binding){
  super(path,binding);
  this.db.exec(`CREATE TABLE IF NOT EXISTS ultra_execution_receipts(id TEXT PRIMARY KEY,digest TEXT NOT NULL,payload TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS ultra_execution_commands(id TEXT PRIMARY KEY,operation_id TEXT NOT NULL,kind TEXT NOT NULL,decision_digest TEXT NOT NULL UNIQUE,request TEXT NOT NULL,state TEXT NOT NULL,updated INTEGER NOT NULL);`);
 }
 order(id){const row=this.db.prepare('SELECT * FROM orders WHERE id=?').get(id);return row?{...row,request:JSON.parse(row.request),receipt:row.receipt?JSON.parse(row.receipt):null}:null;}
 commands({pending=true}={}){
  return this.db.prepare('SELECT * FROM ultra_execution_commands '+(pending?"WHERE state NOT IN ('confirmed','cancelled') ":'')+'ORDER BY updated,id').all().map(r=>({...r,request:JSON.parse(r.request)}));
 }
 resume(){return this.transaction(()=>{if(this.commands().some(c=>['sending','unknown'].includes(c.state)))fail('COMMAND_RECONCILIATION_REQUIRED');super.resume();});}
 prepareCommand(kind,operationId,{quantity=null}={},now=Date.now()){
  return this.transaction(()=>{
   this.ownsLease();const order=this.order(operationId),operation=this.operation(operationId);
   if(!['cancel','close'].includes(kind)||!order||!operation||order.state!=='working'||this.commands().some(c=>c.operation_id===operationId))fail('COMMAND_RECONCILIATION_REQUIRED');
   const remaining=units12(operation.entryQuantity)-units12(operation.exitQuantity);
   if(kind==='close'&&(!quantity||units12(quantity)<=0n||units12(quantity)>remaining))fail('INVALID_CLOSE_QUANTITY');
   if(kind==='close'&&units12(quantity)===remaining&&units12(operation.entryQuantity)<units12(operation.requestedQuantity)&&order.receipt?.entryRemainderCancelled!==true)fail('ENTRY_REMAINDER_CANCEL_REQUIRED');
   if(kind==='cancel'&&units12(operation.entryQuantity)===units12(operation.requestedQuantity))fail('NO_UNFILLED_ENTRY');
   const request={operationId,kind,quantity,operationRevision:operation.revision,entryQuantity:operation.entryQuantity,exitQuantity:operation.exitQuantity};
   const encoded=JSON.stringify(request);
   const old=this.db.prepare('SELECT id,state FROM ultra_execution_commands WHERE request=? ORDER BY rowid DESC LIMIT 1').get(encoded);
   if(old&&old.state!=='cancelled')return {id:old.id,created:false};
   const attempt=this.db.prepare('SELECT count(*) AS count FROM ultra_execution_commands WHERE request=?').get(encoded).count;
   const hash=digest({request,attempt});
   const id='ju_cmd_'+randomUUID().replaceAll('-','');
   this.db.prepare('INSERT INTO ultra_execution_commands VALUES(?,?,?,?,?,?,?)').run(id,operationId,kind,hash,JSON.stringify(request),'prepared',now);
   return {id,created:true};
  });
 }
 markCommand(id,from,to,now=Date.now()){
  return this.transaction(()=>{
   this.ownsLease();
   if(!({prepared:['sending','cancelled'],sending:['unknown','confirmed'],unknown:['confirmed']})[from]?.includes(to))fail('INVALID_COMMAND_TRANSITION');
   if(this.db.prepare('UPDATE ultra_execution_commands SET state=?,updated=? WHERE id=? AND state=?').run(to,now,id,from).changes!==1)fail('COMMAND_STATE_CHANGED');
   if(to==='unknown')this.pause();
  });
 }
 /** Persist the receipt, lifecycle state, financial revision and outbox atomically. */
 applyReceipt(receipt,{commandId=null,now=Date.now()}={}){
  return this.transaction(()=>{
   this.ownsLease();
   if(!receipt||Object.keys(receipt).some(k=>!receiptKeys.includes(k))||receiptKeys.some(k=>!Object.hasOwn(receipt,k))||typeof receipt.receiptId!=='string'||!/^[-A-Za-z0-9_.:]{1,120}$/.test(receipt.receiptId)||receipt.accountBinding!==this.binding||receipt.commandId!==commandId||!Number.isSafeInteger(receipt.observedAtMs)||receipt.observedAtMs>now||now-receipt.observedAtMs>5000||typeof receipt.positionReconciled!=='boolean'||typeof receipt.protectionConfirmed!=='boolean'||typeof receipt.entryRemainderCancelled!=='boolean')fail('INVALID_EXECUTION_RECEIPT');
   const previous=this.db.prepare('SELECT digest FROM ultra_execution_receipts WHERE id=?').get(receipt.receiptId),hash=digest(receipt);
   if(previous){if(previous.digest!==hash)fail('BROKER_RECEIPT_CHANGED');return {duplicate:true,operation:this.operation(receipt.clientOrderId)};}
   const order=this.order(receipt.clientOrderId),old=this.operation(receipt.clientOrderId);
   if(!order||!old||receipt.operation?.id!==order.id)fail('RECEIPT_OWNERSHIP_UNPROVEN');
   let operation=validateOperation(receipt.operation,{market:old.market,now});
   if(Date.parse(operation.updatedAt)>receipt.observedAtMs||Date.parse(operation.updatedAt)<Date.parse(old.updatedAt))fail('OLD_OPERATION_SNAPSHOT');
   const stateFor={queued:'prepared',sending:'working',unknown:'unknown',open:'working',partially_closed:'working',closed:'closed',cancelled:'cancelled',rejected:'rejected'};
   let state=stateFor[operation.state];
   if(state!==receipt.orderState||state==='prepared'||state==='sending')fail('RECEIPT_STATE_MISMATCH');
   // A rejected/cancelled remainder never erases filled exposure. Terminal state
   // must describe the whole operation, not merely an entry or closing order.
   const remainderUnconfirmed=state==='closed'&&units12(operation.entryQuantity)<units12(operation.requestedQuantity)&&!receipt.entryRemainderCancelled;
   if(remainderUnconfirmed||(finalStates.has(state)&&!receipt.positionReconciled)||(state==='working'&&units12(operation.entryQuantity)>units12(operation.exitQuantity)&&!receipt.protectionConfirmed)){
    operation={...operation,state:'unknown',closedAt:null,reason:remainderUnconfirmed?'ENTRY_REMAINDER_UNCONFIRMED':finalStates.has(state)?'POSITION_UNCONFIRMED':'PROTECTION_UNCONFIRMED'};state='unknown';
   }
   if(finalStates.has(order.state)&&state!==order.state)fail('FINAL_OPERATION_REOPENED');
   if(order.state==='prepared')fail('UNSENT_OPERATION_RECEIPT');
   let commandConfirmed=null;
   if(commandId){
    const command=this.commands().find(c=>c.id===commandId);if(!command||command.operation_id!==order.id||!['sending','unknown'].includes(command.state))fail('COMMAND_SCOPE_MISMATCH');
    commandConfirmed=command.kind==='close'
     ?units12(operation.exitQuantity)>=units12(command.request.exitQuantity)+units12(command.request.quantity)
     :receipt.entryRemainderCancelled;
    commandConfirmed=commandConfirmed&&state!=='unknown';
   }
   const saved=this.saveOperation(operation,{now});
   this.db.prepare('INSERT INTO ultra_execution_receipts VALUES(?,?,?)').run(receipt.receiptId,hash,JSON.stringify(receipt));
   this.db.prepare('UPDATE orders SET state=?,receipt=?,updated=? WHERE id=?').run(state,JSON.stringify(receipt),now,order.id);
   if(commandId)this.db.prepare('UPDATE ultra_execution_commands SET state=?,updated=? WHERE id=?').run(commandConfirmed?'confirmed':'unknown',now,commandId);
   if(state==='unknown'||commandConfirmed===false)this.pause();
   return {duplicate:false,operation:saved,state,commandConfirmed};
  });
 }
 receipts(){return this.db.prepare('SELECT payload FROM ultra_execution_receipts ORDER BY rowid').all().map(r=>JSON.parse(r.payload));}
}
