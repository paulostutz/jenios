import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {verifyR106PublicGuidance} from '../scripts/check-authentication-r106.mjs';

const manifestPath='docs/release/R129-MONTHLY-INTEGRATION-EXTENSION.json';
const manifest=()=>JSON.parse(readFileSync(manifestPath,'utf8'));
const tracked=()=>execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);

test('R129 exact source guard preserves R128 and UM001 and permits only the reviewed journey replacement',()=>{
 const result=verifyR106PublicGuidance(),m=manifest();
 assert.equal(result.exactSource,true);assert.equal(result.r129MonthlyIntegrationOnly,true);
 assert.equal(result.monthlyPreparationOnly,true);assert.equal(result.billingAllowed,false);assert.equal(result.realDebitAllowed,false);
 assert.equal(m.baseCommit,'ac3ea769faa89eff81f0942990a4370a73340e37');
 assert.deepEqual(Object.keys(m.replacements),['app/components/platform/UltraRehearsalR126.js']);
 for(const flag of ['nativeValidated','liveExecutionAllowed','externalPaperAllowed','billingAllowed','realDebitAllowed','productionPublished','visualQaPerformed'])assert.equal(m[flag],false);
});

test('R129 guard rejects changed bridge, vendor, historical bytes and unknown or duplicate files',()=>{
 const m=manifest();
 for(const target of [manifestPath,...Object.keys(m.additions),...Object.keys(m.replacements),
  'docs/release/R128-CONCILIATION-EXTENSION.json','docs/release/UM001-MONTHLY-PREPARATION-EXTENSION.json',
  'lib/platform/ultra/client/session-runtime-r128.mjs','lib/platform/ultra/fees-um001.mjs',
  'public/downloads/jenios-ultra-r128-conciliation.zip']){
  assert.throws(()=>verifyR106PublicGuidance({read:path=>path===target?Buffer.from('unreviewed-change'):readFileSync(path)}),undefined,target);
 }
 const files=tracked(),added=Object.keys(m.additions)[0];
 assert.throws(()=>verifyR106PublicGuidance({tracked:[...files,'unknown-r129-file.mjs']}),/inventory/);
 assert.throws(()=>verifyR106PublicGuidance({tracked:files.filter(path=>path!==added)}),/inventory/);
 assert.throws(()=>verifyR106PublicGuidance({tracked:[...files,added]}),/inventory/);
});

test('R129 package reproduces exactly and retains all R128 members and every new source byte',()=>{
 const script=String.raw`
from pathlib import Path
from zipfile import ZipFile
from tempfile import TemporaryDirectory
import hashlib,json,runpy,shutil,subprocess
root=Path.cwd()
builder='scripts/platform/ultra/package-r129.py'
spec=runpy.run_path(str(root/builder))
package=root/spec['TARGET']
expected=package.read_bytes()
with TemporaryDirectory(prefix='r129-reproduce-') as tmp:
 copy=Path(tmp)
 for p in [builder,spec['PREVIOUS'],'docs/release/R129-INTEGRACAO-MENSAL.md',*spec['ADDITIONS']]:
  target=copy/p;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(root/p,target)
 subprocess.run(['python3',str(copy/builder)],cwd=copy,check=True,capture_output=True)
 assert (copy/spec['TARGET']).read_bytes()==expected
with ZipFile(package) as current, ZipFile(root/spec['PREVIOUS']) as prior:
 names=current.namelist();assert len(names)==len(set(names))
 integrity=json.loads(current.read('INTEGRIDADE.json'))
 assert set(names)==set(integrity)|{'INTEGRIDADE.json'}
 for name,sha in integrity.items():assert hashlib.sha256(current.read(name)).hexdigest()==sha,name
 for name in prior.namelist():
  if name=='INTEGRIDADE.json':continue
  mapped='GUIA-R128-CONCILIACAO.md' if name=='LEIA-ME.md' else name
  assert current.read(mapped)==prior.read(name),name
 for name in spec['ADDITIONS']:assert current.read(name)==(root/name).read_bytes(),name
 assert current.read('LEIA-ME.md')==(root/'docs/release/R129-INTEGRACAO-MENSAL.md').read_bytes()
print(json.dumps({'files':len(names),'reproducible':True,'r128Preserved':True}))
`;
 const result=JSON.parse(execFileSync('python3',['-c',script],{encoding:'utf8'}));
 assert.equal(result.reproducible,true);assert.equal(result.r128Preserved,true);assert.ok(result.files>98);
});
