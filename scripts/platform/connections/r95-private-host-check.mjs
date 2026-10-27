/** R95 private Node offline probe. No listener, network, auth token or order dispatch. */
import {runR95OfflineStorageProbe} from '../../lib/platform/connections/private-host-continuity-r95.mjs';
if(process.argv.length!==3||process.argv[2]!=='--offline-preflight'){
 process.stderr.write('R95_EXPLICIT_OFFLINE_PREFLIGHT_REQUIRED\n');
 process.exitCode=1;
}else{
 try{
  const result=runR95OfflineStorageProbe({
   env:process.env,
   volumePath:process.env.JENIOS_R95_PRIVATE_VOLUME,
   canaryConnectionId:process.env.JENIOS_R95_CANARY_CONNECTION_ID
  });
  process.stdout.write(JSON.stringify(result)+'\n');
 }catch{
  // Never echo internal paths, tokens, broker responses or stack traces.
  process.stderr.write('R95_OFFLINE_PREFLIGHT_FAILED\n');
  process.exitCode=1;
 }
}
