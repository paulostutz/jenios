/** R71 acceptance infrastructure for an explicitly selected disposable local
 * PostgreSQL database. Protocol fixtures are not private-core execution or
 * hosted evidence. The R71 contract cases are added alongside the schema.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

assert.equal(process.env.JENIOS_R71_DISPOSABLE_DB, 'true', 'Explicit disposable R71 database flag required');
const databaseUrl = new URL(process.env.JENIOS_R71_TEST_DATABASE_URL || 'invalid:');
assert.ok(['postgres:', 'postgresql:'].includes(databaseUrl.protocol));
assert.equal(databaseUrl.hostname, '127.0.0.1', 'Only literal loopback PostgreSQL is permitted');
assert.equal(databaseUrl.pathname, '/jenios_r71_qa');
assert.equal(databaseUrl.username, 'postgres');
assert.equal(databaseUrl.search, ''); assert.equal(databaseUrl.hash, '');
assert.ok(['5432', '56471'].includes(databaseUrl.port || '5432'));
assert.ok(['', 'r71-test-only'].includes(decodeURIComponent(databaseUrl.password)));
assert.notEqual(process.env.VERCEL_ENV, 'production');
for (const key of ['JENIOS_REAL_EXECUTION_ENABLED', 'JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED',
  'JENIOS_PRIVATE_PAPER_EXECUTOR', 'JENIOS_ROBOT_ANALYST_PAID_ENABLED']) assert.notEqual(process.env[key], 'true');

const postgresEnv = { PATH: process.env.PATH || '/usr/bin:/bin', PGHOST: '127.0.0.1', PGHOSTADDR: '127.0.0.1',
  PGPORT: databaseUrl.port || '5432', PGUSER: 'postgres', PGPASSWORD: decodeURIComponent(databaseUrl.password),
  PGDATABASE: 'jenios_r71_qa', PGSSLMODE: 'disable', PGCONNECT_TIMEOUT: '5',
  PGOPTIONS: '-c statement_timeout=15000 -c lock_timeout=5000' };
const psql = input => new Promise((resolve, reject) => {
  const child = spawn('psql', ['-X', '-w', '-q', '-v', 'ON_ERROR_STOP=1', '-At'],
    { env: postgresEnv, stdio: ['pipe', 'pipe', 'pipe'], timeout: 30000 });
  let stdout = '', stderr = '', problem = null;
  child.stdout.on('data', bytes => {
    stdout += bytes;
    if (stdout.length > 16777216) { problem = Error('R71_POSTGRES_OUTPUT_LIMIT'); child.kill('SIGKILL'); }
  });
  child.stderr.on('data', bytes => { if (stderr.length < 32768) stderr += bytes; });
  child.once('error', () => { problem = Error('R71_POSTGRES_PROCESS_UNAVAILABLE'); });
  child.once('close', code => {
    if (problem) reject(problem);
    else if (code === 0) resolve(stdout.trim());
    else reject(Error(stderr.match(/R(?:64|65|67|71)_[A-Z0-9_]+/)?.[0] || 'R71_POSTGRES_QUERY_FAILED'));
  });
  child.stdin.on('error', () => {}); child.stdin.end(input);
});
const encoded = value => "convert_from(decode('" + Buffer.from(JSON.stringify(value)).toString('base64') + "','base64'),'UTF8')::jsonb";
const checks = [];
const check = (name, condition = true) => {
  assert.ok(condition, name); checks.push({ name, status: 'PASS' }); console.log('PASS ' + name);
};
// Never allow an unfinished acceptance harness to report success.
throw Error('R71_ACCEPTANCE_CONTRACT_PENDING');
