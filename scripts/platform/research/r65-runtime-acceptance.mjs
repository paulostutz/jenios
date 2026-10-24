/**
 * R65 acceptance against an explicitly disposable local PostgreSQL and Next host.
 * Auth/PostgREST are simulated HTTPS boundaries; admitted RPCs use real SQL under
 * service_role. No real login, Supabase, broker, provider or order is exercised.
 * Before 09h Sao Paulo only the closed-calendar phase uses an explicit past QA
 * Date.now offset in the isolated Next process. The prospective benchmark is
 * then registered directly through the public engine/store, on real time.
 * All validation windows/captures use unmodified PostgreSQL clock_timestamp().
 * Browser interception is browser-only; it is not host-wide network isolation.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes, createHash, generateKeyPairSync } from 'node:crypto';
import { createServer } from 'node:https';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createR65ObservationSource, verifyR65ObservationRecord } from '../../../lib/platform/research/robot-r65-observation-source.mjs';
import { scheduleR64TelemetryPeriod, studyR64AcceptedTelemetry } from '../../../lib/platform/research/robot-r64-telemetry.mjs';
import { createR64DatabaseStore, R64_DATABASE_RPCS, hashR64CycleInput } from '../../../lib/platform/research/robot-r64-database-store.mjs';
import { createR65DatabaseStore, R65_DATABASE_RPCS } from '../../../lib/platform/research/robot-r65-database-store.mjs';
import { ensureR65Evolution, createR65RegisteredBenchmark, r65OperationId } from '../../../lib/platform/research/robot-r65-cycle-worker.mjs';
import { registerR65Evaluation } from '../../../lib/platform/research/robot-r65-evolution-engine.mjs';
import { projectR65AdminFeed } from '../../../lib/platform/research/robot-r65-admin-view.mjs';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const ORIGIN = 'http://127.0.0.1:4320';
const GATEWAY = 'https://127.0.0.1:4321';
const PAGE = '/platform/homologacao/robos/ciclo';
const INTAKE = '/api/platform/robot-evolution-observations';
const SCHEDULER = '/api/platform/internal/robot-evolution-cycle';
const ADMIN = '/api/platform/admin/robot-evolution-cycle';
const R64_SCHEDULER = '/api/platform/internal/robot-observation-cycle';
const SCOPE = 'scope:6500' + randomBytes(6).toString('hex');
const SOURCE = 'source:0000000000000065';
const SESSION = 'session:6500' + randomBytes(6).toString('hex');
const SERVICE_KEY = 'r65-service-role-fixture-only-no-production-access';
const SCHEDULER_TOKEN = 'r65-qa-' + randomBytes(32).toString('hex');
const R64_SCHEDULER_TOKEN = 'r64-in-r65-qa-' + randomBytes(32).toString('hex');
const BROWSER_ADMIN_TOKEN = [
  Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'),
  Buffer.from(JSON.stringify({ sub: '00000000-0000-4000-8000-000000000064', aud: 'authenticated',
    role: 'authenticated', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url'),
  randomBytes(32).toString('base64url'),
].join('.'); // Exact fixture-token recognition only; no real JWT/identity attestation.
const RPC_NAMES = new Set([...Object.values(R64_DATABASE_RPCS), ...Object.values(R65_DATABASE_RPCS)]);
const FLAGS = Object.freeze({ VERCEL_ENV: 'preview', JENIOS_QA_CANDIDATE_ENABLED: 'true',
  JENIOS_ROBOT_QA_ENABLED: 'true', JENIOS_ROBOT_R64_ENABLED: 'true', JENIOS_ROBOT_R65_ENABLED: 'true',
  JENIOS_REAL_EXECUTION_ENABLED: 'false', JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED: 'false',
  JENIOS_PRIVATE_PAPER_EXECUTOR: 'false', JENIOS_ROBOT_ANALYST_PAID_ENABLED: 'false' });
const ARTIFACT_DIR = resolve(process.env.ROBOT_QA_ARTIFACT_DIR ||
  resolve(process.env.RUNNER_TEMP || tmpdir(), 'jenios-r65-evidence'));
const FILES = { report: resolve(ARTIFACT_DIR, 'r65-runtime-acceptance.json'),
  log: resolve(ARTIFACT_DIR, 'r65-runtime-next-servers.log'),
  mobile: resolve(ARTIFACT_DIR, 'r65-cycle-mobile.png'),
  failure: resolve(ARTIFACT_DIR, 'r65-runtime-failure.png') };
const started = Date.now();
const realScheduleAtStart = scheduleR64TelemetryPeriod({ nowMs: started });
let clockOffsetMs = realScheduleAtStart.due ? 0 : realScheduleAtStart.scheduledAtMs - 86400000 + 60000 - started;
const usedCalendarFixture = clockOffsetMs !== 0;
const qaNow = () => Date.now() + clockOffsetMs;
const attempts = { externalRequests: 0, apiRequests: 0, mutations: 0, webSockets: 0 };
const report = { schema: 'JENIOS_R65_RUNTIME_ACCEPTANCE_V1', status: 'FAIL',
  startedAt: new Date(started).toISOString(), commit: process.env.GITHUB_SHA || null,
  scope: { observationEvidenceKind: 'SIGNED_QA_REPLAY', runtimeOrigin: 'R61_SYNTHETIC_RUNTIME',
    validationEvidenceKind: 'SYNTHETIC_FIXTURE', fixtureScopeId: SCOPE,
    nextOrigin: ORIGIN, gatewayOrigin: GATEWAY, authentication: 'EXPLICIT_FIXTURE_USERS',
    restGateway: 'LOOPBACK_HTTPS_POSTGREST_MOCK', database: 'REAL_DISPOSABLE_POSTGRESQL',
    databaseRole: 'service_role', tls: 'EPHEMERAL_CA_TRUSTED_WITH_NODE_EXTRA_CA_CERTS',
    networkRestriction: 'BROWSER_REQUESTS_AND_WEBSOCKETS_ONLY',
    serverAndIntakeClock: usedCalendarFixture ? 'EXPLICIT_PAST_QA_CALENDAR_THEN_REAL_WALL_CLOCK' : 'REAL_WALL_CLOCK',
    closedCalendarOffsetMs: clockOffsetMs, registrationPositivePath: null,
    validationClock: 'UNMODIFIED_POSTGRESQL_CLOCK_TIMESTAMP', retrospectiveValidationCreated: false,
    productionDeploymentTested: false, realAdminIdentityTested: false, realProviderConnectionTested: false,
    customerMonitoringActive: false, privateEngineConnected: false,
    independentCustomerConsentVerified: false, independentBrokerAttestation: false,
    paidProviderCalls: 0, realOrdersSent: 0, externalPaperOrdersSent: 0,
    actualBrokerPnl: null, actualLossesAvoided: null, realTradeAccuracy: null,
    commercialPerformanceCertified: false },
  runtime: { node: process.version, expectedPlaywright: '1.56.1' },
  cases: [], attempts, permittedBrowserAdminReads: 0, gatewayCalls: [], networkEvents: [], pageErrors: [], consoleErrors: [],
  artifacts: {}, errors: [] };
let databaseUrl, temporary, gateway, server, nextEnv, browser, context, page, expect;
let store, lifecycleStore, source, sourceConfig, stateRow, observationCycle, persistedR64, plan, browserText;
let gatewayRpcUnavailable = false, serverLog = '', replayOccurrence = true, occurrenceSequence = 0;
let baselineRecords = [], promotedRecord, rollbackRecords = [], rollbackAction, archivePreview, archiveAction;
let uncertainCycle, reconciliationAction, budgetBeforeFixture, finalFeed;
const { privateKey, publicKey } = generateKeyPairSync('ed25519');
const privateKeyPem = privateKey.export({ format: 'pem', type: 'pkcs8' });
const publicKeyPem = publicKey.export({ format: 'pem', type: 'spki' });
const closedSchedule = scheduleR64TelemetryPeriod({ nowMs: qaNow() });
const checks = [];
const check = (id, category, run) => checks.push({ id, category, run });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const printableError = error => String(error?.stack || error).slice(0, 6000);
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const safeUrl = value => { try { const u = new URL(value); return u.origin + u.pathname; } catch { return '<invalid-url>'; } };
const op = value => 'op:' + value.toString(16).padStart(32, '0');
const snapshot = (marketAgeMs = 650) => ({ type: 'snapshot', scenario: 'normal', marketAgeMs });
const assisted = mode => ({ source: 'synthetic_fixture', mode, operatorSide: 'buy', technicalSide: 'sell', confidence: 0.85 });
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
        const rpcCode = stderr.match(/\bR6[45]_[A-Z0-9_]{1,80}\b/)?.[0];
        finish(Object.assign(new Error(rpcCode || 'Fixture command failed: ' + binary), { code: rpcCode }));
      }
    });
    child.stdin.on('error', () => {});
    child.stdin.end(input);
  });
}
function validateDisposableDatabase() {
  assert.equal(process.env.JENIOS_R65_DISPOSABLE_DB, 'true', 'Explicit disposable DB flag required.');
  databaseUrl = process.env.JENIOS_R65_TEST_DATABASE_URL;
  const url = new URL(databaseUrl);
  assert.ok(['postgres:', 'postgresql:'].includes(url.protocol));
  assert.equal(url.hostname, '127.0.0.1'); assert.ok(['5432', '56465'].includes(url.port), 'Only dedicated disposable QA ports are accepted.');
  assert.equal(url.pathname, '/jenios_r65_qa'); assert.equal(url.username, 'postgres');
  assert.ok(url.password === 'r64-test-only', 'Only disposable fixture credentials are accepted.');
  assert.equal(url.search, ''); assert.equal(url.hash, '');
}
async function sql(text) {
  return command('psql', ['-XAtq', '-v', 'ON_ERROR_STOP=1', '--dbname', databaseUrl], {
    input: text, env: { ...osEnvironment(), PGCONNECT_TIMEOUT: '5',
      PGOPTIONS: '-c statement_timeout=15000 -c lock_timeout=5000' }, timeoutMs: 20000 });
}
async function rpc(name, input) {
  assert.ok(RPC_NAMES.has(name), 'Only allowlisted R64/R65 RPC names may enter the SQL gateway.');
  const encoded = Buffer.from(JSON.stringify(input)).toString('base64');
  const result = await sql(`BEGIN; SET LOCAL ROLE service_role; SELECT public.${name}(convert_from(decode('${encoded}','base64'),'UTF8')::jsonb); COMMIT;`);
  return JSON.parse(result);
}
async function cycleDatabaseSnapshot() {
  const raw = await sql(`SELECT coalesce(jsonb_agg(jsonb_build_object('state',state,'request',request,'result',result,'report',report,'reservedNanoUsd',reserved_nano_usd,'settledNanoUsd',settled_nano_usd) ORDER BY cycle_id), '[]'::jsonb) FROM public.jenios_robot_cycles_r64 WHERE scope_id='${SCOPE}';`);
  return JSON.parse(raw);
}
async function request(path, { method = 'GET', token, body, contentType, origin } = {}) {
  const headers = {};
  if (origin) headers.Origin = origin;
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
  temporary = await mkdtemp(resolve(tmpdir(), 'jenios-r65-runtime-'));
  const caKey = resolve(temporary, 'qa-ca.key'), caPem = resolve(temporary, 'qa-ca.pem');
  const serverKey = resolve(temporary, 'loopback.key'), csr = resolve(temporary, 'loopback.csr');
  const cert = resolve(temporary, 'loopback.pem'), ext = resolve(temporary, 'loopback.ext');
  await command('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-sha256', '-nodes', '-days', '1',
    '-subj', '/CN=JENIOS R65 ephemeral QA CA', '-addext', 'basicConstraints=critical,CA:TRUE',
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
        const selected = users[token] ?? (token === BROWSER_ADMIN_TOKEN ? users['qa-admin-token'] : undefined);
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
      const code = /^R6[45]_[A-Z0-9_]{1,80}$/.test(error?.code || '') ? error.code : 'R64_RUNTIME_DATABASE_ERROR';
      call.errorCode = code;
      return reply(400, { code: 'P0001', message: code, details: null, hint: null });
    }
  });
  await new Promise((done, reject) => { gateway.once('error', reject); gateway.listen(4321, '127.0.0.1', done); });
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
  log('\nR65 Next fixture flags: ' + JSON.stringify(Object.fromEntries(Object.keys(FLAGS).map(k => [k, env[k] ?? '<absent>']))) + '\n');
  const child = spawn(process.execPath, [resolve(ROOT, 'node_modules/next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', '4320'],
    { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
  const current = { child, error: null };
  current.exited = new Promise(done => child.once('exit', (code, signal) => {
    log(`\nR65 Next exit code=${code}; signal=${signal}\n`); done();
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
  throw new Error('Next did not become ready on 127.0.0.1:4320.');
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
    if (url.origin === ORIGIN && url.pathname === ADMIN && !url.search && req.method() === 'GET' &&
        req.headers().authorization === 'Bearer ' + BROWSER_ADMIN_TOKEN) {
      report.permittedBrowserAdminReads++; await route.continue(); return;
    }
    if (url.origin !== ORIGIN) { attempts.externalRequests++; reasons.push('EXTERNAL_ORIGIN'); }
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) { attempts.apiRequests++; reasons.push('API'); }
    if (!['GET', 'HEAD'].includes(req.method())) { attempts.mutations++; reasons.push('MUTATING_METHOD'); }
    if (reasons.length) { report.networkEvents.push({ url: safeUrl(url.href), method: req.method(), reasons }); await route.abort('blockedbyclient'); }
    else await route.continue();
  });
  await context.routeWebSocket(/.*/, async socket => {
    attempts.webSockets++; report.networkEvents.push({ url: safeUrl(socket.url()), reasons: ['WEBSOCKET'] });
    await socket.close({ code: 1008, reason: 'R65 QA report has no socket transport' });
  });
  context.on('page', opened => {
    opened.on('pageerror', error => report.pageErrors.push(printableError(error)));
    opened.on('console', message => { if (message.type() === 'error' && report.consoleErrors.length < 100) report.consoleErrors.push(message.text().slice(0, 1500)); });
  });
  page = await context.newPage();
}
async function noOverflow(width) {
  await page.setViewportSize({ width, height: 812 });
  await expect(page.getByTestId('r65-cycle-report')).toBeVisible();
  const dimensions = await page.evaluate(() => ({ viewport: innerWidth,
    document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
  assert.ok(dimensions.document <= width && dimensions.body <= width, JSON.stringify(dimensions));
  const box = await page.getByTestId('r65-cycle-report').boundingBox();
  assert.ok(box && box.x >= 0 && box.x + box.width <= width + 1);
  return dimensions;
}

async function refreshState() {
  stateRow = await lifecycleStore.readEvolution({ scopeId: SCOPE });
  assert.ok(stateRow, 'A persisted R65 state must exist.');
  return stateRow;
}
async function intake(record) {
  return request(INTAKE, { method: 'POST', body: record });
}
async function tick() {
  return request(SCHEDULER, { method: 'POST', token: SCHEDULER_TOKEN });
}
async function adminAction(body, token = 'qa-admin-token') {
  return request(ADMIN, { method: 'POST', token, body, origin: ORIGIN });
}
async function counts() {
  return JSON.parse(await sql(`SELECT jsonb_build_object(
    'receipts',(SELECT count(*) FROM public.jenios_robot_events_r64 WHERE scope_id='${SCOPE}'),
    'provenance',(SELECT count(*) FROM public.jenios_robot_observation_provenance_r65 WHERE scope_id='${SCOPE}'),
    'versions',(SELECT count(*) FROM public.jenios_robot_evolution_r65 WHERE scope_id='${SCOPE}'));`));
}
async function waitUntil(time, maximumMs = 15000) {
  assert.ok(Number.isSafeInteger(time) && time - Date.now() < maximumMs, 'Only a short real-time QA window may be awaited.');
  const deadline = Date.now() + maximumMs;
  while (Date.now() < time) {
    assert.ok(Date.now() < deadline, 'Prospective window wait exceeded its limit.');
    await pause(Math.min(250, Math.max(1, time - Date.now())));
  }
}
const withoutGeneratedAt = value => { const { generatedAtMs, ...rest } = value; return rest; };
async function persistedFeed() {
  const evolution = await lifecycleStore.readEvolution({ scopeId: SCOPE });
  const overview = await lifecycleStore.readOverview({ scopeId: SCOPE, limit: 30 });
  const pending = evolution?.state.pendingEvaluation?.plan;
  const validationCases = pending ? await lifecycleStore.readValidationCases({ scopeId: SCOPE, planId: pending.planId }) : [];
  return projectR65AdminFeed({ scopeId: SCOPE, overview, evolution, validationCases, generatedAtMs: Date.now() });
}
async function budget() {
  return JSON.parse(await sql(`SELECT coalesce((SELECT jsonb_build_object('month',month,
    'reservedNanoUsd',reserved_nano_usd,'spentNanoUsd',spent_nano_usd) FROM public.jenios_robot_budgets_r64
    WHERE month=to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM')),
    jsonb_build_object('month',to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM'),'reservedNanoUsd',0,'spentNanoUsd',0));`));
}

check('disposable-sql-and-pinned-source-initialized', 'real-sql', async () => {
  assert.equal((await store.readAnalystPolicy()).generationEnabled, false);
  assert.deepEqual(await store.readReports({ scopeId: SCOPE }), []);
  assert.equal(await lifecycleStore.readEvolution({ scopeId: SCOPE }), null);
  const databaseNow = Number(await sql('SELECT floor(extract(epoch FROM clock_timestamp())*1000)::bigint;'));
  assert.ok(Math.abs(databaseNow - Date.now()) < 2000, 'PostgreSQL must retain its real wall clock.');
  // Initialize without closing an empty R64 daily snapshot.
  stateRow = await ensureR65Evolution({ lifecycleStore, scopeId: SCOPE, env: FLAGS, nowMs: qaNow() });
  assert.equal(stateRow.revision, 0); assert.equal(stateRow.state.activeVersion.maxAgeMs, 750);
  sourceConfig = { enabled: true, domain: 'R61_SYNTHETIC_RUNTIME', scopeId: SCOPE, sourceId: SOURCE,
    sessionId: SESSION, privateKeyPem, initialSequence: 1, getActiveState: () => stateRow.state, now: qaNow,
    getOccurrenceTimeMs: ({ capturedAtMs }) => replayOccurrence ? closedSchedule.period.endMs - 60000 + ++occurrenceSequence : capturedAtMs,
    ultraConfig: { evidenceKind: 'SYNTHETIC_FIXTURE', sessionId: SESSION, planCode: 'platform-global-crypto',
      symbol: 'BTC-USD', capital: 1000, leverage: 2 } };
  source = createR65ObservationSource(sourceConfig);
  return { initialRevision: 0, activeVersion: 'research:r65-v1', maxAgeMs: 750,
    realDatabaseClockVerified: true, dedicatedScopeInitiallyEmpty: true };
});
check('admin-without-session-401', 'authorization', async () => assert.equal((await request(ADMIN)).status, 401));
check('admin-member-403', 'authorization', async () => assert.equal((await request(ADMIN, { token: 'qa-member-token' })).status, 403));
check('admin-anonymous-401', 'authorization', async () => assert.equal((await request(ADMIN, { token: 'qa-anonymous-token' })).status, 401));
check('scheduler-dedicated-token-required', 'authorization', async () => {
  for (const token of [undefined, 'invalid-token', R64_SCHEDULER_TOKEN])
    assert.equal((await request(SCHEDULER, { method: 'POST', token })).status, 401);
  assert.equal((await request(SCHEDULER, { method: 'POST', token: SCHEDULER_TOKEN, body: {} })).status, 400);
});
check('admin-action-scope-origin-and-media-boundaries', 'authorization', async () => {
  assert.equal((await adminAction({ action: 'TICK', scopeId: 'scope:ffffffffffffffff' })).status, 400);
  assert.equal((await adminAction({ action: 'TICK' }, 'qa-member-token')).status, 403);
  assert.equal((await request(ADMIN, { method: 'POST', token: 'qa-admin-token', body: { action: 'TICK' }, origin: 'https://untrusted.invalid' })).status, 403);
  assert.equal((await request(ADMIN, { method: 'POST', token: 'qa-admin-token', body: '{}', contentType: 'text/plain' })).status, 415);
  assert.equal((await request(INTAKE, { method: 'POST', body: '{}', contentType: 'text/plain' })).status, 415);
});
check('eight-runtime-observations-and-provenance-atomic', 'signed-intake', async () => {
  baselineRecords = ['manual', 'hybrid', 'reverse'].map((mode, index) =>
    source.captureAssisted({ operationId: op(index + 1), input: assisted(mode) }));
  for (const [index, age] of [650, 650, 950, 1000, 1100].entries())
    baselineRecords.push(source.captureUltra({ operationId: op(index + 4), event: snapshot(age) }));
  assert.equal(baselineRecords[4].envelope.payload.event.decision, 'ALLOW');
  for (const record of baselineRecords) {
    const result = await intake(record);
    assert.equal(result.status, 202, JSON.stringify(result.data)); assert.equal(result.data.status, 'STORED');
    const proof = verifyR65ObservationRecord(record, { trustedSource: source.trustedSource, nowMs: qaNow() });
    assert.equal(proof.provenance.origin, 'R61_SYNTHETIC_RUNTIME');
    assert.equal(proof.provenance.clockSource, 'PINNED_QA_REPLAY_CLOCK');
    assert.equal(proof.receipt.event.policyVersion, 'research:r65-v1');
  }
  const rows = await store.readReceipts({ scopeId: SCOPE, period: closedSchedule.period });
  assert.equal(rows.length, 8); assert.equal(rows.filter(r => r.event.issue === 'STALE_CONTEXT').length, 3);
  assert.deepEqual(await counts(), { receipts: 8, provenance: 8, versions: 1 });
  return { receipts: 8, atomicallyBoundProvenance: 8, staleEpisodes: 3, robots: 4,
    baseline650Decision: 'ALLOW', originalRuntime: 'R61_SYNTHETIC_RUNTIME' };
});
check('exact-intake-retry-retains-first-receipt', 'signed-intake', async () => {
  const before = await store.readReceipts({ scopeId: SCOPE, period: closedSchedule.period });
  const result = await intake(baselineRecords[0]);
  assert.equal(result.status, 200); assert.equal(result.data.status, 'ALREADY_STORED');
  assert.deepEqual(await store.readReceipts({ scopeId: SCOPE, period: closedSchedule.period }), before);
  assert.deepEqual(await counts(), { receipts: 8, provenance: 8, versions: 1 });
});
check('tampered-signatures-and-unbound-origin-refused-before-database', 'signed-intake', async () => {
  const eventChanged = structuredClone(baselineRecords[0]); eventChanged.envelope.payload.event.marketAgeMs++;
  const sidecarChanged = structuredClone(baselineRecords[0]); sidecarChanged.provenance.activationGeneration++;
  const operational = structuredClone(baselineRecords[0]); operational.provenance.origin = 'OPERATIONAL';
  const otherSource = createR65ObservationSource({ ...sourceConfig, sourceId: 'source:ffffffffffffffff' })
    .captureAssisted({ operationId: op(90), input: assisted('manual') });
  for (const body of [eventChanged, sidecarChanged, operational, otherSource, baselineRecords[0].envelope]) {
    const before = report.gatewayCalls.length;
    assert.equal((await intake(body)).status, 400);
    assert.equal(report.gatewayCalls.length, before, 'Rejected signatures must not open the database boundary.');
  }
});
check('signed-event-conflict-409-preserves-original', 'signed-intake', async () => {
  const alternate = createR65ObservationSource({ ...sourceConfig, initialSequence: 2 });
  const conflict = alternate.captureAssisted({ operationId: op(2), input: { ...assisted('hybrid'), confidence: 0.1 } });
  assert.equal(conflict.envelope.payload.eventId, baselineRecords[1].envelope.payload.eventId);
  assert.equal((await intake(conflict)).status, 409);
  assert.deepEqual(await counts(), { receipts: 8, provenance: 8, versions: 1 });
});
check('intake-database-failure-503-without-partial-provenance', 'failure-boundary', async () => {
  const otherSession = 'session:ffffffffffffff65';
  const isolated = createR65ObservationSource({ ...sourceConfig, sessionId: otherSession,
    ultraConfig: { ...sourceConfig.ultraConfig, sessionId: otherSession } });
  const record = isolated.captureAssisted({ operationId: op(91), input: assisted('manual') });
  gatewayRpcUnavailable = true;
  try { assert.equal((await intake(record)).status, 503); }
  finally { gatewayRpcUnavailable = false; }
  assert.deepEqual(await counts(), { receipts: 8, provenance: 8, versions: 1 });
});
check('r64-http-closes-immutable-observation-study', 'observation-study', async () => {
  const result = await request(R64_SCHEDULER, { method: 'POST', token: R64_SCHEDULER_TOKEN });
  assert.equal(result.status, 200, JSON.stringify(result.data));
  assert.equal(result.data.status, 'STORED_OPERATIONAL_QA_REPORT');
  observationCycle = await store.readCycle({ scopeId: SCOPE, periodKey: closedSchedule.periodKey });
  assert.equal(observationCycle.status, 'COMPLETED'); persistedR64 = observationCycle.report;
  assert.equal(persistedR64.observations.eventCount, 8); assert.equal(persistedR64.observations.incidentCount, 3);
  assert.deepEqual(persistedR64.observations.byRobot, { manual: 1, hybrid: 1, reverse: 1, ultrafast: 5 });
  const retry = await request(R64_SCHEDULER, { method: 'POST', token: R64_SCHEDULER_TOKEN });
  assert.equal(retry.status, 200); assert.equal(retry.data.status, 'ALREADY_STORED');
  assert.deepEqual((await store.readCycle({ scopeId: SCOPE, periodKey: closedSchedule.periodKey })).report, persistedR64);
  return { reportDigest: digest(persistedR64), receiptCount: 8, incidentCount: 3,
    closedCalendar: usedCalendarFixture ? 'EXPLICIT_PAST_QA_CLOCK' : 'REAL_WALL_CLOCK' };
});
check('provider-disabled-with-zero-dispatch', 'provider-boundary', async () => {
  assert.equal(persistedR64.providerAudit.kind, 'not_generated');
  assert.equal(persistedR64.providerAudit.httpRequests, 0); assert.equal(persistedR64.providerAudit.inferenceRequests, 0);
  const rows = await cycleDatabaseSnapshot(); assert.equal(rows.length, 1);
  assert.equal(rows[0].reservedNanoUsd, 0); assert.equal(rows[0].settledNanoUsd, 0); assert.equal(rows[0].request, null);
  assert.ok(!report.gatewayCalls.some(c => c.rpc === R64_DATABASE_RPCS.reserveAndDispatch));
  return { providerHttpRequests: 0, inferenceRequests: 0, reservationNanoUsd: 0, settledNanoUsd: 0 };
});
check('future-benchmark-registration-is-persisted', 'evolution-cycle', async () => {
  if (usedCalendarFixture) {
    // The daily calendar gate is preserved. Only the harness may bridge its past
    // signed fixture to a NEW benchmark registered on the database's real clock.
    clockOffsetMs = 0; delete nextEnv.NODE_OPTIONS; await startServer();
    const currentCalendar = scheduleR64TelemetryPeriod({ nowMs: Date.now() });
    assert.equal(realScheduleAtStart.due, false);
    if (!currentCalendar.due) {
      const notDue = await tick(); assert.equal(notDue.status, 200); assert.equal(notDue.data.status, 'NOT_DUE');
      report.scope.realCalendarNotDueVerified = true;
    } else {
      // A run that starts immediately before 09h may cross that boundary during
      // fixture startup. Preserve the declared direct registration path and do
      // not create an empty snapshot of the newly due, different daily period.
      report.scope.realCalendarNotDueVerified = false;
      report.scope.dailyWindowCrossedDuringHarness = true;
    }
    await refreshState();
    const nowMs = Date.now(), receipts = await store.readReceipts({ scopeId: SCOPE, period: closedSchedule.period });
    const registrationAtMs = Date.now();
    plan = createR65RegisteredBenchmark({ scopeId: SCOPE, sourceCycleId: observationCycle.cycleId, nowMs: registrationAtMs });
    const state = registerR65Evaluation({ state: stateRow.state, receipts, period: closedSchedule.period,
      studyAtMs: observationCycle.input.study.generatedAtMs, sourceCycleId: observationCycle.cycleId, plan, nowMs: registrationAtMs });
    await lifecycleStore.appendEvolution({ scopeId: SCOPE, operationId: r65OperationId(SCOPE, 'REGISTER', observationCycle.cycleId),
      expectedRevision: stateRow.revision, previousDigest: stateRow.stateDigest, state, actorId: 'system:r65' });
    report.scope.registrationPositivePath = 'DIRECT_QA_CALENDAR_FIXTURE';
    assert.ok(plan.startsAtMs > nowMs);
  } else {
    const result = await tick(); assert.equal(result.status, 200, JSON.stringify(result.data));
    assert.equal(result.data.status, 'EVALUATION_REGISTERED');
    report.scope.registrationPositivePath = 'REAL_HTTP_WALL_CLOCK';
  }
  await refreshState(); assert.equal(stateRow.revision, 1);
  plan = stateRow.state.pendingEvaluation.plan;
  assert.equal(plan.evidenceKind, 'SYNTHETIC_FIXTURE'); assert.equal(plan.caseDefinitions.length, 6);
  assert.ok(plan.startsAtMs > stateRow.state.pendingEvaluation.registeredAtMs);
  assert.equal(plan.endsAtMs - plan.startsAtMs, 10000);
  assert.deepEqual(await lifecycleStore.readValidationCases({ scopeId: SCOPE, planId: plan.planId }), []);
  return { registrationPositivePath: report.scope.registrationPositivePath, planId: plan.planId,
    startsAtMs: plan.startsAtMs, endsAtMs: plan.endsAtMs, registeredBeforeWindow: true, casesInitiallyAbsent: true };
});
check('real-http-tick-captures-six-cases-inside-postgres-window', 'evolution-cycle', async () => {
  await waitUntil(plan.startsAtMs + 40);
  const result = await tick(); assert.equal(result.status, 200, JSON.stringify(result.data));
  assert.equal(result.data.status, 'VALIDATION_CAPTURED');
  const cases = await lifecycleStore.readValidationCases({ scopeId: SCOPE, planId: plan.planId });
  assert.equal(cases.length, 6);
  assert.ok(cases.every(c => c.evidenceKind === 'SYNTHETIC_FIXTURE' && c.occurredAtMs >= plan.startsAtMs && c.occurredAtMs < plan.endsAtMs));
  const retry = await tick(); assert.equal(retry.status, 200); assert.equal(retry.data.status, 'VALIDATION_CAPTURED');
  assert.deepEqual(await lifecycleStore.readValidationCases({ scopeId: SCOPE, planId: plan.planId }), cases);
  return { casesCaptured: 6, timeAuthority: 'POSTGRESQL_CLOCK_TIMESTAMP', duplicateTickPreservedCaptureTimes: true };
});
check('closed-window-http-tick-applies-validated-version', 'evolution-cycle', async () => {
  await waitUntil(plan.endsAtMs + 40);
  const result = await tick(); assert.equal(result.status, 200, JSON.stringify(result.data));
  assert.equal(result.data.status, 'AUTO_APPLIED');
  await refreshState(); assert.equal(stateRow.revision, 2);
  assert.equal(stateRow.state.activeVersion.versionId, 'research:r65-v2');
  assert.equal(stateRow.state.activeVersion.activationGeneration, 1);
  assert.equal(stateRow.state.activeVersion.maxAgeMs, 500);
  const evaluation = stateRow.state.evaluations.at(-1);
  assert.equal(evaluation.baseline.falseAllows, 2); assert.equal(evaluation.candidate.falseAllows, 0);
  assert.equal(evaluation.candidate.falseBlocks, 0);
  const before = stateRow.stateDigest, retry = await tick(); assert.equal(retry.status, 200);
  assert.equal(retry.data.status, scheduleR64TelemetryPeriod({ nowMs: Date.now() }).due ? 'NO_NEW_AUTHORIZED_CANDIDATE' : 'NOT_DUE');
  await refreshState(); assert.equal(stateRow.stateDigest, before);
  return { version: 'research:r65-v2', maxAgeMs: 500, activationGeneration: 1,
    baselineFalseAllows: 2, candidateFalseAllows: 0, candidateFalseBlocks: 0 };
});
check('same-runtime-consumes-persisted-version-and-blocks-650ms', 'active-runtime', async () => {
  replayOccurrence = false;
  promotedRecord = source.captureUltra({ operationId: op(9), event: snapshot(650) });
  assert.equal(promotedRecord.envelope.payload.event.policyVersion, 'research:r65-v2');
  assert.equal(promotedRecord.envelope.payload.event.decision, 'BLOCK');
  assert.equal(promotedRecord.envelope.payload.event.issue, 'STALE_CONTEXT');
  assert.equal(promotedRecord.provenance.activationGeneration, 1);
  assert.equal((await intake(promotedRecord)).status, 202);
  assert.strictEqual(source.captureUltra({ operationId: op(5), event: snapshot(650) }), baselineRecords[4]);
  return { baseline650Decision: baselineRecords[4].envelope.payload.event.decision,
    promoted650Decision: promotedRecord.envelope.payload.event.decision, generation: 1 };
});
check('admin-rollback-and-retry-restore-durable-version', 'rollback', async () => {
  await refreshState();
  rollbackAction = { action: 'ROLLBACK', operationId: op(100), expectedRevision: stateRow.revision,
    previousDigest: stateRow.stateDigest, reason: 'OWNER_REQUEST' };
  const result = await adminAction(rollbackAction); assert.equal(result.status, 200, JSON.stringify(result.data));
  assert.equal(result.data.result.status, 'ROLLED_BACK');
  await refreshState(); assert.equal(stateRow.revision, 3);
  assert.equal(stateRow.state.activeVersion.versionId, 'research:r65-v1');
  assert.equal(stateRow.state.activeVersion.activationGeneration, 2);
  const before = stateRow.stateDigest;
  const retry = await adminAction(rollbackAction); assert.equal(retry.status, 200, JSON.stringify(retry.data));
  await refreshState(); assert.equal(stateRow.stateDigest, before);
  assert.equal((await adminAction({ ...rollbackAction, reason: 'TECHNICAL_FAILURE' })).status, 409);
});
check('rollback-runtime-requires-two-new-confirmations', 'active-runtime', async () => {
  rollbackRecords = [10, 11].map(n => source.captureUltra({ operationId: op(n), event: snapshot(650) }));
  assert.deepEqual(rollbackRecords.map(r => r.envelope.payload.event.decision), ['BLOCK', 'ALLOW']);
  for (const record of rollbackRecords) {
    assert.equal(record.envelope.payload.event.policyVersion, 'research:r65-v1');
    assert.equal(record.provenance.activationGeneration, 2); assert.equal((await intake(record)).status, 202);
  }
  assert.deepEqual(await counts(), { receipts: 11, provenance: 11, versions: 4 });
  assert.deepEqual((await store.readCycle({ scopeId: SCOPE, periodKey: closedSchedule.periodKey })).report, persistedR64);
  return { decisions: ['BLOCK', 'ALLOW'], activationGeneration: 2, originalR64ReportPreserved: true };
});
check('explicit-uncertain-cost-fixture-is-held-without-provider-call', 'cost-reconciliation', async () => {
  const previous = scheduleR64TelemetryPeriod({ nowMs: closedSchedule.scheduledAtMs - 86400000 + 1000 });
  const study = studyR64AcceptedTelemetry([], { scopeId: SCOPE, period: previous.period, generatedAtMs: previous.scheduledAtMs + 1000 });
  const input = { schema: 'JENIOS_R64_OPERATIONAL_CYCLE_INPUT_V1', evidenceKind: 'SIGNED_QA_REPLAY',
    scopeId: SCOPE, periodKey: previous.periodKey, study };
  uncertainCycle = await store.claimCycle({ scopeId: SCOPE, periodKey: previous.periodKey, inputDigest: hashR64CycleInput(input), input });
  assert.equal(uncertainCycle.status, 'CLAIMED');
  assert.match(uncertainCycle.cycleId, /^[a-f0-9-]{36}$/);
  const fingerprint = digest({ fixture: 'R65_EXPLICIT_DATABASE_CRASH_WITHOUT_PROVIDER', scopeId: SCOPE });
  budgetBeforeFixture = await budget();
  await sql(`BEGIN;
    INSERT INTO public.jenios_robot_budgets_r64(month,reserved_nano_usd,spent_nano_usd)
      VALUES(to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM'),1350000,0)
      ON CONFLICT(month) DO UPDATE SET reserved_nano_usd=public.jenios_robot_budgets_r64.reserved_nano_usd+1350000;
    UPDATE public.jenios_robot_cycles_r64 SET state='NEEDS_RECONCILIATION',
      request=jsonb_build_object('fingerprint','${fingerprint}'),reserved_nano_usd=1350000,
      budget_month=to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM'),audit_code='EXPLICIT_QA_CRASH_FIXTURE'
      WHERE scope_id='${SCOPE}' AND cycle_id='${uncertainCycle.cycleId}'; COMMIT;`);
  reconciliationAction = { action: 'RECONCILE_COST', operationId: op(101), cycleId: uncertainCycle.cycleId,
    expectedFingerprint: fingerprint, resolution: { kind: 'CONFIRMED_NO_CHARGE', costNanoUsd: 0, providerResponseId: null },
    evidenceDigest: digest({ fixture: 'NO_PROVIDER_DISPATCH_OCCURRED', cycleId: uncertainCycle.cycleId }) };
  const feed = await request(ADMIN, { token: 'qa-admin-token' }); assert.equal(feed.status, 200);
  assert.equal(feed.data.pendingReconciliations.length, 1);
  assert.equal(feed.data.pendingReconciliations[0].cycleId, uncertainCycle.cycleId);
  assert.equal((await budget()).reservedNanoUsd, budgetBeforeFixture.reservedNanoUsd + 1350000);
  assert.equal((await adminAction({ action: 'ARCHIVE_PREVIEW', cutoffMs: Date.now(), limit: 10 })).status, 409);
  return { setup: 'EXPLICIT_DATABASE_CRASH_FIXTURE_NO_PROVIDER_CALL', reservationNanoUsd: 1350000,
    archivedWhileUnresolved: false, providerHttpRequests: 0 };
});
check('admin-cost-reconciliation-is-idempotent-and-generation-stays-disabled', 'cost-reconciliation', async () => {
  const before = await cycleDatabaseSnapshot();
  const result = await adminAction(reconciliationAction); assert.equal(result.status, 200, JSON.stringify(result.data));
  assert.equal(result.data.result.status, 'RECONCILED'); assert.equal(result.data.result.replayed, false);
  const retry = await adminAction(reconciliationAction); assert.equal(retry.status, 200); assert.equal(retry.data.result.replayed, true);
  const changed = { ...reconciliationAction, evidenceDigest: 'f'.repeat(64) };
  assert.equal((await adminAction(changed)).status, 409);
  assert.deepEqual(await budget(), budgetBeforeFixture);
  assert.equal((await store.readAnalystPolicy()).generationEnabled, false);
  assert.deepEqual(await cycleDatabaseSnapshot(), before, 'Reconciliation must preserve original R64 cycle rows.');
  const feed = await request(ADMIN, { token: 'qa-admin-token' }); assert.equal(feed.status, 200);
  assert.equal(feed.data.pendingReconciliations.length, 0); assert.equal(feed.data.reconciliations.length, 1);
  assert.equal(feed.data.reconciliations[0].resolutionKind, 'CONFIRMED_NO_CHARGE');
  return { fixtureReservationReleasedNanoUsd: 1350000, actualProviderCalls: 0, settledCostNanoUsd: 0,
    generationEnabled: false, originalCyclePreserved: true };
});
check('archive-preview-and-digest-bound-commit-preserve-originals', 'archive', async () => {
  const before = await counts(), original = await cycleDatabaseSnapshot();
  const preview = await adminAction({ action: 'ARCHIVE_PREVIEW', cutoffMs: Date.now(), limit: 10 });
  assert.equal(preview.status, 200, JSON.stringify(preview.data)); archivePreview = preview.data.result;
  assert.equal(archivePreview.status, 'PREVIEW'); assert.equal(archivePreview.eventCount, 10); assert.equal(archivePreview.cycleCount, 2);
  assert.equal(archivePreview.archiveMode, 'LOGICAL_COPY_ONLY');
  archiveAction = { action: 'ARCHIVE_COMMIT', operationId: op(102), archiveId: archivePreview.archiveId,
    manifestDigest: archivePreview.manifestDigest };
  const bad = await adminAction({ ...archiveAction, manifestDigest: 'f'.repeat(64) });
  assert.ok(bad.status >= 400, 'A changed archive manifest cannot be committed.');
  assert.equal(await lifecycleStore.readArchive({ scopeId: SCOPE, archiveId: archivePreview.archiveId }), null);
  const result = await adminAction(archiveAction); assert.equal(result.status, 200, JSON.stringify(result.data));
  assert.equal(result.data.result.status, 'COMMITTED'); assert.equal(result.data.result.physicalDeletionPerformed, false);
  assert.equal(result.data.result.spaceReclaimedBytes, 0);
  const retry = await adminAction(archiveAction); assert.equal(retry.status, 200); assert.equal(retry.data.result.replayed, true);
  assert.deepEqual(await counts(), before); assert.deepEqual(await cycleDatabaseSnapshot(), original);
  const archived = await lifecycleStore.readArchive({ scopeId: SCOPE, archiveId: archivePreview.archiveId });
  assert.equal(archived.verified, true); assert.equal(archived.manifestDigest, archivePreview.manifestDigest);
  assert.equal(archived.manifest.events.length, 10); assert.equal(archived.manifest.cycles.length, 2);
  assert.equal(archived.manifest.physicalDeletionPerformed, false); assert.equal(archived.manifest.spaceReclaimedBytes, 0);
  assert.equal(await lifecycleStore.readArchive({ scopeId: 'scope:ffffffffffffffff', archiveId: archivePreview.archiveId }), null);
  return { verifiedManifestDigest: archived.manifestDigest, eventCopies: 10, cycleCopies: 2,
    originalReceiptsRetained: before.receipts, physicalDeletionPerformed: false, spaceReclaimedBytes: 0 };
});
check('admin-feed-exactly-projects-the-persisted-store', 'admin-read', async () => {
  const result = await request(ADMIN, { token: 'qa-admin-token' }); assert.equal(result.status, 200, JSON.stringify(result.data));
  finalFeed = result.data;
  assert.deepEqual(withoutGeneratedAt(finalFeed), withoutGeneratedAt(await persistedFeed()));
  assert.equal(finalFeed.state.maturity, 'QA_ROLLED_BACK'); assert.equal(finalFeed.state.activeVersion.activationGeneration, 2);
  assert.equal(finalFeed.state.lastEvaluation.validationCases, 6);
  assert.equal(finalFeed.archives.filter(a => a.status === 'COMMITTED').length, 1);
  assert.equal(finalFeed.reconciliations.length, 1); assert.equal(finalFeed.pendingReconciliations.length, 0);
  assert.equal(finalFeed.customerMonitoringActive, false); assert.equal(finalFeed.privateEngineConnected, false);
  return { feedDigestWithoutGeneratedAt: digest(withoutGeneratedAt(finalFeed)), persistedRevision: finalFeed.state.revision,
    archives: 1, reconciliations: 1 };
});
check('database-unavailable-admin-and-scheduler-503-then-recover', 'failure-boundary', async () => {
  gatewayRpcUnavailable = true;
  try {
    assert.equal((await request(ADMIN, { token: 'qa-admin-token' })).status, 503);
    assert.equal((await tick()).status, 503);
  } finally { gatewayRpcUnavailable = false; }
  const recovered = await request(ADMIN, { token: 'qa-admin-token' }); assert.equal(recovered.status, 200);
  assert.deepEqual(withoutGeneratedAt(recovered.data), withoutGeneratedAt(finalFeed));
});
check('browser-anonymous-html-and-session-do-not-disclose-admin-data', 'browser-authorization', async () => {
  await setupBrowser();
  const before = report.permittedBrowserAdminReads;
  const response = await page.goto(ORIGIN + PAGE, { waitUntil: 'networkidle' }); assert.equal(response.status(), 200);
  const html = await response.text();
  assert.ok(!html.includes('data-testid="r65-cycle-report"')); assert.ok(!html.includes(SCOPE));
  assert.ok(!html.includes(finalFeed.state.stateDigest));
  await expect(page.getByTestId('r65-cycle-report')).toHaveCount(0);
  await expect(page.getByText('Entre com uma conta administrativa da Platform para consultar o ciclo de QA.')).toBeVisible();
  assert.equal(report.permittedBrowserAdminReads, before);
  return { anonymousHtmlContainsAdminFeed: false, anonymousBrowserRequestedAdminFeed: false };
});
check('browser-fixture-session-reads-real-authenticated-admin-endpoint', 'browser-authorization', async () => {
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  await page.evaluate(({ key, session }) => localStorage.setItem(key, JSON.stringify(session)), {
    key: 'jenios-platform-auth-v1', session: { access_token: BROWSER_ADMIN_TOKEN,
      refresh_token: 'r65-explicit-fixture-no-refresh', token_type: 'bearer', expires_in: 3600, expires_at: expiresAt,
      user: { id: '00000000-0000-4000-8000-000000000064', aud: 'authenticated', role: 'authenticated',
        app_metadata: { platform_role: 'admin' }, user_metadata: {}, is_anonymous: false,
        created_at: '2026-10-24T00:00:00.000Z' } } });
  const received = page.waitForResponse(response => response.url() === ORIGIN + ADMIN && response.request().method() === 'GET');
  const response = await page.reload({ waitUntil: 'networkidle' }); assert.equal(response.status(), 200);
  const adminResponse = await received; assert.equal(adminResponse.status(), 200);
  assert.deepEqual(withoutGeneratedAt(await adminResponse.json()), withoutGeneratedAt(finalFeed));
  await expect(page.getByTestId('r65-cycle-report')).toBeVisible();
  await expect(page.getByTestId('r65-active-version')).toHaveText('research:r65-v1');
  await expect(page.getByTestId('r65-active-age')).toHaveText('750 ms');
  await expect(page.getByTestId('r65-generation')).toHaveText('2');
  await expect(page.getByTestId('r65-maturity')).toHaveText('Configuração anterior restaurada');
  assert.ok(report.permittedBrowserAdminReads >= 1);
  return { authentication: 'EXPLICIT_SUPABASE_SESSION_FIXTURE', feedInjectedIntoBrowser: false,
    actualAdminHttpRead: true, realUserIdentityVerified: false };
});
check('browser-shows-history-provenance-archive-and-reconciliation-boundaries', 'browser', async () => {
  await expect(page.getByTestId('r65-provenance')).toContainText('execuções sintéticas');
  await expect(page.getByTestId('r65-no-orders')).toHaveText('Ordens reais: 0 · Paper externo: 0 · Monitoramento de clientes: inativo.');
  for (const text of ['Avaliação registrada', 'Melhoria aplicada em QA', 'Reversão concluída'])
    await expect(page.getByTestId('r65-history')).toContainText(text);
  await expect(page.getByTestId('r65-archives')).toContainText('1 arquivo(s) confirmado(s)');
  await expect(page.getByTestId('r65-archives')).toContainText('Espaço liberado: 0 bytes.');
  await expect(page.getByTestId('r65-reconciliations')).toContainText('1 reconciliação(ões) registrada(s) · 0 pendência(s).');
  await expect(page.getByTestId('r65-cycle-report')).toContainText('não certificam rentabilidade');
  await expect(page.getByRole('button', { name: 'Avançar ciclo de QA' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Restaurar configuração anterior' })).toHaveCount(0);
});
check('browser-authenticated-reload-retains-persisted-state', 'browser', async () => {
  const received = page.waitForResponse(response => response.url() === ORIGIN + ADMIN && response.request().method() === 'GET');
  assert.equal((await page.reload({ waitUntil: 'networkidle' })).status(), 200);
  const response = await received; assert.equal(response.status(), 200);
  assert.deepEqual(withoutGeneratedAt(await response.json()), withoutGeneratedAt(finalFeed));
  await expect(page.getByTestId('r65-active-version')).toHaveText('research:r65-v1');
  await expect(page.getByTestId('r65-generation')).toHaveText('2');
});
check('browser-mobile-375-no-overflow', 'browser', async () => noOverflow(375));
check('browser-mobile-320-no-overflow', 'browser', async () => {
  const dimensions = await noOverflow(320);
  await page.screenshot({ path: FILES.mobile, fullPage: true }); report.artifacts.mobile = FILES.mobile;
  return dimensions;
});
check('browser-no-forbidden-traffic-or-errors', 'browser', async () => {
  assert.deepEqual(attempts, { externalRequests: 0, apiRequests: 0, mutations: 0, webSockets: 0 });
  assert.deepEqual(report.pageErrors, []); assert.deepEqual(report.consoleErrors, []);
  assert.ok(report.permittedBrowserAdminReads >= 2);
  await browser.close(); browser = undefined; context = undefined; page = undefined;
  return { ...attempts, permittedAuthenticatedAdminReads: report.permittedBrowserAdminReads };
});
check('missing-r65-flag-routes-404-without-gateway', 'disabled-gate', async () => {
  await startServer({ JENIOS_ROBOT_R65_ENABLED: undefined });
  const before = report.gatewayCalls.length;
  assert.equal((await request(INTAKE, { method: 'POST', body: baselineRecords[0] })).status, 404);
  assert.equal((await tick()).status, 404);
  assert.equal((await request(ADMIN, { token: 'qa-admin-token' })).status, 404);
  assert.equal(report.gatewayCalls.length, before);
});
check('missing-r65-flag-page-404-without-admin-data', 'disabled-gate', async () => {
  const before = report.gatewayCalls.length, response = await request(PAGE);
  assert.equal(response.status, 404); assert.ok(!response.data.includes('data-testid="r65-cycle-report"'));
  assert.ok(!response.data.includes(SCOPE)); assert.equal(report.gatewayCalls.length, before);
});

try {
  await mkdir(ARTIFACT_DIR, { recursive: true }); validateDisposableDatabase();
  await readFile(resolve(ROOT, '.next/BUILD_ID'), 'utf8');
  assert.equal(closedSchedule.due, true);
  const db = { rpc: async (name, args) => ({ data: await rpc(name, args.p_input), error: null }) };
  store = createR64DatabaseStore({ db }); lifecycleStore = createR65DatabaseStore({ db });
  const caPath = await startGateway();
  nextEnv = { ...osEnvironment(), NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1', ...FLAGS,
    NODE_EXTRA_CA_CERTS: caPath, PLATFORM_SUPABASE_URL: GATEWAY,
    PLATFORM_SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
    JENIOS_ROBOT_R64_SCOPE_ID: SCOPE, JENIOS_ROBOT_R64_SOURCE_ID: SOURCE,
    JENIOS_ROBOT_R64_SOURCE_PUBLIC_KEY: publicKeyPem,
    JENIOS_ROBOT_R64_SCHEDULER_TOKEN: R64_SCHEDULER_TOKEN,
    JENIOS_ROBOT_R65_SCHEDULER_TOKEN: SCHEDULER_TOKEN };
  if (usedCalendarFixture) {
    const preload = resolve(temporary, 'past-qa-calendar.cjs');
    await writeFile(preload, `// Isolated acceptance fixture only; PostgreSQL and timers remain real.\nconst originalNow = Date.now.bind(Date);\nObject.defineProperty(Date, 'now', { value: () => originalNow() + (${clockOffsetMs}), configurable: true });\n`);
    nextEnv.NODE_OPTIONS = '--require=' + preload;
  }
  await startServer();
  for (const item of checks) {
    const began = Date.now();
    try {
      const evidence = await item.run();
      report.cases.push({ id: item.id, category: item.category, status: 'PASS', elapsedMs: Date.now() - began,
        ...(evidence === undefined ? {} : { evidence }) });
      console.log('[R65 runtime] PASS ' + item.id);
    } catch (error) {
      report.cases.push({ id: item.id, category: item.category, status: 'FAIL', elapsedMs: Date.now() - began, error: printableError(error) });
      console.error('[R65 runtime] FAIL ' + item.id + ': ' + String(error?.message || error));
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
  console.log('R65_RUNTIME_ACCEPTANCE ' + JSON.stringify({ schema: report.schema, status: report.status,
    counts: report.counts, allPlannedCasesRan: report.summary.allPlannedCasesRan,
    registrationPositivePath: report.scope.registrationPositivePath, attempts,
    permittedAuthenticatedAdminReads: report.permittedBrowserAdminReads, artifacts: report.artifacts }));
  if (report.status !== 'PASS') process.exitCode = 1;
}

