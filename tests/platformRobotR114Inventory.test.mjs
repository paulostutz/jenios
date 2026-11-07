import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {verifyR106PublicGuidance} from '../scripts/check-authentication-r106.mjs';
test('R114 inventory preserves immutable predecessors and rejects modified context or integration',()=>{
 assert.equal(verifyR106PublicGuidance().exactSource,true);
 for(const target of ['lib/platform/research/market-flow-context.mjs','lib/platform/research/ultrafast-v2-pipeline.mjs',
  'lib/whale-transfers.mjs','docs/release/R114-FLOW-SOURCE-EXTENSION.json']){
  assert.throws(()=>verifyR106PublicGuidance({read:path=>path===target?Buffer.from('unreviewed'):readFileSync(path)}));
 }
});
