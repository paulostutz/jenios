import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const program=new URL('../scripts/platform/connections/b209-private-observer-cli.mjs',import.meta.url);
const enabled={JENIOS_PRIVATE_PAPER_REHEARSAL:'true',JENIOS_PRIVATE_PAPER_ACCOUNT_PREFLIGHT:'true',
 JENIOS_PRIVATE_PAPER_READ_OBSERVER:'true',JENIOS_PRIVATE_PAPER_OBSERVER_WORKER:'true',
 JENIOS_DEMO_VAULT_KEY_B64:Buffer.alloc(32,8).toString('base64'),
 JENIOS_PAPER_OBSERVER_KEY_B64:Buffer.alloc(32,9).toString('base64')};
const run=(mode,vars={})=>spawnSync(process.execPath,[program.pathname,mode],
 {encoding:'utf8',env:{PATH:process.env.PATH,HOME:process.env.HOME,...vars}});
test('B209 CLI --status is no-network and does not pretend to deploy a worker',()=>{
 const x=run('--status',enabled);assert.equal(x.status,0);
 const j=JSON.parse(x.stdout);assert.equal(j.status,'ISOLATED_CONFIG_VALID');
 assert.equal(j.adapterConfigured,false);assert.equal(j.workerDeployedByStatus,false);
 assert.equal(j.ordersSent,0);assert.equal(j.liveExecution,false);
});
test('B209 CLI without private flags fails closed with no env secret leak',()=>{
 const x=run('--status',{JENIOS_DEMO_VAULT_KEY_B64:'SHOULD_NEVER_APPEAR'});
 assert.equal(x.status,1);assert.equal(x.stdout.includes('SHOULD_NEVER_APPEAR'),false);
 assert.equal(JSON.parse(x.stdout).status,'HALTED_READ_ONLY_REQUIREMENTS_UNMET');
});
test('B209 CLI --once refuses to operate without protected external adapter',()=>{
 const x=run('--once',enabled);assert.equal(x.status,1);
 assert.equal(JSON.parse(x.stdout).ordersSent,0);
 assert.equal(x.stdout.includes(enabled.JENIOS_PAPER_OBSERVER_KEY_B64),false);
});
