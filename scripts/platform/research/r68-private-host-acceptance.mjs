/** R68 original-private LOCAL host acceptance. Public CI never substitutes
 * fixture callbacks for these executable bytes. Real CLI, signals, loopback
 * HTTP and an exclusive disposable PostgreSQL database are exercised.
 */
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { createHash, generateKeyPairSync, randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { chmodSync, closeSync, fsyncSync, mkdirSync, mkdtempSync, openSync,
  readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createR67DatabaseStore, R67_DATABASE_RPCS } from '../../../lib/platform/research/robot-r67-database-store.mjs';
import { createR67ObservationHandler } from '../../../lib/platform/research/robot-r67-http.mjs';
import { createR67PrivateCaptureOutbox, R67_OUTBOX_FILE, R67_OUTBOX_LOCK, R67_DELIVERY_LOCK } from '../../../lib/platform/research/robot-r67-private-capture-outbox.mjs';
import { R67_OBSERVATION_PATH } from '../../../lib/platform/research/robot-r67-loopback-transport.mjs';
import { R67_ORIGIN, R67_EVIDENCE, R67_INVARIANTS, canonicalR67Json,
  r67RecordDigest } from '../../../lib/platform/research/robot-r67-private-protocol.mjs';
import { R68_HOST_LOCK } from '../../../lib/platform/research/robot-r68-private-files.mjs';
import { runR68PrivateHost } from '../../../lib/platform/research/robot-r68-private-host.mjs';

assert.equal(process.env.JENIOS_R68_DISPOSABLE_DB, 'true', 'Explicit disposable R68 database flag required');
const databaseUrl = new URL(process.env.JENIOS_R68_TEST_DATABASE_URL || 'invalid:');
assert.ok(['postgres:', 'postgresql:'].includes(databaseUrl.protocol));
assert.equal(databaseUrl.hostname, '127.0.0.1'); assert.equal(databaseUrl.pathname, '/jenios_r68_private_qa');
assert.equal(databaseUrl.search, ''); assert.equal(databaseUrl.hash, '');
assert.equal(decodeURIComponent(databaseUrl.username), 'postgres');
assert.ok(['', 'r68-test-only'].includes(decodeURIComponent(databaseUrl.password)));
assert.ok(['5432', '56468'].includes(databaseUrl.port || '5432'));
assert.ok(process.env.JENIOS_R68_PRIVATE_CORE_DIR, 'Original private modules required; no fixture fallback');
for (const name of ['JENIOS_REAL_EXECUTION_ENABLED', 'JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED',
  'JENIOS_PRIVATE_PAPER_EXECUTOR', 'JENIOS_ROBOT_ANALYST_PAID_ENABLED']) assert.notEqual(process.env[name], 'true');
assert.notEqual(process.env.VERCEL_ENV, 'production');

const root = fileURLToPath(new URL('../../../', import.meta.url));
const cli = join(root, 'scripts/platform/research/r68-private-host.mjs');
const originalDirectory = process.env.JENIOS_R68_PRIVATE_CORE_DIR;
const privateDirectory = mkdtempSync(join(tmpdir(), 'jenios-r68-host-acceptance-')); chmodSync(privateDirectory, 0o700);
const artifactDirectory = process.env.ROBOT_QA_ARTIFACT_DIR || join(tmpdir(), 'jenios-r68-private-host-artifacts');
mkdirSync(artifactDirectory, { recursive: true });
const artifactPath = join(artifactDirectory, 'r68-private-host-acceptance.json');
const sha = value => createHash('sha256').update(value).digest('hex');
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8',
  env: { PATH: process.env.PATH || '/usr/bin:/bin' }, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const sourceCommitSha = git(['rev-parse', 'HEAD']), sourceTreeDirty = git(['status', '--porcelain', '--untracked-files=all']) !== '';
assert.match(sourceCommitSha, /^[a-f0-9]{40}$/);
const implementationFiles = [
  'lib/platform/research/robot-r68-private-host.mjs', 'lib/platform/research/robot-r68-private-files.mjs',
  'lib/platform/research/robot-r68-outbox-doctor.mjs', 'lib/platform/research/robot-private-durable-file.mjs',
  'lib/platform/research/robot-r67-private-core-loader.mjs', 'lib/platform/research/robot-r67-private-source.mjs',
  'lib/platform/research/robot-r67-private-protocol.mjs', 'lib/platform/research/robot-r67-private-capture-outbox.mjs',
  'lib/platform/research/robot-r67-durable-emitter.mjs', 'lib/platform/research/robot-r67-loopback-transport.mjs',
  'lib/platform/research/robot-r67-database-store.mjs', 'lib/platform/research/robot-r67-http.mjs',
  'lib/platform/research/robot-r67-access.mjs', 'db/schema/robot-r67-private-capture-store.sql',
  'scripts/platform/research/r68-private-host.mjs', 'scripts/platform/research/r68-private-host-acceptance.mjs',
];
const publicImplementationDigests = Object.fromEntries(implementationFiles.map(path => [path, sha(readFileSync(join(root, path)))]));
const qa = { VERCEL_ENV: 'preview', JENIOS_QA_CANDIDATE_ENABLED: 'true', JENIOS_ROBOT_QA_ENABLED: 'true',
  JENIOS_ROBOT_R67_ENABLED: 'true', JENIOS_ROBOT_R68_HOST_ENABLED: 'true',
  JENIOS_ROBOT_ANALYST_PAID_ENABLED: 'false', JENIOS_REAL_EXECUTION_ENABLED: 'false',
  JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED: 'false', JENIOS_PRIVATE_PAPER_EXECUTOR: 'false' };
const postgresEnv = { PATH: process.env.PATH || '/usr/bin:/bin', PGHOST: '127.0.0.1', PGHOSTADDR: '127.0.0.1',
  PGPORT: databaseUrl.port || '5432', PGUSER: 'postgres', PGPASSWORD: decodeURIComponent(databaseUrl.password),
  PGDATABASE: 'jenios_r68_private_qa', PGOPTIONS: '', PGSSLMODE: 'disable', PGCONNECT_TIMEOUT: '5' };
const scopeId = 'scope:' + randomBytes(8).toString('hex'), sourceId = 'source:' + randomBytes(8).toString('hex');
const pair = generateKeyPairSync('ed25519'), privateKeyPem = pair.privateKey.export({ type: 'pkcs8', format: 'pem' });
const integrityKey = randomBytes(32).toString('hex'), sourceKeySha256 = sha(pair.publicKey.export({ type: 'spki', format: 'der' }));
const trustedSource = { scopeId, sourceId, enabled: true, evidenceKind: R67_EVIDENCE,
  publicKeyPem: pair.publicKey.export({ type: 'spki', format: 'pem' }) };
const signingPath = join(privateDirectory, 'signing.pem'), hmacPath = join(privateDirectory, 'integrity.txt');
writeFileSync(signingPath, privateKeyPem, { mode: 0o600 }); writeFileSync(hmacPath, integrityKey + '\n', { mode: 0o600 });
const op = n => 'op:' + n.toString(16).padStart(32, '0');
const command = n => ({ operationId: op(n), scenarios: ['manual', 'hybrid', 'reverse'].map(mode => ({
  id: 'host-' + n + '-' + mode, mode, intent: n === 2 ? 'sell' : 'buy', horizon: n === 2 ? 'swing' : 'day' })) });
const children = new Set(), outputs = [], httpEvents = [];
let server, origin, processCount = 0, responseLosses = 0, injectedUnavailable = 0, confirmedSigkills = 0;
let holdNextReplay = false, heldRelease = null, holdObservedResolve, holdObserved;
let main, expiry, firstRecords, expiredRecord, databaseSummary, originalCoreMetadata;
let firstPostPersistedBatches = null, pendingAfterStop = null, finalDoctor = null, expirationDoctor = null;
let expiryWaitMs = 0, failure = null;
const startedAt = new Date().toISOString();
const codeOf = error => /^(?:R6[78]|B297)_[A-Z0-9_]+$/.test(error?.code || error?.message || '')
  ? error.code || error.message : 'R68_ACCEPTANCE_ASSERTION_FAILED';
const cases = [
  'protected custody and actual CLI checks verify original hashes without session or network effects',
  'original private batch remains durable after an explicitly unavailable local receiver',
  'one watch host excludes another and reads two original commands from an atomic replacement',
  'lost HTTP acknowledgement follows database commit and SIGTERM preserves the uncertain backlog',
  'SIGTERM during an in-flight successful acknowledgement prevents a second delivery from starting',
  'new CLI process reuses exact records and admits three original batches without duplicates',
  'repeated post-delivery CLI checks leave sessions attempts and snapshot bytes unchanged',
  'changed custody credentials fail closed without resetting the retained queue',
  'actual SIGKILL leaves an orphan host lock that inspection retains and another runner refuses',
  'real wall-clock expiration is observed by CLI without rewriting or transmitting the retained batch',
  'observed lease loss or a disabled QA gate prevents later capture and delivery',
  'all host outputs are sanitized and original synthetic evidence remains operationally inactive',
].map(name => ({ name, status: 'NOT_RUN' }));
async function check(index, action) {
  try { await action(); cases[index].status = 'PASS'; console.log('PASS ' + cases[index].name); }
  catch (error) { cases[index].status = 'FAIL'; cases[index].error = codeOf(error); throw error; }
}
const psql = sql => new Promise((resolve, reject) => {
  const child = spawn('psql', ['-X', '-w', '-q', '-v', 'ON_ERROR_STOP=1', '-At'], { env: postgresEnv, stdio: ['pipe', 'pipe', 'pipe'] });
  let out = '', error = '', timedOut = false;
  const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, 15000);
  child.stdout.on('data', bytes => { out += bytes; if (out.length > 2 * 1024 * 1024) child.kill('SIGKILL'); });
  child.stderr.on('data', bytes => { if (error.length < 8192) error += bytes; });
  child.on('error', () => { clearTimeout(timer); reject(Error('R68_POSTGRES_UNAVAILABLE')); });
  child.on('close', code => { clearTimeout(timer);
    if (!timedOut && code === 0) resolve(out.trim());
    else reject(Error(error.match(/R67_[A-Z0-9_]+/)?.[0] || 'R68_POSTGRES_QUERY_FAILED'));
  }); child.stdin.end(sql);
});
const encoded = value => "convert_from(decode('" + Buffer.from(JSON.stringify(value)).toString('base64') + "','base64'),'UTF8')::jsonb";
const allowedRpcs = new Set(Object.values(R67_DATABASE_RPCS));
const database = { async rpc(name, args) {
  assert.ok(allowedRpcs.has(name));
  try { return { data: JSON.parse(await psql('SET ROLE service_role; SELECT public.' + name + '(' + encoded(args.p_input) + ');')), error: null }; }
  catch (error) { return { data: null, error: { message: error.message } }; }
} };
const store = createR67DatabaseStore({ db: database, scopeId, sourceId });
const rows = async () => Number(await psql('SELECT count(*) FROM public.jenios_robot_private_captures_r67;'));
function atomicCommands(path, commands) {
  const temporary = path + '.next';
  const fd = openSync(temporary, 'wx', 0o600);
  try { writeFileSync(fd, JSON.stringify({ schema: 'JENIOS_R68_PRIVATE_HOST_COMMANDS_V1', commands })); fsyncSync(fd); }
  finally { closeSync(fd); }
  renameSync(temporary, path); const directoryFd = openSync(privateDirectory, 'r');
  try { fsyncSync(directoryFd); } finally { closeSync(directoryFd); }
}
function configuration(name, commands) {
  const outboxDirectory = join(privateDirectory, name); mkdirSync(outboxDirectory, { mode: 0o700 });
  const commandsFile = join(privateDirectory, name + '-commands.json'); atomicCommands(commandsFile, commands);
  const config = { schema: 'JENIOS_R68_PRIVATE_HOST_CONFIG_V1', coreDirectory: originalDirectory,
    outboxDirectory, privateKeyFile: signingPath, hmacKeyFile: hmacPath, commandsFile,
    scopeId, sourceId, sourceKeySha256, origin };
  const configPath = join(privateDirectory, name + '-host.json');
  writeFileSync(configPath, JSON.stringify(config), { mode: 0o600 });
  const outbox = createR67PrivateCaptureOutbox({ directory: outboxDirectory, key: integrityKey, trustedSource });
  return { config, configPath, outbox, snapshotPath: join(outboxDirectory, R67_OUTBOX_FILE) };
}
function launch(mode, configPath) {
  const child = spawn(process.execPath, ['--experimental-vm-modules', cli, mode, '--config', configPath],
    { cwd: root, env: { PATH: process.env.PATH || '/usr/bin:/bin', ...qa, NEXT_TELEMETRY_DISABLED: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
  processCount++; children.add(child);
  const reports = [], waiters = new Set(); let stdout = '', stderr = '', buffer = '', ended = false;
  function settle() {
    for (const waiter of waiters) {
      const found = reports.find(waiter.predicate);
      if (found) { clearTimeout(waiter.timer); waiters.delete(waiter); waiter.resolve(found); }
      else if (ended) { clearTimeout(waiter.timer); waiters.delete(waiter); waiter.reject(Error('R68_ACCEPTANCE_HOST_CLOSED')); }
    }
  }
  child.stdout.on('data', bytes => {
    stdout += bytes; buffer += bytes;
    if (stdout.length > 2 * 1024 * 1024) { child.kill('SIGKILL'); return; }
    for (;;) {
      const next = buffer.indexOf('\n'); if (next < 0) break;
      const line = buffer.slice(0, next); buffer = buffer.slice(next + 1);
      try { reports.push(JSON.parse(line)); } catch { child.kill('SIGKILL'); }
    } settle();
  });
  child.stderr.on('data', bytes => { stderr += bytes; if (stderr.length > 32768) child.kill('SIGKILL'); });
  const closed = new Promise((resolve, reject) => {
    child.on('error', () => reject(Error('R68_ACCEPTANCE_HOST_UNAVAILABLE')));
    child.on('close', (code, signal) => {
      children.delete(child); ended = true; settle(); outputs.push(stdout + stderr);
      resolve({ code, signal, reports, stdout, stderr });
    });
  });
  return { child, reports, closed,
    waitFor(predicate, timeoutMs = 15000) {
      const existing = reports.find(predicate); if (existing) return Promise.resolve(existing);
      return new Promise((resolve, reject) => {
        const waiter = { predicate, resolve, reject, timer: setTimeout(() => {
          waiters.delete(waiter); child.kill('SIGKILL'); reject(Error('R68_ACCEPTANCE_HOST_TIMEOUT'));
        }, timeoutMs) }; waiters.add(waiter); settle();
      });
    } };
}
async function once(mode, configPath) {
  const running = launch(mode, configPath);
  const timer = setTimeout(() => running.child.kill('SIGKILL'), 20000);
  try { return await running.closed; } finally { clearTimeout(timer); }
}
const resultOf = run => run.reports.findLast(r => r.schema === 'JENIOS_R68_PRIVATE_HOST_RESULT_V1');
const inspectionOf = run => run.reports.findLast(r => r.schema === 'JENIOS_R68_PRIVATE_HOST_INSPECTION_V1');
async function startHttp() {
  const handler = createR67ObservationHandler({ getStore: () => store, getSource: () => trustedSource, env: qa });
  server = createServer(async (request, response) => {
    try {
      if (request.socket.remoteAddress !== '127.0.0.1' || request.method !== 'POST' || request.url !== R67_OBSERVATION_PATH) {
        response.writeHead(404); response.end(); return;
      }
      let length = 0; const chunks = [];
      for await (const chunk of request) { length += chunk.length; if (length > 262144) { request.destroy(); return; } chunks.push(chunk); }
      const body = Buffer.concat(chunks).toString('utf8'), record = JSON.parse(body);
      if (record.provenance.operationId === op(4)) {
        injectedUnavailable++; httpEvents.push({ eventId: record.envelope.payload.eventId, operationId: op(4),
          bodySha256: sha(body), httpStatus: 503, intakeStatus: null, injection: 'RECEIVER_UNAVAILABLE_BEFORE_ADMISSION' });
        response.writeHead(503, { 'content-type': 'application/json' }); response.end('{}'); return;
      }
      if (record.provenance.operationId === op(1) && firstPostPersistedBatches === null)
        firstPostPersistedBatches = main.outbox.read().entries.length;
      const result = await handler(new Request(origin + request.url, { method: 'POST',
        headers: { 'content-type': request.headers['content-type'] || '' }, body }));
      const resultBody = await result.text(), parsed = JSON.parse(resultBody);
      httpEvents.push({ eventId: record.envelope.payload.eventId, operationId: record.provenance.operationId,
        bodySha256: sha(body), httpStatus: result.status, intakeStatus: parsed.status ?? null });
      if (record.provenance.operationId === op(1) && result.status === 202 && responseLosses === 0) {
        responseLosses++; request.socket.destroy(); return;
      }
      if (record.provenance.operationId === op(1) && parsed.status === 'ALREADY_STORED' && holdNextReplay) {
        holdNextReplay = false; holdObservedResolve();
        await new Promise(resolve => { heldRelease = resolve; });
      }
      response.writeHead(result.status, Object.fromEntries(result.headers)); response.end(resultBody);
    } catch { if (!response.destroyed) { response.writeHead(500); response.end(); } }
  });
  server.requestTimeout = 5000; server.headersTimeout = 5000;
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  origin = 'http://127.0.0.1:' + server.address().port;
}
try {
  await check(0, async () => {
    assert.equal(await psql('SELECT current_database();'), 'jenios_r68_private_qa');
    assert.equal(await psql("SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'jenios_robot_%';"), '0');
    const sql = readFileSync(join(root, 'db/schema/robot-r67-private-capture-store.sql'));
    assert.equal(sha(sql), '5172c89d6f94cbfa50ae789fd2df09e9843c63a81d663a798971833ae7dec58b');
    await psql("DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF;" +
      "IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF;" +
      "IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role BYPASSRLS; END IF; END $$;" +
      'GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role;');
    await psql(sql.toString('utf8')); await startHttp(); main = configuration('main', []);
    for (let n = 0; n < 2; n++) {
      const run = await once('--check', main.configPath), checked = inspectionOf(run);
      assert.equal(run.code, 0); assert.equal(checked.coreFiles.bytesMatchPinnedHashes, true);
      assert.equal(checked.privateCoreExecutedByInspection, false); assert.equal(checked.emitterConstructed, false);
      assert.equal(checked.sessionsCreated, 0); assert.equal(checked.networkCalls, 0);
      assert.equal(checked.doctor.snapshot.present, false); assert.deepEqual(readdirSync(main.config.outboxDirectory), []);
    }
    assert.equal(httpEvents.length, 0); assert.equal(await rows(), 0);
  });
  await check(1, async () => {
    expiry = configuration('expiry', [command(4)]);
    const run = await once('--once', expiry.configPath);
    assert.equal(run.code, 2); assert.equal(resultOf(run).status, 'DELIVERY_UNCONFIRMED');
    assert.equal(resultOf(run).capturesExecuted, 3); assert.equal(injectedUnavailable, 1);
    const snapshot = expiry.outbox.read(); assert.equal(snapshot.entries.length, 1);
    expiredRecord = snapshot.entries[0].record;
    assert.equal(snapshot.entries[0].attempts[0].outcome, 'UNCERTAIN'); assert.equal(await rows(), 0);
    originalCoreMetadata = run.reports.find(r => r.event === 'HOST_STARTED').core;
    assert.equal(originalCoreMetadata.localExecutableBytesVerified, true);
  });
  let firstWatch, firstSession;
  await check(2, async () => {
    firstWatch = launch('--watch', main.configPath);
    firstSession = (await firstWatch.waitFor(r => r.event === 'HOST_STARTED')).sessionId;
    await firstWatch.waitFor(r => r.event === 'HOST_TICK');
    const before = readFileSync(main.snapshotPath), second = await once('--once', main.configPath);
    assert.equal(second.code, 1); assert.equal(second.reports.at(-1).code, 'R68_HOST_RECOVERY_REQUIRED');
    assert.deepEqual(readFileSync(main.snapshotPath), before);
    atomicCommands(main.config.commandsFile, [command(1), command(2)]);
    const tick = await firstWatch.waitFor(r => r.event === 'HOST_TICK' && r.captured.length === 2);
    assert.equal(tick.flushed.unconfirmed, 1); assert.equal(firstPostPersistedBatches, 2);
    const snapshot = main.outbox.read(); firstRecords = snapshot.entries.map(entry => entry.record);
    assert.deepEqual(firstRecords.map(record => record.envelope.payload.sequence), [1, 2]);
    assert.ok(firstRecords.every(record => record.envelope.payload.sessionId === firstSession));
    assert.ok(firstRecords.every(record => record.envelope.payload.capture.entries.length === 3));
  });
  await check(3, async () => {
    assert.equal(await rows(), 1); assert.equal(responseLosses, 1);
    firstWatch.child.kill('SIGTERM'); const ended = await firstWatch.closed;
    assert.equal(ended.code, 0); assert.equal(ended.signal, null); assert.equal(resultOf(ended).status, 'STOPPED');
    assert.equal(resultOf(ended).lifetimeLeaseReleased, true);
    assert.ok(!readdirSync(main.config.outboxDirectory).some(name => [R68_HOST_LOCK, R67_OUTBOX_LOCK, R67_DELIVERY_LOCK].includes(name)));
    const snapshot = main.outbox.read();
    assert.equal(snapshot.entries[0].attempts.at(-1).outcome, 'UNCERTAIN'); assert.equal(snapshot.entries[1].attempts.length, 0);
  });
  await check(4, async () => {
    holdNextReplay = true; holdObserved = new Promise(resolve => { holdObservedResolve = resolve; });
    const draining = launch('--watch', main.configPath);
    await draining.waitFor(r => r.event === 'HOST_STARTED');
    await Promise.race([holdObserved, new Promise((_, reject) => {
      const timer = setTimeout(() => reject(Error('R68_ACCEPTANCE_HELD_ACK_TIMEOUT')), 10000); timer.unref();
    })]);
    draining.child.kill('SIGTERM');
    // Let the operating system deliver SIGTERM while the request is held.
    await new Promise(resolve => setTimeout(resolve, 100)); heldRelease(); heldRelease = null;
    const ended = await draining.closed;
    assert.equal(ended.code, 0); assert.equal(resultOf(ended).status, 'STOPPED');
    assert.equal(httpEvents.filter(event => event.operationId === op(2)).length, 0);
    const snapshot = main.outbox.read(); assert.equal(snapshot.entries[0].attempts.at(-1).outcome, 'ACKNOWLEDGED');
    assert.equal(snapshot.entries[1].attempts.length, 0); pendingAfterStop = 1;
    assert.equal(await rows(), 1);
  });
  await check(5, async () => {
    atomicCommands(main.config.commandsFile, [command(1), command(2), command(3)]);
    const completed = await once('--once', main.configPath); assert.equal(completed.code, 0);
    const result = resultOf(completed); assert.equal(result.capturesExecuted, 3);
    const tick = completed.reports.find(r => r.event === 'HOST_TICK');
    assert.deepEqual(tick.captured.map(entry => entry.replayed), [true, true, false]);
    assert.equal(tick.captured[2].sequence, 1); assert.notEqual(tick.captured[2].sessionId, firstSession);
    const snapshot = main.outbox.read(); assert.deepEqual(snapshot.entries.slice(0, 2).map(entry => entry.record), firstRecords);
    assert.ok(snapshot.entries.every(entry => entry.attempts.at(-1).outcome === 'ACKNOWLEDGED'));
    const repeated = httpEvents.filter(event => event.operationId === op(1));
    assert.equal(repeated.length, 2); assert.equal(repeated[0].bodySha256, repeated[1].bodySha256);
    assert.equal(repeated[1].intakeStatus, 'ALREADY_STORED');
    const stored = await store.read(); assert.equal(stored.length, 3);
    for (const row of stored) assert.deepEqual(row.record, snapshot.entries.find(entry => entry.record.envelope.payload.eventId === row.receipt.eventId).record);
    databaseSummary = JSON.parse(await psql("SELECT jsonb_build_object('batches',count(*),'sessions',count(DISTINCT session_id),'captures',sum((receipt->>'captureCount')::integer)) FROM public.jenios_robot_private_captures_r67;"));
    assert.deepEqual(databaseSummary, { batches: 3, sessions: 2, captures: 9 });
  });
  await check(6, async () => {
    const before = readFileSync(main.snapshotPath), count = httpEvents.length;
    for (let n = 0; n < 2; n++) {
      const run = await once('--check', main.configPath); assert.equal(run.code, 0);
      const checked = inspectionOf(run); assert.equal(checked.sessionsCreated, 0);
      assert.equal(checked.doctor.queue.statesAtObservation.ACKNOWLEDGED, 3);
      assert.deepEqual(readFileSync(main.snapshotPath), before); finalDoctor = checked.doctor;
    }
    assert.equal(httpEvents.length, count);
  });
  await check(7, async () => {
    const before = readFileSync(main.snapshotPath), badHmac = join(privateDirectory, 'wrong-integrity.txt');
    writeFileSync(badHmac, '0'.repeat(64), { mode: 0o600 });
    const badConfig = join(privateDirectory, 'wrong-host.json');
    writeFileSync(badConfig, JSON.stringify({ ...main.config, hmacKeyFile: badHmac }), { mode: 0o600 });
    const bad = await once('--check', badConfig); assert.equal(bad.code, 1);
    assert.match(bad.reports.at(-1).code, /HMAC_MISMATCH/); assert.deepEqual(readFileSync(main.snapshotPath), before);
    writeFileSync(badConfig, JSON.stringify({ ...main.config, sourceKeySha256: '0'.repeat(64) }));
    const key = await once('--once', badConfig); assert.equal(key.code, 1);
    assert.equal(key.reports.at(-1).code, 'R68_HOST_SOURCE_KEY_MISMATCH'); assert.deepEqual(readFileSync(main.snapshotPath), before);
  });
  await check(8, async () => {
    atomicCommands(main.config.commandsFile, []);
    const running = launch('--watch', main.configPath); await running.waitFor(r => r.event === 'HOST_TICK');
    running.child.kill('SIGKILL'); assert.equal((await running.closed).signal, 'SIGKILL'); confirmedSigkills++;
    const lockPath = join(main.config.outboxDirectory, R68_HOST_LOCK), lock = readFileSync(lockPath), snapshot = readFileSync(main.snapshotPath);
    const checked = inspectionOf(await once('--check', main.configPath));
    assert.equal(checked.doctor.locks.find(item => item.kind === 'HOST').present, true);
    assert.equal(checked.doctor.recoveryAuthorized, false); assert.equal(checked.doctor.exclusiveHostFenceVerified, false);
    const blocked = await once('--once', main.configPath); assert.equal(blocked.code, 1);
    assert.equal(blocked.reports.at(-1).code, 'R68_HOST_RECOVERY_REQUIRED');
    assert.deepEqual(readFileSync(lockPath), lock); assert.deepEqual(readFileSync(main.snapshotPath), snapshot);
  });
  await check(9, async () => {
    const before = readFileSync(expiry.snapshotPath), requests = httpEvents.length;
    const deadline = expiredRecord.envelope.payload.expiresAtMs + 30, waitStarted = Date.now();
    while (Date.now() < deadline) {
      console.log('WAIT original retained batch approaching real 120-second admission expiry');
      await new Promise(resolve => setTimeout(resolve, Math.min(25000, deadline - Date.now())));
    }
    expiryWaitMs = Date.now() - waitStarted;
    for (let n = 0; n < 2; n++) {
      const result = await once('--check', expiry.configPath); assert.equal(result.code, 0);
      const checked = inspectionOf(result); expirationDoctor = checked.doctor;
      assert.equal(checked.doctor.queue.persistedStates.UNCONFIRMED, 1);
      assert.equal(checked.doctor.queue.statesAtObservation.EXPIRED_UNCONFIRMED, 1);
      assert.equal(checked.doctor.queue.newlyObservedExpired, 1); assert.equal(checked.sessionsCreated, 0);
      assert.deepEqual(readFileSync(expiry.snapshotPath), before);
    }
    assert.equal(httpEvents.length, requests); assert.deepEqual(expiry.outbox.read().entries[0].record, expiredRecord);
  });
  await check(10, async () => {
    const lost = configuration('lease-loss', [command(5)]), count = httpEvents.length;
    await assert.rejects(() => runR68PrivateHost({ configPath: lost.configPath, mode: 'once', env: { ...qa },
      onReport(event) { if (event.event === 'HOST_STARTED') renameSync(join(lost.config.outboxDirectory, R68_HOST_LOCK),
        join(lost.config.outboxDirectory, 'retained-owner-lock')); } }), { code: 'R68_HOST_LEASE_OWNERSHIP_CHANGED' });
    assert.equal(lost.outbox.read().entries.length, 0); assert.equal(httpEvents.length, count);
    assert.ok(readdirSync(lost.config.outboxDirectory).includes('retained-owner-lock'));
    const disabled = configuration('gate-change', [command(6)]), changedEnv = { ...qa };
    await assert.rejects(() => runR68PrivateHost({ configPath: disabled.configPath, mode: 'once', env: changedEnv,
      onReport(event) { if (event.event === 'HOST_STARTED') changedEnv.JENIOS_ROBOT_R68_HOST_ENABLED = 'false'; } }),
    { code: 'R68_HOST_DISABLED' });
    assert.equal(disabled.outbox.read().entries.length, 0); assert.equal(httpEvents.length, count);
    assert.ok(!readdirSync(disabled.config.outboxDirectory).includes(R68_HOST_LOCK));
  });
  await check(11, async () => {
    const output = outputs.join('\n');
    for (const secret of [privateKeyPem, integrityKey, originalDirectory, privateDirectory]) assert.ok(!output.includes(secret));
    for (const entry of [...main.outbox.read().entries, ...expiry.outbox.read().entries]) {
      for (const [key, value] of Object.entries(R67_INVARIANTS)) assert.equal(entry.record.provenance[key], value);
      assert.equal(entry.record.provenance.origin, R67_ORIGIN);
      assert.equal(entry.record.envelope.payload.capture.executableBytesVerifiedByAdapter, false);
      assert.deepEqual(entry.record.envelope.payload.capture.counts, { manual: 1, hybrid: 1, reverse: 1 });
    }
    assert.equal(await rows(), 3); assert.equal(databaseSummary.captures, 9);
  });
} catch (error) { failure = codeOf(error); console.error(failure); }
finally {
  heldRelease?.(); for (const child of children) child.kill('SIGKILL');
  if (server) { server.closeAllConnections?.(); await new Promise(resolve => server.close(resolve)); }
  const report = { schema: 'JENIOS_ROBOT_R68_PRIVATE_HOST_ACCEPTANCE_V1', startedAt, finishedAt: new Date().toISOString(),
    sourceCommitSha, sourceTreeDirty, publicImplementationDigests,
    classification: 'ORIGINAL_PRIVATE_BYTES_LOCAL_CLI_HOST_REAL_SIGNALS_HTTP_POSTGRES_SYNTHETIC_QA',
    publicCiEvidence: false, privateExecutableBytesIncludedInArtifact: false,
    scope: { runtimeOrigin: R67_ORIGIN, evidenceKind: R67_EVIDENCE, inputs: 'CONTROLLED_SYNTHETIC_SCENARIOS',
      commercialModes: ['manual', 'hybrid', 'reverse'], ultraFastProvidedByPrivateCore: false,
      database: 'REAL_DISPOSABLE_POSTGRESQL', databaseName: 'jenios_r68_private_qa',
      databaseHost: '127.0.0.1', databasePort: Number(databaseUrl.port || '5432'),
      databaseRpcTransport: 'LOCAL_PSQL_ADAPTER_NOT_HOSTED_POSTGREST', transport: 'ACTUAL_LOOPBACK_HTTP',
      sourceClock: 'REAL_WALL_CLOCK', expiryClock: 'REAL_WALL_CLOCK_NO_INJECTED_ADVANCE',
      adminAuthenticationTested: false, nextServerTested: false, hostedSupabaseTested: false,
      persistentHostCertified: false, serviceInstalled: false, privateOperationalSourceActive: false },
    core: originalCoreMetadata ?? null,
    execution: { node: process.version, cliProcesses: processCount, deliberateSigkills: confirmedSigkills,
      responsesLostAfterDatabaseCommit: responseLosses, deliberatelyUnavailableReceiverRequests: injectedUnavailable,
      intakeHttpRequests: httpEvents.length, firstPostPersistedBatches, pendingAfterGracefulMidRequestStop: pendingAfterStop,
      databaseSummary: databaseSummary ?? null, retainedOriginalDecisionsOutsideDatabase: expiredRecord ? 3 : 0,
      realExpiryWaitMs: expiryWaitMs, acknowledgedQueueBeforeOrphanProbe: finalDoctor?.queue ?? null,
      expiryObservation: expirationDoctor?.queue ?? null, httpEvents },
    total: cases.length, passed: cases.filter(item => item.status === 'PASS').length,
    failed: cases.filter(item => item.status === 'FAIL').length, notRun: cases.filter(item => item.status === 'NOT_RUN').length,
    status: failure ? 'FAIL' : 'PASS', error: failure, cases,
    invariants: { ...R67_INVARIANTS, persistentHostCertified: false, hostedEnvironmentCertified: false,
      realAdministrativeIdentityCertified: false, recoveryAuthorized: false, monotonicWitnessVerified: false,
      hostedDatabaseMigrationsApplied: 0, productionConfigurationChanged: false, mergePerformed: false, deployPerformed: false },
    limitations: ['Original bytes execute only with synthetic scenarios on this local host; public CI does not repeat this private evidence.',
      'The private custody files and signing key in this acceptance run are temporary fixtures, not production key custody.',
      'No hosted service, persistent volume guarantee, service manager or production scheduler is installed or certified.',
      'A retained lock is inspected but never automatically removed or interpreted as proof of exclusive process ownership.',
      'A local lease detects observed ownership changes; it is not distributed fencing or an independent monotonic witness.',
      'Nine original synthetic decisions are admitted; three additional original decisions remain unconfirmed and expire locally.',
      'Graceful shutdown drains one in-flight request and starts no subsequent delivery after the stop is observed.',
      'No hosted Auth, operational customer feed, paid provider, order, financial result or private-core strategy change is certified.'] };
  const text = JSON.stringify(report, null, 2) + '\n';
  for (const secret of [privateKeyPem, integrityKey, originalDirectory, privateDirectory]) assert.ok(!text.includes(secret));
  writeFileSync(artifactPath, text); rmSync(privateDirectory, { recursive: true, force: true });
  console.log(JSON.stringify({ report: artifactPath, status: report.status, total: report.total,
    passed: report.passed, failed: report.failed, notRun: report.notRun, sourceCommitSha, sourceTreeDirty }));
  if (failure) process.exitCode = 1;
}
