import test from 'node:test';import assert from 'node:assert/strict';
import {buildOfficialConnectorWorklist} from '../lib/platform/launch/b223-provider-gaps.mjs';
test('B223 explicit 12-provider obligations, none promoted to supported live trading',()=>{
 const rows=buildOfficialConnectorWorklist();assert.equal(rows.length,12);
 assert.equal(rows.find(x=>x.provider==='alpaca').phase,'READ_ONLY_DEMO_ADAPTER_EXISTS');
 assert.ok(rows.find(x=>x.provider==='profit').blockers.includes('CONFIRM_PROFIT_DLL_LICENSE'));
 assert.ok(rows.find(x=>x.provider==='ctrader').blockers.includes('REGISTER_OFFICIAL_OAUTH_APP'));
 assert.ok(rows.every(x=>!x.verifiedExternalAccount&&!x.supportedForLiveTrading));
});
