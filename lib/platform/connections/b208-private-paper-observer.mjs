/** B208 — one human-granted observation cycle, never order execution.
 * Coordinates the PRE-EXISTING Alpaca GET reader, B152 durable risk, B178 one-shot
 * dispatch journal, B201-B204 audit and B207 observation journal. All mutations
 * are LIMITED to local entry pause and redacted observation bookkeeping.
 */
import {assertIsolatedReadWorker,verifyPrivatePaperReadGrant,createOfficialPaperGetBoundary} from './b206-private-read-boundary.mjs';
import {alpacaPaperLedgerConnection} from './alpaca-paper-risk-rehearsal.mjs';
import {collectPrivatePaperOrderPair} from './b201-private-paired-paper-reader.mjs';
import {auditPaperLedgerOutboxReadOnly} from './b202-paper-ledger-outbox-audit.mjs';
import {inspectPrivateRestartInventory} from './b203-private-restart-inventory.mjs';
import {compileRedactedPaperReview} from './b204-redacted-paper-review.mjs';
import {pausePrivatePaperEntries} from './b191-private-recovery-runbook.mjs';
import {readDemoBroker} from './demo-broker-reader.mjs';
const deny=code=>{throw Object.assign(new Error(code),{code});};
const ID=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/;
const SHA=/^[a-f0-9]{64}$/;
const STATES=new Set(['RESERVED','SUBMITTING','ACK','PARTIAL','FILLED','CANCELLED','REJECTED','UNKNOWN','CLOSED']);
const CLOSED_FAILURE=Object.freeze({assessment:'HALT_PRIVATE_OPERATOR_REVIEW',
  ordersSent:0,automaticOrderResubmissionAllowed:false,externalPaperOrderAuthorized:false,
  liveExecution:false,productionPromotionAllowed:false});
