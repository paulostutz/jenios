/** R70 barrier acceptance against the REAL Next preflight route over local TLS.
 * Deployment metadata is explicitly simulated. R67 observations terminate in a
 * VOLATILE_PROTOCOL_SINK_NOT_DATABASE; the real SQL path was certified in R69.
 * Public mode uses the labeled protocol fixture. Original mode invokes the
 * actual R70 CLI and verified private bytes, with no replacement or fallback.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash, generateKeyPairSync, randomBytes } from 'node:crypto';
import { request as httpRequest } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import { createServer as createTcpServer } from 'node:net';
import { chmod, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { R67_EVIDENCE, R67_ORIGIN, R67_BINDING, R67_INVARIANTS, canonicalR67Json,
  verifyR67PrivateObservationRecord, createR67IntakeAcknowledgement, r67RecordDigest,
  r67SourceKeyDigest } from '../../../lib/platform/research/robot-r67-private-protocol.mjs';
import { createR67PrivateCaptureOutbox } from '../../../lib/platform/research/robot-r67-private-capture-outbox.mjs';
import { R70_PREFLIGHT_PATH, R70_TARGET_PINS_SCHEMA, R70_PREFLIGHT_BOUNDARIES,
  verifyR70PreflightRequest, r70TargetPinsDigest } from '../../../lib/platform/research/robot-r70-preflight-protocol.mjs';
import { R67_FIXTURE_SCENARIOS, R67_PROTOCOL_FIXTURE_KIND,
  createR67ProtocolFixture } from '../../../tests/fixtures/r67-private-protocol-fixture.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const mode = process.env.JENIOS_R70_INPUT_MODE;
assert.ok(['PUBLIC_PROTOCOL_FIXTURE', 'ORIGINAL_PRIVATE_CORE'].includes(mode), 'Explicit R70 input mode required');
assert.notEqual(process.env.VERCEL_ENV, 'production');
for (const key of ['JENIOS_REAL_EXECUTION_ENABLED', 'JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED',
  'JENIOS_PRIVATE_PAPER_EXECUTOR', 'JENIOS_ROBOT_ANALYST_PAID_ENABLED']) assert.notEqual(process.env[key], 'true');
if (mode === 'ORIGINAL_PRIVATE_CORE') assert.ok(process.env.JENIOS_R70_PRIVATE_CORE_DIR, 'Original private modules required; no fallback');
const artifactDirectory = resolve(process.env.ROBOT_QA_ARTIFACT_DIR || join(tmpdir(), 'jenios-r70-preflight-evidence'));
const artifactPath = join(artifactDirectory, 'r70-preflight-acceptance.json');
const startedAtMs = Date.now(), startedAt = new Date(startedAtMs).toISOString();
const scopeId = 'scope:' + randomBytes(8).toString('hex'), sourceId = 'source:' + randomBytes(8).toString('hex');
const operationId = 'op:' + randomBytes(16).toString('hex'), integrityKey = randomBytes(32).toString('hex');
const keys = generateKeyPairSync('ed25519'), privateKeyPem = keys.privateKey.export({ type: 'pkcs8', format: 'pem' });
const trustedSource = { scopeId, sourceId, enabled: true, evidenceKind: R67_EVIDENCE,
  publicKeyPem: keys.publicKey.export({ type: 'spki', format: 'pem' }) };
const sourceKeySha256 = r67SourceKeyDigest(trustedSource);
const sha = value => createHash('sha256').update(value).digest('hex');
const intakePath = '/api/platform/robot-private-observations';
const qa = { VERCEL_ENV: 'preview', VERCEL_TARGET_ENV: 'preview', JENIOS_QA_CANDIDATE_ENABLED: 'true',
  JENIOS_ROBOT_QA_ENABLED: 'true', JENIOS_ROBOT_R67_ENABLED: 'true', JENIOS_ROBOT_R68_HOST_ENABLED: 'true',
  JENIOS_ROBOT_R69_HTTPS_ENABLED: 'true', JENIOS_ROBOT_R70_PREFLIGHT_ENABLED: 'true',
  JENIOS_ROBOT_R64_ENABLED: 'false', JENIOS_ROBOT_R65_ENABLED: 'false',
  JENIOS_REAL_EXECUTION_ENABLED: 'false', JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED: 'false',
  JENIOS_PRIVATE_PAPER_EXECUTOR: 'false', JENIOS_ROBOT_ANALYST_PAID_ENABLED: 'false' };
const children = new Set(), nextServers = [], preflightEvents = [], observationEvents = [], hostResults = [], hostFailures = [], fixtureErrors = [];
const sink = new Map(), cases = [];
let temporary, caPath, proxy, origin, targetPins, compatiblePort, mismatchedPort, privateMain, record, firstEntry;
let sourceCommitSha, sourceTreeDirty, publicImplementationDigests, buildEvidence, tlsCertificateSha256;
let phase = 'MATCH', phaseProbeCount = 0, acknowledgementLosses = 0, privateCliInvocations = 0, sigterms = 0;
let observationRequests = 0, preflightRequests = 0;
let holdNextResponse = false, heldObserved, heldObservedResolve, heldRelease, failure = null, lastPublicResult;
let barrierEvidence = null, refusalEvidence = null, signalEvidence = null, replayEvidence = null;
const pause = ms => new Promise(done => setTimeout(done, ms));
const codeOf = error => /^R(?:67|68|69|70)_[A-Z0-9_]+$/.test(error?.code || error?.message || '')
  ? error.code || error.message : 'R70_PREFLIGHT_ACCEPTANCE_ASSERTION_FAILED';
async function check(name, action) {
  const row = { name, status: 'RUNNING' }; cases.push(row);
  try { await action(); row.status = 'PASS'; console.log('PASS ' + name); }
  catch (error) { row.status = 'FAIL'; row.error = codeOf(error); throw error; }
}
function osEnvironment() {
  return Object.fromEntries(['PATH', 'HOME', 'TMPDIR', 'TMP', 'TEMP', 'SystemRoot', 'LANG', 'LC_ALL', 'TZ']
    .filter(key => process.env[key] !== undefined).map(key => [key, process.env[key]]));
}
async function command(binary, args, { input = '', env = osEnvironment(), timeoutMs = 20000, allowedCodes = [0] } = {}) {
  return await new Promise((done, reject) => {
    const child = spawn(binary, args, { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] }); children.add(child);
    let stdout = '', stderr = '', problem;
    const timer = setTimeout(() => { problem = Error('R70_ACCEPTANCE_COMMAND_TIMEOUT'); child.kill('SIGKILL'); }, timeoutMs);
    child.stdout.on('data', bytes => { stdout += bytes; if (stdout.length > 2097152) { problem = Error('R70_ACCEPTANCE_COMMAND_LIMIT'); child.kill('SIGKILL'); } });
    child.stderr.on('data', bytes => { if (stderr.length < 32768) stderr += bytes; });
    child.once('error', () => { problem = Error('R70_ACCEPTANCE_COMMAND_UNAVAILABLE'); });
    child.once('close', code => { clearTimeout(timer); children.delete(child);
      if (problem) reject(problem); else if (!allowedCodes.includes(code)) reject(Error('R70_ACCEPTANCE_COMMAND_FAILED'));
      else done({ code, stdout: stdout.trim(), stderr });
    }); child.stdin.on('error', () => {}); child.stdin.end(input);
  });
}
async function readIncoming(incoming, maximum) {
  let bytes = 0; const parts = [];
  for await (const part of incoming) { bytes += part.length; if (bytes > maximum) throw Error('R70_ACCEPTANCE_BODY_LIMIT'); parts.push(part); }
  return Buffer.concat(parts);
}
async function listen(server) {
  await new Promise((done, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', done); });
  return server.address().port;
}
async function unusedPort() { const server = createTcpServer(), port = await listen(server); await new Promise(done => server.close(done)); return port; }
async function certificates() {
  const keyPath = join(temporary, 'loopback.key'), certPath = join(temporary, 'loopback.pem');
  const caKey = join(temporary, 'ca.key'), csr = join(temporary, 'loopback.csr'), ext = join(temporary, 'loopback.ext');
  caPath = join(temporary, 'ca.pem');
  await command('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-sha256', '-nodes', '-days', '1',
    '-subj', '/CN=JENIOS R70 ephemeral local QA CA', '-addext', 'basicConstraints=critical,CA:TRUE',
    '-addext', 'keyUsage=critical,keyCertSign,cRLSign', '-keyout', caKey, '-out', caPath]);
  await command('openssl', ['req', '-new', '-newkey', 'rsa:2048', '-sha256', '-nodes',
    '-subj', '/CN=127.0.0.1', '-keyout', keyPath, '-out', csr]);
  await writeFile(ext, 'subjectAltName=IP:127.0.0.1\nbasicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\n');
  await command('openssl', ['x509', '-req', '-in', csr, '-CA', caPath, '-CAkey', caKey, '-CAcreateserial',
    '-out', certPath, '-days', '1', '-sha256', '-extfile', ext]);
  const cert = await readFile(certPath); tlsCertificateSha256 = sha(cert);
  return { key: await readFile(keyPath), cert, requestTimeout: 15000, headersTimeout: 5000 };
}
async function nextRequest(port, path, { method = 'GET', headers = {}, body } = {}) {
  return new Promise((done, reject) => {
    const outgoing = httpRequest({ hostname: '127.0.0.1', port, path, method, headers, agent: false }, incoming => {
      const parts = []; let bytes = 0;
      incoming.on('data', chunk => { bytes += chunk.length; if (bytes > 16384) outgoing.destroy(Error('R70_ACCEPTANCE_NEXT_LIMIT')); else parts.push(chunk); });
      incoming.once('error', reject); incoming.once('end', () => done({ status: incoming.statusCode, headers: incoming.headers, body: Buffer.concat(parts) }));
    }); outgoing.once('error', reject); outgoing.setTimeout(6000, () => outgoing.destroy(Error('R70_ACCEPTANCE_NEXT_TIMEOUT'))); outgoing.end(body);
  });
}
async function startNext(port, commitSha) {
  const env = { ...osEnvironment(), ...qa, NODE_EXTRA_CA_CERTS: caPath, NEXT_TELEMETRY_DISABLED: '1',
    VERCEL_URL: new URL(origin).host, VERCEL_PROJECT_ID: targetPins.projectId,
    VERCEL_DEPLOYMENT_ID: targetPins.deploymentId, VERCEL_GIT_COMMIT_SHA: commitSha,
    PLATFORM_SUPABASE_URL: '', PLATFORM_SUPABASE_SERVICE_ROLE_KEY: '', PLATFORM_ADMIN_USER_IDS: '',
    JENIOS_ROBOT_R67_SCOPE_ID: scopeId, JENIOS_ROBOT_R67_SOURCE_ID: sourceId,
    JENIOS_ROBOT_R67_SOURCE_PUBLIC_KEY: trustedSource.publicKeyPem };
  const child = spawn(process.execPath, [join(root, 'node_modules/next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', String(port)],
    { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] }); children.add(child);
  const state = { child, error: null, closed: new Promise(done => child.once('close', () => { children.delete(child); done(); })) };
  nextServers.push(state); child.once('error', () => { state.error = Error('R70_ACCEPTANCE_NEXT_UNAVAILABLE'); });
  child.stdout.resume(); child.stderr.resume();
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    if (state.error) throw state.error;
    if (child.exitCode !== null || child.signalCode !== null) throw Error('R70_ACCEPTANCE_NEXT_EARLY_EXIT');
    try { if ((await nextRequest(port, R70_PREFLIGHT_PATH)).status === 405) return; } catch { /* Bounded local readiness. */ }
    await pause(100);
  }
  throw Error('R70_ACCEPTANCE_NEXT_START_TIMEOUT');
}
async function startProxy(tls) {
  proxy = createHttpsServer(tls, async (incoming, outgoing) => {
    try {
      if (incoming.method !== 'POST' || ![R70_PREFLIGHT_PATH, intakePath].includes(incoming.url)) { outgoing.writeHead(404); outgoing.end(); return; }
      const isPreflight = incoming.url === R70_PREFLIGHT_PATH;
      if (isPreflight) preflightRequests++; else observationRequests++;
      const bytes = await readIncoming(incoming, isPreflight ? 4096 : 262144);
      const parsed = JSON.parse(bytes.toString('utf8'));
      if (isPreflight) {
        phaseProbeCount++;
        const verified = verifyR70PreflightRequest(parsed, { trustedSource });
        const mismatch = phase === 'MISMATCH_ALL' || (phase === 'MISMATCH_BEFORE_FLUSH' && phaseProbeCount >= 2);
        const result = await nextRequest(mismatch ? mismatchedPort : compatiblePort, R70_PREFLIGHT_PATH, {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': String(bytes.length) }, body: bytes });
        const event = { phase, phaseProbe: phaseProbeCount, requestDigest: verified.requestDigest, nonceSha256: sha(parsed.payload.nonce),
          requestBytes: bytes.length, actualNextHandler: true, simulatedServerMetadata: mismatch ? 'WRONG_COMMIT' : 'MATCHING_PINS',
          httpStatus: result.status, cacheControl: result.headers['cache-control'], observedAtMs: Date.now() };
        preflightEvents.push(event);
        if (holdNextResponse) {
          holdNextResponse = false; event.responseHeldForSignal = true;
          const released = new Promise(done => { heldRelease = done; }); heldObservedResolve(); await released;
        }
        outgoing.writeHead(result.status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); outgoing.end(result.body); return;
      }
      const verified = verifyR67PrivateObservationRecord(parsed, { trustedSource, nowMs: Date.now() }), id = verified.receipt.eventId;
      const previous = sink.get(id); if (previous) assert.deepEqual(previous.record, verified.record);
      else sink.set(id, { receipt: verified.receipt, record: verified.record });
      const saved = sink.get(id), status = previous ? 'ALREADY_STORED' : 'STORED', ack = createR67IntakeAcknowledgement(saved, status);
      observationEvents.push({ phase, requestBodySha256: sha(bytes), recordDigest: saved.receipt.recordDigest,
        httpStatus: previous ? 200 : 202, intakeStatus: status, observedAtMs: Date.now(), sink: 'VOLATILE_PROTOCOL_SINK_NOT_DATABASE' });
      if (!previous && acknowledgementLosses === 0) { acknowledgementLosses++; incoming.socket.destroy(); return; }
      outgoing.writeHead(previous ? 200 : 202, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); outgoing.end(JSON.stringify(ack));
    } catch (error) {
      fixtureErrors.push({ phase, path: incoming.url === R70_PREFLIGHT_PATH ? 'PREFLIGHT' : 'OBSERVATION', code: codeOf(error) });
      if (!outgoing.destroyed) { outgoing.writeHead(500, { 'Content-Type': 'application/json' }); outgoing.end('{"error":"R70_ACCEPTANCE_FIXTURE_FAILURE"}'); }
    }
  }); origin = 'https://127.0.0.1:' + await listen(proxy);
}
function setPhase(value) { phase = value; phaseProbeCount = 0; }
async function publicClient(action, withRecord = false) {
  const result = await command(process.execPath, [join(root, 'tests/fixtures/r70-acceptance-client.mjs')], {
    input: JSON.stringify({ action, targetPins, trustedSource, privateKeyPem, ...(withRecord ? { record } : {}) }),
    env: { ...osEnvironment(), NODE_EXTRA_CA_CERTS: caPath }, timeoutMs: 12000, allowedCodes: [0, 2] });
  return JSON.parse(result.stdout);
}
async function configurePrivateHost(name) {
  const outboxDirectory = join(temporary, name + '-outbox'); await mkdir(outboxDirectory, { mode: 0o700 });
  const privateKeyFile = join(temporary, 'source.pem'), hmacKeyFile = join(temporary, 'integrity.txt');
  const commandsFile = join(temporary, 'commands.json'), targetPinsFile = join(temporary, 'target-pins.json');
  await writeFile(privateKeyFile, privateKeyPem, { mode: 0o600 }); await writeFile(hmacKeyFile, integrityKey + '\n', { mode: 0o600 });
  await writeFile(commandsFile, JSON.stringify({ schema: 'JENIOS_R68_PRIVATE_HOST_COMMANDS_V1',
    commands: [{ operationId, scenarios: R67_FIXTURE_SCENARIOS }] }), { mode: 0o600 });
  await writeFile(targetPinsFile, JSON.stringify(targetPins), { mode: 0o600 });
  const configPath = join(temporary, name + '-host.json');
  await writeFile(configPath, JSON.stringify({ schema: 'JENIOS_R70_PRIVATE_HOST_CONFIG_V1',
    coreDirectory: resolve(process.env.JENIOS_R70_PRIVATE_CORE_DIR), outboxDirectory, privateKeyFile, hmacKeyFile, commandsFile,
    scopeId, sourceId, sourceKeySha256, origin, targetPinsFile }), { mode: 0o600 });
  return { configPath, outboxDirectory, outbox: createR67PrivateCaptureOutbox({ directory: outboxDirectory, key: integrityKey, trustedSource }) };
}
function launchPrivate(config, vm = true) {
  privateCliInvocations++;
  const child = spawn(process.execPath, [...(vm ? ['--experimental-vm-modules'] : []),
    join(root, 'scripts/platform/research/r70-private-host.mjs'), '--once', '--config', config.configPath],
    { cwd: root, env: { ...osEnvironment(), ...qa, NODE_EXTRA_CA_CERTS: caPath }, stdio: ['ignore', 'pipe', 'pipe'] });
  children.add(child); let stdout = '', stderr = '', problem;
  const timer = setTimeout(() => { problem = Error('R70_ACCEPTANCE_PRIVATE_TIMEOUT'); child.kill('SIGKILL'); }, 20000);
  child.stdout.on('data', bytes => { stdout += bytes; if (stdout.length > 2097152) child.kill('SIGKILL'); });
  child.stderr.on('data', bytes => { if (stderr.length < 32768) stderr += bytes; });
  const closed = new Promise((done, reject) => {
    child.once('error', () => { problem = Error('R70_ACCEPTANCE_PRIVATE_UNAVAILABLE'); });
    child.once('close', (code, signal) => {
      clearTimeout(timer); children.delete(child); if (problem) { reject(problem); return; }
      try {
        for (const secret of [privateKeyPem.trim(), integrityKey]) assert.ok(!stdout.includes(secret));
        const reports = stdout.trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
        const result = reports.findLast(row => row.schema === 'JENIOS_R70_PRIVATE_HOST_RESULT_V1');
        const rejected = reports.findLast(row => row.schema === 'JENIOS_R70_PRIVATE_HOST_FAILURE_V1');
        if (result) hostResults.push(result); if (rejected) hostFailures.push(rejected);
        done({ code, signal, reports, result, rejected });
      } catch { reject(Error('R70_ACCEPTANCE_PRIVATE_REPORT_INVALID')); }
    });
  }); return { child, closed };
}
async function privateOnce(config = privateMain, vm = true) { return await launchPrivate(config, vm).closed; }
async function stopNext(state) {
  if (state.child.exitCode === null && state.child.signalCode === null) {
    state.child.kill('SIGTERM'); const timer = setTimeout(() => state.child.kill('SIGKILL'), 5000);
    try { await state.closed; } finally { clearTimeout(timer); }
  }
}

try {
  await check('real Next preflight route runs behind local TLS with explicitly simulated deployment metadata and no database', async () => {
    await mkdir(artifactDirectory, { recursive: true }); temporary = await mkdtemp(join(tmpdir(), 'jenios-r70-preflight-')); await chmod(temporary, 0o700);
    sourceCommitSha = (await command('git', ['rev-parse', 'HEAD'])).stdout;
    sourceTreeDirty = (await command('git', ['status', '--porcelain', '--untracked-files=all'])).stdout !== '';
    assert.match(sourceCommitSha, /^[a-f0-9]{40}$/); if (process.env.GITHUB_SHA) assert.equal(process.env.GITHUB_SHA, sourceCommitSha);
    const files = ['scripts/platform/research/r70-preflight-acceptance.mjs', 'tests/fixtures/r70-acceptance-client.mjs',
      'lib/platform/research/robot-r70-preflight-protocol.mjs', 'lib/platform/research/robot-r70-preflight-http.mjs',
      'lib/platform/research/robot-r70-preflight-client.mjs', 'app/api/platform/robot-private-target-preflight/route.js',
      'lib/platform/research/robot-r70-private-host.mjs', 'scripts/platform/research/r70-private-host.mjs',
      'lib/platform/research/robot-r68-private-host.mjs', 'lib/platform/research/robot-r69-https-transport.mjs',
      'lib/platform/research/robot-r67-private-core-loader.mjs', 'lib/platform/research/robot-r67-private-source.mjs',
      'lib/platform/research/robot-r67-private-protocol.mjs', 'lib/platform/research/robot-r67-private-capture-outbox.mjs',
      'lib/platform/research/robot-r67-durable-emitter.mjs', 'tests/fixtures/r67-private-protocol-fixture.mjs'];
    publicImplementationDigests = Object.fromEntries(await Promise.all(files.map(async path => [path, sha(await readFile(join(root, path)))])));
    const compiledRoute = '.next/server/app/api/platform/robot-private-target-preflight/route.js';
    buildEvidence = { buildId: (await readFile(join(root, '.next/BUILD_ID'), 'utf8')).trim(),
      nextVersion: JSON.parse(await readFile(join(root, 'node_modules/next/package.json'), 'utf8')).version,
      compiledRouteSha256: sha(await readFile(join(root, compiledRoute))), compiledRoute,
      compiledSourceCommitIndependentlyAttested: false };
    assert.ok(buildEvidence.buildId); const tls = await certificates();
    compatiblePort = await unusedPort(); mismatchedPort = await unusedPort(); await startProxy(tls);
    targetPins = { schema: R70_TARGET_PINS_SCHEMA, origin, projectId: 'prj_R70FixtureOnly', deploymentId: 'dpl_R70FixtureOnly',
      commitSha: '70'.repeat(20), scopeId, sourceId, sourceKeySha256 };
    await startNext(compatiblePort, targetPins.commitSha); await startNext(mismatchedPort, '00'.repeat(20));
    if (mode === 'ORIGINAL_PRIVATE_CORE') privateMain = await configurePrivateHost('main');
    assert.equal(sink.size, 0); assert.equal(preflightEvents.length, 0); assert.equal(observationEvents.length, 0);
  });
  await check('actual Next commit mismatch blocks the first contact before any private observation', async () => {
    setPhase('MISMATCH_ALL');
    if (mode === 'ORIGINAL_PRIVATE_CORE') {
      const run = await privateOnce(privateMain, false); assert.equal(run.code, 1); assert.equal(run.rejected?.code, 'R69_HTTPS_RESPONSE_STATUS');
      assert.equal(run.reports.some(row => row.event === 'HOST_STARTED'), false);
      assert.deepEqual(await readdir(privateMain.outboxDirectory), []); assert.equal(privateMain.outbox.read().sessions.length, 0);
      barrierEvidence = { actualCliWithoutExperimentalVmModules: true, hostStarted: false, sessionsCreated: 0,
        capturesPersisted: 0, observationRequests: 0, nextHttpStatus: 409 };
    } else {
      const result = await publicClient('probe'); assert.equal(result.ok, false); assert.equal(result.senderInvoked, false);
      assert.equal(record, undefined); barrierEvidence = { protocolOnlyCaller: true, privateCoreExecuted: false,
        publicFixtureCreatedBeforeRefusal: false, observationRequests: 0, nextHttpStatus: 409 };
    }
    assert.equal(preflightEvents.at(-1).httpStatus, 409); assert.equal(preflightEvents.at(-1).actualNextHandler, true);
    assert.equal(observationRequests, 0); assert.equal(observationEvents.length, 0); assert.equal(sink.size, 0);
  });
  await check('a compatible real Next response proves only a fresh signed source configuration match', async () => {
    setPhase('MATCH'); const result = await publicClient('probe'); assert.equal(result.ok, true); assert.equal(result.senderInvoked, false);
    assert.equal(result.preflight.status, 'CONFIGURATION_MATCH'); assert.equal(result.preflight.targetPinsSha256, r70TargetPinsDigest(targetPins));
    for (const [key, value] of Object.entries(R70_PREFLIGHT_BOUNDARIES)) assert.deepEqual(result.preflight[key], value);
    assert.equal(preflightEvents.at(-1).httpStatus, 200); assert.equal(preflightEvents.at(-1).cacheControl, 'no-store');
    assert.equal(sink.size, 0); assert.equal(observationEvents.length, 0); assert.equal(observationRequests, 0);
  });
  if (mode === 'ORIGINAL_PRIVATE_CORE') await check('SIGTERM during the first successful preflight drains the response before any VM session or capture', async () => {
    const config = await configurePrivateHost('signal'); setPhase('MATCH');
    heldObserved = new Promise(done => { heldObservedResolve = done; }); holdNextResponse = true;
    const run = launchPrivate(config, false); let timer;
    try {
      await Promise.race([heldObserved, new Promise((_, reject) => { timer = setTimeout(() => reject(Error('R70_ACCEPTANCE_HELD_RESPONSE_TIMEOUT')), 6000); })]);
      assert.equal(run.child.kill('SIGTERM'), true); sigterms++; await pause(100); heldRelease(); heldRelease = null;
      const closed = await run.closed; assert.equal(closed.code, 0); assert.equal(closed.result?.status, 'STOPPED_BEFORE_START');
      assert.equal(closed.result.sessionsCreated, 0); assert.equal(closed.result.capturesExecuted, 0); assert.equal(closed.result.lifetimeLeaseReleased, true);
      assert.equal(closed.reports.some(row => row.event === 'HOST_STARTED'), false); assert.deepEqual(await readdir(config.outboxDirectory), []);
      assert.equal(sink.size, 0); assert.equal(observationEvents.length, 0); assert.equal(observationRequests, 0);
      signalEvidence = { actualSigterm: true, vmFlagAbsent: true, successfulPreflightDrained: true,
        sessionsCreated: 0, capturesExecuted: 0, observationRequests: 0, leaseReleased: true };
    } finally { clearTimeout(timer); if (heldRelease) { heldRelease(); heldRelease = null; } }
  });
  await check('compatible preflight permits unchanged R69 delivery and loss of ACK leaves the outcome unconfirmed', async () => {
    setPhase('MATCH');
    if (mode === 'ORIGINAL_PRIVATE_CORE') {
      const run = await privateOnce(); assert.equal(run.code, 2); assert.equal(run.result?.status, 'DELIVERY_UNCONFIRMED');
      assert.equal(run.result.capturesExecuted, 3); assert.ok(run.result.preflight.succeeded >= 2);
      const snapshot = privateMain.outbox.read(); assert.equal(snapshot.entries.length, 1); firstEntry = snapshot.entries[0]; record = firstEntry.record;
      assert.equal(firstEntry.attempts.length, 1); assert.equal(firstEntry.attempts[0].outcome, 'UNCERTAIN');
    } else {
      const fixture = await createR67ProtocolFixture({ privateKeyPem, scopeId, sourceId, operationId,
        sessionId: 'session:' + randomBytes(8).toString('hex') }); assert.equal(fixture.fixtureEvidence, R67_PROTOCOL_FIXTURE_KIND); record = fixture.record;
      lastPublicResult = await publicClient('probeAndSend', true); assert.equal(lastPublicResult.ok, false);
      assert.equal(lastPublicResult.phase, 'OBSERVATION'); assert.equal(lastPublicResult.senderInvoked, true);
    }
    assert.equal(acknowledgementLosses, 1); assert.equal(sink.size, 1); assert.equal(observationEvents.length, 1);
    assert.deepEqual([...sink.values()][0].record, record); assert.equal(observationEvents[0].intakeStatus, 'STORED');
  });
  await check('a refused preflight prevents retransmission and preserves the existing pending record and attempt budget where exercised', async () => {
    const before = observationRequests;
    if (mode === 'ORIGINAL_PRIVATE_CORE') {
      setPhase('MISMATCH_BEFORE_FLUSH'); const snapshot = privateMain.outbox.read(); const run = await privateOnce();
      assert.equal(run.code, 1); assert.equal(run.rejected?.code, 'R69_HTTPS_RESPONSE_STATUS');
      assert.equal(run.reports.filter(row => row.event === 'HOST_STARTED').length, 1); assert.equal(phaseProbeCount, 2);
      const after = privateMain.outbox.read(); assert.deepEqual(after.entries, snapshot.entries);
      assert.equal(after.sessions.length, snapshot.sessions.length + 1); assert.equal(after.entries[0].attempts.length, 1);
      refusalEvidence = { actualPrivateHost: true, successfulStartupProbe: true, rejectedBeforeFlush: true,
        recordPreserved: true, attemptsBefore: 1, attemptsAfter: 1, newDeliveryAttempts: 0,
        priorOutcome: 'UNCERTAIN', retainedOutcome: 'UNCERTAIN', newSessionOnly: true };
    } else {
      setPhase('MISMATCH_ALL'); const result = await publicClient('probeAndSend', true);
      assert.equal(result.ok, false); assert.equal(result.phase, 'PREFLIGHT'); assert.equal(result.senderInvoked, false);
      refusalEvidence = { protocolOnlyCaller: true, rejectedBeforeSend: true, privateHostAttemptBudgetExercised: false };
    }
    assert.equal(preflightEvents.at(-1).httpStatus, 409); assert.equal(observationRequests, before); assert.equal(observationEvents.length, before); assert.equal(sink.size, 1);
    assert.deepEqual([...sink.values()][0].record, record);
  });
  await check('a later compatible process retransmits the exact original record without new private decisions', async () => {
    setPhase('MATCH');
    if (mode === 'ORIGINAL_PRIVATE_CORE') {
      const run = await privateOnce(); assert.equal(run.code, 0); assert.equal(run.result?.status, 'ONCE_COMPLETE'); assert.equal(run.result.capturesExecuted, 0);
      const after = privateMain.outbox.read(); assert.equal(after.entries.length, 1); assert.equal(after.entries[0].attempts.length, 2);
      assert.deepEqual(after.entries[0].record, firstEntry.record); assert.equal(after.entries[0].attempts.at(-1).outcome, 'ACKNOWLEDGED');
      assert.equal(after.entries[0].attempts.at(-1).ack.body.status, 'ALREADY_STORED');
      replayEvidence = { actualPrivateHost: true, newPrivateDecisions: 0, retainedAttempts: 2, finalOutcome: 'ACKNOWLEDGED' };
    } else {
      const result = await publicClient('probeAndSend', true); assert.equal(result.ok, true); assert.equal(result.senderInvoked, true);
      assert.equal(result.acknowledgement.body.status, 'ALREADY_STORED');
      replayEvidence = { protocolOnlyCaller: true, privateCoreExecuted: false, finalIntakeStatus: 'ALREADY_STORED' };
    }
    assert.equal(sink.size, 1); assert.equal(observationEvents.length, 2); assert.equal(observationEvents[1].intakeStatus, 'ALREADY_STORED');
    assert.equal(observationEvents[0].requestBodySha256, observationEvents[1].requestBodySha256);
    assert.equal(observationEvents[1].requestBodySha256, sha(canonicalR67Json(record)));
    assert.equal(observationEvents[1].recordDigest, r67RecordDigest(record));
  });
  await check('all preflight requests exclude observations and reports retain the simulated deployment and non-database boundaries', async () => {
    assert.equal(new Set(preflightEvents.map(event => event.nonceSha256)).size, preflightEvents.length);
    assert.equal(preflightRequests, preflightEvents.length); assert.equal(observationRequests, 2); assert.equal(fixtureErrors.length, 0);
    assert.ok(preflightEvents.every(event => event.requestBytes <= 4096 && event.actualNextHandler && event.cacheControl === 'no-store'));
    for (const row of hostResults) {
      assert.equal(row.transport.remoteQaDeploymentVerified, false); assert.equal(row.transport.hostedAuthenticationCertified, false); assert.equal(row.operationalReady, false);
      assert.equal(row.lifetimeLeaseReleased, true); assert.equal(row.preflight.remoteQaDeploymentVerified, false);
    }
    assert.equal(privateCliInvocations, mode === 'ORIGINAL_PRIVATE_CORE' ? 5 : 0);
    assert.equal(hostResults.reduce((sum, row) => sum + row.capturesExecuted, 0), mode === 'ORIGINAL_PRIVATE_CORE' ? 3 : 0);
    const sanitized = JSON.stringify({ preflightEvents, observationEvents, hostResults, hostFailures, targetPins });
    for (const secret of [privateKeyPem.trim(), integrityKey]) assert.ok(!sanitized.includes(secret));
    assert.equal(acknowledgementLosses, 1); assert.equal(sink.size, 1);
  });
} catch (error) { failure = codeOf(error); console.error('FAIL ' + failure); }
finally {
  if (heldRelease) { heldRelease(); heldRelease = null; }
  for (const state of nextServers) await stopNext(state);
  for (const child of children) if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
  if (proxy) { proxy.closeAllConnections?.(); await new Promise(done => proxy.close(done)); }
  const expectedTotal = mode === 'ORIGINAL_PRIVATE_CORE' ? 8 : 7;
  const saved = [...sink.values()][0], report = { schema: 'JENIOS_R70_PREFLIGHT_ACCEPTANCE_V1', status: failure ? 'FAIL' : 'PASS',
    startedAt, finishedAt: new Date().toISOString(), sourceCommitSha: sourceCommitSha ?? null, sourceTreeDirty: sourceTreeDirty ?? null,
    githubSha: process.env.GITHUB_SHA || null, inputMode: mode,
    executableEvidence: mode === 'ORIGINAL_PRIVATE_CORE' ? 'ORIGINAL_PRIVATE_CORE_SYNTHETIC_EXECUTION' : R67_PROTOCOL_FIXTURE_KIND,
    runtime: { node: process.version }, publicImplementationDigests: publicImplementationDigests ?? {}, buildEvidence: buildEvidence ?? null,
    scope: { scopeId, sourceId, sourceKeySha256, targetPinsSha256: targetPins ? r70TargetPinsDigest(targetPins) : null,
      deploymentMetadata: 'EXPLICIT_SIMULATED_VERCEL_METADATA_NOT_A_REAL_DEPLOYMENT', targetPins: targetPins ?? null,
      preflight: 'REAL_NEXT_ROUTE_VIA_LOOPBACK_TLS_PROXY', observationReceiver: 'VOLATILE_PROTOCOL_SINK_NOT_DATABASE',
      observationHttpPathReachesNext: false, postgresExercised: false, supabaseSdkExercised: false,
      databaseAcceptanceRepeated: false, existingDatabaseCertification: 'R69_SEPARATE_CERTIFIED_ACCEPTANCE',
      originalPrivateCoreExecuted: hostResults.some(row => row.capturesExecuted === 3),
      localPrivateCustody: 'EPHEMERAL_FIXTURE_ONLY', sourceData: 'SYNTHETIC_FIXED_SCENARIOS', clock: 'REAL_UNMODIFIED_NODE_WALL_CLOCK',
      tls: 'EPHEMERAL_CA_VIA_NODE_EXTRA_CA_CERTS_AT_CHILD_STARTUP', tlsVerificationDisabled: false,
      tlsCertificateSha256: tlsCertificateSha256 ?? null, allTargetsLoopback: true, hostWideNetworkIsolationClaimed: false,
      controlPlaneQueried: false, realAdminIdentityTested: false, hostedDatabaseChanged: false, deploymentPerformed: false,
      servicesRegistered: false, r64R65PolicyInstantiated: false, ...R70_PREFLIGHT_BOUNDARIES, ...R67_INVARIANTS },
    barrierEvidence, signalEvidence, refusalEvidence, replayEvidence,
    volatileSink: { classification: 'VOLATILE_PROTOCOL_SINK_NOT_DATABASE', entries: sink.size,
      captureCount: saved?.receipt.captureCount ?? 0, recordDigest: saved?.receipt.recordDigest ?? null,
      capturedAtMs: saved?.receipt.capturedAtMs ?? null, expiresAtMs: saved?.receipt.expiresAtMs ?? null,
      databaseReceiptClaimed: false, ...R67_BINDING },
    counts: { nextProcesses: nextServers.length, privateCliInvocations, sigterms, preflightRequests,
      compatiblePreflightResponses: preflightEvents.filter(row => row.httpStatus === 200).length,
      incompatiblePreflightResponses: preflightEvents.filter(row => row.httpStatus === 409).length,
      observationRequests, acknowledgementLosses, volatileSinkEntries: sink.size,
      privateDecisionsExecuted: hostResults.reduce((sum, row) => sum + row.capturesExecuted, 0) },
    preflightEvents, observationEvents, fixtureErrors,
    privateHostSummary: hostResults.map(row => ({ status: row.status, sessionId: row.sessionId, sessionsCreated: row.sessionsCreated,
      capturesExecuted: row.capturesExecuted, ticks: row.ticks, lifetimeLeaseReleased: row.lifetimeLeaseReleased, preflight: row.preflight })),
    privateHostFailures: hostFailures.map(row => ({ status: row.status, code: row.code, operationalReady: false })),
    cases, tests: { passed: cases.filter(row => row.status === 'PASS').length, total: expectedTotal,
      failed: cases.filter(row => row.status === 'FAIL').length, notRun: expectedTotal - cases.length }, error: failure,
    credentialsOrRawCapturesInArtifact: false };
  await mkdir(artifactDirectory, { recursive: true }); await writeFile(artifactPath, JSON.stringify(report, null, 2) + '\n');
  if (temporary) await rm(temporary, { recursive: true, force: true });
  console.log(JSON.stringify({ status: report.status, inputMode: mode, passed: report.tests.passed, total: expectedTotal, artifact: artifactPath }));
  if (failure) process.exitCode = 1;
}
