import test from 'node:test';import assert from 'node:assert/strict';
import {auditReadOnlyRuntimeFence} from '../lib/platform/launch/b218-runtime-fence.mjs';
const env={JENIOS_PRIVATE_PAPER_REHEARSAL:'true',JENIOS_PRIVATE_PAPER_ACCOUNT_PREFLIGHT:'true',
 JENIOS_PRIVATE_PAPER_READ_OBSERVER:'true',JENIOS_PRIVATE_PAPER_OBSERVER_WORKER:'true',
 JENIOS_DEMO_VAULT_KEY_B64:Buffer.alloc(32,1).toString('base64'),
 JENIOS_PAPER_OBSERVER_KEY_B64:Buffer.alloc(32,2).toString('base64')};
test('B218 read-only runtime gate returns no secret/authority',()=>{const r=auditReadOnlyRuntimeFence(env);assert.equal(r.paperOrderEndpointEnabled,false);assert.ok(!JSON.stringify(r).includes(env.JENIOS_DEMO_VAULT_KEY_B64));});
for(const patch of [{VERCEL_ENV:'preview'},{JENIOS_PRIVATE_PAPER_EXECUTOR:'true'},
 {JENIOS_PRIVATE_PAPER_REHEARSAL:'false'},{JENIOS_REAL_EXECUTION_ENABLED:'true'}])
 test('B218 production/live switches fail closed',()=>assert.throws(()=>auditReadOnlyRuntimeFence({...env,...patch}),/B218_PRIVATE_GET_ONLY_RUNTIME_REQUIRED/));
test('B218 missing/equal secrets denied',()=>{
 assert.throws(()=>auditReadOnlyRuntimeFence({...env,JENIOS_PAPER_OBSERVER_KEY_B64:env.JENIOS_DEMO_VAULT_KEY_B64}),/B218_INDEPENDENT_KEYS_REQUIRED/);
 assert.throws(()=>auditReadOnlyRuntimeFence({...env,JENIOS_PAPER_OBSERVER_KEY_B64:'test'}),/B218_PRIVATE_KEYS_NOT_CONFIGURED/);
});
