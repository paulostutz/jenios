/** R69 acceptance: real Next routes and Supabase SDK over ephemeral local TLS,
 * with explicitly simulated Auth/PostgREST gateways and real disposable SQL.
 * PUBLIC_PROTOCOL_FIXTURE models signed claims and never executes private code.
 * ORIGINAL_PRIVATE_CORE requires pinned original bytes and the actual R69 CLI;
 * it never substitutes fixtures when originals are absent or invalid.
 * No hosted database, login, provider, customer, order or deployment is used.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash, generateKeyPairSync, randomBytes } from 'node:crypto';
import { request as httpRequest } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import { createServer as createTcpServer } from 'node:net';
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { R67_DATABASE_RPCS } from '../../../lib/platform/research/robot-r67-database-store.mjs';
import { R67_EVIDENCE, R67_ORIGIN, R67_BINDING, R67_INVARIANTS, canonicalR67Json,
  inspectR67StoredObservation, inspectR67IntakeAcknowledgement, r67RecordDigest,
  verifyR67PrivateObservationRecord } from '../../../lib/platform/research/robot-r67-private-protocol.mjs';
import { createR67PrivateCaptureOutbox } from '../../../lib/platform/research/robot-r67-private-capture-outbox.mjs';
import { createR67ProtocolFixture, R67_PROTOCOL_FIXTURE_KIND,
  R67_FIXTURE_SCENARIOS } from '../../../tests/fixtures/r67-private-protocol-fixture.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const mode = process.env.JENIOS_R69_INPUT_MODE;
assert.ok(['PUBLIC_PROTOCOL_FIXTURE', 'ORIGINAL_PRIVATE_CORE'].includes(mode), 'Explicit R69 input mode required');
assert.equal(process.env.JENIOS_R69_DISPOSABLE_DB, 'true', 'Explicit disposable R69 database flag required');
const url = new URL(process.env.JENIOS_R69_TEST_DATABASE_URL || 'invalid:');
assert.ok(['postgres:', 'postgresql:'].includes(url.protocol)); assert.equal(url.hostname, '127.0.0.1');
assert.equal(url.pathname, '/jenios_r69_next_qa'); assert.equal(url.username, 'postgres');
assert.equal(url.search, ''); assert.equal(url.hash, ''); assert.ok(['5432', '56469'].includes(url.port || '5432'));
assert.ok(['', 'r69-test-only'].includes(decodeURIComponent(url.password)));
assert.notEqual(process.env.VERCEL_ENV, 'production');
for (const key of ['JENIOS_REAL_EXECUTION_ENABLED', 'JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED',
  'JENIOS_PRIVATE_PAPER_EXECUTOR', 'JENIOS_ROBOT_ANALYST_PAID_ENABLED']) assert.notEqual(process.env[key], 'true');
if (mode === 'ORIGINAL_PRIVATE_CORE') assert.ok(process.env.JENIOS_R69_PRIVATE_CORE_DIR, 'Original private core required; no fixture fallback');

const artifactDirectory = resolve(process.env.ROBOT_QA_ARTIFACT_DIR || join(tmpdir(), 'jenios-r69-next-evidence'));
const artifactPath = join(artifactDirectory, 'r69-next-acceptance.json');
const startedAt = new Date().toISOString(), startedAtMs = Date.now();
const scopeId = 'scope:' + randomBytes(8).toString('hex'), sourceId = 'source:' + randomBytes(8).toString('hex');
const operationId = 'op:' + randomBytes(16).toString('hex');
const keys = generateKeyPairSync('ed25519'), privateKeyPem = keys.privateKey.export({ type: 'pkcs8', format: 'pem' });
const trustedSource = { scopeId, sourceId, enabled: true, evidenceKind: R67_EVIDENCE,
  publicKeyPem: keys.publicKey.export({ type: 'spki', format: 'pem' }) };
const sha = value => createHash('sha256').update(value).digest('hex');
const sourceKeySha256 = sha(keys.publicKey.export({ type: 'spki', format: 'der' }));
const serviceKey = 'r69-fixture-service-' + randomBytes(16).toString('hex');
const tokens = Object.fromEntries(['admin', 'member', 'anonymous', 'invalid'].map(role => [role, 'r69-explicit-fixture-' + role + '-' + randomBytes(12).toString('hex')]));
const qa = { VERCEL_ENV: 'preview', JENIOS_QA_CANDIDATE_ENABLED: 'true', JENIOS_ROBOT_QA_ENABLED: 'true',
  JENIOS_ROBOT_R67_ENABLED: 'true', JENIOS_ROBOT_R68_HOST_ENABLED: 'true', JENIOS_ROBOT_R69_HTTPS_ENABLED: 'true',
  JENIOS_ROBOT_R64_ENABLED: 'false', JENIOS_ROBOT_R65_ENABLED: 'false',
  JENIOS_REAL_EXECUTION_ENABLED: 'false', JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED: 'false',
  JENIOS_PRIVATE_PAPER_EXECUTOR: 'false', JENIOS_ROBOT_ANALYST_PAID_ENABLED: 'false' };
const intakePath = '/api/platform/robot-private-observations', adminPath = '/api/platform/admin/robot-private-observations';
const allowedRpcs = new Set(Object.values(R67_DATABASE_RPCS));
const children = new Set(), gatewayCalls = [], intakeEvents = [], hostResults = [];
const postgresEnv = { PATH: process.env.PATH || '/usr/bin:/bin', PGHOST: '127.0.0.1', PGHOSTADDR: '127.0.0.1',
  PGPORT: url.port || '5432', PGUSER: 'postgres', PGPASSWORD: decodeURIComponent(url.password),
  PGDATABASE: 'jenios_r69_next_qa', PGSSLMODE: 'disable', PGCONNECT_TIMEOUT: '5',
  PGOPTIONS: '-c statement_timeout=15000 -c lock_timeout=5000' };
let temporary, caPath, proxy, gateway, origin, gatewayOrigin, nextPort, nextChild, nextEnv;
let tlsErrors = 0, proxyRequests = 0, acknowledgementLosses = 0, nextStarts = 0, privateHostInvocations = 0;
let record, originalReceipt, privateConfig, outbox, integrityKey, finalSnapshot, adminSummary, pgVersion;
let sourceCommitSha, sourceTreeDirty, publicImplementationDigests, clockEvidence, tlsCertificateSha256, buildEvidence;
let failure = null, serverLog = '';
const cases = [
  'isolated disposable database and real Next build are selected before intake',
  'untrusted ephemeral TLS certificate is refused before any Next request or RPC',
  'anonymous real Next admin GET exposes no feed and performs no database call',
  'first signed batch reaches actual Next factory SDK and commits before its HTTPS acknowledgement is lost',
  'a new client process retransmits identical signed bytes and receives ALREADY_STORED without another batch',
  'stored signatures binding and database-clock admission preserve the complete original batch',
  'admin GET traverses actual SDK Auth and read RPC with an explicitly simulated identity',
  'member anonymous invalid and caller-selected scopes are denied without a feed RPC',
  'bad signature and non-JSON intake are rejected by actual Next before any database RPC',
  'disabled R67 gate rejects both real Next endpoints without Auth or RPC calls',
  'R67 storage stays isolated and no R64 R65 study or automatic policy is instantiated',
  'mode-specific evidence remains sanitized and every operational and financial invariant stays inactive',
].map(name => ({ name, status: 'NOT_RUN' }));
const codeOf = error => /^R(?:67|68|69)_[A-Z0-9_]+$/.test(error?.code || error?.message || '')
  ? error.code || error.message : 'R69_NEXT_ACCEPTANCE_ASSERTION_FAILED';
const pause = ms => new Promise(done => setTimeout(done, ms));
async function check(index, action) {
  try { await action(); cases[index].status = 'PASS'; console.log('PASS ' + cases[index].name); }
  catch (error) { cases[index].status = 'FAIL'; cases[index].error = codeOf(error); throw error; }
}
function osEnvironment() {
  return Object.fromEntries(['PATH', 'HOME', 'TMPDIR', 'TMP', 'TEMP', 'SystemRoot', 'LANG', 'LC_ALL', 'TZ']
    .filter(key => process.env[key] !== undefined).map(key => [key, process.env[key]]));
}
async function command(binary, args, { input = '', env = osEnvironment(), timeoutMs = 20000, allowedCodes = [0] } = {}) {
  return await new Promise((done, reject) => {
    const child = spawn(binary, args, { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] }); children.add(child);
    let stdout = '', stderr = '', problem;
    const timer = setTimeout(() => { problem = Error('R69_FIXTURE_COMMAND_TIMEOUT'); child.kill('SIGKILL'); }, timeoutMs);
    child.stdout.on('data', bytes => { stdout += bytes; if (stdout.length > 2 * 1024 * 1024) { problem = Error('R69_FIXTURE_COMMAND_LIMIT'); child.kill('SIGKILL'); } });
    child.stderr.on('data', bytes => { if (stderr.length < 32768) stderr += bytes; });
    child.once('error', () => { problem = Error('R69_FIXTURE_COMMAND_UNAVAILABLE'); });
    child.once('close', code => {
      clearTimeout(timer); children.delete(child);
      if (problem) reject(problem);
      else if (!allowedCodes.includes(code)) reject(Error(stderr.match(/R67_DATABASE_[A-Z0-9_]+/)?.[0] || 'R69_FIXTURE_COMMAND_FAILED'));
      else done({ code, stdout: stdout.trim(), stderr });
    });
    child.stdin.on('error', () => {}); child.stdin.end(input);
  });
}
const sql = async input => (await command('psql', ['-X', '-w', '-q', '-v', 'ON_ERROR_STOP=1', '-At'], { input, env: postgresEnv })).stdout;
const rows = async () => JSON.parse(await sql("SELECT coalesce(jsonb_agg(jsonb_build_object('receipt',receipt,'record',signed_record) ORDER BY event_id),'[]'::jsonb) FROM public.jenios_robot_private_captures_r67;"));
const rpcCount = () => gatewayCalls.filter(call => call.realSqlExecuted).length;
async function rpc(name, input) {
  assert.ok(allowedRpcs.has(name));
  const encoded = Buffer.from(JSON.stringify(input)).toString('base64');
  return JSON.parse(await sql(`BEGIN; SET LOCAL ROLE service_role; SELECT public.${name}(convert_from(decode('${encoded}','base64'),'UTF8')::jsonb); COMMIT;`));
}
async function readIncoming(incoming, limit = 300000) {
  let bytes = 0; const parts = [];
  for await (const part of incoming) { bytes += part.length; if (bytes > limit) throw Error('R69_FIXTURE_BODY_LIMIT'); parts.push(part); }
  return Buffer.concat(parts);
}
async function listen(server) {
  await new Promise((done, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', done); });
  return server.address().port;
}
async function certificates() {
  const keyPath = join(temporary, 'loopback.key'), certPath = join(temporary, 'loopback.pem');
  const caKey = join(temporary, 'ca.key'), csr = join(temporary, 'loopback.csr'), ext = join(temporary, 'loopback.ext');
  caPath = join(temporary, 'ca.pem');
  await command('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-sha256', '-nodes', '-days', '1',
    '-subj', '/CN=JENIOS R69 ephemeral local QA CA', '-addext', 'basicConstraints=critical,CA:TRUE',
    '-addext', 'keyUsage=critical,keyCertSign,cRLSign', '-keyout', caKey, '-out', caPath]);
  await command('openssl', ['req', '-new', '-newkey', 'rsa:2048', '-sha256', '-nodes',
    '-subj', '/CN=127.0.0.1', '-keyout', keyPath, '-out', csr]);
  await writeFile(ext, 'subjectAltName=IP:127.0.0.1\nbasicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\n');
  await command('openssl', ['x509', '-req', '-in', csr, '-CA', caPath, '-CAkey', caKey, '-CAcreateserial',
    '-out', certPath, '-days', '1', '-sha256', '-extfile', ext]);
  const cert = await readFile(certPath); tlsCertificateSha256 = sha(cert);
  return { key: await readFile(keyPath), cert, requestTimeout: 15000, headersTimeout: 5000 };
}
async function startGateway(tls) {
  gateway = createHttpsServer(tls, async (incoming, outgoing) => {
    const path = new URL(incoming.url, 'https://127.0.0.1').pathname;
    const call = { method: incoming.method, path, status: 500, realSqlExecuted: false }; gatewayCalls.push(call);
    const reply = (status, body) => { call.status = status; outgoing.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); outgoing.end(JSON.stringify(body)); };
    try {
      if (incoming.headers.apikey !== serviceKey) return reply(401, { message: 'Explicit fixture service key required' });
      const token = incoming.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
      if (path === '/auth/v1/user' && incoming.method === 'GET') {
        const role = ['admin', 'member', 'anonymous'].find(key => tokens[key] === token);
        if (!role) return reply(401, { message: 'Invalid explicit fixture token', code: 'bad_jwt' });
        return reply(200, { id: '00000000-0000-4000-8000-' + (role === 'admin' ? '000000000069' : role === 'member' ? '000000000070' : '000000000071'),
          aud: 'authenticated', role: 'authenticated', app_metadata: { platform_role: role === 'admin' ? 'admin' : 'member' },
          user_metadata: {}, is_anonymous: role === 'anonymous', created_at: '2026-10-24T00:00:00.000Z' });
      }
      if (token !== serviceKey) return reply(401, { message: 'Fixture database authorization required' });
      if (path === '/rest/v1/jenios_platform_admin_permissions' && incoming.method === 'GET') return reply(200, []);
      const name = path.match(/^\/rest\/v1\/rpc\/([a-z0-9_]+)$/)?.[1];
      if (!name || !allowedRpcs.has(name) || incoming.method !== 'POST') return reply(404, { message: 'Fixture route unavailable' });
      const body = JSON.parse((await readIncoming(incoming)).toString('utf8'));
      assert.deepEqual(Object.keys(body), ['p_input']); call.rpc = name; call.realSqlExecuted = true;
      return reply(200, await rpc(name, body.p_input));
    } catch (error) {
      const code = /^R67_DATABASE_[A-Z0-9_]+$/.test(error?.message || '') ? error.message : 'R67_DATABASE_UNAVAILABLE';
      return reply(400, { code: 'P0001', message: code, details: null, hint: null });
    }
  });
  gatewayOrigin = 'https://127.0.0.1:' + await listen(gateway);
}
async function nextRequest(path, { method = 'GET', headers = {}, body } = {}) {
  return await new Promise((done, reject) => {
    const request = httpRequest({ hostname: '127.0.0.1', port: nextPort, path, method, headers, agent: false }, response => {
      const parts = []; let bytes = 0;
      response.on('data', chunk => { bytes += chunk.length; if (bytes > 524288) request.destroy(Error('R69_FIXTURE_NEXT_LIMIT')); else parts.push(chunk); });
      response.once('end', () => done({ status: response.statusCode, headers: response.headers, body: Buffer.concat(parts) }));
      response.once('error', reject);
    });
    request.setTimeout(10000, () => request.destroy(Error('R69_FIXTURE_NEXT_TIMEOUT')));
    request.once('error', reject); request.end(body);
  });
}
async function startProxy(tls) {
  proxy = createHttpsServer(tls, async (incoming, outgoing) => {
    proxyRequests++;
    try {
      const path = new URL(incoming.url, 'https://127.0.0.1');
      if (![intakePath, adminPath].includes(path.pathname)) { outgoing.writeHead(404); outgoing.end(); return; }
      const body = await readIncoming(incoming);
      const headers = { 'Content-Length': String(body.length) };
      for (const key of ['content-type', 'authorization']) if (incoming.headers[key]) headers[key] = incoming.headers[key];
      const result = await nextRequest(path.pathname + path.search, { method: incoming.method, headers, body });
      if (path.pathname === intakePath && incoming.method === 'POST') {
        const ack = JSON.parse(result.body.toString('utf8'));
        intakeEvents.push({ requestBodySha256: sha(body), bytes: body.length, httpStatus: result.status,
          intakeStatus: ack.status ?? null, recordDigest: ack.recordDigest ?? null, observedAtMs: Date.now() });
        if (result.status === 202 && ack.status === 'STORED' && acknowledgementLosses === 0) {
          acknowledgementLosses++; incoming.socket.destroy(); return;
        }
      }
      outgoing.writeHead(result.status, { 'Content-Type': result.headers['content-type'] || 'application/json', 'Cache-Control': 'no-store' });
      outgoing.end(result.body);
    } catch { if (!outgoing.destroyed) { outgoing.writeHead(502, { 'Content-Type': 'application/json' }); outgoing.end('{"error":"Explicit local proxy failure"}'); } }
  });
  proxy.on('tlsClientError', () => { tlsErrors++; });
  origin = 'https://127.0.0.1:' + await listen(proxy);
}
async function stopNext() {
  const current = nextChild; if (!current) return;
  if (current.child.exitCode === null && current.child.signalCode === null) {
    current.child.kill('SIGTERM'); const timer = setTimeout(() => current.child.kill('SIGKILL'), 5000);
    try { await current.closed; } finally { clearTimeout(timer); }
  }
  if (nextChild === current) nextChild = null;
}
async function startNext(overrides = {}) {
  await stopNext();
  const child = spawn(process.execPath, [join(root, 'node_modules/next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', String(nextPort)],
    { cwd: root, env: { ...nextEnv, ...overrides }, stdio: ['ignore', 'pipe', 'pipe'] });
  children.add(child); nextStarts++;
  const state = { child, error: null, closed: new Promise(done => child.once('close', () => { children.delete(child); done(); })) };
  nextChild = state; child.once('error', () => { state.error = Error('R69_FIXTURE_NEXT_UNAVAILABLE'); });
  for (const stream of [child.stdout, child.stderr]) stream.on('data', bytes => { if (serverLog.length < 262144) serverLog += bytes; });
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    if (state.error) throw state.error;
    if (child.exitCode !== null || child.signalCode !== null) throw Error('R69_FIXTURE_NEXT_EARLY_EXIT');
    try { const result = await nextRequest(adminPath); if ([401, 404].includes(result.status)) return; } catch { /* Bounded startup only. */ }
    await pause(100);
  }
  throw Error('R69_FIXTURE_NEXT_START_TIMEOUT');
}
async function client(input, trusted = true) {
  const env = { ...osEnvironment(), NEXT_TELEMETRY_DISABLED: '1' }; if (trusted) env.NODE_EXTRA_CA_CERTS = caPath;
  const result = await command(process.execPath, [join(root, 'tests/fixtures/r69-next-client.mjs')], {
    input: JSON.stringify({ ...input, origin }), env, allowedCodes: [0, 2], timeoutMs: 12000 });
  return JSON.parse(result.stdout);
}
async function privateOnce() {
  privateHostInvocations++;
  const run = await command(process.execPath, ['--experimental-vm-modules', join(root, 'scripts/platform/research/r69-private-host.mjs'), '--once', '--config', privateConfig],
    { env: { ...osEnvironment(), ...qa, NODE_EXTRA_CA_CERTS: caPath, NEXT_TELEMETRY_DISABLED: '1' }, allowedCodes: [0, 1, 2], timeoutMs: 20000 });
  const reports = run.stdout.split('\n').filter(Boolean).map(line => JSON.parse(line));
  const result = reports.findLast(row => row.schema === 'JENIOS_R69_PRIVATE_HOST_RESULT_V1');
  assert.ok(result, 'Actual private CLI must return a host result'); hostResults.push(result);
  for (const secret of [privateKeyPem.trim(), integrityKey, serviceKey, ...Object.values(tokens)]) assert.ok(!run.stdout.includes(secret));
  return { code: run.code, result };
}
async function configurePrivateHost() {
  integrityKey = randomBytes(32).toString('hex');
  const outboxDirectory = join(temporary, 'outbox'), privateKeyFile = join(temporary, 'source.pem');
  const hmacKeyFile = join(temporary, 'integrity.txt'), commandsFile = join(temporary, 'commands.json');
  await mkdir(outboxDirectory, { mode: 0o700 });
  await writeFile(privateKeyFile, privateKeyPem, { mode: 0o600 }); await writeFile(hmacKeyFile, integrityKey + '\n', { mode: 0o600 });
  await writeFile(commandsFile, JSON.stringify({ schema: 'JENIOS_R68_PRIVATE_HOST_COMMANDS_V1',
    commands: [{ operationId, scenarios: R67_FIXTURE_SCENARIOS }] }), { mode: 0o600 });
  privateConfig = join(temporary, 'host.json');
  await writeFile(privateConfig, JSON.stringify({ schema: 'JENIOS_R69_PRIVATE_HOST_CONFIG_V1',
    coreDirectory: resolve(process.env.JENIOS_R69_PRIVATE_CORE_DIR), outboxDirectory, privateKeyFile, hmacKeyFile,
    commandsFile, scopeId, sourceId, sourceKeySha256, origin }), { mode: 0o600 });
  outbox = createR67PrivateCaptureOutbox({ directory: outboxDirectory, key: integrityKey, trustedSource });
}

