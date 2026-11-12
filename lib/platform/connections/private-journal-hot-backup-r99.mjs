/** JENIOS R99 — offline SQLite WAL-safe snapshot and cold restore rehearsal.
 * Reuses the existing B152 SQLite journal and R94 private-volume guard.
 * No HTTP route, scheduler, provider API, order transport or Live approval.
 */
import {backup as sqliteBackup, DatabaseSync} from 'node:sqlite';
import {createHash,randomUUID} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {closeSync,openSync,lstatSync,statSync,chmodSync,renameSync,copyFileSync,rmSync,constants} from 'node:fs';
import {resolve,basename,dirname} from 'node:path';
import {inspectR94PrivateHost} from './private-host-preflight-r94.mjs';

const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const SHA=/^[a-f0-9]{64}$/;
const MAX_BYTES=536870912; // offline bound, not an operational retention policy
const TABLES=Object.freeze(['owners','accounts','intents','events','intent_symbols']);
const deny=code=>{throw Object.assign(new Error(code),{code});};

function gate(env,{restore=false}={}){
 if(env.VERCEL!==undefined||env.VERCEL_ENV!==undefined||
    env.JENIOS_R99_OFFLINE_HOT_BACKUP_ONLY!=='true'||
    (restore&&env.JENIOS_R99_OFFLINE_COLD_RESTORE_ONLY!=='true')||
    env.JENIOS_REAL_EXECUTION_ENABLED!=='false'||
    env.JENIOS_PRIVATE_PAPER_EXECUTOR!=='false'||
    env.JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED!=='false'||
    env.JENIOS_R80_PRIVATE_ISSUER_ENABLED!=='false'||
    env.JENIOS_R83_PRIVATE_NODE_WORKER!=='false'||
    env.JENIOS_PAY_PAYMENTS_ENABLED!=='false')
  deny('R99_OFFLINE_NO_ORDERS_ONLY');
}
function checkedVolume(env,volumePath){
 const preflight=inspectR94PrivateHost({env,volumePath});
 return preflight.volumePath;
}
function fileCheck(path){
 let st;
 try{st=lstatSync(path);}catch{deny('R99_FILE_MISSING');}
 if(!st.isFile()||(st.mode&0o077)!==0||st.size<=0||st.size>MAX_BYTES||
    (typeof process.getuid==='function'&&st.uid!==process.getuid()))
  deny('R99_FILE_UNSAFE');
 return st;
}
function inspectDatabase(path){
 let db;
 try{
  db=new DatabaseSync(path,{readOnly:true});
  const integrity=db.prepare('PRAGMA integrity_check').all();
  if(integrity.length!==1||integrity[0]?.integrity_check!=='ok')
   deny('R99_SQLITE_INTEGRITY_UNVERIFIED');
  const known=new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(x=>x.name));
  if(TABLES.some(table=>!known.has(table)))deny('R99_B152_SCHEMA_UNVERIFIED');
 }catch(error){
  if(error?.code==='R99_SQLITE_INTEGRITY_UNVERIFIED'||error?.code==='R99_B152_SCHEMA_UNVERIFIED')throw error;
  deny('R99_SQLITE_VALIDATION_FAILED');
 }finally{try{db?.close();}catch{}}
}
async function digestFile(path){
 const hash=createHash('sha256');
 for await(const data of createReadStream(path,{flags:constants.O_RDONLY|constants.O_NOFOLLOW}))hash.update(data);
 return hash.digest('hex');
}
function sourceFile(volume,connectionId){
 if(!UUID.test(connectionId||''))deny('R99_INVALID_CONNECTION_ID');
 return resolve(volume,'paper-'+connectionId+'.sqlite');
}
/** Snapshot a B152 WAL journal while the original PaperLedger connection may remain open.
 * Exposes only a nonsecret file basename and SHA for an isolated test host.
 * Does not certify physical disk isolation or any offsite disaster recovery.
 */
