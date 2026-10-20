import test from 'node:test';
import assert from 'node:assert/strict';
import {brokerCapabilities} from '../lib/platform/connections/capabilities.mjs';
const vaultKey=Buffer.alloc(32,23).toString('base64');
const allProviders=['binance','profit','genial','clear','xp','btg','mt5','ctrader','ibkr','alpaca','mercado-bitcoin','kraken'];
test('B170 all twelve official guides exposed but only two demo read-only implementations',()=>{
 const c=brokerCapabilities({VERCEL_ENV:'production',JENIOS_DEMO_CONNECTORS_ENABLED:'true',JENIOS_DEMO_VAULT_KEY_B64:vaultKey});
 assert.deepEqual(c.connections.map(x=>x.provider),allProviders);
 assert.equal(c.connections.filter(x=>x.demoReadOnlyApiImplemented).length,2);
 assert.equal(c.connections.filter(x=>x.demoReadOnlyAvailable).length,0);
 for(const provider of c.connections){
  assert.equal(provider.orderExecutionEnabled,false);assert.equal(provider.withdrawalsEnabled,false);
  assert.equal(provider.providerAccountAuthenticatedByJenios,false);
  assert.equal(provider.brokerApiPermissionAuditCertified,false);
  assert.ok(provider.guideUrl.startsWith('/integracoes?provider='));
 }
 assert.equal(c.realOrderExecution,false);assert.equal(c.custody,false);
});
test('B170 private preview flags never advertise orders, only demo GET',()=>{
 const c=brokerCapabilities({VERCEL_ENV:'preview',JENIOS_DEMO_CONNECTORS_ENABLED:'true',JENIOS_DEMO_VAULT_KEY_B64:vaultKey});
 assert.deepEqual(c.connections.filter(x=>x.demoReadOnlyAvailable).map(x=>x.provider),['binance','alpaca']);
 assert.ok(c.connections.every(x=>!x.orderExecutionEnabled&&!x.withdrawalsEnabled));
});
test('B170 without correct vault, no demo connector is advertised as operational',()=>{
 for(const env of [{VERCEL_ENV:'preview',JENIOS_DEMO_CONNECTORS_ENABLED:'true'},
                   {VERCEL_ENV:'preview',JENIOS_DEMO_CONNECTORS_ENABLED:'false',JENIOS_DEMO_VAULT_KEY_B64:vaultKey}]){
  assert.ok(brokerCapabilities(env).connections.every(x=>!x.demoReadOnlyAvailable));
 }
});
test('B170 metadata cannot expose tokens or private details',()=>{
 const text=JSON.stringify(brokerCapabilities({VERCEL_ENV:'preview',JENIOS_DEMO_CONNECTORS_ENABLED:'true',JENIOS_DEMO_VAULT_KEY_B64:vaultKey}));
 assert.ok(!text.includes(vaultKey));assert.ok(!text.includes('apiKey'));assert.ok(!text.includes('secret'));
});
