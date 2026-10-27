import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,rmSync,chmodSync,readdirSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {runR95OfflineStorageProbe} from '../lib/platform/connections/private-host-continuity-r95.mjs';

const id='50b85e9d-339c-4d32-b2bf-82c467673832';
const env={JENIOS_R95_OFFLINE_STORAGE_PROBE_ENABLED:'true',
 JENIOS_R95_PRIVATE_RUNTIME_CLASS:'isolated-node',
 JENIOS_R94_PRIVATE_WORKER_ENABLED:'false',JENIOS_R94_READONLY_ONLY:'true',
 JENIOS_R93_PRIVATE_NODE_WORKER:'false',
 JENIOS_R93_READONLY_RECOVERY_ENABLED:'false',
 JENIOS_REAL_EXECUTION_ENABLED:'false',
 JENIOS_PRIVATE_PAPER_EXECUTOR:'false',
 JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED:'false',
 JENIOS_R80_PRIVATE_ISSUER_ENABLED:'false',
 JENIOS_R82_ALPACA_LIVE_ORDER_EXECUTION_ENABLED:'false',
 JENIOS_R83_PRIVATE_NODE_WORKER:'false',
 JENIOS_PAY_PAYMENTS_ENABLED:'false',JENIOS_INTER_CHARGES_ENABLED:'false'};
function temp(){
 const dir=mkdtempSync(join(process.cwd(),'.jenios-r95-'));
 const volume=join(dir,'private');mkdirSync(volume,{mode:0o700});
 return {dir,volume,cleanup:()=>rmSync(dir,{recursive:true,force:true})};
}
test('R95 offline canary reopens real SQLite, reports no deployment or durable mount certification',()=>{
 const f=temp();
 try{
  const a=runR95OfflineStorageProbe({env,volumePath:f.volume,canaryConnectionId:id});
  assert.equal(a.localSqliteReopenVerified,true);
  assert.equal(a.actualPersistentMountCertified,false);
  assert.equal(a.restoreAfterDeploymentCertified,false);
  assert.equal(a.workerDeployed,false);
  assert.equal(a.brokerCalls,0);
  assert.equal(a.ordersSent,0);
  assert.equal(a.liveExecution,false);
  assert.equal(readdirSync(f.volume).some(name=>name.endsWith('.sqlite')),true);
  const repeat=runR95OfflineStorageProbe({env,volumePath:f.volume,canaryConnectionId:id});
  assert.equal(repeat.localSqliteReopenVerified,true);
 }finally{f.cleanup();}
});
test('R95 refuses web, unapproved flags, invalid canary and weak permissions',()=>{
 const f=temp();
 try{
  for(const bad of [{VERCEL:'1'},{VERCEL_ENV:'preview'},
   {JENIOS_R95_OFFLINE_STORAGE_PROBE_ENABLED:'false'},
   {JENIOS_PRIVATE_PAPER_EXECUTOR:'true'},
   {JENIOS_REAL_EXECUTION_ENABLED:'true'},
   {JENIOS_R94_PRIVATE_WORKER_ENABLED:'true'}]){
   assert.throws(()=>runR95OfflineStorageProbe({env:{...env,...bad},
    volumePath:f.volume,canaryConnectionId:id}));
  }
  assert.throws(()=>runR95OfflineStorageProbe({env,volumePath:f.volume,
   canaryConnectionId:'../fake'}),/R95_CANARY_UUID_REQUIRED/);
  chmodSync(f.volume,0o755);
  assert.throws(()=>runR95OfflineStorageProbe({env,volumePath:f.volume,
   canaryConnectionId:id}),/R94_VOLUME_OWNERSHIP_REQUIRED/);
 }finally{f.cleanup();}
});
test('R95 CLI defaults to refusal, then returns only bounded nonsecret evidence',()=>{
 const f=temp();
 const cli=new URL('../scripts/platform/connections/r95-private-host-check.mjs',import.meta.url).pathname;
 try{
  const disabled=spawnSync(process.execPath,[cli],{encoding:'utf8'});
  assert.notEqual(disabled.status,0);
  assert.match(disabled.stderr,/R95_EXPLICIT_OFFLINE_PREFLIGHT_REQUIRED/);
  const result=spawnSync(process.execPath,[cli,'--offline-preflight'],
   {encoding:'utf8',env:{...process.env,...env,
    JENIOS_R95_PRIVATE_VOLUME:f.volume,
    JENIOS_R95_CANARY_CONNECTION_ID:id}});
  assert.equal(result.status,0,result.stderr);
  const output=JSON.parse(result.stdout);
  assert.equal(output.ordersSent,0);
  assert.equal(output.actualPersistentMountCertified,false);
  assert.doesNotMatch(result.stdout,/private|secret|apiKey|sk-proj/i);
 }finally{f.cleanup();}
});
