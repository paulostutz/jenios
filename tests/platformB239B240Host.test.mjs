import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,chmodSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {PaperLedger} from '../lib/platform/pilot-prep/paper-ledger.mjs';
import {AlpacaPaperDispatchJournal} from '../lib/platform/connections/alpaca-paper-dispatch-journal.mjs';
import {PrivatePaperReadAuditStore} from '../lib/platform/connections/b207-durable-read-audit.mjs';
import {inspectPrivatePaperObserverHost} from '../lib/platform/connections/b213-private-host-readiness.mjs';
import {inspectOperatorHostApproval} from '../lib/platform/release250/b239-worker-host-gate.mjs';
const env={JENIOS_DEMO_VAULT_KEY_B64:Buffer.alloc(32,8).toString('base64'),
 JENIOS_PAPER_OBSERVER_KEY_B64:Buffer.alloc(32,9).toString('base64'),
 JENIOS_PRIVATE_PAPER_REHEARSAL:'true',JENIOS_PRIVATE_PAPER_ACCOUNT_PREFLIGHT:'true',
 JENIOS_PRIVATE_PAPER_READ_OBSERVER:'true',JENIOS_PRIVATE_PAPER_OBSERVER_WORKER:'true'};
const host=fn=>{
 const root=mkdtempSync(join(tmpdir(),'jenios-b239-'));chmodSync(root,0o700);
 const a=join(root,'adapter');mkdirSync(a,{mode:0o700});const adapterPath=join(a,'adapter.mjs');
 writeFileSync(adapterPath,'export function createTrustedObserverScope(){}\n',{mode:0o600});
 const paths={adapterPath,riskPath:join(root,'risk.sqlite'),dispatchPath:join(root,'dispatch.sqlite'),auditPath:join(root,'audit.sqlite')};
 const ledger=new PaperLedger(paths.riskPath),journal=new AlpacaPaperDispatchJournal(paths.dispatchPath),audit=new PrivatePaperReadAuditStore(paths.auditPath,{env});
 try{ledger.close();journal.close();audit.close();return fn(paths);}finally{rmSync(root,{recursive:true,force:true});}
};
test('B239 checks actual 3 durable sqlite stores and protected adapter without starting a daemon',()=>host(paths=>{
 const result=inspectPrivatePaperObserverHost(paths,{env});assert.equal(result.isolatedSqliteStoresVerified,3);
 const approval=inspectOperatorHostApproval({hostInspection:result,healthInspection:{schema:'JENIOS_B212_PRIVATE_AUDIT_HEALTH',ordersSent:0}});
 assert.equal(approval.packageReadyForIndependentOperatorInspection,true);assert.equal(approval.persistentWorkerInstalled,false);
 assert.equal(approval.ordersSent,0);
}));
test('B239/B240 insecure sqlite directory or duplicate database cannot pass host preflight',()=>host(paths=>{
 chmodSync(paths.riskPath,0o644);
 assert.throws(()=>inspectPrivatePaperObserverHost(paths,{env}),/PRIVATE_SQLITE_PERMISSIONS_INVALID/);
 chmodSync(paths.riskPath,0o600);
 assert.throws(()=>inspectPrivatePaperObserverHost({...paths,auditPath:paths.riskPath},{env}),/PRIVATE_SQLITE_STORES_NOT_SEPARATE/);
}));
test('B240 unsigned health result is not a real installed worker or broker authorization',()=>{
 const result=inspectOperatorHostApproval({hostInspection:{schema:'JENIOS_B213_PRIVATE_HOST_PREFLIGHT',sqliteIntegrityVerified:true,isolatedSqliteStoresVerified:3,observerSigningKeySeparate:true,workerServiceInstalledByThisCheck:false},healthInspection:null});
 assert.equal(result.packageReadyForIndependentOperatorInspection,false);
 assert.equal(result.externalAccountAuthenticated,false);
});
