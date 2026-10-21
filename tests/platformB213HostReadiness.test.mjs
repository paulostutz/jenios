import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,chmodSync,writeFileSync,rmSync,symlinkSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {PaperLedger} from '../lib/platform/pilot-prep/paper-ledger.mjs';
import {AlpacaPaperDispatchJournal} from '../lib/platform/connections/alpaca-paper-dispatch-journal.mjs';
import {PrivatePaperReadAuditStore} from '../lib/platform/connections/b207-durable-read-audit.mjs';
import {inspectPrivatePaperObserverHost} from '../lib/platform/connections/b213-private-host-readiness.mjs';
const env={JENIOS_PRIVATE_PAPER_REHEARSAL:'true',JENIOS_PRIVATE_PAPER_ACCOUNT_PREFLIGHT:'true',
 JENIOS_PRIVATE_PAPER_READ_OBSERVER:'true',JENIOS_PRIVATE_PAPER_OBSERVER_WORKER:'true',
 JENIOS_DEMO_VAULT_KEY_B64:Buffer.alloc(32,4).toString('base64'),
 JENIOS_PAPER_OBSERVER_KEY_B64:Buffer.alloc(32,7).toString('base64')};
function fixture(fn){
 const dir=mkdtempSync(join(tmpdir(),'jenios-b213-'));chmodSync(dir,0o700);
 const privateDir=join(dir,'adapter');mkdirSync(privateDir,{mode:0o700});
 const adapterPath=join(privateDir,'adapter.mjs');writeFileSync(adapterPath,'export function createTrustedObserverScope(){}\n',{mode:0o600});
 const paths={adapterPath,riskPath:join(dir,'risk.sqlite'),
  dispatchPath:join(dir,'dispatch.sqlite'),auditPath:join(dir,'audit.sqlite')};
 const risk=new PaperLedger(paths.riskPath),journal=new AlpacaPaperDispatchJournal(paths.dispatchPath),
  audit=new PrivatePaperReadAuditStore(paths.auditPath,{env});
 risk.close();journal.close();audit.close();
 try{return fn(paths);}finally{rmSync(dir,{recursive:true,force:true});}
}
const run=(paths,override={})=>inspectPrivatePaperObserverHost(paths,{env,...override});
test('B213 validates three real B152 B178 B207 schemas, host permissions and separate keys',()=>fixture(paths=>{
 const result=run(paths);assert.equal(result.isolatedSqliteStoresVerified,3);
 assert.equal(result.sqliteIntegrityVerified,true);
 assert.equal(result.workerServiceInstalledByThisCheck,false);
 assert.equal(result.networkCalls,0);assert.equal(result.ordersSent,0);
 assert.equal(result.liveExecutionAuthorized,false);
 assert.equal(JSON.stringify(result).includes(paths.riskPath),false);
}));
test('B213 rejects a shared observer/vault key',()=>fixture(paths=>{
 assert.throws(()=>run(paths,{env:{...env,JENIOS_PAPER_OBSERVER_KEY_B64:env.JENIOS_DEMO_VAULT_KEY_B64}}),
 /PRIVATE_WORKER_KEYS_MUST_BE_DISTINCT/);
}));
test('B213 refuses a missing database, chmod drift and file symlink',()=>fixture(paths=>{
 chmodSync(paths.riskPath,0o644);
 assert.throws(()=>run(paths),/PRIVATE_SQLITE_PERMISSIONS_INVALID/);
 chmodSync(paths.riskPath,0o600);
 const link=join(paths.riskPath+'.alias');symlinkSync(paths.riskPath,link);
 assert.throws(()=>run({...paths,riskPath:link}),/PRIVATE_SQLITE_PERMISSIONS_INVALID/);
 assert.throws(()=>run({...paths,auditPath:paths.riskPath}),/PRIVATE_SQLITE_STORES_NOT_SEPARATE/);
}));
test('B213 missing expected tables is not a certified host',()=>fixture(paths=>{
 assert.throws(()=>run({...paths,dispatchPath:paths.auditPath}),/PRIVATE_SQLITE_STORES_NOT_SEPARATE/);
}));
test('B213 rejects unreviewed runtimes and Vercel environments',()=>fixture(paths=>{
 assert.throws(()=>run(paths,{nodeVersion:'20.0.0'}),/UNREVIEWED_PRIVATE_WORKER_RUNTIME/);
 assert.throws(()=>run(paths,{platform:'darwin'}),/UNREVIEWED_PRIVATE_WORKER_RUNTIME/);
 assert.throws(()=>run(paths,{env:{...env,VERCEL_ENV:'preview'}}),/PRIVATE_GET_ONLY_WORKER_DISABLED/);
}));
