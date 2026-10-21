#!/usr/bin/env node
/** B214 — locally inspect operator-managed Linux worker files; never connect to broker.
 * Values are read solely from protected host environment. Output has no paths or secrets.
 */
import {inspectPrivatePaperObserverHost} from '../../../lib/platform/connections/b213-private-host-readiness.mjs';
const write=value=>process.stdout.write(JSON.stringify(value)+'\n');
const fail=()=>{write({schema:'JENIOS_B214_HOST_CHECK',
 status:'HOST_PREFLIGHT_NO_GO',workerInstalledByCheck:false,
 networkCalls:0,ordersSent:0,paymentsCreated:0,liveExecution:false});process.exitCode=1;};
if(process.argv.length!==3||process.argv[2]!=='--check')fail();
else{
 try{
  const env=process.env;
  const result=inspectPrivatePaperObserverHost({
   adapterPath:env.JENIOS_PRIVATE_OBSERVER_ADAPTER_PATH,
   riskPath:env.JENIOS_PRIVATE_OBSERVER_RISK_PATH,
   dispatchPath:env.JENIOS_PRIVATE_OBSERVER_DISPATCH_PATH,
   auditPath:env.JENIOS_PRIVATE_OBSERVER_AUDIT_PATH
  },{env});
  write({schema:'JENIOS_B214_HOST_CHECK',
   status:'FILES_VERIFIED_MANUAL_HOMOLOGATION_REQUIRED',
   isolatedStores:result.isolatedSqliteStoresVerified,
   adapterAttested:result.adapterAttested,workerInstalledByCheck:false,
   brokerPermissionsIndependentlyVerified:false,
   operatorManualGrantRequired:true,
   networkCalls:0,ordersSent:0,paymentsCreated:0,liveExecution:false});
 }catch{fail();}
}
