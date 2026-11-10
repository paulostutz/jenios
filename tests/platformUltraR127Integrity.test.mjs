import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {verifyR106PublicGuidance} from '../scripts/check-authentication-r106.mjs';
test('R127 source remains additive and inherited financial/native code stays pinned',()=>{
 assert.equal(verifyR106PublicGuidance().exactSource,true);const path='docs/release/R127-SESSION-EXTENSION.json',m=JSON.parse(readFileSync(path));
 assert.deepEqual(m.replacements,{});assert.equal(m.accountModel,'each_client_own_account');
 for(const flag of ['nativeValidated','liveExecutionAllowed','externalPaperAllowed','billingAllowed','productionPublished'])assert.equal(m[flag],false);
 for(const target of [path,...Object.keys(m.additions),'lib/platform/ultra/client/execution-runtime.mjs','lib/platform/ultra/client/execution-ledger.mjs','lib/platform/ultra/http.mjs','docs/release/R126-TEST-EXTENSION.json']){
  assert.throws(()=>verifyR106PublicGuidance({read:p=>p===target?Buffer.from('unreviewed'):readFileSync(p)}),undefined,target);
 }
});
test('R127 isolated package preserves R126 and reproduces all session tests',()=>{
 const result=execFileSync('python',['-B','-c',`
import hashlib,json,tempfile,subprocess,io
from pathlib import Path
from zipfile import ZipFile
old_bytes=subprocess.check_output(['git','show','02f547531d4e2353fa1c397d0a6cb2b8edb68b2c:public/downloads/jenios-ultra-r126-rehearsal.zip'])
package='public/downloads/jenios-ultra-r127-session.zip';before=Path(package).read_bytes()
with tempfile.TemporaryDirectory(prefix='r127-package-rebuild-') as directory:
 root=Path(directory)
 for p in ['public/downloads/jenios-ultra-r126-rehearsal.zip','scripts/platform/ultra/package-r127.py','lib/platform/ultra/client/session-runtime-r127.mjs','scripts/platform/ultra/rehearse-session-r127.mjs','tests/platformUltraR127Session.test.mjs','docs/release/R127-SESSAO-DURAVEL.md']:
  dest=root/p;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(old_bytes if p.endswith('r126-rehearsal.zip') else Path(p).read_bytes())
 subprocess.run(['python','-B','scripts/platform/ultra/package-r127.py'],cwd=directory,capture_output=True,check=True)
 assert (root/package).read_bytes()==before
with ZipFile(io.BytesIO(old_bytes)) as old, ZipFile(io.BytesIO(before)) as new:
 names=new.namelist();assert len(names)==len(set(names));expected=json.loads(new.read('INTEGRIDADE.json'));assert set(names)==set(expected)|{'INTEGRIDADE.json'}
 for p,h in expected.items():assert hashlib.sha256(new.read(p)).hexdigest()==h
 for p in old.namelist():
  if p=='INTEGRIDADE.json':continue
  dest='GUIA-R126.md' if p=='LEIA-ME.md' else p
  assert old.read(p)==new.read(dest)
 assert set(names)-set(old.namelist())=={'GUIA-R126.md','lib/platform/ultra/client/session-runtime-r127.mjs','scripts/platform/ultra/rehearse-session-r127.mjs','tests/platformUltraR127Session.test.mjs'}
 with tempfile.TemporaryDirectory(prefix='r127-isolated-run-') as directory:
  new.extractall(directory)
  tests=subprocess.run(['node','--test','tests/platformUltraR127Session.test.mjs'],cwd=directory,capture_output=True,text=True,check=True)
  run=subprocess.run(['node','scripts/platform/ultra/rehearse-session-r127.mjs'],cwd=directory,capture_output=True,text=True,check=True)
  result=json.loads(run.stdout);assert result['passed'] and len(result['checks'])==14 and result['ordersSentToBroker']==0
  print(json.dumps({'isolatedTestsPassed':True,'rehearsalChecks':len(result['checks']),'packageVerified':True}))
`],{encoding:'utf8',timeout:60000});
 assert.deepEqual(JSON.parse(result),{isolatedTestsPassed:true,rehearsalChecks:14,packageVerified:true});
});
