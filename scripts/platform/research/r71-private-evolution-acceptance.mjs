/** R71 focused local integration. Actual Next routes and Supabase SDK use an
 * explicitly simulated loopback Auth/PostgREST gateway and real disposable PG.
 * Private mode executes pinned original bytes; public mode models protocol
 * claims. Neither mode certifies hosted identities, customer activity or PnL.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash, generateKeyPairSync, randomBytes } from 'node:crypto';
import { request as httpRequest } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import { createServer as createTcpServer } from 'node:net';
import { createInterface } from 'node:readline';
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { R71_DATABASE_RPCS } from '../../../lib/platform/research/robot-r71-database-store.mjs';
import { R71_BOUNDARIES, canonicalR71Json } from '../../../lib/platform/research/robot-r71-policy.mjs';
import { verifyR71PrivateObservationRecord, inspectR71StoredObservation, r71RecordDigest } from '../../../lib/platform/research/robot-r71-private-protocol.mjs';
import { R67_EVIDENCE, R67_BINDING, r67SourceKeyDigest, canonicalR67Json } from '../../../lib/platform/research/robot-r67-private-protocol.mjs';
import { requireR71AdminFeed } from '../../../lib/platform/research/robot-r71-admin-view.mjs';
import { R71_FIXTURE_SCENARIOS, R71_FIXTURE_POSITION_CONTEXTS, R71_PROTOCOL_FIXTURE_KIND } from '../../../tests/fixtures/r71-private-protocol-fixture.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url)), mode = process.env.JENIOS_R71_INPUT_MODE;
assert.ok(['PUBLIC_PROTOCOL_FIXTURE', 'ORIGINAL_PRIVATE_CORE'].includes(mode), 'Explicit R71 input mode required');
assert.equal(process.env.JENIOS_R71_DISPOSABLE_DB, 'true', 'Explicit disposable database flag required');
const database = new URL(process.env.JENIOS_R71_EVOLUTION_TEST_DATABASE_URL || 'invalid:');
assert.ok(['postgres:', 'postgresql:'].includes(database.protocol)); assert.equal(database.hostname, '127.0.0.1');
assert.equal(database.pathname, '/jenios_r71_evolution_qa'); assert.equal(database.username, 'postgres');
assert.equal(database.search, ''); assert.equal(database.hash, ''); assert.ok(['5432', '56471'].includes(database.port || '5432'));
assert.ok(['', 'r71-test-only'].includes(decodeURIComponent(database.password)));
assert.notEqual(process.env.VERCEL_ENV, 'production');
for (const key of ['JENIOS_REAL_EXECUTION_ENABLED', 'JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED', 'JENIOS_PRIVATE_PAPER_EXECUTOR',
  'JENIOS_ROBOT_ANALYST_PAID_ENABLED']) assert.notEqual(process.env[key], 'true');
if (mode === 'ORIGINAL_PRIVATE_CORE') assert.ok(process.env.JENIOS_R71_PRIVATE_CORE_DIR, 'Original core required; no fallback');
const artifactDirectory = resolve(process.env.ROBOT_QA_ARTIFACT_DIR || join(tmpdir(), 'jenios-r71-private-evolution-evidence'));
const artifactPath = join(artifactDirectory, 'r71-private-evolution-acceptance.json');
const startedAt = new Date().toISOString(), sha = value => createHash('sha256').update(value).digest('hex');
const operation = () => 'op:' + randomBytes(16).toString('hex');
const intakePath = '/api/platform/robot-private-policy-observations', adminPath = '/api/platform/admin/robot-private-evolution';
const statePath = '/api/platform/robot-private-evolution-state', schedulerPath = '/api/platform/internal/robot-private-evolution';
const preflightPath = '/api/platform/robot-private-target-preflight', pagePath = '/platform/homologacao/robos/privado';
const allowedRpcs = new Set(Object.values(R71_DATABASE_RPCS));
const qa = { VERCEL_ENV: 'preview', VERCEL_TARGET_ENV: 'preview', JENIOS_QA_CANDIDATE_ENABLED: 'true',
  JENIOS_ROBOT_QA_ENABLED: 'true', JENIOS_ROBOT_R67_ENABLED: 'true', JENIOS_ROBOT_R71_ENABLED: 'true',
  JENIOS_ROBOT_R70_PREFLIGHT_ENABLED: 'true', JENIOS_ROBOT_R68_HOST_ENABLED: 'true', JENIOS_ROBOT_R69_HTTPS_ENABLED: 'true',
  JENIOS_ROBOT_R64_ENABLED: 'false', JENIOS_ROBOT_R65_ENABLED: 'false', JENIOS_ROBOT_ANALYST_PAID_ENABLED: 'false',
  JENIOS_REAL_EXECUTION_ENABLED: 'false', JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED: 'false', JENIOS_PRIVATE_PAPER_EXECUTOR: 'false' };
const postgresEnv = { PATH: process.env.PATH || '/usr/bin:/bin', PGHOST: '127.0.0.1', PGHOSTADDR: '127.0.0.1',
  PGPORT: database.port || '5432', PGUSER: 'postgres', PGPASSWORD: decodeURIComponent(database.password),
  PGDATABASE: 'jenios_r71_evolution_qa', PGSSLMODE: 'disable', PGCONNECT_TIMEOUT: '5',
  PGOPTIONS: '-c statement_timeout=20000 -c lock_timeout=5000' };
const serviceKey = 'r71-explicit-fixture-service-' + randomBytes(16).toString('hex');
const tokens = Object.fromEntries(['admin', 'member', 'anonymous', 'invalid'].map(role => [role, 'r71-explicit-fixture-' + role + '-' + randomBytes(12).toString('hex')]));
const schedulerToken = 'r71-explicit-fixture-scheduler-' + randomBytes(16).toString('hex');
const children = new Set(), gatewayCalls = [], intakeEvents = [], sourceReports = [];
let temporary, caPath, gateway, proxy, origin, gatewayOrigin, nextPort, nextEnv, nextProcess, currentSource;
let browser, browserContext, page, browserEvidence = null, failure = null, pgVersion, nextStarts = 0, sourceStarts = 0;
let acknowledgementsLost = 0, tlsCertificateSha256, sourceCommitSha, sourceTreeDirty, implementationDigests, buildEvidence, clockEvidence;
let mainIdentity, missingIdentity, initialRecord, initialNative, appliedFeed, finalFeed, missingFeed, finalCounts, validationEvidence;
const cases = [
  'isolated PostgreSQL and an actual R71 Next build are selected with ephemeral TLS',
  'anonymous and nonadministrative identities cannot read or initialize the private cycle',
  'explicit administrative tick initializes state while source queries remain separately signed and scoped',
  'baseline contextual capture reaches Next SDK and commits before its HTTPS acknowledgement is lost',
  'a restarted source retransmits the same signed record without new private decisions',
  'the complete contextual study freezes membership and registers eight cases before their real window',
  'the actual source produces eight signed validation cases inside the PostgreSQL clock window',
  'the worker durably applies the bounded candidate after complete measured improvement',
  'the same source instance consumes generation one and changes only assisted open position routing',
  'stale administrative CAS is refused and the real browser shell exposes no anonymous feed',
  'the authenticated browser reads actual Next state and performs a durable administrative rollback',
  'the same source consumes rollback generation two and cannot reapply the retired candidate',
  'a separate history that misses the registered window is rejected without invented cases',
  'disabled routes perform no Auth or SQL and original records plus inactive boundaries remain intact',
].map(name => ({ name, status: 'NOT_RUN' }));
const codeOf = error => /^R(?:67|68|69|70|71)_[A-Z0-9_]+$/.test(error?.code || error?.message || '')
  ? error.code || error.message : 'R71_EVOLUTION_ACCEPTANCE_ASSERTION';
const pause = ms => new Promise(done => setTimeout(done, ms));
async function check(index, action) {
  try { await action(); cases[index].status = 'PASS'; console.log('PASS ' + cases[index].name); }
  catch (error) { cases[index].status = 'FAIL'; cases[index].code = codeOf(error); throw error; }
}
function osEnvironment() {
  return Object.fromEntries(['PATH', 'HOME', 'TMPDIR', 'TMP', 'TEMP', 'SystemRoot', 'LANG', 'LC_ALL', 'TZ']
    .filter(k => process.env[k] !== undefined).map(k => [k, process.env[k]]));
}
async function command(binary, args, { input = '', env = osEnvironment(), allowedCodes = [0], timeoutMs = 25000 } = {}) {
  return await new Promise((done, reject) => {
    const child = spawn(binary, args, { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] }); children.add(child);
    let stdout = '', stderr = '', problem;
    const timer = setTimeout(() => { problem = Error('R71_FIXTURE_COMMAND_TIMEOUT'); child.kill('SIGKILL'); }, timeoutMs);
    child.stdout.on('data', bytes => { stdout += bytes; if (stdout.length > 8 * 1024 * 1024) { problem = Error('R71_FIXTURE_COMMAND_LIMIT'); child.kill('SIGKILL'); } });
    child.stderr.on('data', bytes => { if (stderr.length < 65536) stderr += bytes; });
    child.once('error', () => { problem = Error('R71_FIXTURE_COMMAND_UNAVAILABLE'); });
    child.once('close', code => {
      clearTimeout(timer); children.delete(child);
      if (problem) reject(problem);
      else if (!allowedCodes.includes(code)) reject(Error(stderr.match(/R(?:67|71)_DATABASE_[A-Z0-9_]+/)?.[0] || 'R71_FIXTURE_COMMAND_FAILED'));
      else done({ code, stdout: stdout.trim() });
    }); child.stdin.on('error', () => {}); child.stdin.end(input);
  });
}
const sql = async query => (await command('psql', ['-X', '-w', '-q', '-v', 'ON_ERROR_STOP=1', '-At'], { input: query, env: postgresEnv })).stdout;
const sqlJson = async query => JSON.parse(await sql(query));
async function rpc(name, input) {
  assert.ok(allowedRpcs.has(name)); const encoded = Buffer.from(JSON.stringify(input)).toString('base64');
  return sqlJson(`BEGIN; SET LOCAL ROLE service_role; SELECT public.${name}(convert_from(decode('${encoded}','base64'),'UTF8')::jsonb); COMMIT;`);
}
const sourceWhere = s => `scope_id='${s.trustedSource.scopeId}' AND source_id='${s.trustedSource.sourceId}'`;
const observations = s => sqlJson(`SELECT coalesce(jsonb_agg(jsonb_build_object('receipt',receipt,'record',signed_record) ORDER BY captured_at_ms,event_id),'[]'::jsonb) FROM public.jenios_robot_private_observations_r71 WHERE ${sourceWhere(s)};`);
const rpcCount = () => gatewayCalls.filter(c => c.realSqlExecuted).length;
async function readIncoming(request, limit = 1048576) {
  const parts = []; let length = 0;
  for await (const part of request) { length += part.length; if (length > limit) throw Error('R71_FIXTURE_BODY_LIMIT'); parts.push(part); }
  return Buffer.concat(parts);
}
async function listen(server) {
  await new Promise((done, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', done); });
  return server.address().port;
}
async function certificates() {
  const keyPath = join(temporary, 'loopback.key'), certPath = join(temporary, 'loopback.pem'), caKey = join(temporary, 'ca.key');
  const csr = join(temporary, 'loopback.csr'), ext = join(temporary, 'loopback.ext'); caPath = join(temporary, 'ca.pem');
  await command('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-sha256', '-nodes', '-days', '1', '-subj',
    '/CN=JENIOS R71 local fixture CA', '-addext', 'basicConstraints=critical,CA:TRUE', '-addext',
    'keyUsage=critical,keyCertSign,cRLSign', '-keyout', caKey, '-out', caPath]);
  await command('openssl', ['req', '-new', '-newkey', 'rsa:2048', '-sha256', '-nodes', '-subj', '/CN=127.0.0.1', '-keyout', keyPath, '-out', csr]);
  await writeFile(ext, 'subjectAltName=IP:127.0.0.1\nbasicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\n');
  await command('openssl', ['x509', '-req', '-in', csr, '-CA', caPath, '-CAkey', caKey, '-CAcreateserial',
    '-out', certPath, '-days', '1', '-sha256', '-extfile', ext]);
  const cert = await readFile(certPath); tlsCertificateSha256 = sha(cert);
  return { key: await readFile(keyPath), cert, requestTimeout: 20000, headersTimeout: 5000 };
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
        const role = ['admin', 'member', 'anonymous'].find(r => tokens[r] === token);
        if (!role) return reply(401, { message: 'Invalid explicit fixture token', code: 'bad_jwt' });
        return reply(200, { id: '00000000-0000-4000-8000-' + (role === 'admin' ? '000000000071' : role === 'member' ? '000000000072' : '000000000073'),
          aud: 'authenticated', role: 'authenticated', app_metadata: { platform_role: role === 'admin' ? 'admin' : 'member' },
          user_metadata: { platform_role: 'admin' }, is_anonymous: role === 'anonymous', created_at: '2026-10-24T00:00:00.000Z' });
      }
      if (token !== serviceKey) return reply(401, { message: 'Fixture database authorization required' });
      if (path === '/rest/v1/jenios_platform_admin_permissions' && incoming.method === 'GET')
        return reply(200, [{ permission: 'platform.reports' }, { permission: 'platform.admin' }]);
      const name = path.match(/^\/rest\/v1\/rpc\/([a-z0-9_]+)$/)?.[1];
      if (!name || !allowedRpcs.has(name) || incoming.method !== 'POST') return reply(404, { message: 'Fixture route unavailable' });
      const body = JSON.parse((await readIncoming(incoming, 8 * 1024 * 1024)).toString('utf8'));
      assert.deepEqual(Object.keys(body), ['p_input']); call.rpc = name; call.realSqlExecuted = true;
      return reply(200, await rpc(name, body.p_input));
    } catch (error) {
      const code = /^R(?:67|71)_DATABASE_[A-Z0-9_]+$/.test(error?.message || '') ? error.message : 'R71_DATABASE_UNAVAILABLE';
      return reply(400, { code: 'P0001', message: code, details: null, hint: null });
    }
  }); gatewayOrigin = 'https://127.0.0.1:' + await listen(gateway);
}
async function nextRequest(path, { method = 'GET', headers = {}, body } = {}) {
  return await new Promise((done, reject) => {
    const request = httpRequest({ hostname: '127.0.0.1', port: nextPort, path, method, headers, agent: false }, response => {
      const parts = []; let size = 0;
      response.on('data', part => { size += part.length; if (size > 2 * 1024 * 1024) request.destroy(Error('R71_FIXTURE_NEXT_LIMIT')); else parts.push(part); });
      response.once('end', () => done({ status: response.statusCode, headers: response.headers, body: Buffer.concat(parts) })); response.once('error', reject);
    }); request.setTimeout(15000, () => request.destroy(Error('R71_FIXTURE_NEXT_TIMEOUT'))); request.once('error', reject); request.end(body);
  });
}
async function startProxy(tls) {
  proxy = createHttpsServer(tls, async (incoming, outgoing) => {
    try {
      const url = new URL(incoming.url, 'https://127.0.0.1');
      if (![adminPath, intakePath, statePath, preflightPath, schedulerPath].includes(url.pathname)) { outgoing.writeHead(404); outgoing.end(); return; }
      const body = await readIncoming(incoming), headers = { 'Content-Length': String(body.length) };
      for (const key of ['content-type', 'authorization', 'origin']) if (incoming.headers[key]) headers[key] = incoming.headers[key];
      const result = await nextRequest(url.pathname + url.search, { method: incoming.method, headers, body });
      if (url.pathname === intakePath && incoming.method === 'POST') {
        const ack = JSON.parse(result.body.toString('utf8'));
        intakeEvents.push({ requestBodySha256: sha(body), bytes: body.length, httpStatus: result.status,
          status: ack.status ?? null, recordDigest: ack.recordDigest ?? null, observedAtMs: Date.now() });
        if (result.status === 202 && ack.status === 'STORED' && acknowledgementsLost === 0) {
          acknowledgementsLost++; incoming.socket.destroy(); return;
        }
      }
      outgoing.writeHead(result.status, { 'Content-Type': result.headers['content-type'] || 'application/json', 'Cache-Control': 'no-store' }); outgoing.end(result.body);
    } catch { if (!outgoing.destroyed) { outgoing.writeHead(502, { 'Content-Type': 'application/json' }); outgoing.end('{"error":"Explicit local gateway failure"}'); } }
  }); origin = 'https://127.0.0.1:' + await listen(proxy);
}
async function stopNext() {
  const p = nextProcess; if (!p) return;
  if (p.child.exitCode === null && p.child.signalCode === null) {
    p.child.kill('SIGTERM'); const timer = setTimeout(() => p.child.kill('SIGKILL'), 5000);
    try { await p.closed; } finally { clearTimeout(timer); }
  } nextProcess = null;
}
async function startNext(identity, overrides = {}) {
  await stopNext();
  const env = { ...nextEnv, JENIOS_ROBOT_R67_SCOPE_ID: identity.trustedSource.scopeId,
    JENIOS_ROBOT_R67_SOURCE_ID: identity.trustedSource.sourceId, JENIOS_ROBOT_R67_SOURCE_PUBLIC_KEY: identity.trustedSource.publicKeyPem, ...overrides };
  const child = spawn(process.execPath, [join(root, 'node_modules/next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', String(nextPort)],
    { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] }); children.add(child); nextStarts++;
  const p = { child, closed: new Promise(done => child.once('close', () => { children.delete(child); done(); })) }; nextProcess = p;
  let failed = false; child.once('error', () => { failed = true; });
  // Drain process output; it is not evidence of identity and is never published.
  child.stdout.on('data', () => {}); child.stderr.on('data', () => {});
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    if (failed || child.exitCode !== null || child.signalCode !== null) throw Error('R71_FIXTURE_NEXT_EARLY_EXIT');
    try { const r = await nextRequest(adminPath); if ([401, 404].includes(r.status)) return; } catch { /* Bounded startup. */ }
    await pause(100);
  } throw Error('R71_FIXTURE_NEXT_START_TIMEOUT');
}
async function request(path, { method = 'GET', body, token = tokens.admin, originHeader, contentType } = {}) {
  const r = await command(process.execPath, [join(root, 'tests/fixtures/r71-evolution-client.mjs')], {
    input: JSON.stringify({ origin, path, method, body, token, originHeader: originHeader ?? (method === 'POST' ? 'http://127.0.0.1:' + nextPort : undefined), contentType }),
    env: { ...osEnvironment(), NODE_EXTRA_CA_CERTS: caPath }, allowedCodes: [0, 2], timeoutMs: 20000 });
  return JSON.parse(r.stdout);
}
async function admin(action) {
  const r = await request(adminPath, action ? { method: 'POST', body: action } : {});
  assert.equal(r.ok, true); assert.equal(r.status, 200, 'R71 admin HTTP ' + r.status + ' ' + JSON.stringify(r.body));
  return action ? r.body : requireR71AdminFeed(r.body);
}
async function makeIdentity(name) {
  const keys = generateKeyPairSync('ed25519'), privateKeyPem = keys.privateKey.export({ type: 'pkcs8', format: 'pem' });
  const trustedSource = { scopeId: 'scope:' + randomBytes(8).toString('hex'), sourceId: 'source:' + randomBytes(8).toString('hex'),
    enabled: true, evidenceKind: R67_EVIDENCE, publicKeyPem: keys.publicKey.export({ type: 'spki', format: 'pem' }) };
  const directory = join(temporary, name); await mkdir(directory, { mode: 0o700 });
  return { trustedSource, privateKeyPem, directory, key: randomBytes(32).toString('hex'),
    targetPins: { schema: 'JENIOS_R70_TARGET_PINS_V1', origin, projectId: 'prj_R71FixtureOnly', deploymentId: 'dpl_R71FixtureOnly',
      commitSha: '71'.repeat(20), scopeId: trustedSource.scopeId, sourceId: trustedSource.sourceId, sourceKeySha256: r67SourceKeyDigest(trustedSource) } };
}
async function startSource(identity) {
  const args = [...(mode === 'ORIGINAL_PRIVATE_CORE' ? ['--experimental-vm-modules'] : []), join(root, 'tests/fixtures/r71-evolution-client.mjs'), '--source-session'];
  const child = spawn(process.execPath, args, { cwd: root, env: { ...osEnvironment(), ...qa, NODE_EXTRA_CA_CERTS: caPath }, stdio: ['pipe', 'pipe', 'pipe'] });
  children.add(child); sourceStarts++; let requestId = 0, waiting = null;
  const closed = new Promise(done => child.once('close', () => { children.delete(child); if (waiting) waiting.reject(Error('R71_FIXTURE_SOURCE_CLOSED')); done(); }));
  const lines = createInterface({ input: child.stdout, crlfDelay: Infinity }); child.stderr.on('data', () => {});
  lines.on('line', line => {
    if (!waiting) return;
    try { const response = JSON.parse(line); if (response.requestId !== waiting.id) throw Error('R71_FIXTURE_SOURCE_RESPONSE');
      const w = waiting; waiting = null; clearTimeout(w.timer); if (!response.ok) w.reject(Error(response.code)); else w.done(response.result);
    } catch (error) { const w = waiting; waiting = null; if (w) { clearTimeout(w.timer); w.reject(error); } }
  });
  const call = command => new Promise((done, reject) => {
    assert.equal(waiting, null); const id = ++requestId;
    const timer = setTimeout(() => { waiting = null; reject(Error('R71_FIXTURE_SOURCE_TIMEOUT')); child.kill('SIGKILL'); }, 20000);
    waiting = { id, done, reject, timer }; child.stdin.write(JSON.stringify({ requestId: id, ...command }) + '\n');
  });
  const value = { child, closed, call, identity, async stop() {
    if (child.exitCode === null && child.signalCode === null) {
      try { sourceReports.push(await call({ action: 'stop' })); child.stdin.end(); await closed; }
      catch { child.kill('SIGTERM'); await closed; }
    }
  } }; currentSource = value;
  await call({ action: 'initialize', config: { ...identity, mode, origin,
    ...(mode === 'ORIGINAL_PRIVATE_CORE' ? { coreDirectory: resolve(process.env.JENIOS_R71_PRIVATE_CORE_DIR) } : {}) } });
  return value;
}
async function capture(source, operationId = operation()) {
  return source.call({ action: 'capture', operationId, scenarios: R71_FIXTURE_SCENARIOS, positionContexts: R71_FIXTURE_POSITION_CONTEXTS });
}
async function waitUntil(time) { while (Date.now() < time) await pause(Math.min(250, time - Date.now())); }

