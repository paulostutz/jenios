/** Public R67 protocol fixtures against actual disposable loopback PostgreSQL.
 * No original private executable is loaded by this acceptance. Fixture signatures
 * authenticate a modeled test-source claim only. Hosted targets are rejected.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createR67DatabaseStore, R67_DATABASE_RPCS } from '../../../lib/platform/research/robot-r67-database-store.mjs';
import { verifyR67PrivateObservationRecord, R67_INVARIANTS } from '../../../lib/platform/research/robot-r67-private-protocol.mjs';
import { createR67ProtocolFixture, R67_PROTOCOL_FIXTURE_KIND } from '../../../tests/fixtures/r67-private-protocol-fixture.mjs';

assert.equal(process.env.JENIOS_R67_DISPOSABLE_DB, 'true', 'Explicit disposable R67 DB flag is required');
const url = new URL(process.env.JENIOS_R67_TEST_DATABASE_URL || 'invalid:');
assert.ok(['postgres:', 'postgresql:'].includes(url.protocol) && ['127.0.0.1', 'localhost'].includes(url.hostname), 'Loopback PostgreSQL only');
assert.equal(url.pathname, '/jenios_r67_qa'); assert.equal(url.search, ''); assert.equal(url.hash, '');
const childEnv = { ...process.env, PGHOST: '127.0.0.1', PGHOSTADDR: '127.0.0.1', PGPORT: url.port || '5432',
  PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password), PGDATABASE: 'jenios_r67_qa',
  PGOPTIONS: '-c statement_timeout=15000 -c lock_timeout=5000', PGSSLMODE: 'disable', PGCONNECT_TIMEOUT: '5' };
delete childEnv.PGSERVICE; delete childEnv.PGSERVICEFILE; delete childEnv.PGPASSFILE;
const psql = sql => new Promise((resolve, reject) => {
  const child = spawn('psql', ['-X', '-w', '-q', '-v', 'ON_ERROR_STOP=1', '-At'], { env: childEnv, stdio: ['pipe', 'pipe', 'pipe'], timeout: 30000 });
  let stdout = '', stderr = '';
  child.stdout.on('data', bytes => { stdout += bytes; }); child.stderr.on('data', bytes => { stderr += bytes; });
  child.on('error', () => reject(Error('R67_POSTGRES_PROCESS_UNAVAILABLE')));
  child.on('close', code => code === 0 ? resolve(stdout.trim()) :
    reject(Error(stderr.match(/R67_[A-Z0-9_]+/)?.[0] || 'R67_POSTGRES_QUERY_FAILED: ' + stderr.slice(0, 1200))));
  child.stdin.end(sql);
});
assert.equal(await psql('SELECT current_database();'), 'jenios_r67_qa');
const checks = [], check = (name, ok = true) => { assert.ok(ok, name); checks.push({ name, status: 'PASS' }); console.log('PASS ' + name); };
const encoded = value => "convert_from(decode('" + Buffer.from(JSON.stringify(value)).toString('base64') + "','base64'),'UTF8')::jsonb";
const rpcNames = new Set(Object.values(R67_DATABASE_RPCS));
async function rpc(name, p_input) {
  assert.ok(rpcNames.has(name));
  return JSON.parse(await psql('SET ROLE service_role; SELECT public.' + name + '(' + encoded(p_input) + ');'));
}
const db = { async rpc(name, args) { try { return { data: await rpc(name, args.p_input), error: null }; }
  catch (error) { return { data: null, error: { message: error.message } }; } } };
await psql("DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF;" +
  "IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF;" +
  "IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role BYPASSRLS; END IF; END $$;" +
  'GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role;');
for (const name of ['robot-r64-operational-store.sql', 'robot-r65-lifecycle-store.sql', 'robot-r67-private-capture-store.sql', 'robot-r67-private-capture-store.sql'])
  await psql(readFileSync(new URL('../../../db/schema/' + name, import.meta.url), 'utf8'));
check('R67 additive isolated schema applies twice without replacing R64/R65');
assert.equal(await psql('SELECT count(*) FROM public.jenios_robot_private_captures_r67;'), '0', 'Use a fresh disposable public-fixture R67 database');
const legacyTables = ['events_r64', 'config_r64', 'budgets_r64', 'cycles_r64', 'observation_provenance_r65',
  'reconciliations_r65', 'archives_r65', 'archive_items_r65', 'evolution_r65', 'validation_cases_r65'];
const legacySnapshot = () => psql('SELECT jsonb_build_object(' + legacyTables.map(name => "'" + name + "'," +
  "(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb) FROM public.jenios_robot_" + name + ' t)').join(',') + ');');
const beforeLegacy = await legacySnapshot();
check('R67 table enables RLS as defense in depth', await psql("SELECT relrowsecurity FROM pg_class WHERE relname='jenios_robot_private_captures_r67';") === 't');
for (const role of ['anon', 'authenticated']) {
  await assert.rejects(psql('SET ROLE ' + role + '; SELECT * FROM public.jenios_robot_private_captures_r67;'));
  for (const name of rpcNames) await assert.rejects(psql('SET ROLE ' + role + '; SELECT public.' + name + "('{}'::jsonb);"));
}
check('anonymous and authenticated roles cannot read the table or execute either RPC');
await assert.rejects(psql('SET ROLE service_role; UPDATE public.jenios_robot_private_captures_r67 SET sequence=1;'));
await assert.rejects(psql('SET ROLE service_role; DELETE FROM public.jenios_robot_private_captures_r67;'));
check('service role has no update or delete privilege on accepted private batches');

const scope = n => 'scope:' + n.toString(16).padStart(16, '0');
const session = n => 'session:' + n.toString(16).padStart(16, '0');
const operation = n => 'op:' + n.toString(16).padStart(32, '0');
const baseTime = Date.now() - 1000, main = await createR67ProtocolFixture({ nowMs: baseTime });
assert.equal(main.fixtureEvidence, R67_PROTOCOL_FIXTURE_KIND);
const { scopeId, sourceId } = main.trustedSource;
const store = createR67DatabaseStore({ db, scopeId, sourceId });
const verifiedPair = (fixture, admittedAtMs) => {
  const { receipt, record } = verifyR67PrivateObservationRecord(fixture.record, { trustedSource: fixture.trustedSource, nowMs: admittedAtMs });
  return { receipt, record };
};
const pair = verifiedPair(main, baseTime + 10);
const direct = value => rpc(R67_DATABASE_RPCS.ingest, { scopeId, sourceId, ...value });
const concurrent = await Promise.all([store.ingest(pair), store.ingest(pair)]);
check('real independent connections admit one whole batch and one idempotent duplicate',
  concurrent.filter(x => x.status === 'STORED').length === 1 && concurrent.filter(x => x.status === 'ALREADY_STORED').length === 1 &&
  (await store.read()).length === 1);
assert.deepEqual(concurrent[0].record, main.record); assert.deepEqual(concurrent[0].receipt, concurrent[1].receipt);
check('database roundtrip retains original actions, both signatures and the first receipt exactly');
const laterRetry = verifiedPair(main, baseTime + 100);
assert.equal((await store.ingest(laterRetry)).receipt.admittedAtMs, baseTime + 10);
check('later verification cannot rewrite the original receipt timestamp');

for (const field of ['signatureBase64', 'provenanceSignatureBase64']) {
  const changed = structuredClone(pair);
  if (field === 'signatureBase64') changed.record.envelope[field] = Buffer.alloc(64, 1).toString('base64');
  else changed.record[field] = Buffer.alloc(64, 2).toString('base64');
  await assert.rejects(direct(changed), /R67_DATABASE_EVENT_CONFLICT/);
}
check('conflicting replay compares both signatures rather than accepting matching payload digests alone');
const conflictingReceipt = structuredClone(pair); conflictingReceipt.receipt.sourceKeySha256 = 'a'.repeat(64);
await assert.rejects(direct(conflictingReceipt), /R67_DATABASE_EVENT_CONFLICT/);
check('receipt provenance binding cannot change on replay');

const gap = await createR67ProtocolFixture({ nowMs: baseTime + 20, sequence: 2, sessionId: session(2), operationId: operation(2), privateKeyPem: main.privateKeyPem });
await assert.rejects(store.ingest(verifiedPair(gap, baseTime + 30)), /R67_DATABASE_SEQUENCE_REPLAY/);
const third = await createR67ProtocolFixture({ nowMs: baseTime + 40, sequence: 3, sessionId: pair.receipt.sessionId, operationId: operation(3), privateKeyPem: main.privateKeyPem });
await assert.rejects(store.ingest(verifiedPair(third, baseTime + 50)), /R67_DATABASE_SEQUENCE_REPLAY/);
check('sessions start at one and cannot skip unacknowledged or expired predecessors');
const regressed = await createR67ProtocolFixture({ nowMs: baseTime - 20, sequence: 2, sessionId: pair.receipt.sessionId, operationId: operation(4), privateKeyPem: main.privateKeyPem });
await assert.rejects(store.ingest(verifiedPair(regressed, baseTime + 50)), /R67_DATABASE_SEQUENCE_REPLAY/);
check('session capture time cannot move backwards');
const second = await createR67ProtocolFixture({ nowMs: baseTime + 20, sequence: 2, sessionId: pair.receipt.sessionId, operationId: operation(5), privateKeyPem: main.privateKeyPem });
assert.equal((await store.ingest(verifiedPair(second, baseTime + 30))).status, 'STORED');
check('the exact next signed sequence is admitted after its predecessor');
const renamed = await createR67ProtocolFixture({ nowMs: baseTime + 30, sessionId: session(3), operationId: pair.record.provenance.operationId, privateKeyPem: main.privateKeyPem });
await assert.rejects(store.ingest(verifiedPair(renamed, baseTime + 40)), /R67_DATABASE_OPERATION_CONFLICT/);
check('a previously committed operation cannot be resigned under another session');

await assert.rejects(rpc(R67_DATABASE_RPCS.ingest, { scopeId: scope(999), sourceId, ...pair }), /R67_DATABASE_SCOPE/);
await assert.rejects(rpc(R67_DATABASE_RPCS.ingest, { scopeId, sourceId: 'source:9999999999999999', ...pair }), /R67_DATABASE_SCOPE/);
const foreignStore = createR67DatabaseStore({ db, scopeId: scope(999), sourceId });
assert.deepEqual(await foreignStore.read(), []);
assert.deepEqual(await rpc(R67_DATABASE_RPCS.read, { scopeId, sourceId: 'source:9999999999999999', limit: 30 }), []);
check('scope/source parameters are explicit and cross-scope reads do not return another source history');

const oldTime = Date.now() - 120001;
const expired = await createR67ProtocolFixture({ nowMs: oldTime, sessionId: session(4), operationId: operation(6), privateKeyPem: main.privateKeyPem });
await assert.rejects(store.ingest(verifiedPair(expired, oldTime + 1)), /R67_DATABASE_WINDOW_CLOSED/);
const futureTime = Date.now() + 30000;
const future = await createR67ProtocolFixture({ nowMs: futureTime, sessionId: session(5), operationId: operation(7), privateKeyPem: main.privateKeyPem });
await assert.rejects(store.ingest(verifiedPair(future, futureTime)), /R67_DATABASE_WINDOW_CLOSED/);
check('real PostgreSQL clock rejects expired or future-dated admission even when receipt is internally coherent');

for (const [field, entryField, index] of [['id', 'id', 0], ['horizon', 'horizon', 1], ['intent', 'operatorIntent', 1]]) {
  const invalid = structuredClone(pair);
  invalid.record.envelope.payload.scenarios[index][field] = null;
  invalid.record.envelope.payload.capture.entries[index][entryField] = null;
  await assert.rejects(direct(invalid), /R67_DATABASE_SCENARIO/);
}
for (const mutate of [
  p => { p.scenarios[1].id = p.scenarios[0].id; p.capture.entries[1].id = p.scenarios[0].id; },
  p => { p.scenarios[0].paused = null; },
  p => { p.scenarios[0].unexpected = true; },
]) {
  const invalid = structuredClone(pair); mutate(invalid.record.envelope.payload);
  await assert.rejects(direct(invalid), /R67_DATABASE_SCENARIO/);
}
check('SQL independently rejects matching null fields, duplicate scenario IDs and invalid optional scenario shape');
// SQL JSONB supports arbitrary numeric precision. Inject numeric digest JSON in
// SQL itself so JavaScript cannot round it or turn it into exponent notation.
for (const path of ['{record,envelope,payload,capture,finalEntrySha256}',
  '{record,envelope,payload,capture,entries,0,rawOutputSha256}', '{record,envelope,payload,capture,entries,0,previousSha256}',
  '{record,envelope,payload,capture,entries,0,entrySha256}']) {
  await assert.rejects(psql('SET ROLE service_role; SELECT public.' + R67_DATABASE_RPCS.ingest +
    "(jsonb_set(" + encoded({ scopeId, sourceId, ...pair }) + ",'" + path + "','" + '1'.repeat(64) + "'::jsonb));"), /R67_DATABASE_CAPTURE/);
}
check('SQL requires string digests rather than accepting numeric text coercion');

for (const mutate of [
  p => { p.record.envelope.payload.capture.entries[0].action = 'automatic_buy'; },
  p => { p.record.envelope.payload.capture.entries[1].suggestedSide = 'buy'; },
  p => { p.record.provenance.customerMonitoringActive = true; },
  p => { p.record.provenance.paidProviderCalls = 1; },
  p => { p.record.provenance.policyVersion = 'research:r65-v2'; },
]) {
  const invalid = structuredClone(pair); mutate(invalid); await assert.rejects(direct(invalid), /R67_DATABASE_/);
}
check('native action safety, synthetic invariants and separate policy version are SQL-enforced');
await assert.rejects(rpc(R67_DATABASE_RPCS.read, { scopeId, sourceId, limit: 31 }), /R67_DATABASE_READ_REQUEST/);
await assert.rejects(rpc(R67_DATABASE_RPCS.read, { scopeId, sourceId, limit: 1, callerTrusted: true }), /R67_DATABASE_READ_REQUEST/);
assert.equal((await store.read({ limit: 1 })).length, 1);
check('admin storage reads are bounded and reject extra caller-controlled fields');
const stored = await store.read();
assert.equal(stored.length, 2); assert.equal(await psql('SELECT count(*) FROM public.jenios_robot_private_captures_r67;'), '2');
check('all rejected batches remain atomic and leave exactly two accepted records');
assert.equal(await legacySnapshot(), beforeLegacy);
check('complete R64/R65 event, policy, accounting and evolution table snapshots remain unchanged');

const evidence = { schema: 'JENIOS_R67_POSTGRES_ACCEPTANCE_V1', status: 'PASS', commit: process.env.GITHUB_SHA || null,
  capturedAt: new Date().toISOString(), database: 'DISPOSABLE_LOCAL_POSTGRESQL', postgresVersion: await psql('SHOW server_version;'),
  evidenceKind: R67_PROTOCOL_FIXTURE_KIND, originalPrivateExecutableLoaded: false, originalPrivateExecutableExecuted: false,
  realConcurrentConnections: true, signatureAuthenticationLayer: 'APPLICATION_VERIFIER', sqlCryptographicVerification: false,
  serviceRoleBypassesRls: true, scopeIsolation: 'EXPLICIT_RPC_AND_SERVER_STORE_BINDING', retainedBatches: stored.length,
  retainedCaptures: stored.reduce((sum, value) => sum + value.receipt.captureCount, 0),
  counts: { total: checks.length, passed: checks.length, failed: 0, notRun: 0 }, checks,
  ...R67_INVARIANTS, productionDatabaseAccessed: false, migrationAppliedToSupabase: false,
  productionConfigurationChanged: false, actualHostIdentityVerified: false };
const directory = process.env.ROBOT_QA_ARTIFACT_DIR;
if (directory) { mkdirSync(directory, { recursive: true }); writeFileSync(join(directory, 'r67-postgres-acceptance.json'), JSON.stringify(evidence, null, 2) + '\n'); }
console.log('R67_POSTGRES_ACCEPTANCE ' + JSON.stringify(evidence));
