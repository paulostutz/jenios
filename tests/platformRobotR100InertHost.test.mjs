import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,rmSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {attestR100InertWorker} from '../lib/platform/connections/inert-private-host-r100.mjs';

const root=new URL('../',import.meta.url);
const cli=new URL('../scripts/platform/connections/r100-inert-worker.mjs',import.meta.url).pathname;
const manifest=new URL('../infra/render/r100-inert-worker.blueprint.yaml',import.meta.url);
test('R101 failed boot reports a safe actionable code without credentials or paths',()=>{
 const child=spawnSync(process.execPath,[cli],{encoding:'utf8',env:{
  PATH:process.env.PATH,JENIOS_R100_PRIVATE_VOLUME:'/private/sensitive/path',
  API_SECRET:'synthetic-do-not-log'
 }});
 assert.equal(child.status,1);
 const event=child.stderr.split('\n').find(line=>line.startsWith('{'));
 assert.deepEqual(JSON.parse(event),{event:'R100_INERT_BOOT_REFUSED',code:'R100_INERT_PRIVATE_WORKER_ONLY'});
 assert.doesNotMatch(child.stdout+child.stderr,/synthetic-do-not-log|sensitive\/path|API_SECRET/);
});
const env={
 JENIOS_R100_RUNTIME_CLASS:'isolated-node',
 JENIOS_R100_HOST_KIND:'background-worker',
 JENIOS_R100_INERT_WORKER_ENABLED:'true',
 JENIOS_R100_NETWORK_DISABLED:'true',
 JENIOS_DEMO_CONNECTORS_ENABLED:'false',
 JENIOS_R93_PRIVATE_NODE_WORKER:'false',
 JENIOS_R93_READONLY_RECOVERY_ENABLED:'false',
 JENIOS_R95_OFFLINE_STORAGE_PROBE_ENABLED:'false',
 JENIOS_R96_PRIVATE_NODE_WORKER:'false',
 JENIOS_R96_BINANCE_PRIVATE_READ_ENABLED:'false',
 JENIOS_R98_OFFLINE_CRASH_PROBE_ONLY:'false',
 JENIOS_R94_PRIVATE_WORKER_ENABLED:'false',
 JENIOS_R94_READONLY_ONLY:'true',
 JENIOS_REAL_EXECUTION_ENABLED:'false',
 JENIOS_PRIVATE_PAPER_EXECUTOR:'false',
 JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED:'false',
 JENIOS_R80_PRIVATE_ISSUER_ENABLED:'false',
 JENIOS_R82_ALPACA_LIVE_ORDER_EXECUTION_ENABLED:'false',
 JENIOS_R83_PRIVATE_NODE_WORKER:'false',
 JENIOS_PAY_PAYMENTS_ENABLED:'false',
 JENIOS_INTER_CHARGES_ENABLED:'false'
};
function fixture(fn){
 const dir=mkdtempSync(join(process.cwd(),'.jenios-r100-'));
 try{
  const volume=join(dir,'private');mkdirSync(volume,{mode:0o700});
  return fn(volume);
 }finally{rmSync(dir,{recursive:true,force:true});}
}
test('R100 private-only attestation is inert and never certifies customer trading',()=>{
 fixture(volume=>{
  const answer=attestR100InertWorker({env,volumePath:volume});
  assert.equal(answer.inert,true);
  assert.equal(answer.ordersSent,0);
  assert.equal(answer.liveExecution,false);
  assert.equal(answer.offsiteRestoreCertified,false);
  assert.equal(answer.infrastructureApproval,false);
  assert.equal(answer.noQueuePolling,true);
  assert.equal(answer.noHttpListener,true);
  assert.equal(JSON.stringify(answer).includes(volume),false);
 });
});
test('R100 refuses Vercel, missing disk, enabled brokers, real trades or payments',()=>{
 fixture(volume=>{
  for(const patch of [
   {VERCEL:'1'},{VERCEL_ENV:'preview'},
   {JENIOS_R100_INERT_WORKER_ENABLED:'false'},
   {JENIOS_R100_NETWORK_DISABLED:'false'},
   {JENIOS_R100_HOST_KIND:'public-web'},
   {JENIOS_R96_BINANCE_PRIVATE_READ_ENABLED:'true'},
   {JENIOS_PRIVATE_PAPER_EXECUTOR:'true'},
   {JENIOS_REAL_EXECUTION_ENABLED:'true'},
   {JENIOS_PAY_PAYMENTS_ENABLED:'true'}
  ]){
   assert.throws(()=>attestR100InertWorker({
    env:{...env,...patch},volumePath:volume
   }));
  }
  assert.throws(()=>attestR100InertWorker({
   env,volumePath:'/tmp/jenios-r100-nonpersistent'
  }),/R94_PERSISTENT_VOLUME_REQUIRED/);
 });
});
test('R100 Blueprint is review-only, private worker with persistent disk and autodeploy off',()=>{
 const yaml=readFileSync(manifest,'utf8');
 assert.match(yaml,/type:\s*worker/);
 assert.match(yaml,/autoDeployTrigger:\s*off/);
 assert.match(yaml,/runtime:\s*node/);
 assert.match(yaml,/startCommand:\s*node scripts\/platform\/connections\/r100-inert-worker\.mjs/);
 assert.match(yaml,/mountPath:\s*\/var\/data\/jenios/);
 assert.match(yaml,/sizeGB:\s*1/);
 assert.doesNotMatch(yaml,/maxShutdownDelaySeconds:/);
 assert.doesNotMatch(yaml,/type:\s*(?:web|cron|pserv)\s*$/m);
 assert.doesNotMatch(yaml,/JENIOS_REAL_EXECUTION_ENABLED\s*\n\s*value:\s*['"]?true/);
 assert.doesNotMatch(yaml,/(?:sk-proj-|service_role_key|SUPABASE_SERVICE_ROLE_KEY)/i);
});
async function runChild(workerEnv){
 const inherited={...process.env,...workerEnv};
 delete inherited.VERCEL;
 delete inherited.VERCEL_ENV;
 const child=spawn(process.execPath,[cli],{
  env:inherited,stdio:['ignore','pipe','pipe']
 });
 let output='',errorOutput='';
 child.stderr.on('data',chunk=>{errorOutput+=String(chunk);});
 const first=await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(new Error('R100_NO_BOOT_SIGNAL')),7000);
  child.stdout.on('data',chunk=>{
   output+=String(chunk);
   if(output.includes('\n')){clearTimeout(timer);resolve(output.split('\n')[0]);}
  });
  child.once('error',err=>{clearTimeout(timer);reject(err);});
  child.once('exit',()=>{if(!output.includes('\n')){
   clearTimeout(timer);reject(new Error('R100_EXIT_BEFORE_BOOT '+errorOutput));
  }});
 });
 child.kill('SIGTERM');
 const end=await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{child.kill('SIGKILL');reject(new Error('R100_NO_STOP_SIGNAL'));},7000);
  child.once('close',(code,signal)=>{clearTimeout(timer);resolve({code,signal});});
 });
 return {boot:JSON.parse(first),end,output,errorOutput};
}
test('R100 inert CLI boot and SIGTERM shutdown remain zero-order without port or broker calls',async()=>{
 const dir=mkdtempSync(join(process.cwd(),'.jenios-r100-'));
 try{
  const volume=join(dir,'private');mkdirSync(volume,{mode:0o700});
  const x=await runChild({...env,JENIOS_R100_PRIVATE_VOLUME:volume});
  assert.equal(x.boot.event,'R100_INERT_BOOT');
  assert.equal(x.boot.ordersSent,0);
  assert.equal(x.boot.noHttpListener,true);
  assert.equal(x.end.code,0);
  assert.equal(x.end.signal,null);
  assert.match(x.output,/R100_INERT_STOP/);
  // Node 22 may emit the built-in node:sqlite ExperimentalWarning merely
  // from importing B152 via the existing R94 preflight. Reject all other stderr.
  const stderrLines=x.errorOutput.split('\n');
  const knownNodeSQLiteNotice=
   stderrLines.length===3 &&
   /^\(node:\d+\) ExperimentalWarning: SQLite is an experimental feature and might change at any time$/.test(stderrLines[0]) &&
   stderrLines[1].startsWith('(Use ') &&
   stderrLines[1].includes('node --trace-warnings ...') &&
   stderrLines[1].endsWith(' to show where the warning was created)') &&
   stderrLines[2]==='';
  assert.ok(x.errorOutput===''||knownNodeSQLiteNotice,
   'R100_UNEXPECTED_WORKER_STDERR');
  assert.doesNotMatch(x.output,/private|secret|apiKey|Bearer /i);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
