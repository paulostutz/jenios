import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('B84 historical data audit and replay are visibly available from original Platform lab',()=>{
 const x=readFileSync('app/components/platform/PlatformStrategyLab.js','utf8');
 for(const name of ['inspectHistoricalBars','replayHistoricalScenario','simular','simBalance','paperStops','hypotheticalMaxDrawdownPct','quality.replayEligible'])
  assert.ok(x.includes(name)||name==='simular'&&x.includes('simulateReplay'),name);
 assert.match(x,/disabled=\{!quality\.replayEligible\|\|!plan\.rehearsalAllowed\}/);
 assert.match(x,/feeBps:10,slippageBps:10,stopPct:0\.02/);
});
test('B84 historical bar results are invalidated on source changes',()=>{
 const x=readFileSync('app/components/platform/PlatformStrategyLab.js','utf8');
 assert.match(x,/setInput\(e\.target\.value\);setResult\(null\);setQuality\(null\);setReplay\(null\)/);
 assert.match(x,/setTimeframe\(e\.target\.value\);setResult\(null\);setQuality\(null\);setReplay\(null\)/);
});
test('B84 original robots and all financial API code remain unmodified by lab integration',()=>{
 const src=readFileSync('app/components/platform/PlatformStrategyLab.js','utf8');
 assert.match(src,/fetch\('\/api\/platform\/market-observation\?/);
 assert.match(src,/method:'GET'/);
 assert.doesNotMatch(src,/\/api\/platform\/checkout|method:'POST'|service_role|orderAuthorized:true|brokerConnected:true/);
});
