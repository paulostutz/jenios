import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {verifyR106PublicGuidance} from '../scripts/check-authentication-r106.mjs';
test('R128 pins both unchanged checkpoints, aliases, and the exact additive inventory',()=>{
 assert.equal(verifyR106PublicGuidance().exactSource,true);
 const manifest='docs/release/R128-CONCILIATION-EXTENSION.json',m=JSON.parse(readFileSync(manifest));
 assert.deepEqual(m.replacements,{});
 for(const flag of ['nativeValidated','liveExecutionAllowed','externalPaperAllowed','billingAllowed','productionPublished'])assert.equal(m[flag],false);
 for(const target of [manifest,...Object.keys(m.additions),'docs/release/R127-EXECUTION-EXTENSION.json','docs/release/R127-SESSION-EXTENSION.json',...Object.values(m.aliases),'lib/platform/ultra/client/execution-runtime-r127.mjs','lib/platform/ultra/client/session-runtime-r127.mjs'])assert.throws(()=>verifyR106PublicGuidance({read:p=>p===target?Buffer.from('unreviewed'):readFileSync(p)}),undefined,target);
 const files=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);assert.throws(()=>verifyR106PublicGuidance({tracked:[...files,'unreviewed-r128.mjs']}),/inventory/);
});
test('R128 union package is reproducible and preserves both complete R127 archives',()=>{
 const output=execFileSync('python',['-B','-c',`
import hashlib,json,tempfile,subprocess,io,os
from pathlib import Path
from zipfile import ZipFile
inputs=[('f19607c6d970211106908868e7dc5930a7b269ca','public/downloads/jenios-ultra-r127-session.zip','GUIA-R127-SESSAO.md'),('f0ec442f27b0a72bcf72fe512682c5c5653ee586','public/downloads/jenios-ultra-r127-candidate.zip','GUIA-R127-OPERACOES.md')]
pinned={p:subprocess.check_output(['git','show',commit+':'+p]) for commit,p,guide in inputs}
package='public/downloads/jenios-ultra-r128-conciliation.zip';expected=Path(package).read_bytes()
with tempfile.TemporaryDirectory(prefix='r128-rebuild-') as directory:
 root=Path(directory)
 paths=list(pinned)+['scripts/platform/ultra/package-r128.py','lib/platform/ultra/client/session-runtime-r128.mjs','scripts/platform/ultra/qualify-r128.mjs','tests/platformUltraR128Conciliation.test.mjs','docs/release/R128-CONCILIACAO.md']
 for p in paths:
  target=root/p;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(pinned[p] if p in pinned else Path(p).read_bytes())
 subprocess.run(['python','-B','scripts/platform/ultra/package-r128.py'],cwd=directory,check=True,capture_output=True)
 assert (root/package).read_bytes()==expected
with ZipFile(io.BytesIO(expected)) as new:
 names=new.namelist();assert len(names)==len(set(names));hashes=json.loads(new.read('INTEGRIDADE.json'));assert set(names)==set(hashes)|{'INTEGRIDADE.json'}
 for p,h in hashes.items():assert hashlib.sha256(new.read(p)).hexdigest()==h
 for commit,p,guide in inputs:
  with ZipFile(io.BytesIO(pinned[p])) as old:
   for name in old.namelist():
    if name=='INTEGRIDADE.json':continue
    assert old.read(name)==new.read(guide if name=='LEIA-ME.md' else name)
 with tempfile.TemporaryDirectory(prefix='r128-isolated-') as directory:
  new.extractall(directory)
  tests=['tests/platformUltraR127Session.test.mjs','tests/platformUltraR127Runtime.test.mjs','tests/platformUltraR127Records.test.mjs','tests/platformUltraR127Profit.test.mjs','tests/platformUltraR127Integration.test.mjs','tests/platformUltraR128Conciliation.test.mjs']
  run=subprocess.run(['node','--test','--test-reporter=tap',*tests],cwd=directory,capture_output=True,text=True,check=True,env={k:v for k,v in os.environ.items() if k!='NODE_TEST_CONTEXT'})
  assert '# pass 122' in run.stdout or 'pass 122' in run.stdout
  result=subprocess.run(['node','scripts/platform/ultra/qualify-r128.mjs','output'],cwd=directory,capture_output=True,text=True,check=True)
  assert json.loads(result.stdout)['scenarios']==4
  print(json.dumps({'isolatedTests':122,'scenarios':4,'preservedArchives':2,'packageVerified':True}))
`],{encoding:'utf8',timeout:60000});
 assert.deepEqual(JSON.parse(output),{isolatedTests:122,scenarios:4,preservedArchives:2,packageVerified:true});
});
