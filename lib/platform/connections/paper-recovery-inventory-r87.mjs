/** R87 read-only restart inventory. No provider network, orders or credentials. */
import {PaperLedger} from '../pilot-prep/paper-ledger.mjs';
const deny=code=>{throw Object.assign(new Error(code),{code});};
export function inspectR87RecoveryInventory({session,connection,ledger,env=process.env}={}){
 if(env.JENIOS_REAL_EXECUTION_ENABLED!=='false'||
    env.JENIOS_PRIVATE_PAPER_EXECUTOR!=='false'||
    env.JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED!=='false'||
    env.JENIOS_R87_PRIVATE_RECOVERY_ENABLED!=='false')
  deny('R87_RECOVERY_INVENTORY_DISABLED');
 if(!session?.authenticated||!session?.diagnosticCompleted||
    !session.userId||session.userId!==connection?.userId||
    connection?.provider!=='alpaca'||connection?.environment!=='paper'||
    !(ledger instanceof PaperLedger))
  deny('R87_RECOVERY_INVENTORY_SCOPE_DENIED');
 const pending=ledger.pendingRecovery(session,connection);
 return Object.freeze({paperOnly:true,readOnly:true,ordersSent:0,
  automaticResubmissionAllowed:false,requiresBrokerReconciliation:pending.length>0,
  pending});
}
