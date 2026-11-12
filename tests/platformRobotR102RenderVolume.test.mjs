import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,rmSync,chmodSync,statSync,existsSync,symlinkSync,writeFileSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {prepareR102RenderWorker} from '../lib/platform/connections/render-private-volume-r102.mjs';
// Reuse the reviewed nonsecret configuration; no broker keys, DB access or network.
const yaml=readFileSync(new URL('../infra/render/r100-inert-worker.blueprint.yaml',import.meta.url),'utf8');
const env=Object.fromEntries([...yaml.matchAll(/- key: (\w+)\n\s+value: ([^\n]+)/g)]
 .map(([,k,v])=>[k,v.replace(/^"|"$/g,'')]));
Object.assign(env,{RENDER_SERVICE_TYPE:'worker',RENDER_SERVICE_ID:'srv-fixture102'});
function fixture(fn){
 const root=mkdtempSync(join(process.cwd(),'.jenios-r102-'));
 const mount=join(root,'mount');mkdirSync(mount,{mode:0o755});chmodSync(mount,0o755);
 const mountInfo=()=>`1 0 1:2 / ${mount} rw,relatime - ext4 fixture rw\n`;
 try{return fn({root,mount,mountInfo,run:(patch={})=>prepareR102RenderWorker({env,mountPath:mount,mountInfo,...patch})});}
 finally{rmSync(root,{recursive:true,force:true});}
}
test('R102 creates a private child without changing provider mount and reopens SQLite',()=>fixture(({mount,run})=>{
 const first=run(),second=run();
 assert.equal(statSync(mount).mode&0o777,0o755);
 assert.equal(statSync(join(mount,'worker-data')).mode&0o777,0o700);
 assert.equal(first.localSqliteReopenVerified,true);
 assert.equal(first.storagePermissionsVerified,true);
 assert.equal(first.previousStartMarkerFound,false);
 assert.equal(second.previousStartMarkerFound,true);
 assert.equal(first.volumeContinuityDigest,second.volumeContinuityDigest);
 assert.equal(first.ordersSent,0);assert.equal(first.liveExecution,false);
 assert.equal(first.offsiteRestoreCertified,false);
 assert.equal(JSON.stringify(first).includes(mount),false);
}));
test('R102 refuses financial/web flags before creating files',()=>fixture(({mount,run})=>{
 for(const patch of [{JENIOS_REAL_EXECUTION_ENABLED:'true'},
  {JENIOS_PRIVATE_PAPER_EXECUTOR:'true'},{JENIOS_PAY_PAYMENTS_ENABLED:'true'},
  {VERCEL:'1'},{JENIOS_R102_RENDER_VOLUME_BOOTSTRAP:'false'},
  {RENDER_SERVICE_TYPE:'web'}]){
  assert.throws(()=>run({env:{...env,...patch}}));
  assert.equal(existsSync(join(mount,'worker-data')),false);
 }
}));
test('R102 refuses an ephemeral directory or read-only mount',()=>fixture(({mount,run})=>{
 for(const mountInfo of [()=>'',()=>`1 0 1:2 / ${mount} ro - ext4 fixture ro`]){
  assert.throws(()=>run({mountInfo}),/R102_RENDER_MOUNT_UNVERIFIED/);
  assert.equal(existsSync(join(mount,'worker-data')),false);
 }
}));
test('R102 refuses an existing symlink and does not touch its target',()=>fixture(({root,mount,run})=>{
 const other=join(root,'other');mkdirSync(other,{mode:0o700});
 symlinkSync(other,join(mount,'worker-data'));
 assert.throws(()=>run(),/R102_PRIVATE_DIRECTORY_UNSAFE/);
 assert.equal(existsSync(join(other,'storage-verification')),false);
}));
test('R102 does not silently chmod existing unsafe storage',()=>fixture(({mount,run})=>{
 const path=join(mount,'worker-data');mkdirSync(path,{mode:0o755});chmodSync(path,0o755);
 assert.throws(()=>run(),/R102_PRIVATE_DIRECTORY_UNSAFE/);
 assert.equal(statSync(path).mode&0o777,0o755);
}));
test('R102 rejects corrupted continuity evidence instead of resetting it',()=>fixture(({mount,run})=>{
 run();const path=join(mount,'worker-data','storage-verification','continuity-marker');
 writeFileSync(path,'corrupted');
 assert.throws(()=>run(),/R102_CONTINUITY_MARKER_INVALID/);
 assert.equal(readFileSync(path,'utf8'),'corrupted');
}));
