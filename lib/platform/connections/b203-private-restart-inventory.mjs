/** B203 — read-only restart inventory over B152 and B178 private SQLite stores.
 * A restarted worker must NEVER infer that unclaimed or uncertain orders can be
 * automatically sent or re-sent. No broker network or ledger mutation occurs.
 */
const fail=code=>{throw Object.assign(new Error(code),{code});};
const ID=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/;
const HEX=/^[a-f0-9]{64}$/;
const RISK_STATES=new Set(['RESERVED','SUBMITTING','ACK','PARTIAL','FILLED','CANCELLED','REJECTED','UNKNOWN','CLOSED']);
const OUTBOX_STATES=new Set(['PREPARED','IN_FLIGHT','ACKED','REJECTED','AMBIGUOUS','RECONCILED','MISSING']);
export function inspectPrivateRestartInventory({session,connection,ledger,journal,intentProofs,nowMs},
 {env=process.env}={}){
 if(env.VERCEL||env.VERCEL_ENV||env.JENIOS_PRIVATE_PAPER_REHEARSAL!=='true'||
    env.JENIOS_PRIVATE_PAPER_READ_OBSERVER!=='true')fail('PRIVATE_RESTART_AUDIT_DISABLED');
 if(!session||session.authenticated!==true||session.diagnosticCompleted!==true||
  !connection||connection.userId!==session.userId||connection.provider!=='alpaca'||
  connection.environment!=='paper')fail('PRIVATE_PAPER_OWNER_REQUIRED');
 if(!ledger||typeof ledger.snapshot!=='function'||!journal||typeof journal.inspect!=='function')
  fail('DURABLE_RESTART_STORES_REQUIRED');
 if(!Array.isArray(intentProofs)||intentProofs.length>1000||
    !Number.isSafeInteger(nowMs)||nowMs<=0)fail('INVALID_RESTART_INPUT');
 const proofMap=new Map();
 for(const x of intentProofs){
  if(!x||!ID.test(x.clientOrderId||'')||!HEX.test(x.accountDigest||'')||
   !HEX.test(x.proposalDigest||'')||proofMap.has(x.clientOrderId))fail('INVALID_OR_DUPLICATE_INTENT_PROOF');
  proofMap.set(x.clientOrderId,x);
 }
 const rows=ledger.snapshot(session,connection);
 if(!Array.isArray(rows)||rows.length>1000)fail('INVALID_RESTART_LEDGER');
 let held=0n,filled=0n,unknown=0,unverified=0,dispatchAttempted=0,unclaimed=0,exposed=0;
 const outboxStates=Object.create(null);
 for(const row of rows){
  if(!row||!ID.test(row.client_id||'')||!RISK_STATES.has(row.state)||
    typeof row.held!=='string'||typeof row.filled!=='string'||
    !/^\d+$/.test(row.held)||!/^\d+$/.test(row.filled))fail('CORRUPT_RESTART_LEDGER_ROW');
  const h=BigInt(row.held),f=BigInt(row.filled);
  if((row.state==='UNKNOWN'&&h===0n)||(row.state==='CLOSED'&&h!==0n)||
     (row.state==='REJECTED'&&f!==0n))fail('CORRUPT_DURABLE_RISK_RESERVATION');
  held+=h;filled+=f;
  const proof=proofMap.get(row.client_id);
  if(proof)proofMap.delete(row.client_id);
  const dispatch=proof?journal.inspect({userId:session.userId,connectionId:connection.id,
   clientOrderId:row.client_id,accountDigest:proof.accountDigest,
   proposalDigest:proof.proposalDigest,atMs:nowMs}):null;
  const state=dispatch?.state||'MISSING';
  if(!OUTBOX_STATES.has(state))fail('CORRUPT_PRIVATE_OUTBOX_STATE');
  outboxStates[state]=(outboxStates[state]||0)+1;
  if(!proof||(!dispatch&&row.state!=='RESERVED'))unverified++;
  if(dispatch&&(!Number.isSafeInteger(dispatch.attempts)||dispatch.attempts<0||dispatch.attempts>1))
   fail('INVALID_RESTART_OUTBOX_ATTEMPTS');
  if(dispatch?.attempts===1)dispatchAttempted++;
  if(row.state==='RESERVED'&&(!dispatch||state==='PREPARED'))unclaimed++;
  if(['UNKNOWN','SUBMITTING'].includes(row.state)||['AMBIGUOUS','IN_FLIGHT'].includes(state))unknown++;
  if(f>0n&&row.state!=='CLOSED')exposed++;
 }
 if(proofMap.size)fail('PROOF_FOR_UNKNOWN_PAPER_INTENT');
 return Object.freeze({schema:'JENIOS_B203_PRIVATE_RESTART_INVENTORY',
  asOfMs:nowMs,orderCount:rows.length,heldRiskUnits:held.toString(),
  filledQuantityUnits:filled.toString(),ambiguousCount:unknown,
  unverifiedDispatchCount:unverified,previousOneShotAttempts:dispatchAttempted,
  reservedOrPreparedCount:unclaimed,openExposureCount:exposed,
  outboxStates:Object.freeze(outboxStates),
  disposition:unknown||unverified||exposed?'HALT_AND_REVIEW':'MANUAL_REVIEW_BEFORE_RESUME',
  entryPauseRecommended:unknown>0||unverified>0||exposed>0,
  independentBrokerEvidenceCertified:false,
  noAutomaticSubmissionAfterRestart:true,duplicateResubmissionAllowed:false,
  ledgerChanged:false,brokerOrdersCancelled:0,ordersSent:0,
  liveExecutionAuthorized:false});
}
