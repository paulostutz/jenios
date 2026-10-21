/** B213 — NO-NETWORK host preflight for the existing observer CLI and SQLite stores.
 * No deployment, no broker authentication, no secrets printed and no order submission.
 */
import {DatabaseSync} from 'node:sqlite';
import {lstatSync,realpathSync} from 'node:fs';
import {dirname,isAbsolute,resolve} from 'node:path';
import {timingSafeEqual} from 'node:crypto';
import {assertIsolatedReadWorker} from './b206-private-read-boundary.mjs';
import {attestPrivateObserverAdapter} from './b211-private-adapter-attestation.mjs';
const deny=code=>{throw Object.assign(new Error(code),{code});};
const TABLES={risk:['owners','accounts','intents','events'],dispatch:['paper_dispatch'],audit:['observations']};
function checkDbPath(raw,uid){
 if(typeof raw!=='string'||raw.length>4096||!isAbsolute(raw))deny('PRIVATE_SQLITE_PATH_REQUIRED');
 let canonical,file,dir;
 try{canonical=realpathSync(resolve(raw));file=lstatSync(resolve(raw));dir=lstatSync(dirname(canonical));}
 catch{deny('PRIVATE_SQLITE_PATH_NOT_VERIFIED');}
 if(canonical!==resolve(raw)||!file.isFile()||file.uid!==uid||(file.mode&0o077)!==0||
    file.size<100||!dir.isDirectory()||dir.uid!==uid||(dir.mode&0o077)!==0)
  deny('PRIVATE_SQLITE_PERMISSIONS_INVALID');
 return {path:canonical,identity:file.dev+':'+file.ino};
}
function inspectSqlite(entry,required){
 let db;
 try{
  db=new DatabaseSync(entry.path,{readOnly:true});
  const value=db.prepare('PRAGMA integrity_check').get();
  if(value?.integrity_check!=='ok')deny('PRIVATE_SQLITE_INTEGRITY_UNVERIFIED');
  const names=new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r=>r.name));
  for(const name of required)if(!names.has(name))deny('PRIVATE_SQLITE_SCHEMA_UNVERIFIED');
 }catch(e){if(e?.code?.startsWith?.('PRIVATE_SQLITE_'))throw e;deny('PRIVATE_SQLITE_INTEGRITY_UNVERIFIED');}
 finally{try{db?.close();}catch{}}
}
export function inspectPrivatePaperObserverHost({adapterPath,riskPath,dispatchPath,auditPath},
 {env=process.env,uid=process.getuid?.(),platform=process.platform,nodeVersion=process.versions.node,
 repositoryRoot=process.cwd()}={}){
 assertIsolatedReadWorker(env);
 if(platform!=='linux'||![22,24].includes(Number(String(nodeVersion).split('.')[0]))||
   !Number.isSafeInteger(uid)||uid<0)deny('UNREVIEWED_PRIVATE_WORKER_RUNTIME');
 const secretA=Buffer.from(env.JENIOS_DEMO_VAULT_KEY_B64,'base64');
 const secretB=Buffer.from(env.JENIOS_PAPER_OBSERVER_KEY_B64,'base64');
 if(secretA.length!==32||secretB.length!==32||timingSafeEqual(secretA,secretB))
  deny('PRIVATE_WORKER_KEYS_MUST_BE_DISTINCT');
 const adapter=attestPrivateObserverAdapter(adapterPath,{repositoryRoot,uid});
 const stores={risk:riskPath,dispatch:dispatchPath,audit:auditPath};
 const entries={};
 for(const [name,path] of Object.entries(stores))entries[name]=checkDbPath(path,uid);
 const ids=new Set(Object.values(entries).map(e=>e.identity));
 if(ids.size!==3)deny('PRIVATE_SQLITE_STORES_NOT_SEPARATE');
 for(const [name,entry] of Object.entries(entries))inspectSqlite(entry,TABLES[name]);
 return Object.freeze({schema:'JENIOS_B213_PRIVATE_HOST_PREFLIGHT',
  checkedRuntime:'LINUX_NODE_LTS',adapterAttested:adapter.adapterAttested,
  isolatedSqliteStoresVerified:3,sqliteIntegrityVerified:true,observerSigningKeySeparate:true,
  implementationReadyForOperatorReview:true,
  // Host files and environment are not proof that a service was installed or authenticated.
  workerServiceInstalledByThisCheck:false,externalBrokerAuthenticated:false,
  brokerTradingPermissionsAudited:false,automaticExecutionEnabled:false,
  paperOrdersAuthorized:false,liveExecutionAuthorized:false,
  result:'CONFIG_FILES_VERIFIED_EXTERNAL_HOMOLOGATION_PENDING',ordersSent:0,
  networkCalls:0,paymentsCreated:0});
}
