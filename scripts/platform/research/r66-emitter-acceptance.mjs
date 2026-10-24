/** R66 acceptance: separate emitter processes, actual loopback HTTP R65 handler,
 * and a real disposable PostgreSQL database. No Next/browser/Auth claim.
 * Signed input remains R61_SYNTHETIC_RUNTIME / SIGNED_QA_REPLAY.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash, generateKeyPairSync, randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createR65DatabaseStore, R65_DATABASE_RPCS } from '../../../lib/platform/research/robot-r65-database-store.mjs';
import { createR65EvolutionState } from '../../../lib/platform/research/robot-r65-evolution-engine.mjs';
import { createR65ObservationHandler } from '../../../lib/platform/research/robot-r65-http.mjs';
import { canonicalR64Json } from '../../../lib/platform/research/robot-r64-telemetry.mjs';

assert.equal(process.env.JENIOS_R66_DISPOSABLE_DB, 'true', 'Explicit disposable R66 database flag required');
const databaseUrl = new URL(process.env.JENIOS_R66_TEST_DATABASE_URL || 'invalid:');
assert.ok(['postgres:', 'postgresql:'].includes(databaseUrl.protocol));
assert.equal(databaseUrl.hostname, '127.0.0.1');
assert.equal(databaseUrl.pathname, '/jenios_r66_qa');
assert.equal(databaseUrl.search, ''); assert.equal(databaseUrl.hash, '');
assert.equal(decodeURIComponent(databaseUrl.username), 'postgres');
assert.ok(['r66-test-only', 'r64-test-only'].includes(decodeURIComponent(databaseUrl.password)));
assert.ok(['5432', '56466'].includes(databaseUrl.port || '5432'));
for (const flag of ['JENIOS_REAL_EXECUTION_ENABLED', 'JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED',
  'JENIOS_PRIVATE_PAPER_EXECUTOR']) assert.notEqual(process.env[flag], 'true');
assert.notEqual(process.env.VERCEL_ENV, 'production');

const root = fileURLToPath(new URL('../../../', import.meta.url));
const fixturePath = join(root, 'tests/fixtures/r66-emitter-process.mjs');
const privateDirectory = mkdtempSync(join(tmpdir(), 'jenios-r66-acceptance-'));
chmodSync(privateDirectory, 0o700);
const artifactDirectory = process.env.ROBOT_QA_ARTIFACT_DIR || join(tmpdir(), 'jenios-r66-artifacts');
mkdirSync(artifactDirectory, { recursive: true });
const artifactPath = join(artifactDirectory, 'r66-emitter-acceptance.json');
const postgresEnv = { PATH: process.env.PATH || '/usr/bin:/bin', PGHOST: '127.0.0.1',
  PGHOSTADDR: '127.0.0.1', PGPORT: databaseUrl.port || '5432', PGUSER: 'postgres',
  PGPASSWORD: decodeURIComponent(databaseUrl.password), PGDATABASE: 'jenios_r66_qa',
  PGOPTIONS: '', PGSSLMODE: 'disable', PGCONNECT_TIMEOUT: '5' };
const children = new Set(), serverEvents = [];
let server, origin, trustedSource, responseLossEventId = null, responseLosses = 0;
let commandSequence = 0, processCount = 0, confirmedCaptureSigkills = 0;
const startedAt = new Date().toISOString(), sha = value => createHash('sha256').update(value).digest('hex');
const scopeId = 'scope:' + randomBytes(8).toString('hex');
const sourceId = 'source:' + randomBytes(8).toString('hex');
const { privateKey } = generateKeyPairSync('ed25519');
const privateKeyPem = privateKey.export({ format: 'pem', type: 'pkcs8' });
const integrityKey = randomBytes(32).toString('hex');
const op = number => 'op:' + number.toString(16).padStart(32, '0');
const initialState = createR65EvolutionState({ scopeId, nowMs: Date.now() - 1000 });
const cases = [
  'fresh disposable database and unchanged R64/R65 schemas',
  'four robot records are durable before any HTTP transmission',
  'SIGKILL after successful capture leaves committed records available',
  'different process opens a new session and recovers the pending records',
  'retry after restart retains exact record, event and both signatures',
  'new runtime requires two new fresh confirmations after restart',
  'HTTP response loss after database commit remains unconfirmed locally',
  'retry receives ALREADY_STORED and stores each observation only once',
  'actual HTTP retransmission preserves the complete signed request bytes',
  'database preserves the first receipt and separately signed provenance',
  'database contains all four robots and both emitter sessions',
  'acknowledgements survive another process restart without resending',
  'expired envelopes are retained without invoking the sender',
  'expired retry survives restart without new timestamps or signatures',
  'persisted scope binding rejects another process with a different scope',
  'paid generation and every external execution surface remain inactive',
].map(name => ({ name, status: 'NOT_RUN' }));
let failure = null;
async function check(index, action) {
  try { await action(); cases[index].status = 'PASS'; console.log('PASS ' + cases[index].name); }
  catch (error) { cases[index].status = 'FAIL'; cases[index].error =
    /^R6[456]_[A-Z0-9_]+$/.test(error?.code || error?.message || '') ? error.code || error.message : 'ACCEPTANCE_ASSERTION_FAILED';
    throw error; }
}
const psql = sql => new Promise((resolve, reject) => {
  const child = spawn('psql', ['-X', '-w', '-q', '-v', 'ON_ERROR_STOP=1', '-At'],
    { env: postgresEnv, stdio: ['pipe', 'pipe', 'pipe'] });
  let stdout = '', stderr = '', timedOut = false;
  const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, 15000);
  child.stdout.on('data', bytes => { stdout += bytes; if (stdout.length > 2 * 1024 * 1024) child.kill('SIGKILL'); });
  child.stderr.on('data', bytes => { if (stderr.length < 8192) stderr += bytes; });
  child.on('error', () => { clearTimeout(timer); reject(Error('R66_POSTGRES_PROCESS_UNAVAILABLE')); });
  child.on('close', code => {
    clearTimeout(timer);
    if (code === 0 && !timedOut) resolve(stdout.trim());
    else reject(Error(stderr.match(/R6[45]_[A-Z0-9_]+/)?.[0] || 'R66_POSTGRES_QUERY_FAILED'));
  });
  child.stdin.end(sql);
});
const encoded = value => "convert_from(decode('" + Buffer.from(JSON.stringify(value)).toString('base64') + "','base64'),'UTF8')::jsonb";
const rpcNames = new Set(Object.values(R65_DATABASE_RPCS));
const store = createR65DatabaseStore({ db: { async rpc(name, args) {
  assert.ok(rpcNames.has(name));
  try { return { data: JSON.parse(await psql('SET ROLE service_role; SELECT public.' + name + '(' + encoded(args.p_input) + ');')), error: null }; }
  catch (error) { return { data: null, error: { message: error.message } }; }
} } });
const rows = async () => Number(await psql('SELECT count(*) FROM public.jenios_robot_events_r64;'));
function directory(name) { const path = join(privateDirectory, name); mkdirSync(path, { mode: 0o700 }); return path; }
function config(directoryPath, patch = {}) { return { directory: directoryPath, key: integrityKey,
  scopeId, sourceId, privateKeyPem, state: initialState, ...patch }; }
function childProcess() {
  const child = spawn(process.execPath, [fixturePath], { cwd: root,
    env: { PATH: process.env.PATH || '/usr/bin:/bin', JENIOS_R66_PROCESS_FIXTURE: 'true',
      JENIOS_REAL_EXECUTION_ENABLED: 'false', JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED: 'false',
      JENIOS_PRIVATE_PAPER_EXECUTOR: 'false', NEXT_TELEMETRY_DISABLED: '1' },
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
  processCount++; children.add(child);
  const pending = new Map();
  child.stdout.on('data', () => {}); child.stderr.on('data', () => {});
  const closed = new Promise(resolve => child.once('close', (code, signal) => {
    children.delete(child);
    for (const { reject, timer } of pending.values()) { clearTimeout(timer); reject(Error('R66_ACCEPTANCE_CHILD_CLOSED')); }
    pending.clear(); resolve({ code, signal });
  }));
  child.on('message', message => {
    const waiter = pending.get(message?.id); if (!waiter) return;
    pending.delete(message.id); clearTimeout(waiter.timer);
    if (message.ok) waiter.resolve(message.result); else waiter.reject(Object.assign(Error(message.error), { code: message.error }));
  });
  child.on('error', () => {
    for (const { reject, timer } of pending.values()) { clearTimeout(timer); reject(Error('R66_ACCEPTANCE_CHILD_UNAVAILABLE')); }
    pending.clear();
  });
  const ask = (action, fields = {}) => new Promise((resolve, reject) => {
    const id = ++commandSequence;
    const timer = setTimeout(() => { pending.delete(id); child.kill('SIGKILL'); reject(Error('R66_ACCEPTANCE_CHILD_TIMEOUT')); }, 20000);
    pending.set(id, { resolve, reject, timer }); child.send({ id, action, ...fields });
  });
  return { ask, closed, kill: () => child.kill('SIGKILL'),
    async close() { await ask('close'); return closed; } };
}
async function startHttp() {
  const handler = createR65ObservationHandler({ getStore: () => store, getSource: () => trustedSource,
    env: { VERCEL_ENV: 'preview', JENIOS_QA_CANDIDATE_ENABLED: 'true', JENIOS_ROBOT_QA_ENABLED: 'true',
      JENIOS_ROBOT_R64_ENABLED: 'true', JENIOS_ROBOT_R65_ENABLED: 'true',
      JENIOS_REAL_EXECUTION_ENABLED: 'false', JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED: 'false',
      JENIOS_PRIVATE_PAPER_EXECUTOR: 'false' } });
  server = createServer(async (request, response) => {
    try {
      if (request.socket.remoteAddress !== '127.0.0.1' || request.url !== '/api/platform/robot-evolution-observations' || request.method !== 'POST') {
        response.writeHead(404); response.end(); return;
      }
      let size = 0; const chunks = [];
      for await (const chunk of request) { size += chunk.length; if (size > 32768) { request.destroy(); return; } chunks.push(chunk); }
      const body = Buffer.concat(chunks).toString('utf8'), record = JSON.parse(body);
      const result = await handler(new Request(origin + request.url, { method: 'POST',
        headers: { 'Content-Type': request.headers['content-type'] || '' }, body }));
      const resultBody = await result.text(), parsed = JSON.parse(resultBody);
      serverEvents.push({ eventId: record.envelope?.payload?.eventId, bodySha256: sha(body),
        capturedAtMs: record.envelope?.payload?.event?.capturedAtMs, expiresAtMs: record.envelope?.payload?.expiresAtMs,
        httpStatus: result.status, intakeStatus: parsed.status || null });
      if (record.envelope?.payload?.eventId === responseLossEventId && responseLosses === 0 && result.status === 202) {
        responseLosses++; request.socket.destroy(); return; // Commit completed; the client receives no acknowledgement.
      }
      response.writeHead(result.status, Object.fromEntries(result.headers)); response.end(resultBody);
    } catch { if (!response.destroyed) { response.writeHead(500); response.end(); } }
  });
  server.requestTimeout = 5000; server.headersTimeout = 5000;
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  origin = 'http://127.0.0.1:' + server.address().port;
}
let first, firstCapture, second, secondCapture, pendingReplay, firstLost, recovered,
  mainDirectory, expiredDirectory, expiredCapture, finalQueue, databaseSummary;
const assisted = (number, mode) => ({ kind: 'assisted', value: { operationId: op(number),
  input: { source: 'synthetic_fixture', mode, operatorSide: 'buy', technicalSide: 'sell', confidence: 0.85 } } });
const ultra = number => ({ kind: 'ultra', value: { operationId: op(number),
  event: { type: 'snapshot', scenario: 'normal', marketAgeMs: 100 } } });
const originalCommands = [assisted(1, 'manual'), assisted(2, 'hybrid'), assisted(3, 'reverse'), ultra(4), ultra(5)];
try {
  await check(0, async () => {
    assert.equal(await psql('SELECT current_database();'), 'jenios_r66_qa');
    assert.equal(await psql("SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'jenios_robot_%';"), '0', 'Fresh disposable R66 database required');
    await psql("DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF;" +
      "IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF;" +
      "IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role BYPASSRLS; END IF; END $$;" +
      'GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role;');
    await psql(readFileSync(join(root, 'db/schema/robot-r64-operational-store.sql'), 'utf8'));
    await psql(readFileSync(join(root, 'db/schema/robot-r65-lifecycle-store.sql'), 'utf8'));
    await store.appendEvolution({ scopeId, operationId: op(6600), expectedRevision: -1,
      previousDigest: null, state: initialState, actorId: 'system:r65' });
    assert.deepEqual((await store.readEvolution({ scopeId })).state, initialState);
    assert.equal(await rows(), 0);
  });
  await startHttp(); mainDirectory = directory('main-outbox');
  const a = childProcess(); first = await a.ask('open', { config: config(mainDirectory) }); trustedSource = first.trustedSource;
  await check(1, async () => {
    firstCapture = await a.ask('capture', { commands: originalCommands });
    assert.equal(firstCapture.sendCalls, 0); assert.equal(serverEvents.length, 0); assert.equal(await rows(), 0);
    assert.equal(firstCapture.inspect.queue.pending, 5);
    assert.deepEqual(firstCapture.records.map(r => r.envelope.payload.event.decision), ['KEEP', 'ADVISE', 'ADVISE', 'BLOCK', 'ALLOW']);
    assert.equal(new Set(firstCapture.records.map(r => r.envelope.payload.event.robot)).size, 4);
    assert.ok(readFileSync(join(mainDirectory, 'r66-observation-outbox.json')).length > 0);
  });
  await check(2, async () => {
    a.kill(); assert.equal((await a.closed).signal, 'SIGKILL'); confirmedCaptureSigkills++;
    assert.equal(await rows(), 0);
  });
  const b = childProcess();
  await check(3, async () => {
    second = await b.ask('open', { config: config(mainDirectory) });
    assert.notEqual(second.sessionId, first.sessionId); assert.equal(second.inspect.queue.pending, 5);
    assert.equal(second.inspect.nextSequence, 1); assert.equal(second.inspect.ultraEventCount, 0);
    assert.equal(second.inspect.runtimeRestored, false);
  });
  await check(4, async () => {
    pendingReplay = await b.ask('capture', { commands: originalCommands });
    assert.deepEqual(pendingReplay.records, firstCapture.records);
    assert.equal(pendingReplay.inspect.nextSequence, 1); assert.equal(pendingReplay.inspect.ultraEventCount, 0);
  });
  await check(5, async () => {
    secondCapture = await b.ask('capture', { commands: [ultra(6), ultra(7)] });
    assert.deepEqual(secondCapture.records.map(r => r.envelope.payload.event.decision), ['BLOCK', 'ALLOW']);
    assert.deepEqual(secondCapture.records.map(r => r.envelope.payload.sequence), [1, 2]);
    assert.ok(secondCapture.records.every(r => r.envelope.payload.sessionId === second.sessionId));
  });
  await check(6, async () => {
    responseLossEventId = firstCapture.records[0].envelope.payload.eventId;
    firstLost = await b.ask('flush', { origin, limit: 1 });
    assert.equal(firstLost.flushed.attempted, 1); assert.equal(firstLost.flushed.unconfirmed, 1);
    assert.equal(firstLost.flushed.stoppedReason, 'SEND_UNCONFIRMED'); assert.equal(firstLost.inspect.queue.unconfirmed, 1);
    assert.equal(await rows(), 1); assert.equal(responseLosses, 1);
  });
  await check(7, async () => {
    recovered = await b.ask('flush', { origin, limit: 20 });
    assert.equal(recovered.flushed.acknowledged, 7); assert.equal(recovered.inspect.queue.acknowledged, 7);
    assert.equal(recovered.inspect.queue.pending, 0); assert.equal(recovered.inspect.queue.unconfirmed, 0);
    assert.equal(await rows(), 7); assert.equal(serverEvents[1].intakeStatus, 'ALREADY_STORED');
  });
  await check(8, async () => {
    const attempts = serverEvents.filter(x => x.eventId === responseLossEventId);
    assert.equal(attempts.length, 2); assert.equal(attempts[0].bodySha256, attempts[1].bodySha256);
    assert.equal(attempts[0].capturedAtMs, attempts[1].capturedAtMs); assert.equal(attempts[0].expiresAtMs, attempts[1].expiresAtMs);
  });
  await check(9, async () => {
    const persisted = JSON.parse(await psql("SELECT jsonb_build_object('receipt',e.receipt,'provenance',p.provenance) FROM public.jenios_robot_events_r64 e JOIN public.jenios_robot_observation_provenance_r65 p USING(scope_id,event_id) WHERE e.event_id='" + responseLossEventId + "';"));
    assert.deepEqual(persisted.receipt.event, firstCapture.records[0].envelope.payload.event);
    assert.deepEqual(persisted.provenance, firstCapture.records[0].provenance);
    assert.equal(persisted.receipt.payloadDigest, firstCapture.records[0].provenance.payloadDigest);
    assert.equal(await psql('SELECT count(*) FROM public.jenios_robot_observation_provenance_r65;'), '7');
  });
  await check(10, async () => {
    databaseSummary = JSON.parse(await psql("SELECT jsonb_build_object('rows',count(*),'sessions',count(DISTINCT session_id),'robots',count(DISTINCT receipt->'event'->>'robot')) FROM public.jenios_robot_events_r64;"));
    assert.deepEqual(databaseSummary, { rows: 7, sessions: 2, robots: 4 });
  });
  await b.close();
  const c = childProcess();
  await check(11, async () => {
    const before = serverEvents.length, reopened = await c.ask('open', { config: config(mainDirectory) });
    assert.notEqual(reopened.sessionId, second.sessionId); assert.equal(reopened.inspect.queue.acknowledged, 7);
    const noRetry = await c.ask('flush', { origin });
    assert.equal(noRetry.flushed.attempted, 0); assert.equal(noRetry.sendCalls, 0); assert.equal(serverEvents.length, before);
    finalQueue = noRetry.inspect.queue;
  });
  await c.close(); expiredDirectory = directory('expired-outbox');
  const d = childProcess(); await d.ask('open', { config: config(expiredDirectory) });
  await check(12, async () => {
    expiredCapture = await d.ask('capture', { commands: [assisted(100, 'manual')] });
    await d.ask('clock', { nowMs: expiredCapture.records[0].envelope.payload.expiresAtMs });
    const before = serverEvents.length, expired = await d.ask('flush', { origin });
    assert.equal(expired.flushed.expired, 1); assert.equal(expired.flushed.attempted, 0);
    assert.equal(expired.inspect.queue.expiredUnconfirmed, 1); assert.equal(expired.sendCalls, 0);
    assert.equal(serverEvents.length, before); assert.equal(await rows(), 7);
  });
  await d.close(); const e = childProcess();
  await check(13, async () => {
    const reopened = await e.ask('open', { config: config(expiredDirectory,
      { nowMs: expiredCapture.records[0].envelope.payload.expiresAtMs + 1 }) });
    assert.equal(reopened.inspect.queue.expiredUnconfirmed, 1);
    const retry = await e.ask('capture', { commands: [assisted(100, 'manual')] });
    assert.deepEqual(retry.records, expiredCapture.records); assert.equal(retry.inspect.nextSequence, 1);
    const expired = await e.ask('flush', { origin }); assert.equal(expired.flushed.attempted, 0); assert.equal(expired.sendCalls, 0);
  });
  await e.close(); const f = childProcess();
  await check(14, async () => {
    const otherScope = 'scope:' + randomBytes(8).toString('hex');
    await assert.rejects(f.ask('open', { config: config(mainDirectory,
      { scopeId: otherScope, state: createR65EvolutionState({ scopeId: otherScope, nowMs: initialState.createdAtMs }) }) }),
    /R66_OUTBOX_INVALID_SNAPSHOT/);
    assert.equal(await rows(), 7);
  });
  await f.close();
  await check(15, async () => {
    assert.equal(await psql('SELECT generation_enabled FROM public.jenios_robot_config_r64;'), 'f');
    assert.equal(await psql('SELECT count(*) FROM public.jenios_robot_cycles_r64;'), '0');
    for (const record of [...firstCapture.records, ...secondCapture.records]) {
      assert.equal(record.provenance.origin, 'R61_SYNTHETIC_RUNTIME');
      assert.equal(record.provenance.customerMonitoringActive, false); assert.equal(record.provenance.executionAllowed, false);
      assert.equal(record.provenance.realOrdersSent, 0); assert.equal(record.provenance.externalPaperOrdersSent, 0);
      for (const field of ['actualBrokerPnl', 'actualLossesAvoided', 'realTradeAccuracy']) assert.equal(record.provenance[field], null);
    }
  });
} catch (error) {
  failure = /^R6[456]_[A-Z0-9_]+$/.test(error?.code || error?.message || '') ? error.code || error.message : 'R66_ACCEPTANCE_FAILED';
  console.error(failure);
} finally {
  for (const child of children) child.kill('SIGKILL');
  if (server) { server.closeAllConnections?.(); await new Promise(resolve => server.close(resolve)); }
  const report = { schema: 'JENIOS_ROBOT_R66_EMITTER_ACCEPTANCE_V1', startedAt, finishedAt: new Date().toISOString(),
    classification: 'REAL_PROCESS_RESTART_LOOPBACK_HTTP_DISPOSABLE_POSTGRES_SYNTHETIC_QA',
    scope: { observationEvidenceKind: 'SIGNED_QA_REPLAY', runtimeOrigin: 'R61_SYNTHETIC_RUNTIME',
      validationEvidenceKind: 'SYNTHETIC_FIXTURE', database: 'REAL_DISPOSABLE_POSTGRESQL',
      databaseName: 'jenios_r66_qa', databaseHost: '127.0.0.1', databasePort: Number(databaseUrl.port || '5432'),
      handler: 'createR65ObservationHandler', databaseAdapter: 'createR65DatabaseStore',
      databaseRpcTransport: 'LOCAL_PSQL_ADAPTER_NOT_HOSTED_POSTGREST',
      transport: 'ACTUAL_LOOPBACK_HTTP', sourceClock: 'REAL_WALL_CLOCK',
      expirationClock: 'EXPLICIT_ADVANCED_SYNTHETIC_CLOCK_ONLY_FOR_LOCAL_EXPIRATION_CASES',
      authentication: 'SOURCE_SIGNATURE_ONLY_ADMIN_AUTH_NOT_TESTED',
      browserTested: false, nextServerTested: false, hostedSupabaseTested: false,
      privateEngineConnected: false, customerMonitoringActive: false },
    execution: { node: process.version, emitterProcesses: processCount,
      deliberateSigkillsAfterCapture: confirmedCaptureSigkills, httpRequests: serverEvents.length,
      responsesLostAfterDatabaseCommit: responseLosses, databaseSummary: databaseSummary ?? null,
      finalQueue: finalQueue ?? null, signedRecordDigests: firstCapture?.records.map(r => sha(canonicalR64Json(r))) ?? [],
      httpEvents: serverEvents },
    total: cases.length, passed: cases.filter(c => c.status === 'PASS').length,
    failed: cases.filter(c => c.status === 'FAIL').length, notRun: cases.filter(c => c.status === 'NOT_RUN').length,
    status: failure ? 'FAIL' : 'PASS', error: failure, cases,
    invariants: { realOrdersSent: 0, externalPaperOrdersSent: 0, paidProviderCalls: 0,
      hostedDatabaseMigrationsApplied: 0, customerMonitoringActive: false, privateEngineConnected: false,
      productionConfigurationChanged: false, mergePerformed: false, deployPerformed: false,
      actualBrokerPnl: null, actualLossesAvoided: null, realTradeAccuracy: null, commercialPerformanceCertified: false },
    limitations: ['Source input and trading decisions are synthetic, not financial performance.',
      'Process death is injected after committed capture and after the persistence lock is released.',
      'Machine power loss, filesystem loss and distributed worker recovery are not certified.',
      'Expired records are retained; no expiry extension or automatic re-signing is allowed.',
      'No administrative identity, hosted database, external motor connection or production scheduler was tested.'] };
  const json = JSON.stringify(report, null, 2) + '\n';
  assert.equal(json.includes(privateKeyPem), false); assert.equal(json.includes(integrityKey), false);
  writeFileSync(artifactPath, json); rmSync(privateDirectory, { recursive: true, force: true });
  console.log(JSON.stringify({ report: artifactPath, total: report.total, passed: report.passed,
    failed: report.failed, notRun: report.notRun, status: report.status }));
  if (failure) process.exitCode = 1;
}
