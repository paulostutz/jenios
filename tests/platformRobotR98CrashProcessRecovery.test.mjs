import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,rmSync,copyFileSync,readdirSync,statSync} from 'node:fs';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';

const fixtureFile=new URL('./fixtures/r98-offline-crash-child.mjs',import.meta.url).pathname;
const connectionId='50b85e9d-339c-4d32-b2bf-82c467673832';
const flags={
 JENIOS_R98_FIXTURE_ONLY:'true',
 JENIOS_R98_OFFLINE_CRASH_PROBE_ONLY:'true',
 JENIOS_PRIVATE_PAPER_REHEARSAL:'true',
 JENIOS_R94_PRIVATE_WORKER_ENABLED:'false',
 JENIOS_R94_READONLY_ONLY:'true',
 JENIOS_R93_PRIVATE_NODE_WORKER:'false',
 JENIOS_R93_READONLY_RECOVERY_ENABLED:'false',
 JENIOS_REAL_EXECUTION_ENABLED:'false',
 JENIOS_PRIVATE_PAPER_EXECUTOR:'false',
 JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED:'false',
 JENIOS_R80_PRIVATE_ISSUER_ENABLED:'false',
 JENIOS_R82_ALPACA_LIVE_ORDER_EXECUTION_ENABLED:'false',
 JENIOS_R83_PRIVATE_NODE_WORKER:'false',
 JENIOS_PAY_PAYMENTS_ENABLED:'false',
 JENIOS_INTER_CHARGES_ENABLED:'false'
};
function temp(){
 const root=mkdtempSync(join(process.cwd(),'.jenios-r98-crash-'));
 const volume=join(root,'private');mkdirSync(volume,{mode:0o700});
 return {root,volume,cleanup(){rmSync(root,{recursive:true,force:true});}};
}
function child(mode,volume,envPatch={}){
 const env={...process.env,...flags,...envPatch};
 delete env.VERCEL;delete env.VERCEL_ENV;
 return spawnSync(process.execPath,[fixtureFile,mode,volume],{
  encoding:'utf8',env,timeout:15000
 });
}
test('R98 real OS SIGKILL persists B152 risk, recovery UNKNOWN and synthetic restore across Node processes',()=>{
 const original=temp(),restored=temp();
 try{
  const crashed=child('seed',original.volume);
  assert.equal(crashed.signal,'SIGKILL',crashed.stderr);
  const resumed=child('resume',original.volume);
  assert.equal(resumed.status,0,resumed.stderr);
  const first=JSON.parse(resumed.stdout);
  assert.equal(first.phase,'resume');
  assert.equal(first.unknown,1);
  assert.equal(first.held,true);
  assert.equal(first.ordersSent,0);
  const verified=child('verify',original.volume);
  assert.equal(verified.status,0,verified.stderr);
  assert.equal(JSON.parse(verified.stdout).unknown,1);
  // At this point B152 closed cleanly; copying this synthetic file tests only
  // offline cold restore, NOT a hot backup, cloud snapshots, or real disaster recovery.
  const filename='paper-'+connectionId+'.sqlite';
  const source=join(original.volume,filename);
  assert.ok(statSync(source).size>0);
  copyFileSync(source,join(restored.volume,filename));
  const proof=child('verify',restored.volume);
  assert.equal(proof.status,0,proof.stderr);
  const after=JSON.parse(proof.stdout);
  assert.equal(after.unknown,1);
  assert.equal(after.held,true);
  assert.equal(after.ordersSent,0);
  assert.equal(after.liveExecution,false);
 }finally{original.cleanup();restored.cleanup();}
});
test('R98 cannot run with real-money switches, web context or missing fixture authority',()=>{
 const f=temp();
 try{
  for(const mutation of [
   {JENIOS_REAL_EXECUTION_ENABLED:'true'},
   {JENIOS_PRIVATE_PAPER_EXECUTOR:'true'},
   {JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED:'true'},
   {JENIOS_R98_FIXTURE_ONLY:'false'},
   {JENIOS_R98_OFFLINE_CRASH_PROBE_ONLY:'false'},
   {JENIOS_PAY_PAYMENTS_ENABLED:'true'}
  ]){
   const result=child('seed',f.volume,mutation);
   assert.notEqual(result.status,0);
   assert.equal(result.signal,null);
   assert.deepEqual(readdirSync(f.volume),[]);
  }
 }finally{f.cleanup();}
});
