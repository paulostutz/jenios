#!/usr/bin/env node
/** B209 — private operator entrypoint, purposely no embedded adapter/credentials.
 * --status is a no-network self-check. --once requires an externally provisioned
 * and operator-reviewed adapter module with owner-only file permissions.
 * DO NOT launch --once from Vercel, a browser, or an automated production route.
 */
import {pathToFileURL} from 'node:url';
import {assertIsolatedReadWorker} from '../../../lib/platform/connections/b206-private-read-boundary.mjs';
import {observePrivatePaperOnce} from '../../../lib/platform/connections/b208-private-paper-observer.mjs';
import {attestPrivateObserverAdapter} from '../../../lib/platform/connections/b211-private-adapter-attestation.mjs';
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
  const {adapterPath}=attestPrivateObserverAdapter(process.env.JENIOS_PRIVATE_OBSERVER_ADAPTER_PATH);
  const adapter=await import(pathToFileURL(adapterPath).href);
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
