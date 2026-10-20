import test from 'node:test';import assert from 'node:assert/strict';
import {providerPath,providerPaths} from '../lib/platform/connections/provider-paths.mjs';
import {CONNECTION_GUIDES} from '../lib/platform/connections/catalog.mjs';
test('B171 exact 12 providers and paths match B170 guides without invented API connectivity',()=>{
 const rows=providerPaths();assert.deepEqual(rows.map(x=>x.provider),CONNECTION_GUIDES.map(x=>x.id));
 assert.equal(rows.length,12);for(const r of rows){assert.equal(r.authenticatedProduction,false);assert.equal(r.paperOrdersCertified,false);assert.equal(r.custody,false);assert.equal(r.withdrawalApi,false);assert.ok(r.next.length>10);}
 assert.equal(rows.filter(x=>x.capability==='read_only_demo_implemented_not_authenticated').length,2);
});
for(const p of ['profit','genial','clear','xp','btg','mt5'])test('B171 '+p+' requires a supported terminal or vendor route',()=>assert.equal(providerPath(p).needsTerminal,true));
test('B171 cTrader demo OAuth and IBKR gateway are not misrepresented',()=>{assert.equal(providerPath('ctrader').authentication,'oauth2_accounts_then_trading_scope');assert.equal(providerPath('ibkr').kind,'client_portal_or_approved_vendor');assert.equal(providerPath('kraken').environment,'spot_test_environment_not_certified');});
test('B171 absent provider does not invent new connector',()=>assert.equal(providerPath('missing'),null));
test('B171 anonymous readiness endpoint lists factual routes without any secret acceptance',async()=>{
 const {GET}=await import('../app/api/platform/broker-readiness/route.js');
 const response=await GET();assert.equal(response.status,200);
 const data=await response.json();assert.equal(data.totalGuides,12);assert.equal(data.credentialsAccepted,false);
 assert.equal(data.accountAuthenticated,false);assert.equal(data.demoOrdersCertified,false);
 assert.equal(data.providerRoutes.length,12);
 assert.ok(!JSON.stringify(data).includes('apiKey'));assert.ok(!JSON.stringify(data).includes('client_secret'));
});