export async function observePrivatePaperOnce({session,storedConnection,clientOrderId,
 symbol,expectedQuantity,accountDigest,proposalDigest,auditId,intentProofs,grant,nowMs},
 {env=process.env,ledger,journal,auditStore,refreshConnection,reader=readDemoBroker,
 fetcher=fetch,now=Date.now,delay}={}){
 assertIsolatedReadWorker(env);
 if(!session||session.authenticated!==true||session.diagnosticCompleted!==true||
  typeof refreshConnection!=='function'||typeof reader!=='function'||
  typeof fetcher!=='function'||typeof now!=='function'||
  !ledger||typeof ledger.snapshot!=='function'||typeof ledger.pause!=='function'||
  !journal||typeof journal.inspect!=='function'||!auditStore||
  typeof auditStore.claim!=='function'||typeof auditStore.record!=='function'||
  typeof auditStore.failClosed!=='function'||
  !ID.test(clientOrderId||'')||!ID.test(auditId||'')||
  !SHA.test(accountDigest||'')||!SHA.test(proposalDigest||'')||
  !Number.isSafeInteger(nowMs)||nowMs<=0)
   deny('PRIVATE_PAPER_WORKER_DEPENDENCIES_REQUIRED');
 // Canonical B175 account binding is always derived from trusted server storage.
 const connection=alpacaPaperLedgerConnection(session.userId,storedConnection,{env,now:nowMs});
 if(connection.accountId!==accountDigest||connection.id!==storedConnection.id)
  deny('PRIVATE_PAPER_WORKER_ACCOUNT_CHANGED');
 if(!Array.isArray(intentProofs)||!intentProofs.some(p=>p?.clientOrderId===clientOrderId&&
  p.accountDigest===accountDigest&&p.proposalDigest===proposalDigest))
  deny('PRIVATE_PAPER_WORKER_INTENT_PROOF_REQUIRED');
 const scope={userId:session.userId,connectionId:connection.id,clientOrderId,auditId};
 verifyPrivatePaperReadGrant(grant,{...scope,accountDigest},{env,nowMs});
 const risk=ledger.snapshot(session,connection).find(r=>r.client_id===clientOrderId);
 if(!risk||!STATES.has(risk.state))deny('PRIVATE_PAPER_RISK_ORDER_NOT_FOUND');
 // Duplicate auditId (including a crashed/expired cycle) NEVER fetches again.
 const lease=auditStore.claim(scope,{nowMs,leaseMs:120000});
 if(lease.claimed!==true){
  // A crashed/in-progress observer is NEVER restarted automatically. Halt entries
  // conservatively even if the original worker failed before its first GET.
  let locallyPaused=false;
  try{locallyPaused=pausePrivatePaperEntries({ledger,session,connection},{env}).paused===true;}catch{}
  return Object.freeze({schema:'JENIOS_B208_PRIVATE_OBSERVER',
   ...CLOSED_FAILURE,assessment:'DUPLICATE_OR_EXPIRED_AUDIT_NO_AUTOMATIC_RETRY',
   auditDigest:lease.auditDigest,previousState:lease.state,
   entryPausedLocally:locallyPaused,entryPauseRecommended:true});
 }
 let paused=false;
 const pauseLocal=()=>{
  const r=pausePrivatePaperEntries({ledger,session,connection},{env});
  if(r.paused!==true)deny('PRIVATE_RISK_PAUSE_NOT_CONFIRMED');
  paused=true;
 };
 try{
  const inventory=inspectPrivateRestartInventory({session,connection,ledger,journal,
   intentProofs,nowMs},{env});
  // Halt new entries BEFORE touching any provider when durable state is uncertain.
  if(inventory.entryPauseRecommended||['SUBMITTING','UNKNOWN','PARTIAL','FILLED'].includes(risk.state))
   pauseLocal();
  const boundedFetch=createOfficialPaperGetBoundary(fetcher,{maxCalls:5});
  const pair=await collectPrivatePaperOrderPair({session,storedConnection,clientOrderId,
   symbol,expectedQuantity,nowMs},{env,refreshConnection,reader,fetcher:boundedFetch,
   now, ...(delay?{delay}:{})});
  const measured=now();
  if(!Number.isSafeInteger(measured)||measured<nowMs||measured>nowMs+120000)
   deny('PRIVATE_AUDIT_CLOCK_DRIFT');
  const ledgerAudit=auditPaperLedgerOutboxReadOnly({session,connection,clientOrderId,
   accountDigest,proposalDigest,ledger,journal,pairedObservation:pair,nowMs:measured},{env});
  const afterRestart=inspectPrivateRestartInventory({session,connection,ledger,journal,
   intentProofs,nowMs:measured},{env});
  const report=compileRedactedPaperReview({pairedRead:pair,ledgerAudit,
   restartInventory:afterRestart,nowMs:measured});
  if(ledgerAudit.entryPauseRecommended||report.severity!=='REVIEW'){
   if(!paused)pauseLocal();
  }
  const saved=auditStore.record(scope,{nowMs:measured,report});
  return Object.freeze({schema:'JENIOS_B208_PRIVATE_OBSERVER',assessment:'REVIEW_RECORDED',
   auditDigest:saved.auditDigest,entryPausedLocally:paused,
   officialReadCalls:boundedFetch.count,report,
   ordersSent:0,automaticOrderResubmissionAllowed:false,
   externalPaperOrderAuthorized:false,liveExecution:false,
   productionPromotionAllowed:false});
 }catch{
  // Never surface credential/URL/provider exceptions to the caller or logs.
  try{if(!paused)pauseLocal();}catch{}
  try{auditStore.failClosed(scope,{nowMs:Math.max(nowMs,now()),
   code:'PRIVATE_AUDIT_UNCONFIRMED'});}catch{}
  return Object.freeze({schema:'JENIOS_B208_PRIVATE_OBSERVER',
   ...CLOSED_FAILURE,entryPausedLocally:paused,auditDigest:lease.auditDigest});
 }
}
