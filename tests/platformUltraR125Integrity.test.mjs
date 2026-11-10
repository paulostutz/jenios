import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync,mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {inflateRawSync} from 'node:zlib';
import {verifyR106PublicGuidance} from '../scripts/check-authentication-r106.mjs';
const manifestPath='docs/release/R125-ULTRA-CANDIDATE-EXTENSION.json';
const packagePath='public/downloads/jenios-ultra-r125-candidate.zip';
const sha256=body=>createHash('sha256').update(body).digest('hex');
const inventory=()=>execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
const additions=[
 'lib/platform/ultra/client/workspace-report.mjs',
 'lib/platform/ultra/client/plan-r125.mjs',
 'lib/platform/ultra/client/report-r125.mjs',
 'lib/platform/ultra/policy-r125.mjs',
 'lib/platform/ultra/routes-r125.mjs',
 'lib/platform/ultra/scope-r125.mjs',
 'scripts/platform/ultra/client-r125.mjs',
 'scripts/platform/ultra/mt5_readiness_r125.py',
 'scripts/platform/ultra/test_mt5_readiness_r125.py'
];
function unzip(path){
 const bytes=readFileSync(path),files=new Map();let offset=0;
 while(bytes.readUInt32LE(offset)===0x04034b50){
  assert.equal(bytes.readUInt16LE(offset+6)&9,0,'No encryption or data descriptors');
  assert.equal(bytes.readUInt16LE(offset+8),8,'Only deflated members');
  const size=bytes.readUInt32LE(offset+18),expectedSize=bytes.readUInt32LE(offset+22),names=bytes.readUInt16LE(offset+26),extra=bytes.readUInt16LE(offset+28);
  const name=bytes.subarray(offset+30,offset+30+names).toString(),start=offset+30+names+extra;
  assert.ok(name&&!name.startsWith('/')&&!name.split('/').includes('..')&&!files.has(name),'Unique relative archive path');
  const body=inflateRawSync(bytes.subarray(start,start+size));assert.equal(body.length,expectedSize);
  files.set(name,body);offset=start+size;
 }
 assert.equal(bytes.readUInt32LE(offset),0x02014b50,'Central directory must follow payload');
 return files;
}

test('R125 reconciles immutable checkpoint manifests with published R124 predecessors',()=>{
 const result=verifyR106PublicGuidance({tracked:inventory()});
 assert.equal(result.exactSource,true);assert.equal(result.liveExecutionAllowed,false);assert.equal(result.candidateValidated,false);assert.equal(result.brokerPermissionsGranted,false);
 const m=JSON.parse(readFileSync(manifestPath));
 assert.equal(m.baseCommit,'d63f26ca9ddb9987f74cd62aabe0f42bc181ab63');assert.equal(m.integratedCheckpoint,'ccfca5dc3182da0ca5af8bf38992b1d811b77533');
 assert.equal(m.candidateStatus,'unvalidated_offline_candidate');assert.equal(m.brokerAccountEligibility,'pending');
 assert.equal(m.accountModelStatus,'requested_ultra_holder_account_not_implemented');assert.equal(m.individualAccountsScope,'other_jenios_robots_only');
 assert.equal(Object.keys(m.replacements).length,7);
 for(const [path,entry] of Object.entries(m.replacements))assert.equal(entry.baseline,execFileSync('git',['rev-parse',`${m.baseCommit}:${path}`],{encoding:'utf8'}).trim());
 for(const key of ['liveExecutionAllowed','externalPaperAllowed','nativeValidated','productionPublished','billingAllowed'])assert.equal(m[key],false);
});

test('R125 source guard rejects old manifests, historical sources, R124 additions and current replacements being changed',()=>{
 const tracked=inventory();
 for(const target of [manifestPath,
  'docs/release/R118-EXECUTION-CHECKPOINT-EXTENSION.json','docs/release/R119-BINANCE-PROTOCOL-EXTENSION.json',
  'docs/release/R120-BINANCE-EVENTS-EXTENSION.json','docs/release/R124-INDIVIDUAL-EXTENSION.json',
  'lib/platform/ultra/client/execution-runtime.mjs','lib/platform/ultra/client/binance-durable-adapter-r119.mjs',
  'lib/platform/ultra/client/binance-events-r120.mjs','lib/platform/ultra/client/workspace-report.mjs',
  'lib/platform/ultra/routes-r125.mjs','app/components/platform/UltraAccountReport.js',
  'app/components/platform/PlatformUltraLocal.js','lib/platform/ultra/http.mjs','tests/platformUltraR115.test.mjs',packagePath]){
  assert.throws(()=>verifyR106PublicGuidance({tracked,read:path=>path===target?Buffer.from('unreviewed'):readFileSync(path)}),undefined,target);
 }
});

test('R125 source inventory rejects extra, omitted and duplicate paths',()=>{
 const tracked=inventory();
 assert.throws(()=>verifyR106PublicGuidance({tracked:[...tracked,'lib/platform/ultra/unreviewed.mjs']}),/inventory/);
 assert.throws(()=>verifyR106PublicGuidance({tracked:tracked.filter(p=>p!=='lib/platform/ultra/routes-r125.mjs')}),/inventory/);
 assert.throws(()=>verifyR106PublicGuidance({tracked:[...tracked,manifestPath]}),/inventory/);
});

