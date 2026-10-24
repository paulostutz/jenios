/** R67 PRIVATE LOCAL acceptance. Requires the separately retained ORIGINAL
 * modules; public CI must not substitute fixtures for this execution evidence.
 * Actual processes, loopback HTTP and disposable PostgreSQL are used. Admin
 * identity is explicitly simulated; neither Supabase Auth nor Next is tested.
 */
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { createHash, generateKeyPairSync, randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadR67VerifiedPrivateCore, inspectR67VerifiedPrivateCore,
  captureR67VerifiedPrivateBatch } from '../../../lib/platform/research/robot-r67-private-core-loader.mjs';
import { createR67DatabaseStore, R67_DATABASE_RPCS } from '../../../lib/platform/research/robot-r67-database-store.mjs';
import { createR67ObservationHandler, createR67AdminHandler } from '../../../lib/platform/research/robot-r67-http.mjs';
import { R67_OBSERVATION_PATH } from '../../../lib/platform/research/robot-r67-loopback-transport.mjs';
import { R67_ORIGIN, R67_EVIDENCE, R67_LIMITS, R67_BINDING, R67_INVARIANTS, canonicalR67Json,
  r67RecordDigest, verifyR67PrivateObservationRecord } from '../../../lib/platform/research/robot-r67-private-protocol.mjs';
import { verifyB297CaptureChain } from '../../../lib/platform/research/b297-private-readonly-audit.mjs';

assert.equal(process.env.JENIOS_R67_DISPOSABLE_DB, 'true', 'Explicit disposable R67 database flag required');
const databaseUrl = new URL(process.env.JENIOS_R67_TEST_DATABASE_URL || 'invalid:');
assert.ok(['postgres:', 'postgresql:'].includes(databaseUrl.protocol));
assert.equal(databaseUrl.hostname, '127.0.0.1');
assert.equal(databaseUrl.pathname, '/jenios_r67_private_qa');
assert.equal(databaseUrl.search, ''); assert.equal(databaseUrl.hash, '');
assert.equal(decodeURIComponent(databaseUrl.username), 'postgres');
assert.ok(['', 'r67-test-only', 'r66-test-only', 'r64-test-only'].includes(decodeURIComponent(databaseUrl.password)));
assert.ok(['5432', '56466', '56467'].includes(databaseUrl.port || '5432'));
for (const flag of ['JENIOS_REAL_EXECUTION_ENABLED', 'JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED',
  'JENIOS_PRIVATE_PAPER_EXECUTOR', 'JENIOS_ROBOT_ANALYST_PAID_ENABLED']) assert.notEqual(process.env[flag], 'true');
assert.notEqual(process.env.VERCEL_ENV, 'production');
assert.ok(process.env.JENIOS_R67_PRIVATE_CORE_DIR, 'Original private directory required; no fixture fallback');

const root = fileURLToPath(new URL('../../../', import.meta.url));
const fixturePath = join(root, 'tests/fixtures/r67-private-emitter-process.mjs');
const originalDirectory = process.env.JENIOS_R67_PRIVATE_CORE_DIR;
const workDirectory = mkdtempSync(join(tmpdir(), 'jenios-r67-private-acceptance-'));
chmodSync(workDirectory, 0o700);
const artifactDirectory = process.env.ROBOT_QA_ARTIFACT_DIR || join(tmpdir(), 'jenios-r67-private-artifacts');
mkdirSync(artifactDirectory, { recursive: true });
const artifactPath = join(artifactDirectory, 'r67-private-source-acceptance.json');
const postgresEnv = { PATH: process.env.PATH || '/usr/bin:/bin', PGHOST: '127.0.0.1',
  PGHOSTADDR: '127.0.0.1', PGPORT: databaseUrl.port || '5432', PGUSER: 'postgres',
  PGPASSWORD: decodeURIComponent(databaseUrl.password), PGDATABASE: 'jenios_r67_private_qa',
  PGOPTIONS: '', PGSSLMODE: 'disable', PGCONNECT_TIMEOUT: '5' };
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8',
  env: { PATH: process.env.PATH || '/usr/bin:/bin' }, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const sourceCommitSha = git(['rev-parse', 'HEAD']); assert.match(sourceCommitSha, /^[a-f0-9]{40}$/);
