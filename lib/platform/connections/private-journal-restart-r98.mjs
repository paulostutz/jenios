/** R98 — offline-only durable B152 crash/restart observation.
 * No user HTTP route, worker scheduler, broker contact or order dispatch.
 * Observation of a journal is NOT evidence of broker fills or Live readiness.
 */
import {PaperLedger} from '../pilot-prep/paper-ledger.mjs';
import {alpacaPaperLedgerConnection} from './alpaca-paper-risk-rehearsal.mjs';
const deny=code=>{throw Object.assign(new Error(code),{code});};
const NONNEGATIVE=/^(0|[1-9][0-9]{0,40})$/;

function offlineGate(env){
 if(env.VERCEL!==undefined||env.VERCEL_ENV!==undefined||
    env.JENIOS_R98_OFFLINE_CRASH_PROBE_ONLY!=='true'||
    env.JENIOS_PRIVATE_PAPER_REHEARSAL!=='true'||
    env.JENIOS_REAL_EXECUTION_ENABLED!=='false'||
    env.JENIOS_PRIVATE_PAPER_EXECUTOR!=='false'||
    env.JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED!=='false'||
    env.JENIOS_R80_PRIVATE_ISSUER_ENABLED!=='false'||
    env.JENIOS_R83_PRIVATE_NODE_WORKER!=='false'||
    env.JENIOS_PAY_PAYMENTS_ENABLED!=='false'||
    env.JENIOS_INTER_CHARGES_ENABLED!=='false')
    deny('R98_OFFLINE_ONLY');
}
/** Only server-side fixtures or an isolated private Node harness may call this.
 * The account identity is checked by the existing B175 binding, and all
 * pending entries come from the B152 journal, not from caller-provided orders.
 */
export function inspectR98CrashRecovery({
 session,storedConnection,ledger,nowMs
},{env=process.env}={}){
 offlineGate(env);
 if(!(ledger instanceof PaperLedger)||session?.authenticated!==true||
    session?.diagnosticCompleted!==true||!Number.isSafeInteger(nowMs)||
    nowMs<=0)deny('R98_TRUSTED_LEDGER_REQUIRED');
 const bound=alpacaPaperLedgerConnection(session.userId,storedConnection,{env,now:nowMs});
 const pending=ledger.pendingRecovery(session,bound);
 const snapshot=ledger.snapshot(session,bound);
 if(!Array.isArray(pending)||!Array.isArray(snapshot))
    deny('R98_JOURNAL_UNAVAILABLE');
 let held=0n;
 for(const row of snapshot){
  if(!row||typeof row.held!=='string'||!NONNEGATIVE.test(row.held)||
     !['RESERVED','SUBMITTING','UNKNOWN','ACK','PARTIAL','FILLED','CANCELLED','REJECTED','CLOSED'].includes(row.state))
    deny('R98_JOURNAL_INTEGRITY_FAILED');
  held+=BigInt(row.held);
 }
 return Object.freeze({schema:'JENIOS_R98_OFFLINE_CRASH_RECOVERY_V1',
  journalObserved:true,recoveryPendingCount:pending.length,
  unknownCount:pending.filter(item=>item.previousState==='UNKNOWN').length,
  heldRiskUnits:held.toString(),
  brokerConfirmationVerified:false,providerOrdersSent:0,
  offlineOnly:true,readOnly:true,liveExecution:false,
  automaticResubmissionAllowed:false,
  externalDurableVolumeCertified:false,backupPolicyCertified:false,
  recoveryAcrossHostRedeployCertified:false});
}
