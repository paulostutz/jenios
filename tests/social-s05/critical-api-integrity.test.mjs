import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
const manifest=JSON.parse(readFileSync('docs/s05/CRITICAL-API-SHA256.json','utf8'));
for(const [name,expected] of Object.entries(manifest)){
 test('frozen production-compatible API hash '+name,()=>{
  const actual=createHash('sha256').update(readFileSync(name)).digest('hex');assert.equal(actual,expected);
 });
}