const sourceTreeDirty = git(['status', '--porcelain', '--untracked-files=all']) !== '';
const sha = value => createHash('sha256').update(value).digest('hex');
const publicImplementationPaths = [
  'lib/platform/research/robot-r67-private-core-loader.mjs',
  'lib/platform/research/robot-r67-private-source.mjs',
  'lib/platform/research/robot-r67-private-protocol.mjs',
  'lib/platform/research/robot-r67-private-capture-outbox.mjs',
  'lib/platform/research/robot-private-durable-file.mjs',
  'lib/platform/research/robot-r67-durable-emitter.mjs',
  'lib/platform/research/robot-r67-loopback-transport.mjs',
  'lib/platform/research/robot-r67-database-store.mjs',
  'lib/platform/research/robot-r67-http.mjs',
  'lib/platform/research/robot-r67-access.mjs',
  'db/schema/robot-r67-private-capture-store.sql',
  'scripts/platform/research/r67-private-source-acceptance.mjs',
  'tests/fixtures/r67-private-emitter-process.mjs',
];
const publicImplementationDigests = Object.fromEntries(publicImplementationPaths.map(path => [path, sha(readFileSync(join(root, path)))]));
const children = new Set(), httpEvents = [], adminEvents = [];
const scopeId = 'scope:' + randomBytes(8).toString('hex'), sourceId = 'source:' + randomBytes(8).toString('hex');
const { privateKey } = generateKeyPairSync('ed25519');
const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' });
const integrityKey = randomBytes(32).toString('hex');
const op = n => 'op:' + n.toString(16).padStart(32, '0');
const scenarios = prefix => ['manual', 'hybrid', 'reverse'].map(mode => ({ id: prefix + '-' + mode,
  mode, intent: prefix === 'second' ? 'sell' : 'buy', horizon: prefix === 'second' ? 'swing' : 'day' }));
const commands = [1, 2].map((n, i) => ({ operationId: op(n), scenarios: scenarios(['first', 'second'][i]) }));
const adminPath = '/api/platform/admin/robot-private-observations';
const startedAt = new Date().toISOString();
let server, origin, trustedSource, coreMetadata, firstCapture, freshCapture, databaseSummary, finalQueue;
let commandSequence = 0, processCount = 0, responseLossEventId = null, responseLosses = 0;
let confirmedSigkills = 0, adminIdentityChecks = 0, originalLoaderProofCaptures = 0, failure = null;
const errorCode = error => /^(?:R67|B297)_[A-Z0-9_]+$/.test(error?.code || error?.message || '')
  ? error.code || error.message : 'R67_ACCEPTANCE_ASSERTION_FAILED';
