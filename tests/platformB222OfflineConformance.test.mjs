import test from 'node:test';import assert from 'node:assert/strict';
import {runOfflineBrokerConformance} from '../lib/platform/launch/b222-offline-provider-conformance.mjs';
for(const provider of ['alpaca','binance'])test('B222 official '+provider+' read-only contract passes with injected fixtures, not network',async()=>{
 const r=await runOfflineBrokerConformance(provider);assert.equal(r.simulatedGetCalls,3);assert.equal(r.realNetworkCalls,0);assert.equal(r.orderSenderEnabled,false);
});
test('B222 unimplemented providers rejected, cannot be called through fake URL',async()=>assert.rejects(runOfflineBrokerConformance('ctrader'),/B222_PROVIDER_OR_CLOCK_INVALID/));
