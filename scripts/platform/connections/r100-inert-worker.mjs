/** R100 boot-only background worker; no recurring work or broker activity. */
import {attestR100InertWorker} from '../../../lib/platform/connections/inert-private-host-r100.mjs';
import {prepareR102RenderWorker} from '../../../lib/platform/connections/render-private-volume-r102.mjs';
const safeWrite=message=>process.stdout.write(JSON.stringify(message)+'\n');
try{
 if(process.argv.length!==2)throw Error('R100_ARGUMENTS_DENIED');
 const result=process.env.JENIOS_R102_RENDER_VOLUME_BOOTSTRAP==='true'
  ?prepareR102RenderWorker():attestR100InertWorker();
 // Install shutdown handling before advertising READY; SIGTERM may arrive
 // immediately after the first stdout line during an automated deploy.
 const idle=setInterval(()=>safeWrite({event:'R102_INERT_HEARTBEAT',
  uptimeSeconds:Math.floor(process.uptime()),ordersSent:0,liveExecution:false}),60000);
 const stop=()=>{
  clearInterval(idle);
  safeWrite({event:'R100_INERT_STOP',ordersSent:0,liveExecution:false});
 };
 process.once('SIGTERM',stop);
 process.once('SIGINT',stop);
 safeWrite({event:'R100_INERT_BOOT',...result});
}catch(error){
 // Never print filesystem paths, environment variables, secrets, or stack traces.
 // Only exact, reviewed codes may leave this process. Unknown messages are redacted.
 const allowed=new Set(['R100_ARGUMENTS_DENIED','R100_INERT_PRIVATE_WORKER_ONLY',
  'R100_INFRASTRUCTURE_GATES_NOT_MET','R94_PRIVATE_WORKER_MUST_BE_DISABLED',
  'R94_PERSISTENT_VOLUME_REQUIRED','R94_VOLUME_OWNERSHIP_REQUIRED',
  'R94_VOLUME_SYMLINK_DENIED','R102_RENDER_VOLUME_BOOTSTRAP_DENIED',
  'R102_RENDER_MOUNT_UNVERIFIED','R102_VOLUME_CREATE_FAILED',
  'R102_PRIVATE_DIRECTORY_UNSAFE','R102_CONTINUITY_MARKER_INVALID',
  'R95_LOCAL_STORAGE_PROBE_FAILED','R95_JOURNAL_STORAGE_INVALID']);
 const candidate=error?.code||error?.message;
 process.stderr.write(JSON.stringify({event:'R100_INERT_BOOT_REFUSED',
  code:allowed.has(candidate)?candidate:'R100_UNEXPECTED_BOOT_FAILURE'})+'\n');
 process.exitCode=1;
}
