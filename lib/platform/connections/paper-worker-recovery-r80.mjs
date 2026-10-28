/** R80 private restart recovery: read/reconcile only, never submits broker orders.
 * R74 synthetic runtime remains unchanged. Invocation requires an independent
 * trusted Node worker, durable B152 ledger, verified Platform owner and credentials.
 */
import {reconcileOwnAlpacaPaperLedger} from './alpaca-paper-ledger-reconcile.mjs';
const deny=code=>{throw Object.assign(new Error(code),{code});};
const RETRY_STATES=new Set(['SUBMITTING','UNKNOWN','ACK','PARTIAL']);
export async function recoverR80PaperAfterRestart({
 session,storedConnection,credentials,orders,nowMs
},{ledger,safetyStore,env=process.env,lookup,recorder=reconcileOwnAlpacaPaperLedger}={}){
 if(env.VERCEL_ENV!=='preview'||env.JENIOS_REAL_EXECUTION_ENABLED!=='false'||
    env.JENIOS_PRIVATE_PAPER_RECOVERY_ENABLED!=='true'||
    env.JENIOS_PRIVATE_PAPER_REHEARSAL!=='true')deny('R80_RECOVERY_DISABLED');
 if(!session?.authenticated||!session?.diagnosticCompleted||!session?.userId||
    storedConnection?.user_id!==session.userId||storedConnection?.environment!=='paper'||
    storedConnection?.provider!=='alpaca'||storedConnection?.status!=='active')
    deny('R80_RECOVERY_SCOPE_DENIED');
 if(!Number.isSafeInteger(nowMs)||nowMs<=0||!Array.isArray(orders)||orders.length>30)
    deny('R80_RECOVERY_INVALID_REQUEST');
 if(!ledger?.snapshot||!ledger?.event||typeof safetyStore?.readSafety!=='function')
    deny('R80_RECOVERY_STORES_REQUIRED');
 let safety;
 try{safety=await safetyStore.readSafety({ownerUserId:session.userId,connectionId:storedConnection.id});}
 catch{deny('R80_RECOVERY_SAFETY_UNAVAILABLE');}
 if(!safety||safety.ownerUserId!==session.userId||safety.connectionId!==storedConnection.id||
    safety.liveExecutionEnabled!==false)deny('R80_RECOVERY_SAFETY_UNAVAILABLE');
 // Reconciliation remains possible while paused, allowing safe discovery of in-flight fills.
 // No restart transition can change PAUSED to ACTIVE or retransmit an ambiguous order.
 const requestIds=new Set();
 for(const entry of orders){
  if(typeof entry?.clientOrderId!=='string'||
     !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/.test(entry.clientOrderId)||
     typeof entry?.symbol!=='string'||!/^[A-Z][A-Z0-9.]{0,14}$/.test(entry.symbol)||
     requestIds.has(entry.clientOrderId))deny('R80_RECOVERY_INVALID_ORDER');
  requestIds.add(entry.clientOrderId);
  if(!RETRY_STATES.has(entry.previousState))deny('R80_RECOVERY_STATE_NOT_ELIGIBLE');
 }
 // R89: never trust a caller-supplied recovery list when the durable journal
 // can provide the authoritative bounded inventory of pending intents.
 if(typeof ledger.pendingRecovery!=='function')deny('R91_DURABLE_RECOVERY_INVENTORY_REQUIRED');
 {
  let persisted;
  try{
   const {alpacaPaperLedgerConnection}=await import('./alpaca-paper-risk-rehearsal.mjs');
   const bound=alpacaPaperLedgerConnection(session.userId,storedConnection,{now:nowMs,env});
   persisted=ledger.pendingRecovery(session,bound);
  }catch{deny('R89_DURABLE_RECOVERY_INVENTORY_UNAVAILABLE');}
  if(!Array.isArray(persisted)||persisted.length!==orders.length||
     persisted.some((entry,i)=>entry.clientOrderId!==orders[i]?.clientOrderId||
      entry.symbol!==orders[i]?.symbol||entry.previousState!==orders[i]?.previousState))
   deny('R89_RECOVERY_INVENTORY_MISMATCH');
 }
 const seen=new Set(),reports=[];
 for(const entry of orders){
  const clientOrderId=entry?.clientOrderId,symbol=entry?.symbol;
  if(typeof clientOrderId!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/.test(clientOrderId)||
     typeof symbol!=='string'||!/^[A-Z][A-Z0-9.]{0,14}$/.test(symbol)||
     seen.has(clientOrderId))deny('R80_RECOVERY_INVALID_ORDER');
  seen.add(clientOrderId);
  if(!RETRY_STATES.has(entry.previousState))deny('R80_RECOVERY_STATE_NOT_ELIGIBLE');
  try{
   const result=await recorder({session,storedConnection,clientOrderId,symbol,credentials,nowMs},
    {ledger,env,lookup});
   if(result?.automaticResubmissionAllowed!==false||result?.realExecution!==false||
      result?.ordersSent!==0)deny('R80_UNSAFE_RECOVERY_RECEIPT');
   reports.push(Object.freeze({clientOrderId,state:result.state,manualReview:!!result.manualReview,
     riskHeldUnits:result.riskHeldUnits??null}));
  }catch{
   reports.push(Object.freeze({clientOrderId,state:'UNKNOWN',manualReview:true,
     riskHeldUnits:null}));
  }
 }
 return Object.freeze({paperOnly:true,liveExecution:false,ordersSent:0,
  autoResubmitAllowed:false,killSwitchUnchanged:true,requiresManualReview:
   reports.some(r=>r.manualReview),reports:Object.freeze(reports)});
}
