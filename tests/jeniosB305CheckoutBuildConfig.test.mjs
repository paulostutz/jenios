import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// The initial R37 CI rejected the route-level maxDuration export. Preserve its
// 60-second limit as a single scoped deployment setting, not a project-wide change.
test('R37 checkout duration remains scoped without disabling Next type checks',()=>{
 const config=JSON.parse(readFileSync('vercel.json','utf8'));
 assert.deepEqual(config.functions,{'app/api/jenios-pay/checkout/route.js':{maxDuration:60}});
 assert.deepEqual(config.crons,[
  {path:'/api/jenios-pay/inter/reconcile',schedule:'17 * * * *'},
  {path:'/api/jenios-pay/inter/reconcile-boleto',schedule:'43 * * * *'}
 ]);
 assert.deepEqual(config.git,{deploymentEnabled:{main:true}});
 assert.doesNotMatch(readFileSync('app/api/jenios-pay/checkout/route.js','utf8'),/export const maxDuration/);
 assert.equal(config.buildCommand,undefined);
});
