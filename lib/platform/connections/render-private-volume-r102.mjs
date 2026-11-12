/** R102: provision only an application-owned child of the already attached disk.
 * Never chmod/chown the provider mount or existing data; never opens a network.
 */
import {mkdirSync,lstatSync,realpathSync,openSync,closeSync,fstatSync,readFileSync,
 writeFileSync,readSync,fsyncSync,constants} from 'node:fs';
import {join} from 'node:path';
import {randomBytes,createHash} from 'node:crypto';
import {attestR100InertWorker} from './inert-private-host-r100.mjs';
import {runR95OfflineStorageProbe} from './private-host-continuity-r95.mjs';
const MOUNT='/var/data/jenios';
const deny=code=>{throw Object.assign(Error(code),{code});};
function protectedChild(parent,name){
 const path=join(parent,name);
 try{mkdirSync(path,{mode:0o700});}catch(e){if(e.code!=='EEXIST')deny('R102_VOLUME_CREATE_FAILED');}
 let st;
 try{st=lstatSync(path);}catch{deny('R102_VOLUME_CREATE_FAILED');}
 if(!st.isDirectory()||st.isSymbolicLink()||realpathSync(path)!==path||
    st.uid!==process.getuid()||(st.mode&0o077)!==0)
  deny('R102_PRIVATE_DIRECTORY_UNSAFE');
 return path;
}
function persistentMarker(path){
 let fd,previous=false;
 try{
  try{
   fd=openSync(path,constants.O_CREAT|constants.O_EXCL|constants.O_RDWR|constants.O_NOFOLLOW,0o600);
   writeFileSync(fd,randomBytes(32).toString('hex')+'\n');fsyncSync(fd);
  }catch(e){
   if(e.code!=='EEXIST')throw e;
   fd=openSync(path,constants.O_RDONLY|constants.O_NOFOLLOW);previous=true;
  }
  const st=fstatSync(fd);
  if(!st.isFile()||st.uid!==process.getuid()||(st.mode&0o077)!==0||st.nlink!==1||st.size!==65)
   deny('R102_CONTINUITY_MARKER_INVALID');
  const bytes=Buffer.alloc(65);
  if(readSync(fd,bytes,0,65,0)!==65)deny('R102_CONTINUITY_MARKER_INVALID');
  const contents=bytes.toString('utf8');
  if(!/^[a-f0-9]{64}\n$/.test(contents))deny('R102_CONTINUITY_MARKER_INVALID');
  return {previousStartMarkerFound:previous,
   volumeContinuityDigest:createHash('sha256').update(contents).digest('hex')};
 }catch(e){if(e?.code==='R102_CONTINUITY_MARKER_INVALID')throw e;deny('R102_CONTINUITY_MARKER_INVALID');}
 finally{if(fd!==undefined)try{closeSync(fd);}catch{}}
}
export function prepareR102RenderWorker({env=process.env,mountPath=MOUNT,
 mountInfo=()=>readFileSync('/proc/self/mountinfo','utf8')}={}){
 if(env.JENIOS_R102_RENDER_VOLUME_BOOTSTRAP!=='true'||env.RENDER_SERVICE_TYPE!=='worker'||
    !/^srv-[a-z0-9]+$/.test(env.RENDER_SERVICE_ID||'')||
    env.JENIOS_R100_PRIVATE_VOLUME!==MOUNT)
  deny('R102_RENDER_VOLUME_BOOTSTRAP_DENIED');
 // Run every existing financial/web guard BEFORE any filesystem mutation.
 // Only the provider mount permission mismatch may be handled by this bootstrap.
 try{attestR100InertWorker({env,volumePath:mountPath});}
 catch(e){if(e?.code!=='R94_VOLUME_OWNERSHIP_REQUIRED')throw e;}
 let root;
 try{root=lstatSync(mountPath);}catch{deny('R102_RENDER_MOUNT_UNVERIFIED');}
 if(!root.isDirectory()||root.isSymbolicLink()||realpathSync(mountPath)!==mountPath||
    ![0,process.getuid()].includes(root.uid))deny('R102_RENDER_MOUNT_UNVERIFIED');
 // Fixed mount path contains no escaped spaces. An ordinary ephemeral directory
 // at the same path is not sufficient. This check does not certify offsite backup.
 if(!mountInfo().split('\n').some(line=>{
  const fields=line.split(' ');return fields[4]===mountPath&&fields[5]?.split(',').includes('rw');
 }))deny('R102_RENDER_MOUNT_UNVERIFIED');
 const volume=protectedChild(mountPath,'worker-data');
 const attestation=attestR100InertWorker({env,volumePath:volume});
 const verification=protectedChild(volume,'storage-verification');
 const continuity=persistentMarker(join(verification,'continuity-marker'));
 const probe=runR95OfflineStorageProbe({env:{...env,
  JENIOS_R95_OFFLINE_STORAGE_PROBE_ENABLED:'true',
  JENIOS_R95_PRIVATE_RUNTIME_CLASS:'isolated-node'},volumePath:verification,
  canaryConnectionId:'10200000-0000-4000-8000-000000000001'});
 // Sync directory entries as well as marker contents before claiming a local write.
 for(const dir of [verification,volume,mountPath]){
  let fd;try{fd=openSync(dir,constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW);fsyncSync(fd);}
  finally{if(fd!==undefined)closeSync(fd);}
 }
 return Object.freeze({...attestation,...continuity,
  mountedVolumeVerified:true,localSqliteReopenVerified:probe.localSqliteReopenVerified,
  storagePermissionsVerified:probe.storagePermissionsVerified,
  offsiteRestoreCertified:false,liveExecution:false,ordersSent:0});
}
