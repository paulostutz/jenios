/** B211 — attest operator-installed adapter before any dynamic import.
 * This is a filesystem security guard, not approval to trade or external authorization.
 */
import {lstatSync,realpathSync} from 'node:fs';
import {dirname,isAbsolute,parse,relative,resolve,sep} from 'node:path';
const deny=code=>{throw Object.assign(new Error(code),{code});};
export function attestPrivateObserverAdapter(path,{repositoryRoot=process.cwd(),uid=process.getuid?.()}={}){
 if(typeof path!=='string'||path.length>4096||!isAbsolute(path)||!path.endsWith('.mjs')||
    !Number.isSafeInteger(uid)||uid<0)deny('PRIVATE_ADAPTER_SCOPE_INVALID');
 let original,actual,repo;
 try{original=resolve(path);actual=realpathSync(original);repo=realpathSync(repositoryRoot);}
 catch{deny('PRIVATE_ADAPTER_PATH_NOT_VERIFIED');}
 // Refuse symlinked parents and files, even if their final target is otherwise protected.
 if(original!==actual)deny('PRIVATE_ADAPTER_SYMLINK_FORBIDDEN');
 const rel=relative(repo,actual);
 if(rel===''||!(rel==='..'||rel.startsWith('..'+sep)))deny('PRIVATE_ADAPTER_INSIDE_REPOSITORY');
 let file;
 try{file=lstatSync(actual);}catch{deny('PRIVATE_ADAPTER_PATH_NOT_VERIFIED');}
 if(!file.isFile()||file.uid!==uid||(file.mode&0o077)!==0||file.size<1||
    file.size>262144||file.nlink!==1)deny('PRIVATE_ADAPTER_FILE_NOT_PROTECTED');
 let cursor=dirname(actual),isImmediate=true,steps=0;
 while(true){
  if(++steps>100)deny('PRIVATE_ADAPTER_PATH_TOO_DEEP');
  let dir;
  try{dir=lstatSync(cursor);}catch{deny('PRIVATE_ADAPTER_DIRECTORY_UNTRUSTED');}
  if(!dir.isDirectory()||(dir.uid!==uid&&dir.uid!==0))deny('PRIVATE_ADAPTER_DIRECTORY_UNTRUSTED');
  // Only a root-owned sticky directory (e.g. /tmp) may be world-writable.
  const writable=(dir.mode&0o022)!==0;
  if(writable&&!(dir.uid===0&&(dir.mode&0o1000)!==0))
    deny('PRIVATE_ADAPTER_DIRECTORY_WRITABLE');
  if(isImmediate&&(dir.uid!==uid||(dir.mode&0o077)!==0))
    deny('PRIVATE_ADAPTER_PARENT_NOT_PRIVATE');
  if(cursor===parse(cursor).root)break;
  cursor=dirname(cursor);isImmediate=false;
 }
 return Object.freeze({adapterPath:actual,adapterAttested:true,externalToRepository:true,
  providerConnectionVerified:false,externalOrdersAuthorized:false,liveExecution:false});
}
