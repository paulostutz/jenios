import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
for(const name of ['s05-staging-deletion-rollback.sql','s05-staging-trial-rollback.sql']){
 test('S05 PostgreSQL fixture executes only in explicit staging transaction: '+name,()=>{
  const s=readFileSync('tests/sql/'+name,'utf8');
  assert.match(s,/^BEGIN;/m);assert.match(s,/ROLLBACK;/);assert.match(s,/NOT_STAGING_REFUSE_TEST/);
  assert.match(s,/jenios_s04_staging_guard_20261017/);assert.doesNotMatch(s,/DELETE\s+FROM\s+auth\.users|DROP\s+TABLE|TRUNCATE\s+/i);
 });
}
