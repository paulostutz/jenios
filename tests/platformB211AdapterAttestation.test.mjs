import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,chmodSync,rmSync,symlinkSync,linkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {attestPrivateObserverAdapter} from '../lib/platform/connections/b211-private-adapter-attestation.mjs';
const fixture=fn=>{const parent=mkdtempSync(join(tmpdir(),'jenios-b211-')),privateDir=join(parent,'secure');
 mkdirSync(privateDir,{mode:0o700});chmodSync(privateDir,0o700);
 const adapter=join(privateDir,'adapter.mjs');writeFileSync(adapter,'export const safe=true;\n',{mode:0o600});chmodSync(adapter,0o600);
 try{return fn({parent,privateDir,adapter});}finally{rmSync(parent,{recursive:true,force:true});}};
test('B211 accepts an owner-only external adapter without executing it',()=>fixture(({adapter})=>{
 const r=attestPrivateObserverAdapter(adapter);
 assert.equal(r.adapterAttested,true);assert.equal(r.externalToRepository,true);
 assert.equal(r.externalOrdersAuthorized,false);assert.equal(r.liveExecution,false);
}));
test('B211 rejects writable adapter or writable parent before dynamic import',()=>fixture(({adapter,privateDir})=>{
 chmodSync(adapter,0o644);
 assert.throws(()=>attestPrivateObserverAdapter(adapter),/PRIVATE_ADAPTER_FILE_NOT_PROTECTED/);
 chmodSync(adapter,0o600);chmodSync(privateDir,0o777);
 assert.throws(()=>attestPrivateObserverAdapter(adapter),/PRIVATE_ADAPTER_DIRECTORY_WRITABLE/);
}));
test('B211 rejects file and directory symlink indirection',()=>fixture(({parent,privateDir,adapter})=>{
 const alias=join(parent,'shortcut.mjs');symlinkSync(adapter,alias);
 assert.throws(()=>attestPrivateObserverAdapter(alias),/PRIVATE_ADAPTER_SYMLINK_FORBIDDEN/);
 const dirlink=join(parent,'alias');symlinkSync(privateDir,dirlink);
 assert.throws(()=>attestPrivateObserverAdapter(join(dirlink,'adapter.mjs')),/PRIVATE_ADAPTER_SYMLINK_FORBIDDEN/);
}));
test('B211 never imports adapter from inside the public repository or a relative path',()=>{
 assert.throws(()=>attestPrivateObserverAdapter('./adapter.mjs'),/PRIVATE_ADAPTER_SCOPE_INVALID/);
 assert.throws(()=>attestPrivateObserverAdapter(import.meta.filename),/PRIVATE_ADAPTER_INSIDE_REPOSITORY/);
});
test('B211 rejects an empty adapter and hard-linked external source',()=>fixture(({parent,adapter})=>{
 writeFileSync(adapter,'');assert.throws(()=>attestPrivateObserverAdapter(adapter),/PRIVATE_ADAPTER_FILE_NOT_PROTECTED/);
 writeFileSync(adapter,'export const safe=true;\n');
 const other=join(parent,'hardlink.mjs');linkSync(adapter,other);
 assert.throws(()=>attestPrivateObserverAdapter(adapter),/PRIVATE_ADAPTER_FILE_NOT_PROTECTED/);
}));
