#!/usr/bin/env node
/** B249: produces only an offline, redacted summary for QA; never signs approvals. */
import {composeOfflineReleaseManifest} from '../../../lib/platform/release250/b249-review-manifest.mjs';
const args=process.argv.slice(2);
const ok=args.length===2&&/^[a-f0-9]{40}$/.test(args[0])&&/^\d{12,15}$/.test(args[1]);
if(!ok){process.stdout.write(JSON.stringify({schema:'JENIOS_B249_RELEASE_REPORT',status:'INVALID_ARGS',ordersSent:0})+'\n');process.exitCode=1;}
else{const report=composeOfflineReleaseManifest({commit:args[0],nowMs:Number(args[1]),ciClaimed:true});
 process.stdout.write(JSON.stringify(report,null,2)+'\n');}
