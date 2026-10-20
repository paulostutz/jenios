/** B191 — offline private PAPER risk incident plan using B152's actual durable ledger.
 * No order POST, cancellation, closing, key intake, or notification dispatch.
 */
const reject=code=>{throw Object.assign(new Error(code),{code});};
const STATES=new Set(['RESERVED','SUBMITTING','ACK','PARTIAL','FILLED','CANCELLED','REJECTED','UNKNOWN','CLOSED']);
export function inspectPrivatePaperRecovery({ledger,session,connection,nowMs=Date.now()},
 {env=process.env}={}){
 if(env.VERCEL_ENV==='production'||env.JENIOS_PRIVATE_PAPER_REHEARSAL!=='true')reject('PRIVATE_PAPER_REHEARSAL_REQUIRED');
 if(!session||session.authenticated!==true||session.diagnosticCompleted!==true||
  !connection||connection.userId!==session.userId||connection.provider!=='alpaca'||
  connection.environment!=='paper')reject('PRIVATE_PAPER_OWNER_REQUIRED');
 if(!Number.isSafeInteger(nowMs)||nowMs<=0)reject('INVALID_CLOCK');
 if(!ledger||typeof ledger.snapshot!=='function')reject('PERSISTENT_RISK_LEDGER_REQUIRED');
 // The B152 ledger itself verifies ownership, identity binding, revocation and permissions.
 const rows=ledger.snapshot(session,connection);
 if(!Array.isArray(rows)||rows.length>1000)reject('INVALID_PRIVATE_LEDGER_SNAPSHOT');
 const counts=Object.fromEntries([...STATES].map(s=>[s,0]));
 let held=0n,filled=0n;const flagged=[];
 for(const row of rows){
  if(!row||!STATES.has(row.state)||typeof row.client_id!=='string'||
    !/^[a-zA-Z0-9:._-]{1,100}$/.test(row.client_id))reject('CORRUPT_RISK_ROW');
  if(typeof row.held!=='string'||!/^\d+$/.test(row.held)||typeof row.filled!=='string'||!/^\d+$/.test(row.filled))reject('CORRUPT_RISK_ROW');
  const h=BigInt(row.held),f=BigInt(row.filled);
  if(row.state==='UNKNOWN'&&h===0n)reject('UNKNOWN_RISK_NOT_HELD');
  counts[row.state]++;held+=h;filled+=f;
  if(['UNKNOWN','SUBMITTING','PARTIAL','FILLED'].includes(row.state)||
   (row.state==='CANCELLED'&&f>0n))flagged.push(Object.freeze({clientOrderId:row.client_id,
    state:row.state,riskHeldUnits:row.held,filledUnits:row.filled}));
 }
 const manualReconciliation=counts.UNKNOWN>0||counts.SUBMITTING>0;
 const exposed=filled>0n;
 const noNewEntries=manualReconciliation||counts.PARTIAL>0||counts.FILLED>0||
  flagged.some(x=>x.state==='CANCELLED'&&BigInt(x.filledUnits)>0n);
 return Object.freeze({schema:'JENIOS_B191_PRIVATE_RECOVERY',asOfMs:nowMs,
  provider:'alpaca',environment:'paper',scopedUserId:session.userId,
  orderCount:rows.length,states:Object.freeze(counts),heldRiskUnits:held.toString(),
  filledQuantityUnits:filled.toString(),flagged:Object.freeze(flagged),
  entryPauseRecommended:noNewEntries,independentBrokerLookupRequired:manualReconciliation,
  manualPositionReviewRequired:exposed,
  stopAndTargetBrokerVerified:false,
  automaticOrderRetry:false,brokerOrderCancellationPerformed:false,
  positionsClosed:false,ordersSent:0,realExecution:false,
  nextActions:Object.freeze([
   ...(manualReconciliation?['CHECK_PROVIDER_BY_ORIGINAL_CLIENT_ORDER_ID_NO_RESUBMIT']:[]),
   ...(exposed?['CHECK_OPEN_POSITIONS_AND_PROTECTIVE_ORDERS_MANUALLY']:[]),
   ...(held>0n?['RETAIN_RISK_RESERVATION_UNTIL_INDEPENDENT_CLOSURE']:[]),
   'KEEP_LIVE_EXECUTION_DISABLED'
  ])});
}
/** Pauses new entries in the existing B152 ledger without claiming to cancel broker orders. */
export function pausePrivatePaperEntries({ledger,session,connection},{env=process.env}={}){
 if(env.VERCEL_ENV==='production'||env.JENIOS_PRIVATE_PAPER_REHEARSAL!=='true')reject('PRIVATE_PAPER_REHEARSAL_REQUIRED');
 if(!session||session.authenticated!==true||session.diagnosticCompleted!==true||
  !connection||connection.userId!==session.userId||connection.provider!=='alpaca'||
  connection.environment!=='paper')reject('PRIVATE_PAPER_OWNER_REQUIRED');
 if(!ledger||typeof ledger.pause!=='function')reject('PERSISTENT_RISK_LEDGER_REQUIRED');
 const result=ledger.pause(session,connection,true);
 if(result.paused!==true||result.positionsClosed!==false||result.ordersCancelled!==false)
  reject('LEDGER_PAUSE_CONTRACT_DRIFT');
 return Object.freeze({...result,ordersSent:0,realExecution:false,externalBrokerAccess:false});
}
