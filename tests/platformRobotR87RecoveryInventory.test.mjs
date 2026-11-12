import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {PaperLedger} from '../lib/platform/pilot-prep/paper-ledger.mjs';
import {inspectR87RecoveryInventory} from '../lib/platform/connections/paper-recovery-inventory-r87.mjs';
const owner='4d238a7a-8c7b-4d8e-9a10-1c5c82db59a7';
const connection={id:'50b85e9d-339c-4d32-b2bf-82c467673832',userId:owner,
 provider:'alpaca',accountId:'synthetic-paper-account',environment:'paper',
 permissions:['read'],revoked:false,ownershipConfirmedAtMs:1793091600000};
const session={userId:owner,authenticated:true,diagnosticCompleted:true};
const env={JENIOS_REAL_EXECUTION_ENABLED:'false',JENIOS_PRIVATE_PAPER_EXECUTOR:'false',
 JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED:'false',JENIOS_R87_PRIVATE_RECOVERY_ENABLED:'false'};
test('R87 restart inventory uses SQLite journal, no external calls or orders',()=>{
 const dir=mkdtempSync(join(tmpdir(),'jenios-r87-'));let ledger;
 try{
  ledger=new PaperLedger(join(dir,'journal.db'));
  ledger.configure(session,connection,{currency:'USD',ownerRisk:'10',accountRisk:'8',
   orderRisk:'4',notional:'1000',dailyLoss:'10',maxOrders:3});
  const result=inspectR87RecoveryInventory({session,connection,ledger,env});
  assert.equal(result.ordersSent,0);
  assert.equal(result.automaticResubmissionAllowed,false);
  assert.deepEqual(result.pending,[]);
  assert.equal(result.requiresBrokerReconciliation,false);
  assert.throws(()=>inspectR87RecoveryInventory({session:{...session,userId:connection.id},
   connection,ledger,env}),/R87_RECOVERY_INVENTORY_SCOPE_DENIED/);
  assert.throws(()=>inspectR87RecoveryInventory({session,connection,ledger,
   env:{...env,JENIOS_REAL_EXECUTION_ENABLED:'true'}}),/R87_RECOVERY_INVENTORY_DISABLED/);
 }finally{ledger?.close();rmSync(dir,{recursive:true,force:true});}
});