try {
  await check(0, async () => {
    await mkdir(artifactDirectory, { recursive: true }); temporary = await mkdtemp(join(tmpdir(), 'jenios-r69-next-')); await chmod(temporary, 0o700);
    sourceCommitSha = (await command('git', ['rev-parse', 'HEAD'])).stdout;
    sourceTreeDirty = (await command('git', ['status', '--porcelain', '--untracked-files=all'])).stdout !== '';
    assert.match(sourceCommitSha, /^[a-f0-9]{40}$/);
    if (process.env.GITHUB_SHA) assert.equal(process.env.GITHUB_SHA, sourceCommitSha);
    const files = ['scripts/platform/research/r69-next-acceptance.mjs', 'tests/fixtures/r69-next-client.mjs',
      'tests/fixtures/r67-private-protocol-fixture.mjs', 'lib/platform/research/robot-r69-https-transport.mjs',
      'lib/platform/research/robot-r69-private-host.mjs', 'scripts/platform/research/r69-private-host.mjs',
      'lib/platform/research/robot-r68-private-host.mjs', 'lib/platform/research/robot-r67-private-core-loader.mjs',
      'lib/platform/research/robot-r67-private-source.mjs', 'lib/platform/research/robot-r67-private-protocol.mjs',
      'lib/platform/research/robot-r67-private-capture-outbox.mjs', 'lib/platform/research/robot-r67-durable-emitter.mjs',
      'lib/platform/research/robot-r67-http.mjs', 'lib/platform/research/robot-r67-runtime.mjs',
      'lib/platform/research/robot-r67-database-store.mjs', 'lib/platform/admin-db.mjs', 'lib/platform/admin-permissions.mjs',
      'app/api/platform/robot-private-observations/route.js', 'app/api/platform/admin/robot-private-observations/route.js',
      'db/schema/robot-r67-private-capture-store.sql'];
    publicImplementationDigests = Object.fromEntries(await Promise.all(files.map(async path => [path, sha(await readFile(join(root, path)))])));
    const buildId = (await readFile(join(root, '.next/BUILD_ID'), 'utf8')).trim();
    assert.ok(buildId, 'A real Next production build is required');
    const compiledRoutes = ['.next/server/app/api/platform/robot-private-observations/route.js',
      '.next/server/app/api/platform/admin/robot-private-observations/route.js'];
    buildEvidence = { buildId, nextVersion: JSON.parse(await readFile(join(root, 'node_modules/next/package.json'), 'utf8')).version,
      supabaseSdkVersion: JSON.parse(await readFile(join(root, 'node_modules/@supabase/supabase-js/package.json'), 'utf8')).version,
      compiledRouteSha256: Object.fromEntries(await Promise.all(compiledRoutes.map(async path => [path, sha(await readFile(join(root, path)))]))),
      selectedBuild: 'EXISTING_BUILD_PROVIDED_BEFORE_ACCEPTANCE', compiledSourceCommitIndependentlyAttested: false };
    assert.equal(await sql('SELECT current_database();'), 'jenios_r69_next_qa'); pgVersion = await sql('SHOW server_version;');
    assert.equal(await sql("SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'jenios_robot_%';"), '0', 'The dedicated acceptance database must start empty');
    await sql("DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF; IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF; IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role BYPASSRLS; END IF; END $$; GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role;");
    await sql(await readFile(join(root, 'db/schema/robot-r67-private-capture-store.sql'), 'utf8'));
    const before = Date.now(), databaseNowMs = Number(await sql('SELECT floor(extract(epoch FROM clock_timestamp())*1000)::bigint;')), after = Date.now();
    assert.ok(databaseNowMs >= before - 100 && databaseNowMs <= after + 100); clockEvidence = { nodeBeforeMs: before, databaseNowMs, nodeAfterMs: after, manipulatedClock: false };
    const tls = await certificates(); await startGateway(tls);
    const socket = createTcpServer(); nextPort = await listen(socket); await new Promise(done => socket.close(done));
    nextEnv = { ...osEnvironment(), ...qa, NEXT_TELEMETRY_DISABLED: '1', NODE_EXTRA_CA_CERTS: caPath,
      PLATFORM_SUPABASE_URL: gatewayOrigin, PLATFORM_SUPABASE_SERVICE_ROLE_KEY: serviceKey, PLATFORM_ADMIN_USER_IDS: '',
      JENIOS_ROBOT_R67_SCOPE_ID: scopeId, JENIOS_ROBOT_R67_SOURCE_ID: sourceId, JENIOS_ROBOT_R67_SOURCE_PUBLIC_KEY: trustedSource.publicKeyPem };
    await startNext(); await startProxy(tls);
    if (mode === 'ORIGINAL_PRIVATE_CORE') await configurePrivateHost();
    assert.equal(rpcCount(), 0); assert.equal((await rows()).length, 0);
  });
  await check(1, async () => {
    const before = proxyRequests; const response = await client({ action: 'request', path: adminPath }, false);
    assert.equal(response.ok, false); assert.equal(proxyRequests, before); assert.equal(rpcCount(), 0); assert.ok(tlsErrors >= 1);
  });
  await check(2, async () => {
    const before = gatewayCalls.length, response = await client({ action: 'request', path: adminPath });
    assert.equal(response.status, 401); assert.equal(response.cacheControl, 'no-store');
    assert.equal(Object.hasOwn(response.body, 'observations'), false); assert.equal(gatewayCalls.length, before);
  });
  await check(3, async () => {
    if (mode === 'PUBLIC_PROTOCOL_FIXTURE') {
      const fixture = await createR67ProtocolFixture({ privateKeyPem, scopeId, sourceId, operationId, sessionId: 'session:' + randomBytes(8).toString('hex') });
      assert.equal(fixture.fixtureEvidence, R67_PROTOCOL_FIXTURE_KIND); record = fixture.record;
      const response = await client({ action: 'send', record, trustedSource }); assert.equal(response.ok, false);
    } else {
      const run = await privateOnce(); assert.equal(run.code, 2); assert.equal(run.result.status, 'DELIVERY_UNCONFIRMED');
      assert.equal(run.result.capturesExecuted, 3); const snapshot = outbox.read(); assert.equal(snapshot.entries.length, 1);
      assert.equal(snapshot.entries[0].attempts.at(-1).outcome, 'UNCERTAIN'); record = snapshot.entries[0].record;
    }
    assert.equal(acknowledgementLosses, 1); assert.equal(intakeEvents.length, 1); assert.equal(intakeEvents[0].httpStatus, 202);
    const saved = await rows(); assert.equal(saved.length, 1); assert.deepEqual(saved[0].record, record); originalReceipt = saved[0].receipt;
    assert.equal(gatewayCalls.filter(call => call.rpc === R67_DATABASE_RPCS.ingest && call.realSqlExecuted && call.status === 200).length, 1);
  });
  await check(4, async () => {
    if (mode === 'PUBLIC_PROTOCOL_FIXTURE') {
      const response = await client({ action: 'send', record, trustedSource }); assert.equal(response.ok, true);
      assert.equal(response.status, 200); assert.equal(response.body.status, 'ALREADY_STORED');
      inspectR67IntakeAcknowledgement(response.body, record, response.status);
    } else {
      const run = await privateOnce(); assert.equal(run.code, 0); assert.equal(run.result.status, 'ONCE_COMPLETE');
      assert.equal(run.result.capturesExecuted, 0); finalSnapshot = outbox.read(); assert.equal(finalSnapshot.entries.length, 1);
      assert.equal(finalSnapshot.entries[0].attempts.length, 2); assert.equal(finalSnapshot.entries[0].attempts.at(-1).outcome, 'ACKNOWLEDGED');
      assert.equal(finalSnapshot.entries[0].attempts.at(-1).ack.body.status, 'ALREADY_STORED');
      assert.deepEqual(finalSnapshot.entries[0].record, record); assert.notEqual(hostResults[0].sessionId, hostResults[1].sessionId);
    }
    assert.equal(intakeEvents.length, 2); assert.equal(intakeEvents[1].httpStatus, 200); assert.equal(intakeEvents[1].intakeStatus, 'ALREADY_STORED');
    assert.equal(intakeEvents[0].requestBodySha256, intakeEvents[1].requestBodySha256);
    assert.equal(intakeEvents[0].requestBodySha256, sha(canonicalR67Json(record)));
    const saved = await rows(); assert.equal(saved.length, 1); assert.deepEqual(saved[0].receipt, originalReceipt);
    assert.deepEqual(saved[0].record, record); assert.equal(acknowledgementLosses, 1);
  });
  await check(5, async () => {
    const saved = (await rows())[0], inspected = inspectR67StoredObservation(saved);
    verifyR67PrivateObservationRecord(saved.record, { trustedSource, nowMs: saved.receipt.capturedAtMs });
    assert.equal(inspected.receipt.recordDigest, r67RecordDigest(record)); assert.equal(inspected.receipt.captureCount, 3);
    assert.deepEqual(inspected.receipt.counts, { manual: 1, hybrid: 1, reverse: 1 }); assert.equal(inspected.receipt.sourceKeySha256, sourceKeySha256);
    assert.ok(inspected.receipt.admittedAtMs >= inspected.receipt.capturedAtMs && inspected.receipt.admittedAtMs < inspected.receipt.expiresAtMs);
    assert.equal(inspected.receipt.expiresAtMs - inspected.receipt.capturedAtMs, 120000);
    assert.ok(inspected.receipt.capturedAtMs >= startedAtMs && inspected.receipt.admittedAtMs <= Date.now());
    if (mode === 'PUBLIC_PROTOCOL_FIXTURE') assert.deepEqual(record.envelope.payload.capture.entries.map(entry => entry.action),
      ['manual_preview', 'wait_for_confluence', 'reverse_not_calibrated']);
  });
  await check(6, async () => {
    const before = gatewayCalls.length, response = await client({ action: 'request', path: adminPath, token: tokens.admin });
    assert.equal(response.status, 200); assert.equal(response.body.schema, 'JENIOS_R67_PRIVATE_ADMIN_FEED_V1');
    assert.equal(response.body.scopeId, scopeId); assert.equal(response.body.sourceId, sourceId);
    assert.equal(response.body.returnedBatches, 1); assert.equal(response.body.returnedCaptures, 3);
    assert.equal(response.body.observations[0].recordDigest, originalReceipt.recordDigest);
    assert.equal(response.body.currentPrivateHostIndependentlyObserved, false);
    for (const [key, value] of Object.entries(R67_INVARIANTS)) assert.deepEqual(response.body[key], value);
    const calls = gatewayCalls.slice(before); assert.equal(calls.filter(call => call.path === '/auth/v1/user' && call.status === 200).length, 1);
    assert.equal(calls.filter(call => call.rpc === R67_DATABASE_RPCS.read && call.status === 200 && call.realSqlExecuted).length, 1);
    adminSummary = { returnedBatches: response.body.returnedBatches, returnedCaptures: response.body.returnedCaptures,
      adminOnly: response.body.adminOnly, configuredSourceSignaturesCheckedAtIntake: response.body.configuredSourceSignaturesCheckedAtIntake,
      currentPrivateHostIndependentlyObserved: false, fixtureAuthOnly: true };
  });
  await check(7, async () => {
    const before = rpcCount();
    for (const [role, status] of [['member', 403], ['anonymous', 401], ['invalid', 401]]) {
      const response = await client({ action: 'request', path: adminPath, token: tokens[role] }); assert.equal(response.status, status);
      assert.equal(Object.hasOwn(response.body, 'observations'), false);
    }
    const calls = gatewayCalls.length, response = await client({ action: 'request', path: adminPath + '?scopeId=caller-cannot-select', token: tokens.admin });
    assert.equal(response.status, 400); assert.equal(gatewayCalls.length, calls); assert.equal(rpcCount(), before);
  });
  await check(8, async () => {
    const before = gatewayCalls.length, bad = structuredClone(record); bad.envelope.signatureBase64 = Buffer.alloc(64).toString('base64');
    const signature = await client({ action: 'request', method: 'POST', path: intakePath, body: bad }); assert.equal(signature.status, 400);
    const contentType = await client({ action: 'request', method: 'POST', path: intakePath, body: record, contentType: 'text/plain' }); assert.equal(contentType.status, 415);
    assert.equal(gatewayCalls.length, before); assert.equal((await rows()).length, 1);
  });
  await check(9, async () => {
    await startNext({ JENIOS_ROBOT_R67_ENABLED: 'false' }); const before = gatewayCalls.length;
    const intake = await client({ action: 'request', method: 'POST', path: intakePath, body: record }); assert.equal(intake.status, 404);
    const admin = await client({ action: 'request', path: adminPath, token: tokens.admin }); assert.equal(admin.status, 404);
    assert.equal(gatewayCalls.length, before); assert.equal((await rows()).length, 1);
  });
  await check(10, async () => {
    const tables = JSON.parse(await sql("SELECT coalesce(jsonb_agg(table_name ORDER BY table_name),'[]'::jsonb) FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'jenios_robot_%';"));
    assert.deepEqual(tables, ['jenios_robot_private_captures_r67']);
    assert.ok(gatewayCalls.filter(call => call.realSqlExecuted).every(call => allowedRpcs.has(call.rpc)));
    assert.equal(gatewayCalls.filter(call => call.rpc === R67_DATABASE_RPCS.ingest).length, 2);
    assert.equal(gatewayCalls.filter(call => call.rpc === R67_DATABASE_RPCS.read).length, 1);
    assert.equal(qa.JENIOS_ROBOT_R64_ENABLED, 'false'); assert.equal(qa.JENIOS_ROBOT_R65_ENABLED, 'false');
  });
  await check(11, async () => {
    assert.equal(privateHostInvocations, mode === 'ORIGINAL_PRIVATE_CORE' ? 2 : 0);
    if (mode === 'ORIGINAL_PRIVATE_CORE') {
      assert.equal(hostResults.reduce((sum, result) => sum + result.capturesExecuted, 0), 3);
      for (const result of hostResults) {
        assert.equal(result.lifetimeLeaseReleased, true); assert.equal(result.transport.profile, 'R69_FIXED_HTTPS');
        assert.equal(result.transport.remoteQaDeploymentVerified, false); assert.equal(result.transport.hostedAuthenticationCertified, false);
        assert.equal(result.customerMonitoringActive, false); assert.equal(result.privateOperationalSourceActive, false);
        assert.equal(result.realOrdersSent, 0); assert.equal(result.externalPaperOrdersSent, 0); assert.equal(result.paidProviderCalls, 0);
      }
    }
    const sanitized = JSON.stringify({ gatewayCalls, intakeEvents, hostResults, adminSummary });
    for (const secret of [privateKeyPem.trim(), serviceKey, ...Object.values(tokens), ...(integrityKey ? [integrityKey] : [])]) assert.ok(!sanitized.includes(secret));
    assert.equal(acknowledgementLosses, 1); assert.equal(nextStarts, 2); assert.ok(tlsErrors >= 1);
  });
} catch (error) { failure = codeOf(error); console.error('FAIL ' + failure); }
finally {
  await stopNext();
  for (const child of children) if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
  for (const server of [proxy, gateway]) if (server) { server.closeAllConnections?.(); await new Promise(done => server.close(done)); }
  const completed = cases.filter(row => row.status === 'PASS').length;
  const report = { schema: 'JENIOS_R69_NEXT_ACCEPTANCE_V1', status: failure ? 'FAIL' : 'PASS', startedAt, finishedAt: new Date().toISOString(),
    sourceCommitSha: sourceCommitSha ?? null, sourceTreeDirty: sourceTreeDirty ?? null, githubSha: process.env.GITHUB_SHA || null,
    inputMode: mode, executableEvidence: mode === 'ORIGINAL_PRIVATE_CORE' ? 'ORIGINAL_PRIVATE_CORE_SYNTHETIC_EXECUTION' : R67_PROTOCOL_FIXTURE_KIND,
    runtime: { node: process.version, postgres: pgVersion ?? null }, buildEvidence: buildEvidence ?? null,
    publicImplementationDigests: publicImplementationDigests ?? {},
    scope: { scopeId, sourceId, sourceKeySha256, transportEvidence: R67_EVIDENCE, recordOriginClaim: R67_ORIGIN,
      originalPrivateCoreExecuted: mode === 'ORIGINAL_PRIVATE_CORE' && hostResults.some(row => row.capturesExecuted === 3),
      configuredSourceSignatureIsIndependentRuntimeAttestation: false, inputData: 'SYNTHETIC_FIXED_SCENARIOS',
      next: 'REAL_NEXT_START_EXISTING_BUILD', nextFactory: 'EXISTING_CREATE_R67_RUNTIME_AND_PLATFORM_SUPABASE_SDK',
      auth: 'EXPLICIT_LOCAL_AUTH_GATEWAY_FIXTURE_USERS_NOT_REAL_SUPABASE_IDENTITIES',
      postgrest: 'EXPLICIT_LOOPBACK_HTTPS_RPC_GATEWAY_TO_REAL_DISPOSABLE_POSTGRESQL',
      databaseName: 'jenios_r69_next_qa', databaseRole: 'service_role', scopeIsolation: 'EXPLICIT_SERVER_CONFIG_NOT_SERVICE_ROLE_RLS',
      networkTargets: 'LOOPBACK_ONLY_NO_HOST_WIDE_NETWORK_SANDBOX_ASSERTION', tls: 'EPHEMERAL_CA_VIA_NODE_EXTRA_CA_CERTS_AT_CHILD_STARTUP',
      tlsVerificationDisabled: false, tlsCertificateSha256: tlsCertificateSha256 ?? null,
      nextOrigin: nextPort ? 'http://127.0.0.1:' + nextPort : null, intakeOrigin: origin ?? null, gatewayOrigin: gatewayOrigin ?? null,
      clock: 'REAL_NODE_DATE_NOW_AND_UNMODIFIED_POSTGRESQL_CLOCK_TIMESTAMP', clockEvidence: clockEvidence ?? null,
      deployedCommitVerified: false, productionDeploymentTested: false, realAdminIdentityTested: false,
      realProviderConnectionTested: false, hostedDatabaseChanged: false, servicesRegistered: false,
      r64R65PolicyInstantiated: false, automaticUltraPolicyChanged: false, ...R67_INVARIANTS },
    admitted: originalReceipt ? { batches: 1, captures: originalReceipt.captureCount, counts: originalReceipt.counts,
      capturedAtMs: originalReceipt.capturedAtMs, admittedAtMs: originalReceipt.admittedAtMs, expiresAtMs: originalReceipt.expiresAtMs,
      eventId: originalReceipt.eventId, sessionId: originalReceipt.sessionId, recordDigest: originalReceipt.recordDigest,
      payloadDigest: originalReceipt.payloadDigest, provenanceDigest: originalReceipt.provenanceDigest, ...R67_BINDING } : null,
    counts: { nextStarts, privateHostInvocations, acknowledgementLosses, observedTlsRejections: tlsErrors,
      realSqlCalls: rpcCount(), originalPrivateDecisionsExecuted: hostResults.reduce((sum, row) => sum + row.capturesExecuted, 0),
      batchesStored: originalReceipt ? 1 : 0, exactSuccessfulRetries: intakeEvents.filter(row => row.intakeStatus === 'ALREADY_STORED').length },
    adminSummary: adminSummary ?? null, gatewayCalls, intakeEvents,
    privateHostSummary: hostResults.map(row => ({ status: row.status, sessionId: row.sessionId, capturesExecuted: row.capturesExecuted,
      sessionsCreated: row.sessionsCreated, ticks: row.ticks, lifetimeLeaseReleased: row.lifetimeLeaseReleased, transport: row.transport })),
    cases, tests: { passed: completed, total: cases.length, failed: cases.filter(row => row.status === 'FAIL').length,
      notRun: cases.filter(row => row.status === 'NOT_RUN').length }, error: failure, credentialsOrRawFeedPersisted: false };
  await mkdir(artifactDirectory, { recursive: true }); await writeFile(artifactPath, JSON.stringify(report, null, 2) + '\n');
  if (temporary) await rm(temporary, { recursive: true, force: true });
  console.log(JSON.stringify({ status: report.status, inputMode: mode, passed: completed, total: cases.length, artifact: artifactPath }));
  if (failure) process.exitCode = 1;
}
