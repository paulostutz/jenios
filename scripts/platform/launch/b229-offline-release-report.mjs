#!/usr/bin/env node
/** B229 read-only JSON report, no network, credentials, deploy or purchase. */
import {buildLaunchQaPacket} from '../../../lib/platform/launch/b229-release-package.mjs';
const invalid=()=>{process.stdout.write(JSON.stringify({schema:'JENIOS_B229_LAUNCH_QA_PACKET',
 status:'OFFLINE_REPORT_ARGUMENT_REQUIRED',productionReleaseAuthorized:false})+'\n');process.exitCode=1;};
if(process.argv.length!==3||process.argv[2]!=='--offline')invalid();
else{
 try{const p=buildLaunchQaPacket();process.stdout.write(JSON.stringify(p)+'\n');}
 catch{invalid();}
}
