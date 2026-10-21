#!/usr/bin/env node
/** B209 — private operator entrypoint, purposely no embedded adapter/credentials.
 * --status is a no-network self-check. --once requires an externally provisioned
 * and operator-reviewed adapter module with owner-only file permissions.
 * DO NOT launch --once from Vercel, a browser, or an automated production route.
 */
import {statSync,lstatSync,realpathSync} from 'node:fs';
import {resolve,isAbsolute,relative} from 'node:path';
import {pathToFileURL} from 'node:url';
import {assertIsolatedReadWorker} from '../../../lib/platform/connections/b206-private-read-boundary.mjs';
import {observePrivatePaperOnce} from '../../../lib/platform/connections/b208-private-paper-observer.mjs';
const mode=process.argv[2];
const finish=x=>process.stdout.write(JSON.stringify(x)+'\n');
const fail=()=>{finish({schema:'JENIOS_B209_WORKER_ENTRYPOINT',
 status:'HALTED_READ_ONLY_REQUIREMENTS_UNMET',ordersSent:0,liveExecution:false});
 process.exitCode=1;};
if(!['--status','--once'].includes(mode)||process.argv.length!==3){fail();}
else if(mode==='--status'){
 try{const v=assertIsolatedReadWorker(process.env);
  finish({schema:'JENIOS_B209_WORKER_ENTRYPOINT',status:'ISOLATED_CONFIG_VALID',
   provider:v.provider,method:v.method,adapterConfigured:false,workerDeployedByStatus:false,
   ordersSent:0,liveExecution:false});
 }catch{fail();}
}else{
 let scope=null;
 try{
  assertIsolatedReadWorker(process.env);
  const raw=process.env.JENIOS_PRIVATE_OBSERVER_ADAPTER_PATH;
  if(typeof raw!=='string'||!isAbsolute(raw))throw Error('UNCONFIGURED');
  const root=realpathSync(resolve(process.cwd()));
  const location=realpathSync(raw);
  const rel=relative(root,location);
  if(!rel.startsWith('..')||rel==='..')throw Error('ADAPTER_MUST_BE_OUTSIDE_REPOSITORY');
  if(lstatSync(raw).isSymbolicLink()||!location.endsWith('.mjs'))throw Error('ADAPTER_INVALID');
  const stat=statSync(location);
  if(!stat.isFile()||(stat.mode&0o077)!==0||
   (typeof process.getuid==='function'&&stat.uid!==process.getuid()))throw Error('UNPROTECTED_ADAPTER');
  const adapter=await import(pathToFileURL(location).href);
  if(typeof adapter.createTrustedObserverScope!=='function')throw Error('BAD_ADAPTER');
  scope=await adapter.createTrustedObserverScope();
  if(!scope?.input||!scope?.deps)throw Error('BAD_SCOPE');
  const result=await observePrivatePaperOnce(scope.input,{...scope.deps,env:process.env});
  finish({schema:'JENIOS_B209_WORKER_ENTRYPOINT',status:result.assessment,
   auditDigest:result.auditDigest||null,entryPausedLocally:result.entryPausedLocally===true,
   severity:result.report?.severity||null,ordersSent:0,liveExecution:false});
  if(result.assessment!=='REVIEW_RECORDED')process.exitCode=2;
 }catch{fail();}
 finally{
  for(const k of ['ledger','journal','auditStore']){
   try{scope?.deps?.[k]?.close?.();}catch{}
  }
 }
}
