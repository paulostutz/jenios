/** JENIOS R94: isolated private worker host configuration and readiness.
 * No web route, scheduler, broker POST, or secret material is created here.
 * Deployment MUST remain disabled until independent infrastructure approval.
 */
import {lstatSync,realpathSync,statfsSync,constants,openSync,closeSync} from 'node:fs';
import {resolve,dirname,isAbsolute} from 'node:path';
import {PaperLedger} from '../pilot-prep/paper-ledger.mjs';
const deny=code=>{throw Object.assign(new Error(code),{code});};
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const PRIVATE_FLAGS=Object.freeze([
 'JENIOS_REAL_EXECUTION_ENABLED',
 'JENIOS_PRIVATE_PAPER_EXECUTOR',
 'JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED',
 'JENIOS_R80_PRIVATE_ISSUER_ENABLED',
 'JENIOS_R82_ALPACA_LIVE_ORDER_EXECUTION_ENABLED',
 'JENIOS_R83_PRIVATE_NODE_WORKER',
 'JENIOS_PAY_PAYMENTS_ENABLED',
 'JENIOS_INTER_CHARGES_ENABLED'
]);
function flags(env){
 if(env.JENIOS_R94_PRIVATE_WORKER_ENABLED!=='false'||
    env.JENIOS_R94_READONLY_ONLY!=='true'||
    env.JENIOS_R93_PRIVATE_NODE_WORKER!=='false'||
    env.JENIOS_R93_READONLY_RECOVERY_ENABLED!=='false'||
    PRIVATE_FLAGS.some(key=>env[key]!=='false'))
   deny('R94_PRIVATE_WORKER_MUST_BE_DISABLED');
}
function checkVolume(volume){
 if(typeof volume!=='string'||!isAbsolute(volume)||
    volume.includes('\0')||volume==='/'||volume.startsWith('/tmp/')||
    volume.startsWith('/var/tmp/')||volume.startsWith('/dev/')||
    volume.startsWith('/proc/')||volume.startsWith('/sys/'))
    deny('R94_PERSISTENT_VOLUME_REQUIRED');
 let path,st;
 try{path=realpathSync(volume);st=lstatSync(path);}
 catch{deny('R94_PERSISTENT_VOLUME_REQUIRED');}
 if(!st.isDirectory()||(st.mode&0o077)!==0||
    (typeof process.getuid==='function'&&st.uid!==process.getuid()))
    deny('R94_VOLUME_OWNERSHIP_REQUIRED');
 if(path!==resolve(volume))deny('R94_VOLUME_SYMLINK_DENIED');
 return path;
}
/** Does not open SQLite. Checks only host contract and operator-provisioned volume.
 * A successful preflight is NOT proof of durable storage: external host mount
 * identity, backups, recovery and restart tests still require independent review.
 */
export function inspectR94PrivateHost({env=process.env,volumePath}={}){
 flags(env);
 const volume=checkVolume(volumePath);
 return Object.freeze({schema:'JENIOS_R94_HOST_PREFLIGHT_V1',
  hostConfigurationValid:true,volumePath:volume,
  durabilityCertified:false,workerDeployed:false,readOnly:true,
  brokerNetworkEnabled:false,ordersSent:0,liveExecution:false,
  requiresOperatorReview:true});
}
export function openR94PrivateJournal({env=process.env,volumePath,connectionId}={}){
 flags(env);
 if(!UUID.test(connectionId||''))deny('R94_CONNECTION_ID_REQUIRED');
 const volume=checkVolume(volumePath);
 // The journal name is server-derived and cannot be supplied by the browser.
 const path=resolve(volume,'paper-'+connectionId+'.sqlite');
 if(dirname(path)!==volume)deny('R94_JOURNAL_PATH_INVALID');
 const journal=new PaperLedger(path);
 return Object.freeze({journal,close:()=>journal.close(),
  storagePath:path,readOnlyTransport:true,liveExecution:false,
  durabilityCertified:false,workerDeployed:false});
}