test('R125 package preserves all R120 bytes, includes only explicit additions and carries no local state',()=>{
 const previous=unzip('public/downloads/jenios-ultra-r120-checkpoint.zip'),files=unzip(packagePath);
 const hashes=JSON.parse(files.get('INTEGRIDADE.json'));assert.equal(files.size,Object.keys(hashes).length+1);
 for(const [path,hash] of Object.entries(hashes)){assert.ok(files.has(path));assert.equal(sha256(files.get(path)),hash,path);}
 const expected=new Set(['INTEGRIDADE.json','LEIA-ME.md','R125-GENIAL-MT5.md',...additions]);
 for(const [path,body] of previous){if(path==='INTEGRIDADE.json')continue;const inherited=path==='LEIA-ME.md'?'GUIA-R120.md':path;expected.add(inherited);assert.deepEqual(files.get(inherited),body,inherited);}
 assert.deepEqual([...files.keys()].sort(),[...expected].sort());
 for(const path of additions)assert.deepEqual(files.get(path),readFileSync(path),path);
 assert.deepEqual(files.get('LEIA-ME.md'),readFileSync('docs/release/R125-CHECKPOINT-README.md'));
 assert.deepEqual(files.get('R125-GENIAL-MT5.md'),readFileSync('docs/release/R125-GENIAL-MT5.md'));
 assert.ok(![...files.keys()].some(p=>/(^|\/)(\.env|node_modules|__pycache__|\.git)|\.(sqlite|db|dll|exe|pyc|pem|key)$/i.test(p)));
 assert.match(files.get('LEIA-ME.md').toString(),/Candidato não validado/);
 assert.match(files.get('LEIA-ME.md').toString(),/alternativa opcional/);
 assert.match(files.get('LEIA-ME.md').toString(),/ainda não implementa essa direção/);
});

test('R125 package rebuild is byte-reproducible and never rewrites an archived ZIP',()=>{
 const before=readFileSync(packagePath),old=sha256(readFileSync('public/downloads/jenios-ultra-r120-checkpoint.zip'));
 const result=JSON.parse(execFileSync('python',['-B','scripts/platform/ultra/package-r125.py'],{encoding:'utf8'}));
 assert.deepEqual(readFileSync(packagePath),before);assert.equal(result.sha256,sha256(before));assert.equal(result.nativeValidated,false);assert.equal(result.liveExecutionAllowed,false);assert.equal(result.productionPublished,false);
 assert.equal(sha256(readFileSync('public/downloads/jenios-ultra-r120-checkpoint.zip')),old);
});

test('R125 candidate runs isolated imports, local plan CLI and MT5 fixtures without a repository or SDK',t=>{
 const directory=mkdtempSync(join(tmpdir(),'ultra-r125-isolated-'));t.after(()=>rmSync(directory,{recursive:true,force:true}));
 for(const [path,body] of unzip(packagePath)){const destination=join(directory,path);mkdirSync(dirname(destination),{recursive:true});writeFileSync(destination,body);}
 const source=`
 import assert from 'node:assert/strict';
 import {writeFileSync} from 'node:fs';
 import {exportClientPlanR125,validateClientPlanR125,clientRoutesR125} from './lib/platform/ultra/client/plan-r125.mjs';
 import * as reports from './lib/platform/ultra/client/report-r125.mjs';
 import {ultraInstrumentScopeR125} from './lib/platform/ultra/scope-r125.mjs';
 const config={markets:[{id:'b3',capital:1000,leverage:1,currency:'BRL'},{id:'crypto',capital:1000,leverage:1,currency:'USDT'}],sessionMinutes:60,maxPositions:3,tradeRiskPct:.25,dailyLossPct:2,maxAssetPct:20,excludedSymbols:[]};
 const plan=exportClientPlanR125({config});assert.deepEqual(plan.brokers,['genial']);assert.deepEqual(plan.config.markets.map(m=>m.provider),['mt5','pending']);assert.equal(plan.executionAuthorization,false);assert.deepEqual(validateClientPlanR125(plan),plan);
 assert.ok(clientRoutesR125(plan).every(r=>r.executionAvailable===false&&r.canStart===false));
 assert.equal(typeof reports.workspaceReportViewR125,'function');assert.equal(typeof reports.reportCsvR125,'function');assert.equal(ultraInstrumentScopeR125({},Date.now()).allowed,false);
 writeFileSync('synthetic-plan.json',JSON.stringify(plan));
 `;
 execFileSync(process.execPath,['--input-type=module','-e',source],{cwd:directory,encoding:'utf8',timeout:30000});
 const result=JSON.parse(execFileSync(process.execPath,['scripts/platform/ultra/client-r125.mjs','plan','synthetic-plan.json'],{cwd:directory,encoding:'utf8',timeout:30000}));
 assert.equal(result.ok,true);assert.equal(result.executionAvailable,false);assert.deepEqual(result.routes.map(r=>r.broker),['genial','genial']);assert.ok(result.routes.every(r=>r.accountConnected===false));
 execFileSync('python',['-B','scripts/platform/ultra/test_mt5_readiness_r125.py'],{cwd:directory,encoding:'utf8',timeout:60000,env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}});
});