export async function createR99OfflineSnapshot({env=process.env,sourceVolumePath,backupVolumePath,connectionId}={}){
 gate(env);
 const sourceVolume=checkedVolume(env,sourceVolumePath);
 const backupVolume=checkedVolume(env,backupVolumePath);
 if(sourceVolume===backupVolume)deny('R99_BACKUP_VOLUME_MUST_BE_DISTINCT');
 const src=sourceFile(sourceVolume,connectionId);
 fileCheck(src);
 inspectDatabase(src);
 const name='paper-'+connectionId+'-'+randomUUID()+'.sqlite';
 const finalPath=resolve(backupVolume,name);
 const staging=resolve(backupVolume,'.pending-'+randomUUID()+'.sqlite');
 let reader;
 try{
  closeSync(openSync(staging,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600));
  reader=new DatabaseSync(src,{readOnly:true});
  const pages=await sqliteBackup(reader,staging,{rate:32});
  reader.close();reader=null;
  fileCheck(staging);
  inspectDatabase(staging);
  const sha256=await digestFile(staging);
  try{lstatSync(finalPath);deny('R99_BACKUP_NAME_COLLISION');}
  catch(error){if(error?.code!=='ENOENT')throw error;}
  renameSync(staging,finalPath);
  fileCheck(finalPath);
  return Object.freeze({schema:'JENIOS_R99_OFFLINE_SQLITE_SNAPSHOT_V1',
   backupFileName:name,backupSha256:sha256,backupPages:pages,
   consistentLocalSqliteSnapshotVerified:true,sqliteIntegrityVerified:true,
   offsiteBackupVerified:false,physicalVolumeSeparationCertified:false,
   restoreAfterDeploymentCertified:false,readOnlySource:true,
   providerAuthenticated:false,brokerCalls:0,ordersSent:0,liveExecution:false,
   requiresExternalInfrastructureReview:true});
 }catch(error){
  if(error?.code)throw error;
  deny('R99_OFFLINE_BACKUP_FAILED');
 }finally{
  try{reader?.close();}catch{}
  try{rmSync(staging,{force:true});}catch{}
 }
}
/** Cold restore rehearsal to a NEW, EMPTY journal path only. Never replace a
 * running B152 ledger or claim offsite backup certification.
 */
export async function restoreR99OfflineSnapshot({env=process.env,backupVolumePath,restoreVolumePath,
 connectionId,backupFileName,expectedSha256}={}){
 gate(env,{restore:true});
 const backupVolume=checkedVolume(env,backupVolumePath);
 const restoreVolume=checkedVolume(env,restoreVolumePath);
 if(backupVolume===restoreVolume)deny('R99_RESTORE_VOLUME_MUST_BE_DISTINCT');
 if(!UUID.test(connectionId||'')||typeof backupFileName!=='string'||
    !new RegExp('^paper-'+connectionId+'-[a-f0-9-]{36}\\.sqlite$','i').test(backupFileName)||
    basename(backupFileName)!==backupFileName||!SHA.test(expectedSha256||''))
   deny('R99_RESTORE_PROOF_REQUIRED');
 const source=resolve(backupVolume,backupFileName);
 const destination=sourceFile(restoreVolume,connectionId);
 fileCheck(source);
 const actual=await digestFile(source);
 if(actual!==expectedSha256)deny('R99_BACKUP_DIGEST_MISMATCH');
 inspectDatabase(source);
 // COPYFILE_EXCL refuses existing destinations (including symlinks).
 try{lstatSync(destination);deny('R99_RESTORE_TARGET_ALREADY_EXISTS');}
 catch(error){if(error?.code!=='ENOENT')throw error;}
 let copied=false;
 try{
  copyFileSync(source,destination,constants.COPYFILE_EXCL);
  copied=true;
  chmodSync(destination,0o600);
  fileCheck(destination);
  inspectDatabase(destination);
  if(await digestFile(destination)!==expectedSha256)deny('R99_RESTORED_DIGEST_MISMATCH');
  return Object.freeze({schema:'JENIOS_R99_OFFLINE_SQLITE_RESTORE_V1',
   coldRestoreVerified:true,sqliteIntegrityVerified:true,
   sourceBackupDigestMatched:true,restoredFileDigestMatched:true,
   activeJournalOverwritten:false,offsiteBackupCertified:false,
   operatorDisasterRecoveryCertified:false,workerDeployed:false,
   brokerCalls:0,ordersSent:0,liveExecution:false,
   requiresIndependentRestoreApproval:true});
 }catch(error){
  if(copied)try{rmSync(destination,{force:true});}catch{}
  if(error?.code)throw error;
  deny('R99_OFFLINE_RESTORE_FAILED');
 }
}