async function startBrowser() {
  const modulePath = process.env.JENIOS_ROBOT_QA_PLAYWRIGHT_MODULE;
  assert.ok(modulePath && isAbsolute(modulePath), 'Absolute pinned Playwright module path required');
  const pkg = JSON.parse(await readFile(join(dirname(modulePath), 'package.json'), 'utf8'));
  assert.equal(pkg.version, '1.56.1'); assert.ok(['@playwright/test', 'playwright'].includes(pkg.name));
  const playwright = await import(pathToFileURL(modulePath).href);
  browser = await playwright.chromium.launch({ headless: true, timeout: 30000 });
  browserContext = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
  const browserOrigin = 'http://127.0.0.1:' + nextPort;
  browserEvidence = { identity: 'EXPLICIT_LOCAL_AUTH_SESSION_FIXTURE', realIdentityVerified: false,
    adminFeedInjected: false, browserOriginTransport: 'HTTP_LITERAL_LOOPBACK', backendGatewayTlsVerified: true,
    playwright: pkg.version, chromium: browser.version(), adminReads: 0, adminMutations: 0,
    blockedRequests: 0, webSockets: 0, pageErrors: [], consoleErrors: [] };
  await browserContext.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin === browserOrigin && url.pathname === adminPath && !url.search &&
        ['GET', 'POST'].includes(request.method()) && request.headers().authorization === 'Bearer ' + tokens.admin) {
      browserEvidence[request.method() === 'GET' ? 'adminReads' : 'adminMutations']++;
      await route.continue(); return;
    }
    if (url.origin !== browserOrigin || url.pathname.startsWith('/api/') || !['GET', 'HEAD'].includes(request.method())) {
      browserEvidence.blockedRequests++; await route.abort('blockedbyclient'); return;
    }
    await route.continue();
  });
  await browserContext.routeWebSocket(/.*/, async socket => { browserEvidence.webSockets++; await socket.close(); });
  page = await browserContext.newPage(); page.setDefaultTimeout(10000);
  page.on('pageerror', error => browserEvidence.pageErrors.push(String(error.message).slice(0, 500)));
  page.on('console', message => { if (message.type() === 'error') browserEvidence.consoleErrors.push(message.text().slice(0, 500)); });
  return { expect: playwright.expect.configure({ timeout: 10000 }), browserOrigin };
}
let browserTools, baselineOperation;
try {
  await check(0, async () => {
    await mkdir(artifactDirectory, { recursive: true }); temporary = await mkdtemp(join(tmpdir(), 'jenios-r71-evolution-')); await chmod(temporary, 0o700);
    sourceCommitSha = (await command('git', ['rev-parse', 'HEAD'])).stdout;
    sourceTreeDirty = (await command('git', ['status', '--porcelain', '--untracked-files=all'])).stdout !== '';
    assert.match(sourceCommitSha, /^[a-f0-9]{40}$/); if (process.env.GITHUB_SHA) assert.equal(process.env.GITHUB_SHA, sourceCommitSha);
    const paths = ['scripts/platform/research/r71-private-evolution-acceptance.mjs', 'tests/fixtures/r71-evolution-client.mjs',
      'tests/fixtures/r71-private-protocol-fixture.mjs', 'lib/platform/research/robot-r71-policy.mjs',
      'lib/platform/research/robot-r71-private-protocol.mjs', 'lib/platform/research/robot-r71-private-source.mjs',
      'lib/platform/research/robot-r71-private-capture-outbox.mjs', 'lib/platform/research/robot-r71-durable-emitter.mjs',
      'lib/platform/research/robot-r71-https-transport.mjs', 'lib/platform/research/robot-r71-private-study.mjs',
      'lib/platform/research/robot-r71-evolution-engine.mjs', 'lib/platform/research/robot-r71-cycle-worker.mjs',
      'lib/platform/research/robot-r71-hypothesis-contract.mjs', 'lib/platform/research/robot-r71-database-store.mjs',
      'lib/platform/research/robot-r71-access.mjs', 'lib/platform/research/robot-r71-http.mjs', 'lib/platform/research/robot-r71-runtime.mjs',
      'lib/platform/research/robot-r71-admin-view.mjs', 'lib/platform/research/robot-r67-private-core-loader.mjs',
      'lib/platform/research/robot-r67-private-protocol.mjs', 'lib/platform/research/robot-private-durable-file.mjs',
      'lib/platform/admin-db.mjs', 'lib/platform/admin-permissions.mjs',
      'app/api/platform/robot-private-policy-observations/route.js', 'app/api/platform/robot-private-evolution-state/route.js',
      'app/api/platform/admin/robot-private-evolution/route.js', 'app/api/platform/internal/robot-private-evolution/route.js',
      'app/components/platform/PlatformRobotPrivateEvolutionAdmin.js', 'app/components/platform/PlatformRobotPrivateEvolutionReport.js',
      'app/platform/homologacao/robos/privado/page.js', 'db/schema/robot-r71-private-evolution-store.sql'];
    implementationDigests = Object.fromEntries(await Promise.all(paths.map(async p => [p, sha(await readFile(join(root, p)))])));
    const routes = ['.next/server/app/api/platform/robot-private-policy-observations/route.js',
      '.next/server/app/api/platform/robot-private-evolution-state/route.js',
      '.next/server/app/api/platform/admin/robot-private-evolution/route.js',
      '.next/server/app/api/platform/internal/robot-private-evolution/route.js',
      '.next/server/app/platform/homologacao/robos/privado/page.js'];
    buildEvidence = { buildId: (await readFile(join(root, '.next/BUILD_ID'), 'utf8')).trim(),
      nextVersion: JSON.parse(await readFile(join(root, 'node_modules/next/package.json'), 'utf8')).version,
      supabaseSdkVersion: JSON.parse(await readFile(join(root, 'node_modules/@supabase/supabase-js/package.json'), 'utf8')).version,
      selectedBuild: 'EXISTING_BUILD_PROVIDED_BEFORE_ACCEPTANCE', compiledSourceCommitIndependentlyAttested: false,
      compiledRouteSha256: Object.fromEntries(await Promise.all(routes.map(async p => [p, sha(await readFile(join(root, p)))]))) };
    assert.ok(buildEvidence.buildId); assert.equal(await sql('SELECT current_database();'), 'jenios_r71_evolution_qa');
    pgVersion = await sql('SHOW server_version;');
    assert.equal(await sql("SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'jenios_robot_%';"), '0', 'Acceptance database must start empty');
    await sql("DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF; IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF; IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role BYPASSRLS; END IF; END $$; GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role;");
    for (const schema of ['robot-r67-private-capture-store.sql', 'robot-r71-private-evolution-store.sql']) await sql(await readFile(join(root, 'db/schema', schema), 'utf8'));
    const before = Date.now(), databaseNowMs = Number(await sql('SELECT floor(extract(epoch FROM clock_timestamp())*1000)::bigint;')), after = Date.now();
    assert.ok(databaseNowMs >= before - 100 && databaseNowMs <= after + 100); clockEvidence = { nodeBeforeMs: before, databaseNowMs, nodeAfterMs: after, manipulatedClock: false };
    const tls = await certificates(); await startGateway(tls); await startProxy(tls);
    const socket = createTcpServer(); nextPort = await listen(socket); await new Promise(done => socket.close(done));
    nextEnv = { ...osEnvironment(), ...qa, NEXT_TELEMETRY_DISABLED: '1', NODE_EXTRA_CA_CERTS: caPath,
      PLATFORM_SUPABASE_URL: gatewayOrigin, PLATFORM_SUPABASE_SERVICE_ROLE_KEY: serviceKey, PLATFORM_ADMIN_USER_IDS: '',
      VERCEL_PROJECT_ID: 'prj_R71FixtureOnly', VERCEL_DEPLOYMENT_ID: 'dpl_R71FixtureOnly', VERCEL_GIT_COMMIT_SHA: '71'.repeat(20),
      VERCEL_URL: new URL(origin).host, JENIOS_ROBOT_R71_ADMIN_ORIGIN: 'http://127.0.0.1:' + nextPort,
      JENIOS_ROBOT_R71_SCHEDULER_TOKEN: schedulerToken };
    mainIdentity = await makeIdentity('main-outbox'); missingIdentity = await makeIdentity('missing-window-outbox');
    await startNext(mainIdentity);
  });
  await check(1, async () => {
    const before = rpcCount();
    for (const [token, expected] of [[null, 401], [tokens.member, 403], [tokens.anonymous, 401], [tokens.invalid, 401]]) {
      const r = await request(adminPath, { token }); assert.equal(r.status, expected);
      assert.equal(Object.hasOwn(r.body, 'state'), false);
    }
    assert.equal(rpcCount(), before);
    assert.equal(await sql('SELECT count(*) FROM public.jenios_robot_private_evolution_r71;'), '0');
    const r = await request(statePath, { method: 'POST', body: { schema: 'JENIOS_R70_SIGNED_PREFLIGHT_REQUEST_V1' }, token: null });
    assert.equal(r.status, 401); assert.equal(rpcCount(), before);
  });
  await check(2, async () => {
    const tick = await admin({ action: 'TICK' }); assert.equal(tick.result.status, 'WAITING_CONTEXTUAL_OBSERVATIONS');
    const feed = await admin(); assert.equal(feed.state.activeVersion.forwardPositionOpen, false); assert.equal(feed.state.activeVersion.activationGeneration, 0);
    await startSource(mainIdentity);
    const read = await currentSource.call({ action: 'view' }); assert.equal(read.runtimeView.scopeId, mainIdentity.trustedSource.scopeId);
    assert.equal(read.runtimeView.activeVersion.forwardPositionOpen, false);
    assert.ok(gatewayCalls.some(c => c.rpc === R71_DATABASE_RPCS.readState && c.realSqlExecuted));
  });
  await check(3, async () => {
    baselineOperation = operation(); const captured = await capture(currentSource, baselineOperation);
    assert.equal(captured.capture.entryCount, 8); assert.equal(captured.capture.changedEntries, 0);
    assert.equal(captured.nativeAnalysesCompleted, mode === 'ORIGINAL_PRIVATE_CORE' ? 8 : 0);
    const flush = await currentSource.call({ action: 'flush' }); assert.equal(flush.delivery.unconfirmed, 1); assert.equal(acknowledgementsLost, 1);
    const rows = await observations(mainIdentity); assert.equal(rows.length, 1); initialRecord = rows[0];
    assert.equal(initialRecord.receipt.recordDigest, captured.capture.recordDigest);
    inspectR71StoredObservation(initialRecord);
    initialNative = await sqlJson(`SELECT jsonb_build_object('receipt',receipt,'record',signed_record) FROM public.jenios_robot_private_captures_r67 WHERE scope_id='${mainIdentity.trustedSource.scopeId}';`);
    assert.ok(canonicalR67Json(initialNative.record) === canonicalR67Json(initialRecord.record.originalRecord), 'Native record must be stored unchanged');
    assert.equal(intakeEvents[0].httpStatus, 202);
  });
  await check(4, async () => {
    await currentSource.stop(); await startSource(mainIdentity);
    const replay = await capture(currentSource, baselineOperation); assert.equal(replay.capture.recordDigest, initialRecord.receipt.recordDigest);
    assert.equal(replay.nativeAnalysesCompleted, 0); assert.equal(replay.modeledCaptures, 0);
    const flush = await currentSource.call({ action: 'flush' }); assert.equal(flush.delivery.acknowledged, 1);
    assert.equal(intakeEvents[1].httpStatus, 200); assert.equal(intakeEvents[1].status, 'ALREADY_STORED');
    assert.equal(intakeEvents[0].requestBodySha256, intakeEvents[1].requestBodySha256);
    const rows = await observations(mainIdentity); assert.equal(rows.length, 1);
    assert.ok(canonicalR71Json(rows[0]) === canonicalR71Json(initialRecord), 'Retry preserves the full signed record and first receipt');
  });
  let plan;
  await check(5, async () => {
    const tick = await admin({ action: 'TICK' }); assert.equal(tick.result.status, 'EVALUATION_REGISTERED');
    const feed = await admin(); plan = feed.state.pendingEvaluation;
    assert.ok(plan); assert.equal(plan.caseCount, 8); assert.equal(plan.capturedCases, 0);
    assert.equal(feed.state.latestStudy.metrics.observationEntries, 8);
    assert.equal(feed.state.latestStudy.metrics.baselineMissedExistingPositionRouting, 3);
    assert.equal(feed.state.latestStudy.hypothesis.source, 'BOUNDED_DETERMINISTIC_POLICY');
    assert.equal(plan.startsAtMs - plan.registeredAtMs, 1000);
    const stored = await sqlJson(`SELECT jsonb_build_object('state',state,'storedAtMs',stored_at_ms) FROM public.jenios_robot_private_evolution_r71 WHERE ${sourceWhere(mainIdentity)} ORDER BY revision DESC LIMIT 1;`);
    assert.ok(stored.storedAtMs < plan.startsAtMs); assert.equal(stored.state.pendingEvaluation.planId, plan.planId);
  });
  await check(6, async () => {
    await waitUntil(plan.startsAtMs + 100);
    const captured = await currentSource.call({ action: 'validate', operationId: operation(), planId: plan.planId });
    assert.equal(captured.capture.entryCount, 8); assert.equal(captured.capture.changedEntries, 3);
    const flush = await currentSource.call({ action: 'flush' }); assert.equal(flush.delivery.acknowledged, 1);
    const rows = await sqlJson(`SELECT coalesce(jsonb_agg(jsonb_build_object('caseId',case_id,'capturedAtMs',validation_case->'capturedAtMs','admittedAtMs',validation_case->'admittedAtMs') ORDER BY case_id),'[]'::jsonb) FROM public.jenios_robot_private_validation_cases_r71 WHERE ${sourceWhere(mainIdentity)};`);
    assert.equal(rows.length, 8); assert.equal(new Set(rows.map(r => r.caseId)).size, 8);
    for (const row of rows) for (const key of ['capturedAtMs', 'admittedAtMs']) assert.ok(row[key] >= plan.startsAtMs && row[key] < plan.endsAtMs);
    validationEvidence = { planId: plan.planId, registeredAtMs: plan.registeredAtMs, startsAtMs: plan.startsAtMs, endsAtMs: plan.endsAtMs, cases: rows, casesOutsideWindow: 0 };
  });
  await check(7, async () => {
    await waitUntil(plan.endsAtMs + 20); const tick = await admin({ action: 'TICK' }); assert.equal(tick.result.status, 'APPLIED');
    appliedFeed = await admin(); const e = appliedFeed.state.lastEvaluation;
    assert.equal(appliedFeed.state.activeVersion.activationGeneration, 1); assert.equal(appliedFeed.state.activeVersion.forwardPositionOpen, true);
    assert.equal(e.summary.observedCases, 8); assert.equal(e.summary.baselineMissedExistingPositionRouting, 3);
    assert.equal(e.summary.candidateMissedExistingPositionRouting, 0); assert.equal(e.summary.protectedCaseChanges, 0);
    assert.equal(e.summary.unsupportedCandidateOutcomes, 0); assert.equal(appliedFeed.state.promotions, 1);
  });
  let candidateSession;
  await check(8, async () => {
    const captured = await capture(currentSource); candidateSession = captured.sessionId;
    assert.equal(captured.capture.wrapperVersion.activationGeneration, 1); assert.equal(captured.capture.wrapperVersion.forwardPositionOpen, true);
    assert.equal(captured.capture.changedEntries, 3); assert.equal((await currentSource.call({ action: 'flush' })).delivery.acknowledged, 1);
    const rows = await observations(mainIdentity), last = rows.at(-1);
    assert.equal(last.receipt.purpose, 'OBSERVATION'); assert.equal(last.record.originalRecord.provenance.generation, 0);
    assert.equal(last.record.originalRecord.provenance.policyVersion, 'private:r67-v1');
    const protectedEntries = last.record.annotation.entries.filter((_, i) =>
      R71_FIXTURE_SCENARIOS[i].mode === 'manual' || !R71_FIXTURE_POSITION_CONTEXTS[i].positionOpen || R71_FIXTURE_SCENARIOS[i].paused);
    assert.ok(protectedEntries.every(e => e.nativeDecisionDigest === e.effectiveDecisionDigest));
  });
  await check(9, async () => {
    const before = await sql(`SELECT count(*) FROM public.jenios_robot_private_evolution_r71 WHERE ${sourceWhere(mainIdentity)};`);
    const r = await request(adminPath, { method: 'POST', body: { action: 'ROLLBACK', operationId: operation(),
      expectedRevision: appliedFeed.state.revision - 1, previousDigest: appliedFeed.state.stateDigest, reason: 'OWNER_REQUEST' } });
    assert.equal(r.status, 409); assert.equal(await sql(`SELECT count(*) FROM public.jenios_robot_private_evolution_r71 WHERE ${sourceWhere(mainIdentity)};`), before);
    browserTools = await startBrowser();
    const response = await page.goto(browserTools.browserOrigin + pagePath, { waitUntil: 'networkidle' }); assert.equal(response.status(), 200);
    const html = await response.text(); assert.ok(!html.includes(mainIdentity.trustedSource.scopeId));
    assert.ok(!html.includes(appliedFeed.state.stateDigest)); assert.ok(!html.includes('data-testid="r71-private-report"'));
    await browserTools.expect(page.getByTestId('r71-private-report')).toHaveCount(0);
    await browserTools.expect(page.getByText('Entre com uma conta administrativa da Platform para consultar a evolução privada de QA.')).toBeVisible();
    assert.equal(browserEvidence.adminReads, 0);
  });
  await check(10, async () => {
    const { expect, browserOrigin } = browserTools;
    await page.evaluate(({ token, userId }) => localStorage.setItem('jenios-platform-auth-v1', JSON.stringify({
      access_token: token, refresh_token: 'r71-explicit-fixture-no-refresh', token_type: 'bearer',
      expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id: userId, aud: 'authenticated', role: 'authenticated', app_metadata: { platform_role: 'admin' },
        user_metadata: {}, is_anonymous: false, created_at: '2026-10-24T00:00:00.000Z' },
    })), { token: tokens.admin, userId: '00000000-0000-4000-8000-000000000071' });
    const loaded = page.waitForResponse(r => r.url() === browserOrigin + adminPath && r.request().method() === 'GET');
    await page.reload({ waitUntil: 'networkidle' }); assert.equal((await loaded).status(), 200);
    await expect(page.getByTestId('r71-active-version')).toHaveText('private:r71-position-context-v1');
    await expect(page.getByTestId('r71-routing-comparison')).toHaveText('3 → 0');
    await expect(page.getByTestId('r71-original-core-version')).toHaveText('jenios-research-r29.1');
    const rolled = page.waitForResponse(r => r.url() === browserOrigin + adminPath && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Restaurar política privada de referência' }).click();
    const rollbackResponse = await rolled; assert.equal(rollbackResponse.status(), 200);
    assert.equal((await rollbackResponse.json()).result.status, 'ROLLED_BACK');
    await expect(page.getByTestId('r71-generation')).toHaveText('2');
    await expect(page.getByTestId('r71-active-version')).toHaveText('private:r71-reference-v1');
    await expect(page.getByTestId('r71-history')).toContainText('Reversão concluída');
    await page.setViewportSize({ width: 320, height: 900 });
    const dimensions = await page.evaluate(() => ({ width: innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
    assert.ok(dimensions.document <= 320 && dimensions.body <= 320); browserEvidence.mobile = dimensions;
    await page.screenshot({ path: join(artifactDirectory, 'r71-private-evolution-mobile.png'), fullPage: true });
    browserEvidence.rollbackViaActualEndpoint = true;
    // This is an explicit local sign-out event, not a claim about a real user.
    await page.evaluate(() => {
      localStorage.removeItem('jenios-platform-auth-v1');
      const channel = new BroadcastChannel('jenios-platform-auth-v1'); channel.postMessage({ event: 'SIGNED_OUT', session: null }); channel.close();
    });
    await expect(page.getByTestId('r71-private-report')).toHaveCount(0);
    assert.equal(browserEvidence.blockedRequests, 0); assert.equal(browserEvidence.webSockets, 0);
    assert.deepEqual(browserEvidence.pageErrors, []); assert.deepEqual(browserEvidence.consoleErrors, []);
    await browser.close(); browser = null; page = null; browserContext = null;
  });
  await check(11, async () => {
    finalFeed = await admin(); assert.equal(finalFeed.state.activeVersion.activationGeneration, 2);
    assert.equal(finalFeed.state.activeVersion.forwardPositionOpen, false); assert.equal(finalFeed.state.candidateRetired, true);
    const captured = await capture(currentSource); assert.equal(captured.sessionId, candidateSession);
    assert.equal(captured.capture.wrapperVersion.activationGeneration, 2); assert.equal(captured.capture.changedEntries, 0);
    assert.equal((await currentSource.call({ action: 'flush' })).delivery.acknowledged, 1);
    assert.equal((await admin({ action: 'TICK' })).result.status, 'NO_NEW_AUTHORIZED_CANDIDATE');
    assert.equal(await sql(`SELECT actor_id FROM public.jenios_robot_private_evolution_r71 WHERE ${sourceWhere(mainIdentity)} ORDER BY revision DESC LIMIT 1;`), 'user:00000000-0000-4000-8000-000000000071');
    const nowRows = await observations(mainIdentity); assert.equal(nowRows.length, 4);
    assert.ok(canonicalR71Json(nowRows[0]) === canonicalR71Json(initialRecord), 'First contextual pair remains unchanged after rollback');
    await currentSource.stop(); currentSource = null;
  });
  await check(12, async () => {
    await startNext(missingIdentity); assert.equal((await admin({ action: 'TICK' })).result.status, 'WAITING_CONTEXTUAL_OBSERVATIONS');
    await startSource(missingIdentity); await capture(currentSource);
    assert.equal((await currentSource.call({ action: 'flush' })).delivery.acknowledged, 1);
    assert.equal((await admin({ action: 'TICK' })).result.status, 'EVALUATION_REGISTERED');
    const missingPlan = (await admin()).state.pendingEvaluation; await waitUntil(missingPlan.endsAtMs + 20);
    assert.equal((await admin({ action: 'TICK' })).result.status, 'REJECTED_INCOMPLETE');
    missingFeed = await admin(); assert.equal(missingFeed.state.lastEvaluation.summary.observedCases, 0);
    assert.equal(missingFeed.state.lastEvaluation.summary.candidateMissedExistingPositionRouting, null);
    assert.equal(missingFeed.state.activeVersion.forwardPositionOpen, false); assert.equal(missingFeed.state.candidateRetired, true);
    assert.equal(await sql(`SELECT count(*) FROM public.jenios_robot_private_validation_cases_r71 WHERE ${sourceWhere(missingIdentity)};`), '0');
    await currentSource.stop(); currentSource = null;
  });
  await check(13, async () => {
    await startNext(mainIdentity, { JENIOS_ROBOT_R71_ENABLED: 'false' }); const before = gatewayCalls.length;
    for (const [path, method, body, token] of [[adminPath, 'GET', undefined, tokens.admin], [intakePath, 'POST', initialRecord.record, null],
      [statePath, 'POST', {}, null], [schedulerPath, 'POST', undefined, schedulerToken]]) {
      const r = await request(path, { method, body, token }); assert.equal(r.status, 404);
    }
    assert.equal(gatewayCalls.length, before);
    const native = await sqlJson(`SELECT jsonb_build_object('receipt',receipt,'record',signed_record) FROM public.jenios_robot_private_captures_r67 WHERE scope_id='${mainIdentity.trustedSource.scopeId}' AND event_id='${initialNative.receipt.eventId}';`);
    assert.ok(canonicalR67Json(native) === canonicalR67Json(initialNative), 'R67 original is immutable across contextual evolution');
    for (const identity of [mainIdentity, missingIdentity]) for (const row of await observations(identity)) {
      const checked = verifyR71PrivateObservationRecord(row.record, { trustedSource: identity.trustedSource, nowMs: row.receipt.admittedAtMs });
      assert.equal(checked.receipt.recordDigest, row.receipt.recordDigest);
      assert.equal(row.record.originalRecord.provenance.policyVersion, 'private:r67-v1');
      assert.equal(row.record.originalRecord.provenance.generation, 0);
    }
    finalCounts = await sqlJson("SELECT jsonb_build_object('nativeBatches',(SELECT count(*) FROM public.jenios_robot_private_captures_r67),'contextualBatches',(SELECT count(*) FROM public.jenios_robot_private_observations_r71),'contextualDecisions',(SELECT sum(entry_count) FROM public.jenios_robot_private_observations_r71),'validationCases',(SELECT count(*) FROM public.jenios_robot_private_validation_cases_r71),'historyRevisions',(SELECT count(*) FROM public.jenios_robot_private_evolution_r71),'snapshots',(SELECT count(*) FROM public.jenios_robot_private_studies_r71));");
    assert.equal(finalCounts.nativeBatches, 5); assert.equal(finalCounts.contextualBatches, 5); assert.equal(finalCounts.contextualDecisions, 40); assert.equal(finalCounts.validationCases, 8);
    for (const [key, value] of Object.entries(R71_BOUNDARIES)) { assert.equal(finalFeed[key], value); assert.equal(missingFeed[key], value); }
    assert.equal(await sql("SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name ~ '^jenios_robot_.*r(64|65)$';"), '0');
    for (const [path, digest] of Object.entries(implementationDigests)) assert.equal(sha(await readFile(join(root, path))), digest, 'Implementation changed during acceptance: ' + path);
  });
} catch (error) {
  failure = { code: codeOf(error), check: cases.find(c => c.status === 'FAIL')?.name ?? 'INITIALIZATION' };
  console.error('FAIL ' + failure.code + ': ' + String(error.message).slice(0, 1000));
} finally {
  try { await browser?.close(); } catch {}
  try { await currentSource?.stop(); } catch {}
  try { await stopNext(); } catch {}
  for (const server of [proxy, gateway]) if (server) { server.closeAllConnections(); await new Promise(done => server.close(done)); }
  for (const child of children) { child.kill('SIGTERM'); }
  if (temporary) await rm(temporary, { recursive: true, force: true });
  const nativeAnalysesCompleted = sourceReports.reduce((sum, s) => sum + (s.nativeAnalysesCompleted ?? 0), 0);
  const report = { schema: 'JENIOS_R71_PRIVATE_EVOLUTION_ACCEPTANCE_V1', inputMode: mode,
    evidenceKind: mode === 'ORIGINAL_PRIVATE_CORE' ? 'ORIGINAL_PRIVATE_CORE_WITH_VERSIONED_EXTERNAL_RUNTIME_POLICY_SYNTHETIC_QA' : R71_PROTOCOL_FIXTURE_KIND,
    startedAt, finishedAt: new Date().toISOString(), sourceCommitSha, sourceTreeDirty, nodeVersion: process.version,
    sourceFiles: implementationDigests, buildEvidence, database: { serverVersion: pgVersion, disposable: true, hosted: false, clockEvidence },
    transport: { originClass: 'LITERAL_LOOPBACK_HTTPS', ephemeralCa: true, certificateAndHostnameVerificationEnabled: true,
      tlsVerificationDisabled: false, tlsCertificateSha256, realNextRoutes: cases[0].status === 'PASS', realSupabaseSdk: gatewayCalls.length > 0,
      authGateway: 'EXPLICIT_LOCAL_IDENTITY_SIMULATION', postgrestGateway: 'LOCAL_RPC_ADAPTER_TO_REAL_POSTGRESQL',
      deploymentMetadata: 'EXPLICIT_LOCAL_FIXTURE_NOT_VERCEL_DEPLOYMENT', actualHostedAuthentication: false },
    source: { originalPrivateCoreExecuted: mode === 'ORIGINAL_PRIVATE_CORE' && nativeAnalysesCompleted > 0, privateHostCliExercised: false,
      originalCoreBinding: R67_BINDING, originalPrivateBytesCommitted: false,
      driver: mode === 'ORIGINAL_PRIVATE_CORE' ? 'ACTUAL_BRANDED_SOURCE_AND_DURABLE_EMITTER_IN_PERSISTENT_FIXTURE_PROCESS'
        : 'PUBLIC_SIGNED_CLAIM_FIXTURE_WITH_PRODUCTION_OUTBOX_AND_TLS',
      nativeAnalysesCompleted,
      publicModeledCaptures: sourceReports.reduce((sum, s) => sum + (s.modeledCaptures ?? 0), 0),
      sourceProcesses: sourceStarts, sameInstanceConsumedApplyAndRollback: cases[11].status === 'PASS' },
    counts: { nextProcesses: nextStarts, sourceProcesses: sourceStarts, observationHttpRequests: intakeEvents.length,
      acknowledgementLosses: acknowledgementsLost, actualSqlRpcCalls: rpcCount(), ...finalCounts },
    validationEvidence, appliedAdminFeed: appliedFeed, finalAdminFeed: finalFeed, missedWindowAdminFeed: missingFeed,
    browser: browserEvidence, gatewayCalls, intakeEvents, cases,
    pass: cases.filter(c => c.status === 'PASS').length, fail: cases.filter(c => c.status === 'FAIL').length,
    notRun: cases.filter(c => c.status === 'NOT_RUN').length, failure,
    independentHostOrIdentityAttestation: false, hostedMigrationsApplied: 0, mergePerformed: false, deployPerformed: false,
    ...R71_BOUNDARIES };
  const encoded = JSON.stringify(report, null, 2) + '\n';
  for (const secret of [serviceKey, schedulerToken, ...Object.values(tokens), mainIdentity?.privateKeyPem, mainIdentity?.key,
    missingIdentity?.privateKeyPem, missingIdentity?.key].filter(Boolean)) assert.ok(!encoded.includes(secret), 'Evidence must not contain fixture secrets');
  await mkdir(artifactDirectory, { recursive: true }); await writeFile(artifactPath, encoded);
  console.log(JSON.stringify({ schema: report.schema, inputMode: mode, pass: report.pass, fail: report.fail, notRun: report.notRun,
    evidence: artifactPath, failure: report.failure }));
  if (failure || report.notRun || report.fail) process.exitCode = 1;
}
