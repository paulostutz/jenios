/**
 * R64 runtime acceptance after Next build, against a disposable local PostgreSQL.
 * Auth and the PostgREST HTTP gateway are explicit fixtures. Every admitted RPC
 * executes the real R64 SQL functions as service_role. No production service,
 * customer session, broker, external Paper transport or paid AI is exercised.
 * Browser interception is browser-only; it is not host-wide network isolation.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes, createHash } from 'node:crypto';
import { createServer } from 'node:https';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createR64TelemetryFixture, signR64QaPayload } from './r64-telemetry-fixtures.mjs';
import { scheduleR64TelemetryPeriod } from '../../../lib/platform/research/robot-r64-telemetry.mjs';
import { createR64DatabaseStore, R64_DATABASE_RPCS } from '../../../lib/platform/research/robot-r64-database-store.mjs';
import { runR64OperationalCycle } from '../../../lib/platform/research/robot-r64-operational-worker.mjs';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const ORIGIN = 'http://127.0.0.1:4318';
const GATEWAY = 'https://127.0.0.1:4319';
const PAGE = '/platform/homologacao/robos/observacao';
const INTAKE = '/api/platform/robot-observations';
const SCHEDULER = '/api/platform/internal/robot-observation-cycle';
const ADMIN = '/api/platform/admin/robot-observations';
const SCOPE = 'scope:0000000000000064';
const SERVICE_KEY = 'r64-service-role-fixture-only-no-production-access';
const SCHEDULER_TOKEN = 'r64-qa-' + randomBytes(32).toString('hex');
const RPC_NAMES = new Set(Object.values(R64_DATABASE_RPCS));
const FLAGS = Object.freeze({ VERCEL_ENV: 'preview', JENIOS_QA_CANDIDATE_ENABLED: 'true',
  JENIOS_ROBOT_QA_ENABLED: 'true', JENIOS_ROBOT_R64_ENABLED: 'true',
  JENIOS_REAL_EXECUTION_ENABLED: 'false', JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED: 'false',
  JENIOS_PRIVATE_PAPER_EXECUTOR: 'false', JENIOS_ROBOT_ANALYST_PAID_ENABLED: 'false' });
const ARTIFACT_DIR = resolve(process.env.ROBOT_QA_ARTIFACT_DIR ||
  resolve(process.env.RUNNER_TEMP || tmpdir(), 'jenios-r64-evidence'));
const FILES = { report: resolve(ARTIFACT_DIR, 'r64-runtime-acceptance.json'),
  log: resolve(ARTIFACT_DIR, 'r64-runtime-next-servers.log'),
  mobile: resolve(ARTIFACT_DIR, 'r64-observation-mobile.png'),
  failure: resolve(ARTIFACT_DIR, 'r64-runtime-failure.png') };
const started = Date.now();
const attempts = { externalRequests: 0, apiRequests: 0, mutations: 0, webSockets: 0 };
const report = { schema: 'JENIOS_R64_RUNTIME_ACCEPTANCE_V1', status: 'FAIL',
  startedAt: new Date(started).toISOString(), commit: process.env.GITHUB_SHA || null,
  scope: { evidenceKind: 'SIGNED_QA_REPLAY', fixtureScopeId: SCOPE,
    nextOrigin: ORIGIN, gatewayOrigin: GATEWAY, authentication: 'EXPLICIT_FIXTURE_USERS',
    restGateway: 'LOOPBACK_HTTPS_POSTGREST_MOCK', database: 'REAL_DISPOSABLE_POSTGRESQL',
    databaseRole: 'service_role', tls: 'EPHEMERAL_CA_TRUSTED_WITH_NODE_EXTRA_CA_CERTS',
    networkRestriction: 'BROWSER_REQUESTS_AND_WEBSOCKETS_ONLY',
    serverAndIntakeClock: 'REAL_WALL_CLOCK', schedulerPositivePath: null,
    productionDeploymentTested: false, customerMonitoringActive: false,
    independentCustomerConsentVerified: false, independentBrokerAttestation: false,
    paidProviderTested: false, realOrdersSent: 0, externalPaperOrdersSent: 0,
    actualBrokerPnl: null, actualLossesAvoided: null, realTradeAccuracy: null,
    commercialPerformanceCertified: false },
  runtime: { node: process.version, expectedPlaywright: '1.56.1' },
  cases: [], attempts, gatewayCalls: [], networkEvents: [], pageErrors: [], consoleErrors: [],
  artifacts: {}, errors: [] };
let databaseUrl, temporary, fixture, envelopes, store, gateway, server;
let browser, context, page, expect, persisted, browserText, cycleSchedule;
let gatewayRpcUnavailable = false, serverLog = '', nextEnv;
const checks = [];
const check = (id, category, run) => checks.push({ id, category, run });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const printableError = error => String(error?.stack || error).slice(0, 6000);
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const safeUrl = value => { try { const u = new URL(value); return u.origin + u.pathname; } catch { return '<invalid-url>'; } };
function log(text) { if (serverLog.length < 2_000_000) serverLog += text; }
function osEnvironment() {
  const env = {};
  for (const key of ['PATH', 'HOME', 'TMPDIR', 'TMP', 'TEMP', 'SystemRoot', 'LANG', 'LC_ALL', 'TZ'])
    if (process.env[key] !== undefined) env[key] = process.env[key];
  return env;
}
async function bounded(promise, ms, label) {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(label + ' timed out')), ms);
  })]); } finally { clearTimeout(timer); }
}
async function command(binary, args, { input = '', env = osEnvironment(), timeoutMs = 20000 } = {}) {
  return await new Promise((resolvePromise, reject) => {
    const child = spawn(binary, args, { cwd: ROOT, env, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', stderr = '', settled = false;
    const timer = setTimeout(() => { child.kill('SIGKILL'); finish(new Error('Fixture command timeout')); }, timeoutMs);
    function finish(error, value) {
      if (settled) return; settled = true; clearTimeout(timer);
      if (error) reject(error); else resolvePromise(value);
    }
    child.on('error', finish);
    child.stdout.on('data', chunk => {
      stdout += chunk.toString();
      if (stdout.length > 2_000_000) { child.kill('SIGKILL'); finish(new Error('Fixture command output limit')); }
    });
    child.stderr.on('data', chunk => { if (stderr.length < 32000) stderr += chunk.toString(); });
    child.on('close', code => {
      if (code === 0) finish(null, stdout.trim());
      else {
        const rpcCode = stderr.match(/\bR64_[A-Z0-9_]{1,80}\b/)?.[0];
        finish(Object.assign(new Error(rpcCode || 'Fixture command failed: ' + binary), { code: rpcCode }));
      }
    });
    child.stdin.on('error', () => {});
    child.stdin.end(input);
  });
}
function validateDisposableDatabase() {
  assert.equal(process.env.JENIOS_R64_DISPOSABLE_DB, 'true', 'Explicit disposable DB flag required.');
  databaseUrl = process.env.JENIOS_R64_TEST_DATABASE_URL;
  const url = new URL(databaseUrl);
  assert.ok(['postgres:', 'postgresql:'].includes(url.protocol));
  assert.equal(url.hostname, '127.0.0.1'); assert.equal(url.port, '5432');
  assert.equal(url.pathname, '/jenios_r64_qa'); assert.equal(url.username, 'postgres');
  assert.ok(url.password === 'r64-test-only', 'Only disposable fixture credentials are accepted.');
  assert.equal(url.search, ''); assert.equal(url.hash, '');
}
async function sql(text) {
  return command('psql', ['-XAtq', '-v', 'ON_ERROR_STOP=1', '--dbname', databaseUrl], {
    input: text, env: { ...osEnvironment(), PGCONNECT_TIMEOUT: '5',
      PGOPTIONS: '-c statement_timeout=15000 -c lock_timeout=5000' }, timeoutMs: 20000 });
}
async function rpc(name, input) {
  assert.ok(RPC_NAMES.has(name), 'Only R64 RPC names may enter the SQL gateway.');
  const encoded = Buffer.from(JSON.stringify(input)).toString('base64');
  const result = await sql(`BEGIN; SET LOCAL ROLE service_role; SELECT public.${name}(convert_from(decode('${encoded}','base64'),'UTF8')::jsonb); COMMIT;`);
  return JSON.parse(result);
}
async function cycleDatabaseSnapshot() {
  const raw = await sql(`SELECT coalesce(jsonb_agg(jsonb_build_object('state',state,'request',request,'result',result,'report',report,'reservedNanoUsd',reserved_nano_usd,'settledNanoUsd',settled_nano_usd)), '[]'::jsonb) FROM public.jenios_robot_cycles_r64 WHERE scope_id='${SCOPE}';`);
  return JSON.parse(raw);
}
async function request(path, { method = 'GET', token, body, contentType } = {}) {
  const headers = {};
  if (token) headers.Authorization = 'Bearer ' + token;
  if (contentType) headers['Content-Type'] = contentType;
  else if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(ORIGIN + path, { method, headers,
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    redirect: 'manual', signal: AbortSignal.timeout(25000) });
  const raw = await response.text();
  assert.ok(raw.length <= 2_000_000, 'Unexpected response size.');
  const data = response.headers.get('content-type')?.includes('application/json') ? JSON.parse(raw) : raw;
  return { status: response.status, data };
}
async function readIncoming(request) {
  let bytes = 0; const chunks = [];
  for await (const chunk of request) {
    bytes += chunk.length; if (bytes > 1_048_576) throw new Error('Fixture gateway body limit');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
async function startGateway() {
  temporary = await mkdtemp(resolve(tmpdir(), 'jenios-r64-runtime-'));
  const caKey = resolve(temporary, 'qa-ca.key'), caPem = resolve(temporary, 'qa-ca.pem');
  const serverKey = resolve(temporary, 'loopback.key'), csr = resolve(temporary, 'loopback.csr');
  const cert = resolve(temporary, 'loopback.pem'), ext = resolve(temporary, 'loopback.ext');
  await command('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-sha256', '-nodes', '-days', '1',
    '-subj', '/CN=JENIOS R64 ephemeral QA CA', '-addext', 'basicConstraints=critical,CA:TRUE',
    '-addext', 'keyUsage=critical,keyCertSign,cRLSign', '-keyout', caKey, '-out', caPem]);
  await command('openssl', ['req', '-new', '-newkey', 'rsa:2048', '-sha256', '-nodes',
    '-subj', '/CN=127.0.0.1', '-keyout', serverKey, '-out', csr]);
  await writeFile(ext, 'subjectAltName=IP:127.0.0.1,DNS:localhost\nbasicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\n');
  await command('openssl', ['x509', '-req', '-in', csr, '-CA', caPem, '-CAkey', caKey,
    '-CAcreateserial', '-out', cert, '-days', '1', '-sha256', '-extfile', ext]);
  gateway = createServer({ key: await readFile(serverKey), cert: await readFile(cert),
    requestTimeout: 30000, headersTimeout: 10000 }, async (incoming, outgoing) => {
    const path = new URL(incoming.url, GATEWAY).pathname;
    const call = { method: incoming.method, path, status: 500, realSqlExecuted: false };
    report.gatewayCalls.push(call);
    const reply = (status, value) => {
      call.status = status; outgoing.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      outgoing.end(JSON.stringify(value));
    };
    try {
      if (incoming.headers.apikey !== SERVICE_KEY) return reply(401, { message: 'Fixture service key required' });
      const token = incoming.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
      if (path === '/auth/v1/user' && incoming.method === 'GET') {
        const users = { 'qa-admin-token': ['00000000-0000-4000-8000-000000000064', false, 'admin'],
          'qa-member-token': ['00000000-0000-4000-8000-000000000065', false, 'member'],
          'qa-anonymous-token': ['00000000-0000-4000-8000-000000000066', true, 'member'] };
        const selected = users[token];
        if (!selected) return reply(401, { message: 'Invalid fixture session', code: 'bad_jwt' });
        return reply(200, { id: selected[0], aud: 'authenticated', role: 'authenticated',
          app_metadata: { platform_role: selected[2] }, user_metadata: {}, is_anonymous: selected[1],
          created_at: '2026-10-24T00:00:00.000Z' });
      }
      if (token !== SERVICE_KEY) return reply(401, { message: 'Fixture database authorization required' });
      if (path === '/rest/v1/jenios_platform_admin_permissions' && incoming.method === 'GET')
        return reply(200, []); // Fixture members have no Platform admin grant.
      const name = path.match(/^\/rest\/v1\/rpc\/([a-z0-9_]+)$/)?.[1];
      if (!name || !RPC_NAMES.has(name) || incoming.method !== 'POST')
        return reply(404, { message: 'Fixture gateway route unavailable' });
      if (gatewayRpcUnavailable) { call.injectedUnavailable = true; return reply(503, { message: 'R64_DATABASE_UNAVAILABLE' }); }
      const body = await bounded(readIncoming(incoming), 5000, 'Fixture gateway request body');
      if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length !== 1 || !Object.hasOwn(body, 'p_input'))
        return reply(400, { message: 'R64_DATABASE_INPUT' });
      call.rpc = name; call.realSqlExecuted = true;
      return reply(200, await rpc(name, body.p_input));
    } catch (error) {
      const code = /^R64_[A-Z0-9_]{1,80}$/.test(error?.code || '') ? error.code : 'R64_RUNTIME_DATABASE_ERROR';
      call.errorCode = code;
      return reply(400, { code: 'P0001', message: code, details: null, hint: null });
    }
  });
  await new Promise((done, reject) => { gateway.once('error', reject); gateway.listen(4319, '127.0.0.1', done); });
  return caPem;
}
async function stopServer() {
  const current = server; if (!current) return;
  if (current.child.exitCode === null && current.child.signalCode === null) {
    current.child.kill('SIGTERM');
    try { await bounded(current.exited, 5000, 'Next termination'); }
    catch { current.child.kill('SIGKILL'); await bounded(current.exited, 5000, 'Next forced termination'); }
  }
  if (server === current) server = undefined;
}
async function startServer(overrides = {}) {
  await stopServer();
  const env = { ...nextEnv };
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete env[key]; else env[key] = value;
  }
  log('\nR64 Next fixture flags: ' + JSON.stringify(Object.fromEntries(Object.keys(FLAGS).map(k => [k, env[k] ?? '<absent>']))) + '\n');
  const child = spawn(process.execPath, [resolve(ROOT, 'node_modules/next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', '4318'],
    { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
  const current = { child, error: null };
  current.exited = new Promise(done => child.once('exit', (code, signal) => {
    log(`\nR64 Next exit code=${code}; signal=${signal}\n`); done();
  }));
  child.once('error', error => { current.error = error; });
  child.stdout.on('data', chunk => log(chunk.toString()));
  child.stderr.on('data', chunk => log(chunk.toString()));
  server = current;
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    if (current.error) throw current.error;
    if (child.exitCode !== null || child.signalCode !== null) throw new Error('Next exited before readiness; see fixture server log.');
    try {
      const response = await fetch(ORIGIN + ADMIN, { redirect: 'manual', signal: AbortSignal.timeout(1200) });
      await response.arrayBuffer(); if ([401, 404].includes(response.status)) return;
    } catch { /* Startup connection refusal is expected within this bounded loop. */ }
    await pause(150);
  }
  throw new Error('Next did not become ready on 127.0.0.1:4318.');
}
function freshlySigned(payload) {
  const now = Date.now(), copy = structuredClone(payload);
  copy.event.capturedAtMs = now - 10; copy.expiresAtMs = now + 90000;
  return signR64QaPayload(copy, fixture.privateKey);
}
async function setupBrowser() {
  const modulePath = process.env.JENIOS_ROBOT_QA_PLAYWRIGHT_MODULE;
  assert.ok(modulePath && isAbsolute(modulePath), 'Absolute pinned Playwright module path required.');
  const packageJson = JSON.parse(await readFile(resolve(dirname(modulePath), 'package.json'), 'utf8'));
  assert.equal(packageJson.version, '1.56.1'); assert.ok(['@playwright/test', 'playwright'].includes(packageJson.name));
  const playwright = await import(pathToFileURL(modulePath).href);
  assert.equal(typeof playwright.chromium?.launch, 'function'); assert.equal(typeof playwright.expect, 'function');
  expect = playwright.expect.configure({ timeout: 6000 });
  browser = await playwright.chromium.launch({ headless: true, timeout: 30000 });
  report.runtime.playwright = packageJson.version; report.runtime.chromium = browser.version();
  context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' });
  context.setDefaultTimeout(8000); context.setDefaultNavigationTimeout(30000);
  await context.route('**/*', async route => {
    const req = route.request(), url = new URL(req.url()), reasons = [];
    if (url.origin !== ORIGIN) { attempts.externalRequests++; reasons.push('EXTERNAL_ORIGIN'); }
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) { attempts.apiRequests++; reasons.push('API'); }
    if (!['GET', 'HEAD'].includes(req.method())) { attempts.mutations++; reasons.push('MUTATING_METHOD'); }
    if (reasons.length) { report.networkEvents.push({ url: safeUrl(url.href), method: req.method(), reasons }); await route.abort('blockedbyclient'); }
    else await route.continue();
  });
  await context.routeWebSocket(/.*/, async socket => {
    attempts.webSockets++; report.networkEvents.push({ url: safeUrl(socket.url()), reasons: ['WEBSOCKET'] });
    await socket.close({ code: 1008, reason: 'R64 QA report has no socket transport' });
  });
  context.on('page', opened => {
    opened.on('pageerror', error => report.pageErrors.push(printableError(error)));
    opened.on('console', message => { if (message.type() === 'error' && report.consoleErrors.length < 100) report.consoleErrors.push(message.text().slice(0, 1500)); });
  });
  page = await context.newPage();
}
async function noOverflow(width) {
  await page.setViewportSize({ width, height: 812 });
  await expect(page.getByTestId('r64-report')).toBeVisible();
  const dimensions = await page.evaluate(() => ({ viewport: innerWidth,
    document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
  assert.ok(dimensions.document <= width && dimensions.body <= width, JSON.stringify(dimensions));
  const box = await page.getByTestId('r64-report').boundingBox();
  assert.ok(box && box.x >= 0 && box.x + box.width <= width + 1);
  return dimensions;
}

check('disposable-database-ready', 'real-sql', async () => {
  const policy = await store.readAnalystPolicy();
  assert.equal(policy.generationEnabled, false);
  assert.deepEqual(await store.readReports({ scopeId: SCOPE }), []);
  return { schemaApplied: true, generationEnabled: false, fixtureScopeInitiallyEmpty: true };
});
check('admin-without-session-401', 'authorization', async () => assert.equal((await request(ADMIN)).status, 401));
check('admin-member-403', 'authorization', async () => assert.equal((await request(ADMIN, { token: 'qa-member-token' })).status, 403));
check('admin-anonymous-401', 'authorization', async () => assert.equal((await request(ADMIN, { token: 'qa-anonymous-token' })).status, 401));
check('scheduler-without-token-401', 'authorization', async () => assert.equal((await request(SCHEDULER, { method: 'POST' })).status, 401));
check('scheduler-wrong-token-401', 'authorization', async () => assert.equal((await request(SCHEDULER, { method: 'POST', token: 'fixture-invalid-scheduler-token' })).status, 401));
check('scheduler-nonempty-body-400', 'authorization', async () => assert.equal((await request(SCHEDULER, { method: 'POST', token: SCHEDULER_TOKEN, body: {} })).status, 400));
check('intake-media-type-415', 'signed-intake', async () => assert.equal((await request(INTAKE, { method: 'POST', body: '{}', contentType: 'text/plain' })).status, 415));
check('signed-seven-intakes-202', 'signed-intake', async () => {
  envelopes = fixture.envelopes.map(item => freshlySigned(item.payload));
  for (const envelope of envelopes) {
    const result = await request(INTAKE, { method: 'POST', body: envelope });
    assert.equal(result.status, 202, JSON.stringify(result.data)); assert.equal(result.data.status, 'STORED');
    assert.equal(result.data.evidenceKind, 'SIGNED_QA_REPLAY');
  }
  const rows = await store.readReceipts({ scopeId: SCOPE, period: fixture.period });
  assert.equal(rows.length, 7);
  return { signedEvents: 7, realPostgresReceipts: rows.length };
});
check('exact-replay-idempotent-200', 'signed-intake', async () => {
  const result = await request(INTAKE, { method: 'POST', body: envelopes[0] });
  assert.equal(result.status, 200); assert.equal(result.data.status, 'ALREADY_STORED');
  assert.equal((await store.readReceipts({ scopeId: SCOPE, period: fixture.period })).length, 7);
});
check('signed-conflict-409', 'signed-intake', async () => {
  const payload = structuredClone(envelopes[0].payload); payload.event.marketAgeMs = 150;
  const result = await request(INTAKE, { method: 'POST', body: freshlySigned(payload) });
  assert.equal(result.status, 409, JSON.stringify(result.data));
});
check('signature-tamper-400', 'signed-intake', async () => {
  const tampered = structuredClone(envelopes[0]); tampered.payload.event.marketAgeMs = 151;
  assert.equal((await request(INTAKE, { method: 'POST', body: tampered })).status, 400);
});
check('unconfigured-source-400', 'signed-intake', async () => {
  const payload = structuredClone(envelopes[0].payload); payload.sourceId = 'source:0000000000000065';
  assert.equal((await request(INTAKE, { method: 'POST', body: freshlySigned(payload) })).status, 400);
});
check('cycle-durably-records-report', 'scheduler-and-storage', async () => {
  cycleSchedule = scheduleR64TelemetryPeriod({ nowMs: Date.now() });
  assert.deepEqual(cycleSchedule.period, fixture.period, 'Daily period crossed during acceptance; rerun on a stable period.');
  const result = await request(SCHEDULER, { method: 'POST', token: SCHEDULER_TOKEN });
  assert.equal(result.status, 200, JSON.stringify(result.data));
  if (cycleSchedule.due) {
    assert.equal(result.data.status, 'STORED_OPERATIONAL_QA_REPORT');
    report.scope.schedulerPositivePath = 'REAL_HTTP_WALL_CLOCK';
  } else {
    assert.equal(result.data.status, 'NOT_DUE');
    const virtualNowMs = cycleSchedule.scheduledAtMs + 1;
    const direct = await runR64OperationalCycle({ store, scopeId: SCOPE, env: FLAGS, nowMs: virtualNowMs });
    assert.equal(direct.status, 'STORED_OPERATIONAL_QA_REPORT');
    report.scope.schedulerPositivePath = 'EXPLICIT_VIRTUAL_SCHEDULE_DIRECT_WORKER';
    report.scope.virtualWorkerScheduleAt = new Date(virtualNowMs).toISOString();
  }
  const rows = await store.readReports({ scopeId: SCOPE }); assert.equal(rows.length, 1);
  assert.equal(rows[0].status, 'COMPLETED'); persisted = rows[0].report;
  return { httpStatus: result.data.status, positivePath: report.scope.schedulerPositivePath, persistedReports: 1 };
});
check('cycle-retry-idempotent', 'scheduler-and-storage', async () => {
  const result = await request(SCHEDULER, { method: 'POST', token: SCHEDULER_TOKEN });
  assert.equal(result.status, 200);
  const nowSchedule = scheduleR64TelemetryPeriod({ nowMs: Date.now() });
  assert.equal(result.data.status, nowSchedule.due ? 'ALREADY_STORED' : 'NOT_DUE');
  if (!nowSchedule.due) {
    const direct = await runR64OperationalCycle({ store, scopeId: SCOPE, env: FLAGS, nowMs: cycleSchedule.scheduledAtMs + 1 });
    assert.equal(direct.status, 'ALREADY_STORED');
  }
  const rows = await store.readReports({ scopeId: SCOPE }); assert.equal(rows.length, 1);
  assert.deepEqual(rows[0].report, persisted);
});
check('admin-feed-matches-postgres', 'admin-read', async () => {
  const result = await request(ADMIN, { token: 'qa-admin-token' });
  assert.equal(result.status, 200, JSON.stringify(result.data));
  assert.equal(result.data.adminOnly, true); assert.equal(result.data.reports.length, 1);
  assert.deepEqual(result.data.reports[0], persisted); assert.equal(result.data.pendingCycles, 0);
  assert.ok(report.gatewayCalls.some(c => c.path === '/auth/v1/user' && c.status === 200));
  assert.ok(report.gatewayCalls.some(c => c.rpc === R64_DATABASE_RPCS.readReports && c.realSqlExecuted && c.status === 200));
  return { persistedReportDigest: digest(persisted), tlsVerifiedByNext: true, fixtureAdminAccepted: true };
});
check('provider-disabled-zero-budget', 'provider-boundary', async () => {
  assert.equal(persisted.providerAudit.kind, 'not_generated');
  assert.equal(persisted.providerAudit.httpRequests, 0); assert.equal(persisted.providerAudit.inferenceRequests, 0);
  assert.equal(persisted.providerAudit.costNanoUsd, null); assert.equal(persisted.providerAudit.model, null);
  const rows = await cycleDatabaseSnapshot(); assert.equal(rows.length, 1);
  assert.equal(rows[0].state, 'COMPLETED'); assert.equal(rows[0].request, null);
  assert.equal(rows[0].reservedNanoUsd, 0); assert.equal(rows[0].settledNanoUsd, 0);
  assert.equal(rows[0].result.kind, 'not_generated'); assert.deepEqual(rows[0].report, persisted);
  assert.ok(!report.gatewayCalls.some(c => c.rpc === R64_DATABASE_RPCS.reserveAndDispatch));
  return { providerHttpRequests: 0, inferenceRequests: 0, reservationNanoUsd: 0, settledNanoUsd: 0 };
});
check('evidence-limits-and-zero-orders', 'honest-reporting', async () => {
  assert.equal(persisted.observations.eventCount, 7); assert.equal(persisted.observations.incidentCount, 3);
  assert.deepEqual(persisted.observations.byRobot, { manual: 1, hybrid: 1, reverse: 1, ultrafast: 4 });
  assert.equal(persisted.evidenceKind, 'SIGNED_QA_REPLAY');
  for (const key of ['automaticPromotionAllowed', 'productionMonitoringStarted', 'independentBrokerAttestation', 'independentCustomerConsentVerified']) assert.equal(persisted[key], false);
  for (const key of ['autonomousChangesApplied', 'realOrdersSent', 'externalPaperOrdersSent']) assert.equal(persisted[key], 0);
  for (const key of ['actualBrokerPnl', 'actualLossesAvoided', 'realTradeAccuracy']) assert.equal(persisted[key], null);
  assert.equal(persisted.maturity.completionCeilingKnown, false);
  assert.equal(persisted.maturity.stage, 'OBSERVATION_RECORDED');
});
check('database-unavailable-admin-503', 'failure-boundary', async () => {
  gatewayRpcUnavailable = true;
  try { assert.equal((await request(ADMIN, { token: 'qa-admin-token' })).status, 503); }
  finally { gatewayRpcUnavailable = false; }
});
check('database-unavailable-scheduler-503-or-not-due', 'failure-boundary', async () => {
  gatewayRpcUnavailable = true;
  try {
    const due = scheduleR64TelemetryPeriod({ nowMs: Date.now() }).due;
    const result = await request(SCHEDULER, { method: 'POST', token: SCHEDULER_TOKEN });
    if (due) assert.equal(result.status, 503);
    else { assert.equal(result.status, 200); assert.equal(result.data.status, 'NOT_DUE'); }
    return { schedulerDue: due, responseStatus: result.status };
  } finally { gatewayRpcUnavailable = false; }
});
check('database-unavailable-intake-503', 'failure-boundary', async () => {
  const payload = structuredClone(envelopes[0].payload);
  payload.eventId = 'evt:0000000000000064'; payload.sequence = 8;
  gatewayRpcUnavailable = true;
  try { assert.equal((await request(INTAKE, { method: 'POST', body: freshlySigned(payload) })).status, 503); }
  finally { gatewayRpcUnavailable = false; }
  assert.equal((await store.readReceipts({ scopeId: SCOPE, period: fixture.period })).length, 7);
});
check('admin-recovery-preserves-report', 'failure-boundary', async () => {
  const result = await request(ADMIN, { token: 'qa-admin-token' });
  assert.equal(result.status, 200); assert.deepEqual(result.data.reports, [persisted]);
});
check('browser-ssr-persisted-report', 'browser', async () => {
  await setupBrowser();
  const response = await page.goto(ORIGIN + PAGE, { waitUntil: 'networkidle' });
  assert.equal(response.status(), 200);
  const html = await response.text();
  assert.ok(html.includes('data-testid="r64-report"'), 'The first HTML response must contain the persisted report.');
  assert.ok(html.includes('data-testid="r64-observation-count"'), 'The observation counter must be server rendered.');
  await expect(page.getByTestId('r64-report')).toBeVisible();
  await expect(page.getByTestId('r64-observation-count')).toHaveText('7');
  await expect(page.getByTestId('r64-applied-count')).toHaveText('0');
  await expect(page.getByTestId('r64-no-orders')).toHaveText('Ordens reais: 0. Paper externo: 0.');
  browserText = await page.getByTestId('r64-report').innerText();
});
check('browser-four-robots', 'browser', async () => {
  for (const [label, count] of [['Manual', 1], ['Híbrido', 1], ['Reverso', 1], ['UltraFast', 4]]) {
    const robot = page.getByTestId('r64-report').getByText(label, { exact: true });
    await expect(robot).toBeVisible(); await expect(robot.locator('..')).toContainText(`${count} observações de QA`);
  }
});
check('browser-evidence-and-limitations', 'browser', async () => {
  await expect(page.getByTestId('r64-evidence-kind')).toContainText('Replay de QA com assinatura verificada');
  await expect(page.getByTestId('r64-evidence-kind')).toContainText('Não representa operações reais de clientes.');
  await expect(page.getByTestId('r64-provider-status')).toHaveText('Análise generativa não executada');
  await expect(page.getByTestId('r64-maturity')).toHaveText('Observações de QA registradas');
  await expect(page.getByTestId('r64-scope')).toContainText(SCOPE);
  await expect(page.getByTestId('r64-schedule')).toContainText('Agendador de produção não ativado.');
  await expect(page.getByTestId('r64-disclosure')).toContainText('exigem transparência');
  await expect(page.getByTestId('r64-disclosure')).toContainText('não comprova consentimento independente');
});
check('browser-reload-retains-persisted-report', 'browser', async () => {
  assert.equal((await page.reload({ waitUntil: 'networkidle' })).status(), 200);
  await expect(page.getByTestId('r64-report')).toBeVisible();
  assert.equal(await page.getByTestId('r64-report').innerText(), browserText);
  const rows = await store.readReports({ scopeId: SCOPE });
  assert.equal(rows.length, 1); assert.deepEqual(rows[0].report, persisted);
});
check('browser-mobile-375-no-overflow', 'browser', async () => noOverflow(375));
check('browser-mobile-320-no-overflow', 'browser', async () => {
  const dimensions = await noOverflow(320);
  await page.screenshot({ path: FILES.mobile, fullPage: true }); report.artifacts.mobile = FILES.mobile;
  return dimensions;
});
check('browser-no-forbidden-traffic', 'browser', async () => {
  assert.deepEqual(attempts, { externalRequests: 0, apiRequests: 0, mutations: 0, webSockets: 0 });
  assert.deepEqual(report.pageErrors, []); assert.deepEqual(report.consoleErrors, []);
  await browser.close(); browser = undefined; context = undefined; page = undefined;
  return { ...attempts };
});
check('missing-r64-flag-routes-404', 'disabled-gate', async () => {
  await startServer({ JENIOS_ROBOT_R64_ENABLED: undefined });
  const before = report.gatewayCalls.length;
  assert.equal((await request(INTAKE, { method: 'POST', body: envelopes[0] })).status, 404);
  assert.equal((await request(SCHEDULER, { method: 'POST', token: SCHEDULER_TOKEN })).status, 404);
  assert.equal((await request(ADMIN, { token: 'qa-admin-token' })).status, 404);
  assert.equal(report.gatewayCalls.length, before, 'Disabled API routes must not touch the database/auth gateway.');
});
check('missing-r64-flag-page-404', 'disabled-gate', async () => {
  const before = report.gatewayCalls.length, result = await request(PAGE);
  assert.equal(result.status, 404); assert.ok(!result.data.includes('data-testid="r64-report"'));
  assert.equal(report.gatewayCalls.length, before, 'Disabled QA page must not read the database.');
});

try {
  await mkdir(ARTIFACT_DIR, { recursive: true }); validateDisposableDatabase();
  await readFile(resolve(ROOT, '.next/BUILD_ID'), 'utf8');
  const schedule = scheduleR64TelemetryPeriod({ nowMs: Date.now() });
  // Only fixture construction uses the explicit future daily window before 09h.
  // The signed envelopes are refreshed to real time after Next startup below.
  fixture = createR64TelemetryFixture({ generatedAtMs: Math.max(Date.now(), schedule.scheduledAtMs + 1),
    scopeId: SCOPE, sourceId: 'source:0000000000000064', sessionId: 'session:0000000000000064' });
  store = createR64DatabaseStore({ db: { rpc: async (name, args) => ({ data: await rpc(name, args.p_input), error: null }) } });
  const caPath = await startGateway();
  nextEnv = { ...osEnvironment(), NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1', ...FLAGS,
    NODE_EXTRA_CA_CERTS: caPath, PLATFORM_SUPABASE_URL: GATEWAY,
    PLATFORM_SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
    JENIOS_ROBOT_R64_SCOPE_ID: SCOPE, JENIOS_ROBOT_R64_SOURCE_ID: fixture.trustedSource.sourceId,
    JENIOS_ROBOT_R64_SOURCE_PUBLIC_KEY: fixture.trustedSource.publicKeyPem,
    JENIOS_ROBOT_R64_SCHEDULER_TOKEN: SCHEDULER_TOKEN };
  await startServer();
  for (const item of checks) {
    const began = Date.now();
    try {
      const evidence = await item.run();
      report.cases.push({ id: item.id, category: item.category, status: 'PASS', elapsedMs: Date.now() - began,
        ...(evidence === undefined ? {} : { evidence }) });
      console.log('[R64 runtime] PASS ' + item.id);
    } catch (error) {
      report.cases.push({ id: item.id, category: item.category, status: 'FAIL', elapsedMs: Date.now() - began, error: printableError(error) });
      console.error('[R64 runtime] FAIL ' + item.id + ': ' + String(error?.message || error));
    }
  }
} catch (error) { report.errors.push(printableError(error)); }
finally {
  if (page && report.cases.some(c => c.status === 'FAIL')) {
    try { await page.screenshot({ path: FILES.failure, fullPage: true }); report.artifacts.failure = FILES.failure; } catch { /* Preserve the original failure. */ }
  }
  try { await browser?.close(); } catch (error) { report.errors.push(printableError(error)); }
  try { await stopServer(); } catch (error) { report.errors.push(printableError(error)); }
  if (gateway) {
    try { gateway.closeAllConnections(); await new Promise(done => gateway.close(done)); }
    catch (error) { report.errors.push(printableError(error)); }
  }
  if (temporary) await rm(temporary, { recursive: true, force: true });
  const executed = new Set(report.cases.map(c => c.id));
  for (const item of checks) if (!executed.has(item.id)) report.cases.push({ id: item.id, category: item.category, status: 'NOT_RUN' });
  report.summary = { planned: checks.length, passed: report.cases.filter(c => c.status === 'PASS').length,
    failed: report.cases.filter(c => c.status === 'FAIL').length, notRun: report.cases.filter(c => c.status === 'NOT_RUN').length,
    allPlannedCasesRan: executed.size === checks.length };
  report.counts = { total: report.summary.planned, passed: report.summary.passed, failed: report.summary.failed,
    notRun: report.summary.notRun, pageErrors: report.pageErrors.length };
  report.status = report.summary.passed === checks.length && report.errors.length === 0 ? 'PASS' : 'FAIL';
  report.finishedAt = new Date().toISOString(); report.elapsedMs = Date.now() - started;
  report.artifacts.report = FILES.report; report.artifacts.serverLog = FILES.log;
  await mkdir(ARTIFACT_DIR, { recursive: true });
  await writeFile(FILES.log, serverLog); await writeFile(FILES.report, JSON.stringify(report, null, 2) + '\n');
  console.log('R64_RUNTIME_ACCEPTANCE ' + JSON.stringify({ schema: report.schema, status: report.status,
    counts: report.counts, allPlannedCasesRan: report.summary.allPlannedCasesRan,
    schedulerPositivePath: report.scope.schedulerPositivePath, attempts, artifacts: report.artifacts }));
  if (report.status !== 'PASS') process.exitCode = 1;
}
