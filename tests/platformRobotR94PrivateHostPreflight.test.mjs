import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,rmSync,chmodSync,lstatSync,symlinkSync} from 'node:fs';
import {join} from 'node:path';
import {inspectR94PrivateHost,openR94PrivateJournal} from '../lib/platform/connections/private-host-preflight-r94.mjs';
const id='50b85e9d-339c-4d32-b2bf-82c467673832';
const env={JENIOS_R94_PRIVATE_WORKER_ENABLED:'false',
 JENIOS_R94_READONLY_ONLY:'true',JENIOS_R93_PRIVATE_NODE_WORKER:'false',
 JENIOS_R93_READONLY_RECOVERY_ENABLED:'false',
 JENIOS_REAL_EXECUTION_ENABLED:'false',
 JENIOS_PRIVATE_PAPER_EXECUTOR:'false',
 JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED:'false',
 JENIOS_R80_PRIVATE_ISSUER_ENABLED:'false',
 JENIOS_R82_ALPACA_LIVE_ORDER_EXECUTION_ENABLED:'false',
 JENIOS_R83_PRIVATE_NODE_WORKER:'false',
 JENIOS_PAY_PAYMENTS_ENABLED:'false',
 JENIOS_INTER_CHARGES_ENABLED:'false'};
test('R94 preflight is disabled and refuses untrusted volume, symlink and weak permissions',()=>{
 const dir=mkdtempSync(join(process.cwd(),'.jenios-r94-'));
 try{
  const volume=join(dir,'private');mkdirSync(volume,{mode:0o700});
  const p=inspectR94PrivateHost({env,volumePath:volume});
  assert.equal(p.workerDeployed,false);assert.equal(p.durabilityCertified,false);
  assert.equal(p.ordersSent,0);
  for(const bad of [
   {JENIOS_R94_PRIVATE_WORKER_ENABLED:'true'},
   {JENIOS_R93_PRIVATE_NODE_WORKER:'true'},
   {JENIOS_PRIVATE_PAPER_EXECUTOR:'true'},
   {JENIOS_REAL_EXECUTION_ENABLED:'true'},
   {JENIOS_R94_READONLY_ONLY:'false'}
  ])assert.throws(()=>inspectR94PrivateHost({env:{...env,...bad},volumePath:volume}),
   /R94_PRIVATE_WORKER_MUST_BE_DISABLED/);
  const link=join(dir,'redirected-volume');
  symlinkSync(volume,link);
  assert.throws(()=>inspectR94PrivateHost({env,volumePath:link}),
   /R94_VOLUME_SYMLINK_DENIED/);
  assert.throws(()=>inspectR94PrivateHost({env,volumePath:'/tmp/jenios-r94-forbidden'}),
   /R94_PERSISTENT_VOLUME_REQUIRED/);
  chmodSync(volume,0o755);
  assert.throws(()=>inspectR94PrivateHost({env,volumePath:volume}),
   /R94_VOLUME_OWNERSHIP_REQUIRED/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('R94 private journal uses deterministic owner-protected SQLite path',()=>{
 const dir=mkdtempSync(join(process.cwd(),'.jenios-r94-'));
 try{
  const volume=join(dir,'private');mkdirSync(volume,{mode:0o700});
  const opened=openR94PrivateJournal({env,volumePath:volume,connectionId:id});
  assert.equal(opened.workerDeployed,false);
  assert.equal(opened.liveExecution,false);
  assert.equal(opened.journal.pendingRecovery instanceof Function,true);
  opened.close();
  // Reopening the same absolute path must preserve an existing SQLite journal.
  const reopened=openR94PrivateJournal({env,volumePath:volume,connectionId:id});
  assert.equal(reopened.storagePath,opened.storagePath);
  reopened.close();
  const file=lstatSync(opened.storagePath);
  assert.equal(file.isFile(),true);
  assert.equal(file.mode&0o077,0);
  assert.throws(()=>openR94PrivateJournal({env,volumePath:volume,
    connectionId:'../escape'}),/R94_CONNECTION_ID_REQUIRED/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