const cases = [
  'original private executable bytes and LIVE_DISABLED guard are verified locally',
  'compiled bytes survive pathname replacement while a new load rejects replacements',
  'exclusive disposable database accepts reviewed R67 schema beside unchanged R64/R65',
  'two original three-mode batches are durable before any HTTP transmission',
  'native B297 actions and separate private provenance remain intact and signed',
  'first HTTP response is lost only after the database commits the original batch',
  'SIGKILL after the uncertain result occurs outside persistence critical sections',
  'new process restores pending records and starts a distinct source session',
  'retry after process death preserves complete records and both signatures',
  'a new original batch starts sequence one in the new session',
  'actual HTTP retry returns ALREADY_STORED and commits exactly three batches',
  'database retains exact signed records and first receipt without duplicate captures',
  'administrative HTTP GET displays original native actions under explicitly simulated identity',
  'anonymous invalid non-admin and caller-selected-scope administrative requests are denied',
  'R67 source scope is isolated and R64/R65 study policy and paid budget remain untouched',
  'acknowledgements survive another process restart without another send',
  'original synthetic execution remains distinct from operational monitoring and financial performance',
].map(name => ({ name, status: 'NOT_RUN' }));
async function check(index, action) {
  try { await action(); cases[index].status = 'PASS'; console.log('PASS ' + cases[index].name); }
  catch (error) { cases[index].status = 'FAIL'; cases[index].error = errorCode(error); throw error; }
}
const psql = sql => new Promise((resolve, reject) => {
  const child = spawn('psql', ['-X', '-w', '-q', '-v', 'ON_ERROR_STOP=1', '-At'],
    { env: postgresEnv, stdio: ['pipe', 'pipe', 'pipe'] });
  let stdout = '', stderr = '', timedOut = false;
  const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, 15000);
  child.stdout.on('data', bytes => { stdout += bytes; if (stdout.length > 2 * 1024 * 1024) child.kill('SIGKILL'); });
  child.stderr.on('data', bytes => { if (stderr.length < 8192) stderr += bytes; });
  child.on('error', () => { clearTimeout(timer); reject(Error('R67_POSTGRES_PROCESS_UNAVAILABLE')); });
  child.on('close', code => {
    clearTimeout(timer);
    if (code === 0 && !timedOut) resolve(stdout.trim());
    else reject(Error(stderr.match(/R67_[A-Z0-9_]+/)?.[0] || 'R67_POSTGRES_QUERY_FAILED'));
  });
  child.stdin.end(sql);
});
const encoded = value => "convert_from(decode('" + Buffer.from(JSON.stringify(value)).toString('base64') + "','base64'),'UTF8')::jsonb";
const rpcNames = new Set(Object.values(R67_DATABASE_RPCS));
const database = { async rpc(name, args) {
  assert.ok(rpcNames.has(name));
  try { return { data: JSON.parse(await psql('SET ROLE service_role; SELECT public.' + name + '(' + encoded(args.p_input) + ');')), error: null }; }
  catch (error) { return { data: null, error: { message: error.message } }; }
} };
const store = createR67DatabaseStore({ db: database, scopeId, sourceId });
const rows = async () => Number(await psql('SELECT count(*) FROM public.jenios_robot_private_captures_r67;'));
function directory(name) { const path = join(workDirectory, name); mkdirSync(path, { mode: 0o700 }); return path; }
const config = directory => ({ privateCoreDirectory: originalDirectory, directory, key: integrityKey,
  privateKeyPem, scopeId, sourceId });
