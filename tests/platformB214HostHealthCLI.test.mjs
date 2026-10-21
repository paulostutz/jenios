import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {PaperLedger} from '../lib/platform/pilot-prep/paper-ledger.mjs';
import {AlpacaPaperDispatchJournal} from '../lib/platform/connections/alpaca-paper-dispatch-journal.mjs';
import {PrivatePaperReadAuditStore} from '../lib/platform/connections/b207-durable-read-audit.mjs';
const env={PATH:process.env.PATH,HOME:process.env.HOME,
 JENIOS_PRIVATE_PAPER_REHEARSAL:'true',JENIOS_PRIVATE_PAPER_ACCOUNT_PREFLIGHT:'true',
 JENIOS_PRIVATE_PAPER_READ_OBSERVER:'true',JENIOS_PRIVATE_PAPER_OBSERVER_WORKER:'true',
 JENIOS_DEMO_VAULT_KEY_B64:Buffer.alloc(32,4).toString('base64'),
 JENIOS_PAPER_OBSERVER_KEY_B64:Buffer.alloc(32,7).toString('base64')};
const cli=new URL('../scripts/platform/connections/b214-private-host-check.mjs',import.meta.url);
const run=(args=[],vars={})=>spawnSync(process.execPath,[cli.pathname,...args],
 {env:{...env,...vars},encoding:'utf8'});
function fixture(fn){const dir=mkdtempSync(join(tmpdir(),'jenios-b214-')),p=join(dir,'private');
 mkdirSync(p,{mode:0o700});const adapter=join(p,'adapter.mjs');
 writeFileSync(adapter,'export const allowed=true;\n',{mode:0o600});
 const vars={JENIOS_PRIVATE_OBSERVER_ADAPTER_PATH:adapter,
 JENIOS_PRIVATE_OBSERVER_RISK_PATH:join(dir,'risk.sqlite'),
 JENIOS_PRIVATE_OBSERVER_DISPATCH_PATH:join(dir,'dispatch.sqlite'),
 JENIOS_PRIVATE_OBSERVER_AUDIT_PATH:join(dir,'audit.sqlite')};
 const l=new PaperLedger(vars.JENIOS_PRIVATE_OBSERVER_RISK_PATH),
 d=new AlpacaPaperDispatchJournal(vars.JENIOS_PRIVATE_OBSERVER_DISPATCH_PATH),
 a=new PrivatePaperReadAuditStore(vars.JENIOS_PRIVATE_OBSERVER_AUDIT_PATH,{env});
 l.close();d.close();a.close();
 try{return fn(vars);}finally{rmSync(dir,{force:true,recursive:true});}
}
test('B214 host check is a separate read-only operator preflight',()=>fixture(vars=>{
 const r=run(['--check'],vars);assert.equal(r.status,0,r.stderr);
 const body=JSON.parse(r.stdout);
 assert.equal(body.isolatedStores,3);assert.equal(body.adapterAttested,true);
 assert.equal(body.workerInstalledByCheck,false);assert.equal(body.ordersSent,0);
 assert.equal(body.brokerPermissionsIndependentlyVerified,false);
 assert.equal(r.stdout.includes(vars.JENIOS_PRIVATE_OBSERVER_ADAPTER_PATH),false);
}));
test('B214 host check fails closed for incomplete local resources',()=>{
 const r=run(['--check']);assert.equal(r.status,1);
 assert.equal(JSON.parse(r.stdout).status,'HOST_PREFLIGHT_NO_GO');
 assert.equal(r.stdout.includes(env.JENIOS_PAPER_OBSERVER_KEY_B64),false);
});
test('B214 never accepts commands to send, resubmit, install or restart orders',()=>fixture(vars=>{
 for(const cmd of ['--trade','--install','--restart','--paper-post']){
  const r=run([cmd],vars);assert.equal(r.status,1);
  assert.equal(JSON.parse(r.stdout).ordersSent,0);
 }
}));
test('B214 refuses even a configured host inside Vercel runtime',()=>fixture(vars=>{
 const r=run(['--check'],{...vars,VERCEL_ENV:'preview'});
 assert.equal(r.status,1);assert.equal(JSON.parse(r.stdout).liveExecution,false);
}));
