/** B202 — correlates EXISTING B152 SQLite risk, B178 one-shot outbox and B201 GETs.
 * Private read-only inspection: never calls event(), claim(), POST, cancel, or retry.
 * Untrusted GET/fixture data is not a reconciliation authorization.
 */
import {units} from '../pilot-prep/contracts.mjs';
const fail=code=>{throw Object.assign(new Error(code),{code});};
const ID=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/;
const HEX=/^[a-f0-9]{64}$/;
const VALID_STATES=new Set(['RESERVED','SUBMITTING','ACK','PARTIAL','FILLED','CANCELLED','REJECTED','UNKNOWN','CLOSED']);
const VALID_DISPATCH=new Set(['PREPARED','IN_FLIGHT','ACKED','REJECTED','AMBIGUOUS','RECONCILED']);
function guard({session,connection,ledger,journal,env}){
 if(env.VERCEL||env.VERCEL_ENV||env.JENIOS_PRIVATE_PAPER_REHEARSAL!=='true'||
  env.JENIOS_PRIVATE_PAPER_READ_OBSERVER!=='true')fail('ISOLATED_PAPER_AUDIT_DISABLED');
 if(!session||session.authenticated!==true||session.diagnosticCompleted!==true||
  !connection||connection.userId!==session.userId||connection.provider!=='alpaca'||
  connection.environment!=='paper')fail('PAPER_ACCOUNT_OWNER_REQUIRED');
 if(!ledger||typeof ledger.snapshot!=='function'||!journal||typeof journal.inspect!=='function')
  fail('DURABLE_PAPER_STORES_REQUIRED');
}
export function auditPaperLedgerOutboxReadOnly({session,connection,clientOrderId,
 accountDigest,proposalDigest,ledger,journal,pairedObservation=null,nowMs},
 {env=process.env}={}){
 guard({session,connection,ledger,journal,env});
 if(!ID.test(clientOrderId||'')||!HEX.test(accountDigest||'')||!HEX.test(proposalDigest||'')||
  !Number.isSafeInteger(nowMs)||nowMs<=0)fail('INVALID_PRIVATE_AUDIT_SCOPE');
 const rows=ledger.snapshot(session,connection);
 if(!Array.isArray(rows)||rows.length>1000)fail('INVALID_PRIVATE_RISK_SNAPSHOT');
 const risk=rows.find(row=>row.client_id===clientOrderId);
 if(!risk)fail('PAPER_INTENT_NOT_IN_LEDGER');
 if(!VALID_STATES.has(risk.state)||typeof risk.held!=='string'||
   typeof risk.filled!=='string'||!/^\d+$/.test(risk.held)||!/^\d+$/.test(risk.filled))
  fail('PAPER_RISK_ROW_CORRUPT');
 const held=BigInt(risk.held),filled=BigInt(risk.filled);
 if(risk.state==='UNKNOWN'&&held===0n)fail('UNKNOWN_RISK_MUST_REMAIN_RESERVED');
 const outbox=journal.inspect({userId:session.userId,connectionId:connection.id,
  clientOrderId,accountDigest,proposalDigest,atMs:nowMs});
 if(outbox&&(!VALID_DISPATCH.has(outbox.state)||!Number.isSafeInteger(outbox.attempts)||
  outbox.attempts<0||outbox.attempts>1))fail('INVALID_OUTBOX_RECORD');
 const conflict=[];
 if(!outbox&&risk.state!=='RESERVED')conflict.push('MISSING_DISPATCH_RECORD');
 if(outbox?.state==='PREPARED'&&risk.state!=='RESERVED')conflict.push('PREPARED_OUTBOX_WITH_RISK_ADVANCED');
 if(outbox?.state==='IN_FLIGHT'&&risk.state==='RESERVED')conflict.push('OUTBOX_CLAIMED_BEFORE_RISK_SUBMITTING');
 if(outbox?.state==='RECONCILED'&&risk.state==='UNKNOWN')conflict.push('OUTBOX_RECONCILED_WITH_UNKNOWN_RISK');
 if(outbox?.state==='PREPARED'&&outbox.attempts!==0)conflict.push('PREPARED_HAS_NETWORK_ATTEMPT');
 if(outbox&&outbox.state!=='PREPARED'&&outbox.attempts!==1)conflict.push('DISPATCH_ATTEMPTS_INCONSISTENT');
 if(pairedObservation!==null){
  if(!pairedObservation||pairedObservation.schema!=='JENIOS_B201_PRIVATE_PAIRED_PAPER_READ'||
   !['STABLE_TERMINAL_OBSERVATIONS','STABLE_NONTERMINAL_OBSERVATIONS',
    'EVOLVING_OR_AMBIGUOUS','ORDER_NOT_FOUND_IS_UNKNOWN'].includes(pairedObservation.assessment)||
   pairedObservation.ordersSent!==0||pairedObservation.independentlyAttested!==false)
   fail('UNTRUSTED_PAPER_OBSERVATION_CONTRACT');
  if(pairedObservation.lastCumulativeQuantity!==undefined){
   const observed=units(pairedObservation.lastCumulativeQuantity);
   if(observed<filled)conflict.push('BROKER_REPORTED_FILL_BELOW_DURABLE_LEDGER');
   if(risk.state==='REJECTED'&&observed>0n)conflict.push('BROKER_FILL_AFTER_LOCAL_REJECTION');
  }
  if(pairedObservation.assessment==='ORDER_NOT_FOUND_IS_UNKNOWN')conflict.push('404_IS_NOT_A_REJECTION');
 }
 const ambiguous=['UNKNOWN','SUBMITTING'].includes(risk.state)||
  ['IN_FLIGHT','AMBIGUOUS'].includes(outbox?.state)||
  pairedObservation?.assessment==='EVOLVING_OR_AMBIGUOUS';
 const exposure=filled>0n&&risk.state!=='CLOSED';
 const unsafe=conflict.length>0||ambiguous||exposure;
 const severity=conflict.length||ambiguous?'critical':exposure?'high':'review';
 const classification=conflict.length?'INCONSISTENT_EVIDENCE_NO_GO':
  ambiguous?'UNKNOWN_BROKER_STATE_NO_GO':
  exposure?'OPEN_EXPOSURE_MANUAL_PROTECTION_REVIEW':'REVIEW_REQUIRED_NO_AUTO_ACTION';
 return Object.freeze({schema:'JENIOS_B202_LEDGER_OUTBOX_READONLY_AUDIT',
  asOfMs:nowMs,classification,severity,riskState:risk.state,
  outboxState:outbox?.state||'NOT_PREPARED',outboxAttemptCount:outbox?.attempts||0,
  heldRiskUnits:risk.held,filledUnits:risk.filled,
  conflictCodes:Object.freeze(conflict),
  entryPauseRecommended:unsafe,
  manualBrokerReconciliationRequired:true,
  // Neither mock receipts nor caller supplied flags may authorize a mutation.
  brokerIndependentEvidenceCertified:false,ledgerChanged:false,
  dispatchReclaimed:false,ordersSent:0,
  automaticOrderRetryAllowed:false,liveExecutionAuthorized:false});
}