function childProcess() {
  const child = spawn(process.execPath, ['--experimental-vm-modules', fixturePath], { cwd: root,
    env: { PATH: process.env.PATH || '/usr/bin:/bin', JENIOS_R67_PROCESS_FIXTURE: 'true',
      JENIOS_REAL_EXECUTION_ENABLED: 'false', JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED: 'false',
      JENIOS_PRIVATE_PAPER_EXECUTOR: 'false', JENIOS_ROBOT_ANALYST_PAID_ENABLED: 'false',
      NEXT_TELEMETRY_DISABLED: '1' }, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
  processCount++; children.add(child);
  const pending = new Map();
  child.stdout.on('data', () => {}); child.stderr.on('data', () => {});
  const closed = new Promise(resolve => child.once('close', (code, signal) => {
    children.delete(child);
    for (const { reject, timer } of pending.values()) { clearTimeout(timer); reject(Error('R67_ACCEPTANCE_CHILD_CLOSED')); }
    pending.clear(); resolve({ code, signal });
  }));
  child.on('message', message => {
    const waiter = pending.get(message?.id); if (!waiter) return;
    pending.delete(message.id); clearTimeout(waiter.timer);
    if (message.ok) waiter.resolve(message.result);
    else waiter.reject(Object.assign(Error(message.error), { code: message.error }));
  });
  child.on('error', () => {
    for (const { reject, timer } of pending.values()) { clearTimeout(timer); reject(Error('R67_ACCEPTANCE_CHILD_UNAVAILABLE')); }
    pending.clear();
  });
  const ask = (action, fields = {}) => new Promise((resolve, reject) => {
    const id = ++commandSequence;
    const timer = setTimeout(() => { pending.delete(id); child.kill('SIGKILL'); reject(Error('R67_ACCEPTANCE_CHILD_TIMEOUT')); }, 20000);
    pending.set(id, { resolve, reject, timer }); child.send({ id, action, ...fields });
  });
  return { ask, closed, kill: () => child.kill('SIGKILL'), async close() { await ask('close'); return closed; } };
}
const env = { VERCEL_ENV: 'preview', JENIOS_QA_CANDIDATE_ENABLED: 'true', JENIOS_ROBOT_QA_ENABLED: 'true',
  JENIOS_ROBOT_R67_ENABLED: 'true', JENIOS_ROBOT_ANALYST_PAID_ENABLED: 'false',
  JENIOS_REAL_EXECUTION_ENABLED: 'false', JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED: 'false',
  JENIOS_PRIVATE_PAPER_EXECUTOR: 'false' };
const simulatedIdentity = {
  auth: { async getUser(token) {
    adminIdentityChecks++;
    if (token === 'r67-admin-fixture') return { data: { user: { id: 'r67-local-admin-fixture',
      is_anonymous: false, app_metadata: { platform_role: 'admin' } } }, error: null };
    if (token === 'r67-nonadmin-fixture') return { data: { user: { id: 'r67-local-nonadmin-fixture',
      is_anonymous: false, app_metadata: {} } }, error: null };
    return { data: { user: null }, error: { message: 'EXPLICIT_QA_IDENTITY_FIXTURE' } };
  } },
  from() { return { select() { return { async eq() { return { data: [], error: null }; } }; } }; },
};
async function startHttp() {
  const ingest = createR67ObservationHandler({ getStore: () => store, getSource: () => trustedSource, env });
  const admin = createR67AdminHandler({ getDb: () => simulatedIdentity,
    getRuntime: () => ({ store, scopeId, sourceId }), env });
  server = createServer(async (request, response) => {
    try {
      if (request.socket.remoteAddress !== '127.0.0.1') { response.writeHead(403); response.end(); return; }
      const pathname = new URL(request.url, origin).pathname;
      if (pathname === adminPath) {
        const result = await admin(new Request(origin + request.url, { method: request.method,
          headers: { authorization: request.headers.authorization || '' } }));
        adminEvents.push({ method: request.method, queryPresent: request.url.includes('?'), httpStatus: result.status });
        response.writeHead(result.status, Object.fromEntries(result.headers)); response.end(await result.text()); return;
      }
      if (request.url !== R67_OBSERVATION_PATH || request.method !== 'POST') {
        response.writeHead(404); response.end(); return;
      }
      let size = 0; const chunks = [];
      for await (const chunk of request) {
        size += chunk.length; if (size > R67_LIMITS.maxBytes) { request.destroy(); return; } chunks.push(chunk);
      }
      const body = Buffer.concat(chunks).toString('utf8'), record = JSON.parse(body);
      const result = await ingest(new Request(origin + request.url, { method: 'POST',
        headers: { 'content-type': request.headers['content-type'] || '' }, body }));
      const responseBody = await result.text(), parsed = JSON.parse(responseBody);
      httpEvents.push({ eventId: record.envelope?.payload?.eventId, bodySha256: sha(body),
        capturedAtMs: record.envelope?.payload?.capturedAtMs, expiresAtMs: record.envelope?.payload?.expiresAtMs,
        httpStatus: result.status, intakeStatus: parsed.status || null });
      if (record.envelope?.payload?.eventId === responseLossEventId && responseLosses === 0 && result.status === 202) {
        responseLosses++; request.socket.destroy(); return;
      }
      response.writeHead(result.status, Object.fromEntries(result.headers)); response.end(responseBody);
    } catch { if (!response.destroyed) { response.writeHead(500); response.end(); } }
  });
  server.requestTimeout = 5000; server.headersTimeout = 5000;
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  origin = 'http://127.0.0.1:' + server.address().port;
}
const adminRequest = (token, suffix = '') => fetch(origin + adminPath + suffix,
  { headers: token ? { authorization: 'Bearer ' + token } : {}, redirect: 'error', signal: AbortSignal.timeout(5000) });

try {
  let handle, proof;
  await check(0, async () => {
    handle = await loadR67VerifiedPrivateCore({ directory: originalDirectory });
    coreMetadata = inspectR67VerifiedPrivateCore(handle);
    assert.equal(coreMetadata.localExecutableBytesVerified, true);
    assert.equal(coreMetadata.liveExecutionGuardVerified, true);
    assert.equal(coreMetadata.runtimeOrigin, R67_ORIGIN);
    assert.equal(coreMetadata.independentRuntimeAttestation, false);
    assert.equal(coreMetadata.ultrafastProvided, false);
    assert.deepEqual(coreMetadata.commercialModes, ['manual', 'hybrid', 'reverse']);
    assert.ok(Object.isFrozen(coreMetadata)); assert.ok(Object.isFrozen(coreMetadata.commercialModes));
    proof = await captureR67VerifiedPrivateBatch(handle, { scenarios: scenarios('loader-proof'), nowMs: Date.now() });
    originalLoaderProofCaptures += proof.entries.length;
    assert.equal(verifyB297CaptureChain(proof).valid, true);
  });
  await check(1, async () => {
    const copy = directory('pinned-byte-proof');
    for (const name of ['engine.mjs', 'service.mjs']) {
      copyFileSync(join(originalDirectory, name), join(copy, name)); chmodSync(join(copy, name), 0o600);
    }
    const pinned = await loadR67VerifiedPrivateCore({ directory: copy });
    for (const name of ['engine.mjs', 'service.mjs']) writeFileSync(join(copy, name), 'throw new Error("REPLACED_SOURCE_MUST_NOT_EXECUTE");\n');
    const captured = await captureR67VerifiedPrivateBatch(pinned,
      { scenarios: scenarios('loader-proof'), nowMs: proof.entries[0].observedAtMs });
    originalLoaderProofCaptures += captured.entries.length;
    assert.deepEqual(captured, proof);
    await assert.rejects(() => loadR67VerifiedPrivateCore({ directory: copy }), { code: 'R67_CORE_HASH_MISMATCH' });
    rmSync(copy, { recursive: true, force: true });
  });
  await check(2, async () => {
    assert.equal(await psql('SELECT current_database();'), 'jenios_r67_private_qa');
    assert.equal(await psql("SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'jenios_robot_%';"), '0');
    assert.equal(sha(readFileSync(join(root, 'db/schema/robot-r64-operational-store.sql'))),
      '5a377a85f86ec3f7044409050eeb35e2ae0a67e7d1050b6b8bf35c13731e4d3c');
    assert.equal(sha(readFileSync(join(root, 'db/schema/robot-r65-lifecycle-store.sql'))),
      '0c9234f8b6f7d8d23725971663be82b4c69592224027760d895c505074d54887');
    await psql("DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF;" +
      "IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF;" +
      "IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role BYPASSRLS; END IF; END $$;" +
      'GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role;');
    for (const path of ['db/schema/robot-r64-operational-store.sql', 'db/schema/robot-r65-lifecycle-store.sql',
      'db/schema/robot-r67-private-capture-store.sql']) await psql(readFileSync(join(root, path), 'utf8'));
    assert.equal(await rows(), 0); assert.deepEqual(await store.read(), []);
  });
  await startHttp();
  const outboxDirectory = directory('durable-private-batches'), a = childProcess();
  const first = await a.ask('open', { config: config(outboxDirectory) }); trustedSource = first.trustedSource;
  assert.deepEqual(first.core, coreMetadata);
  await check(3, async () => {
    firstCapture = await a.ask('capture', { commands });
    assert.equal(firstCapture.records.length, 2);
    assert.equal(firstCapture.inspect.queue.pending, 2); assert.equal(firstCapture.inspect.nextSequence, 3);
    assert.equal(firstCapture.sendCalls, 0); assert.equal(httpEvents.length, 0); assert.equal(await rows(), 0);
    assert.ok(readFileSync(join(outboxDirectory, 'r67-private-capture-outbox.json')).length > 0);
    assert.ok(firstCapture.records.every(r => r.envelope.payload.capture.entries.length === 3));
  });
  await check(4, async () => {
    for (const record of firstCapture.records) {
      verifyR67PrivateObservationRecord(record, { trustedSource, nowMs: Date.now() });
      const capture = record.envelope.payload.capture;
      assert.equal(capture.executableBytesVerifiedByAdapter, false);
      assert.equal(capture.originalCallbackIdentityAttested, false);
      assert.deepEqual(capture.counts, { manual: 1, hybrid: 1, reverse: 1 });
      assert.ok(capture.entries.every(entry => entry.originalVersion === R67_BINDING.originalVersion));
      assert.ok(capture.entries.every(entry => !['ALLOW', 'BLOCK', 'KEEP', 'ADVISE'].includes(entry.action)));
      assert.equal(record.provenance.origin, R67_ORIGIN); assert.equal(record.provenance.localExecutableBytesVerified, true);
      assert.equal(record.provenance.policyVersion, 'private:r67-v1'); assert.equal(record.provenance.generation, 0);
    }
  });
  let firstReceipt;
  await check(5, async () => {
    responseLossEventId = firstCapture.records[0].envelope.payload.eventId;
    const lost = await a.ask('flush', { origin, limit: 1 });
    assert.equal(lost.flushed.attempted, 1); assert.equal(lost.flushed.unconfirmed, 1);
    assert.equal(lost.flushed.stoppedReason, 'SEND_UNCONFIRMED'); assert.equal(lost.inspect.queue.unconfirmed, 1);
    assert.equal(await rows(), 1); assert.equal(responseLosses, 1);
    firstReceipt = (await store.read())[0].receipt;
    assert.equal(firstReceipt.eventId, responseLossEventId);
  });
  await check(6, async () => {
    a.kill(); assert.equal((await a.closed).signal, 'SIGKILL'); confirmedSigkills++;
    assert.equal(await rows(), 1);
  });
  const b = childProcess(); let second;
  await check(7, async () => {
    second = await b.ask('open', { config: config(outboxDirectory) });
    assert.notEqual(second.sessionId, first.sessionId); assert.deepEqual(second.core, coreMetadata);
    assert.equal(second.inspect.queue.unconfirmed, 1); assert.equal(second.inspect.queue.pending, 1);
    assert.equal(second.inspect.nextSequence, 1); assert.equal(second.inspect.runtimeRestored, false);
  });
  await check(8, async () => {
    const retry = await b.ask('capture', { commands });
    assert.deepEqual(retry.records, firstCapture.records); assert.equal(retry.inspect.nextSequence, 1);
    assert.equal(retry.sendCalls, 0);
  });
  await check(9, async () => {
    freshCapture = await b.ask('capture', { commands: [{ operationId: op(3), scenarios: scenarios('after-restart') }] });
    assert.equal(freshCapture.records.length, 1); assert.equal(freshCapture.records[0].envelope.payload.sequence, 1);
    assert.equal(freshCapture.records[0].envelope.payload.sessionId, second.sessionId);
    assert.equal(freshCapture.inspect.nextSequence, 2);
    assert.deepEqual(freshCapture.records[0].envelope.payload.capture.counts, { manual: 1, hybrid: 1, reverse: 1 });
  });
  await check(10, async () => {
    const delivered = await b.ask('flush', { origin, limit: 20 });
    assert.equal(delivered.flushed.attempted, 3); assert.equal(delivered.flushed.acknowledged, 3);
    assert.equal(delivered.inspect.queue.acknowledged, 3); assert.equal(delivered.inspect.queue.unconfirmed, 0);
    assert.equal(delivered.inspect.queue.pending, 0); assert.equal(await rows(), 3);
    assert.equal(httpEvents.length, 4); assert.equal(httpEvents[1].intakeStatus, 'ALREADY_STORED');
    assert.equal(httpEvents[1].httpStatus, 200);
    const repeated = httpEvents.filter(event => event.eventId === responseLossEventId);
    assert.equal(repeated.length, 2); assert.equal(repeated[0].bodySha256, repeated[1].bodySha256);
    assert.equal(repeated[0].capturedAtMs, repeated[1].capturedAtMs);
    assert.equal(repeated[0].expiresAtMs, repeated[1].expiresAtMs);
  });
  await check(11, async () => {
    const stored = await store.read(); assert.equal(stored.length, 3);
    const originals = [...firstCapture.records, ...freshCapture.records];
    for (const row of stored) {
      const expected = originals.find(record => record.envelope.payload.eventId === row.receipt.eventId);
      assert.deepEqual(row.record, expected); assert.equal(row.receipt.recordDigest, r67RecordDigest(expected));
      assert.equal(row.receipt.captureCount, 3);
    }
    assert.deepEqual(stored.find(row => row.receipt.eventId === responseLossEventId).receipt, firstReceipt);
    databaseSummary = JSON.parse(await psql("SELECT jsonb_build_object('batches',count(*),'sessions',count(DISTINCT session_id),'captures',sum((receipt->>'captureCount')::integer)) FROM public.jenios_robot_private_captures_r67;"));
    assert.deepEqual(databaseSummary, { batches: 3, sessions: 2, captures: 9 });
  });
  await check(12, async () => {
    const response = await adminRequest('r67-admin-fixture'); assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const body = await response.json(); assert.equal(body.adminOnly, true);
    assert.equal(body.scopeId, scopeId); assert.equal(body.sourceId, sourceId);
    assert.equal(body.returnedBatches, 3); assert.equal(body.returnedCaptures, 9);
    assert.equal(body.runtimeOrigin, R67_ORIGIN); assert.equal(body.currentPrivateHostIndependentlyObserved, false);
    for (const row of body.observations) {
      const expected = [...firstCapture.records, ...freshCapture.records].find(r => r.envelope.payload.eventId === row.eventId);
      assert.deepEqual(row.originalActions, expected.envelope.payload.capture.entries.map(entry => ({ robot: entry.commercialMode,
        action: entry.action, suggestedSide: entry.suggestedSide, originalVersion: entry.originalVersion })));
      assert.equal(Object.hasOwn(row, 'signatureBase64'), false); assert.equal(Object.hasOwn(row, 'signed_record'), false);
    }
  });
  await check(13, async () => {
    for (const [token, suffix, status] of [[null, '', 401], ['r67-invalid-fixture', '', 401],
      ['r67-nonadmin-fixture', '', 403], ['r67-admin-fixture', '?scopeId=scope:0000000000000000', 400]]) {
      const response = await adminRequest(token, suffix); assert.equal(response.status, status);
      const body = await response.json(); assert.equal(Object.hasOwn(body, 'observations'), false);
    }
  });
  await check(14, async () => {
    const otherScope = createR67DatabaseStore({ db: database, scopeId: 'scope:' + randomBytes(8).toString('hex'), sourceId });
    const otherSource = createR67DatabaseStore({ db: database, scopeId, sourceId: 'source:' + randomBytes(8).toString('hex') });
    assert.deepEqual(await otherScope.read(), []); assert.deepEqual(await otherSource.read(), []);
    for (const table of ['jenios_robot_events_r64', 'jenios_robot_cycles_r64',
      'jenios_robot_observation_provenance_r65', 'jenios_robot_evolution_r65'])
      assert.equal(await psql('SELECT count(*) FROM public.' + table + ';'), '0');
    assert.equal(await psql('SELECT generation_enabled FROM public.jenios_robot_config_r64;'), 'f');
  });
  await b.close();
  await check(15, async () => {
    const c = childProcess(), reopened = await c.ask('open', { config: config(outboxDirectory) });
    assert.notEqual(reopened.sessionId, second.sessionId); assert.equal(reopened.inspect.nextSequence, 1);
    assert.equal(reopened.inspect.queue.acknowledged, 3);
    const before = httpEvents.length, noSend = await c.ask('flush', { origin });
    assert.equal(noSend.flushed.attempted, 0); assert.equal(noSend.sendCalls, 0); assert.equal(httpEvents.length, before);
    finalQueue = noSend.inspect.queue; await c.close();
  });
  await check(16, async () => {
    for (const record of [...firstCapture.records, ...freshCapture.records]) {
      for (const [key, value] of Object.entries(R67_INVARIANTS)) assert.equal(record.provenance[key], value);
      assert.equal(record.envelope.payload.capture.source, 'SYNTHETIC_PRIVATE_LAB_ONLY');
      assert.equal(record.envelope.payload.evidenceKind, R67_EVIDENCE);
      assert.equal(record.provenance.independentRuntimeAttestation, false);
      assert.equal(record.provenance.privateOperationalSourceActive, false);
    }
    assert.equal(databaseSummary.captures, 9); assert.equal(originalLoaderProofCaptures, 6);
  });
} catch (error) {
  failure = errorCode(error); console.error(failure);
} finally {
  for (const child of children) child.kill('SIGKILL');
  if (server) { server.closeAllConnections?.(); await new Promise(resolve => server.close(resolve)); }
  const report = { schema: 'JENIOS_ROBOT_R67_PRIVATE_SOURCE_ACCEPTANCE_V1', startedAt, finishedAt: new Date().toISOString(),
    sourceCommitSha, sourceTreeDirty, publicImplementationDigests,
    classification: 'ORIGINAL_PRIVATE_BYTES_LOCAL_VM_REAL_PROCESS_HTTP_POSTGRES_SYNTHETIC_QA',
    publicCiEvidence: false, privateExecutableBytesIncludedInPublicArtifact: false,
    scope: { runtimeOrigin: R67_ORIGIN, evidenceKind: R67_EVIDENCE, runtimeEvidenceKind: 'SYNTHETIC_PRIVATE_LAB_ONLY',
      sourceInputs: 'CONTROLLED_SYNTHETIC_SCENARIOS', commercialModes: ['manual', 'hybrid', 'reverse'],
      ultraFastProvidedByPrivateCore: false, loader: 'VM_SOURCE_TEXT_MODULE_PINNED_BYTES',
      database: 'REAL_DISPOSABLE_POSTGRESQL', databaseName: 'jenios_r67_private_qa', databaseHost: '127.0.0.1',
      databasePort: Number(databaseUrl.port || '5432'), databaseRpcTransport: 'LOCAL_PSQL_ADAPTER_NOT_HOSTED_POSTGREST',
      transport: 'ACTUAL_LOOPBACK_HTTP', sourceClock: 'REAL_WALL_CLOCK', handler: 'createR67ObservationHandler',
      adminHandler: 'createR67AdminHandler', administrationIdentity: 'EXPLICIT_QA_SIMULATION_NOT_REAL_AUTH',
      browserTested: false, nextServerTested: false, hostedSupabaseTested: false, privateOperationalSourceActive: false },
    core: coreMetadata ?? null,
    execution: { node: process.version, emitterProcesses: processCount,
      deliberateSigkillsAfterUnconfirmedCommit: confirmedSigkills, responsesLostAfterDatabaseCommit: responseLosses,
      intakeHttpRequests: httpEvents.length, adminHttpRequests: adminEvents.length,
      simulatedIdentityChecks: adminIdentityChecks, separateLoaderProofDecisions: originalLoaderProofCaptures,
      databaseSummary: databaseSummary ?? null, finalQueue: finalQueue ?? null,
      signedRecordDigests: [...(firstCapture?.records ?? []), ...(freshCapture?.records ?? [])].map(r67RecordDigest),
      httpEvents, adminEvents },
    total: cases.length, passed: cases.filter(c => c.status === 'PASS').length,
    failed: cases.filter(c => c.status === 'FAIL').length, notRun: cases.filter(c => c.status === 'NOT_RUN').length,
    status: failure ? 'FAIL' : 'PASS', error: failure, cases,
    invariants: { ...R67_INVARIANTS, hostedDatabaseMigrationsApplied: 0,
      productionConfigurationChanged: false, mergePerformed: false, deployPerformed: false },
    limitations: ['This local run executes the retained original private bytes using controlled synthetic inputs.',
      'Original source is not public. Public CI contract fixtures cannot independently repeat or attest this positive run.',
      'The VM uses known hash-pinned modules and is not claimed as a sandbox for arbitrary hostile code.',
      'The local byte proof is not independent attestation of another host, a customer feed or a broker.',
      'Administrative identity is deliberately simulated; hosted Auth and administrative access are not certified.',
      'Process death follows completed persistence and a lost response; power loss and distributed recovery are not certified.',
      'The private policy binding is generation zero and does not apply the R65 UltraFast policy.',
      'No operational customer monitoring, paid provider, financial performance, order or production activation is certified.'] };
  const json = JSON.stringify(report, null, 2) + '\n';
  for (const secret of [privateKeyPem, integrityKey, originalDirectory, workDirectory]) assert.equal(json.includes(secret), false);
  writeFileSync(artifactPath, json); rmSync(workDirectory, { recursive: true, force: true });
  console.log(JSON.stringify({ report: artifactPath, total: report.total, passed: report.passed,
    failed: report.failed, notRun: report.notRun, status: report.status, sourceCommitSha, sourceTreeDirty }));
  if (failure) process.exitCode = 1;
}
