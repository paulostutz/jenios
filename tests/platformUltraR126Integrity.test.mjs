import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {verifyR106PublicGuidance} from '../scripts/check-authentication-r106.mjs';
const manifest='docs/release/R126-TEST-EXTENSION.json';
test('R126 source manifest preserves historical sources and refuses unreviewed changes',()=>{
 assert.equal(verifyR106PublicGuidance().exactSource,true);
 const m=JSON.parse(readFileSync(manifest));assert.equal(m.accountModel,'each_client_own_account');
 for(const flag of ['nativeValidated','liveExecutionAllowed','externalPaperAllowed','billingAllowed'])assert.equal(m[flag],false);
 for(const path of [manifest,...Object.keys(m.additions),...Object.keys(m.replacements),'lib/platform/ultra/client/execution-runtime.mjs','lib/platform/ultra/client/workspace-report.mjs','lib/platform/ultra/http.mjs']){
  assert.throws(()=>verifyR106PublicGuidance({read:p=>p===path?Buffer.from('unreviewed'):readFileSync(p)}),undefined,path);
 }
});
test('R126 package is reproducible and its isolated rehearsal passes without SDK or account',()=>{
 const path='public/downloads/jenios-ultra-r126-rehearsal.zip';
 const result=execFileSync('python',['-B','-c',`
import hashlib,json,tempfile,subprocess,io
from pathlib import Path
from zipfile import ZipFile
# Legacy R125 tests rebuild their archive in parallel. Test R126 in a separate
# tree with the immutable predecessor, never writing a shared artifact.
old_bytes=subprocess.check_output(['git','show','8cd35ab6caedac31ea327c72e037de43bc309c48:public/downloads/jenios-ultra-r125-candidate.zip'])
before=Path('${path}').read_bytes()
with tempfile.TemporaryDirectory(prefix='r126-rebuild-test-') as directory:
 root=Path(directory)
 for p in ['public/downloads/jenios-ultra-r125-candidate.zip','scripts/platform/ultra/package-r126.py','scripts/platform/ultra/rehearse-r126.mjs','docs/release/R126-TESTE-SEGURO.md']:
  dest=root/p;dest.parent.mkdir(parents=True,exist_ok=True)
  dest.write_bytes(old_bytes if p.endswith('r125-candidate.zip') else Path(p).read_bytes())
 subprocess.run(['python','-B','scripts/platform/ultra/package-r126.py'],cwd=directory,capture_output=True,check=True)
 assert (root/'${path}').read_bytes()==before
with ZipFile(io.BytesIO(old_bytes)) as old, ZipFile(io.BytesIO(before)) as new:
 names=new.namelist(); assert len(names)==len(set(names))
 expected=json.loads(new.read('INTEGRIDADE.json')); assert set(names)==set(expected)|{'INTEGRIDADE.json'}
 for p,h in expected.items(): assert hashlib.sha256(new.read(p)).hexdigest()==h
 for p in old.namelist():
  if p=='INTEGRIDADE.json': continue
  destination='GUIA-R125-HISTORICO.md' if p=='LEIA-ME.md' else p
  assert old.read(p)==new.read(destination)
 assert set(names)-set(old.namelist())=={'GUIA-R125-HISTORICO.md','scripts/platform/ultra/rehearse-r126.mjs'}
 assert 'Cada cliente conecta a própria conta' in new.read('LEIA-ME.md').decode()
 with tempfile.TemporaryDirectory(prefix='r126-package-test-') as directory:
  new.extractall(directory)
  completed=subprocess.run(['node','scripts/platform/ultra/rehearse-r126.mjs'],cwd=directory,capture_output=True,text=True,check=True)
  report=json.loads(completed.stdout); assert report['passed'] and len(report['checks'])==18 and report['ordersSentToBroker']==0
  print(json.dumps({'packageVerified':True,'checks':len(report['checks'])}))
`],{encoding:'utf8',timeout:60000});
 assert.deepEqual(JSON.parse(result),{packageVerified:true,checks:18});
});
